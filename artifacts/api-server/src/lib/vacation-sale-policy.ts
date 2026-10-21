/**
 * Política de venda de dias (BIZ-01).
 *
 * Regra documentada no README: *"Venda de dias: no máximo o saldo
 * disponível; 1/3 do período"*. Este módulo isola o cálculo do limite e a
 * validação da venda para que a regra possa ser testada sem banco e
 * reutilizada pela API (e, depois, pela UI).
 *
 * O limite de 1/3 vale **por operação**: cada registro de venda respeita no
 * máximo 1/3 do período aquisitivo (10 de 30 dias). O total vendido ao longo
 * do período continua limitado pelo saldo disponível — essa é uma regra
 * diferente, já aplicada pela API.
 *
 * Módulo puro: sem banco, sem HTTP e sem logger.
 */

/** Dias de férias por período aquisitivo. */
export const VACATION_PERIOD_DAYS = 30;

/** Fração do período aquisitivo que pode ser vendida em uma operação. */
export const MAX_SALE_FRACTION = 1 / 3;

/** Limite padrão de dias vendidos por operação (1/3 de 30 dias). */
export const MAX_DAYS_PER_SALE = Math.floor(
  VACATION_PERIOD_DAYS * MAX_SALE_FRACTION,
);

/**
 * Limite de dias que podem ser vendidos em uma única operação.
 *
 * @param periodDays dias do período aquisitivo (30 por padrão).
 * @returns `Math.floor(periodDays / 3)` — 10 dias para o período padrão.
 *
 * Um período inválido (não numérico ou <= 0) cai no limite padrão: uma
 * configuração errada não deve liberar mais venda do que a regra normal.
 */
export function getMaxDaysPerSale(
  periodDays: number = VACATION_PERIOD_DAYS,
): number {
  if (!Number.isFinite(periodDays) || periodDays <= 0) {
    return MAX_DAYS_PER_SALE;
  }
  return Math.floor(periodDays * MAX_SALE_FRACTION);
}

export interface SaleDaysValidation {
  valid: boolean;
  message?: string;
}

/**
 * Valida uma venda de dias contra o limite de 1/3 do período e o saldo
 * disponível.
 *
 * A ordem das checagens é a mesma exibida ao gestor: primeiro o limite da
 * operação (1/3 do período), depois o saldo.
 *
 * @param params.daysSold dias vendidos na operação (inteiro positivo).
 * @param params.balanceDays saldo de férias disponível do funcionário.
 * @param params.maxDaysPerSale limite da operação (10 por padrão).
 */
export function validateSaleDays(params: {
  daysSold: number;
  balanceDays: number;
  maxDaysPerSale?: number;
}): SaleDaysValidation {
  const { daysSold, balanceDays } = params;
  const maxDaysPerSale = params.maxDaysPerSale ?? getMaxDaysPerSale();

  if (!Number.isInteger(daysSold) || daysSold <= 0) {
    return {
      valid: false,
      message: "Número de dias inválido. Deve ser um inteiro positivo.",
    };
  }

  if (daysSold > maxDaysPerSale) {
    return {
      valid: false,
      message: `É possível vender no máximo ${maxDaysPerSale} dias por operação (1/3 do período de férias).`,
    };
  }

  const availableDays = Number.isFinite(balanceDays) ? balanceDays : 0;

  if (daysSold > Math.floor(availableDays)) {
    return {
      valid: false,
      message: `Saldo insuficiente. Saldo disponível: ${availableDays.toFixed(1)} dias.`,
    };
  }

  return { valid: true };
}
