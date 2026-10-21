export function getAllowedEmailDomain(): string | null {
  const raw = import.meta.env.ALLOWED_EMAIL_DOMAIN?.trim?.().toLowerCase?.();
  if (!raw || raw === "*") return null;
  return raw.replace(/^@/, "");
}

export function getCompanyEmailError(): string {
  const domain = getAllowedEmailDomain();
  return domain
    ? `Apenas e-mails @${domain} são permitidos.`
    : "E-mail inválido.";
}

export function isAllowedCompanyEmail(email: string): boolean {
  const domain = getAllowedEmailDomain();
  if (!domain) return true;
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at <= 0) return false;
  return normalized.slice(at + 1) === domain;
}
