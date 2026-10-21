/**
 * Política de senha compartilhada pelas rotas de cadastro, redefinição e
 * troca de senha.
 *
 * A função `validatePassword` é **pura**: não toca em banco, logger ou
 * resposta HTTP. Isso a torna facilmente testável e permite usá-la tanto no
 * backend quanto (no futuro) no formulário do frontend.
 *
 * Regras aplicadas:
 * - mínimo de `PASSWORD_MIN_LENGTH` (10) caracteres;
 * - ao menos 3 dos 4 grupos de caracteres: minúscula, maiúscula, dígito e
 *   símbolo;
 * - a senha não pode conter o e-mail do usuário nem partes dele.
 *
 * A senha **nunca** é devolvida nem registrada em log: a função apenas
 * informa se a senha é aceitável e, quando não é, o motivo da recusa.
 */

export interface PasswordPolicyResult {
  valid: boolean;
  /** Motivo da recusa (em português). Ausente quando a senha é válida. */
  message?: string;
}

/** Comprimento mínimo da senha. */
export const PASSWORD_MIN_LENGTH = 10;

/** Quantidade mínima de grupos de caracteres exigidos (de 4 possíveis). */
export const PASSWORD_MIN_GROUPS = 3;

/**
 * Comprimento mínimo de um fragmento do e-mail para ser considerado "parte do
 * e-mail". Abaixo disso a comparação geraria falsos positivos (por exemplo o
 * fragmento "com" de "empresa.com.br").
 */
const EMAIL_PART_MIN_LENGTH = 4;

const MESSAGES = {
  missing: "A senha é obrigatória.",
  tooShort: `A senha deve ter no menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  complexity:
    "A senha precisa combinar letras maiúsculas, minúsculas, números e símbolos (use ao menos 3 desses 4 tipos).",
  similarToEmail: "A senha não pode conter o seu e-mail nem partes dele.",
} as const;

/** Letra minúscula (inclui acentos, ex.: `ç`, `é`). */
const HAS_LOWER = /\p{Ll}/u;
/** Letra maiúscula (inclui acentos, ex.: `Ç`, `É`). */
const HAS_UPPER = /\p{Lu}/u;
/** Dígito decimal (0-9 e outros dígitos Unicode). */
const HAS_DIGIT = /\p{Nd}/u;
/**
 * Símbolo: qualquer caractere que não seja letra, número ou espaço em
 * branco. Espaços em branco **não** contam como símbolo (uma senha feita de
 * espaços não seria aceita de qualquer forma, pois não teria 3 grupos).
 */
const HAS_SYMBOL = /[^\p{L}\p{N}\s]/u;

function countCharacterGroups(password: string): number {
  let groups = 0;
  if (HAS_LOWER.test(password)) groups += 1;
  if (HAS_UPPER.test(password)) groups += 1;
  if (HAS_DIGIT.test(password)) groups += 1;
  if (HAS_SYMBOL.test(password)) groups += 1;
  return groups;
}

/**
 * Extrai os fragmentos de um e-mail que não podem aparecer na senha:
 * o e-mail completo, a parte local (`maria.silva`) e o primeiro rótulo do
 * domínio (`tdztrading`). Fragmentos com menos de 4 caracteres são ignorados
 * para evitar falsos positivos.
 */
function emailFragments(email: string): string[] {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) return [];

  const fragments = new Set<string>();
  fragments.add(normalized);

  const at = normalized.lastIndexOf("@");
  const localPart = at > 0 ? normalized.slice(0, at) : normalized;
  const domain = at > 0 ? normalized.slice(at + 1) : "";
  const domainLabel = domain.split(".").shift() ?? "";

  const candidates = [localPart, domainLabel];
  for (const candidate of candidates) {
    if (candidate.length < EMAIL_PART_MIN_LENGTH) continue;
    fragments.add(candidate);
    for (const part of candidate.split(/[^a-z0-9]+/)) {
      if (part.length >= EMAIL_PART_MIN_LENGTH) fragments.add(part);
    }
  }

  return [...fragments];
}

/**
 * Valida uma senha contra a política de segurança.
 *
 * @param password Senha informada pelo usuário.
 * @param email   E-mail do usuário (opcional). Quando informado, a senha não
 *                pode conter o e-mail nem partes dele.
 * @returns `{ valid: true }` ou `{ valid: false, message: "..." }` com o
 *          motivo da recusa em português.
 */
export function validatePassword(
  password: unknown,
  email?: string | null,
): PasswordPolicyResult {
  if (typeof password !== "string" || password.length === 0) {
    return { valid: false, message: MESSAGES.missing };
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, message: MESSAGES.tooShort };
  }

  if (countCharacterGroups(password) < PASSWORD_MIN_GROUPS) {
    return { valid: false, message: MESSAGES.complexity };
  }

  if (typeof email === "string" && email.trim().length > 0) {
    const lowered = password.toLowerCase();
    for (const fragment of emailFragments(email)) {
      if (lowered.includes(fragment)) {
        return { valid: false, message: MESSAGES.similarToEmail };
      }
    }
  }

  return { valid: true };
}
