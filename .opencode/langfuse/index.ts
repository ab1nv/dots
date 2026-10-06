/**
 * langfuse — OpenCode V2 observability plugin.
 *
 * Sends one Langfuse trace per executed turn (session grouped), with
 * generations (model, usage, cost, latency), tool spans, and errors.
 * Zero runtime dependencies: raw OTLP/HTTP JSON via fetch.
 *
 * Ported from the signal set of @langfuse/pi-observability-plugin to the
 * OpenCode V2 public event stream + session/context hooks.
 *
 * Env:
 *   LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY   required to enable
 *   LANGFUSE_HOST (or LANGFUSE_BASE_URL)        default https://cloud.langfuse.com
 *   LANGFUSE_ENABLED=false                      kill switch
 *   LANGFUSE_USER_ID, LANGFUSE_ENVIRONMENT, LANGFUSE_RELEASE
 *   LANGFUSE_CAPTURE_IO=false                   structure only, no payloads
 *   LANGFUSE_CAPTURE_CONTEXT=false              do not attach conversation snapshot
 *   LANGFUSE_SAMPLE_RATE=0..1
 *   LANGFUSE_DEBUG=true
 *
 * Disabled (no keys) means setup returns immediately and subscribes to nothing.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const str = (v: string | undefined) => (v && v.trim() ? v.trim() : undefined);
const bool = (v: unknown, dflt: boolean) => (v === undefined ? dflt : String(v).toLowerCase() !== "false");

/** Optional config file, used when the env vars are not present in the server. */
function fileCfg(): Record<string, unknown> {
  try {
    const dir = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
    const path = join(dir, "opencode", "langfuse.json");
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return {};
}

const cfg = (() => {
  const file = fileCfg();
  const enabled = bool(process.env.LANGFUSE_ENABLED ?? file.enabled, true);
  const publicKey = str(process.env.LANGFUSE_PUBLIC_KEY) ?? str(file.publicKey as string);
  const secretKey = str(process.env.LANGFUSE_SECRET_KEY) ?? str(file.secretKey as string);
  if (!enabled || !publicKey || !secretKey) return undefined;
  const host = (
    str(process.env.LANGFUSE_HOST) ??
    str(process.env.LANGFUSE_BASE_URL) ??
    str(file.host as string) ??
    str(file.baseUrl as string) ??
    "https://cloud.langfuse.com"
  ).replace(/\/+$/, "");
  return {
    url: `${host}/api/public/otel/v1/traces`,
    auth: "Basic " + btoa(`${publicKey}:${secretKey}`),
    userId: str(process.env.LANGFUSE_USER_ID) ?? str(file.userId as string),
    environment:
      str(process.env.LANGFUSE_ENVIRONMENT) ??
      str(process.env.LANGFUSE_TRACING_ENVIRONMENT) ??
      str(file.environment as string),
    release: str(process.env.LANGFUSE_RELEASE) ?? str(file.release as string) ?? "opencode-langfuse@0.1.0",
    captureIO: bool(process.env.LANGFUSE_CAPTURE_IO ?? file.captureIO, true),
    captureContext: bool(process.env.LANGFUSE_CAPTURE_CONTEXT ?? file.captureContext, true),
    sampleRate: Math.min(1, Math.max(0, Number(process.env.LANGFUSE_SAMPLE_RATE ?? file.sampleRate ?? "1"))),
    debug: bool(process.env.LANGFUSE_DEBUG ?? file.debug, false),
  };
})();

const log = (...a: unknown[]) => {
  if (cfg?.debug) console.error("[langfuse]", ...a);
};

const VERSION = "opencode-langfuse@0.1.0";

/* ------------------------------------------------------------- redaction */

const SECRET_RE = /[sp]k-lf-[\w-]+/g;

function redact(v: unknown, seen = new Set<object>()): unknown {
  if (typeof v === "string") return v.replace(SECRET_RE, "[redacted-langfuse-secret]");
  if (v === null || typeof v !== "object") return v;
  if (seen.has(v)) return "[circular-ref]";
  seen.add(v);
  if (Array.isArray(v)) return v.map((x) => redact(x, seen));
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[k] = redact(x, seen);
  return out;
}

const clip = (s: string, n = 64_000) => (s.length > n ? s.slice(0, n) + "…[truncated]" : s);
const DATA_URI_RE = /data:[^;,]{0,64};base64,[A-Za-z0-9+/]+=*/g;

function scrub(v: unknown): string {
  try {
    const json = JSON.stringify(redact(v));
    if (json === undefined) return "";
    return clip(json.replace(DATA_URI_RE, (u) => `[data uri ~${Math.floor((u.length * 3) / 4 / 1024)}KB]`));
  } catch {
    return "[unserializable]";
  }
}

/* ------------------------------------------------------------------ OTLP */

type Attr = { key: string; value: Record<string, unknown> };

function A(k: string, v: string | number | boolean | string[] | undefined): Attr[] {
  if (v === undefined) return [];
  if (Array.isArray(v)) {
    return [{ key: k, value: { arrayValue: { values: v.map((s) => ({ stringValue: s })) } } }];
  }
  if (typeof v === "string") return [{ key: k, value: { stringValue: v } }];
  if (typeof v === "number") {
    return [{ key: k, value: Number.isInteger(v) ? { intValue: v } : { doubleValue: v } }];
  }
  return [{ key: k, value: { boolValue: v } }];
}

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: Attr[];
  status: { code: number; message?: string };
  events?: Array<{ name: string; timeUnixNano: string; attributes?: Attr[] }>;
}

