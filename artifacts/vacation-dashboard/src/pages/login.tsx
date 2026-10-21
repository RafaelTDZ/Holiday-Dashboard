import { useState } from "react";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, Eye, EyeOff, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getApiBase, getAppBase } from "@/utils/api";
import { getAllowedEmailDomain, getCompanyEmailError, isAllowedCompanyEmail } from "@/utils/email";

export default function Login() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const domain = getAllowedEmailDomain();
      const emailSchema = z
        .string()
        .email()
        .refine((val) => !domain || isAllowedCompanyEmail(val), {
          message: getCompanyEmailError(),
        });
      const result = emailSchema.safeParse(email);
      if (!result.success) {
        toast({ variant: "destructive", title: "Erro", description: result.error.errors[0].message });
        setLoading(false);
        return;
      }

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

      window.location.reload();
    } catch {
      toast({ variant: "destructive", title: "Erro de conexão", description: "Não foi possível conectar ao servidor." });
    } finally {
      setLoading(false);
    }
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
              Entre com suas credenciais para continuar.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 pb-8 px-8 space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={getAllowedEmailDomain() ? `voce@${getAllowedEmailDomain()}` : "voce@empresa.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  data-testid="input-email"
                />
                {getAllowedEmailDomain() && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Somente e-mails @{getAllowedEmailDomain()} são permitidos.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
