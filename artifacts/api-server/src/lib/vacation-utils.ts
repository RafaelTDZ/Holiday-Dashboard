import type { Vacation } from "@workspace/db";

/** Dias de férias concedidos por ano aquisitivo completo (estatutário). */
export const VACATION_DAYS_PER_YEAR = 30;

/**
 * Duração média de um ano usada no acúmulo proporcional.
 * 365,25 (365 + 1/4) evita o "salto" do ano bissexto no cálculo.
 */
export const DAYS_PER_YEAR = 365.25;

export interface VacationStats {
  /** Saldo de férias disponível (nunca negativo: é limitado a 0). */
  vacationBalanceDays: number;
  /**
   * Dias até o **próximo aniversário de acúmulo** (não até a próxima férias).
   *
   * IMPORTANTE (contrato público): o nome interno do valor é
   * `daysUntilNextAccrual`, mas a **chave JSON exposta pela API continua
   * sendo `daysUntilNextVacation`**. O retorno de `calculateVacationStats`
   * é montado de forma explícita para manter essa chave pública estável
   * (o contrato OpenAPI e os clientes gerados dependem dela).
   */
  daysUntilNextVacation: number;
  /** O funcionário está de férias hoje (somente férias aprovadas). */
  isOnVacation: boolean;
  /** Início da próxima férias aprovada e futura (`null` se não houver). */
  nextVacationStart: string | null;
  /** O saldo já atingiu os 30 dias exigidos para o primeiro pedido? */
  eligibleForVacation: boolean;
  /** Data (YYYY-MM-DD) em que o saldo atinge 30 dias (≈ 1 ano de casa). */
  firstEligibilityDate: string;
  /** Dias de férias vendidos (abatidos do saldo). */
  daysSold: number;
}

/** Normaliza um `Date` para a meia-noite UTC do seu dia de calendário. */
function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

/**
 * Dias de férias **acumulados** por um funcionário desde a admissão.
 *
 * Regra (README → "Regras de negócio"): o acúmulo é **proporcional desde o
 * dia 1**, ou seja, `diasTrabalhados / 365,25 × 30`. Não existe período
 * aquisitivo bloqueado: o saldo cresce continuamente desde a admissão.
 *
 * Função pura (sem banco), usada tanto por `calculateVacationStats` quanto
 * pela revalidação de saldo no momento da aprovação de um pedido.
 */
export function calculateAccruedDays(
  hireDate: string,
  today: Date = new Date(),
): number {
  const hire = new Date(hireDate + "T00:00:00Z");
  const todayUtc = startOfUtcDay(today);

  const msPerDay = 24 * 60 * 60 * 1000;
  const daysWorked = Math.max(
    0,
    Math.round((todayUtc.getTime() - hire.getTime()) / msPerDay),
  );

  return (daysWorked / DAYS_PER_YEAR) * VACATION_DAYS_PER_YEAR;
}

/**
 * Calculate vacation statistics for an employee.
 *
 * Rules (see README → "Regras de negócio"):
 * - **Proportional accrual from day 1**: the balance grows continuously from
 *   the hire date, `daysEarned = (daysWorked / 365.25) * 30`. There is no
 *   blocked accrual period — the employee already has a positive (growing)
 *   balance on the first day.
 * - `balance = daysEarned - approvedVacationDays - soldDays`
 *   (the reported balance is never negative: it is clamped to 0).
 * - **Only APPROVED vacations** consume the balance and drive the
 *   "on vacation today" flag. Pending requests do not consume balance and
 *   rejected requests never did.
 * - `eligibleForVacation` / `firstEligibilityDate` tell **when the balance
 *   reaches 30 days** (≈ 1 year with the company). That is the minimum
 *   required to file the first vacation request — it is not a lock on
 *   acquiring the right to vacation.
 * - `soldDays` (vacation days sold) are deducted from the balance.
 * - `daysUntilNextVacation` (internally `daysUntilNextAccrual`) is the
 *   distance, in days, to the next **accrual anniversary** — the next
 *   accrual milestone — and NOT the distance to the next vacation.
 */
