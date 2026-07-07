import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const specs = [
  { name: "hft", url: "https://hft-dev.xnoquant.io/openapi.json", oas3: true, dedupeOperationIds: true },
  { name: "auth", url: "https://api.dev.xnoquant.io/auth/swagger_docs/doc.json", oas3: false },
  { name: "xalpha", url: "https://api.dev.xnoquant.io/xalpha-api/swagger_docs/doc.json", oas3: false },
];

mkdirSync("types/api", { recursive: true });
mkdirSync("node_modules/.cache/oas", { recursive: true });

// The HFT spec reuses generic operationIds ("list", "create", "fetch", "update",
// "remove") across unrelated resources (accounts, runs, strategies, symbols,
// venues), which violates the OpenAPI requirement that operationIds be unique.
// openapi-typescript keys its `operations` map by operationId, so the collision
// produces an `operations` interface with duplicate/conflicting members and
// fails `tsc`. Since `paths` already inlines the full request/response shape
// per unique path+method (paths are always unique), we strip `operationId`
// before generation so openapi-typescript falls back to inlining operations
// directly in `paths` instead of hoisting them into the (broken) `operations`
// map. This changes nothing about the actual schema/path data — only how the
// generator names the operation, working around the upstream spec defect.
function stripOperationIds(specPath) {
  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  for (const methods of Object.values(spec.paths ?? {})) {
    for (const op of Object.values(methods)) {
      if (op && typeof op === "object" && "operationId" in op) delete op.operationId;
    }
  }
  writeFileSync(specPath, JSON.stringify(spec));
}

for (const s of specs) {
  let input = s.url;
  if (!s.oas3) {
    const converted = `node_modules/.cache/oas/${s.name}-oas3.json`;
    console.log(`Converting Swagger 2.0 -> OpenAPI 3 for ${s.name}...`);
    execSync(`npx swagger2openapi "${s.url}" -o "${converted}"`, { stdio: "inherit" });
    input = converted;
  } else if (s.dedupeOperationIds) {
    const local = `node_modules/.cache/oas/${s.name}.json`;
    console.log(`Fetching ${s.name} spec...`);
    const res = await fetch(s.url);
    writeFileSync(local, await res.text());
    stripOperationIds(local);
    input = local;
  }
  console.log(`Generating types/api/${s.name}.ts ...`);
  execSync(`npx openapi-typescript "${input}" -o types/api/${s.name}.ts`, { stdio: "inherit" });
}
