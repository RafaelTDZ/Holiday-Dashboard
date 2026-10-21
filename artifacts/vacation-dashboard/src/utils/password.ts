/**
 * Política de senha do frontend — espelha a regra aplicada pela API
 * (`artifacts/api-server/src/lib/password-policy.ts`).
 *
 * O servidor é a fonte da verdade: esta cópia existe só para dar feedback
 * imediato no formulário, sem esperar a resposta 400 da API.
 */
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MIN_GROUPS = 3;

export const PASSWORD_MESSAGES = {
  tooShort: `A senha deve ter no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`,
  complexity:
    "A senha precisa combinar letras maiúsculas, minúsculas, números e símbolos (use ao menos 3 desses 4 tipos).",
  similarToEmail: "A senha não pode conter o seu e-mail nem partes dele.",
};

const HAS_LOWER = /\p{Ll}/u;
const HAS_UPPER = /\p{Lu}/u;
const HAS_DIGIT = /\p{Nd}/u;
const HAS_SYMBOL = /[^\p{L}\p{N}\s]/u;

const EMAIL_PART_MIN_LENGTH = 4;

function countCharacterGroups(password: string): number {
  let groups = 0;
  if (HAS_LOWER.test(password)) groups += 1;
  if (HAS_UPPER.test(password)) groups += 1;
  if (HAS_DIGIT.test(password)) groups += 1;
  if (HAS_SYMBOL.test(password)) groups += 1;
  return groups;
}

function emailFragments(email: string): string[] {
  const normalized = email.trim().toLowerCase();
  if (normalized.length === 0) return [];

  const fragments = new Set<string>();
  fragments.add(normalized);

  const at = normalized.lastIndexOf("@");
  const localPart = at > 0 ? normalized.slice(0, at) : normalized;
  const domain = at > 0 ? normalized.slice(at + 1) : "";
  const domainLabel = domain.split(".").shift() ?? "";

  for (const candidate of [localPart, domainLabel]) {
    if (candidate.length < EMAIL_PART_MIN_LENGTH) continue;
    fragments.add(candidate);
    for (const part of candidate.split(/[^a-z0-9]+/)) {
      if (part.length >= EMAIL_PART_MIN_LENGTH) fragments.add(part);
    }
  }

  return [...fragments];
}

/**
 * Valida a senha contra a política e devolve a mensagem do primeiro problema
 * encontrado (ou `null` quando a senha é válida).
 */
export function getPasswordError(
  password: string,
  email?: string | null,
): string | null {
  if (!password) return "A senha é obrigatória.";
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_MESSAGES.tooShort;
  if (countCharacterGroups(password) < PASSWORD_MIN_GROUPS) {
    return PASSWORD_MESSAGES.complexity;
  }
  if (email && email.trim().length > 0) {
    const lowered = password.toLowerCase();
    for (const fragment of emailFragments(email)) {
      if (lowered.includes(fragment)) return PASSWORD_MESSAGES.similarToEmail;
    }
  }
  return null;
}
