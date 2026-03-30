import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, UserCircle, Briefcase, Building, Calendar, ClipboardList } from "lucide-react";
import {
  useGetMyEmployee,
  useRegisterAsEmployee,
  getGetMyEmployeeQueryKey,
  getListEmployeesQueryKey,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  role: z.string().min(2, "Cargo deve ter no mínimo 2 caracteres"),
  department: z.string().min(2, "Departamento deve ter no mínimo 2 caracteres"),
  hireDate: z
    .string()
    .refine((v) => !isNaN(Date.parse(v)), "Data inválida"),
});

type Props = {
  children: React.ReactNode;
};

export function RegistrationGate({ children }: Props) {
  const { user } = useAuth();
  const { data, isLoading } = useGetMyEmployee();
  const register = useRegisterAsEmployee();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user
        ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
        : "",
      role: "",
      department: "",
      hireDate: new Date().toISOString().split("T")[0],
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (data?.employee !== null && data?.employee !== undefined) {
    return <>{children}</>;
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const onSubmit = (values: z.infer<typeof schema>) => {
    register.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMyEmployeeQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setSubmitted(true);
          toast({
            title: "Cadastro concluído",
            description: "Seu perfil de funcionário foi criado com sucesso.",
          });
        },
        onError: (err) => {
          toast({
            variant: "destructive",
            title: "Erro no cadastro",
            description:
              (err as { data?: { error?: string } }).data?.error ??
              err.message ??
              "Ocorreu um erro inesperado.",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-primary/10 border-b p-6 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/20 mb-3">
              <ClipboardList className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              Bem-vindo(a)!
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Você ainda não está cadastrado como funcionário. <br />
              Preencha seus dados para continuar.
            </p>
          </div>

          <div className="p-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <UserCircle className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Seu nome completo"
                            className="pl-9"
                            data-testid="reg-input-name"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cargo</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Ex: Desenvolvedor(a), Analista..."
                            className="pl-9"
                            data-testid="reg-input-role"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Ex: TI"
                              className="pl-9"
                              data-testid="reg-input-department"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hireDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Admissão</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="date"
                              className="pl-9"
                              data-testid="reg-input-hireDate"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full mt-2"
                  disabled={register.isPending}
                  data-testid="reg-button-submit"
                >
                  {register.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    "Confirmar Cadastro"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
