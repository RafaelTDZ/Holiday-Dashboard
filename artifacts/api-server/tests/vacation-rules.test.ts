import { describe, it, expect } from "vitest";
import {
  calculateAccruedDays,
  calculateVacationStats,
  canApproveVacation,
  hasVacationOverlap,
  sumApprovedVacationDays,
  vacationDurationDays,
} from "../src/lib/vacation-utils";

/**
 * Regras de férias no servidor (BIZ-02, BIZ-04, BIZ-05).
 *
 * Todos os testes são **unitários** (sem banco, sem rede): exercitam apenas
 * os helpers puros de `src/lib/vacation-utils.ts`.
 */

/**
 * "Hoje" fixo para os testes serem determinísticos.
 * Construído com componentes locais (mês 6 = julho) para não depender do
 * fuso horário do servidor.
 */
const TODAY = new Date(2024, 6, 1); // 2024-07-01

type DateRange = { startDate: string; endDate: string };

describe("hasVacationOverlap", () => {
  const cases: Array<{
    name: string;
    range: DateRange;
    existing: DateRange[];
    expected: boolean;
  }> = [
    {
      name: "períodos idênticos conflitam",
      range: { startDate: "2024-01-01", endDate: "2024-01-10" },
      existing: [{ startDate: "2024-01-01", endDate: "2024-01-10" }],
      expected: true,
    },
    {
      name: "mesmo início conflita",
      range: { startDate: "2024-01-10", endDate: "2024-01-20" },
      existing: [{ startDate: "2024-01-10", endDate: "2024-01-15" }],
      expected: true,
    },
    {
      name: "mesmo fim conflita",
      range: { startDate: "2024-01-05", endDate: "2024-01-10" },
      existing: [{ startDate: "2024-01-10", endDate: "2024-01-20" }],
      expected: true,
    },
    {
      name: "período contido dentro do existente conflita",
      range: { startDate: "2024-01-05", endDate: "2024-01-07" },
      existing: [{ startDate: "2024-01-01", endDate: "2024-01-10" }],
      expected: true,
    },
    {
      name: "período que contém o existente conflita",
      range: { startDate: "2024-01-01", endDate: "2024-01-20" },
      existing: [{ startDate: "2024-01-05", endDate: "2024-01-07" }],
      expected: true,
    },
    {
      name: "cruzamento (início dentro do existente) conflita",
      range: { startDate: "2024-01-08", endDate: "2024-01-15" },
      existing: [{ startDate: "2024-01-01", endDate: "2024-01-10" }],
      expected: true,
    },
    {
      name: "cruzamento (fim dentro do existente) conflita",
      range: { startDate: "2024-01-05", endDate: "2024-01-12" },
      existing: [{ startDate: "2024-01-10", endDate: "2024-01-20" }],
      expected: true,
    },
    {
      name: "períodos adjacentes não conflitam (fim + 1 dia)",
      range: { startDate: "2024-01-11", endDate: "2024-01-20" },
      existing: [{ startDate: "2024-01-01", endDate: "2024-01-10" }],
      expected: false,
    },
    {
      name: "períodos adjacentes não conflitam (início - 1 dia)",
      range: { startDate: "2024-01-01", endDate: "2024-01-09" },
      existing: [{ startDate: "2024-01-10", endDate: "2024-01-20" }],
      expected: false,
    },
    {
      name: "sem férias existentes não há conflito",
      range: { startDate: "2024-01-01", endDate: "2024-01-10" },
      existing: [],
      expected: false,
    },
    {
      name: "período totalmente anterior não conflita",
      range: { startDate: "2023-12-01", endDate: "2023-12-31" },
      existing: [{ startDate: "2024-01-01", endDate: "2024-01-10" }],
      expected: false,
    },
    {
      name: "período totalmente posterior não conflita",
      range: { startDate: "2024-02-01", endDate: "2024-02-10" },
      existing: [{ startDate: "2024-01-01", endDate: "2024-01-10" }],
      expected: false,
    },
    {
      name: "conflita com qualquer um dos períodos existentes",
      range: { startDate: "2024-03-05", endDate: "2024-03-07" },
      existing: [
        { startDate: "2024-01-01", endDate: "2024-01-10" },
        { startDate: "2024-03-01", endDate: "2024-03-04" },
        { startDate: "2024-03-06", endDate: "2024-03-09" },
      ],
      expected: true,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(hasVacationOverlap(c.range, c.existing)).toBe(c.expected);
    });
  }
});

