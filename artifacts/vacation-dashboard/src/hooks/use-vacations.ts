import {
  useListVacations,
  getListVacationsQueryKey,
} from "@workspace/api-client-react";
import { useMemo, useCallback } from "react";

export interface VacationEntry {
  id: number;
  employeeId: number;
  employeeName: string | null;
  employeeDepartment?: string | null;
  startDate: string;
  endDate: string;
  status: string;
}

export interface EmployeeColor {
  pill: string;
  dot: string;
  light: string;
}

const EMPLOYEE_COLORS: EmployeeColor[] = [
  {
    pill: "bg-blue-500 text-white",
    dot: "bg-blue-500",
    light: "bg-blue-50 border-blue-200 text-blue-800",
  },
  {
    pill: "bg-emerald-500 text-white",
    dot: "bg-emerald-500",
    light: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  {
    pill: "bg-violet-500 text-white",
    dot: "bg-violet-500",
    light: "bg-violet-50 border-violet-200 text-violet-800",
  },
  {
    pill: "bg-orange-500 text-white",
    dot: "bg-orange-500",
    light: "bg-orange-50 border-orange-200 text-orange-800",
  },
  {
    pill: "bg-rose-500 text-white",
    dot: "bg-rose-500",
    light: "bg-rose-50 border-rose-200 text-rose-800",
  },
  {
    pill: "bg-teal-500 text-white",
    dot: "bg-teal-500",
    light: "bg-teal-50 border-teal-200 text-teal-800",
  },
  {
    pill: "bg-amber-500 text-white",
    dot: "bg-amber-500",
    light: "bg-amber-50 border-amber-200 text-amber-800",
  },
  {
    pill: "bg-indigo-500 text-white",
    dot: "bg-indigo-500",
    light: "bg-indigo-50 border-indigo-200 text-indigo-800",
  },
];

export const PT_MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const PT_WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const PT_WEEKDAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

/**
 * Converte ano, mes e dia para string no formato YYYY-MM-DD
 */
export function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Verifica se uma data esta dentro de um intervalo
 */
export function datesOverlap(
  start: string,
  end: string,
  dayStr: string,
): boolean {
  return dayStr >= start && dayStr <= end;
}

interface UseVacationsOptions {
  status?: "approved" | "pending" | "rejected";
  enabled?: boolean;
}

/**
 * Hook para buscar e gerenciar ferias com React Query.
 * Centraliza logica de fetch, cores e filtragem.
 *
 * O request é feito pelo client gerado (orval), que já aplica o base path
 * do deploy na URL da API.
 */
export function useVacations(options: UseVacationsOptions = {}) {
  const { status = "approved", enabled = true } = options;

  const { data, isLoading, error, refetch } = useListVacations(
    { status },
    {
      query: {
        queryKey: getListVacationsQueryKey({ status }),
        enabled,
        staleTime: 30_000, // 30 segundos
        refetchOnWindowFocus: true,
      },
    },
  );

  const vacations: VacationEntry[] = useMemo(
    () => data?.vacations ?? [],
    [data],
  );

  // Memoiza lista de funcionarios unicos
  const uniqueEmployees = useMemo(() => {
    return Array.from(
      new Map(
        vacations
          .filter((v) => v.employeeName)
          .map((v) => [v.employeeId, v.employeeName!] as const),
      ).entries(),
    ).map(([id, name]) => ({ id, name }));
  }, [vacations]);

  // Funcao para obter cor de um funcionario
  const colorFor = useCallback(
    (employeeId: number): EmployeeColor => {
      const idx = uniqueEmployees.findIndex((e) => e.id === employeeId);
      return EMPLOYEE_COLORS[
        (idx < 0 ? employeeId : idx) % EMPLOYEE_COLORS.length
      ];
    },
    [uniqueEmployees],
  );

  // Funcao para obter ferias em um dia especifico
  const vacationsOnDay = useCallback(
    (dayStr: string) => {
      return vacations.filter(
        (v) =>
          v.status === "approved" &&
          datesOverlap(v.startDate, v.endDate, dayStr),
      );
    },
    [vacations],
  );

  return {
    vacations,
    isLoading,
    error,
    refetch,
    uniqueEmployees,
    colorFor,
    vacationsOnDay,
  };
}
