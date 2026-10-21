import { defineConfig } from "vitest/config";

/**
 * Configuração do runner de testes (Vitest) da raiz do monorepo.
 *
 * Decisões:
 * - `environment: "node"`: os testes cobrem helpers puros da API Express,
 *   que rodam em Node (sem DOM).
 * - `globals: false`: cada arquivo de teste importa explicitamente
 *   `describe`/`it`/`expect` de "vitest" (mantém o type-check estrito).
 * - `include`: apenas a suíte da API, em `artifacts/api-server/tests/`.
 * - `isolate: true` + `pool: "forks"`: cada arquivo roda em um processo
 *   isolado, sem estado compartilhado e sem conexão com o MongoDB
 *   (nenhum teste abre socket — ver `artifacts/api-server/tests/`).
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["artifacts/api-server/tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    isolate: true,
    pool: "forks",
    reporters: ["default"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
