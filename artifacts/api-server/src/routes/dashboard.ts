import { Router, type IRouter, type Request, type Response } from "express";
import { db, employeesTable, vacationsTable } from "@workspace/db";
import { calculateVacationStats, vacationDurationDays } from "../lib/vacation-utils";

const router: IRouter = Router();

router.get(
  "/dashboard/summary",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const employees = await db.select().from(employeesTable);
    const allVacations = await db.select().from(vacationsTable);

    const today = new Date();
    const todayStr = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    )
      .toISOString()
      .split("T")[0];

    const vacationsByEmployee = new Map<number, typeof allVacations>();
    for (const v of allVacations) {
      const list = vacationsByEmployee.get(v.employeeId) ?? [];
      list.push(v);
      vacationsByEmployee.set(v.employeeId, list);
    }

    let onVacationToday = 0;
    let overdueVacations = 0;
    const departmentMap = new Map<string, { count: number; onVacation: number }>();
    const upcomingVacations: {
      employeeId: number;
      employeeName: string;
      department: string;
      startDate: string;
      endDate: string;
      durationDays: number;
    }[] = [];

    for (const emp of employees) {
      const vacations = vacationsByEmployee.get(emp.id) ?? [];
      const stats = calculateVacationStats(emp.hireDate, vacations);

      const dept = departmentMap.get(emp.department) ?? { count: 0, onVacation: 0 };
      dept.count++;

      if (stats.isOnVacation) {
        onVacationToday++;
        dept.onVacation++;
      }

      departmentMap.set(emp.department, dept);

      if (stats.vacationBalanceDays >= 30 && !stats.nextVacationStart) {
        overdueVacations++;
      }

      for (const v of vacations) {
        if (v.startDate > todayStr) {
          upcomingVacations.push({
            employeeId: emp.id,
            employeeName: emp.name,
            department: emp.department,
            startDate: v.startDate,
            endDate: v.endDate,
            durationDays: vacationDurationDays(v.startDate, v.endDate),
          });
        }
      }
    }

    upcomingVacations.sort((a, b) => a.startDate.localeCompare(b.startDate));
    const upcomingSlice = upcomingVacations.slice(0, 10);

    const departmentBreakdown = Array.from(departmentMap.entries()).map(
      ([department, data]) => ({
        department,
        count: data.count,
        onVacation: data.onVacation,
      }),
    );

    res.json({
      totalEmployees: employees.length,
      onVacationToday,
      upcomingVacations: upcomingSlice,
      overdueVacations,
      departmentBreakdown,
    });
  },
);

export default router;
