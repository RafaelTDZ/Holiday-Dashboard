import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { 
  useGetEmployee, 
  useUpdateEmployee, 
  useDeleteEmployee,
  useCreateVacation,
  useDeleteVacation,
  useUpdateVacationStatus,
  getGetEmployeeQueryKey,
  getListEmployeesQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { format, parseISO, differenceInDays } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@workspace/replit-auth-web";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  ArrowLeft, 
  UserCircle, 
  Building, 
  Briefcase, 
  Calendar, 
  Plane,
  Trash2,
  Edit,
  Pencil,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Siren
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const DEPARTMENTS = ["Comercial", "Operacional", "Financeiro", "RH"] as const;

const updateEmployeeSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  role: z.string().min(2, "Cargo deve ter no mínimo 2 caracteres"),
  department: z.string().min(1, "Selecione um departamento"),
  hireDate: z.string().refine(val => !isNaN(Date.parse(val)), "Data inválida")
});

const createVacationSchema = z.object({
  startDate: z.string().refine(val => !isNaN(Date.parse(val)), "Data de início inválida"),
  endDate: z.string().refine(val => !isNaN(Date.parse(val)), "Data de término inválida"),
  notes: z.string().optional()
}).refine(data => new Date(data.endDate) >= new Date(data.startDate), {
  message: "A data de término deve ser após o início",
  path: ["endDate"]
});

function VacationStatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return <Badge className="bg-green-500 hover:bg-green-600 text-white text-xs">Aprovado</Badge>;
  }
  if (status === "rejected") {
    return <Badge variant="destructive" className="text-xs">Reprovado</Badge>;
  }
  return <Badge variant="outline" className="text-yellow-600 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-xs">Pendente</Badge>;
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const employeeId = Number(id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const isManager = user?.isManager ?? false;

  const { data: employee, isLoading, error } = useGetEmployee(employeeId, {
    query: { enabled: !!employeeId, queryKey: getGetEmployeeQueryKey(employeeId) }
  });

  const isOwnProfile = !!(employee && (employee as any).userId === user?.id);
  const isEligible = !!(employee && (employee as any).eligibleForVacation);
  const firstEligibilityDate: string | undefined = employee ? (employee as any).firstEligibilityDate : undefined;

  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const createVacation = useCreateVacation();
  const deleteVacation = useDeleteVacation();
  const updateVacationStatus = useUpdateVacationStatus();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isVacationOpen, setIsVacationOpen] = useState(false);
  const [isEditVacationOpen, setIsEditVacationOpen] = useState(false);
  const [editingVacationId, setEditingVacationId] = useState<number | null>(null);

  const editForm = useForm<z.infer<typeof updateEmployeeSchema>>({
    resolver: zodResolver(updateEmployeeSchema),
    defaultValues: {
      name: employee?.name || "",
      role: employee?.role || "",
      department: employee?.department || "",
      hireDate: employee ? employee.hireDate.split('T')[0] : "",
    },
  });

  const vacationForm = useForm<z.infer<typeof createVacationSchema>>({
    resolver: zodResolver(createVacationSchema),
    defaultValues: {
      startDate: "",
      endDate: "",
      notes: ""
    },
  });

  if (employee && editForm.getValues("name") === "" && !isEditOpen) {
    editForm.reset({
      name: employee.name,
      role: employee.role,
      department: employee.department,
      hireDate: employee.hireDate.split('T')[0],
    });
  }

  const onEditSubmit = (values: z.infer<typeof updateEmployeeSchema>) => {
    updateEmployee.mutate({ id: employeeId, data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(employeeId) });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        toast({ title: "Funcionário atualizado com sucesso" });
        setIsEditOpen(false);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Erro ao atualizar", description: err.data?.error ?? err.message });
      }
    });
  };

  const onVacationSubmit = (values: z.infer<typeof createVacationSchema>) => {
    createVacation.mutate({ 
      id: employeeId, 
      data: { ...values, notes: values.notes || null } 
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(employeeId) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Férias solicitadas", description: "Aguardando aprovação do coordenador." });
        setIsVacationOpen(false);
        vacationForm.reset();
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Erro ao solicitar férias", description: err.data?.error ?? err.message });
      }
    });
  };

  const editVacationForm = useForm<z.infer<typeof createVacationSchema>>({
    resolver: zodResolver(createVacationSchema),
    defaultValues: { startDate: "", endDate: "", notes: "" },
  });

  const updateVacationMutation = useMutation({
    mutationFn: async (values: { id: number; startDate: string; endDate: string; notes?: string }) => {
      const res = await fetch(`/api/vacations/${values.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate: values.startDate, endDate: values.endDate, notes: values.notes ?? null }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao atualizar férias");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(employeeId) });
      queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      toast({ title: "Férias atualizadas", description: "O período foi alterado com sucesso." });
      setIsEditVacationOpen(false);
      setEditingVacationId(null);
      editVacationForm.reset();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro ao atualizar férias", description: err.message });
    },
  });

  const onEditVacationSubmit = (values: z.infer<typeof createVacationSchema>) => {
    if (!editingVacationId) return;
    updateVacationMutation.mutate({ id: editingVacationId, ...values });
  };

  const handleDeleteEmployee = () => {
    deleteEmployee.mutate({ id: employeeId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Funcionário excluído com sucesso" });
        setLocation("/employees");
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Erro ao excluir", description: err.data?.error ?? err.message });
      }
    });
  };

  const handleDeleteVacation = (vacationId: number) => {
    deleteVacation.mutate({ id: vacationId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(employeeId) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({ title: "Período de férias cancelado" });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Erro ao cancelar", description: err.data?.error ?? err.message });
      }
    });
  };

  const handleVacationStatus = (vacationId: number, status: "approved" | "rejected") => {
    updateVacationStatus.mutate({ id: vacationId, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetEmployeeQueryKey(employeeId) });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        toast({ 
          title: status === "approved" ? "Férias aprovadas" : "Férias reprovadas",
          description: status === "approved" 
            ? "O período de férias foi aprovado com sucesso." 
            : "O período de férias foi reprovado."
        });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Erro", description: err.data?.error ?? err.message });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="grid gap-6 md:grid-cols-3">
          <Skeleton className="h-[300px] md:col-span-1 rounded-xl" />
          <Skeleton className="h-[500px] md:col-span-2 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-destructive">Erro ao carregar funcionário</h2>
        <Button variant="link" asChild className="mt-4"><Link href="/employees">Voltar para lista</Link></Button>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="rounded-full">
          <Link href="/employees">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{employee.name}</h1>
          <p className="text-muted-foreground text-sm">Perfil e histórico de férias</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 items-start">
        {/* Profile Card */}
        <Card className="md:col-span-1 border-border/50 shadow-sm sticky top-24">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary text-3xl font-bold">
              {employee.name.charAt(0)}
            </div>
            <CardTitle>{employee.name}</CardTitle>
            <CardDescription>{employee.role}</CardDescription>
            <div className="mt-2 flex justify-center">
              {employee.isOnVacation ? (
                <Badge className="bg-teal-500 text-white">Em Férias</Badge>
              ) : employee.vacationBalanceDays >= 30 && !employee.nextVacationStart ? (
                <Badge variant="destructive">Férias Vencidas</Badge>
              ) : (
                <Badge variant="secondary" className="bg-primary/10 text-primary">Ativo</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4 pb-6 space-y-4">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building className="h-4 w-4" /> Departamento
                </div>
                <span className="font-medium text-right">{employee.department}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" /> Admissão
                </div>
                <span className="font-medium">{format(parseISO(employee.hireDate), "dd/MM/yyyy")}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/40">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" /> Dias de Saldo
                </div>
                <span className="font-bold text-lg">{employee.vacationBalanceDays.toFixed(1)}</span>
              </div>
            </div>

            {isManager && (
              <div className="pt-4 grid grid-cols-2 gap-2">
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full" data-testid="button-edit-employee">
                      <Edit className="w-4 h-4 mr-2" /> Editar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar Funcionário</DialogTitle>
                      <DialogDescription>Altere as informações de {employee.name}.</DialogDescription>
                    </DialogHeader>
                    <Form {...editForm}>
                      <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 pt-4">
                        <FormField
                          control={editForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Cargo</FormLabel>
                              <FormControl><Input {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editForm.control}
                          name="department"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Departamento</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecionar..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {DEPARTMENTS.map((dept) => (
                                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={editForm.control}
                          name="hireDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data de Admissão</FormLabel>
                              <FormControl><Input type="date" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <DialogFooter>
                          <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                          <Button type="submit" disabled={updateEmployee.isPending}>Salvar</Button>
                        </DialogFooter>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" data-testid="button-delete-employee">
                      <Trash2 className="w-4 h-4 mr-2" /> Excluir
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir funcionário?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Todos os registros de férias de {employee.name} serão removidos permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteEmployee} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Sim, excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vacations Content */}
        <div className="md:col-span-2 space-y-6">
          {employee.vacationBalanceDays >= 60 && (
            <Alert className="border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400">
              <Siren className="h-4 w-4 text-red-500" />
              <AlertTitle className="font-bold">Férias Urgentes</AlertTitle>
              <AlertDescription>
                {employee.name} acumulou <strong>{employee.vacationBalanceDays.toFixed(0)} dias</strong> de saldo. Agendamento imediato de férias é obrigatório.
              </AlertDescription>
            </Alert>
          )}
          {employee.vacationBalanceDays > 30 && employee.vacationBalanceDays < 60 && (
            <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle className="font-semibold">Saldo de Férias Elevado</AlertTitle>
              <AlertDescription>
                {employee.name} possui <strong>{employee.vacationBalanceDays.toFixed(0)} dias</strong> de saldo acumulado. Recomenda-se agendar férias em breve.
              </AlertDescription>
            </Alert>
          )}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Histórico de Férias</CardTitle>
                <CardDescription>Períodos registrados e seus status de aprovação</CardDescription>
              </div>
              <Dialog open={isVacationOpen} onOpenChange={setIsVacationOpen}>
                {isOwnProfile && employee.vacationBalanceDays >= 30 && (
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-vacation">
                      <Plane className="w-4 h-4 mr-2" />
                      Solicitar Férias
                    </Button>
                  </DialogTrigger>
                )}
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Solicitar Férias</DialogTitle>
                    <DialogDescription>
                      Defina o período de descanso para {employee.name}. Saldo disponível: <strong className="text-foreground">{employee.vacationBalanceDays.toFixed(1)} dias</strong>
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...vacationForm}>
                    <form onSubmit={vacationForm.handleSubmit(onVacationSubmit)} className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={vacationForm.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data de Início</FormLabel>
                              <FormControl><Input type="date" {...field} data-testid="input-vacation-start" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={vacationForm.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data de Término</FormLabel>
                              <FormControl><Input type="date" {...field} data-testid="input-vacation-end" /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      {vacationForm.watch('startDate') && vacationForm.watch('endDate') && 
                       !isNaN(Date.parse(vacationForm.watch('startDate'))) && !isNaN(Date.parse(vacationForm.watch('endDate'))) && 
                       new Date(vacationForm.watch('endDate')) >= new Date(vacationForm.watch('startDate')) && (
                        <div className="p-3 bg-muted/50 rounded-lg text-sm flex justify-between items-center border">
                          <span className="text-muted-foreground">Duração calculada:</span>
                          <span className="font-semibold text-primary">
                            {differenceInDays(new Date(vacationForm.watch('endDate')), new Date(vacationForm.watch('startDate'))) + 1} dias
                          </span>
                        </div>
                      )}

                      <FormField
                        control={vacationForm.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Observações (Opcional)</FormLabel>
                            <FormControl><Textarea placeholder="Motivo, acordos, etc." className="resize-none h-20" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter className="pt-2">
                        <Button type="button" variant="outline" onClick={() => setIsVacationOpen(false)}>Cancelar</Button>
                        <Button type="submit" disabled={createVacation.isPending} data-testid="button-submit-vacation">
                          Solicitar
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {employee.vacations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl">
                  <Plane className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium">Nenhum registro</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mt-1">
                    Este funcionário ainda não possui períodos de férias solicitados.
                  </p>
                  {isOwnProfile && employee.vacationBalanceDays >= 30 && (
                    <Button variant="outline" className="mt-6" onClick={() => setIsVacationOpen(true)}>
                      Solicitar primeiro período
                    </Button>
                  )}
                  {isOwnProfile && employee.vacationBalanceDays < 30 && firstEligibilityDate && (
                    <p className="text-sm text-amber-600 font-medium mt-4">
                      Férias disponíveis a partir de {format(parseISO(firstEligibilityDate), "dd/MM/yyyy")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                  {employee.vacations.map((vacation) => {
                    const isUpcoming = new Date(vacation.startDate) > new Date();
                    const isCurrent = new Date(vacation.startDate) <= new Date() && new Date(vacation.endDate) >= new Date();
                    const isPending = vacation.status === "pending";
                    const isApproved = vacation.status === "approved";
                    
                    return (
                      <div key={vacation.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-card shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          {isApproved && isCurrent ? (
                            <Plane className="h-4 w-4 text-teal-500" />
                          ) : isApproved && isUpcoming ? (
                            <Calendar className="h-4 w-4 text-blue-500" />
                          ) : isPending ? (
                            <Clock className="h-4 w-4 text-yellow-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border bg-card shadow-sm hover:shadow transition-shadow ml-4 md:ml-0">
                          <div className="flex items-start justify-between mb-2 gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={isApproved && isCurrent ? "default" : isApproved && isUpcoming ? "secondary" : "outline"} 
                                    className={isApproved && isCurrent ? "bg-teal-500 hover:bg-teal-600 text-xs" : isApproved && isUpcoming ? "bg-blue-100 text-blue-700 text-xs" : "text-xs"}>
                                {isApproved && isCurrent ? "Em Andamento" : isApproved && isUpcoming ? "Agendado" : isApproved ? "Concluído" : ""}
                              </Badge>
                              <VacationStatusBadge status={vacation.status} />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {isOwnProfile && isPending && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                                  title="Editar férias"
                                  data-testid={`button-edit-vacation-${vacation.id}`}
                                  onClick={() => {
                                    setEditingVacationId(vacation.id);
                                    editVacationForm.reset({
                                      startDate: vacation.startDate,
                                      endDate: vacation.endDate,
                                      notes: vacation.notes ?? "",
                                    });
                                    setIsEditVacationOpen(true);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isManager && isPending && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    title="Aprovar férias"
                                    data-testid={`button-approve-vacation-${vacation.id}`}
                                    onClick={() => handleVacationStatus(vacation.id, "approved")}
                                    disabled={updateVacationStatus.isPending}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                                    title="Reprovar férias"
                                    data-testid={`button-reject-vacation-${vacation.id}`}
                                    onClick={() => handleVacationStatus(vacation.id, "rejected")}
                                    disabled={updateVacationStatus.isPending}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {isManager && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Cancelar férias?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Deseja remover este período de férias de {vacation.durationDays} dias? O saldo do funcionário será recalculado.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteVacation(vacation.id)} className="bg-destructive text-destructive-foreground">
                                        Sim, cancelar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                          <div className="text-lg font-bold">
                            {vacation.durationDays} dias
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 flex justify-between">
                            <span>{format(parseISO(vacation.startDate), "dd/MM/yyyy")}</span>
                            <span>até</span>
                            <span>{format(parseISO(vacation.endDate), "dd/MM/yyyy")}</span>
                          </div>
                          {vacation.notes && (
                            <p className="text-xs text-muted-foreground mt-2 italic border-t pt-2">"{vacation.notes}"</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>

    <Dialog open={isEditVacationOpen} onOpenChange={(open) => { setIsEditVacationOpen(open); if (!open) { setEditingVacationId(null); editVacationForm.reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar Férias</DialogTitle>
          <DialogDescription>Edite as datas do período pendente. Após aprovação não é mais possível alterar.</DialogDescription>
        </DialogHeader>
        <Form {...editVacationForm}>
          <form onSubmit={editVacationForm.handleSubmit(onEditVacationSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={editVacationForm.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Início</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editVacationForm.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Término</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={editVacationForm.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações (Opcional)</FormLabel>
                  <FormControl><Textarea placeholder="Motivo, acordos, etc." className="resize-none h-20" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditVacationOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={updateVacationMutation.isPending} data-testid="button-save-vacation-edit">
                Salvar alterações
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
    </>
  );
}
