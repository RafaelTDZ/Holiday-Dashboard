/**
 * Helpers to move between `Date` objects and the `"YYYY-MM-DD"` strings used
 * by the date-only fields of the domain.
 */

export function toDateOnly(value: Date | string): string {
  if (typeof value === "string") {
    return value.split("T")[0];
  }
  return value.toISOString().split("T")[0];
}

export function toDate(value: Date | string): Date {
  if (value instanceof Date) {
    return value;
  }
  return new Date(`${value.split("T")[0]}T00:00:00.000Z`);
}

export function todayDateOnly(now: Date = new Date()): string {
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  )
    .toISOString()
    .split("T")[0];
}
