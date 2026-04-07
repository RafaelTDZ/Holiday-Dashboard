import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sum } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, employeesTable, vacationsTable, usersTable, vacationSalesTable } from "@workspace/db";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
} from "@workspace/api-zod";
import { calculateVacationStats, vacationDurationDays } from "../lib/vacation-utils";

const toDateStr = (d: Date | string): string => {
  if (typeof d === "string") return d;
  return d.toISOString().split("T")[0];
};

const router: IRouter = Router();

router.get("/employees", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const employees = await db.select().from(employeesTable).orderBy(employeesTable.name);
  const allVacations = await db.select().from(vacationsTable);
  const allSales = await db.select().from(vacationSalesTable);

  const vacationsByEmployee = new Map<number, typeof allVacations>();
  for (const v of allVacations) {
    const list = vacationsByEmployee.get(v.employeeId) ?? [];
    list.push(v);
    vacationsByEmployee.set(v.employeeId, list);
  }

  const soldByEmployee = new Map<number, number>();
  for (const s of allSales) {
    soldByEmployee.set(s.employeeId, (soldByEmployee.get(s.employeeId) ?? 0) + s.daysSold);
  }

  const result = employees.map((emp) => {
    const vacations = vacationsByEmployee.get(emp.id) ?? [];
    const soldDays = soldByEmployee.get(emp.id) ?? 0;
    const stats = calculateVacationStats(emp.hireDate, vacations, soldDays);
    return {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      hireDate: emp.hireDate,
      createdAt: emp.createdAt,
      ...stats,
    };
  });

  res.json({ employees: result });
});

router.post("/employees", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, ...employeeFields } = parsed.data;

  const normalizedEmail = email.toLowerCase().trim();
  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, normalizedEmail));

  let userId: string;
  if (existingUser) {
    userId = existingUser.id;
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const [newUser] = await db.insert(usersTable).values({
      email: normalizedEmail,
      passwordHash,
    }).returning();
    userId = newUser.id;
  }

  const insertData = {
    ...employeeFields,
    hireDate: toDateStr(employeeFields.hireDate as Date | string),
    userId,
  };
  const [emp] = await db.insert(employeesTable).values(insertData).returning();
  const stats = calculateVacationStats(emp.hireDate, [], 0);

  res.status(201).json({
    ...emp,
    ...stats,
    vacations: [],
  });
});

router.get("/employees/:id", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid employee ID" });
    return;
  }

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const vacations = await db
    .select()
    .from(vacationsTable)
    .where(eq(vacationsTable.employeeId, id))
    .orderBy(vacationsTable.startDate);

  const sales = await db
    .select()
    .from(vacationSalesTable)
    .where(eq(vacationSalesTable.employeeId, id))
    .orderBy(vacationSalesTable.saleDate);

  const soldDays = sales.reduce((acc, s) => acc + s.daysSold, 0);
  const stats = calculateVacationStats(emp.hireDate, vacations, soldDays);

  const vacationItems = vacations.map((v) => ({
    id: v.id,
    employeeId: v.employeeId,
    startDate: v.startDate,
    endDate: v.endDate,
    durationDays: vacationDurationDays(v.startDate, v.endDate),
    notes: v.notes,
    status: v.status,
    createdAt: v.createdAt,
  }));

  res.json({
    ...emp,
    ...stats,
    vacations: vacationItems,
    vacationSales: sales,
  });
});

