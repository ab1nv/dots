/**
 * vibeguard — OpenCode V2 port.
 *
 * Upstream (github.com/inkdust2021/opencode-vibeguard) is V1-only. This is a V2
 * equivalent: it redacts secrets before data reaches the model and restores
 * placeholders before a tool runs, so the model never sees your keys.
 *
 * Always on: the built-in secret patterns are active even without a config file.
 * Config (optional): ~/.config/opencode/vibeguard.config.json, or the path in
 * OPENCODE_VIBEGUARD_CONFIG.
 *
 * Placeholder format: __VG_<CATEGORY>_<hash12>__ (HMAC-SHA256 of the value with a
 * per-session key, first 12 hex chars). Stable within a session, not reversible
 * by the provider.
 */

import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

interface Keyword {
  value: string;
  category: string;
}
interface RegexRule {
  pattern: string;
  category: string;
}
interface Config {
  enabled: boolean;
  debug: boolean;
  keywords: Keyword[];
  regex: RegexRule[];
  builtin: string[];
  exclude: string[];
}

const BUILTIN: Record<string, { category: string; re: RegExp; valueGroup?: number }> = {
  env_secret: {
    category: "ENV",
    re: /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|API|AUTH)[A-Z0-9_]*)\s*[:=]\s*["']?([^\s"',;]{6,})/g,
    valueGroup: 2,
  },
  aws: { category: "AWS", re: /\bAKIA[0-9A-Z]{16}\b/g },
  github: { category: "GITHUB", re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
  openai: { category: "OPENAI", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  anthropic: { category: "ANTHROPIC", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  slack: { category: "SLACK", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  google: { category: "GOOGLE", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  bearer: { category: "BEARER", re: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/g },
  private_key: {
    category: "PRIVATEKEY",
    re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
};

const DEFAULTS: Config = {
  enabled: true,
  debug: false,
  keywords: [],
  regex: [],
  builtin: Object.keys(BUILTIN),
  exclude: ["example.com", "localhost", "127.0.0.1", "0.0.0.0"],
};

function configPath(): string {
  const env = process.env.OPENCODE_VIBEGUARD_CONFIG;
  if (env && existsSync(env)) return env;
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "opencode", "vibeguard.config.json");
}

function loadConfig(): Config {
  const path = configPath();
  if (!existsSync(path)) return DEFAULTS;
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8")) as Partial<Config>;
    return {
      enabled: raw.enabled ?? DEFAULTS.enabled,
      debug: raw.debug ?? DEFAULTS.debug,
      keywords: raw.keywords ?? [],
      regex: raw.regex ?? [],
      builtin: raw.builtin ?? DEFAULTS.builtin,
      exclude: raw.exclude ?? DEFAULTS.exclude,
    };
  } catch {
    return DEFAULTS;
  }
}

export default {
  id: "vibeguard",
  async setup(ctx: any) {
    const cfg = loadConfig();
    if (!cfg.enabled) return;

    const sessionKey = randomBytes(32);
    const toOriginal = new Map<string, string>();
    let replacements = 0;

    const log = (...a: unknown[]) => {
      if (cfg.debug) console.error("[vibeguard]", ...a);
    };

    function placeholder(category: string, value: string): string {
      const hash = createHmac("sha256", sessionKey).update(value).digest("hex").slice(0, 12);
      return `__VG_${category.toUpperCase()}_${hash}__`;
    }

    function remember(category: string, value: string): string {
      const token = placeholder(category, value);
      if (!toOriginal.has(token)) {
        toOriginal.set(token, value);
        replacements++;
      }
      return token;
    }

    function redact(text: string): string {
      if (!text || text.length < 4) return text;
      let out = text;
      for (const { value, category } of cfg.keywords) {
        if (value && value.length >= 4 && out.includes(value)) {
          out = out.split(value).join(remember(category || "KEY", value));
        }
      }
      for (const { pattern, category } of cfg.regex) {
        try {
          out = out.replace(new RegExp(pattern, "g"), (m) => remember(category || "REGEX", m));
        } catch {
          /* bad regex in config, skip */
        }
      }
      for (const name of cfg.builtin) {
        const rule = BUILTIN[name];
        if (!rule) continue;
        out = out.replace(rule.re, (...args: any[]) => {
          const match: string = args[0];
          if (rule.valueGroup) {
            const value: string = args[rule.valueGroup];
            if (!value || cfg.exclude.some((e) => value.includes(e))) return match;
            return match.replace(value, remember(rule.category, value));
          }
          if (cfg.exclude.some((e) => match.includes(e))) return match;
          return remember(rule.category, match);
        });
      }
      return out;
    }

    function redactDeep(value: any, seen = new Set<object>()): any {
      if (typeof value === "string") return redact(value);
      if (value === null || typeof value !== "object") return value;
      if (seen.has(value)) return value;
      seen.add(value);
      if (Array.isArray(value)) return value.map((v) => redactDeep(v, seen));
      for (const key of Object.keys(value)) {
        try {
          value[key] = redactDeep(value[key], seen);
        } catch {
          /* frozen field, skip */
        }
      }
      return value;
    }

    function restore(text: string): string {
      if (!text || !toOriginal.size) return text;
      let out = text;
      for (const [token, original] of toOriginal) {
        if (out.includes(token)) out = out.split(token).join(original);
      }
      return out;
    }

    function restoreDeep(value: any, seen = new Set<object>()): any {
      if (typeof value === "string") return restore(value);
      if (value === null || typeof value !== "object") return value;
      if (seen.has(value)) return value;
      seen.add(value);
      if (Array.isArray(value)) return value.map((v) => restoreDeep(v, seen));
      for (const key of Object.keys(value)) {
        try {
          value[key] = restoreDeep(value[key], seen);
        } catch {
          /* frozen field, skip */
        }
      }
      return value;
    }

    try {
      // Tool output -> model: redact before it can enter context.
      await ctx.tool.hook("execute.after", (event: any) => {
        try {
          if (event.status === "completed" && event.result !== undefined) {
            event.result = redactDeep(event.result);
          } else if (event.error?.message) {
            event.error.message = redact(event.error.message);
          }
        } catch {
          /* never break a tool call */
        }
      });

      // Model -> tool: restore placeholders so the real value reaches the tool.
      await ctx.tool.hook("execute.before", (event: any) => {
        try {
          if (event.input !== undefined) event.input = restoreDeep(event.input);
        } catch {
          /* never break a tool call */
        }
      });

      // User prompt -> model.
      await ctx.session.hook("prompt", (event: any) => {
        try {
          if (typeof event.prompt?.text === "string") event.prompt.text = redact(event.prompt.text);
        } catch {
          /* never break admission */
        }
      });

      // System + history -> model.
      await ctx.session.hook("context", (event: any) => {
        try {
          if (event.system) event.system = redactDeep(event.system);
          if (event.messages) event.messages = redactDeep(event.messages);
        } catch {
          /* never break the model call */
        }
      });
    } catch (err) {
      console.error(`[vibeguard] disabled: ${err instanceof Error ? err.message : String(err)}`);
    }

    log(`enabled (config=${configPath()}, builtin=${cfg.builtin.length}, keywords=${cfg.keywords.length})`);
  },
};
