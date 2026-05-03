/**
 * Instancia GraphQL Yoga + plugins ad-hoc para depth/complexity y persisted queries.
 *
 * Yoga maneja: parsing, execution, JSON parsing, multipart, CORS si lo configuras,
 * SSE para subscriptions (no usadas aquí), error masking en producción, plugins.
 */

import { parse } from "graphql";
import { createYoga } from "graphql-yoga";
import { type GraphQLContext, auditGraphqlRequest, buildContext } from "./context";
import { checkComplexity, checkDepth } from "./limits";
import { getPersistedQuery, isPersistedOnly } from "./persisted";
import { csmGraphQLSchema } from "./schema";

export const yoga = createYoga<Record<string, never>, GraphQLContext>({
  schema: csmGraphQLSchema,
  context: ({ request }) => buildContext(request),
  graphqlEndpoint: "/api/graphql",
  // Disable Yoga GraphiQL — usamos nuestro playground propio en /admin/api-docs/graphql
  graphiql: false,
  landingPage: false,
  cors: {
    origin: "*",
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization", "x-api-key"],
  },
  maskedErrors: {
    maskError(error: unknown, message: string): Error {
      const e = error as Error & { extensions?: Record<string, unknown> };
      // Pasamos errores con código (Unauthorized/Forbidden/depth/complexity) sin enmascarar
      const code = e.extensions?.code;
      if (typeof code === "string") return e;
      // Errores de DB / inesperados sí se enmascaran
      return new Error(message);
    },
  },
  plugins: [
    {
      onParams({ params, setParams }) {
        // Resolución de persisted queries
        // biome-ignore lint/suspicious/noExplicitAny: extension shape
        const ext = (params as any).extensions?.persistedQuery as
          | { sha256: string; version?: number }
          | undefined;
        if (ext?.sha256) {
          const stored = getPersistedQuery(ext.sha256);
          if (stored) {
            setParams({ ...params, query: stored });
          } else if (!params.query) {
            // Cliente quería usar persistido pero no lo conocemos: devolvemos error
            // Yoga responderá 200 con error en body
            throw Object.assign(new Error("PERSISTED_QUERY_NOT_FOUND"), {
              extensions: { code: "PERSISTED_QUERY_NOT_FOUND" },
            });
          }
          // Si trae query además del hash, ejecutamos la query (cliente la registra)
        } else if (isPersistedOnly()) {
          throw Object.assign(new Error("Only persisted queries are allowed"), {
            extensions: { code: "PERSISTED_QUERY_REQUIRED" },
          });
        }
      },
      // biome-ignore lint/suspicious/noExplicitAny: Yoga plugin hooks shape varies
      onValidate(payload: any) {
        const params = payload.params ?? payload;
        let doc = params.documentAST;
        if (!doc) {
          const queryStr = params.query;
          if (!queryStr) return;
          try {
            doc = parse(queryStr);
          } catch {
            return;
          }
        }
        checkDepth(doc);
        checkComplexity(doc, (params.variables ?? {}) as Record<string, unknown>);
      },
      // biome-ignore lint/suspicious/noExplicitAny: Yoga plugin hooks shape varies
      onExecute(payload: any) {
        const args = payload.args;
        return {
          onExecuteDone: async ({ result }: { result: unknown }) => {
            const ctx = args.contextValue as GraphQLContext;
            const opName = args.operationName ?? "anonymous";
            const r = result as { errors?: unknown[] } | null | undefined;
            const status = r?.errors && r.errors.length > 0 ? 400 : 200;
            await auditGraphqlRequest(ctx, { statusCode: status, operation: opName }).catch(
              () => {},
            );
          },
        };
      },
    },
  ],
});
