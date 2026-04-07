import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string,
): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@sistema.com";
  const transporter = createTransport();

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="margin-bottom:8px">Redefinição de senha</h2>
      <p style="color:#555">Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Dashboard de Férias</strong>.</p>
      <p style="color:#555">Clique no botão abaixo para criar uma nova senha. O link expira em <strong>1 hora</strong>.</p>
      <a href="${resetUrl}"
        style="display:inline-block;margin:24px 0;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
        Redefinir senha
      </a>
      <p style="color:#999;font-size:12px">Se você não solicitou a redefinição, ignore este e-mail. Sua senha não será alterada.</p>
      <p style="color:#bbb;font-size:11px;margin-top:16px">Link direto: ${resetUrl}</p>
    </div>
  `;

  if (transporter) {
    await transporter.sendMail({ from, to, subject: "Redefinição de senha – Dashboard de Férias", html });
  } else {
    console.log("\n========= RESET DE SENHA (sem SMTP configurado) =========");
    console.log(`Para: ${to}`);
    console.log(`Link: ${resetUrl}`);
    console.log("==========================================================\n");
  }
}
