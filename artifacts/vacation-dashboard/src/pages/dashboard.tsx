import { useState, useEffect } from "react";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Sun, AlertTriangle, CalendarDays, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function getApiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api`;
}

interface VacationEntry {
  id: number;
  employeeId: number;
  employeeName: string | null;
  startDate: string;
  endDate: string;
  status: string;
}

const EMPLOYEE_COLORS = [
  { pill: "bg-blue-500 text-white" },
  { pill: "bg-emerald-500 text-white" },
  { pill: "bg-violet-500 text-white" },
  { pill: "bg-orange-500 text-white" },
  { pill: "bg-rose-500 text-white" },
  { pill: "bg-teal-500 text-white" },
  { pill: "bg-amber-500 text-white" },
  { pill: "bg-indigo-500 text-white" },
];

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const PT_WEEKDAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function MiniCalendarCard() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [vacations, setVacations] = useState<VacationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${getApiBase()}/vacations?status=approved`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setVacations(d.vacations ?? []))
      .catch(() => setVacations([]))
      .finally(() => setLoading(false));
  }, []);

  const uniqueEmployees = Array.from(
    new Map(
      vacations.filter((v) => v.employeeName).map((v) => [v.employeeId, v.employeeName!])
    ).entries()
  ).map(([id, name]) => ({ id, name }));

  const colorFor = (employeeId: number) => {
    const idx = uniqueEmployees.findIndex((e) => e.id === employeeId);
    return EMPLOYEE_COLORS[(idx < 0 ? employeeId : idx) % EMPLOYEE_COLORS.length];
  };

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
    setSelectedDay(null);
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, dateStr: toDateStr(year, month, d) });
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null });

  const vacationsOnDay = (dateStr: string) =>
    vacations.filter((v) => v.status === "approved" && dateStr >= v.startDate && dateStr <= v.endDate);

  const selectedDayVacations = selectedDay ? vacationsOnDay(selectedDay) : [];

  return (
    <Card className="shadow-sm border-border/50 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendário de Férias
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {PT_MONTHS[month]} {year}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        {loading ? (
          <div className="grid grid-cols-7 gap-1 mt-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-10 rounded" />
            ))}
          </div>
        ) : (
          <>
            {/* Weekday labels */}
            <div className="grid grid-cols-7 mb-1">
              {PT_WEEKDAYS_SHORT.map((wd, i) => (
                <div key={i} className="py-1 text-center text-[11px] font-semibold text-muted-foreground">
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px">
              {cells.map((cell, idx) => {
                if (!cell.day || !cell.dateStr) {
                  return <div key={idx} className="h-10" />;
                }
                const dayVacations = vacationsOnDay(cell.dateStr);
                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === selectedDay;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedDay(isSelected ? null : cell.dateStr!)}
                    className={`
                      h-10 flex flex-col items-center justify-start pt-1 rounded-lg text-xs transition-colors relative
                      ${isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/60"}
                    `}
                  >
                    <span className={`
                      w-6 h-6 flex items-center justify-center rounded-full font-medium
                      ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}
                    `}>
                      {cell.day}
                    </span>
                    {dayVacations.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                        {dayVacations.slice(0, 3).map((v) => (
                          <span
                            key={v.id}
                            className={`w-1.5 h-1.5 rounded-full ${colorFor(v.employeeId).pill.split(" ")[0]}`}
                            title={v.employeeName ?? ""}
                          />
                        ))}
                        {dayVacations.length > 3 && (
                          <span className="text-[8px] text-muted-foreground leading-none">+{dayVacations.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected day popover */}
            {selectedDay && (
              <div className="mt-3 rounded-lg border bg-muted/30 p-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                {selectedDayVacations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma férias aprovada.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedDayVacations.map((v) => {
                      const color = colorFor(v.employeeId);
                      return (
                        <div key={v.id} className={`flex items-center gap-2 text-xs rounded px-2 py-1 font-medium ${color.pill}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                          <span>{v.employeeName}</span>
                          <span className="ml-auto opacity-75">
                            até {new Date(v.endDate + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Legend */}
            {uniqueEmployees.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {uniqueEmployees.map((emp) => {
                  const color = colorFor(emp.id);
                  return (
                    <span key={emp.id} className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${color.pill}`}>
                      <span className="w-1 h-1 rounded-full bg-white/60" />
                      {emp.name}
                    </span>
                  );
                })}
              </div>
            )}

            {uniqueEmployees.length === 0 && (
              <div className="mt-4 flex flex-col items-center justify-center py-4 text-center">
                <p className="text-xs text-muted-foreground">Nenhuma férias aprovada para exibir.</p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

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
        </div>{/* end left column */}

        {/* Calendar — right column, stretches to match */}
        <MiniCalendarCard />
      </div>
    </div>
  );
}
