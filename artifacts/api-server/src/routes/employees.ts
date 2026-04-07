import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, employeesTable, vacationsTable, usersTable } from "@workspace/db";
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

  const vacationsByEmployee = new Map<number, typeof allVacations>();
  for (const v of allVacations) {
    const list = vacationsByEmployee.get(v.employeeId) ?? [];
    list.push(v);
    vacationsByEmployee.set(v.employeeId, list);
  }

  const result = employees.map((emp) => {
    const vacations = vacationsByEmployee.get(emp.id) ?? [];
    const stats = calculateVacationStats(emp.hireDate, vacations);
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
  const stats = calculateVacationStats(emp.hireDate, []);

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

  const stats = calculateVacationStats(emp.hireDate, vacations);

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

  const stats = calculateVacationStats(emp.hireDate, vacations);

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

export default router;
