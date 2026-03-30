import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Briefcase } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Login() {
  const { login } = useAuth();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/30 p-4">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
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
              Gestão inteligente e profissional de períodos aquisitivos e descansos da equipe.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 pb-8 px-8">
            <Button 
              size="lg" 
              className="w-full text-base font-semibold shadow-md"
              onClick={login}
              data-testid="button-login"
            >
              Entrar com Replit
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-6">
              Acesso restrito a gestores e profissionais de Recursos Humanos.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
