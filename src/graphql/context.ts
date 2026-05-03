/**
 * Context para resolvers GraphQL.
 * Reusa la misma auth de REST: API key bearer + cache TTL 60s.
 */

import {
  type AuthDenyReason,
  extractKeyFromRequest,
  hashIp,
  recordAudit,
  verifyKey,
} from "@/api/keys";
import { GraphQLError } from "graphql";

export interface GraphQLContext {
  apiKey: {
    id: string;
    workspaceId: string;
    scopes: string[];
    rateLimit: number;
    environment: "live" | "test";
  } | null;
  request: Request;
  ip: string;
  userAgent: string | null;
  startedAt: number;
}

export async function buildContext(request: Request): Promise<GraphQLContext> {
  const startedAt = Date.now();
  const ip = getIp(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;
  const fullKey = extractKeyFromRequest(request);
  if (!fullKey) {
    return { apiKey: null, request, ip, userAgent, startedAt };
  }
  const auth = await verifyKey(fullKey);
  if (!auth.ok) {
    throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
  }
  return { apiKey: auth.apiKey, request, ip, userAgent, startedAt };
}

export async function auditGraphqlRequest(
  ctx: GraphQLContext,
  opts: { statusCode: number; operation: string; denyReason?: AuthDenyReason },
) {
  if (!ctx.apiKey) return;
  await recordAudit({
    apiKeyId: ctx.apiKey.id,
    workspaceId: ctx.apiKey.workspaceId,
    method: "POST",
    path: `/api/graphql/${opts.operation}`,
    statusCode: opts.statusCode,
    durationMs: Date.now() - ctx.startedAt,
    ipHash: hashIp(ctx.ip),
    userAgent: ctx.userAgent,
    ...(opts.denyReason ? { denyReason: opts.denyReason } : {}),
  });
}

function getIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? "0.0.0.0";
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}