export function calculateVacationStats(
  hireDate: string,
  vacations: Pick<Vacation, "startDate" | "endDate" | "status">[],
  soldDays: number = 0,
  today: Date = new Date(),
): VacationStats {
  const hire = new Date(hireDate + "T00:00:00Z");
  const todayUtc = startOfUtcDay(today);

  const msPerDay = 24 * 60 * 60 * 1000;
  const todayStr = todayUtc.toISOString().split("T")[0];

  // Date when the employee completes 1 year (first eligibility)
  const firstEligibility = new Date(
    Date.UTC(hire.getUTCFullYear() + 1, hire.getUTCMonth(), hire.getUTCDate()),
  );
  const firstEligibilityDate = firstEligibility.toISOString().split("T")[0];
  const eligibleForVacation = todayUtc >= firstEligibility;

  // Only approved vacations count for balance calculations
  const approvedVacations = vacations.filter((v) => v.status === "approved");

  // Proportional accrual: 30 days per year, shown from day 1
  const daysEarned = calculateAccruedDays(hireDate, today);

  // Days taken: count ALL approved vacations (past, ongoing, and future)
  let daysTaken = 0;
  for (const v of approvedVacations) {
    const start = new Date(v.startDate + "T00:00:00Z");
    const end = new Date(v.endDate + "T00:00:00Z");
    const duration =
      Math.round((end.getTime() - start.getTime()) / msPerDay) + 1;
    daysTaken += Math.max(0, duration);
  }

  const vacationBalanceDays = Math.max(0, daysEarned - daysTaken - soldDays);

  // Is on vacation today? (approved only)
  const isOnVacation = approvedVacations.some(
    (v) => v.startDate <= todayStr && v.endDate >= todayStr,
  );

  // Next scheduled vacation start: first upcoming APPROVED vacation
  const futureVacations = approvedVacations
    .filter((v) => v.startDate > todayStr)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const nextVacationStart = futureVacations[0]?.startDate ?? null;

  // daysUntilNextAccrual: days until the next accrual anniversary
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

  const daysUntilNextAccrual = Math.max(
    0,
    Math.round((nextAnniversary.getTime() - todayUtc.getTime()) / msPerDay),
  );

  // The return is built explicitly: the public JSON key stays
  // `daysUntilNextVacation` (API contract) even though the internal name of
  // the value is `daysUntilNextAccrual`.
  return {
    vacationBalanceDays,
    daysUntilNextVacation: daysUntilNextAccrual,
    isOnVacation,
    nextVacationStart,
    eligibleForVacation,
    firstEligibilityDate,
    daysSold: soldDays,
  };
}

/**
 * Duração (em dias, inclusive) de um período de férias.
 * `2024-01-01` → `2024-01-01` = 1 dia; `2024-01-01` → `2024-01-10` = 10 dias.
 */
export function vacationDurationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate + "T00:00:00Z");
  const end = new Date(endDate + "T00:00:00Z");
  return (
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
  );
}

/**
 * Soma das durações (em dias) de um conjunto de férias aprovadas.
 *
 * `excludeId` permite ignorar um pedido específico — usado na revalidação de
 * saldo da aprovação, em que o pedido sendo aprovado não pode ser contado
 * como "já aprovado" (ele ainda será aprovado).
 */
export function sumApprovedVacationDays(
  vacations: Pick<Vacation, "id" | "startDate" | "endDate" | "status">[],
  excludeId?: number,
): number {
  return vacations
    .filter((v) => v.status === "approved" && v.id !== excludeId)
    .reduce(
      (acc, v) => acc + vacationDurationDays(v.startDate, v.endDate),
      0,
    );
}

/**
 * Verifica se um período de férias conflita com algum período já existente.
 *
 * - Datas em `YYYY-MM-DD` (a ordem lexicográfica coincide com a cronológica).
 * - Comparação **inclusiva** nas extremidades: intervalos que compartilham
 *   ao menos um dia (mesmo início, mesmo fim,contained) **conflitam**.
 * - Períodos **adjacentes** (o fim de um é o dia anterior ao início do outro)
 *   **não** conflitam: `01-10` e `11-20` podem coexistir.
 *
 * Função pura (sem banco), pensada para ser testada com tabela de casos.
 */
export function hasVacationOverlap(
  range: { startDate: string; endDate: string },
  existing: { startDate: string; endDate: string }[],
): boolean {
  const { startDate, endDate } = range;
  return existing.some(
    (v) => v.startDate <= endDate && startDate <= v.endDate,
  );
}

/**
 * Uma férias pode ser aprovada com o saldo atual do funcionário?
 *
 * A regra de saldo (README) é
 * `saldo = diasAcumulados - diasAprovados - diasVendidos`.
 * Ao aprovar, o pedido passa a contar como dia aprovado, então a aprovação é
 * possível apenas se
 * `daysEarned - approvedDays - daysSold - vacationDays >= 0`.
 *
 * @param params.vacationDays  dias do pedido que está sendo aprovado
 * @param params.daysEarned    dias acumulados desde a admissão
 * @param params.approvedDays  dias já aprovados, **sem** contar este pedido
 * @param params.daysSold      dias de férias vendidos
 */
export function canApproveVacation(params: {
  vacationDays: number;
  daysEarned: number;
  approvedDays: number;
  daysSold: number;
}): boolean {
  const { vacationDays, daysEarned, approvedDays, daysSold } = params;
  return daysEarned - approvedDays - daysSold - vacationDays >= 0;
}
