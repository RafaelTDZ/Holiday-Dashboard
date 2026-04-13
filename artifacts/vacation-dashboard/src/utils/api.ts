/**
 * Retorna a URL base da API com base no BASE_URL do Vite.
 * Centralizado para evitar duplicacao em multiplos arquivos.
 */
export function getApiBase(): string {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api`;
}

/**
 * Retorna a URL base do app (sem /api).
 */
export function getAppBase(): string {
  return (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
}
