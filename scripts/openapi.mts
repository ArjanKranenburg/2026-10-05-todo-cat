// Writes the REST API's OpenAPI document to openapi.json (tech-docs/rest-api.md);
// `npm run openapi:generate` formats it with Biome afterwards.
// lib/openapi.test.ts fails while the committed file lags behind the schemas.
import { writeFileSync } from "node:fs";
import { createOpenApiDocument } from "../lib/openapi";

writeFileSync(
  "openapi.json",
  `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`,
);
console.log("Wrote openapi.json");
