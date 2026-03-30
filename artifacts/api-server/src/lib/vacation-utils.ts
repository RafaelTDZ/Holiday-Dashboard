import type { Vacation } from "@workspace/db";

export interface VacationStats {
  vacationBalanceDays: number;
  daysUntilNextVacation: number;
  isOnVacation: boolean;
  nextVacationStart: string | null;
}

/**
 * Calculate vacation statistics for an employee.
 * Rules:
 * - Employees earn 30 days of vacation per year worked
 * - Balance = (years completed * 30) - days already taken
 * - daysUntilNextVacation = days until the next annual period starts
 *   (i.e., days until the next anniversary of hireDate that hasn't
 *   been "claimed" yet)
 */
export function calculateVacationStats(
  hireDate: string,
  vacations: Pick<Vacation, "startDate" | "endDate">[],
  today: Date = new Date(),
): VacationStats {
  const hire = new Date(hireDate + "T00:00:00Z");
  const todayUtc = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  // Years fully worked
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  const yearsWorked = Math.floor(
    (todayUtc.getTime() - hire.getTime()) / msPerYear,
  );

  // Days earned
  const daysEarned = yearsWorked * 30;

  // Days taken (sum of vacation durations)
  let daysTaken = 0;
  for (const v of vacations) {
    const start = new Date(v.startDate + "T00:00:00Z");
    const end = new Date(v.endDate + "T00:00:00Z");
    const duration =
      Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) +
      1;
    daysTaken += Math.max(0, duration);
  }

  const vacationBalanceDays = Math.max(0, daysEarned - daysTaken);

  // Is on vacation today?
  const todayStr = todayUtc.toISOString().split("T")[0];
  const isOnVacation = vacations.some(
    (v) => v.startDate <= todayStr && v.endDate >= todayStr,
  );

  // Next vacation start: find the upcoming scheduled vacation start date
  const futureVacations = vacations
    .filter((v) => v.startDate > todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const nextVacationStart = futureVacations[0]?.startDate ?? null;

  // Days until next annual period
  // Find next anniversary of hireDate
  let nextAnniversary = new Date(
    Date.UTC(todayUtc.getFullYear(), hire.getUTCMonth(), hire.getUTCDate()),
  );
  if (nextAnniversary <= todayUtc) {
    nextAnniversary = new Date(
      Date.UTC(todayUtc.getFullYear() + 1, hire.getUTCMonth(), hire.getUTCDate()),
    );
  }

  const daysUntilNextVacation = Math.max(
    0,
    Math.round(
      (nextAnniversary.getTime() - todayUtc.getTime()) / (24 * 60 * 60 * 1000),
    ),
  );

  return {
    vacationBalanceDays,
    daysUntilNextVacation,
    isOnVacation,
    nextVacationStart,
  };
}

export function vacationDurationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  return (
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
}
