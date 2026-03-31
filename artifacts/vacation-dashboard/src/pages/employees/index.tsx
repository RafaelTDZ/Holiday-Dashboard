import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { 
  useListEmployees, 
  useCreateEmployee,
  getListEmployeesQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Search, Plus, UserCircle, Calendar, Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEPARTMENTS = ["Comercial", "Operacional", "Financeiro", "RH"] as const;
type Department = typeof DEPARTMENTS[number];

const createEmployeeSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  role: z.string().min(2, "Cargo deve ter no mínimo 2 caracteres"),
  department: z.enum(DEPARTMENTS),
  hireDate: z.string().refine(val => !isNaN(Date.parse(val)), "Data inválida")
});

export default function EmployeesList() {
  const { user } = useAuth();
  const isManager = user?.isManager ?? false;
  const { data, isLoading } = useListEmployees();
  const createEmployee = useCreateEmployee();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const form = useForm<z.infer<typeof createEmployeeSchema>>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      name: "",
      role: "",
      department: "",
      hireDate: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = (values: z.infer<typeof createEmployeeSchema>) => {
    createEmployee.mutate({ data: values }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        toast({
          title: "Funcionário adicionado",
          description: "O funcionário foi cadastrado com sucesso.",
        });
        setIsCreateOpen(false);
        form.reset();
      },
      onError: (err) => {
        toast({
          variant: "destructive",
          title: "Erro ao adicionar",
          description: err.data?.error ?? err.message ?? "Ocorreu um erro inesperado.",
        });
      }
    });
  };

  const filteredEmployees = data?.employees.filter(emp => 
    emp.name.toLowerCase().includes(search.toLowerCase()) ||
    emp.department.toLowerCase().includes(search.toLowerCase()) ||
    emp.role.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Funcionários</h1>
          <p className="text-muted-foreground mt-1">Gerencie a equipe e seus saldos de férias.</p>
        </div>
        
        {isManager && (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-employee" className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Funcionário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Novo Funcionário</DialogTitle>
              <DialogDescription>
                Insira os dados do novo membro da equipe.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <UserCircle className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Ex: João da Silva" className="pl-9" {...field} data-testid="input-name" />
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
                          <Input placeholder="Ex: Desenvolvedor Senior" className="pl-9" {...field} data-testid="input-role" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="input-department">
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
                    control={form.control}
                    name="hireDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Admissão</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="date" className="pl-9" {...field} data-testid="input-hireDate" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createEmployee.isPending} data-testid="button-submit-employee">
                    {createEmployee.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b bg-muted/20">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, cargo ou departamento..."
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-employees"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cargo & Departamento</TableHead>
                <TableHead>Admissão</TableHead>
                <TableHead className="text-right">Dias de Saldo</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 ml-auto rounded-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    Nenhum funcionário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((emp, idx) => (
                  <TableRow 
                    key={emp.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors animate-in fade-in slide-in-from-bottom-2"
                    style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
                    onClick={() => setLocation(`/employees/${emp.id}`)}
                    data-testid={`row-employee-${emp.id}`}
                  >
                    <TableCell className="font-medium text-foreground">
                      {emp.name}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{emp.role}</span>
                        <span className="text-xs text-muted-foreground">{emp.department}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(parseISO(emp.hireDate), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="font-semibold text-lg flex items-center justify-end gap-2">
                        {!emp.isOnVacation && (emp.vacationBalanceDays >= 60 || (emp.daysUntilNextVacation <= 30 && emp.vacationBalanceDays >= 30)) && (
                          <span className="relative flex h-2.5 w-2.5" title="Urgente">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600" />
                          </span>
                        )}
                        {!emp.isOnVacation && emp.vacationBalanceDays > 30 && !(emp.vacationBalanceDays >= 60 || (emp.daysUntilNextVacation <= 30 && emp.vacationBalanceDays >= 30)) && (
                          <div className="w-2 h-2 rounded-full bg-amber-500" title="Atenção" />
                        )}
                        {emp.vacationBalanceDays.toFixed(1)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {emp.isOnVacation ? (
                        <Badge className="bg-teal-500 hover:bg-teal-600 text-white">Em Férias</Badge>
                      ) : (emp.vacationBalanceDays >= 60 || (emp.daysUntilNextVacation <= 30 && emp.vacationBalanceDays >= 30)) ? (
                        <Badge variant="destructive" className="animate-pulse">Urgente</Badge>
                      ) : emp.vacationBalanceDays > 30 ? (
                        <Badge className="bg-amber-100 text-amber-700 border border-amber-400 hover:bg-amber-100">Atenção</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Regular</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
