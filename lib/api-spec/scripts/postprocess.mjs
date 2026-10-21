/**
 * Post-processing step for the Orval code generation.
 *
 * Orval writes `lib/api-zod/src/index.ts` re-exporting both the Zod schemas
 * (`./generated/api`) and the TypeScript declarations (`./generated/types`).
 * Both use the same names (e.g. `CreateEmployeeBody`), so re-exporting them
 * together makes those names ambiguous and breaks `tsc` with TS2308.
 *
 * The Zod schemas are the public API of this package (they carry the types via
 * `z.infer`), so only they are re-exported here.
 */
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiZodIndex = path.resolve(
  scriptDir,
  "..",
  "..",
  "api-zod",
  "src",
  "index.ts",
);

const content = `// This file is written by lib/api-spec/scripts/postprocess.mjs.
//
// Only the Zod schemas are re-exported. The TypeScript declarations generated
// in ./generated/types share their names with the schema constants (e.g.
// \`CreateEmployeeBody\`), so exporting both would make those names ambiguous.
export * from "./generated/api";
`;

await writeFile(apiZodIndex, content, "utf8");

console.log(`postprocess: wrote ${path.relative(process.cwd(), apiZodIndex)}`);