describe("canApproveVacation", () => {
  const cases: Array<{
    name: string;
    params: {
      vacationDays: number;
      daysEarned: number;
      approvedDays: number;
      daysSold: number;
    };
    expected: boolean;
  }> = [
    {
      name: "saldo suficiente para as férias",
      params: {
        vacationDays: 30,
        daysEarned: 60,
        approvedDays: 0,
        daysSold: 0,
      },
      expected: true,
    },
    {
      name: "saldo exatamente no limite (zero restante) permite aprovar",
      params: {
        vacationDays: 30,
        daysEarned: 30,
        approvedDays: 0,
        daysSold: 0,
      },
      expected: true,
    },
    {
      name: "saldo insuficiente (falta 1 dia) não permite aprovar",
      params: {
        vacationDays: 31,
        daysEarned: 30,
        approvedDays: 0,
        daysSold: 0,
      },
      expected: false,
    },
    {
      name: "saldo insuficiente por férias já aprovadas",
      params: {
        vacationDays: 11,
        daysEarned: 30,
        approvedDays: 20,
        daysSold: 0,
      },
      expected: false,
    },
    {
      name: "saldo no limite considerando férias já aprovadas permite aprovar",
      params: {
        vacationDays: 10,
        daysEarned: 30,
        approvedDays: 20,
        daysSold: 0,
      },
      expected: true,
    },
    {
      name: "saldo insuficiente por dias vendidos",
      params: {
        vacationDays: 15,
        daysEarned: 30,
        approvedDays: 0,
        daysSold: 16,
      },
      expected: false,
    },
    {
      name: "dias vendidos consumindo exatamente o saldo permite aprovar",
      params: {
        vacationDays: 20,
        daysEarned: 30,
        approvedDays: 0,
        daysSold: 10,
      },
      expected: true,
    },
    {
      name: "saldo fracionário não cobre período inteiro",
      params: {
        vacationDays: 30,
        daysEarned: 29.9,
        approvedDays: 0,
        daysSold: 0,
      },
      expected: false,
    },
    {
      name: "saldo negativo (vendas + férias aprovadas) não permite aprovar",
      params: {
        vacationDays: 1,
        daysEarned: 10,
        approvedDays: 15,
        daysSold: 5,
      },
      expected: false,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(canApproveVacation(c.params)).toBe(c.expected);
    });
  }
});

describe("calculateVacationStats", () => {
  const approved = (startDate: string, endDate: string) => ({
    startDate,
    endDate,
    status: "approved" as const,
  });
  const pending = (startDate: string, endDate: string) => ({
    startDate,
    endDate,
    status: "pending" as const,
  });
  const rejected = (startDate: string, endDate: string) => ({
    startDate,
    endDate,
    status: "rejected" as const,
  });

  const cases: Array<{
    name: string;
    hireDate: string;
    vacations: Array<{
      startDate: string;
      endDate: string;
      status: "approved" | "pending" | "rejected";
    }>;
    soldDays: number;
    expectedBalance: number;
  }> = [
    {
      name: "admitido hoje, sem férias: saldo zero",
      hireDate: "2024-07-01",
      vacations: [],
      soldDays: 0,
      expectedBalance: 0,
    },
    {
      name: "sem férias: acúmulo proporcional de 6 meses",
      hireDate: "2024-01-01",
      vacations: [],
      soldDays: 0,
      expectedBalance: 14.948665,
    },
    {
      name: "sem férias: 1 ano de casa (saldo ≈ 30 dias)",
      hireDate: "2023-07-01",
      vacations: [],
      soldDays: 0,
      expectedBalance: 30.061602,
    },
    {
      name: "sem férias: 2 anos de casa (saldo ≈ 60 dias)",
      hireDate: "2022-07-01",
      vacations: [],
      soldDays: 0,
      expectedBalance: 60.041068,
    },
    {
      name: "férias aprovadas consomem o saldo (10 dias)",
      hireDate: "2024-01-01",
      vacations: [approved("2024-03-01", "2024-03-10")],
      soldDays: 0,
      expectedBalance: 4.948665,
    },
    {
      name: "férias aprovadas + dias vendidos consomem o saldo",
      hireDate: "2023-07-01",
      vacations: [approved("2023-08-01", "2023-08-15")],
      soldDays: 10,
      expectedBalance: 5.061602,
    },
    {
      name: "saldo negativo é limitado a zero",
      hireDate: "2024-01-01",
      vacations: [approved("2024-03-01", "2024-03-10")],
      soldDays: 5,
      expectedBalance: 0,
    },
    {
      name: "férias pendentes não consomem o saldo",
      hireDate: "2024-01-01",
      vacations: [pending("2024-03-01", "2024-03-10")],
      soldDays: 0,
      expectedBalance: 14.948665,
    },
    {
      name: "férias reprovadas não consomem o saldo",
      hireDate: "2024-01-01",
      vacations: [rejected("2024-03-01", "2024-03-10")],
      soldDays: 0,
      expectedBalance: 14.948665,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const stats = calculateVacationStats(
        c.hireDate,
        c.vacations,
        c.soldDays,
        TODAY,
      );
      expect(stats.vacationBalanceDays).toBeCloseTo(c.expectedBalance, 4);
      expect(stats.daysSold).toBe(c.soldDays);
    });
  }

  it("mantém a chave pública `daysUntilNextVacation` no retorno", () => {
    const stats = calculateVacationStats("2024-01-01", [], 0, TODAY);
    expect(stats).toHaveProperty("daysUntilNextVacation");
    expect(typeof stats.daysUntilNextVacation).toBe("number");
  });

  const accrualCases: Array<{
    name: string;
    hireDate: string;
    vacations: Array<{
      startDate: string;
      endDate: string;
      status: "approved" | "pending" | "rejected";
    }>;
    expectedDaysUntilNextAccrual: number;
  }> = [
    {
      name: "sem férias: dias até o próximo aniversário de admissão",
      hireDate: "2024-01-01",
      vacations: [],
      expectedDaysUntilNextAccrual: 184,
    },
    {
      name: "1 ano Completo: conta até o próximo aniversário",
      hireDate: "2023-07-01",
      vacations: [],
      expectedDaysUntilNextAccrual: 365,
    },
    {
      name: "com férias passadas: conta a partir do fim da última férias",
      hireDate: "2023-01-01",
      vacations: [approved("2024-06-25", "2024-06-30")],
      expectedDaysUntilNextAccrual: 364,
    },
  ];

  for (const c of accrualCases) {
    it(c.name, () => {
      const stats = calculateVacationStats(c.hireDate, c.vacations, 0, TODAY);
      // A chave pública continua `daysUntilNextVacation`, mas o valor
      // representa o próximo aniversário de acúmulo.
      expect(stats.daysUntilNextVacation).toBe(c.expectedDaysUntilNextAccrual);
    });
  }

  it("calcula a primeira elegibilidade (saldo de 30 dias ≈ 1 ano de casa)", () => {
    const stats = calculateVacationStats("2024-01-15", [], 0, TODAY);
    expect(stats.firstEligibilityDate).toBe("2025-01-15");
    expect(stats.eligibleForVacation).toBe(false);
  });

  it("considera elegível quem já completou 1 ano", () => {
    const stats = calculateVacationStats("2023-07-01", [], 0, TODAY);
    expect(stats.firstEligibilityDate).toBe("2024-07-01");
    expect(stats.eligibleForVacation).toBe(true);
  });

  it("indica férias em curso e a próxima férias apenas para aprovadas", () => {
    const stats = calculateVacationStats(
      "2023-01-01",
      [
        approved("2024-06-25", "2024-07-03"),
        approved("2024-08-01", "2024-08-10"),
        pending("2024-09-01", "2024-09-05"),
      ],
      0,
      TODAY,
    );
    expect(stats.isOnVacation).toBe(true);
    expect(stats.nextVacationStart).toBe("2024-08-01");
  });
});

