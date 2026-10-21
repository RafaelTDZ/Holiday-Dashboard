import { useEffect, useState } from "react";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuthProviders } from "@/hooks/use-auth-providers";
import { getApiBase, getAppBase } from "@/utils/api";
import { getAllowedEmailDomain, getCompanyEmailError, isAllowedCompanyEmail } from "@/utils/email";
import { getAuthErrorMessage } from "@/utils/auth-errors";

type Step = "email" | "password";

const emailSchema = z
  .string()
  .email("E-mail inválido.")
  .refine(
    (val) => {
      const domain = getAllowedEmailDomain();
      return !domain || isAllowedCompanyEmail(val);
    },
    { message: getCompanyEmailError() },
  );

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3c-1.07.72-2.44 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.63l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

export default function Login() {
  const { toast } = useToast();
  const { google } = useAuthProviders();

  const [step, setStep] = useState<Step>("email");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (!code) return;

    const message = getAuthErrorMessage(code);
    if (message) {
      toast({ variant: "destructive", title: "Erro", description: message });
    }
    window.history.replaceState({}, "", window.location.pathname);
  }, [toast]);

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = emailSchema.safeParse(email);
    if (!result.success) {
      toast({ variant: "destructive", title: "Erro", description: result.error.errors[0].message });
      return;
    }

    setEmail(result.data.trim().toLowerCase());
    setPassword("");
    setStep("password");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${getApiBase()}/auth/login-local`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        toast({ variant: "destructive", title: "Erro", description: data.error ?? "Ocorreu um erro." });
        return;
      }

      window.location.href = getAppBase() || "/";
    } catch {
      toast({ variant: "destructive", title: "Erro de conexão", description: "Não foi possível conectar ao servidor." });
    } finally {
      setLoading(false);
    }
  };

  const backToEmail = () => {
    setPassword("");
    setStep("email");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="flex justify-center mb-8">
          <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 rotate-3 transition-transform hover:rotate-0">
            <Briefcase className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold tracking-tight">Dashboard de Férias</CardTitle>
            <CardDescription className="text-base mt-2">
              {step === "email"
                ? "Informe seu e-mail corporativo para continuar."
                : "Digite sua senha para acessar o painel."}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 pb-8 px-8 space-y-5">
            {step === "email" ? (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {google && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="w-full text-base font-semibold"
                      onClick={() => {
                        window.location.href = `${getApiBase()}/auth/google`;
                      }}
                      data-testid="button-google"
                    >
                      <GoogleIcon className="h-5 w-5" />
                      Entrar com Google
                    </Button>

                    <div className="flex items-center gap-3 py-1">
                      <span className="h-px flex-1 bg-border" />
                      <span className="text-xs uppercase text-muted-foreground">ou</span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    autoFocus
                    placeholder={getAllowedEmailDomain() ? `voce@${getAllowedEmailDomain()}` : "voce@empresa.com"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    data-testid="input-email"
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base font-semibold shadow-md"
                  disabled={loading}
                  data-testid="button-continue"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Continuar
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email-display">E-mail</Label>
                  <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-muted/40 px-3 py-2">
                    <span className="text-sm truncate" data-testid="email-display">
                      {email}
                    </span>
                    <button
                      type="button"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      onClick={backToEmail}
                      data-testid="button-edit-email"
                    >
                      Editar
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoFocus
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowPassword((s) => !s)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base font-semibold shadow-md"
                  disabled={loading}
                  data-testid="button-submit-local"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Entrar
                </Button>

                <div className="text-center">
                  <a
                    href={`${getAppBase()}/forgot-password`}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="link-forgot-password"
                  >
                    Esqueci minha senha
                  </a>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
