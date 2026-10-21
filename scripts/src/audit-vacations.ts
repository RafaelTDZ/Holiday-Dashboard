/**
 * Audits the vacation data before/after the stricter business rules.
 *
 * It answers two questions that the API now assumes to be true:
 *
 * 1. Is every employee linked to at most one user? The unique index on
 *    `employees.userId` can only be created when there are no duplicates (and
 *    no two employees with an explicit `userId: null`).
 * 2. Is any employee already over their vacation balance? A negative balance
 *    blocks the approval of any new vacation request (BIZ-05).
 *
 * Usage:
 *   MONGODB_URI="mongodb://..." pnpm --filter @workspace/scripts run audit:vacations
 */
import { connectDb, disconnectDb, EmployeeModel, VacationModel, VacationSaleModel } from "@workspace/db";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function durationDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

function accruedDays(hireDate: string, today: Date): number {
  const hire = new Date(`${hireDate}T00:00:00Z`).getTime();
  const daysWorked = Math.max(0, Math.round((today.getTime() - hire) / MS_PER_DAY));
  return (daysWorked / 365.25) * 30;
}

async function main() {
  await connectDb();

  const employees = await EmployeeModel.find({}).lean();
  const vacations = await VacationModel.find({}).lean();
  const sales = await VacationSaleModel.find({}).lean();
  const today = new Date();

  let problems = 0;

  console.log("1) Usuários vinculados a mais de um funcionário (quebra o índice único):");
  const byUser = new Map<string, number[]>();
  for (const emp of employees) {
    if (!emp.userId) continue;
    const list = byUser.get(emp.userId) ?? [];
    list.push(emp.id);
    byUser.set(emp.userId, list);
  }
  for (const [userId, ids] of byUser) {
    if (ids.length > 1) {
      problems += 1;
      console.log(`   PROBLEMA: userId ${userId} está em ${ids.length} funcionários: ${ids.join(", ")}`);
    }
  }
  if (problems === 0) console.log("   OK: nenhum usuário duplicado.");

  const nullUserIds = employees.filter((e) => e.userId === null);
  if (nullUserIds.length > 1) {
    problems += 1;
    console.log(
      `   PROBLEMA: ${nullUserIds.length} funcionários com userId: null explícito (o índice único sparse não aceita). IDs: ${nullUserIds.map((e) => e.id).join(", ")}`,
    );
  }

  console.log("\n2) Saldo de férias negativo (bloqueia a aprovação de novos pedidos):");
  let negative = 0;
  for (const emp of employees) {
    const earned = accruedDays(emp.hireDate, today);
    const approved = vacations
      .filter((v) => v.employeeId === emp.id && v.status === "approved")
      .reduce((acc, v) => acc + durationDays(v.startDate, v.endDate), 0);
    const sold = sales
      .filter((s) => s.employeeId === emp.id)
      .reduce((acc, s) => acc + s.daysSold, 0);
    const balance = earned - approved - sold;
    if (balance < 0) {
      negative += 1;
      problems += 1;
      console.log(
        `   PROBLEMA: ${emp.name} (id ${emp.id}) — saldo ${balance.toFixed(1)} dias (acumulado ${earned.toFixed(1)}, aprovado ${approved}, vendido ${sold})`,
      );
    }
  }
  if (negative === 0) console.log("   OK: nenhum saldo negativo.");

  console.log("\n3) Pedidos pendentes que se sobrepõem (bloqueiam novos pedidos no mesmo período):");
  let overlaps = 0;
  for (const emp of employees) {
    const pending = vacations.filter((v) => v.employeeId === emp.id && v.status === "pending");
    for (let i = 0; i < pending.length; i += 1) {
      for (let j = i + 1; j < pending.length; j += 1) {
        const a = pending[i];
        const b = pending[j];
        if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
          overlaps += 1;
          problems += 1;
          console.log(
            `   PROBLEMA: ${emp.name} — pedido #${a.id} (${a.startDate} a ${a.endDate}) cruza com #${b.id} (${b.startDate} a ${b.endDate})`,
          );
        }
      }
    }
  }
  if (overlaps === 0) console.log("   OK: nenhuma sobreposição.");

  console.log(
    problems === 0
      ? "\nTudo consistente: as regras mais estritas podem ser aplicadas sem bloqueios."
      : `\n${problems} problema(s) encontrados. Resolva antes de aprovar novos pedidos.`,
  );
}

main()
  .then(async () => {
    await disconnectDb();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await disconnectDb();
    process.exit(1);
  });