const hex = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
const newTraceId = () => hex(16);
const newSpanId = () => hex(8);
const ns = (ms: number) => (BigInt(Math.trunc(ms)) * 1_000_000n).toString();
const iso = (ms: number) => new Date(ms).toISOString();

function makeSpan(s: {
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind?: number;
  start: number;
  end?: number;
  attrs?: Attr[];
  error?: string;
}): Span {
  return {
    traceId: s.traceId,
    spanId: newSpanId(),
    parentSpanId: s.parentSpanId,
    name: s.name,
    kind: s.kind ?? 1,
    startTimeUnixNano: ns(s.start),
    endTimeUnixNano: ns(s.end ?? Date.now()),
    attributes: s.attrs ?? [],
    status: s.error ? { code: 2, message: s.error } : { code: 0 },
  };
}

function usageMap(tokens: any): Record<string, number> | undefined {
  if (!tokens || typeof tokens !== "object") return undefined;
  const input = Number(tokens.input ?? 0) || 0;
  const outputRaw = Number(tokens.output ?? 0) || 0;
  const reasoning = Number(tokens.reasoning ?? 0) || 0;
  const cacheRead = Number(tokens.cache?.read ?? 0) || 0;
  const cacheWrite = Number(tokens.cache?.write ?? 0) || 0;
  const out: Record<string, number> = {};
  if (input) out.input = input;
  if (reasoning > outputRaw) {
    if (outputRaw) out.output = outputRaw;
  } else {
    const outOnly = outputRaw - reasoning;
    if (outOnly) out.output = outOnly;
    if (reasoning) out.output_reasoning_tokens = reasoning;
  }
  if (cacheRead) out.cache_read_input_tokens = cacheRead;
  if (cacheWrite) out.cache_creation_input_tokens = cacheWrite;
  return Object.keys(out).length ? out : undefined;
}

class Otlp {
  queue: Array<{ body: string; bytes: number }> = [];
  flushing = false;
  timer?: ReturnType<typeof setTimeout>;
  dropped = 0;
  c: NonNullable<typeof cfg>;
  version: string;

  constructor(c: NonNullable<typeof cfg>, version: string) {
    this.c = c;
    this.version = version;
  }

  enqueue(spans: Span[]): void {
    if (!spans.length) return;
    const body = JSON.stringify({
      resourceSpans: [
        {
          resource: {
            attributes: [
              ...A("service.name", "opencode"),
              ...A("service.version", this.version),
              ...A("deployment.environment.name", this.c.environment),
              ...A("langfuse.release", this.c.release),
            ],
          },
          scopeSpans: [{ scope: { name: "opencode-langfuse", version: VERSION }, spans }],
        },
      ],
    });
    this.queue.push({ body, bytes: body.length });
    let total = this.queue.reduce((n, q) => n + q.bytes, 0);
    while (this.queue.length > 100 || total > 8_000_000) {
      const dropped = this.queue.shift();
      total -= dropped?.bytes ?? 0;
      this.dropped++;
    }
    this.schedule();
  }

