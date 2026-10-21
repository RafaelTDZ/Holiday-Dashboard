/**
 * Rate limiter em memória (sem dependência externa) para as rotas de
 * autenticação.
 *
 * ---------------------------------------------------------------------------
 * IMPORTANTE — limite por instância
 * ---------------------------------------------------------------------------
 * O estado do limiter vive no processo (um `Map` em memória). Em um deploy com
 * múltiplas instâncias (serverless, réplicas, containers) o limite vale **por
 * instância**: um atacante distribuindo as requisições entre 5 instâncias
 * consegue 5x mais tentativas do que o limite nominal sugere. Para um limite
 * realmente global seria necessário um store compartilhado (Redis, MongoDB,
 * etc.) — o que exigiria uma nova dependência, proibida neste pacote.
 *
 * O cleanup é *lazy* (executado dentro do próprio handler, no máximo uma vez a
 * cada 5 minutos) de propósito: um `setInterval` manteria o event loop vivo e
 * não é seguro em ambiente serverless, onde o processo pode ser congelado e
 * retomado a qualquer momento. Em troca, o `Map` nunca cresce sem limite:
 * entradas sem requisição dentro da janela são removidas no próximo cleanup.
 */

import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";

export interface RateLimiterOptions {
  /** Duração da janela, em ms. */
  windowMs: number;
  /** Máximo de requisições aceitas dentro da janela. */
  max: number;
  /** Mensagem devolvida no corpo da resposta 429. */
  message?: string;
  /** Gera a chave de contagem. Padrão: IP do cliente (`getRateLimitKey`). */
  keyGenerator?: (req: Request) => string;
}

const DEFAULT_MESSAGE =
  "Muitas requisições. Aguarde alguns instantes e tente novamente.";

/** Intervalo mínimo entre dois cleanups do `Map` (5 minutos). */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/** Chave usada quando não é possível identificar o cliente. */
const UNKNOWN_KEY = "unknown";

interface Bucket {
  /** Timestamps (ms) das requisições aceitas dentro da janela atual. */
  hits: number[];
}

/**
 * Chave de contagem padrão: o IP do cliente.
 *
 * `req.ip` pode ser `undefined` (depende de como a aplicação está atrás de um
 * proxy); nesse caso usamos o endereço do socket e, por último, a chave
 * literal `"unknown"` — nunca quebramos a requisição por causa disso.
 */
export function getRateLimitKey(req: Request): string {
  const ip = req.ip;
  if (typeof ip === "string" && ip.trim().length > 0) {
    return ip.trim();
  }

  const remoteAddress = req.socket?.remoteAddress;
  if (typeof remoteAddress === "string" && remoteAddress.trim().length > 0) {
    return remoteAddress.trim();
  }

  return UNKNOWN_KEY;
}

/**
 * Cria um middleware de rate limit com janela deslizante simples.
 *
 * A janela é deslizante de verdade: a cada requisição as marcas de tempo
 * mais antigas que já saíram da janela (`now - windowMs`) são descartadas, de
 * modo que o cliente só volta a ser aceito quando a requisição mais antiga
 * que ainda vale expira.
 */
export function createRateLimiter(
  options: RateLimiterOptions,
): (req: Request, res: Response, next: NextFunction) => void {
  const windowMs = Math.max(1, Math.floor(options.windowMs));
  const max = Math.max(1, Math.floor(options.max));
  const message = options.message ?? DEFAULT_MESSAGE;
  const keyGenerator = options.keyGenerator ?? getRateLimitKey;

  const buckets = new Map<string, Bucket>();
  let lastCleanupAt = Date.now();

  /** Remove as entradas sem atividade dentro da janela. */
  function cleanup(now: number): void {
    const cutoff = now - windowMs;
    for (const [key, bucket] of buckets) {
      const kept = bucket.hits.filter((hit) => hit > cutoff);
      if (kept.length === 0) {
        buckets.delete(key);
      } else {
        bucket.hits = kept;
      }
    }
    lastCleanupAt = now;
  }

  return function rateLimit(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const now = Date.now();

    // Cleanup lazy: no máximo uma vez a cada 5 minutos.
    if (now - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
      cleanup(now);
    }

    const key = keyGenerator(req) || UNKNOWN_KEY;
    const cutoff = now - windowMs;
    const bucket = buckets.get(key) ?? { hits: [] };

    // Janela deslizante: descarta as marcas de tempo já expiradas.
    const recent = bucket.hits.filter((hit) => hit > cutoff);

    res.setHeader("X-RateLimit-Limit", String(max));

    if (recent.length >= max) {
      // A requisição mais antiga que ainda conta define quando o cliente
      // volta a ser aceito.
      let oldest = now;
      for (const hit of recent) {
        if (hit < oldest) oldest = hit;
      }
      const resetAt = oldest + windowMs;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));

      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
      res.setHeader("Retry-After", String(retryAfterSeconds));

      logger.warn(
        { key, url: req.originalUrl, retryAfterSeconds },
        "Rate limit exceeded",
      );

      res.status(429).json({ error: message });
      return;
    }

    recent.push(now);
    bucket.hits = recent;
    buckets.set(key, bucket);

    res.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(0, max - recent.length)),
    );
    res.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil((now + windowMs) / 1000)),
    );

    next();
  };
}

/**
 * Limite das rotas de login/cadastro: 30 tentativas a cada 5 minutos por IP.
 *
 * Escolha: o limite existe para derrubar automação (força bruta, spam de
 * cadastro). Ele é contado **por IP**, e num escritório todos os usuários
 * compartilham o mesmo IP público (NAT) — por isso o valor é folgado: 30
 * requisições em 5 minutos deixa passar uma manhã inteira de logins da equipe
 * e ainda corta automação. Com a política de senha atual (10 caracteres, 3 de
 * 4 grupos) a força bruta já é inviável de qualquer forma.
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
});

/**
 * Limite da rota de "esqueci minha senha": 10 solicitações a cada 15 minutos
 * por IP.
 *
 * Escolha: mais restritivo que o login porque cada solicitação dispara um
 * e-mail (custo + risco de abuso do serviço de e-mail), mas ainda folgado
 * para o caso de várias pessoas do mesmo escritório pedirem a redefinição ao
 * mesmo tempo.
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message:
    "Muitas solicitações de redefinição. Aguarde antes de tentar novamente.",
});
