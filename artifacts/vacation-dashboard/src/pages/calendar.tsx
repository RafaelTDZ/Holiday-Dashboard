import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

function getApiBase() {
  const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/api`;
}

interface VacationEntry {
  id: number;
  employeeId: number;
  employeeName: string | null;
  employeeDepartment: string | null;
  startDate: string;
  endDate: string;
  status: string;
}

const EMPLOYEE_COLORS = [
  { pill: "bg-blue-500 text-white", dot: "bg-blue-500", light: "bg-blue-50 border-blue-200 text-blue-800" },
  { pill: "bg-emerald-500 text-white", dot: "bg-emerald-500", light: "bg-emerald-50 border-emerald-200 text-emerald-800" },
  { pill: "bg-violet-500 text-white", dot: "bg-violet-500", light: "bg-violet-50 border-violet-200 text-violet-800" },
  { pill: "bg-orange-500 text-white", dot: "bg-orange-500", light: "bg-orange-50 border-orange-200 text-orange-800" },
  { pill: "bg-rose-500 text-white", dot: "bg-rose-500", light: "bg-rose-50 border-rose-200 text-rose-800" },
  { pill: "bg-teal-500 text-white", dot: "bg-teal-500", light: "bg-teal-50 border-teal-200 text-teal-800" },
  { pill: "bg-amber-500 text-white", dot: "bg-amber-500", light: "bg-amber-50 border-amber-200 text-amber-800" },
  { pill: "bg-indigo-500 text-white", dot: "bg-indigo-500", light: "bg-indigo-50 border-indigo-200 text-indigo-800" },
];

const PT_MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const PT_WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function datesOverlap(start1: string, end1: string, dayStr: string): boolean {
  return dayStr >= start1 && dayStr <= end1;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function Calendar() {
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
      .then((data) => {
        setVacations(data.vacations ?? []);
      })
      .catch(() => setVacations([]))
      .finally(() => setLoading(false));
  }, []);

  const uniqueEmployees = Array.from(
    new Map(
      vacations
        .filter((v) => v.employeeName)
        .map((v) => [v.employeeId, v.employeeName!])
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

  const cells: Array<{ day: number | null; dateStr: string | null }> = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push({ day: null, dateStr: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateStr: toDateStr(year, month, d) });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null });

  const vacationsOnDay = (dateStr: string) =>
    vacations.filter((v) => v.status === "approved" && datesOverlap(v.startDate, v.endDate, dateStr));

  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const selectedDayVacations = selectedDay ? vacationsOnDay(selectedDay) : [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Calendário de Férias</h1>
        <p className="text-muted-foreground mt-1">Visualize os períodos de férias aprovados da equipe.</p>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold tracking-tight">
            {PT_MONTHS[month]} {year}
          </h2>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {loading ? (
          <div className="p-6 grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 border-b">
              {PT_WEEKDAYS.map((wd) => (
                <div key={wd} className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-border">
              {cells.map((cell, idx) => {
                if (!cell.day || !cell.dateStr) {
                  return <div key={idx} className="bg-muted/30 h-24 sm:h-28" />;
                }
                const dayVacations = vacationsOnDay(cell.dateStr);
                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === selectedDay;
                const hasVacations = dayVacations.length > 0;

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedDay(isSelected ? null : cell.dateStr!)}
                    className={`
                      bg-card h-24 sm:h-28 p-1.5 flex flex-col cursor-pointer transition-colors
                      ${hasVacations ? "hover:bg-primary/5" : "hover:bg-muted/30"}
                      ${isSelected ? "ring-2 ring-inset ring-primary" : ""}
                    `}
                  >
                    <span className={`
                      self-start text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                      ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}
                    `}>
                      {cell.day}
                    </span>
                    <div className="flex-1 mt-1 space-y-0.5 overflow-hidden">
                      {dayVacations.slice(0, 3).map((v) => {
                        const color = colorFor(v.employeeId);
                        const name = v.employeeName ?? "Funcionário";
                        const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
                        return (
                          <div
                            key={v.id}
                            className={`text-[10px] font-medium px-1 py-0.5 rounded flex items-center gap-1 truncate ${color.pill}`}
                            title={name}
                          >
                            <span className="font-bold">{initials}</span>
                            <span className="truncate hidden sm:block">{name.split(" ")[0]}</span>
                          </div>
                        );
                      })}
                      {dayVacations.length > 3 && (
                        <div className="text-[10px] text-muted-foreground pl-1">
                          +{dayVacations.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Selected day detail */}
      {selectedDay && selectedDayVacations.length > 0 && (
        <div className="bg-card border shadow-sm rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h3>
          </div>
          <div className="space-y-2">
            {selectedDayVacations.map((v) => {
              const color = colorFor(v.employeeId);
              return (
                <div key={v.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${color.light}`}>
                  <div>
                    <p className="font-medium text-sm">{v.employeeName}</p>
                    <p className="text-xs opacity-70">
                      {new Date(v.startDate + "T12:00:00").toLocaleDateString("pt-BR")} –{" "}
                      {new Date(v.endDate + "T12:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge className="bg-green-500 text-white text-xs border-0">Aprovado</Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedDay && selectedDayVacations.length === 0 && (
        <div className="bg-card border shadow-sm rounded-xl p-4 animate-in fade-in duration-200">
          <p className="text-sm text-muted-foreground text-center">Nenhuma férias aprovada para este dia.</p>
        </div>
      )}

      {/* Legend */}
      {!loading && uniqueEmployees.length > 0 && (
        <div className="bg-card border shadow-sm rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Legenda</h3>
          <div className="flex flex-wrap gap-2">
            {uniqueEmployees.map((emp) => {
              const color = colorFor(emp.id);
              return (
                <div key={emp.id} className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${color.pill}`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block" />
                  {emp.name}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && uniqueEmployees.length === 0 && (
        <div className="bg-card border shadow-sm rounded-xl p-8 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma férias aprovada para exibir no calendário.</p>
        </div>
      )}
    </div>
  );
}
