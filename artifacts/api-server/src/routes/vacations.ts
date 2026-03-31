import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, vacationsTable, employeesTable } from "@workspace/db";
import { CreateVacationBody } from "@workspace/api-zod";
import { vacationDurationDays } from "../lib/vacation-utils";

const router: IRouter = Router();

router.get(
  "/employees/:id/vacations",
  async (req: Request, res: Response): Promise<void> => {
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

    const vacations = await db
      .select()
      .from(vacationsTable)
      .where(eq(vacationsTable.employeeId, id))
      .orderBy(vacationsTable.startDate);

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

    res.json({ vacations: vacationItems });
  },
);

router.post(
  "/employees/:id/vacations",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const employeeId = parseInt(rawId, 10);
    if (isNaN(employeeId)) {
      res.status(400).json({ error: "Invalid employee ID" });
      return;
    }

    const [emp] = await db
      .select()
      .from(employeesTable)
      .where(eq(employeesTable.id, employeeId));
    if (!emp) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    if (emp.userId !== req.user!.id) {
      res.status(403).json({ error: "Você só pode agendar férias para si mesmo." });
      return;
    }

    const parsed = CreateVacationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { startDate: startDateRaw, endDate: endDateRaw, notes } = parsed.data;

    const toDateStr = (d: Date | string): string => {
      if (typeof d === "string") return d;
      return d.toISOString().split("T")[0];
    };

    const startDate = toDateStr(startDateRaw as Date | string);
    const endDate = toDateStr(endDateRaw as Date | string);

    if (endDate < startDate) {
      res.status(400).json({ error: "End date must be on or after start date" });
      return;
    }

    const [vacation] = await db
      .insert(vacationsTable)
      .values({ employeeId, startDate, endDate, notes: notes ?? null, status: "pending" })
      .returning();

    res.status(201).json({
      id: vacation.id,
      employeeId: vacation.employeeId,
      startDate: vacation.startDate,
      endDate: vacation.endDate,
      durationDays: vacationDurationDays(vacation.startDate, vacation.endDate),
      notes: vacation.notes,
      status: vacation.status,
      createdAt: vacation.createdAt,
    });
  },
);

router.put(
  "/vacations/:id/status",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!req.user!.isManager) {
      res.status(403).json({ error: "Apenas coordenadores podem aprovar ou reprovar férias." });
      return;
    }

    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid vacation ID" });
      return;
    }

    const { status } = req.body;
    if (status !== "approved" && status !== "rejected") {
      res.status(400).json({ error: "Status deve ser 'approved' ou 'rejected'." });
      return;
    }

    const [vacation] = await db
      .update(vacationsTable)
      .set({ status })
      .where(eq(vacationsTable.id, id))
      .returning();

    if (!vacation) {
      res.status(404).json({ error: "Vacation not found" });
      return;
    }

    res.json({
      id: vacation.id,
      employeeId: vacation.employeeId,
      startDate: vacation.startDate,
      endDate: vacation.endDate,
      durationDays: vacationDurationDays(vacation.startDate, vacation.endDate),
      notes: vacation.notes,
      status: vacation.status,
      createdAt: vacation.createdAt,
    });
  },
);

router.delete(
  "/vacations/:id",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid vacation ID" });
      return;
    }

    const [vacation] = await db
      .delete(vacationsTable)
      .where(eq(vacationsTable.id, id))
      .returning();

    if (!vacation) {
      res.status(404).json({ error: "Vacation not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
