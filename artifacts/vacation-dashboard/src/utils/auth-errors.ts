import { getCompanyEmailError } from "@/utils/email";

/**
 * Messages for the `?error=` codes sent back by the Google callback.
 */
const MESSAGES: Record<string, string> = {
  google_indisponivel: "O login com Google não está disponível no momento.",
  google_invalido: "Não foi possível validar o login com Google. Tente novamente.",
  google_falha: "Não foi possível concluir o login com Google. Tente novamente.",
  dominio_nao_permitido: "",
  access_denied: "Login com Google cancelado.",
};

export function getAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  if (code === "dominio_nao_permitido") return getCompanyEmailError();
  return MESSAGES[code] ?? "Ocorreu um erro no login. Tente novamente.";
}
