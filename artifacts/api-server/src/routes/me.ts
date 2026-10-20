import { Router, type IRouter, type Request, type Response } from "express";
import { EmployeeModel, VacationModel } from "@workspace/db";
import { RegisterAsEmployeeBody } from "@workspace/api-zod";
import { calculateVacationStats } from "../lib/vacation-utils";

const toDateStr = (d: Date | string): string => {
  if (typeof d === "string") {
    return d.split("T")[0];
  }
  return d.toISOString().split("T")[0];
};

const router: IRouter = Router();

router.get("/me/employee", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user!.id;
  const emp = await EmployeeModel.findOne({ userId }).lean();

  if (!emp) {
    res.json({ employee: null });
    return;
  }

  const vacations = await VacationModel.find({ employeeId: emp.id }).lean();

  const stats = calculateVacationStats(emp.hireDate, vacations);
  res.json({
    employee: {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      hireDate: toDateStr(emp.hireDate),
      createdAt: emp.createdAt,
      ...stats,
    },
  });
});

router.post("/me/employee", async (req: Request, res: Response): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user!.id;

  const existing = await EmployeeModel.findOne({ userId }).lean();

  if (existing) {
    res.status(400).json({ error: "Usuário já está cadastrado como funcionário." });
    return;
  }

  const parsed = RegisterAsEmployeeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dados inválidos.", details: parsed.error.issues });
    return;
  }

  const { name, role, department, hireDate } = parsed.data;

  const emp = await EmployeeModel.create({
    name,
    role,
    department,
    hireDate: toDateStr(hireDate as unknown as Date | string),
    userId,
  });

  const stats = calculateVacationStats(emp.hireDate, []);
  res.status(201).json({
    employee: {
      id: emp.id,
      name: emp.name,
      role: emp.role,
      department: emp.department,
      hireDate: toDateStr(emp.hireDate),
      createdAt: emp.createdAt,
      ...stats,
    },
  });
});

export default router;
