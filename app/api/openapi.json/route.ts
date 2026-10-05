import { createOpenApiDocument } from "@/lib/openapi";

// The OpenAPI document of the REST API (tech-docs/rest-api.md); public, so
// that clients and code generators can read it without a token.

export function GET() {
  return Response.json(createOpenApiDocument());
}
