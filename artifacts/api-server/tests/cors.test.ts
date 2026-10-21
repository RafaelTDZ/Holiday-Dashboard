import { describe, it, expect } from "vitest";
import { getAllowedOrigins } from "../src/app";

/**
 * Allowlist de origens do CORS (SEC-06).
 *
 * `getAllowedOrigins` é pura: recebe o `env` e devolve a lista de origens
 * permitidas, sem tocar em banco, logger ou resposta HTTP.
 */
describe("getAllowedOrigins", () => {
  it("usa as origens de desenvolvimento quando CORS_ORIGINS não é definido", () => {
    expect(getAllowedOrigins({})).toEqual([
      "http://localhost:20421",
      "http://127.0.0.1:20421",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("inclui o APP_URL antes das origens de desenvolvimento", () => {
    expect(getAllowedOrigins({ APP_URL: "https://app.exemplo.com" })).toEqual([
      "https://app.exemplo.com",
      "http://localhost:20421",
      "http://127.0.0.1:20421",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });

  it("usa apenas as origens de CORS_ORIGINS quando ele é definido", () => {
    expect(
      getAllowedOrigins({
        CORS_ORIGINS: "https://app.exemplo.com,https://app2.exemplo.com",
      }),
    ).toEqual(["https://app.exemplo.com", "https://app2.exemplo.com"]);
  });

  it("ignora espaços, entradas vazias e origens repetidas", () => {
    expect(
      getAllowedOrigins({
        CORS_ORIGINS: " https://app.exemplo.com , , https://app.exemplo.com ",
      }),
    ).toEqual(["https://app.exemplo.com"]);
  });

  it("remove a barra final das origens", () => {
    expect(
      getAllowedOrigins({ CORS_ORIGINS: "https://app.exemplo.com/" }),
    ).toEqual(["https://app.exemplo.com"]);
  });

  it("devolve ['*'] quando CORS_ORIGINS é o escape hatch", () => {
    expect(getAllowedOrigins({ CORS_ORIGINS: "*" })).toEqual(["*"]);
  });

  it("trata CORS_ORIGINS vazio como não configurado", () => {
    expect(getAllowedOrigins({ CORS_ORIGINS: "" })).toEqual([
      "http://localhost:20421",
      "http://127.0.0.1:20421",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]);
  });
});