  schedule(): void {
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = undefined;
        void this.flush();
      }, 2_000);
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || !this.queue.length) return;
    this.flushing = true;
    try {
      while (this.queue.length) {
        const item = this.queue[0]!;
        let failed: unknown;
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            const res = await fetch(this.c.url, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                authorization: this.c.auth,
                "x-langfuse-ingestion-version": "4",
              },
              body: item.body,
              signal: AbortSignal.timeout(10_000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            failed = undefined;
            break;
          } catch (e) {
            failed = e;
            await new Promise((r) => setTimeout(r, 1_000 * 2 ** attempt));
          }
        }
        if (failed) {
          log("flush failed, keeping batch:", failed);
          break;
        }
        this.queue.shift();
      }
    } finally {
      this.flushing = false;
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = undefined;
      }
      if (this.queue.length) this.schedule();
    }
  }

  async drain(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    await Promise.race([this.flush(), new Promise((r) => setTimeout(r, 3_000))]);
  }
}

/* --------------------------------------------------------------- tracing */

interface ExecState {
  traceId: string;
  root: Span;
  spans: Span[];
  startedAt: number;
  lastText: string;
  error?: string;
  sample: boolean;
}

interface StepState {
  span: Span;
  startedAt: number;
  text: string[];
  thinking: string[];
  toolCalls: string[];
  completionStart?: number;
}

function baseAttrs(sessionId: string, rootSessionId: string, traceName: string): Attr[] {
  return [
    ...A("langfuse.session.id", rootSessionId),
    ...A("langfuse.trace.name", traceName),
    ...A("langfuse.trace.tags", ["opencode"]),
    ...(cfg?.userId ? A("langfuse.user.id", cfg.userId) : []),
    ...A("langfuse.release", VERSION),
    ...(cfg?.environment ? A("deployment.environment.name", cfg.environment) : []),
    ...A("langfuse.observation.metadata.opencode_session_id", sessionId),
  ];
}

