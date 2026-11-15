import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GDC_IDENTITY_URL = "https://fnouachqiyxxwrgvmkfw.supabase.co/functions/v1/gdc-mcp-test";
const MAX_BODY_BYTES = 8192;
const ALLOWED_ROLES = ["superuser", "admin", "admin_plus"] as const;
const ACTIONS = ["gama_summary", "gama_uninvoiced", "gama_find_orders"] as const;

type Action = typeof ACTIONS[number];
type Args = {
  since?: string;
  limit?: number;
  offset?: number;
  query?: string;
};

const responseHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function parseInput(body: unknown): { action: Action; args: Args } | null {
  if (!isPlainObject(body) || !hasOnlyKeys(body, ["action", "args"])) return null;
  if (!ACTIONS.includes(body.action as Action)) return null;

  const action = body.action as Action;
  const rawArgs = body.args ?? {};
  if (!isPlainObject(rawArgs)) return null;

  const allowedArgs = action === "gama_summary"
    ? ["since"]
    : action === "gama_uninvoiced"
    ? ["since", "limit", "offset"]
    : ["since", "limit", "query"];
  if (!hasOnlyKeys(rawArgs, allowedArgs)) return null;

  const args: Args = {};
  if (rawArgs.since !== undefined) {
    if (typeof rawArgs.since !== "string" || !isValidDate(rawArgs.since)) return null;
    args.since = rawArgs.since;
  }
  if (rawArgs.limit !== undefined) {
    if (!Number.isInteger(rawArgs.limit) || (rawArgs.limit as number) < 1 || (rawArgs.limit as number) > 50) {
      return null;
    }
    args.limit = rawArgs.limit as number;
  }
  if (rawArgs.offset !== undefined) {
    if (!Number.isInteger(rawArgs.offset) || (rawArgs.offset as number) < 0 || (rawArgs.offset as number) > 20000) {
      return null;
    }
    args.offset = rawArgs.offset as number;
  }
  if (action === "gama_find_orders") {
    if (typeof rawArgs.query !== "string") return null;
    const query = rawArgs.query.trim();
    if (query.length < 3 || query.length > 80 || /[%_*\\]/.test(query) || /[\u0000-\u001f\u007f]/.test(query)) {
      return null;
    }
    args.query = query;
  }

  return { action, args };
}

async function verifyGdcIdentity(authorization: string): Promise<string | null> {
  try {
    const gatewayResponse = await fetch(GDC_IDENTITY_URL, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "gama_mcp_identity", arguments: {} },
      }),
      signal: AbortSignal.timeout(7000),
    });
    if (!gatewayResponse.ok) return null;

    const gatewayPayload: unknown = await gatewayResponse.json();
    if (!isPlainObject(gatewayPayload) || !isPlainObject(gatewayPayload.result)) return null;
    const content = gatewayPayload.result.content;
    if (!Array.isArray(content) || !isPlainObject(content[0]) || typeof content[0].text !== "string") {
      return null;
    }

    const identity: unknown = JSON.parse(content[0].text);
    if (!isPlainObject(identity)) return null;
    if (identity.authorized !== true || identity.issuer !== "gdc-mcp-test") return null;
    if (typeof identity.email !== "string" || identity.email.trim().length === 0) return null;

    return identity.email.trim().toLowerCase();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: responseHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request too large" }, 413);
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization || !/^Bearer\s+\S+$/.test(authorization)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: unknown;
  try {
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ error: "Request too large" }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  const input = parseInput(body);
  if (!input) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

  const email = await verifyGdcIdentity(authorization);
  if (!email) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Service unavailable" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const user = usersData.users.find((candidate) => candidate.email?.trim().toLowerCase() === email);
  if (!user) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const [profileResult, roleResult] = await Promise.all([
    admin.from("profiles").select("is_active").eq("id", user.id).maybeSingle(),
    admin.from("user_roles").select("role").eq("user_id", user.id).in("role", [...ALLOWED_ROLES]).limit(1).maybeSingle(),
  ]);

  if (
    profileResult.error || roleResult.error ||
    profileResult.data?.is_active !== true ||
    !roleResult.data?.role ||
    !ALLOWED_ROLES.includes(roleResult.data.role as typeof ALLOWED_ROLES[number])
  ) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  const { action, args } = input;
  const rpcName = action === "gama_summary"
    ? "gama_mcp_bridge_summary_v1"
    : action === "gama_uninvoiced"
    ? "gama_mcp_bridge_uninvoiced_v1"
    : "gama_mcp_bridge_find_orders_v1";
  const rpcArgs = action === "gama_summary"
    ? { p_since: args.since ?? null }
    : action === "gama_uninvoiced"
    ? { p_since: args.since ?? null, p_limit: args.limit ?? 30, p_offset: args.offset ?? 0 }
    : { p_query: args.query, p_since: args.since ?? null, p_limit: args.limit ?? 30 };

  const { data, error } = await admin.rpc(rpcName, rpcArgs);
  if (error) {
    return jsonResponse({ error: "Request failed" }, 500);
  }

  return jsonResponse({ system: "gama_united_nalozi", action, data });
});