router.put("/employees/:id", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!req.user!.isManager) {
    res.status(403).json({ error: "Apenas coordenadores podem editar funcionários." });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid employee ID" });
    return;
  }

  const parsed = UpdateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: {
    name?: string;
    role?: string;
    department?: string;
    hireDate?: string;
  } = {
    ...(parsed.data.name !== undefined && { name: parsed.data.name }),
    ...(parsed.data.role !== undefined && { role: parsed.data.role }),
    ...(parsed.data.department !== undefined && { department: parsed.data.department }),
    ...(parsed.data.hireDate !== undefined && {
      hireDate: toDateStr(parsed.data.hireDate as Date | string),
    }),
  };
  const [emp] = await db
    .update(employeesTable)
    .set(updateData)
    .where(eq(employeesTable.id, id))
    .returning();

  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const vacations = await db
    .select()
    .from(vacationsTable)
    .where(eq(vacationsTable.employeeId, id))
    .orderBy(vacationsTable.startDate);

  const sales = await db
    .select()
    .from(vacationSalesTable)
    .where(eq(vacationSalesTable.employeeId, id));

  const soldDays = sales.reduce((acc, s) => acc + s.daysSold, 0);
  const stats = calculateVacationStats(emp.hireDate, vacations, soldDays);

  const vacationItems = vacations.map((v) => ({
    id: v.id,
    employeeId: v.employeeId,
    startDate: v.startDate,
    endDate: v.endDate,
    durationDays: vacationDurationDays(v.startDate, v.endDate),
    notes: v.notes,
    status: v.status,
    createdAt: v.createdAt,
  }));

  res.json({
    ...emp,
    ...stats,
    vacations: vacationItems,
    vacationSales: sales,
  });
});

router.delete("/employees/:id", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!req.user!.isManager) {
    res.status(403).json({ error: "Apenas coordenadores podem excluir funcionários." });
    return;
  }

  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid employee ID" });
    return;
  }

  const [emp] = await db
    .delete(employeesTable)
    .where(eq(employeesTable.id, id))
    .returning();

  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  res.sendStatus(204);
});

// ── Vacation Sales ────────────────────────────────────────────────────

router.get("/employees/:id/vacation-sales", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid employee ID" });
    return;
  }

  const sales = await db
    .select()
    .from(vacationSalesTable)
    .where(eq(vacationSalesTable.employeeId, id))
    .orderBy(vacationSalesTable.saleDate);

  res.json({ vacationSales: sales });
});

router.post("/employees/:id/vacation-sales", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!req.user!.isManager) {
    res.status(403).json({ error: "Apenas coordenadores podem registrar venda de dias." });
    return;
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid employee ID" });
    return;
  }

  const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, id));
  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const { daysSold, saleDate, notes } = req.body ?? {};
  if (!daysSold || typeof daysSold !== "number" || daysSold <= 0 || !Number.isInteger(daysSold)) {
    res.status(400).json({ error: "Número de dias inválido. Deve ser um inteiro positivo." });
    return;
  }
  if (!saleDate || typeof saleDate !== "string") {
    res.status(400).json({ error: "Data da venda é obrigatória." });
    return;
  }

  // Guard: can't sell more than current balance
  const vacations = await db.select().from(vacationsTable).where(eq(vacationsTable.employeeId, id));
  const existingSales = await db.select().from(vacationSalesTable).where(eq(vacationSalesTable.employeeId, id));
  const alreadySold = existingSales.reduce((acc, s) => acc + s.daysSold, 0);
  const stats = calculateVacationStats(emp.hireDate, vacations, alreadySold);

  if (daysSold > Math.floor(stats.vacationBalanceDays)) {
    res.status(400).json({
      error: `Saldo insuficiente. Saldo disponível: ${stats.vacationBalanceDays.toFixed(1)} dias.`,
    });
    return;
  }

  const [sale] = await db
    .insert(vacationSalesTable)
    .values({ employeeId: id, daysSold, saleDate, notes: notes ?? null })
    .returning();

  res.status(201).json(sale);
});

router.delete("/employees/:id/vacation-sales/:saleId", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!req.user!.isManager) {
    res.status(403).json({ error: "Apenas coordenadores podem excluir registros de venda." });
    return;
  }

  const saleId = parseInt(req.params.saleId, 10);
  if (isNaN(saleId)) {
    res.status(400).json({ error: "Invalid sale ID" });
    return;
  }

  const [sale] = await db
    .delete(vacationSalesTable)
    .where(eq(vacationSalesTable.id, saleId))
    .returning();

  if (!sale) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }

  res.sendStatus(204);
});

export default router;