export default {
  id: "langfuse",
  async setup(ctx: any) {
    if (!cfg) {
      log("disabled (missing keys or LANGFUSE_ENABLED=false)");
      return;
    }

    const client = new Otlp(cfg, ctx.app?.version ?? "unknown");

    const executions = new Map<string, ExecState>();
    const steps = new Map<string, StepState>();
    const tools = new Map<string, { span: Span; name: string; messageID?: string }>();
    const pendingPrompts = new Map<string, string>();
    const sessionMeta = new Map<string, { rootSessionID: string; parentID?: string }>();
    const contexts = new Map<string, string>();
    const seen = new Set<string>();

    const rootSessionOf = (sessionId: string) => {
      const meta = sessionMeta.get(sessionId);
      if (meta?.rootSessionID) return meta.rootSessionID;
      if (meta?.parentID) return meta.parentID;
      return sessionId;
    };

    if (cfg.captureContext) {
      try {
        await ctx.session.hook("context", (e: any) => {
          try {
            const system = (e.system ?? [])
              .map((p: any) => (typeof p === "string" ? p : typeof p?.text === "string" ? p.text : ""))
              .join("\n");
            const msgs = (e.messages ?? []).slice(-24).map((m: any) => ({
              role: m.role,
              text:
                typeof m.content === "string"
                  ? m.content
                  : Array.isArray(m.content)
                    ? m.content
                        .filter((p: any) => p?.type === "text")
                        .map((p: any) => p.text)
                        .join("")
                    : undefined,
            }));
            contexts.set(e.sessionID, clip(JSON.stringify([{ role: "system", content: system }, ...msgs])));
          } catch {
            /* context capture is best-effort */
          }
        });
      } catch {
        /* hook unavailable */
      }
    }

    try {
      await ctx.session.hook("prompt", (e: any) => {
        try {
          const text = e?.prompt?.text;
          if (typeof text === "string" && text.trim()) pendingPrompts.set(e.sessionID, clip(text));
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* hook unavailable */
    }

    function startExecution(sessionId: string, at: number): ExecState {
      const rootSessionID = rootSessionOf(sessionId);
      const sample = Math.random() < cfg!.sampleRate;
      const exec: ExecState = {
        traceId: newTraceId(),
        root: makeSpan({
          traceId: "",
          name: "OpenCode Turn",
          kind: 1,
          start: at,
          attrs: [
            ...A("langfuse.observation.type", "agent"),
            ...baseAttrs(sessionId, rootSessionID, "OpenCode Turn"),
          ],
        }),
        spans: [],
        startedAt: at,
        lastText: "",
        sample,
      };
      exec.root.traceId = exec.traceId;
      executions.set(sessionId, exec);
      return exec;
    }

    function ensureExecution(sessionId: string, at: number): ExecState {
      return executions.get(sessionId) ?? startExecution(sessionId, at);
    }

    function closeDangling(exec: ExecState, reason: string, at: number): void {
      for (const step of steps.values()) {
        step.span.endTimeUnixNano = ns(at);
        step.span.status = { code: 1, message: reason };
        step.span.attributes.push(...A("langfuse.observation.metadata.interrupted", true));
        exec.spans.push(step.span);
      }
      steps.clear();
      for (const tool of tools.values()) {
        tool.span.endTimeUnixNano = ns(at);
        tool.span.status = { code: 1, message: reason };
        tool.span.attributes.push(...A("langfuse.observation.metadata.interrupted", true));
        exec.spans.push(tool.span);
      }
      tools.clear();
    }

    function endExecution(sessionId: string, at: number, error?: string): void {
      const exec = executions.get(sessionId);
      if (!exec) return;
      closeDangling(exec, error ?? "interrupted", at);
      exec.root.endTimeUnixNano = ns(at);
      if (error) {
        exec.root.status = { code: 2, message: error };
        exec.root.attributes.push(...A("langfuse.observation.level", "ERROR"));
      }
      if (cfg!.captureIO && exec.lastText) {
        exec.root.attributes.push(...A("langfuse.observation.output", scrub(exec.lastText)));
      }
      const spans = exec.sample ? [exec.root, ...exec.spans] : [];
      executions.delete(sessionId);
      pendingPrompts.delete(sessionId);
      if (spans.length) client.enqueue(spans);
    }

    function handle(ev: any): void {
      if (!ev || typeof ev.type !== "string") return;
      if (typeof ev.id === "string") {
        if (seen.has(ev.id)) return;
        seen.add(ev.id);
        if (seen.size > 5_000) seen.clear();
      }
      const d = ev.data ?? {};
      const at = Number(ev.created ?? Date.now());
      const type: string = ev.type;

      switch (type) {
        case "session.created": {
          if (d.sessionID) {
            sessionMeta.set(d.sessionID, {
              rootSessionID: d.parentID ?? d.sessionID,
              parentID: d.parentID,
            });
          }
          return;
        }
        case "session.deleted": {
          if (d.sessionID) {
            endExecution(d.sessionID, at, "session deleted");
            sessionMeta.delete(d.sessionID);
          }
          return;
        }
        case "session.inbox.enqueued": {
          if (d.item?.type === "user") {
            const text = [
              d.item.payload?.text,
              ...(d.item.payload?.files ?? []).map((f: any) => f?.name ?? f?.source?.uri ?? ""),
            ]
              .filter(Boolean)
              .join("\n");
            if (text) pendingPrompts.set(d.sessionID, clip(text));
          }
          return;
        }
        case "session.execution.started": {
          startExecution(d.sessionID, at);
          return;
        }
        case "session.execution.succeeded": {
          endExecution(d.sessionID, at);
          return;
        }
        case "session.execution.failed": {
          endExecution(d.sessionID, at, d.error?.message ?? "execution failed");
          return;
        }
        case "session.execution.interrupted": {
          endExecution(d.sessionID, at, `interrupted: ${d.reason ?? "unknown"}`);
          return;
        }
        case "session.step.started": {
          const exec = ensureExecution(d.sessionID, at);
          if (!exec.sample) return;
          const rootSessionID = rootSessionOf(d.sessionID);
          const n = steps.size + 1;
          const step = makeSpan({
            traceId: exec.traceId,
            parentSpanId: exec.root.spanId,
            name: `LLM Call ${n}`,
            kind: 3,
            start: Number(d.started ?? at),
            attrs: [
              ...A("langfuse.observation.type", "generation"),
              ...A("langfuse.observation.model.name", d.model?.id),
              ...A("langfuse.observation.metadata.provider", d.model?.providerID),
              ...A("langfuse.observation.metadata.variant", d.model?.variant),
              ...A("langfuse.observation.metadata.agent", d.agent),
              ...baseAttrs(d.sessionID, rootSessionID, "OpenCode Turn"),
              ...(cfg!.captureContext && contexts.has(d.sessionID)
                ? A("langfuse.observation.input", contexts.get(d.sessionID))
                : pendingPrompts.has(d.sessionID) && cfg!.captureIO
                  ? A("langfuse.observation.input", scrub(pendingPrompts.get(d.sessionID)))
                  : []),
            ],
          });
          steps.set(d.assistantMessageID, {
            span: step,
            startedAt: Number(d.started ?? at),
            text: [],
            thinking: [],
            toolCalls: [],
          });
          return;
        }
        case "session.text.started":
        case "session.reasoning.started": {
          const step = steps.get(d.assistantMessageID);
          if (step && !step.completionStart) {
            step.completionStart = at;
            step.span.attributes.push(...A("langfuse.observation.completion_start_time", iso(at)));
          }
          return;
        }
        case "session.text.ended": {
          const step = steps.get(d.assistantMessageID);
          if (step && typeof d.text === "string") {
            step.text.push(d.text);
            const exec = findExec(d.assistantMessageID);
            if (exec) exec.lastText = step.text.join("");
          }
          return;
        }
        case "session.reasoning.ended": {
          const step = steps.get(d.assistantMessageID);
          if (step && typeof d.text === "string") step.thinking.push(d.text);
          return;
        }
        case "session.step.ended": {
          endStep(d, at, true);
          return;
        }
        case "session.step.failed": {
          endStep(d, at, false);
          return;
        }
        case "session.tool.input.started": {
          const step = steps.get(d.assistantMessageID);
          const exec = findExec(d.assistantMessageID);
          if (!step || !exec) return;
          const span = makeSpan({
            traceId: exec.traceId,
            parentSpanId: step.span.spanId,
            name: `Tool: ${d.name ?? d.id ?? "unknown"}`,
            kind: 1,
            start: at,
            attrs: [
              ...A("langfuse.observation.type", "tool"),
              ...A("langfuse.observation.metadata.tool_name", d.name),
              ...baseAttrs(d.sessionID ?? "", rootSessionOf(d.sessionID ?? ""), "OpenCode Turn"),
            ],
          });
          tools.set(d.id ?? `${d.assistantMessageID}:${d.name}`, { span, name: d.name ?? "tool", messageID: d.assistantMessageID });
          return;
        }
        case "session.tool.called": {
          const key = d.id ?? `${d.assistantMessageID}:${d.name}`;
          const tool = tools.get(key);
          if (tool) {
            if (cfg!.captureIO && d.input !== undefined) {
              tool.span.attributes.push(...A("langfuse.observation.input", scrub(d.input)));
            }
            tool.span.attributes.push(...A("langfuse.observation.metadata.executed", Boolean(d.executed)));
          }
          return;
        }
        case "session.tool.success": {
          endTool(d.id, d, at, undefined);
          return;
        }
        case "session.tool.failed": {
          endTool(d.id, d, at, d.error?.message ?? "tool failed");
          return;
        }
        case "session.retry.scheduled": {
          const step = steps.get(d.assistantMessageID);
          if (step) {
            step.span.events = step.span.events ?? [];
            step.span.events.push({
              name: "retry",
              timeUnixNano: ns(at),
              attributes: [
                ...A("retry.attempt", d.attempt),
                ...A("retry.error", d.error?.message),
              ],
            });
          }
          return;
        }
        case "session.usage.updated": {
          const exec = executions.get(d.sessionID);
          if (exec && d.cost !== undefined) {
            exec.root.attributes.push(...A("langfuse.observation.metadata.session_cost_usd", Number(d.cost)));
          }
          return;
        }
        case "session.compaction.ended":
        case "session.compaction.failed": {
          const exec = executions.get(d.sessionID);
          if (!exec) return;
          const span = makeSpan({
            traceId: exec.traceId,
            parentSpanId: exec.root.spanId,
            name: "Compaction",
            kind: 3,
            start: at,
            end: at,
            attrs: [
              ...A("langfuse.observation.type", "generation"),
              ...A("langfuse.observation.model.name", d.model),
              ...baseAttrs(d.sessionID, rootSessionOf(d.sessionID), "OpenCode Turn"),
              ...(cfg!.captureIO && typeof d.text === "string"
                ? A("langfuse.observation.output", scrub(d.text))
                : []),
              ...(usageMap(d.tokens) ? A("langfuse.observation.usage_details", JSON.stringify(usageMap(d.tokens))) : []),
              ...(d.cost !== undefined ? A("langfuse.observation.cost_details", JSON.stringify({ total: Number(d.cost) })) : []),
            ],
            error: type === "session.compaction.failed" ? (d.error?.message ?? "compaction failed") : undefined,
          });
          exec.spans.push(span);
          return;
        }
        default:
          return;
      }
    }

    function findExec(assistantMessageID: string): ExecState | undefined {
      // The step span carries the traceId; find the execution by trace id.
      const step = steps.get(assistantMessageID);
      if (!step) return undefined;
      for (const exec of executions.values()) if (exec.traceId === step.span.traceId) return exec;
      return undefined;
    }

    function endStep(d: any, at: number, ok: boolean): void {
      const step = steps.get(d.assistantMessageID);
      if (!step) return;
      const exec = findExec(d.assistantMessageID);
      step.span.endTimeUnixNano = ns(at);
      const usage = usageMap(d.tokens);
      if (usage) step.span.attributes.push(...A("langfuse.observation.usage_details", JSON.stringify(usage)));
      if (d.cost !== undefined) {
        step.span.attributes.push(...A("langfuse.observation.cost_details", JSON.stringify({ total: Number(d.cost) })));
      }
      if (d.finish) step.span.attributes.push(...A("langfuse.observation.metadata.finish_reason", String(d.finish)));
      if (cfg!.captureIO) {
        const output = {
          text: step.text.join(""),
          thinking: step.thinking.join(""),
          tool_calls: step.toolCalls,
        };
        step.span.attributes.push(...A("langfuse.observation.output", scrub(output)));
      }
      if (!ok) {
        step.span.status = { code: 2, message: d.error?.message ?? "step failed" };
        step.span.attributes.push(...A("langfuse.observation.level", "ERROR"));
      }
      exec?.spans.push(step.span);
      steps.delete(d.assistantMessageID);
    }

    function endTool(id: string, d: any, at: number, error?: string): void {
      const tool = tools.get(id);
      if (!tool) return;
      tool.span.endTimeUnixNano = ns(at);
      if (cfg!.captureIO && Array.isArray(d.content)) {
        const out = d.content
          .map((part: any) => (part?.type === "text" ? part.text : part?.name ?? part?.uri ?? ""))
          .filter(Boolean)
          .join("\n");
        if (out) tool.span.attributes.push(...A("langfuse.observation.output", scrub(out)));
      }
      if (d.metadata !== undefined) {
        tool.span.attributes.push(...A("langfuse.observation.metadata.result", scrub(d.metadata)));
      }
      if (error) {
        tool.span.status = { code: 2, message: error };
        tool.span.attributes.push(...A("langfuse.observation.level", "ERROR"));
      }
      // Attach to the parent execution (the step may already be closed).
      for (const exec of executions.values()) {
        if (exec.traceId === tool.span.traceId) {
          exec.spans.push(tool.span);
          break;
        }
      }
      tools.delete(id);
    }

    const controller = new AbortController();
    void (async () => {
      try {
        for await (const ev of ctx.event.subscribe({ signal: controller.signal })) {
          try {
            handle(ev);
          } catch (e) {
            log("handler error", (ev as any)?.type, e);
          }
        }
      } catch (e) {
        if (!controller.signal.aborted) log("subscription ended", e);
      }
    })();

    log(`enabled (host=${cfg.url}, captureIO=${cfg.captureIO}, captureContext=${cfg.captureContext})`);

    return async () => {
      controller.abort();
      for (const sessionId of Array.from(executions.keys())) endExecution(sessionId, Date.now(), "shutdown");
      await client.drain();
    };
  },
};
