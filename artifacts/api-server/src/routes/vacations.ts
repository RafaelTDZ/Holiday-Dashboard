import { Router, type IRouter, type Request, type Response } from "express";
import {
  EmployeeModel,
  VacationModel,
  UserModel,
  NotificationModel,
  VacationSaleModel,
} from "@workspace/db";
import { CreateVacationBody } from "@workspace/api-zod";
import {
  calculateAccruedDays,
  calculateVacationStats,
  canApproveVacation,
  hasVacationOverlap,
  sumApprovedVacationDays,
  vacationDurationDays,
} from "../lib/vacation-utils";

const router: IRouter = Router();

function parseId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = parseInt(raw ?? "", 10);
  return Number.isNaN(id) ? null : id;
}

/**
 * Authorization rule for deleting a vacation record.
 *
 * Pure function (no DB / request access) so it can be unit tested:
 * - managers (`isManager`) may delete any vacation;
 * - the employee who owns the vacation may delete their own;
 * - everyone else is denied.
 */
export function canDeleteVacation(params: {
  isManager: boolean;
  userId: string;
  ownerUserId: string | null | undefined;
}): boolean {
  if (params.isManager) {
    return true;
  }
  if (!params.ownerUserId) {
    return false;
  }
  return params.ownerUserId === params.userId;
}

function toDateStr(d: Date | string): string {
  if (typeof d === "string") {
    return d.split("T")[0];
  }
  return d.toISOString().split("T")[0];
}

/** Formata uma data `YYYY-MM-DD` no padrão brasileiro (dd/mm/aaaa). */
function formatDateBr(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) {
    return date;
  }
  return `${day}/${month}/${year}`;
}

function serializeVacation(vacation: {
  id: number;
  employeeId: number;
  startDate: string;
  endDate: string;
  notes?: string | null;
  status: string;
  createdAt?: Date;
}) {
  return {
    id: vacation.id,
    employeeId: vacation.employeeId,
    startDate: toDateStr(vacation.startDate),
    endDate: toDateStr(vacation.endDate),
    durationDays: vacationDurationDays(
      toDateStr(vacation.startDate),
      toDateStr(vacation.endDate),
    ),
    notes: vacation.notes ?? null,
    status: vacation.status,
    createdAt: vacation.createdAt,
  };
}

router.get("/vacations", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { status } = req.query;

  const filter = status ? { status: status as string } : {};

  const rows = await VacationModel.find(filter).sort({ startDate: 1 }).lean();

  const employees = await EmployeeModel.find().lean();
  const employeesById = new Map(employees.map((e) => [e.id, e]));

  res.json({
    vacations: rows.map((v) => ({
      ...serializeVacation(v),
      employeeName: employeesById.get(v.employeeId)?.name ?? null,
      employeeDepartment: employeesById.get(v.employeeId)?.department ?? null,
    })),
  });
});

