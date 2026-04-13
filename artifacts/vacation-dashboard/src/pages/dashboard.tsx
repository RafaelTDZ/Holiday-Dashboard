import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Sun, AlertTriangle, CalendarDays, ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniCalendarCard } from "@/components/mini-calendar-card";

export default function Dashboard() {
  const { data: summary, isLoading, error } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-[260px] rounded-xl" />
            <Skeleton className="h-[220px] rounded-xl" />
          </div>
          <Skeleton className="h-[500px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h2 className="text-xl font-semibold">Erro ao carregar os dados</h2>
        <p className="text-muted-foreground">Não foi possível obter o resumo do dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground mt-1">Bem-vindo ao centro de controle de férias.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Funcionários</CardTitle>
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-total-employees">{summary.totalEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">Registrados no sistema</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Férias Hoje</CardTitle>
            <div className="h-8 w-8 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
              <Sun className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-on-vacation">{summary.onVacationToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Aproveitando o descanso</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próximas Férias</CardTitle>
            <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <CalendarDays className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="stat-upcoming">{summary.upcomingVacations.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Agendadas para o futuro</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:shadow transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Férias Vencidas</CardTitle>
            <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400" data-testid="stat-overdue">
              {summary.overdueVacations}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Exigem atenção imediata</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        <div className="flex flex-col gap-6">
          <Card className="shadow-sm border-border/50 flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Próximas Férias</CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              {summary.upcomingVacations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                  <CalendarDays className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma férias agendada.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {summary.upcomingVacations.slice(0, 5).map((vacation, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                          {vacation.employeeName.charAt(0)}
                        </div>
                        <div>
                          <Link href={`/employees/${vacation.employeeId}`} className="font-medium hover:underline block cursor-pointer">
                            {vacation.employeeName}
                          </Link>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">{vacation.department}</Badge>
                            <span>{vacation.durationDays} dias</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {format(parseISO(vacation.startDate), "dd MMM", { locale: ptBR })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(parseISO(vacation.endDate), "dd MMM", { locale: ptBR })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {summary.upcomingVacations.length > 5 && (
                <Button variant="ghost" className="w-full mt-4 text-sm" asChild>
                  <Link href="/employees">
                    Ver todos os funcionários <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50 flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">Distribuição por Departamento</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              {summary.departmentBreakdown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Sem dados departamentais.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {summary.departmentBreakdown.map((dept, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{dept.department}</span>
                        <span className="text-muted-foreground text-xs">
                          {dept.onVacation} de {dept.count} em férias
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden flex">
                        <div
                          className="bg-primary h-full transition-all duration-1000 ease-out"
                          style={{ width: `${dept.count > 0 ? (dept.onVacation / dept.count) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Calendar - right column */}
        <MiniCalendarCard />
      </div>
    </div>
  );
}
