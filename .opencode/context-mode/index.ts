/**
 * context-mode — OpenCode V2 adapter.
 *
 * Upstream (github.com/mksglu/context-mode) ships a V1 OpenCode plugin that
 * OpenCode V2 refuses to load. This is a thin V2 port of that plugin's five
 * hooks. Tool registration is NOT duplicated here: the shipped `context-mode`
 * MCP server (configured in opencode.jsonc, `codemode: false`) provides all
 * 11 ctx_* tools as `context-mode_ctx_*`.
 *
 * Hook map (V1 -> V2):
 *   tool.execute.before                  -> ctx.tool.hook("execute.before")
 *   tool.execute.after                   -> ctx.tool.hook("execute.after")
 *   chat.message                         -> ctx.session.hook("prompt")
 *   experimental.chat.system.transform   -> ctx.session.hook("context")
 *   experimental.session.compacting      -> ctx.session.hook("compaction")
 *   event                                -> ctx.event.subscribe()
 *
 * Everything is best-effort: any failure disables only this plugin, never the
 * session.
 */

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";

const require = createRequire(import.meta.url);

const SYNTHETIC_MESSAGE_PREFIXES = [
  "<task-notification>",
  "<system-reminder>",
  "<context_guidance>",
  "<tool-result>",
];

const ROUTING_MARKERS = ["<context_window_protection>", "ctx_search", "ctx_index"];

function isSyntheticMessage(text: string): boolean {
  const trimmed = text.trim();
  return SYNTHETIC_MESSAGE_PREFIXES.some((p) => trimmed.startsWith(p));
}

/** V2 built-in tool names -> canonical names used by context-mode routing. */
const V2_TOOL_ALIASES: Record<string, string> = {
  shell: "Bash",
  execute: "Execute",
  read: "Read",
  write: "Write",
  edit: "Edit",
  patch: "Edit",
  glob: "Glob",
  grep: "Grep",
  webfetch: "WebFetch",
  websearch: "WebSearch",
  subagent: "Agent",
  question: "AskUserQuestion",
  skill: "Skill",
};

