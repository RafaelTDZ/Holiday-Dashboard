import { pgTable, serial, text, timestamp, boolean, varchar, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
import { vacationsTable } from "./vacations";
import { employeesTable } from "./employees";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  vacationId: integer("vacation_id").references(() => vacationsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
