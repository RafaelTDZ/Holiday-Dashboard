/**
 * Demo dataset used by the Dashboard de Férias.
 *
 * The function is idempotent: running it again updates the existing documents
 * instead of duplicating them. Passwords of users that already have one are
 * preserved (so the account created from `ADMIN_EMAIL`/`ADMIN_PASSWORD` keeps
 * its own password).
 */
import bcrypt from "bcryptjs";
import {
  EmployeeModel,
  UserModel,
  VacationModel,
  VacationSaleModel,
  NotificationModel,
  CounterModel,
} from "./index";

/**
 * Password used by the demo accounts. It satisfies the password policy
 * enforced by the API (10 characters, 3 of 4 character groups).
 */
export const DEMO_PASSWORD = "Férias@2026";

const employees = [
  {
    name: "Admin Teste",
    role: "Coordenador",
    department: "RH",
    hireDate: "2020-01-15",
    email: "admin@tdztrading.com.br",
    isManager: true,
  },
  {
    name: "Coordenador Geral",
    role: "Coordenador",
    department: "RH",
    hireDate: "2023-01-15",
    email: "coord@tdztrading.com.br",
    isManager: true,
  },
  {
    name: "João Silva",
    role: "Analista",
    department: "Comercial",
    hireDate: "2024-03-10",
    email: "joao@tdztrading.com.br",
    isManager: false,
  },
  {
    name: "Maria Santos",
    role: "Designer",
    department: "Operacional",
    hireDate: "2024-06-01",
    email: "maria@tdztrading.com.br",
    isManager: false,
  },
  {
    name: "Pedro Oliveira",
    role: "Desenvolvedor",
    department: "Financeiro",
    hireDate: "2024-09-20",
    email: "pedro@tdztrading.com.br",
    isManager: false,
  },
];

export interface SeedOptions {
  /** Password used for the demo accounts that do not have one yet. */
  password?: string;
}

export async function seedDemoData(options: SeedOptions = {}): Promise<void> {
  const password = options.password ?? DEMO_PASSWORD;
  const passwordHash = await bcrypt.hash(password, 12);

  for (const employee of employees) {
    const email = employee.email.toLowerCase();

    const user = await UserModel.findOneAndUpdate(
      { email },
      {
        $set: {
          isManager: employee.isManager,
          firstName: employee.name.split(" ")[0] ?? null,
          lastName: employee.name.split(" ").slice(1).join(" ") || null,
        },
        // Only used when the account is created, so an existing password
        // (e.g. the one coming from ADMIN_PASSWORD) is never overwritten.
        $setOnInsert: { passwordHash },
      },
      { new: true, upsert: true },
    ).lean();

    const userId = String(user._id);

    // The upsert is keyed by `userId` (not by name) because the `userId`
    // index is unique: keying by name would create a second employee record
    // with the same `userId` whenever the employee was renamed in the app,
    // and the unique index would reject it.
    await EmployeeModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          name: employee.name,
          role: employee.role,
          department: employee.department,
          hireDate: employee.hireDate,
          userId,
        },
      },
      { new: true, upsert: true },
    );
  }

  const joao = await EmployeeModel.findOne({ name: "João Silva" }).lean();
  const admin = await EmployeeModel.findOne({ name: "Admin Teste" }).lean();

  if (joao) {
    await VacationModel.findOneAndUpdate(
      { employeeId: joao.id, startDate: "2026-06-10" },
      {
        $set: {
          employeeId: joao.id,
          startDate: "2026-06-10",
          endDate: "2026-06-15",
          notes: "Férias aprovadas",
          status: "approved",
        },
      },
      { new: true, upsert: true },
    );
  }

  if (admin) {
    await VacationModel.findOneAndUpdate(
      { employeeId: admin.id, startDate: "2026-06-04" },
      {
        $set: {
          employeeId: admin.id,
          startDate: "2026-06-04",
          endDate: "2026-06-10",
          notes: "Férias aprovadas",
          status: "approved",
        },
      },
      { new: true, upsert: true },
    );
  }

  // Make sure the id counters are ahead of the seeded documents
  const counts = {
    employee: await EmployeeModel.countDocuments(),
    vacation: await VacationModel.countDocuments(),
    vacation_sale: await VacationSaleModel.countDocuments(),
    notification: await NotificationModel.countDocuments(),
  };

  for (const [name, seq] of Object.entries(counts)) {
    await CounterModel.updateOne(
      { _id: name },
      { $max: { seq } },
      { upsert: true },
    );
  }
}