function systemText(system: unknown): string {
  if (!Array.isArray(system)) return "";
  return system
    .map((part: any) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
    .join("\n");
}

function hasRoutingInstructions(system: unknown): boolean {
  const text = systemText(system);
  const boundary = (m: string) => {
    if (m.startsWith("<")) return text.includes(m);
    const re = new RegExp(`(?:^|\\W)${m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\W|$)`);
    return re.test(text);
  };
  return ROUTING_MARKERS.filter(boundary).length >= 2;
}

function textPart(text: string) {
  return { type: "text", text };
}

/** Locate the installed context-mode package root and load its internals. */
async function loadContextMode() {
  const candidates: string[] = [];

  const tryResolve = (from?: string) => {
    try {
      const req = from ? createRequire(from) : require;
      const entry = req.resolve("context-mode");
      candidates.push(resolve(dirname(entry), "..", "..", ".."));
    } catch {
      /* next */
    }
  };

  tryResolve();
  tryResolve(join(homedir(), ".config", "opencode", "package.json"));

  for (const cmd of [["npm", ["root", "-g"]], ["bun", ["pm", "ls", "-g"]]]) {
    try {
      const out = execFileSync(cmd[0] as string, cmd[1] as string[], { encoding: "utf-8", timeout: 10000 }).trim();
      for (const line of out.split("\n")) {
        const p = line.trim();
        if (p && existsSync(join(p, "context-mode", "package.json"))) candidates.push(join(p, "context-mode"));
      }
    } catch {
      /* next */
    }
  }

  candidates.push("/usr/lib/node_modules/context-mode");

  const root = candidates.find((p) => existsSync(join(p, "hooks", "core", "routing.mjs")));
  if (!root) throw new Error("context-mode package not found (npm install -g context-mode)");

  const imp = (rel: string) => import(pathToFileURL(join(root, rel)).href);

  const [routing, routingBlockMod, autoInjectionMod, toolNamingMod, dbMod, extractMod, snapshotMod] = await Promise.all([
    imp("hooks/core/routing.mjs"),
    imp("hooks/routing-block.mjs"),
    imp("hooks/auto-injection.mjs"),
    imp("hooks/core/tool-naming.mjs"),
    imp("build/session/db.js"),
    imp("build/session/extract.js"),
    imp("build/session/snapshot.js"),
  ]);

  return { root, routing, routingBlockMod, autoInjectionMod, toolNamingMod, dbMod, extractMod, snapshotMod };
}

export default {
  id: "context-mode",
  async setup(ctx: any) {
    let db: any;
    const controller = new AbortController();

    try {
      const cm = await loadContextMode();

      const { routePreToolUse, initSecurity } = cm.routing;
      const { createRoutingBlock } = cm.routingBlockMod;
      const { buildAutoInjection } = cm.autoInjectionMod;
      const { createToolNamer } = cm.toolNamingMod;
      const { SessionDB, resolveSessionDbPath } = cm.dbMod;
      const { extractEvents, extractUserEvents, parseOpencodeUsage, buildAgentUsageEvent } = cm.extractMod;
      const { buildResumeSnapshot } = cm.snapshotMod;

      await initSecurity(join(cm.root, "build"));

      const projectDir = ctx.location?.project?.canonical ?? ctx.location?.directory ?? process.cwd();
      const configHome = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
      const sessionsDir = join(configHome, "opencode", "context-mode", "sessions");

      db = new SessionDB({ dbPath: resolveSessionDbPath({ projectDir, sessionsDir }) });
      try {
        db.cleanupOldSessions(7);
      } catch {
        /* non-fatal */
      }

      const routingBlock: string = createRoutingBlock(createToolNamer("opencode"));

      // V2 tool hooks do not expose sessionID in their reference. Track the
      // active session from prompt/context hooks and fall back to it.
      const currentSession: { id?: string } = { id: undefined };
      const agentsMdCaptured = new Set<string>();

      function captureAgentsMd(sessionId: string): void {
        if (!sessionId || agentsMdCaptured.has(sessionId)) return;
        agentsMdCaptured.add(sessionId);
        for (const name of ["AGENTS.md", "CLAUDE.md", "CONTEXT.md"]) {
          try {
            const p = join(projectDir, name);
            if (!existsSync(p)) continue;
            const content = readFileSync(p, "utf-8");
            if (!content.trim()) continue;
            db.insertEvent(sessionId, { type: "rule", category: "rule", data: p, priority: 1 }, "PluginInit");
            db.insertEvent(sessionId, { type: "rule_content", category: "rule", data: content, priority: 1 }, "PluginInit");
          } catch {
            /* unreadable -> skip */
          }
        }
      }

      // ── PreToolUse: routing enforcement ────────────────────────────────
      await ctx.tool.hook("execute.before", (event: any) => {
        const tool = V2_TOOL_ALIASES[event.tool] ?? event.tool ?? "";
        const input = event.input ?? {};
        const sessionId = event.sessionID ?? currentSession.id;

        let decision: any;
        try {
          decision = routePreToolUse(tool, input, projectDir, "opencode", sessionId);
        } catch {
          return; // routing failure -> passthrough
        }
        if (!decision) return;

        if (decision.action === "deny" || decision.action === "ask") {
          throw new Error(decision.reason ?? "Blocked by context-mode");
        }
        if (decision.action === "modify" && decision.updatedInput) {
          Object.assign(input, decision.updatedInput);
        }
      });

      // ── PostToolUse: session event capture ─────────────────────────────
      await ctx.tool.hook("execute.after", (event: any) => {
        try {
          const sessionId = event.sessionID ?? currentSession.id;
          if (!sessionId) return;
          db.ensureSession(sessionId, projectDir);
          captureAgentsMd(sessionId);

          let response = "";
          if (event.status === "completed") {
            const r = event.result;
            response = typeof r === "string" ? r : JSON.stringify(r ?? "");
          } else if (event.error) {
            response = event.error.message ?? String(event.error);
          }

          const hookInput = {
            tool_name: event.tool ?? "",
            tool_input: event.input ?? {},
            tool_response: response,
            tool_output: undefined,
          };
          for (const ev of extractEvents(hookInput)) {
            db.insertEvent(sessionId, ev, "PostToolUse");
          }
        } catch {
          /* capture must never break a tool call */
        }
      });

      // ── Prompt admission: user prompt capture ──────────────────────────
      await ctx.session.hook("prompt", (event: any) => {
        try {
          const sessionId = event.sessionID;
          if (!sessionId) return;
          currentSession.id = sessionId;
          const text: string | undefined = event.prompt?.text;
          if (!text || isSyntheticMessage(text)) return;
          db.ensureSession(sessionId, projectDir);
          captureAgentsMd(sessionId);
          db.insertEvent(sessionId, { type: "user_prompt", category: "user-prompt", data: text, priority: 1 }, "UserPromptSubmit");
          for (const ev of extractUserEvents(text)) {
            db.insertEvent(sessionId, ev, "UserPromptSubmit");
          }
        } catch {
          /* never break prompt admission */
        }
      });

      // ── Model context: routing block + resume snapshot ────────────────
      await ctx.session.hook("context", (event: any) => {
        try {
          const sessionId = event.sessionID ?? currentSession.id;
          if (sessionId) currentSession.id = sessionId;

          if (Array.isArray(event.system) && !hasRoutingInstructions(event.system)) {
            event.system.splice(1, 0, textPart(routingBlock));
          }

          if (!sessionId) return;
          const row = db.claimLatestUnconsumedResume(sessionId);
          if (row?.snapshot && Array.isArray(event.system)) {
            event.system.splice(1, 0, textPart(row.snapshot));
          }
        } catch {
          /* never break the model call */
        }
      });

      // ── Compaction: snapshot for continuity ───────────────────────────
      await ctx.session.hook("compaction", (event: any) => {
        try {
          const sessionId = event.sessionID ?? currentSession.id;
          if (!sessionId) return;
          db.ensureSession(sessionId, projectDir);
          const events = db.getEvents(sessionId);
          if (!events.length) return;

          const stats = db.getSessionStats(sessionId);
          const snapshot = buildResumeSnapshot(events, { compactCount: (stats?.compact_count ?? 0) + 1 });
          db.upsertResume(sessionId, snapshot, events.length);
          db.incrementCompactCount(sessionId);

          if (Array.isArray(event.system)) {
            event.system.push(textPart(snapshot));
          }
          try {
            const autoBlock = buildAutoInjection(events);
            if (autoBlock && Array.isArray(event.system)) event.system.push(textPart(autoBlock));
          } catch {
            /* auto-injection is optional */
          }
        } catch {
          /* never break compaction */
        }
      });

      // ── Usage telemetry (best-effort) ─────────────────────────────────
      void (async () => {
        try {
          for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
            try {
              const ev: any = event;
              if (ev?.type !== "message.updated") continue;
              const sessionId = ev.properties?.info?.sessionID;
              if (!sessionId) continue;
              const counts = parseOpencodeUsage(ev);
              if (!counts) continue;
              const usageEvent = buildAgentUsageEvent(counts);
              if (!usageEvent) continue;
              db.ensureSession(sessionId, projectDir);
              db.insertEvent(sessionId, usageEvent, "MessageUpdated");
            } catch {
              /* ignore single-event failures */
            }
          }
        } catch {
          /* subscription ended */
        }
      })();
    } catch (err) {
      console.error(
        `[context-mode] V2 adapter disabled (MCP tools still available): ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return () => {
      controller.abort();
      try {
        db?.close?.();
      } catch {
        /* ignore */
      }
    };
  },
};
