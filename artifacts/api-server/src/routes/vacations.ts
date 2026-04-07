import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, vacationsTable, employeesTable, usersTable, notificationsTable } from "@workspace/db";
import { CreateVacationBody } from "@workspace/api-zod";
import { vacationDurationDays, calculateVacationStats } from "../lib/vacation-utils";

const router: IRouter = Router();

router.get(
  "/vacations",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { status } = req.query;

    const rows = await db
      .select({
        id: vacationsTable.id,
        employeeId: vacationsTable.employeeId,
        employeeName: employeesTable.name,
        employeeDepartment: employeesTable.department,
        startDate: vacationsTable.startDate,
        endDate: vacationsTable.endDate,
        notes: vacationsTable.notes,
        status: vacationsTable.status,
        createdAt: vacationsTable.createdAt,
      })
      .from(vacationsTable)
      .leftJoin(employeesTable, eq(vacationsTable.employeeId, employeesTable.id))
      .where(status ? eq(vacationsTable.status, status as string) : undefined)
      .orderBy(vacationsTable.startDate);

    res.json({
      vacations: rows.map((v) => ({
        ...v,
        durationDays: vacationDurationDays(v.startDate, v.endDate),
      })),
    });
  },
);

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

    const { vacationBalanceDays, firstEligibilityDate } = calculateVacationStats(emp.hireDate, []);
    if (vacationBalanceDays < 30) {
      res.status(403).json({
        error: `Saldo insuficiente para solicitar férias. Férias disponíveis a partir de ${firstEligibilityDate}.`,
      });
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

    // Notify all coordinators
    try {
      const coordinators = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.isManager, true));

      if (coordinators.length > 0) {
        const fmt = (d: string) =>
          new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
        const startFormatted = fmt(startDate);
        const endFormatted = fmt(endDate);
        const message = `${emp.name} solicitou férias de ${startFormatted} a ${endFormatted}.`;

        await db.insert(notificationsTable).values(
          coordinators.map((c) => ({
            userId: c.id,
            message,
            vacationId: vacation.id,
            employeeId: emp.id,
          })),
        );
      }
    } catch (err) {
      // Notifications are best-effort — don't fail the request
      console.error("Failed to create coordinator notifications:", err);
    }

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

router.put(
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

    const [vacation] = await db.select().from(vacationsTable).where(eq(vacationsTable.id, id));
    if (!vacation) {
      res.status(404).json({ error: "Vacation not found" });
      return;
    }

    if (vacation.status !== "pending") {
      res.status(403).json({ error: "Só é possível editar férias com status Pendente." });
      return;
    }

    const [emp] = await db.select().from(employeesTable).where(eq(employeesTable.id, vacation.employeeId));
    if (!emp || emp.userId !== req.user!.id) {
      res.status(403).json({ error: "Você só pode editar suas próprias férias." });
      return;
    }

    const { startDate: startDateRaw, endDate: endDateRaw, notes } = req.body ?? {};
    if (!startDateRaw || !endDateRaw) {
      res.status(400).json({ error: "Data de início e término são obrigatórias." });
      return;
    }

    const toDateStr = (d: string) => d.split("T")[0];
    const startDate = toDateStr(startDateRaw);
    const endDate = toDateStr(endDateRaw);

    if (endDate < startDate) {
      res.status(400).json({ error: "A data de término deve ser após o início." });
      return;
    }

    const [updated] = await db
      .update(vacationsTable)
      .set({ startDate, endDate, notes: notes ?? null })
      .where(eq(vacationsTable.id, id))
      .returning();

    res.json({
      id: updated.id,
      employeeId: updated.employeeId,
      startDate: updated.startDate,
      endDate: updated.endDate,
      durationDays: vacationDurationDays(updated.startDate, updated.endDate),
      notes: updated.notes,
      status: updated.status,
      createdAt: updated.createdAt,
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
