import { describe, it, expect } from "vitest";
import {
  MAX_DAYS_PER_SALE,
  MAX_SALE_FRACTION,
  VACATION_PERIOD_DAYS,
  getMaxDaysPerSale,
  validateSaleDays,
} from "../src/lib/vacation-sale-policy";

/**
 * Política de venda de dias (BIZ-01): função pura, sem banco, sem HTTP.
 *
 * Regras vigentes: cada operação de venda respeita no máximo 1/3 do período
 * aquisitivo (10 de 30 dias) e o total vendido nunca ultrapassa o saldo
 * disponível do funcionário.
 */
describe("getMaxDaysPerSale", () => {
  it("usa 10 dias por padrão (1/3 de um período de 30 dias)", () => {
    expect(getMaxDaysPerSale()).toBe(10);
    expect(getMaxDaysPerSale(VACATION_PERIOD_DAYS)).toBe(10);
    expect(MAX_DAYS_PER_SALE).toBe(10);
  });

  it("acompanha o período informado", () => {
    expect(getMaxDaysPerSale(12)).toBe(4);
    expect(getMaxDaysPerSale(15)).toBe(5);
    expect(getMaxDaysPerSale(60)).toBe(20);
  });

  it("mantém as constantes coerentes entre si", () => {
    expect(VACATION_PERIOD_DAYS).toBe(30);
    expect(MAX_SALE_FRACTION).toBeCloseTo(1 / 3, 10);
    expect(MAX_DAYS_PER_SALE).toBe(Math.floor(VACATION_PERIOD_DAYS * MAX_SALE_FRACTION));
  });

  it("cai no limite padrão quando o período é inválido", () => {
    expect(getMaxDaysPerSale(0)).toBe(10);
    expect(getMaxDaysPerSale(-30)).toBe(10);
    expect(getMaxDaysPerSale(Number.NaN)).toBe(10);
  });
});

describe("validateSaleDays", () => {
  it("aceita exatamente o limite de 10 dias", () => {
    const result = validateSaleDays({ daysSold: 10, balanceDays: 30 });

    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("recusa 11 dias (acima de 1/3 do período)", () => {
    const result = validateSaleDays({ daysSold: 11, balanceDays: 30 });

    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
  });

  it("recusa quando o saldo é menor que os dias vendidos", () => {
    const result = validateSaleDays({ daysSold: 5, balanceDays: 4.9 });

    expect(result.valid).toBe(false);
    expect(result.message).toContain("Saldo insuficiente");
  });

  it("recusa saldo negativo", () => {
    const result = validateSaleDays({ daysSold: 1, balanceDays: -3 });

    expect(result.valid).toBe(false);
    expect(result.message).toContain("Saldo insuficiente");
  });

  it("recusa saldo zero", () => {
    const result = validateSaleDays({ daysSold: 1, balanceDays: 0 });

    expect(result.valid).toBe(false);
    expect(result.message).toContain("Saldo insuficiente");
  });

  it("recusa dias inválidos (zero, negativo ou fracionário)", () => {
    expect(validateSaleDays({ daysSold: 0, balanceDays: 30 }).valid).toBe(false);
    expect(validateSaleDays({ daysSold: -1, balanceDays: 30 }).valid).toBe(false);
    expect(validateSaleDays({ daysSold: 1.5, balanceDays: 30 }).valid).toBe(false);
  });

  it("a mensagem do limite explica a regra de 1/3 em português", () => {
    const result = validateSaleDays({ daysSold: 11, balanceDays: 30 });

    expect(result.message).toBe(
      "É possível vender no máximo 10 dias por operação (1/3 do período de férias).",
    );
  });

  it("a mensagem de saldo mantém o formato já usado pela API", () => {
    const result = validateSaleDays({ daysSold: 10, balanceDays: 4.25 });

    expect(result.message).toBe("Saldo insuficiente. Saldo disponível: 4.3 dias.");
  });

  it("respeita um limite customizado por operação", () => {
    const result = validateSaleDays({
      daysSold: 5,
      balanceDays: 30,
      maxDaysPerSale: 4,
    });

    expect(result.valid).toBe(false);
    expect(result.message).toContain("no máximo 4 dias");
  });

  it("aceita uma venda dentro do limite e do saldo", () => {
    const result = validateSaleDays({ daysSold: 3, balanceDays: 10 });

    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });
});
