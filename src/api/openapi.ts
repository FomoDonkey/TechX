/**
 * Generador OpenAPI 3.1 a partir de Zod schemas.
 *
 * - createRoute auto-registra cada endpoint en este registro.
 * - buildOpenApiDocument() devuelve un OpenAPI 3.1 spec serializable.
 * - Conversor Zod→JSON Schema mínimo: cubre los tipos que usamos en CSM.
 */

import type { z } from "zod";

export type RegisteredRoute = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  tag: string;
  summary: string;
  description?: string;
  scopes?: string[];
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  response?: z.ZodTypeAny;
  /** Códigos de respuesta documentados aparte del 200/201. */
  errorCodes?: number[];
};

const REGISTRY: RegisteredRoute[] = [];
const SEEN = new Set<string>();

export function registerRoute(route: RegisteredRoute) {
  const key = `${route.method} ${route.path}`;
  if (SEEN.has(key)) return; // idempotente — útil con HMR
  SEEN.add(key);
  REGISTRY.push(route);
}

export function listRegisteredRoutes(): RegisteredRoute[] {
  return [...REGISTRY].sort((a, b) =>
    a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path),
  );
}

// ============================================================
// Conversor Zod → JSON Schema 2020-12 (subset)
// ============================================================

type JsonSchema = Record<string, unknown>;

export function zodToJsonSchema(schema: z.ZodTypeAny | undefined): JsonSchema {
  if (!schema) return {};
  return convert(schema);
}

function convert(schema: z.ZodTypeAny): JsonSchema {
  const def = schema._def;
  const typeName: string = def?.typeName ?? "";
  switch (typeName) {
    case "ZodString": {
      const out: JsonSchema = { type: "string" };
      const checks = def.checks as Array<Record<string, unknown>> | undefined;
      if (checks) {
        for (const check of checks) {
          if (check.kind === "min") out.minLength = check.value;
          if (check.kind === "max") out.maxLength = check.value;
          if (check.kind === "uuid") out.format = "uuid";
          if (check.kind === "email") out.format = "email";
          if (check.kind === "url") out.format = "uri";
          if (check.kind === "regex" && check.regex instanceof RegExp) {
            out.pattern = (check.regex as RegExp).source;
          }
        }
      }
      return out;
    }
    case "ZodNumber": {
      const out: JsonSchema = { type: "number" };
      const checks = def.checks as Array<Record<string, unknown>> | undefined;
      if (checks) {
        for (const check of checks) {
          if (check.kind === "int") out.type = "integer";
          if (check.kind === "min") out.minimum = check.value;
          if (check.kind === "max") out.maximum = check.value;
        }
      }
      return out;
    }
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodLiteral":
      return { const: def.value };
    case "ZodEnum":
      return { type: "string", enum: def.values };
    case "ZodNativeEnum":
      return {
        type: "string",
        enum: Object.values(def.values).filter((v) => typeof v === "string"),
      };
    case "ZodArray":
      return { type: "array", items: convert(def.type) };
    case "ZodObject": {
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      const properties: JsonSchema = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape) as Array<[string, z.ZodTypeAny]>) {
        properties[key] = convert(value);
        if (!isOptional(value)) required.push(key);
      }
      const out: JsonSchema = { type: "object", properties };
      if (required.length > 0) out.required = required;
      return out;
    }
    case "ZodUnion": {
      const options = def.options as z.ZodTypeAny[];
      return { anyOf: options.map(convert) };
    }
    case "ZodOptional":
      return convert(def.innerType);
    case "ZodNullable": {
      const inner = convert(def.innerType);
      return { anyOf: [inner, { type: "null" }] };
    }
    case "ZodDefault":
      return { ...convert(def.innerType), default: def.defaultValue() };
    case "ZodEffects":
      return convert(def.schema);
    case "ZodRecord":
      return {
        type: "object",
        additionalProperties: def.valueType ? convert(def.valueType) : true,
      };
    case "ZodAny":
    case "ZodUnknown":
      return {};
    case "ZodDate":
      return { type: "string", format: "date-time" };
    case "ZodLazy":
      return convert(def.getter());
    default:
      return {};
  }
}

function isOptional(schema: z.ZodTypeAny): boolean {
  const tn = (schema._def?.typeName ?? "") as string;
  if (tn === "ZodOptional" || tn === "ZodDefault") return true;
  if (tn === "ZodEffects") return isOptional(schema._def.schema);
  return false;
}

// ============================================================
// Builder del documento OpenAPI 3.1
// ============================================================

export function buildOpenApiDocument(opts: {
  title: string;
  version: string;
  description?: string;
  serverUrl: string;
}): JsonSchema {
  const paths: JsonSchema = {};
  for (const route of listRegisteredRoutes()) {
    const pathSpec = (paths[route.path] ?? {}) as JsonSchema;
    const op: JsonSchema = {
      tags: [route.tag],
      summary: route.summary,
      operationId: `${route.method.toLowerCase()}_${route.path
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")}`,
      parameters: buildParameters(route),
      responses: buildResponses(route),
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
    };
    if (route.description) op.description = route.description;
    if (route.scopes && route.scopes.length > 0) {
      op["x-required-scopes"] = route.scopes;
    }
    if (route.body) {
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: zodToJsonSchema(route.body) } },
      };
    }
    pathSpec[route.method.toLowerCase()] = op;
    paths[route.path] = pathSpec;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: opts.title,
      version: opts.version,
      description: opts.description ?? "API REST de CSM. Auth: Bearer token o header X-API-Key.",
    },
    servers: [{ url: opts.serverUrl }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "csm_live_..." },
        apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
                details: {},
              },
              required: ["code", "message"],
            },
            requestId: { type: "string" },
          },
          required: ["error"],
        },
      },
    },
  };
}

function buildParameters(route: RegisteredRoute): JsonSchema[] {
  const params: JsonSchema[] = [];
  if (route.params) {
    const schema = zodToJsonSchema(route.params) as {
      properties?: JsonSchema;
      required?: string[];
    };
    if (schema.properties) {
      for (const [name, prop] of Object.entries(schema.properties)) {
        params.push({
          name,
          in: "path",
          required: true,
          schema: prop as JsonSchema,
        });
      }
    }
  }
  if (route.query) {
    const schema = zodToJsonSchema(route.query) as { properties?: JsonSchema; required?: string[] };
    const required = schema.required ?? [];
    if (schema.properties) {
      for (const [name, prop] of Object.entries(schema.properties)) {
        params.push({
          name,
          in: "query",
          required: required.includes(name),
          schema: prop as JsonSchema,
        });
      }
    }
  }
  return params;
}

function buildResponses(route: RegisteredRoute): JsonSchema {
  const responses: JsonSchema = {};
  const successCode = route.method === "POST" ? "201" : "200";
  if (route.response) {
    responses[successCode] = {
      description: "Respuesta correcta",
      content: { "application/json": { schema: zodToJsonSchema(route.response) } },
    };
  } else {
    responses[successCode] = { description: "Respuesta correcta" };
  }
  // Errores comunes
  responses["401"] = { description: "Falta autenticación", content: errorContent() };
  responses["403"] = { description: "Permiso denegado", content: errorContent() };
  responses["404"] = { description: "No encontrado", content: errorContent() };
  responses["429"] = { description: "Rate limit excedido", content: errorContent() };
  for (const code of route.errorCodes ?? []) {
    responses[String(code)] = { description: `Error HTTP ${code}`, content: errorContent() };
  }
  return responses;
}

function errorContent(): JsonSchema {
  return { "application/json": { schema: { $ref: "#/components/schemas/Error" } } };
}
