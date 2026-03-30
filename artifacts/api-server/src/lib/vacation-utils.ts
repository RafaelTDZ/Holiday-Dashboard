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
 * - Only APPROVED vacations count toward balance and isOnVacation.
 * - daysUntilNextVacation = days until the next annual anniversary starting
 *   from either the hire date or the end date of the last approved vacation.
 */
export function calculateVacationStats(
  hireDate: string,
  vacations: Pick<Vacation, "startDate" | "endDate" | "status">[],
  today: Date = new Date(),
): VacationStats {
  const hire = new Date(hireDate + "T00:00:00Z");
  const todayUtc = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );

  const msPerDay = 24 * 60 * 60 * 1000;
  const todayStr = todayUtc.toISOString().split("T")[0];

  // Only approved vacations count for balance calculations
  const approvedVacations = vacations.filter((v) => v.status === "approved");

  // Days worked since hire date
  const daysWorked = Math.max(
    0,
    Math.round((todayUtc.getTime() - hire.getTime()) / msPerDay),
  );

  // Days earned proportionally: 30 per year
  const daysEarned = Math.floor((daysWorked / 365.25) * 30);

  // Days taken: only count past and currently ongoing APPROVED vacations (not future ones)
  let daysTaken = 0;
  for (const v of approvedVacations) {
    if (v.startDate > todayStr) continue; // skip future vacations
    const start = new Date(v.startDate + "T00:00:00Z");
    const end = new Date(v.endDate + "T00:00:00Z");
    const duration =
      Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
    daysTaken += Math.max(0, duration);
  }

  const vacationBalanceDays = Math.max(0, daysEarned - daysTaken);

  // Is on vacation today? (approved only)
  const isOnVacation = approvedVacations.some(
    (v) => v.startDate <= todayStr && v.endDate >= todayStr,
  );

  // Next scheduled vacation start: first upcoming APPROVED vacation
  const futureVacations = approvedVacations
    .filter((v) => v.startDate > todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const nextVacationStart = futureVacations[0]?.startDate ?? null;

  // daysUntilNextVacation: days until next annual accrual anniversary
  // Accrual period starts from: end date of last approved vacation taken, or hire date if none
  const pastVacations = approvedVacations
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
