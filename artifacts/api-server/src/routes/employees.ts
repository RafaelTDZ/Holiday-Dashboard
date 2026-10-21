import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import {
  EmployeeModel,
  VacationModel,
  VacationSaleModel,
  UserModel,
  SessionModel,
  PasswordResetTokenModel,
} from "@workspace/db";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
} from "@workspace/api-zod";
import { calculateVacationStats, vacationDurationDays } from "../lib/vacation-utils";
import { getSessionId } from "../lib/auth";
import { validatePassword } from "../lib/password-policy";

const toDateStr = (d: Date | string): string => {
  if (typeof d === "string") {
    return d.split("T")[0];
  }
  return d.toISOString().split("T")[0];
};

const router: IRouter = Router();

function parseId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = parseInt(raw ?? "", 10);
  return Number.isNaN(id) ? null : id;
}

function serializeEmployee(employee: {
  id: number;
  name: string;
  role: string;
  department: string;
  hireDate: string;
  createdAt?: Date;
}) {
  return {
    id: employee.id,
    name: employee.name,
    role: employee.role,
    department: employee.department,
    hireDate: toDateStr(employee.hireDate),
    createdAt: employee.createdAt,
  };
}

function serializeSale(sale: {
  id: number;
  employeeId: number;
  daysSold: number;
  saleDate: string;
  notes?: string | null;
  createdAt?: Date;
}) {
  return {
    id: sale.id,
    employeeId: sale.employeeId,
    daysSold: sale.daysSold,
    saleDate: toDateStr(sale.saleDate),
    notes: sale.notes ?? null,
    createdAt: sale.createdAt,
  };
}

