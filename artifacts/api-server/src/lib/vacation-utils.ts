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
 * - Employees earn 30 days of vacation proportional to the time worked.
 *   balanceDays = floor((daysWorked / 365.25) * 30) - daysTaken
 * - daysUntilNextVacation = days until the next annual anniversary starting
 *   from either the hire date or the end date of the last taken vacation
 *   (i.e., the start of the current accrual period).
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

  const msPerDay = 24 * 60 * 60 * 1000;
  const todayStr = todayUtc.toISOString().split("T")[0];

  // Days worked since hire date
  const daysWorked = Math.max(
    0,
    Math.round((todayUtc.getTime() - hire.getTime()) / msPerDay),
  );

  // Days earned proportionally: 30 per year
  const daysEarned = Math.floor((daysWorked / 365.25) * 30);

  // Days taken: only count past and currently ongoing vacations (not future ones)
  let daysTaken = 0;
  for (const v of vacations) {
    if (v.startDate > todayStr) continue; // skip future vacations
    const start = new Date(v.startDate + "T00:00:00Z");
    const end = new Date(v.endDate + "T00:00:00Z");
    const duration =
      Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
    daysTaken += Math.max(0, duration);
  }

  const vacationBalanceDays = Math.max(0, daysEarned - daysTaken);

  // Is on vacation today?
  const isOnVacation = vacations.some(
    (v) => v.startDate <= todayStr && v.endDate >= todayStr,
  );

  // Next scheduled vacation start: first upcoming vacation start date
  const futureVacations = vacations
    .filter((v) => v.startDate > todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const nextVacationStart = futureVacations[0]?.startDate ?? null;

  // daysUntilNextVacation: days until next annual accrual anniversary
  // Accrual period starts from: end date of last vacation taken, or hire date if none
  const pastVacations = vacations
    .filter((v) => v.endDate < todayStr)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));

  const lastVacationEnd = pastVacations[0]?.endDate ?? null;
  const accrualStart = lastVacationEnd
    ? new Date(lastVacationEnd + "T00:00:00Z")
    : hire;

  // Find the next anniversary of accrualStart
  let nextAnniversary = new Date(
    Date.UTC(
      todayUtc.getFullYear(),
      accrualStart.getUTCMonth(),
      accrualStart.getUTCDate(),
    ),
  );
  if (nextAnniversary <= todayUtc) {
    nextAnniversary = new Date(
      Date.UTC(
        todayUtc.getFullYear() + 1,
        accrualStart.getUTCMonth(),
        accrualStart.getUTCDate(),
      ),
    );
  }

  const daysUntilNextVacation = Math.max(
    0,
    Math.round((nextAnniversary.getTime() - todayUtc.getTime()) / msPerDay),
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
