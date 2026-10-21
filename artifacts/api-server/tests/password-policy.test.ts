import { describe, it, expect } from "vitest";
import {
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "../src/lib/password-policy";

/**
 * Política de senha (SEC-05): função pura, sem banco, sem logger e sem HTTP.
 *
 * Regras vigentes: mínimo de `PASSWORD_MIN_LENGTH` caracteres e ao menos 3 dos
 * 4 grupos de caracteres (minúscula, maiúscula, dígito, símbolo). A senha
 * também não pode conter o e-mail do usuário nem partes dele.
 */
describe("validatePassword", () => {
  it("PASSWORD_MIN_LENGTH é 10 caracteres", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
  });

  it("rejeita senha vazia ou ausente", () => {
    expect(validatePassword("").valid).toBe(false);
    expect(validatePassword(undefined).valid).toBe(false);
    expect(validatePassword(null).valid).toBe(false);
    expect(validatePassword(1234567890).valid).toBe(false);
  });

  it("rejeita senha curta demais", () => {
    const result = validatePassword("Ab1!x");

    expect(result.valid).toBe(false);
    expect(result.message).toBeDefined();
  });

  it("rejeita senha com exatamente PASSWORD_MIN_LENGTH - 1 caracteres", () => {
    const result = validatePassword("aB1!aB1!a");

    expect(result.valid).toBe(false);
  });

  it("rejeita senha sem maiúscula, número e símbolo (só minúsculas)", () => {
    const result = validatePassword("abcdefghijkl");

    expect(result.valid).toBe(false);
  });

  it("rejeita senha sem número e símbolo (só letras)", () => {
    const result = validatePassword("abcDEFghijKL");

    expect(result.valid).toBe(false);
  });

  it("rejeita senha sem maiúscula e símbolo (minúsculas + números)", () => {
    const result = validatePassword("abcdefghij123");

    expect(result.valid).toBe(false);
  });

  it("rejeita senha sem minúscula e símbolo (maiúsculas + números)", () => {
    const result = validatePassword("ABCDEFGHIJ123");

    expect(result.valid).toBe(false);
  });

  it("aceita senha forte com os 4 grupos de caracteres", () => {
    const result = validatePassword("Ferias#2026!");

    expect(result.valid).toBe(true);
    expect(result.message).toBeUndefined();
  });

  it("aceita senha forte com 3 grupos (a política exige 3 de 4)", () => {
    expect(validatePassword("Ferias2026").valid).toBe(true);
    expect(validatePassword("ferias#2026").valid).toBe(true);
    expect(validatePassword("FERIAS#2026").valid).toBe(true);
  });

  it("rejeita senha que contém o e-mail do usuário", () => {
    // Senha forte (4 grupos) que, porém, embute o e-mail inteiro.
    const result = validatePassword(
      "M=maria.silva@tdztrading.com.br1!",
      "maria.silva@tdztrading.com.br",
    );

    expect(result.valid).toBe(false);
  });

  it("rejeita senha que contém a parte local do e-mail", () => {
    const result = validatePassword("mariasilva@2026", "maria.silva@tdztrading.com.br");

    expect(result.valid).toBe(false);
  });

  it("aceita senha forte que não tem relação com o e-mail", () => {
    const result = validatePassword("Barra#Forte2026", "maria.silva@tdztrading.com.br");

    expect(result.valid).toBe(true);
  });
});
