import { describe, it, expect, vi, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createRateLimiter, getRateLimitKey } from "../src/middlewares/rate-limit";

// O logger real sobe um worker do pino (pino-pretty) e escreve no stdout.
// Mockamos para manter a saída dos testes limpa e determinística.
vi.mock("../src/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
  },
}));

function createFakeRes() {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

function createFakeReq(ip?: string, remoteAddress?: string) {
  return {
    ip,
    socket: remoteAddress === undefined ? undefined : { remoteAddress },
    originalUrl: "/auth/login",
  };
}

type FakeRes = ReturnType<typeof createFakeRes>;

function asRequest(req: ReturnType<typeof createFakeReq>): Request {
  return req as unknown as Request;
}

function asResponse(res: FakeRes): Response {
  return res as unknown as Response;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getRateLimitKey", () => {
  it("devolve uma string estável para a mesma requisição", () => {
    const req = asRequest(createFakeReq("203.0.113.10"));

    const first = getRateLimitKey(req);
    const second = getRateLimitKey(req);

    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
    expect(second).toBe(first);
  });

  it("usa o IP do cliente quando disponível", () => {
    const req = asRequest(createFakeReq("203.0.113.10", "10.0.0.1"));

    expect(getRateLimitKey(req)).toBe("203.0.113.10");
  });

  it("cai para o endereço do socket quando não há IP", () => {
    const req = asRequest(createFakeReq(undefined, "10.0.0.1"));

    expect(getRateLimitKey(req)).toBe("10.0.0.1");
  });

  it("devolve uma chave genérica quando não é possível identificar o cliente", () => {
    const req = asRequest(createFakeReq(undefined, undefined));

    expect(getRateLimitKey(req)).toBe("unknown");
  });

  it("gera chaves diferentes para clientes diferentes", () => {
    const a = getRateLimitKey(asRequest(createFakeReq("203.0.113.10")));
    const b = getRateLimitKey(asRequest(createFakeReq("203.0.113.11")));

    expect(a).not.toBe(b);
  });
});

describe("createRateLimiter", () => {
  it("libera as requisições até o limite e responde 429 na seguinte", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    const next = vi.fn() as unknown as NextFunction;

    // 3 requisições dentro do limite: todas passam.
    for (let i = 0; i < 3; i++) {
      const res = createFakeRes();
      limiter(asRequest(createFakeReq("198.51.100.7")), asResponse(res), next);
    }
    expect(next).toHaveBeenCalledTimes(3);

    // 4ª requisição (N+1): estourou o limite.
    const res = createFakeRes();
    limiter(asRequest(createFakeReq("198.51.100.7")), asResponse(res), next);

    expect(next).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) }),
    );
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Limit", "3");
    expect(res.setHeader).toHaveBeenCalledWith("X-RateLimit-Remaining", "0");
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });

  it("conta cada cliente separadamente", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const next = vi.fn() as unknown as NextFunction;

    const resA = createFakeRes();
    limiter(asRequest(createFakeReq("198.51.100.1")), asResponse(resA), next);
    const resB = createFakeRes();
    limiter(asRequest(createFakeReq("198.51.100.2")), asResponse(resB), next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(resA.status).not.toHaveBeenCalledWith(429);
    expect(resB.status).not.toHaveBeenCalledWith(429);
  });

  it("libera o cliente de novo depois que a janela deslizante expira", () => {
    vi.useFakeTimers();

    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    const next = vi.fn() as unknown as NextFunction;

    const first = createFakeRes();
    limiter(asRequest(createFakeReq("198.51.100.9")), asResponse(first), next);
    expect(next).toHaveBeenCalledTimes(1);

    const blocked = createFakeRes();
    limiter(asRequest(createFakeReq("198.51.100.9")), asResponse(blocked), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(blocked.status).toHaveBeenCalledWith(429);

    // Passa a janela: a marca de tempo antiga expira.
    vi.advanceTimersByTime(1_500);

    const afterWindow = createFakeRes();
    limiter(asRequest(createFakeReq("198.51.100.9")), asResponse(afterWindow), next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(afterWindow.status).not.toHaveBeenCalledWith(429);
  });

  it("usa a chave padrão (getRateLimitKey) quando não há keyGenerator", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    const next = vi.fn() as unknown as NextFunction;

    const res = createFakeRes();
    limiter(asRequest(createFakeReq("198.51.100.20")), asResponse(res), next);
    const blocked = createFakeRes();
    limiter(asRequest(createFakeReq("198.51.100.20")), asResponse(blocked), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(blocked.status).toHaveBeenCalledWith(429);
  });
});
