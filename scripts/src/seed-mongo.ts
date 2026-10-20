/**
 * Seeds the demo dataset used by the Dashboard de FÃ©rias.
 *
 * Usage:
 *   MONGODB_URI="mongodb://..." pnpm --filter @workspace/db run seed
 *
 * It is idempotent: running it again updates the existing documents instead
 * of duplicating them.
 */
import bcrypt from "bcryptjs";
import {
  connectDb,
  disconnectDb,
  EmployeeModel,
  UserModel,
  VacationModel,
  VacationSaleModel,
  NotificationModel,
  SessionModel,
  CounterModel,
} from "@workspace/db";

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "senha123";

const employees = [
  {
    name: "Admin Teste",
    role: "Coordenador",
    department: "RH",
    hireDate: "2020-01-15",
    email: "admin@dashboard.com",
    isManager: true,
  },
  {
    name: "Coordenador Geral",
    role: "Coordenador",
    department: "RH",
    hireDate: "2023-01-15",
    email: "coord@dashboard.com",
    isManager: true,
  },
  {
    name: "JoÃ£o Silva",
    role: "Analista",
    department: "Comercial",
    hireDate: "2024-03-10",
    email: "joao@email.com",
    isManager: false,
  },
  {
    name: "Maria Santos",
    role: "Designer",
    department: "Operacional",
    hireDate: "2024-06-01",
    email: "maria@email.com",
    isManager: false,
  },
  {
    name: "Pedro Oliveira",
    role: "Desenvolvedor",
    department: "Financeiro",
    hireDate: "2024-09-20",
    email: "pedro@email.com",
    isManager: false,
  },
];

async function seed() {
  await connectDb();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  for (const employee of employees) {
    const email = employee.email.toLowerCase();

    const user = await UserModel.findOneAndUpdate(
      { email },
      {
        $set: {
          passwordHash,
          isManager: employee.isManager,
          firstName: employee.name.split(" ")[0] ?? null,
          lastName: employee.name.split(" ").slice(1).join(" ") || null,
        },
      },
      { new: true, upsert: true },
    ).lean();

    await EmployeeModel.findOneAndUpdate(
      { name: employee.name },
      {
        $set: {
          name: employee.name,
          role: employee.role,
          department: employee.department,
          hireDate: employee.hireDate,
          userId: String(user._id),
        },
      },
      { new: true, upsert: true },
    );
  }

  const joao = await EmployeeModel.findOne({ name: "JoÃ£o Silva" }).lean();
  const admin = await EmployeeModel.findOne({ name: "Admin Teste" }).lean();

  if (joao) {
    await VacationModel.findOneAndUpdate(
      { employeeId: joao.id, startDate: "2026-06-10" },
      {
        $set: {
          employeeId: joao.id,
          startDate: "2026-06-10",
          endDate: "2026-06-15",
          notes: "FÃ©rias aprovadas",
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
          notes: "FÃ©rias aprovadas",
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

  console.log(
    `Seed finished. ${counts.employee} employees, ${counts.vacation} vacations.`,
  );
  console.log(`Password used for every seeded account: ${DEMO_PASSWORD}`);
}

seed()
  .then(() => disconnectDb())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await disconnectDb();
    process.exit(1);
  });