describe("vacationDurationDays", () => {
  const cases: Array<{
    name: string;
    startDate: string;
    endDate: string;
    expected: number;
  }> = [
    {
      name: "mesmo dia = 1 dia",
      startDate: "2024-01-01",
      endDate: "2024-01-01",
      expected: 1,
    },
    {
      name: "10 dias inclusivos",
      startDate: "2024-01-01",
      endDate: "2024-01-10",
      expected: 10,
    },
    {
      name: "mês completo (2024-02)",
      startDate: "2024-02-01",
      endDate: "2024-02-29",
      expected: 29,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(vacationDurationDays(c.startDate, c.endDate)).toBe(c.expected);
    });
  }
});

describe("sumApprovedVacationDays", () => {
  it("soma apenas férias aprovadas, ignorando o pedido excluído", () => {
    const vacations = [
      { id: 1, startDate: "2024-01-01", endDate: "2024-01-10", status: "approved" as const },
      { id: 2, startDate: "2024-02-01", endDate: "2024-02-05", status: "approved" as const },
      { id: 3, startDate: "2024-03-01", endDate: "2024-03-10", status: "pending" as const },
    ];

    expect(sumApprovedVacationDays(vacations)).toBe(15);
    expect(sumApprovedVacationDays(vacations, 2)).toBe(10);
  });
});

describe("calculateAccruedDays", () => {
  const cases: Array<{
    name: string;
    hireDate: string;
    expected: number;
  }> = [
    {
      name: "admitido hoje não acumula nada",
      hireDate: "2024-07-01",
      expected: 0,
    },
    {
      name: "6 meses de casa acumulam ~15 dias (proporcional desde o dia 1)",
      hireDate: "2024-01-01",
      expected: 14.948665,
    },
    {
      name: "1 ano de casa acumula ~30 dias",
      hireDate: "2023-07-01",
      expected: 30.061602,
    },
    {
      name: "2 anos de casa acumulam ~60 dias",
      hireDate: "2022-07-01",
      expected: 60.041068,
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect(calculateAccruedDays(c.hireDate, TODAY)).toBeCloseTo(c.expected, 4);
    });
  }
});
