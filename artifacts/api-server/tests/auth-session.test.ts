import { describe, it, expect } from "vitest";
import { shouldInvalidateSession } from "../src/middlewares/authMiddleware";

/**
 * Ciclo de sessão (SEC-03): a sessão só é válida enquanto o usuário existir.
 */
describe("shouldInvalidateSession", () => {
  it("mantém a sessão quando o usuário ainda existe no banco", () => {
    expect(shouldInvalidateSession({ hasUser: true })).toBe(false);
  });

  it("invalida a sessão quando o usuário foi removido", () => {
    expect(shouldInvalidateSession({ hasUser: false })).toBe(true);
  });
});
