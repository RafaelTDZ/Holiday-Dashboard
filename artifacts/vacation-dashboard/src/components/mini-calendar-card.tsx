import { useState, useMemo, memo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useVacations, toDateStr, PT_MONTHS, PT_WEEKDAYS_SHORT } from "@/hooks/use-vacations";

/**
 * Componente de mini-calendario para o dashboard.
 * Usa React.memo para evitar re-renders desnecessarios.
 */
function MiniCalendarCardBase() {
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

  // Memoiza as celulas do calendario
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
    <Card className="shadow-sm border-border/50 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendário de Férias
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={prevMonth}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {PT_MONTHS[month]} {year}
            </span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={nextMonth}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-0">
        {isLoading ? (
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
                <div 
                  key={i} 
                  className="py-1 text-center text-[11px] font-semibold text-muted-foreground"
                >
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
                    aria-label={`Dia ${cell.day}${dayVacations.length > 0 ? `, ${dayVacations.length} férias` : ""}`}
                  >
                    <span
                      className={`
                        w-6 h-6 flex items-center justify-center rounded-full font-medium
                        ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}
                      `}
                    >
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
                          <span className="text-[8px] text-muted-foreground leading-none">
                            +{dayVacations.length - 3}
                          </span>
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
                  {new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                {selectedDayVacations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma férias aprovada.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedDayVacations.map((v) => {
                      const color = colorFor(v.employeeId);
                      return (
                        <div
                          key={v.id}
                          className={`flex items-center gap-2 text-xs rounded px-2 py-1 font-medium ${color.pill}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
                          <span>{v.employeeName}</span>
                          <span className="ml-auto opacity-75">
                            até{" "}
                            {new Date(v.endDate + "T12:00:00").toLocaleDateString("pt-BR", {
                              day: "numeric",
                              month: "short",
                            })}
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
                    <span
                      key={emp.id}
                      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${color.pill}`}
                    >
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

export const MiniCalendarCard = memo(MiniCalendarCardBase);