router.get(
  "/employees/:id/vacations",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid employee ID" });
      return;
    }

    const emp = await EmployeeModel.findOne({ id }).lean();
    if (!emp) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    const vacations = await VacationModel.find({ employeeId: id })
      .sort({ startDate: 1 })
      .lean();

    const vacationItems = vacations.map((v) => ({
      id: v.id,
      employeeId: v.employeeId,
      startDate: toDateStr(v.startDate),
      endDate: toDateStr(v.endDate),
      durationDays: vacationDurationDays(
        toDateStr(v.startDate),
        toDateStr(v.endDate),
      ),
      notes: v.notes ?? null,
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

    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid employee ID" });
      return;
    }

    const emp = await EmployeeModel.findOne({ id }).lean();
    if (!emp) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    if (emp.userId !== req.user!.id) {
      res
        .status(403)
        .json({ error: "Você só pode agendar férias para si mesmo." });
      return;
    }

    const existingVacations = await VacationModel.find({
      employeeId: id,
    }).lean();
    const existingSales = await VacationSaleModel.find({
      employeeId: id,
    }).lean();
    const soldDays = existingSales.reduce((acc, s) => acc + s.daysSold, 0);

    const { vacationBalanceDays, firstEligibilityDate } =
      calculateVacationStats(emp.hireDate, existingVacations, soldDays);
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

    const startDate = toDateStr(startDateRaw as Date | string);
    const endDate = toDateStr(endDateRaw as Date | string);

    if (endDate < startDate) {
      res
        .status(400)
        .json({ error: "End date must be on or after start date" });
      return;
    }

    // BIZ-04 — sobreposição: o período pedido não pode cruzar nenhuma férias
    // pendente ou aprovada já existente do mesmo funcionário (comparação
    // inclusiva nas extremidades; períodos adjacentes são aceitos).
    const conflictingVacations = existingVacations.filter(
      (v) =>
        (v.status === "pending" || v.status === "approved") &&
        hasVacationOverlap({ startDate, endDate }, [v]),
    );

    if (conflictingVacations.length > 0) {
      const conflict = conflictingVacations[0];
      res.status(400).json({
        error: `O período solicitado conflita com outro pedido de férias já existente (${formatDateBr(conflict.startDate)} a ${formatDateBr(conflict.endDate)}). Escolha um período sem sobreposição.`,
      });
      return;
    }

    // BIZ-04 — duração: mínimo de 1 dia e cabimento no saldo disponível.
    const duration = vacationDurationDays(startDate, endDate);
    if (duration < 1) {
      res
        .status(400)
        .json({ error: "A duração mínima das férias é de 1 dia." });
      return;
    }

    const availableDays = Math.floor(vacationBalanceDays);
    if (duration > availableDays) {
      res.status(400).json({
        error: `Saldo insuficiente para solicitar férias. Saldo disponível: ${availableDays} dias.`,
      });
      return;
    }

    const vacation = await VacationModel.create({
      employeeId: id,
      startDate,
      endDate,
      notes: notes ?? null,
      status: "pending",
    });

    // Notify all coordinators
    try {
      const coordinators = await UserModel.find({ isManager: true })
        .select("_id")
        .lean();

      if (coordinators.length > 0) {
        const fmt = (d: string) =>
          new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
        const startFormatted = fmt(startDate);
        const endFormatted = fmt(endDate);
        const message = `${emp.name} solicitou férias de ${startFormatted} a ${endFormatted}.`;

        await NotificationModel.create(
          coordinators.map((c) => ({
            userId: String(c._id),
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

    res.status(201).json(serializeVacation(vacation));
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
      res.status(403).json({
        error: "Apenas coordenadores podem aprovar ou reprovar férias.",
      });
      return;
    }

    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid vacation ID" });
      return;
    }

    const { status } = req.body;
    if (status !== "approved" && status !== "rejected") {
      res
        .status(400)
        .json({ error: "Status deve ser 'approved' ou 'rejected'." });
      return;
    }

    const vacation = await VacationModel.findOne({ id }).lean();

    if (!vacation) {
      res.status(404).json({ error: "Vacation not found" });
      return;
    }

    const emp = await EmployeeModel.findOne({ id: vacation.employeeId }).lean();

    if (!emp) {
      res.status(404).json({ error: "Employee not found" });
      return;
    }

    // BIZ-05 — revalidação de saldo no momento da aprovação.
    // O pedido é recalculado "como se ainda não contasse": as férias já
    // aprovadas (exceto esta) + os dias vendidos precisam caber no saldo
    // acumulado. Reprovar não passa por validação de saldo.
    if (status === "approved") {
      const [employeeVacations, employeeSales] = await Promise.all([
        VacationModel.find({ employeeId: emp.id }).lean(),
        VacationSaleModel.find({ employeeId: emp.id }).lean(),
      ]);

      const daysSold = employeeSales.reduce((acc, s) => acc + s.daysSold, 0);
      const daysEarned = calculateAccruedDays(emp.hireDate);
      const approvedDays = sumApprovedVacationDays(
        employeeVacations,
        vacation.id,
      );
      const vacationDays = vacationDurationDays(
        vacation.startDate,
        vacation.endDate,
      );

      const canApprove = canApproveVacation({
        vacationDays,
        daysEarned,
        approvedDays,
        daysSold,
      });

      if (!canApprove) {
        const availableDays = Math.floor(
          Math.max(0, daysEarned - approvedDays - daysSold),
        );
        res.status(400).json({
          error: `Saldo insuficiente para aprovar estas férias. Saldo disponível: ${availableDays} dias, mas o período solicitado tem ${vacationDays} dias.`,
        });
        return;
      }
    }

    const updated = await VacationModel.findOneAndUpdate(
      { id },
      { $set: { status } },
      { new: true },
    ).lean();

    if (!updated) {
      res.status(404).json({ error: "Vacation not found" });
      return;
    }

    // Notify the employee about the approval/rejection
    try {
      if (emp.userId) {
        const fmt = (d: string) =>
          new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
        const statusLabel = status === "approved" ? "aprovadas" : "reprovadas";
        const message = `Suas férias de ${fmt(vacation.startDate)} a ${fmt(vacation.endDate)} foram ${statusLabel}.`;

        await NotificationModel.create({
          userId: emp.userId,
          message,
          vacationId: vacation.id,
          employeeId: emp.id,
        });
      }
    } catch (err) {
      // Notifications are best-effort — don't fail the request
      console.error("Failed to create employee notification:", err);
    }

    res.json(serializeVacation(updated));
  },
);

router.put(
  "/vacations/:id",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid vacation ID" });
      return;
    }

    const vacation = await VacationModel.findOne({ id }).lean();
    if (!vacation) {
      res.status(404).json({ error: "Vacation not found" });
      return;
    }

    if (vacation.status !== "pending") {
      res
        .status(403)
        .json({ error: "Só é possível editar férias com status Pendente." });
      return;
    }

    const emp = await EmployeeModel.findOne({ id: vacation.employeeId }).lean();
    if (!emp || emp.userId !== req.user!.id) {
      res
        .status(403)
        .json({ error: "Você só pode editar suas próprias férias." });
      return;
    }

    const {
      startDate: startDateRaw,
      endDate: endDateRaw,
      notes,
    } = req.body ?? {};
    if (!startDateRaw || !endDateRaw) {
      res
        .status(400)
        .json({ error: "Data de início e término são obrigatórias." });
      return;
    }

    const startDate = toDateStr(startDateRaw);
    const endDate = toDateStr(endDateRaw);

    if (endDate < startDate) {
      res
        .status(400)
        .json({ error: "A data de término deve ser após o início." });
      return;
    }

    // The edited period must not overlap the other pending/approved vacations
    // of this employee (the vacation being edited is excluded).
    const otherVacations = await VacationModel.find({
      employeeId: vacation.employeeId,
      id: { $ne: id },
      status: { $in: ["pending", "approved"] },
    }).lean();

    const conflicting = otherVacations.filter((v) =>
      hasVacationOverlap({ startDate, endDate }, [v]),
    );

    if (conflicting.length > 0) {
      res.status(400).json({
        error: `O período solicitado conflita com outro pedido de férias já existente (${formatDateBr(conflicting[0].startDate)} a ${formatDateBr(conflicting[0].endDate)}). Escolha um período sem sobreposição.`,
      });
      return;
    }

    const updated = await VacationModel.findOneAndUpdate(
      { id },
      { $set: { startDate, endDate, notes: notes ?? null } },
      { new: true },
    ).lean();

    res.json(serializeVacation(updated!));
  },
);

router.delete(
  "/vacations/:id",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid vacation ID" });
      return;
    }

    const vacation = await VacationModel.findOne({ id }).lean();

    if (!vacation) {
      res.status(404).json({ error: "Vacation not found" });
      return;
    }

    // The owner of the vacation is the employee linked to the authenticated
    // user. Managers may delete any vacation; employees only their own.
    const employee = await EmployeeModel.findOne({
      id: vacation.employeeId,
    }).lean();

    const allowed = canDeleteVacation({
      isManager: req.user!.isManager,
      userId: req.user!.id,
      ownerUserId: employee?.userId,
    });
    if (!allowed) {
      res
        .status(403)
        .json({ error: "Sem permissão para excluir estas férias." });
      return;
    }

    await VacationModel.deleteOne({ id });

    res.sendStatus(204);
  },
);

export default router;
