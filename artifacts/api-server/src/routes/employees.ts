import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import {
  EmployeeModel,
  VacationModel,
  VacationSaleModel,
  NotificationModel,
  UserModel,
  SessionModel,
  PasswordResetTokenModel,
  type Employee,
} from "@workspace/db";
import {
  CreateEmployeeBody,
  UpdateEmployeeBody,
} from "@workspace/api-zod";
import { calculateVacationStats, vacationDurationDays } from "../lib/vacation-utils";
import { validateSaleDays } from "../lib/vacation-sale-policy";
import { getSessionId } from "../lib/auth";
import { validatePassword } from "../lib/password-policy";
import { isDuplicateKeyError } from "../lib/db-errors";

/**
 * Funcionário lido do banco (documento "lean" ou documento criado), com o
 * `_id` do MongoDB. É o tipo usado quando o resultado da consulta precisa
 * ser atribuído a uma variável declarada fora do `try`.
 */
type EmployeeRecord = Employee & { _id: unknown };

/**
 * Mensagem devolvida quando o vínculo usuário ↔ funcionário já existe (BIZ-07).
 * O índice único de `employees.userId` garante a mesma regra no banco.
 */
const EMPLOYEE_USER_ALREADY_LINKED_MESSAGE =
  "Este usuário já está vinculado a outro funcionário. Cada usuário pode estar vinculado a apenas um funcionário.";

/**
 * Identifica o erro de chave duplicada do MongoDB (código 11000), que é o
 * que o índice único de `employees.userId` dispara quando o vínculo já
 * existe (BIZ-07).
 */

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

    // The user ↔ employee relation is 1:1 (BIZ-07): reusing an account that
    // is already linked to another employee is rejected instead of creating
    // an ambiguous link (the `/me/employee` route would pick one of them).
    const linkedEmployee = await EmployeeModel.findOne({ userId }).lean();
    if (linkedEmployee) {
      res.status(409).json({ error: EMPLOYEE_USER_ALREADY_LINKED_MESSAGE });
      return;
    }
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = await UserModel.create({
      email: normalizedEmail,
      passwordHash,
    });
    userId = String(newUser._id);
  }

  let employee: EmployeeRecord;
  try {
    employee = await EmployeeModel.create({
      ...employeeFields,
      hireDate: toDateStr(employeeFields.hireDate as Date | string),
      userId,
    });
  } catch (err) {
    // The unique index of `employees.userId` is the last line of defense:
    // it also covers the race between the check above and this insert.
    if (isDuplicateKeyError(err)) {
      res.status(409).json({ error: EMPLOYEE_USER_ALREADY_LINKED_MESSAGE });
      return;
    }
    throw err;
  }

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

  let emp: EmployeeRecord | null;
  try {
    emp = await EmployeeModel.findOneAndUpdate(
      { id },
      { $set: updateData },
      { new: true },
    ).lean();
  } catch (err) {
    // The unique index of `employees.userId` (BIZ-07) rejects an update that
    // would link the same user to two employees.
    if (isDuplicateKeyError(err)) {
      res.status(409).json({ error: EMPLOYEE_USER_ALREADY_LINKED_MESSAGE });
      return;
    }
    throw err;
  }

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
  //
  // The notifications are stored by `userId` (the user of the employee), so
  // they are removed together with the account of the employee (BIZ-06). An
  // employee created by a manager without an account has no `userId`: in that
  // case only the notifications linked by `employeeId` are removed.
  const employeeUserId =
    typeof emp.userId === "string" && emp.userId.length > 0 ? emp.userId : null;

  await Promise.all([
    VacationModel.deleteMany({ employeeId: id }),
    VacationSaleModel.deleteMany({ employeeId: id }),
    NotificationModel.deleteMany({ employeeId: id }),
    ...(employeeUserId
      ? [NotificationModel.deleteMany({ userId: String(employeeUserId) })]
      : []),
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

  // An employee created by a manager may not have an account at all: in that
  // case there is no password to change (and no user to look up).
  if (!emp.userId) {
    res.status(404).json({ error: "Usuário não encontrado." });
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

  // BIZ-01 — venda de dias: no máximo o saldo disponível e 1/3 do período
  // aquisitivo (10 de 30 dias) por operação. O limite da operação é
  // verificado antes do saldo; a mensagem de saldo insuficiente continua a
  // mesma de sempre.
  const saleCheck = validateSaleDays({
    daysSold,
    balanceDays: stats.vacationBalanceDays,
  });

  if (!saleCheck.valid) {
    res.status(400).json({ error: saleCheck.message });
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
