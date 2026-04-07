import { pgTable, serial, integer, date, text, timestamp } from "drizzle-orm/pg-core";
import { employeesTable } from "./employees";

export const vacationSalesTable = pgTable("vacation_sales", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  daysSold: integer("days_sold").notNull(),
  saleDate: date("sale_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type VacationSale = typeof vacationSalesTable.$inferSelect;
