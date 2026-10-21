/**
 * Identifica o erro de chave duplicada do MongoDB (códigos 11000/11001), que é
 * o que o índice único de `employees.userId` dispara quando o vínculo entre um
 * usuário e um funcionário já existe (BIZ-07).
 */
export function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) {
    return false;
  }
  const code = (err as { code?: unknown }).code;
  return code === 11000 || code === 11001;
}
