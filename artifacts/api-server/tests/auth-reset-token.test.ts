import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { hashResetToken } from "../src/routes/auth";

/**
 * Hash do token de redefinição de senha (SEC-04).
 *
 * O token puro só viaja pelo e-mail; no banco fica apenas o SHA-256.
 */
describe("hashResetToken", () => {
  it("é determinístico: o mesmo token gera sempre o mesmo hash", () => {
    expect(hashResetToken("token-abc")).toBe(hashResetToken("token-abc"));
  });

  it("tokens diferentes geram hashes diferentes", () => {
    expect(hashResetToken("token-abc")).not.toBe(hashResetToken("token-xyz"));
  });

  it("não devolve o token em texto puro", () => {
    const token = "meu-token-secreto-de-reset";
    const hash = hashResetToken(token);

    expect(hash).not.toBe(token);
    expect(hash).not.toContain(token);
    expect(hash.toLowerCase()).not.toContain(token.toLowerCase());
  });

  it("devolve 64 caracteres hexadecimais (SHA-256)", () => {
    const hash = hashResetToken("qualquer-token");

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("bate com o SHA-256 calculado pelo node:crypto", () => {
    const token = "token-enviado-por-email";
    const expected = createHash("sha256").update(token).digest("hex");

    expect(hashResetToken(token)).toBe(expected);
  });
});