router.get("/employees", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const employees = await EmployeeModel.find().sort({ name: 1 }).lean();
  const allVacations = await VacationModel.find().lean();
  const allSales = await VacationSaleModel.find().lean();

  const vacationsByEmployee = new Map<number, typeof allVacations>();
  for (const v of allVacations) {
    const list = vacationsByEmployee.get(v.employeeId) ?? [];
    list.push(v);
    vacationsByEmployee.set(v.employeeId, list);
  }

  const soldByEmployee = new Map<number, number>();
  for (const s of allSales) {
    soldByEmployee.set(
      s.employeeId,
      (soldByEmployee.get(s.employeeId) ?? 0) + s.daysSold,
    );
  }

  const result = employees.map((emp) => {
    const vacations = vacationsByEmployee.get(emp.id) ?? [];
    const soldDays = soldByEmployee.get(emp.id) ?? 0;
    const stats = calculateVacationStats(emp.hireDate, vacations, soldDays);
    return {
      ...serializeEmployee(emp),
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
  if (!req.user!.isManager) {
    res.status(403).json({ error: "Apenas coordenadores podem criar funcionários." });
    return;
  }

  const parsed = CreateEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, ...employeeFields } = parsed.data;

  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await UserModel.findOne({ email: normalizedEmail });

  let userId: string;
  if (existingUser) {
    userId = String(existingUser._id);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await UserModel.create({
      email: normalizedEmail,
      passwordHash,
    });
    userId = String(newUser._id);
  }

  const employee = await EmployeeModel.create({
    ...employeeFields,
    hireDate: toDateStr(employeeFields.hireDate as Date | string),
    userId,
  });

  const vacations = await VacationModel.find({ employeeId: employee.id }).lean();
  const stats = calculateVacationStats(employee.hireDate, vacations, 0);

  res.status(201).json({
    ...serializeEmployee(employee),
    ...stats,
    vacations: [],
    vacationSales: [],
  });
});

router.get("/employees/:id", async (req: Request, res: Response): Promise<void> => {
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

  const sales = await VacationSaleModel.find({ employeeId: id })
    .sort({ saleDate: 1 })
    .lean();

  const soldDays = sales.reduce((acc, s) => acc + s.daysSold, 0);
  const stats = calculateVacationStats(emp.hireDate, vacations, soldDays);

  const vacationItems = vacations.map((v) => ({
    id: v.id,
    employeeId: v.employeeId,
    startDate: toDateStr(v.startDate),
    endDate: toDateStr(v.endDate),
    durationDays: vacationDurationDays(toDateStr(v.startDate), toDateStr(v.endDate)),
    notes: v.notes ?? null,
    status: v.status,
    createdAt: v.createdAt,
  }));

  res.json({
    ...serializeEmployee(emp),
    ...stats,
    vacations: vacationItems,
    vacationSales: sales.map(serializeSale),
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

  const id = parseId(req.params.id);
  if (id === null) {
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

  const emp = await EmployeeModel.findOneAndUpdate(
    { id },
    { $set: updateData },
    { new: true },
  ).lean();

  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  const vacations = await VacationModel.find({ employeeId: id })
    .sort({ startDate: 1 })
    .lean();

  const sales = await VacationSaleModel.find({ employeeId: id }).lean();

  const soldDays = sales.reduce((acc, s) => acc + s.daysSold, 0);
  const stats = calculateVacationStats(emp.hireDate, vacations, soldDays);

  const vacationItems = vacations.map((v) => ({
    id: v.id,
    employeeId: v.employeeId,
    startDate: toDateStr(v.startDate),
    endDate: toDateStr(v.endDate),
    durationDays: vacationDurationDays(toDateStr(v.startDate), toDateStr(v.endDate)),
    notes: v.notes ?? null,
    status: v.status,
    createdAt: v.createdAt,
  }));

  res.json({
    ...serializeEmployee(emp),
    ...stats,
    vacations: vacationItems,
    vacationSales: sales.map(serializeSale),
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

  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid employee ID" });
    return;
  }

  const emp = await EmployeeModel.findOneAndDelete({ id }).lean();

  if (!emp) {
    res.status(404).json({ error: "Employee not found" });
    return;
  }

  // Cascades that the relational schema used to handle
  const vacations = await VacationModel.find({ employeeId: id }).select("id").lean();
  const vacationIds = vacations.map((v) => v.id);
  await Promise.all([
    VacationModel.deleteMany({ employeeId: id }),
    VacationSaleModel.deleteMany({ employeeId: id }),
  ]);

  res.sendStatus(204);
});

// ── Change Password ───────────────────────────────────────────────────

router.put("/employees/:id/password", async (req: Request, res: Response): Promise<void> => {
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

  const isOwnProfile = emp.userId === req.user!.id;
  const isManager = req.user!.isManager;

  if (!isOwnProfile && !isManager) {
    res.status(403).json({ error: "Sem permissão para alterar a senha deste funcionário." });
    return;
  }

  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof newPassword !== "string") {
    res.status(400).json({ error: "A nova senha é obrigatória." });
    return;
  }

  const user = await UserModel.findById(emp.userId).lean();
  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  // A senha nova passa pela mesma política aplicada no cadastro e na
  // redefinição de senha (mínimo de 10 caracteres, 3 de 4 grupos de
  // caracteres e proibido usar o e-mail da conta).
  const newPasswordCheck = validatePassword(newPassword, user.email);
  if (!newPasswordCheck.valid) {
    res.status(400).json({ error: newPasswordCheck.message });
    return;
  }

  if (isOwnProfile) {
    if (typeof currentPassword !== "string" || currentPassword.length === 0) {
      res.status(400).json({ error: "A senha atual é obrigatória." });
      return;
    }
    const match = await bcrypt.compare(currentPassword, user.passwordHash ?? "");
    if (!match) {
      res.status(400).json({ error: "Senha atual incorreta." });
      return;
    }
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await UserModel.updateOne({ _id: user._id }, { $set: { passwordHash: newHash } });

  // The password changed: revoke every other session of this user. The current
  // session is kept so whoever changed their own password stays logged in.
  // `getSessionId` also resolves the `Authorization: Bearer <sid>` header, so
  // API/mobile clients keep their session as well.
  const currentSid = getSessionId(req);
  if (currentSid) {
    await SessionModel.deleteMany({
      "sess.user.id": String(user._id),
      sid: { $ne: currentSid },
    });
  } else {
    await SessionModel.deleteMany({ "sess.user.id": String(user._id) });
  }

  // Pending password-reset tokens of this user are no longer valid.
  await PasswordResetTokenModel.deleteMany({ userId: String(user._id) });

  res.json({ message: "Senha alterada com sucesso." });
});

// ── Vacation Sales ────────────────────────────────────────────────────

router.get("/employees/:id/vacation-sales", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = parseId(req.params.id);
  if (id === null) {
    res.status(400).json({ error: "Invalid employee ID" });
    return;
  }

  const sales = await VacationSaleModel.find({ employeeId: id })
    .sort({ saleDate: 1 })
    .lean();

  res.json({ vacationSales: sales.map(serializeSale) });
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
  const vacations = await VacationModel.find({ employeeId: id }).lean();
  const existingSales = await VacationSaleModel.find({ employeeId: id }).lean();
  const alreadySold = existingSales.reduce((acc, s) => acc + s.daysSold, 0);
  const stats = calculateVacationStats(emp.hireDate, vacations, alreadySold);

  if (daysSold > Math.floor(stats.vacationBalanceDays)) {
    res.status(400).json({
      error: `Saldo insuficiente. Saldo disponível: ${stats.vacationBalanceDays.toFixed(1)} dias.`,
    });
    return;
  }

  const sale = await VacationSaleModel.create({
    employeeId: id,
    daysSold,
    saleDate: toDateStr(saleDate),
    notes: notes ?? null,
  });

  res.status(201).json(serializeSale(sale));
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

  const saleId = parseId(req.params.saleId);
  if (saleId === null) {
    res.status(400).json({ error: "Invalid sale ID" });
    return;
  }

  const sale = await VacationSaleModel.findOneAndDelete({ id: saleId }).lean();

  if (!sale) {
    res.status(404).json({ error: "Venda não encontrada" });
    return;
  }

  res.sendStatus(204);
});

export default router;
