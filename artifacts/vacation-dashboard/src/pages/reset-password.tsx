import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Eye, EyeOff, Loader2, CheckCircle, AlertTriangle } from "lucide-react";

function getApiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api`;
}

export default function ResetPassword() {
  const loginUrl = (import.meta.env.BASE_URL ?? "").replace(/\/$/, "");
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiBase()}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ocorreu um erro. Tente novamente.");
      } else {
        setDone(true);
      }
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <Card className="relative z-10 w-full max-w-md border-border/50 shadow-xl">
          <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center gap-4 text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <p className="font-medium">Link inválido ou incompleto.</p>
            <Button variant="outline" onClick={() => window.location.href = loginUrl}>Voltar ao login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="relative z-10 w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <div className="flex justify-center mb-8">
          <div className="h-16 w-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 rotate-3">
            <Briefcase className="w-8 h-8 text-primary-foreground" />
          </div>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold tracking-tight">Nova senha</CardTitle>
            <CardDescription className="text-base mt-2">
              {done ? "Senha redefinida com sucesso." : "Escolha uma nova senha para sua conta."}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4 pb-8 px-8 space-y-5">
            {done ? (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-sm text-muted-foreground">
                  Sua senha foi redefinida. Você já pode fazer login com a nova senha.
                </p>
                <Button className="w-full mt-2" onClick={() => window.location.href = loginUrl}>
                  Ir para o login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pr-10"
                      data-testid="input-new-password"
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

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirmar nova senha</Label>
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repita a nova senha"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    disabled={loading}
                    data-testid="input-confirm-password"
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full text-base font-semibold shadow-md"
                  disabled={loading}
                  data-testid="button-submit-reset"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar nova senha
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
