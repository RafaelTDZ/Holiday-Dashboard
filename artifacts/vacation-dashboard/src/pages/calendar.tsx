import { useState, useMemo, memo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useVacations, toDateStr, PT_MONTHS, PT_WEEKDAYS } from "@/hooks/use-vacations";

interface CalendarCellProps {
  day: number | null;
  dateStr: string | null;
  isToday: boolean;
  isSelected: boolean;
  vacationsCount: number;
  onSelect: () => void;
  colorFor: (employeeId: number) => { pill: string };
  vacations: Array<{ id: number; employeeId: number; employeeName: string | null }>;
}

const CalendarCell = memo(function CalendarCell({
  day,
  dateStr,
  isToday,
  isSelected,
  vacationsCount,
  onSelect,
  colorFor,
  vacations,
}: CalendarCellProps) {
  if (!day || !dateStr) {
    return <div className="bg-muted/30 h-24 sm:h-28" />;
  }

  const hasVacations = vacationsCount > 0;

  return (
    <div
      onClick={onSelect}
      className={`
        bg-card h-24 sm:h-28 p-1.5 flex flex-col cursor-pointer transition-colors
        ${hasVacations ? "hover:bg-primary/5" : "hover:bg-muted/30"}
        ${isSelected ? "ring-2 ring-inset ring-primary" : ""}
      `}
      role="button"
      aria-label={`Dia ${day}${vacationsCount > 0 ? `, ${vacationsCount} férias` : ""}`}
    >
      <span
        className={`
          self-start text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
          ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}
        `}
      >
        {day}
      </span>
      <div className="flex-1 mt-1 space-y-0.5 overflow-hidden">
        {vacations.slice(0, 3).map((v) => {
          const color = colorFor(v.employeeId);
          const name = v.employeeName ?? "Funcionário";
          const initials = name
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
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
        {vacationsCount > 3 && (
          <div className="text-[10px] text-muted-foreground pl-1">+{vacationsCount - 3} mais</div>
        )}
      </div>
    </div>
  );
});

export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { vacations, isLoading, uniqueEmployees, colorFor, vacationsOnDay } = useVacations({
    status: "approved",
  });

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
    setSelectedDay(null);
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  // Memoiza celulas do calendario
  const cells = useMemo(() => {
    const result: Array<{ day: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      result.push({ day: null, dateStr: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({ day: d, dateStr: toDateStr(year, month, d) });
    }
    while (result.length % 7 !== 0) {
      result.push({ day: null, dateStr: null });
    }
    return result;
  }, [firstDayOfWeek, daysInMonth, year, month]);

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
          <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Mês anterior">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold tracking-tight">
            {PT_MONTHS[month]} {year}
          </h2>
          <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Próximo mês">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {isLoading ? (
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
                <div
                  key={wd}
                  className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-border">
              {cells.map((cell, idx) => {
                const dayVacations = cell.dateStr ? vacationsOnDay(cell.dateStr) : [];
                return (
                  <CalendarCell
                    key={idx}
                    day={cell.day}
                    dateStr={cell.dateStr}
                    isToday={cell.dateStr === todayStr}
                    isSelected={cell.dateStr === selectedDay}
                    vacationsCount={dayVacations.length}
                    vacations={dayVacations}
                    colorFor={colorFor}
                    onSelect={() => setSelectedDay(cell.dateStr === selectedDay ? null : cell.dateStr)}
                  />
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
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h3>
          </div>
          <div className="space-y-2">
            {selectedDayVacations.map((v) => {
              const color = colorFor(v.employeeId);
              return (
                <div
                  key={v.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${color.light}`}
                >
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
      {!isLoading && uniqueEmployees.length > 0 && (
        <div className="bg-card border shadow-sm rounded-xl p-4">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Legenda</h3>
          <div className="flex flex-wrap gap-2">
            {uniqueEmployees.map((emp) => {
              const color = colorFor(emp.id);
              return (
                <div
                  key={emp.id}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${color.pill}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block" />
                  {emp.name}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!isLoading && uniqueEmployees.length === 0 && (
        <div className="bg-card border shadow-sm rounded-xl p-8 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma férias aprovada para exibir no calendário.</p>
        </div>
      )}
    </div>
  );
}
