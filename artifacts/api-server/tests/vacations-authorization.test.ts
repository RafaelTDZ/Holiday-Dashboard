import { describe, it, expect } from "vitest";
import { canDeleteVacation } from "../src/routes/vacations";

/**
 * Autorização de `DELETE /vacations/:id` (SEC-02).
 *
 * A função é pura (sem banco e sem request), então a suíte roda sem MongoDB.
 */
describe("canDeleteVacation", () => {
  it("permite o gestor excluir férias de qualquer pessoa", () => {
    expect(
      canDeleteVacation({
        isManager: true,
        userId: "manager-1",
        ownerUserId: "employee-9",
      }),
    ).toBe(true);
  });

  it("permite o gestor excluir férias cujo employee não tem usuário vinculado", () => {
    expect(
      canDeleteVacation({
        isManager: true,
        userId: "manager-1",
        ownerUserId: null,
      }),
    ).toBe(true);
  });

  it("permite o dono excluir as próprias férias", () => {
    expect(
      canDeleteVacation({
        isManager: false,
        userId: "employee-1",
        ownerUserId: "employee-1",
      }),
    ).toBe(true);
  });

  it("nega a exclusão para um usuário que não é o dono", () => {
    expect(
      canDeleteVacation({
        isManager: false,
        userId: "employee-2",
        ownerUserId: "employee-1",
      }),
    ).toBe(false);
  });

  it("nega para não-gestor quando o férias não tem dono (ownerUserId nulo)", () => {
    expect(
      canDeleteVacation({
        isManager: false,
        userId: "employee-1",
        ownerUserId: null,
      }),
    ).toBe(false);
  });

  it("nega para não-gestor quando o dono é indefinido (ownerUserId undefined)", () => {
    expect(
      canDeleteVacation({
        isManager: false,
        userId: "employee-1",
        ownerUserId: undefined,
      }),
    ).toBe(false);
  });
});
