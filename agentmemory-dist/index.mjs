#!/usr/bin/env node
import { createRequire } from "node:module";
import { TriggerAction, registerWorker } from "iii-sdk";
import { constants, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";
import Anthropic from "@anthropic-ai/sdk";
import { lstat, mkdir, open, readFile, readdir, stat, unlink, utimes, writeFile } from "node:fs/promises";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";

//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) {
		__defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	}
	if (!no_symbols) {
		__defProp(target, Symbol.toStringTag, { value: "Module" });
	}
	return target;
};

//#endregion
//#region src/config.ts
function safeParseInt(value, fallback) {
	if (!value) return fallback;
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? fallback : parsed;
}
const DATA_DIR = join(homedir(), ".agentmemory");
const ENV_FILE = join(DATA_DIR, ".env");
function loadEnvFile() {
	if (!existsSync(ENV_FILE)) return {};
	const content = readFileSync(ENV_FILE, "utf-8");
	const vars = {};
	for (const line of content.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eqIdx = trimmed.indexOf("=");
		if (eqIdx === -1) continue;
		const key = trimmed.slice(0, eqIdx).trim();
		let val = trimmed.slice(eqIdx + 1).trim();
		const quoteChar = val[0] === "\"" || val[0] === "'" ? val[0] : "";
		if (quoteChar) {
			const closeIdx = val.indexOf(quoteChar, 1);
			if (closeIdx !== -1) val = val.slice(1, closeIdx);
		} else {
			const hashIdx = val.indexOf(" #");
			if (hashIdx !== -1) val = val.slice(0, hashIdx).trim();
		}
		vars[key] = val;
	}
	return vars;
}
function hasRealValue(v) {
	return typeof v === "string" && v.trim().length > 0;
}
function detectProvider(env) {
	const maxTokens = parseInt(env["MAX_TOKENS"] || "4096", 10);
	if (hasRealValue(env["OPENAI_API_KEY"]) && env["OPENAI_API_KEY_FOR_LLM"] !== "false") return {
		provider: "openai",
		model: env["OPENAI_MODEL"] || "gpt-4o-mini",
		maxTokens,
		baseURL: env["OPENAI_BASE_URL"]
	};
	if (hasRealValue(env["MINIMAX_API_KEY"])) return {
		provider: "minimax",
		model: env["MINIMAX_MODEL"] || "MiniMax-M2.7",
		maxTokens
	};
	if (hasRealValue(env["ANTHROPIC_API_KEY"])) return {
		provider: "anthropic",
		model: env["ANTHROPIC_MODEL"] || "claude-sonnet-4-20250514",
		maxTokens,
		baseURL: env["ANTHROPIC_BASE_URL"]
	};
	if (hasRealValue(env["GEMINI_API_KEY"]) || hasRealValue(env["GOOGLE_API_KEY"])) {
		if (!hasRealValue(env["GEMINI_API_KEY"]) && hasRealValue(env["GOOGLE_API_KEY"])) process.stderr.write("[agentmemory] GOOGLE_API_KEY detected — treating as GEMINI_API_KEY. Set GEMINI_API_KEY in ~/.agentmemory/.env to silence this warning.\n");
		return {
			provider: "gemini",
			model: env["GEMINI_MODEL"] || "gemini-2.5-flash",
			maxTokens
		};
	}
	if (hasRealValue(env["OPENROUTER_API_KEY"])) return {
		provider: "openrouter",
		model: env["OPENROUTER_MODEL"] || "anthropic/claude-sonnet-4-20250514",
		maxTokens
	};
	if (!(env["AGENTMEMORY_ALLOW_AGENT_SDK"] === "true")) {
		process.stderr.write("[agentmemory] No LLM provider key found (ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, MINIMAX_API_KEY, OPENAI_API_KEY). LLM-backed compression and summarization are DISABLED — using no-op provider. This is the safe default: the agent-sdk fallback used to spawn Claude Agent SDK child sessions which inherit Claude Code's plugin hooks and cause infinite Stop-hook recursion (#149 follow-up). To opt in to the agent-sdk fallback anyway, set both AGENTMEMORY_AUTO_COMPRESS=true AND AGENTMEMORY_ALLOW_AGENT_SDK=true — but be aware it will burn your Claude Pro allocation and may still recurse if you use it from inside Claude Code itself.\n");
		return {
			provider: "noop",
			model: "noop",
			maxTokens
		};
	}
	process.stderr.write("[agentmemory] WARNING: agent-sdk fallback enabled via AGENTMEMORY_ALLOW_AGENT_SDK=true. This spawns @anthropic-ai/claude-agent-sdk child sessions that can trigger the Stop-hook recursion loop (#149 follow-up). A SDK-child env marker is set to block re-entry, but prefer setting a real API key in ~/.agentmemory/.env instead.\n");
	return {
		provider: "agent-sdk",
		model: "claude-sonnet-4-20250514",
		maxTokens
	};
}
function loadConfig() {
	const env = getMergedEnv();
	const provider = detectProvider(env);
	return {
		engineUrl: env["III_ENGINE_URL"] || "ws://localhost:49134",
		restPort: parseInt(env["III_REST_PORT"] || "3111", 10) || 3111,
		streamsPort: parseInt(env["III_STREAMS_PORT"] || "3112", 10) || 3112,
		provider,
		tokenBudget: safeParseInt(env["TOKEN_BUDGET"], 2e3),
		maxObservationsPerSession: safeParseInt(env["MAX_OBS_PER_SESSION"], 500),
		compressionModel: provider.model,
		dataDir: DATA_DIR
	};
}
function getMergedEnv(overrides) {
	return {
		...loadEnvFile(),
		...process.env,
		...overrides
	};
}
function getEnvVar(key) {
	return getMergedEnv()[key];
}
function detectLlmProviderKind() {
	const env = getMergedEnv();
	if (hasRealValue(env["ANTHROPIC_API_KEY"]) || hasRealValue(env["GEMINI_API_KEY"]) || hasRealValue(env["GOOGLE_API_KEY"]) || hasRealValue(env["OPENROUTER_API_KEY"]) || hasRealValue(env["MINIMAX_API_KEY"]) || hasRealValue(env["OPENAI_API_KEY"]) && env["OPENAI_API_KEY_FOR_LLM"] !== "false") return "llm";
	return "noop";
}
function loadEmbeddingConfig() {
	const env = getMergedEnv();
	let bm25Weight = parseFloat(env["BM25_WEIGHT"] || "0.4");
	let vectorWeight = parseFloat(env["VECTOR_WEIGHT"] || "0.6");
	bm25Weight = isNaN(bm25Weight) || bm25Weight < 0 ? .4 : Math.min(bm25Weight, 1);
	vectorWeight = isNaN(vectorWeight) || vectorWeight < 0 ? .6 : Math.min(vectorWeight, 1);
	return {
		provider: env["EMBEDDING_PROVIDER"] || void 0,
		bm25Weight,
		vectorWeight
	};
}
function detectEmbeddingProvider(env) {
	const source = env ?? getMergedEnv();
	const forced = source["EMBEDDING_PROVIDER"];
	if (forced) return forced;
	if (source["GEMINI_API_KEY"]) return "gemini";
	if (source["OPENAI_API_KEY"]) return "openai";
	if (source["VOYAGE_API_KEY"]) return "voyage";
	if (source["COHERE_API_KEY"]) return "cohere";
	if (source["OPENROUTER_API_KEY"]) return "openrouter";
	return null;
}
function loadClaudeBridgeConfig() {
	const env = getMergedEnv();
	const enabled = env["CLAUDE_MEMORY_BRIDGE"] === "true";
	const projectPath = env["CLAUDE_PROJECT_PATH"] || "";
	const lineBudget = safeParseInt(env["CLAUDE_MEMORY_LINE_BUDGET"], 200);
	let memoryFilePath = "";
	if (enabled && projectPath) {
		const safePath = projectPath.replace(/[/\\]/g, "-").replace(/^-/, "");
		memoryFilePath = join(homedir(), ".claude", "projects", safePath, "memory", "MEMORY.md");
	}
	return {
		enabled,
		projectPath,
		memoryFilePath,
		lineBudget
	};
}
function loadTeamConfig() {
	const env = getMergedEnv();
	const teamId = env["TEAM_ID"];
	const userId = env["USER_ID"];
	if (!teamId || !userId) return null;
	return {
		teamId,
		userId,
		mode: env["TEAM_MODE"] === "shared" ? "shared" : "private"
	};
}
function loadSnapshotConfig() {
	const env = getMergedEnv();
	return {
		enabled: env["SNAPSHOT_ENABLED"] === "true",
		interval: safeParseInt(env["SNAPSHOT_INTERVAL"], 3600),
		dir: env["SNAPSHOT_DIR"] || join(homedir(), ".agentmemory", "snapshots")
	};
}
function isGraphExtractionEnabled() {
	return getMergedEnv()["GRAPH_EXTRACTION_ENABLED"] === "true";
}
function isConsolidationEnabled() {
	return getMergedEnv()["CONSOLIDATION_ENABLED"] === "true";
}
function isAutoCompressEnabled() {
	return getMergedEnv()["AGENTMEMORY_AUTO_COMPRESS"] === "true";
}
function isContextInjectionEnabled() {
	return getMergedEnv()["AGENTMEMORY_INJECT_CONTEXT"] === "true";
}
function getConsolidationDecayDays() {
	return safeParseInt(getMergedEnv()["CONSOLIDATION_DECAY_DAYS"], 30);
}
const VALID_PROVIDERS = new Set([
	"anthropic",
	"gemini",
	"openrouter",
	"agent-sdk",
	"minimax",
	"openai"
]);
function loadFallbackConfig() {
	const env = getMergedEnv();
	const raw = env["FALLBACK_PROVIDERS"] || "";
	const allowAgentSdk = env["AGENTMEMORY_ALLOW_AGENT_SDK"] === "true";
	return { providers: raw.split(",").map((p) => p.trim()).filter((p) => Boolean(p) && VALID_PROVIDERS.has(p)).filter((p) => {
		if (p === "agent-sdk" && !allowAgentSdk) {
			process.stderr.write("[agentmemory] Ignoring FALLBACK_PROVIDERS entry 'agent-sdk' (AGENTMEMORY_ALLOW_AGENT_SDK is not 'true'). The agent-sdk fallback can spawn Claude Agent SDK child sessions that trigger the Stop-hook recursion loop (#149 follow-up). Opt in explicitly with AGENTMEMORY_ALLOW_AGENT_SDK=true if this is intentional.\n");
			return false;
		}
		return true;
	}) };
}

//#endregion
//#region src/providers/agent-sdk.ts
var AgentSDKProvider = class {
	name = "agent-sdk";
	async compress(systemPrompt, userPrompt) {
		return this.query(systemPrompt, userPrompt);
	}
	async summarize(systemPrompt, userPrompt) {
		return this.query(systemPrompt, userPrompt);
	}
	async query(systemPrompt, userPrompt) {
		if (process.env.AGENTMEMORY_SDK_CHILD === "1") return "";
		const prev = process.env.AGENTMEMORY_SDK_CHILD;
		process.env.AGENTMEMORY_SDK_CHILD = "1";
		try {
			const { query } = await import("@anthropic-ai/claude-agent-sdk");
			const messages = query({
				prompt: userPrompt,
				options: {
					systemPrompt,
					maxTurns: 1,
					allowedTools: []
				}
			});
			let result = "";
			for await (const msg of messages) if (msg.type === "result") result = msg.result ?? "";
			return result;
		} finally {
			if (prev === void 0) delete process.env.AGENTMEMORY_SDK_CHILD;
			else process.env.AGENTMEMORY_SDK_CHILD = prev;
		}
	}
};

//#endregion
//#region src/providers/anthropic.ts
var AnthropicProvider = class {
	name = "anthropic";
	client;
	model;
	maxTokens;
	constructor(apiKey, model, maxTokens, baseURL) {
		this.client = new Anthropic({
			apiKey,
			...baseURL ? { baseURL } : {}
		});
		this.model = model;
		this.maxTokens = maxTokens;
	}
	async compress(systemPrompt, userPrompt) {
		return this.call(systemPrompt, userPrompt);
	}
	async summarize(systemPrompt, userPrompt) {
		return this.call(systemPrompt, userPrompt);
	}
	async describeImage(imageData, mimeType, prompt) {
		return (await this.client.messages.create({
			model: this.model,
			max_tokens: this.maxTokens,
			messages: [{
				role: "user",
				content: [{
					type: "image",
					source: {
						type: "base64",
						media_type: mimeType,
						data: imageData
					}
				}, {
					type: "text",
					text: prompt
				}]
			}]
		})).content.find((b) => b.type === "text")?.text ?? "";
	}
	async call(systemPrompt, userPrompt) {
		return (await this.client.messages.create({
			model: this.model,
			max_tokens: this.maxTokens,
			system: systemPrompt,
			messages: [{
				role: "user",
				content: userPrompt
			}]
		})).content.find((b) => b.type === "text")?.text ?? "";
	}
};

//#endregion
//#region src/providers/_fetch.ts
function fetchWithTimeout(url, init, timeoutMs) {
	const parsed = timeoutMs ?? Number.parseInt(getEnvVar("AGENTMEMORY_LLM_TIMEOUT_MS") ?? "60000", 10);
	const ms = Number.isFinite(parsed) && parsed > 0 ? parsed : 6e4;
	const ctl = new AbortController();
	const signal = init.signal ? AbortSignal.any([init.signal, ctl.signal]) : ctl.signal;
	const t = setTimeout(() => ctl.abort(), ms);
	return fetch(url, {
		...init,
		signal
	}).finally(() => clearTimeout(t));
}

//#endregion
//#region src/providers/minimax.ts
/**
* MiniMax provider using raw fetch to call MiniMax's Anthropic-compatible API.
*
* The Anthropic SDK automatically injects `x-stainless-*` headers that MiniMax
* rejects with 403. This provider bypasses the SDK and calls the API directly.
*
* Required env vars (loaded from ~/.agentmemory/.env or process.env):
*   MINIMAX_API_KEY  — your MiniMax API key
*   MINIMAX_MODEL    — model name (default: MiniMax-M2.7)
*   MAX_TOKENS       — max output tokens (default: 800; MiniMax-M2.7 needs ≤800)
*
* Optional:
*   MINIMAX_BASE_URL — base URL without path (default: https://api.minimax.io/anthropic)
*/
var MinimaxProvider = class {
	name = "minimax";
	apiKey;
	model;
	maxTokens;
	baseUrl;
	constructor(apiKey, model, maxTokens) {
		this.apiKey = apiKey;
		this.model = model;
		this.maxTokens = maxTokens;
		this.baseUrl = getEnvVar("MINIMAX_BASE_URL") || "https://api.minimax.io/anthropic";
	}
	async compress(systemPrompt, userPrompt) {
		return this.call(systemPrompt, userPrompt);
	}
	async summarize(systemPrompt, userPrompt) {
		return this.call(systemPrompt, userPrompt);
	}
	async call(systemPrompt, userPrompt) {
		const response = await fetchWithTimeout(`${this.baseUrl}/v1/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-api-key": this.apiKey,
				"anthropic-version": "2023-06-01"
			},
			body: JSON.stringify({
				model: this.model,
				max_tokens: this.maxTokens,
				system: systemPrompt,
				messages: [{
					role: "user",
					content: userPrompt
				}]
			})
		});
		if (!response.ok) {
			const text = await response.text();
			throw new Error(`MiniMax API error ${response.status}: ${text}`);
		}
		return ((await response.json()).content?.find((b) => b.type === "text"))?.text ?? "";
	}
};

//#endregion
//#region src/providers/noop.ts
/**
* Returns empty strings for every call. Used when no LLM API key is set
* AND the user has not opted into the agent-sdk fallback via
* AGENTMEMORY_ALLOW_AGENT_SDK=true. Callers (compress, summarize) must
* detect the empty result and short-circuit instead of spawning a
* provider session (#149 / Stop-hook recursion loop fix).
*/
var NoopProvider = class {
	name = "noop";
	async compress() {
		return "";
	}
	async summarize() {
		return "";
	}
};

//#endregion
//#region src/providers/_openai-shared.ts
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com";
const DEFAULT_AZURE_API_VERSION = "2024-08-01-preview";
function detectAzure(baseUrl) {
	try {
		return new URL(baseUrl).hostname.endsWith(".openai.azure.com");
	} catch {
		return false;
	}
}
function azureStyleOf(baseUrl) {
	try {
		const u = new URL(baseUrl);
		if (/\/openai\/deployments\//.test(u.pathname)) return "legacy";
		return "v1";
	} catch {
		return "v1";
	}
}
function legacyAzureUrl(baseUrl, path, apiVersion) {
	const url = new URL(baseUrl);
	url.pathname = `${url.pathname.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
	url.searchParams.set("api-version", apiVersion);
	return url.toString();
}
function v1AzureUrl(baseUrl, path) {
	const url = new URL(baseUrl);
	const route = path.startsWith("/") ? path.slice(1) : path;
	url.pathname = `${url.pathname.replace(/\/?openai(?:\/v1)?\/?$/, "").replace(/\/+$/, "")}/openai/v1/${route}`;
	return url.toString();
}
function buildChatUrl(baseUrl, isAzure, azureApiVersion) {
	if (isAzure) return azureStyleOf(baseUrl) === "legacy" ? legacyAzureUrl(baseUrl, "/chat/completions", azureApiVersion) : v1AzureUrl(baseUrl, "/chat/completions");
	return `${baseUrl}/v1/chat/completions`;
}
function buildEmbeddingUrl(baseUrl, isAzure, azureApiVersion) {
	if (isAzure) return azureStyleOf(baseUrl) === "legacy" ? legacyAzureUrl(baseUrl, "/embeddings", azureApiVersion) : v1AzureUrl(baseUrl, "/embeddings");
	return `${baseUrl}/v1/embeddings`;
}
function buildAuthHeaders(apiKey, isAzure) {
	if (isAzure) return {
		"Content-Type": "application/json",
		"api-key": apiKey
	};
	return {
		"Content-Type": "application/json",
		Authorization: `Bearer ${apiKey}`
	};
}
function normalizeBaseUrl(raw) {
	return (raw || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, "");
}

//#endregion
//#region src/providers/openai.ts
const DEFAULT_TIMEOUT_MS = 6e4;
/**
* OpenAI-compatible LLM provider.
*
* Uses raw fetch (no SDK) to support any OpenAI-compatible endpoint:
*   - OpenAI official
*   - Azure OpenAI (auto-detected from .openai.azure.com host)
*   - DeepSeek
*   - 硅基流动 (SiliconFlow)
*   - vLLM / LM Studio / Ollama (with OpenAI compatibility layer)
*   - Any other proxy implementing /v1/chat/completions
*
* Required env vars:
*   OPENAI_API_KEY  — API key
*
* Optional:
*   OPENAI_BASE_URL          — base URL without path (default: https://api.openai.com).
*                              Azure: https://<resource>.openai.azure.com/openai/deployments/<deployment>
*   OPENAI_MODEL             — model name (default: gpt-4o-mini)
*   OPENAI_API_VERSION       — Azure api-version query param (default: 2024-08-01-preview)
*   OPENAI_TIMEOUT_MS        — outbound fetch timeout in ms (OpenAI-scoped alias,
*                              takes precedence over AGENTMEMORY_LLM_TIMEOUT_MS
*                              for back-compat with the v0.9.17 shipping name).
*   AGENTMEMORY_LLM_TIMEOUT_MS — outbound fetch timeout in ms shared across all
*                              raw-fetch LLM + embedding providers. Used when
*                              OPENAI_TIMEOUT_MS is not set. Default: 60000.
*   MAX_TOKENS               — max output tokens (default: from config or 4096)
*   OPENAI_REASONING_EFFORT  — "low" | "medium" | "high" | "none"
*                              Passthrough for reasoning models (e.g. Ollama Cloud
*                              thinking models). Set to "none" to ensure
*                              message.content is populated instead of only
*                              message.reasoning.
*/
var OpenAIProvider = class {
	name = "openai";
	apiKey;
	model;
	maxTokens;
	baseUrl;
	reasoningEffort;
	timeoutMs;
	isAzure;
	azureApiVersion;
	constructor(apiKey, model, maxTokens, baseURL) {
		this.apiKey = apiKey;
		this.model = model;
		this.maxTokens = maxTokens;
		this.baseUrl = normalizeBaseUrl(baseURL || getEnvVar("OPENAI_BASE_URL"));
		this.reasoningEffort = getEnvVar("OPENAI_REASONING_EFFORT") || void 0;
		this.timeoutMs = resolveTimeout();
		this.azureApiVersion = getEnvVar("OPENAI_API_VERSION") || DEFAULT_AZURE_API_VERSION;
		this.isAzure = detectAzure(this.baseUrl);
	}
	async compress(systemPrompt, userPrompt) {
		return this.call(systemPrompt, userPrompt);
	}
	async summarize(systemPrompt, userPrompt) {
		return this.call(systemPrompt, userPrompt);
	}
	async call(systemPrompt, userPrompt) {
		const url = buildChatUrl(this.baseUrl, this.isAzure, this.azureApiVersion);
		const body = {
			model: this.model,
			max_tokens: this.maxTokens,
			messages: [{
				role: "system",
				content: systemPrompt
			}, {
				role: "user",
				content: userPrompt
			}]
		};
		if (this.reasoningEffort) body.reasoning_effort = this.reasoningEffort;
		let response;
		try {
			response = await fetchWithTimeout(url, {
				method: "POST",
				headers: buildAuthHeaders(this.apiKey, this.isAzure),
				body: JSON.stringify(body)
			}, this.timeoutMs);
		} catch (err) {
			if (err instanceof Error && err.name === "AbortError") throw new Error(`OpenAI API request timed out after ${this.timeoutMs}ms — set OPENAI_TIMEOUT_MS (or AGENTMEMORY_LLM_TIMEOUT_MS) to raise the bound or check the provider status.`);
			throw err;
		}
		if (!response.ok) {
			const text = await response.text();
			throw new Error(`OpenAI API error (${response.status}): ${text}`);
		}
		const data = await response.json();
		const message = data.choices?.[0]?.message;
		const content = message?.content;
		if (content) return content;
		const reasoning = message?.reasoning;
		if (reasoning) return reasoning;
		throw new Error(`OpenAI returned unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
	}
};
function resolveTimeout() {
	const openai = parsePositiveInt(getEnvVar("OPENAI_TIMEOUT_MS"));
	if (openai !== void 0) return openai;
	const globalMs = parsePositiveInt(getEnvVar("AGENTMEMORY_LLM_TIMEOUT_MS"));
	if (globalMs !== void 0) return globalMs;
	return DEFAULT_TIMEOUT_MS;
}
function parsePositiveInt(raw) {
	if (!raw) return void 0;
	const trimmed = raw.trim();
	if (!/^\d+$/.test(trimmed)) return void 0;
	const n = Number(trimmed);
	return Number.isFinite(n) && n > 0 ? n : void 0;
}

//#endregion
//#region src/providers/openrouter.ts
var OpenRouterProvider = class {
	name;
	apiKey;
	model;
	maxTokens;
	baseUrl;
	constructor(apiKey, model, maxTokens, baseUrl) {
		this.apiKey = apiKey;
		this.model = model;
		this.maxTokens = maxTokens;
		this.baseUrl = baseUrl;
		this.name = baseUrl.includes("openrouter") ? "openrouter" : "gemini";
	}
	async compress(systemPrompt, userPrompt) {
		return this.call(systemPrompt, userPrompt);
	}
	async summarize(systemPrompt, userPrompt) {
		return this.call(systemPrompt, userPrompt);
	}
	async call(systemPrompt, userPrompt) {
		const response = await fetchWithTimeout(this.baseUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
				...this.baseUrl.includes("openrouter") ? { "HTTP-Referer": "https://github.com/rohitg00/agentmemory" } : {}
			},
			body: JSON.stringify({
				model: this.model,
				max_tokens: this.maxTokens,
				messages: [{
					role: "system",
					content: systemPrompt
				}, {
					role: "user",
					content: userPrompt
				}]
			})
		});
		if (!response.ok) {
			const text = await response.text();
			throw new Error(`${this.name} API error (${response.status}): ${text}`);
		}
		const data = await response.json();
		const content = data.choices?.[0]?.message?.content;
		if (!content) throw new Error(`${this.name} returned unexpected response: ${JSON.stringify(data).slice(0, 200)}`);
		return content;
	}
};

//#endregion
//#region src/providers/circuit-breaker.ts
function positiveFinite(val, fallback) {
	return Number.isFinite(val) && val > 0 ? val : fallback;
}
var CircuitBreaker = class {
	state = "closed";
	failures = 0;
	lastFailureAt = null;
	openedAt = null;
	failureThreshold;
	failureWindowMs;
	recoveryTimeoutMs;
	constructor(opts) {
		this.failureThreshold = Math.max(1, Math.floor(positiveFinite(opts?.failureThreshold, 3)));
		this.failureWindowMs = positiveFinite(opts?.failureWindowMs, 6e4);
		this.recoveryTimeoutMs = positiveFinite(opts?.recoveryTimeoutMs, 3e4);
	}
	get isAllowed() {
		if (this.state === "closed") return true;
		if (this.state === "open") {
			if (this.openedAt && Date.now() - this.openedAt >= this.recoveryTimeoutMs) {
				this.state = "half-open";
				return true;
			}
			return false;
		}
		return true;
	}
	recordSuccess() {
		if (this.state === "half-open") {
			this.state = "closed";
			this.failures = 0;
			this.lastFailureAt = null;
			this.openedAt = null;
		}
	}
	recordFailure() {
		const now = Date.now();
		if (this.state === "half-open") {
			this.state = "open";
			this.openedAt = now;
			return;
		}
		if (this.lastFailureAt && now - this.lastFailureAt > this.failureWindowMs) this.failures = 0;
		this.failures += 1;
		this.lastFailureAt = now;
		if (this.failures >= this.failureThreshold) {
			this.state = "open";
			this.openedAt = now;
		}
	}
	getState() {
		return {
			state: this.state,
			failures: this.failures,
			lastFailureAt: this.lastFailureAt,
			openedAt: this.openedAt
		};
	}
};

//#endregion
//#region src/providers/resilient.ts
var ResilientProvider = class {
	breaker = new CircuitBreaker();
	name;
	constructor(inner) {
		this.inner = inner;
		this.name = `resilient(${inner.name})`;
	}
	async call(fn) {
		if (!this.breaker.isAllowed) throw new Error("circuit_breaker_open");
		try {
			const result = await fn();
			this.breaker.recordSuccess();
			return result;
		} catch (err) {
			this.breaker.recordFailure();
			throw err;
		}
	}
	async compress(systemPrompt, userPrompt) {
		return this.call(() => this.inner.compress(systemPrompt, userPrompt));
	}
	async summarize(systemPrompt, userPrompt) {
		return this.call(() => this.inner.summarize(systemPrompt, userPrompt));
	}
	get circuitState() {
		return this.breaker.getState();
	}
};

//#endregion
//#region src/providers/fallback-chain.ts
var FallbackChainProvider = class {
	name;
	constructor(providers) {
		this.providers = providers;
		this.name = `fallback(${providers.map((p) => p.name).join(" -> ")})`;
	}
	async compress(systemPrompt, userPrompt) {
		return this.tryAll((p) => p.compress(systemPrompt, userPrompt));
	}
	async summarize(systemPrompt, userPrompt) {
		return this.tryAll((p) => p.summarize(systemPrompt, userPrompt));
	}
	async tryAll(fn) {
		let lastError = null;
		for (const provider of this.providers) try {
			return await fn(provider);
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
		}
		throw lastError || /* @__PURE__ */ new Error("No providers available");
	}
};

//#endregion
//#region src/providers/embedding/gemini.ts
const BATCH_LIMIT = 100;
const MODEL = "models/gemini-embedding-001";
const API_BASE = `https://generativelanguage.googleapis.com/v1beta/${MODEL}:batchEmbedContents`;
var GeminiEmbeddingProvider = class {
	name = "gemini";
	dimensions = 768;
	apiKey;
	constructor(apiKey) {
		this.apiKey = apiKey || getEnvVar("GEMINI_API_KEY") || "";
		if (!this.apiKey) throw new Error("GEMINI_API_KEY is required");
	}
	async embed(text) {
		const [result] = await this.embedBatch([text]);
		return result;
	}
	async embedBatch(texts) {
		const results = [];
		for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
			const chunk = texts.slice(i, i + BATCH_LIMIT);
			const response = await fetchWithTimeout(`${API_BASE}?key=${this.apiKey}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ requests: chunk.map((t) => ({
					model: MODEL,
					content: { parts: [{ text: t }] },
					outputDimensionality: this.dimensions
				})) })
			});
			if (!response.ok) {
				const err = await response.text();
				throw new Error(`Gemini embedding failed (${response.status}): ${err}`);
			}
			const data = await response.json();
			for (const emb of data.embeddings) results.push(l2Normalize(new Float32Array(emb.values)));
		}
		return results;
	}
};
let zeroNormWarned = false;
function l2Normalize(vec) {
	let sum = 0;
	for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
	const norm = Math.sqrt(sum);
	if (norm === 0) {
		if (!zeroNormWarned) {
			zeroNormWarned = true;
			process.stderr.write(`[agentmemory] warn: gemini-embedding-001 returned a zero-norm embedding (length=${vec.length}); leaving it un-normalized. Subsequent zero-norm vectors will not be reported.\n`);
		}
		return vec;
	}
	for (let i = 0; i < vec.length; i++) vec[i] = vec[i] / norm;
	return vec;
}

//#endregion
//#region src/providers/embedding/openai.ts
const DEFAULT_MODEL$1 = "text-embedding-3-small";
/**
* Known OpenAI embedding model dimensions. Extend as new models ship.
* Override in any case via OPENAI_EMBEDDING_DIMENSIONS for custom or
* self-hosted OpenAI-compatible endpoints returning non-standard sizes.
*/
const MODEL_DIMENSIONS = {
	"text-embedding-3-small": 1536,
	"text-embedding-3-large": 3072,
	"text-embedding-ada-002": 1536
};
const DEFAULT_DIMENSIONS = MODEL_DIMENSIONS[DEFAULT_MODEL$1] ?? 1536;
function resolveDimensions(model, override) {
	if (override !== void 0 && override.trim().length > 0) {
		const parsed = parseInt(override, 10);
		if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`OPENAI_EMBEDDING_DIMENSIONS must be a positive integer, got: ${override}`);
		return parsed;
	}
	return MODEL_DIMENSIONS[model] ?? DEFAULT_DIMENSIONS;
}
/**
* OpenAI-compatible embedding provider.
*
* Shares transport (URL builder, auth header, Azure detection) with
* the OpenAI LLM provider via `_openai-shared` (#371). Same env knobs
* pick up automatically: when `OPENAI_BASE_URL` points at an Azure
* resource (`.openai.azure.com` hostname) the embedding request uses
* Azure's `/embeddings` path with the `api-version` query param and
* `api-key` header instead of `Authorization: Bearer`.
*
* Required env vars:
*   OPENAI_API_KEY            — API key
*
* Optional:
*   OPENAI_BASE_URL           — base URL without path (default: https://api.openai.com).
*                               Azure: https://<resource>.openai.azure.com/openai/deployments/<deployment>
*   OPENAI_API_VERSION        — Azure api-version query param (default: 2024-08-01-preview)
*   OPENAI_EMBEDDING_MODEL    — model name (default: text-embedding-3-small)
*   OPENAI_EMBEDDING_DIMENSIONS — override reported dimensions (required for
*                                 custom / self-hosted models not in the
*                                 MODEL_DIMENSIONS table above)
*/
var OpenAIEmbeddingProvider = class {
	name = "openai";
	dimensions;
	apiKey;
	baseUrl;
	model;
	isAzure;
	azureApiVersion;
	constructor(apiKey) {
		this.apiKey = apiKey || getEnvVar("OPENAI_API_KEY") || "";
		if (!this.apiKey) throw new Error("OPENAI_API_KEY is required");
		this.baseUrl = normalizeBaseUrl(getEnvVar("OPENAI_BASE_URL"));
		this.model = getEnvVar("OPENAI_EMBEDDING_MODEL") || DEFAULT_MODEL$1;
		this.dimensions = resolveDimensions(this.model, getEnvVar("OPENAI_EMBEDDING_DIMENSIONS"));
		this.isAzure = detectAzure(this.baseUrl);
		this.azureApiVersion = getEnvVar("OPENAI_API_VERSION") || DEFAULT_AZURE_API_VERSION;
	}
	async embed(text) {
		const [result] = await this.embedBatch([text]);
		return result;
	}
	async embedBatch(texts) {
		const response = await fetchWithTimeout(buildEmbeddingUrl(this.baseUrl, this.isAzure, this.azureApiVersion), {
			method: "POST",
			headers: buildAuthHeaders(this.apiKey, this.isAzure),
			body: JSON.stringify({
				model: this.model,
				input: texts
			})
		});
		if (!response.ok) {
			const err = await response.text();
			throw new Error(`OpenAI embedding failed (${response.status}): ${err}`);
		}
		return (await response.json()).data.map((d) => new Float32Array(d.embedding));
	}
};

//#endregion
//#region src/providers/embedding/voyage.ts
const API_URL$2 = "https://api.voyageai.com/v1/embeddings";
var VoyageEmbeddingProvider = class {
	name = "voyage";
	dimensions = 1024;
	apiKey;
	constructor(apiKey) {
		this.apiKey = apiKey || getEnvVar("VOYAGE_API_KEY") || "";
		if (!this.apiKey) throw new Error("VOYAGE_API_KEY is required");
	}
	async embed(text) {
		const [result] = await this.embedBatch([text]);
		return result;
	}
	async embedBatch(texts) {
		const response = await fetchWithTimeout(API_URL$2, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: "voyage-code-3",
				input: texts,
				input_type: "document"
			})
		});
		if (!response.ok) {
			const err = await response.text();
			throw new Error(`Voyage embedding failed (${response.status}): ${err}`);
		}
		return (await response.json()).data.map((d) => new Float32Array(d.embedding));
	}
};

//#endregion
//#region src/providers/embedding/cohere.ts
const API_URL$1 = "https://api.cohere.ai/v1/embed";
var CohereEmbeddingProvider = class {
	name = "cohere";
	dimensions = 1024;
	apiKey;
	constructor(apiKey) {
		this.apiKey = apiKey || getEnvVar("COHERE_API_KEY") || "";
		if (!this.apiKey) throw new Error("COHERE_API_KEY is required");
	}
	async embed(text) {
		const [result] = await this.embedBatch([text]);
		return result;
	}
	async embedBatch(texts) {
		const response = await fetchWithTimeout(API_URL$1, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: "embed-english-v3.0",
				texts,
				input_type: "search_document"
			})
		});
		if (!response.ok) {
			const err = await response.text();
			throw new Error(`Cohere embedding failed (${response.status}): ${err}`);
		}
		return (await response.json()).embeddings.map((e) => new Float32Array(e));
	}
};

//#endregion
//#region src/providers/embedding/openrouter.ts
const API_URL = "https://openrouter.ai/api/v1/embeddings";
var OpenRouterEmbeddingProvider = class {
	name = "openrouter";
	dimensions = 1536;
	apiKey;
	model;
	constructor(apiKey) {
		this.apiKey = apiKey || getEnvVar("OPENROUTER_API_KEY") || "";
		if (!this.apiKey) throw new Error("OPENROUTER_API_KEY is required");
		this.model = getEnvVar("OPENROUTER_EMBEDDING_MODEL") || "openai/text-embedding-3-small";
	}
	async embed(text) {
		const [result] = await this.embedBatch([text]);
		return result;
	}
	async embedBatch(texts) {
		const response = await fetchWithTimeout(API_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.apiKey}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: this.model,
				input: texts
			})
		});
		if (!response.ok) {
			const err = await response.text();
			throw new Error(`OpenRouter embedding failed (${response.status}): ${err}`);
		}
		return (await response.json()).data.map((d) => new Float32Array(d.embedding));
	}
};

//#endregion
//#region src/providers/embedding/local.ts
var LocalEmbeddingProvider = class {
	name = "local";
	dimensions = 384;
	extractor = null;
	async embed(text) {
		const [result] = await this.embedBatch([text]);
		return result;
	}
	async embedBatch(texts) {
		return (await (await this.getExtractor())(texts, {
			pooling: "mean",
			normalize: true
		})).tolist().map((v) => new Float32Array(v));
	}
	async getExtractor() {
		if (this.extractor) return this.extractor;
		let transformers;
		try {
			transformers = await import("@xenova/transformers");
		} catch {
			throw new Error("Install @xenova/transformers for local embeddings: npm install @xenova/transformers");
		}
		this.extractor = await transformers.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
		return this.extractor;
	}
};

//#endregion
//#region src/providers/embedding/clip.ts
const DEFAULT_MODEL = "Xenova/clip-vit-base-patch32";
const DIMENSIONS = 512;
var ClipEmbeddingProvider = class {
	name = "clip";
	dimensions = DIMENSIONS;
	textExtractor = null;
	imageExtractor = null;
	transformers = null;
	modelId;
	constructor(modelId = DEFAULT_MODEL) {
		this.modelId = modelId;
	}
	async embed(text) {
		const [vec] = await this.embedBatch([text]);
		return vec;
	}
	async embedBatch(texts) {
		return (await (await this.getTextExtractor())(texts, {
			pooling: "mean",
			normalize: true
		})).tolist().map((v) => new Float32Array(v));
	}
	async embedImage(src) {
		const image = await loadImage(await this.getTransformers(), src);
		const output = await (await this.getImageExtractor())(image);
		return normalize(output.data ?? new Float32Array(output.tolist()[0] || []));
	}
	async getTransformers() {
		if (this.transformers) return this.transformers;
		try {
			this.transformers = await import("@xenova/transformers");
		} catch {
			throw new Error("Install @xenova/transformers for CLIP image embeddings: npm install @xenova/transformers");
		}
		return this.transformers;
	}
	async getTextExtractor() {
		if (this.textExtractor) return this.textExtractor;
		this.textExtractor = await (await this.getTransformers()).pipeline("feature-extraction", this.modelId);
		return this.textExtractor;
	}
	async getImageExtractor() {
		if (this.imageExtractor) return this.imageExtractor;
		this.imageExtractor = await (await this.getTransformers()).pipeline("image-feature-extraction", this.modelId);
		return this.imageExtractor;
	}
};
async function loadImage(t, src) {
	if (src.startsWith("data:")) {
		const comma = src.indexOf(",");
		const b64 = comma >= 0 ? src.slice(comma + 1) : src;
		const buf = Buffer.from(b64, "base64");
		const blob = new Blob([buf]);
		return t.RawImage.fromBlob(blob);
	}
	const data = await readFile(src);
	const blob = new Blob([data]);
	return t.RawImage.fromBlob(blob);
}
function normalize(vec) {
	let sum = 0;
	for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
	const norm = Math.sqrt(sum);
	if (norm === 0) return vec;
	const out = new Float32Array(vec.length);
	for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
	return out;
}

//#endregion
//#region src/providers/embedding/index.ts
let imageEmbeddingProvider = null;
function createImageEmbeddingProvider() {
	if (process.env["AGENTMEMORY_IMAGE_EMBEDDINGS"] !== "true") return null;
	if (imageEmbeddingProvider) return imageEmbeddingProvider;
	imageEmbeddingProvider = withDimensionGuard(new ClipEmbeddingProvider());
	return imageEmbeddingProvider;
}
function createEmbeddingProvider() {
	const detected = detectEmbeddingProvider();
	if (!detected) return null;
	switch (detected) {
		case "gemini": return withDimensionGuard(new GeminiEmbeddingProvider(getEnvVar("GEMINI_API_KEY")));
		case "openai": return withDimensionGuard(new OpenAIEmbeddingProvider(getEnvVar("OPENAI_API_KEY")));
		case "voyage": return withDimensionGuard(new VoyageEmbeddingProvider(getEnvVar("VOYAGE_API_KEY")));
		case "cohere": return withDimensionGuard(new CohereEmbeddingProvider(getEnvVar("COHERE_API_KEY")));
		case "openrouter": return withDimensionGuard(new OpenRouterEmbeddingProvider(getEnvVar("OPENROUTER_API_KEY")));
		case "local": return withDimensionGuard(new LocalEmbeddingProvider());
		default: return null;
	}
}
function withDimensionGuard(provider) {
	const expected = provider.dimensions;
	const check = (v, where) => {
		if (v.length !== expected) throw new Error(`Embedding dimension mismatch in ${provider.name}.${where}: expected ${expected}, got ${v.length}`);
		return v;
	};
	const wrapped = Object.create(provider);
	wrapped.embed = async (t) => check(await provider.embed(t), "embed");
	wrapped.embedBatch = async (ts) => {
		const out = await provider.embedBatch(ts);
		out.forEach((v, i) => check(v, `embedBatch[${i}]`));
		return out;
	};
	if (provider.embedImage) wrapped.embedImage = async (s) => check(await provider.embedImage(s), "embedImage");
	return wrapped;
}

//#endregion
//#region src/providers/index.ts
function requireEnvVar(key) {
	const value = getEnvVar(key);
	if (!value) throw new Error(`Missing required environment variable: ${key}. Set it in ~/.agentmemory/.env or as an environment variable.`);
	return value;
}
function createProvider(config) {
	return new ResilientProvider(createBaseProvider(config));
}
function createFallbackProvider(config, fallbackConfig) {
	if (fallbackConfig.providers.length === 0) return createProvider(config);
	const providers = [createBaseProvider(config)];
	for (const providerType of fallbackConfig.providers) {
		if (providerType === config.provider) continue;
		try {
			const fbConfig = {
				provider: providerType,
				model: config.model,
				maxTokens: config.maxTokens
			};
			providers.push(createBaseProvider(fbConfig));
		} catch {}
	}
	if (providers.length > 1) return new ResilientProvider(new FallbackChainProvider(providers));
	return new ResilientProvider(providers[0]);
}
function createBaseProvider(config) {
	switch (config.provider) {
		case "minimax": return new MinimaxProvider(requireEnvVar("MINIMAX_API_KEY"), config.model, config.maxTokens);
		case "anthropic": return new AnthropicProvider(requireEnvVar("ANTHROPIC_API_KEY"), config.model, config.maxTokens, config.baseURL);
		case "gemini": {
			const geminiKey = getEnvVar("GEMINI_API_KEY") || getEnvVar("GOOGLE_API_KEY");
			if (!geminiKey) throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is required for the gemini provider");
			return new OpenRouterProvider(geminiKey, config.model, config.maxTokens, "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
		}
		case "openrouter": return new OpenRouterProvider(requireEnvVar("OPENROUTER_API_KEY"), config.model, config.maxTokens, "https://openrouter.ai/api/v1/chat/completions");
		case "openai": {
			const openaiKey = getEnvVar("OPENAI_API_KEY");
			if (!openaiKey) throw new Error("OPENAI_API_KEY is required for the openai provider");
			return new OpenAIProvider(openaiKey, config.model, config.maxTokens, config.baseURL);
		}
		case "noop": return new NoopProvider();
		default: return new AgentSDKProvider();
	}
}

//#endregion
//#region src/state/kv.ts
var StateKV = class {
	constructor(sdk) {
		this.sdk = sdk;
	}
	async get(scope, key) {
		return this.sdk.trigger({
			function_id: "state::get",
			payload: {
				scope,
				key
			}
		});
	}
	async set(scope, key, value) {
		return this.sdk.trigger({
			function_id: "state::set",
			payload: {
				scope,
				key,
				value
			}
		});
	}
	async update(scope, key, ops) {
		return this.sdk.trigger({
			function_id: "state::update",
			payload: {
				scope,
				key,
				ops
			}
		});
	}
	async delete(scope, key) {
		return this.sdk.trigger({
			function_id: "state::delete",
			payload: {
				scope,
				key
			}
		});
	}
	async list(scope) {
		return this.sdk.trigger({
			function_id: "state::list",
			payload: { scope }
		});
	}
};

//#endregion
//#region src/state/schema.ts
const KV = {
	sessions: "mem:sessions",
	observations: (sessionId) => `mem:obs:${sessionId}`,
	memories: "mem:memories",
	summaries: "mem:summaries",
	config: "mem:config",
	metrics: "mem:metrics",
	health: "mem:health",
	embeddings: (obsId) => `mem:emb:${obsId}`,
	bm25Index: "mem:index:bm25",
	relations: "mem:relations",
	profiles: "mem:profiles",
	claudeBridge: "mem:claude-bridge",
	graphNodes: "mem:graph:nodes",
	graphEdges: "mem:graph:edges",
	semantic: "mem:semantic",
	procedural: "mem:procedural",
	teamShared: (teamId) => `mem:team:${teamId}:shared`,
	teamUsers: (teamId, userId) => `mem:team:${teamId}:users:${userId}`,
	teamProfile: (teamId) => `mem:team:${teamId}:profile`,
	audit: "mem:audit",
	actions: "mem:actions",
	actionEdges: "mem:action-edges",
	leases: "mem:leases",
	routines: "mem:routines",
	routineRuns: "mem:routine-runs",
	signals: "mem:signals",
	checkpoints: "mem:checkpoints",
	mesh: "mem:mesh",
	sketches: "mem:sketches",
	facets: "mem:facets",
	sentinels: "mem:sentinels",
	crystals: "mem:crystals",
	lessons: "mem:lessons",
	insights: "mem:insights",
	graphEdgeHistory: "mem:graph:edge-history",
	enrichedChunks: (sessionId) => `mem:enriched:${sessionId}`,
	latentEmbeddings: (obsId) => `mem:latent:${obsId}`,
	retentionScores: "mem:retention",
	accessLog: "mem:access",
	imageRefs: "mem:image-refs",
	imageEmbeddings: "mem:image-embeddings",
	slots: "mem:slots",
	globalSlots: "mem:slots:global",
	state: "mem:state",
	commits: "mem:commits"
};
const STREAM = {
	name: "mem-live",
	group: (sessionId) => sessionId,
	viewerGroup: "viewer"
};
function generateId(prefix) {
	return `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}
function fingerprintId(prefix, content) {
	return `${prefix}_${createHash("sha256").update(content).digest("hex").slice(0, 16)}`;
}
function jaccardSimilarity(a, b) {
	const setA = new Set(a.split(/\s+/).filter((t) => t.length > 2));
	const setB = new Set(b.split(/\s+/).filter((t) => t.length > 2));
	if (setA.size === 0 && setB.size === 0) return 1;
	if (setA.size === 0 || setB.size === 0) return 0;
	let intersection = 0;
	for (const word of setA) if (setB.has(word)) intersection++;
	return intersection / (setA.size + setB.size - intersection);
}

//#endregion
//#region src/state/vector-index.ts
function float32ToBase64(arr) {
	return Buffer.from(arr.buffer).toString("base64");
}
function base64ToFloat32(b64) {
	return new Float32Array(Buffer.from(b64, "base64").buffer);
}
function cosineSimilarity(a, b) {
	if (a.length !== b.length) return 0;
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	return denom === 0 ? 0 : dot / denom;
}
var VectorIndex = class VectorIndex {
	vectors = /* @__PURE__ */ new Map();
	add(obsId, sessionId, embedding) {
		this.vectors.set(obsId, {
			embedding,
			sessionId
		});
	}
	remove(obsId) {
		this.vectors.delete(obsId);
	}
	search(query, limit = 20) {
		const results = [];
		let minScore = -Infinity;
		for (const [obsId, entry] of this.vectors) {
			const score = cosineSimilarity(query, entry.embedding);
			if (results.length < limit) {
				results.push({
					obsId,
					sessionId: entry.sessionId,
					score
				});
				if (results.length === limit) {
					results.sort((a, b) => a.score - b.score);
					minScore = results[0].score;
				}
			} else if (score > minScore) {
				results[0] = {
					obsId,
					sessionId: entry.sessionId,
					score
				};
				results.sort((a, b) => a.score - b.score);
				minScore = results[0].score;
			}
		}
		results.sort((a, b) => b.score - a.score);
		return results;
	}
	get size() {
		return this.vectors.size;
	}
	validateDimensions(expected) {
		const mismatches = [];
		const seenDimensions = /* @__PURE__ */ new Set();
		for (const [obsId, entry] of this.vectors) {
			const dim = entry.embedding.length;
			seenDimensions.add(dim);
			if (dim !== expected) mismatches.push({
				obsId,
				dim
			});
		}
		return {
			mismatches,
			seenDimensions
		};
	}
	clear() {
		this.vectors.clear();
	}
	restoreFrom(other) {
		const src = other.vectors;
		this.vectors = /* @__PURE__ */ new Map();
		for (const [obsId, entry] of src) this.vectors.set(obsId, {
			embedding: new Float32Array(entry.embedding),
			sessionId: entry.sessionId
		});
	}
	serialize() {
		const data = [];
		for (const [obsId, entry] of this.vectors) data.push([obsId, {
			embedding: float32ToBase64(entry.embedding),
			sessionId: entry.sessionId
		}]);
		return JSON.stringify(data);
	}
	static deserialize(json) {
		const idx = new VectorIndex();
		let data;
		try {
			data = JSON.parse(json);
		} catch {
			return idx;
		}
		if (!Array.isArray(data)) return idx;
		for (const row of data) try {
			if (!Array.isArray(row) || row.length < 2) continue;
			const [obsId, entry] = row;
			if (typeof obsId !== "string" || typeof entry?.embedding !== "string" || typeof entry?.sessionId !== "string") continue;
			idx.vectors.set(obsId, {
				embedding: base64ToFloat32(entry.embedding),
				sessionId: entry.sessionId
			});
		} catch {
			continue;
		}
		return idx;
	}
};

//#endregion
//#region src/state/memory-utils.ts
function memoryToObservation(memory) {
	return {
		id: memory.id,
		sessionId: memory.sessionIds[0] ?? "memory",
		timestamp: memory.createdAt,
		type: "decision",
		title: memory.title,
		facts: [memory.content],
		narrative: memory.content,
		concepts: memory.concepts,
		files: memory.files,
		importance: memory.strength
	};
}

//#endregion
//#region src/functions/graph-retrieval.ts
function buildGraphContext(path) {
	const parts = [];
	for (const step of path) {
		const props = Object.entries(step.node.properties).slice(0, 3).map(([k, v]) => `${k}=${v}`).join(", ");
		let line = `[${step.node.type}] ${step.node.name}`;
		if (props) line += ` (${props})`;
		if (step.edge) {
			line += ` --${step.edge.type}-->`;
			if (step.edge.context?.reasoning) line += ` [${step.edge.context.reasoning}]`;
			if (step.edge.tvalid) line += ` @${step.edge.tvalid}`;
		}
		parts.push(line);
	}
	return parts.join(" ");
}
var GraphRetrieval = class {
	constructor(kv) {
		this.kv = kv;
	}
	async searchByEntities(entityNames, maxDepth = 2, maxResults = 20) {
		const allNodes = (await this.kv.list(KV.graphNodes)).filter((n) => !n.stale);
		const allEdges = (await this.kv.list(KV.graphEdges)).filter((e) => !e.stale);
		const matchingNodes = allNodes.filter((n) => {
			const nameLower = n.name.toLowerCase();
			return entityNames.some((e) => nameLower.includes(e.toLowerCase()) || e.toLowerCase().includes(nameLower));
		});
		if (matchingNodes.length === 0) return [];
		const results = [];
		const visitedObs = /* @__PURE__ */ new Set();
		for (const startNode of matchingNodes) {
			const paths = this.dijkstraTraversal(startNode, allNodes, allEdges, maxDepth);
			for (const path of paths) {
				const lastNode = path[path.length - 1].node;
				for (const obsId of lastNode.sourceObservationIds) {
					if (visitedObs.has(obsId)) continue;
					visitedObs.add(obsId);
					const pathLength = path.length;
					const edgeWeights = path.filter((s) => s.edge).map((s) => s.edge.weight);
					const score = (edgeWeights.length > 0 ? edgeWeights.reduce((a, b) => a + b, 0) / edgeWeights.length : .5) * (1 / pathLength);
					results.push({
						obsId,
						sessionId: "",
						score,
						graphContext: buildGraphContext(path),
						pathLength
					});
				}
			}
			for (const obsId of startNode.sourceObservationIds) {
				if (visitedObs.has(obsId)) continue;
				visitedObs.add(obsId);
				results.push({
					obsId,
					sessionId: "",
					score: 1,
					graphContext: `[${startNode.type}] ${startNode.name}`,
					pathLength: 0
				});
			}
		}
		results.sort((a, b) => b.score - a.score);
		return results.slice(0, maxResults);
	}
	async expandFromChunks(obsIds, maxDepth = 1, maxResults = 10) {
		const allNodes = (await this.kv.list(KV.graphNodes)).filter((n) => !n.stale);
		const allEdges = (await this.kv.list(KV.graphEdges)).filter((e) => !e.stale);
		const linkedNodes = allNodes.filter((n) => n.sourceObservationIds.some((id) => obsIds.includes(id)));
		const results = [];
		const visitedObs = new Set(obsIds);
		for (const node of linkedNodes) {
			const paths = this.dijkstraTraversal(node, allNodes, allEdges, maxDepth);
			for (const path of paths) {
				const lastNode = path[path.length - 1].node;
				for (const obsId of lastNode.sourceObservationIds) {
					if (visitedObs.has(obsId)) continue;
					visitedObs.add(obsId);
					const pathLength = path.length;
					const score = .5 * (1 / (pathLength + 1));
					results.push({
						obsId,
						sessionId: "",
						score,
						graphContext: buildGraphContext(path),
						pathLength
					});
				}
			}
		}
		results.sort((a, b) => b.score - a.score);
		return results.slice(0, maxResults);
	}
	async temporalQuery(entityName, asOf) {
		const allNodes = (await this.kv.list(KV.graphNodes)).filter((n) => !n.stale);
		const allEdges = (await this.kv.list(KV.graphEdges)).filter((e) => !e.stale);
		const entity = allNodes.find((n) => n.name.toLowerCase() === entityName.toLowerCase());
		if (!entity) return {
			entity: null,
			currentState: [],
			history: []
		};
		const relatedEdges = allEdges.filter((e) => e.sourceNodeId === entity.id || e.targetNodeId === entity.id);
		if (!asOf) {
			const latestEdges = this.getLatestEdges(relatedEdges);
			return {
				entity,
				currentState: latestEdges,
				history: relatedEdges.filter((e) => !latestEdges.some((le) => le.id === e.id))
			};
		}
		const asOfDate = new Date(asOf).getTime();
		const validEdges = relatedEdges.filter((e) => {
			if (new Date(e.tcommit || e.createdAt).getTime() > asOfDate) return false;
			if (e.tvalid) {
				if (new Date(e.tvalid).getTime() > asOfDate) return false;
			}
			if (e.tvalidEnd) {
				if (new Date(e.tvalidEnd).getTime() < asOfDate) return false;
			}
			return true;
		});
		return {
			entity,
			currentState: this.getLatestEdges(validEdges),
			history: validEdges
		};
	}
	getLatestEdges(edges) {
		const byKey = /* @__PURE__ */ new Map();
		for (const e of edges) {
			const key = `${e.sourceNodeId}|${e.targetNodeId}|${e.type}`;
			if (!byKey.has(key)) byKey.set(key, []);
			byKey.get(key).push(e);
		}
		const latest = [];
		for (const group of byKey.values()) {
			if (group.length === 0) continue;
			group.sort((a, b) => new Date(b.tcommit || b.createdAt).getTime() - new Date(a.tcommit || a.createdAt).getTime());
			const newest = group.find((e) => e.isLatest !== false) || group[0];
			latest.push(newest);
		}
		return latest;
	}
	dijkstraTraversal(startNode, allNodes, allEdges, maxDepth) {
		const nodeIndex = /* @__PURE__ */ new Map();
		for (const n of allNodes) nodeIndex.set(n.id, n);
		const adjacency = /* @__PURE__ */ new Map();
		for (const edge of allEdges) {
			const a = edge.sourceNodeId;
			const b = edge.targetNodeId;
			if (!adjacency.has(a)) adjacency.set(a, []);
			if (!adjacency.has(b)) adjacency.set(b, []);
			adjacency.get(a).push({
				neighborId: b,
				edge
			});
			adjacency.get(b).push({
				neighborId: a,
				edge
			});
		}
		const dist = /* @__PURE__ */ new Map();
		const pathTo = /* @__PURE__ */ new Map();
		dist.set(startNode.id, 0);
		pathTo.set(startNode.id, [{ node: startNode }]);
		const heap = new MinHeap((a, b) => a.cost - b.cost);
		heap.push({
			nodeId: startNode.id,
			depth: 0,
			cost: 0
		});
		while (heap.size() > 0) {
			const { nodeId, depth, cost } = heap.pop();
			if (cost > (dist.get(nodeId) ?? Infinity)) continue;
			if (depth >= maxDepth) continue;
			const neighbors = adjacency.get(nodeId) ?? [];
			for (const { neighborId, edge } of neighbors) {
				const nextNode = nodeIndex.get(neighborId);
				if (!nextNode) continue;
				const newCost = cost + 1 / Math.max(edge.weight, .01);
				if (newCost < (dist.get(neighborId) ?? Infinity)) {
					dist.set(neighborId, newCost);
					pathTo.set(neighborId, [...pathTo.get(nodeId), {
						node: nextNode,
						edge
					}]);
					heap.push({
						nodeId: neighborId,
						depth: depth + 1,
						cost: newCost
					});
				}
			}
		}
		pathTo.delete(startNode.id);
		return Array.from(pathTo.values());
	}
};
var MinHeap = class {
	heap = [];
	constructor(compare) {
		this.compare = compare;
	}
	size() {
		return this.heap.length;
	}
	push(value) {
		this.heap.push(value);
		this.bubbleUp(this.heap.length - 1);
	}
	pop() {
		if (this.heap.length === 0) return void 0;
		const top = this.heap[0];
		const last = this.heap.pop();
		if (this.heap.length > 0) {
			this.heap[0] = last;
			this.sinkDown(0);
		}
		return top;
	}
	bubbleUp(i) {
		while (i > 0) {
			const parent = i - 1 >> 1;
			if (this.compare(this.heap[i], this.heap[parent]) < 0) {
				[this.heap[i], this.heap[parent]] = [this.heap[parent], this.heap[i]];
				i = parent;
			} else break;
		}
	}
	sinkDown(i) {
		const n = this.heap.length;
		while (true) {
			const left = 2 * i + 1;
			const right = 2 * i + 2;
			let smallest = i;
			if (left < n && this.compare(this.heap[left], this.heap[smallest]) < 0) smallest = left;
			if (right < n && this.compare(this.heap[right], this.heap[smallest]) < 0) smallest = right;
			if (smallest === i) break;
			[this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];
			i = smallest;
		}
	}
};

//#endregion
//#region src/logger.ts
function fmt(level, msg, fields) {
	if (!fields || Object.keys(fields).length === 0) return `[agentmemory] ${level} ${msg}`;
	try {
		return `[agentmemory] ${level} ${msg} ${JSON.stringify(fields)}`;
	} catch {
		return `[agentmemory] ${level} ${msg}`;
	}
}
function emit(level, msg, fields) {
	try {
		process.stderr.write(fmt(level, msg, fields) + "\n");
	} catch {}
}
const logger = {
	info(msg, fields) {
		emit("info", msg, fields);
	},
	warn(msg, fields) {
		emit("warn", msg, fields);
	},
	error(msg, fields) {
		emit("error", msg, fields);
	}
};
let bootVerbose = process.env["AGENTMEMORY_VERBOSE"] === "1" || process.env["AGENTMEMORY_VERBOSE"] === "true";
const bootBuffer = [];
function bootLog(msg) {
	if (bootVerbose) {
		try {
			process.stderr.write(`[agentmemory] ${msg}\n`);
		} catch {}
		return;
	}
	if (bootBuffer.length < 500) bootBuffer.push(msg);
}

//#endregion
//#region src/functions/query-expansion.ts
const QUERY_EXPANSION_SYSTEM = `You are a query expansion engine for a memory retrieval system. Given a user query, generate diverse reformulations to maximize recall.

Output EXACTLY this XML:
<expansion>
  <reformulations>
    <query>semantically diverse rephrasing 1</query>
    <query>semantically diverse rephrasing 2</query>
    <query>semantically diverse rephrasing 3</query>
  </reformulations>
  <temporal>
    <query>time-concretized version if applicable</query>
  </temporal>
  <entities>
    <entity>extracted entity name 1</entity>
    <entity>extracted entity name 2</entity>
  </entities>
</expansion>

Rules:
- Generate 3-5 reformulations capturing different interpretations
- Include paraphrases, domain-specific restatements, and abstract/concrete variants
- Extract any named entities (people, files, projects, libraries, concepts)
- If the query mentions time ("last week", "recently"), generate temporal concretizations
- Each reformulation should capture a distinct facet of intent
- Keep reformulations concise (under 100 chars each)`;
function parseExpansionXml(xml) {
	const reformulations = [];
	const reformBlock = xml.match(/<reformulations>[\s\S]*?<\/reformulations>/);
	if (reformBlock) {
		const qRegex = /<query>([^<]+)<\/query>/g;
		let match;
		while ((match = qRegex.exec(reformBlock[0])) !== null) reformulations.push(match[1].trim());
	}
	const temporalConcretizations = [];
	const tempBlock = xml.match(/<temporal>[\s\S]*?<\/temporal>/);
	if (tempBlock) {
		const qRegex = /<query>([^<]+)<\/query>/g;
		let match;
		while ((match = qRegex.exec(tempBlock[0])) !== null) temporalConcretizations.push(match[1].trim());
	}
	const entityExtractions = [];
	const entityRegex = /<entity>([^<]+)<\/entity>/g;
	let match;
	while ((match = entityRegex.exec(xml)) !== null) entityExtractions.push(match[1].trim());
	return {
		original: "",
		reformulations,
		temporalConcretizations,
		entityExtractions
	};
}
function registerQueryExpansionFunction(sdk, provider) {
	sdk.registerFunction("mem::expand-query", async (data) => {
		if (!data || typeof data.query !== "string" || !data.query.trim()) {
			logger.warn("Invalid expand-query payload");
			return {
				success: false,
				error: "query must be a non-empty string"
			};
		}
		const rawMaxR = Number(data.maxReformulations);
		const maxR = Number.isFinite(rawMaxR) ? Math.max(1, Math.min(10, Math.floor(rawMaxR))) : 5;
		const query = data.query.trim();
		try {
			const parsed = parseExpansionXml(await provider.compress(QUERY_EXPANSION_SYSTEM, `Expand this query for memory retrieval:\n\n"${query}"`));
			if (!parsed) {
				logger.warn("Failed to parse query expansion");
				return {
					success: true,
					expansion: {
						original: query,
						reformulations: [],
						temporalConcretizations: [],
						entityExtractions: []
					}
				};
			}
			parsed.original = query;
			parsed.reformulations = parsed.reformulations.slice(0, maxR);
			logger.info("Query expanded", {
				original: query,
				reformulations: parsed.reformulations.length,
				entities: parsed.entityExtractions.length
			});
			return {
				success: true,
				expansion: parsed
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Query expansion failed", { error: msg });
			return {
				success: true,
				expansion: {
					original: query,
					reformulations: [],
					temporalConcretizations: [],
					entityExtractions: []
				}
			};
		}
	});
}
function extractEntitiesFromQuery(query) {
	const entities = [];
	const quoted = query.match(/"([^"]+)"/g);
	if (quoted) for (const q of quoted) entities.push(q.replace(/"/g, ""));
	const capitalized = query.match(/\b[A-Z][a-zA-Z0-9_.-]+\b/g);
	if (capitalized) {
		const stopWords = new Set([
			"The",
			"This",
			"That",
			"What",
			"When",
			"Where",
			"How",
			"Why",
			"Who",
			"Which",
			"Did",
			"Does",
			"Do",
			"Is",
			"Are",
			"Was",
			"Were",
			"Has",
			"Have",
			"Had",
			"Can",
			"Could",
			"Would",
			"Should",
			"Will",
			"May",
			"Might",
			"If",
			"And",
			"But",
			"Or",
			"Not",
			"For",
			"From",
			"With",
			"About",
			"After",
			"Before",
			"Between"
		]);
		for (const c of capitalized) if (!stopWords.has(c)) entities.push(c);
	}
	return [...new Set(entities)];
}

//#endregion
//#region src/state/reranker.ts
let pipeline = null;
let pipelineLoading = null;
let pipelineUnavailable = false;
async function loadPipeline() {
	if (pipelineUnavailable) return null;
	if (pipeline) return pipeline;
	if (pipelineLoading) return pipelineLoading;
	pipelineLoading = (async () => {
		try {
			const { pipeline: createPipeline } = await import("@xenova/transformers");
			pipeline = await createPipeline("text-classification", "Xenova/ms-marco-MiniLM-L-6-v2", { quantized: true });
			return pipeline;
		} catch {
			pipeline = null;
			pipelineUnavailable = true;
			return null;
		} finally {
			pipelineLoading = null;
		}
	})();
	return pipelineLoading;
}
async function rerank(query, results, topK = 20) {
	if (results.length <= 1) return results;
	const reranker = await loadPipeline();
	if (!reranker) return results;
	const pairs = results.slice(0, Math.min(results.length, topK)).map((r) => ({
		text: `${query} [SEP] ${r.observation.title || ""} ${r.observation.narrative || ""}`.slice(0, 512),
		result: r
	}));
	const scores = [];
	for (const pair of pairs) try {
		const output = await reranker(pair.text);
		const score = Array.isArray(output) ? output[0]?.score ?? 0 : 0;
		scores.push({
			result: pair.result,
			rerankScore: score
		});
	} catch {
		scores.push({
			result: pair.result,
			rerankScore: pair.result.combinedScore
		});
	}
	scores.sort((a, b) => b.rerankScore - a.rerankScore);
	return scores.map((s, i) => ({
		...s.result,
		combinedScore: s.rerankScore,
		rerankPosition: i + 1
	}));
}

//#endregion
//#region src/state/hybrid-search.ts
const RRF_K = 60;
var HybridSearch = class {
	graphRetrieval;
	constructor(bm25, vector, embeddingProvider, kv, bm25Weight = .4, vectorWeight = .6, graphWeight = .3, rerankEnabled = process.env.RERANK_ENABLED === "true") {
		this.bm25 = bm25;
		this.vector = vector;
		this.embeddingProvider = embeddingProvider;
		this.kv = kv;
		this.bm25Weight = bm25Weight;
		this.vectorWeight = vectorWeight;
		this.graphWeight = graphWeight;
		this.rerankEnabled = rerankEnabled;
		this.graphRetrieval = new GraphRetrieval(kv);
	}
	async search(query, limit = 20) {
		return this.tripleStreamSearch(query, limit);
	}
	async searchWithExpansion(query, limit, expansion) {
		const allQueries = [
			query,
			...expansion.reformulations,
			...expansion.temporalConcretizations
		];
		const allEntities = [...expansion.entityExtractions, ...extractEntitiesFromQuery(query)];
		const resultSets = await Promise.all(allQueries.map((q) => this.tripleStreamSearch(q, limit, allEntities)));
		const merged = /* @__PURE__ */ new Map();
		for (const results of resultSets) for (const r of results) {
			const existing = merged.get(r.observation.id);
			if (!existing || r.combinedScore > existing.combinedScore) merged.set(r.observation.id, r);
		}
		return Array.from(merged.values()).sort((a, b) => b.combinedScore - a.combinedScore).slice(0, limit);
	}
	async tripleStreamSearch(query, limit, entityHints) {
		const bm25Results = this.bm25.search(query, limit * 2);
		let vectorResults = [];
		let queryEmbedding = null;
		if (this.vector && this.embeddingProvider && this.vector.size > 0) try {
			queryEmbedding = await this.embeddingProvider.embed(query);
			vectorResults = this.vector.search(queryEmbedding, limit * 2);
		} catch {}
		const entities = entityHints && entityHints.length > 0 ? entityHints : extractEntitiesFromQuery(query);
		let graphResults = [];
		if (entities.length > 0) try {
			graphResults = await this.graphRetrieval.searchByEntities(entities, 2, limit);
		} catch {}
		const topVectorObs = vectorResults.slice(0, 5).map((r) => r.obsId);
		if (topVectorObs.length > 0) try {
			const expansionResults = await this.graphRetrieval.expandFromChunks(topVectorObs, 1, 5);
			graphResults = [...graphResults, ...expansionResults];
		} catch {}
		const scores = /* @__PURE__ */ new Map();
		bm25Results.forEach((r, i) => {
			scores.set(r.obsId, {
				bm25Rank: i + 1,
				vectorRank: Infinity,
				graphRank: Infinity,
				sessionId: r.sessionId,
				bm25Score: r.score,
				vectorScore: 0,
				graphScore: 0
			});
		});
		vectorResults.forEach((r, i) => {
			const existing = scores.get(r.obsId);
			if (existing) {
				existing.vectorRank = i + 1;
				existing.vectorScore = r.score;
			} else scores.set(r.obsId, {
				bm25Rank: Infinity,
				vectorRank: i + 1,
				graphRank: Infinity,
				sessionId: r.sessionId,
				bm25Score: 0,
				vectorScore: r.score,
				graphScore: 0
			});
		});
		graphResults.forEach((r, i) => {
			const existing = scores.get(r.obsId);
			if (existing) {
				existing.graphRank = Math.min(existing.graphRank, i + 1);
				existing.graphScore = Math.max(existing.graphScore, r.score);
				if (r.graphContext && !existing.graphContext) existing.graphContext = r.graphContext;
			} else scores.set(r.obsId, {
				bm25Rank: Infinity,
				vectorRank: Infinity,
				graphRank: i + 1,
				sessionId: r.sessionId,
				bm25Score: 0,
				vectorScore: 0,
				graphScore: r.score,
				graphContext: r.graphContext
			});
		});
		const hasVector = vectorResults.length > 0;
		const hasGraph = graphResults.length > 0;
		let effectiveBm25W = this.bm25Weight;
		let effectiveVectorW = hasVector ? this.vectorWeight : 0;
		let effectiveGraphW = hasGraph ? this.graphWeight : 0;
		const totalW = effectiveBm25W + effectiveVectorW + effectiveGraphW;
		if (totalW > 0) {
			effectiveBm25W /= totalW;
			effectiveVectorW /= totalW;
			effectiveGraphW /= totalW;
		}
		const combined = Array.from(scores.entries()).map(([obsId, s]) => ({
			obsId,
			sessionId: s.sessionId,
			bm25Score: s.bm25Score,
			vectorScore: s.vectorScore,
			graphScore: s.graphScore,
			graphContext: s.graphContext,
			combinedScore: effectiveBm25W * (1 / (RRF_K + s.bm25Rank)) + effectiveVectorW * (1 / (RRF_K + s.vectorRank)) + effectiveGraphW * (1 / (RRF_K + s.graphRank))
		}));
		combined.sort((a, b) => b.combinedScore - a.combinedScore);
		const retrievalDepth = Math.max(limit, 20);
		const rerankWindow = 20;
		const diversified = this.diversifyBySession(combined, retrievalDepth);
		const enriched = await this.enrichResults(diversified, retrievalDepth);
		if (this.rerankEnabled && enriched.length > 1) try {
			const head = enriched.slice(0, rerankWindow);
			const tail = enriched.slice(rerankWindow);
			return (await rerank(query, head, rerankWindow)).concat(tail).slice(0, limit);
		} catch {
			return enriched.slice(0, limit);
		}
		return enriched.slice(0, limit);
	}
	diversifyBySession(results, limit, maxPerSession = 3) {
		const selected = [];
		const sessionCounts = /* @__PURE__ */ new Map();
		for (const r of results) {
			const count = sessionCounts.get(r.sessionId) || 0;
			if (count >= maxPerSession) continue;
			selected.push(r);
			sessionCounts.set(r.sessionId, count + 1);
			if (selected.length >= limit) break;
		}
		if (selected.length < limit) for (const r of results) {
			if (selected.length >= limit) break;
			if (!selected.some((s) => s.obsId === r.obsId)) selected.push(r);
		}
		return selected;
	}
	async enrichResults(results, limit) {
		const sliced = results.slice(0, limit);
		const observations = await Promise.all(sliced.map(async (r) => {
			const obs = await this.kv.get(KV.observations(r.sessionId), r.obsId).catch(() => null);
			if (obs) return obs;
			const mem = await this.kv.get(KV.memories, r.obsId).catch(() => null);
			return mem ? memoryToObservation(mem) : null;
		}));
		const enriched = [];
		for (let i = 0; i < sliced.length; i++) {
			const obs = observations[i];
			if (obs) enriched.push({
				observation: obs,
				bm25Score: sliced[i].bm25Score,
				vectorScore: sliced[i].vectorScore,
				graphScore: sliced[i].graphScore,
				combinedScore: sliced[i].combinedScore,
				sessionId: sliced[i].sessionId,
				graphContext: sliced[i].graphContext
			});
		}
		return enriched;
	}
};

//#endregion
//#region src/state/stemmer.ts
const step2map = {
	ational: "ate",
	tional: "tion",
	enci: "ence",
	anci: "ance",
	izer: "ize",
	iser: "ise",
	abli: "able",
	alli: "al",
	entli: "ent",
	eli: "e",
	ousli: "ous",
	ization: "ize",
	isation: "ise",
	ation: "ate",
	ator: "ate",
	alism: "al",
	iveness: "ive",
	fulness: "ful",
	ousness: "ous",
	aliti: "al",
	iviti: "ive",
	biliti: "ble"
};
const step3map = {
	icate: "ic",
	ative: "",
	alize: "al",
	alise: "al",
	iciti: "ic",
	ical: "ic",
	ful: "",
	ness: ""
};
function hasVowel(s) {
	return /[aeiou]/.test(s);
}
function measure(s) {
	const m = s.replace(/[^aeiouy]+/g, "C").replace(/[aeiouy]+/g, "V").match(/VC/g);
	return m ? m.length : 0;
}
function endsDoubleConsonant(s) {
	return s.length >= 2 && s[s.length - 1] === s[s.length - 2] && !/[aeiou]/.test(s[s.length - 1]);
}
function endsCVC(s) {
	if (s.length < 3) return false;
	const c1 = s[s.length - 3], v = s[s.length - 2], c2 = s[s.length - 1];
	return !/[aeiou]/.test(c1) && /[aeiou]/.test(v) && !/[aeiouwxy]/.test(c2);
}
function stem(word) {
	if (word.length <= 2) return word;
	let w = word;
	if (w.endsWith("sses")) w = w.slice(0, -2);
	else if (w.endsWith("ies")) w = w.slice(0, -2);
	else if (!w.endsWith("ss") && w.endsWith("s")) w = w.slice(0, -1);
	if (w.endsWith("eed")) {
		if (measure(w.slice(0, -3)) > 0) w = w.slice(0, -1);
	} else if (w.endsWith("ed") && hasVowel(w.slice(0, -2))) {
		w = w.slice(0, -2);
		if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) w += "e";
		else if (endsDoubleConsonant(w) && !/[lsz]$/.test(w)) w = w.slice(0, -1);
		else if (measure(w) === 1 && endsCVC(w)) w += "e";
	} else if (w.endsWith("ing") && hasVowel(w.slice(0, -3))) {
		w = w.slice(0, -3);
		if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) w += "e";
		else if (endsDoubleConsonant(w) && !/[lsz]$/.test(w)) w = w.slice(0, -1);
		else if (measure(w) === 1 && endsCVC(w)) w += "e";
	}
	if (w.endsWith("y") && hasVowel(w.slice(0, -1))) w = w.slice(0, -1) + "i";
	for (const [suffix, replacement] of Object.entries(step2map)) if (w.endsWith(suffix)) {
		const base = w.slice(0, -suffix.length);
		if (measure(base) > 0) w = base + replacement;
		break;
	}
	for (const [suffix, replacement] of Object.entries(step3map)) if (w.endsWith(suffix)) {
		const base = w.slice(0, -suffix.length);
		if (measure(base) > 0) w = base + replacement;
		break;
	}
	if (w.endsWith("al") || w.endsWith("ance") || w.endsWith("ence") || w.endsWith("er") || w.endsWith("ic") || w.endsWith("able") || w.endsWith("ible") || w.endsWith("ant") || w.endsWith("ement") || w.endsWith("ment") || w.endsWith("ent") || w.endsWith("tion") || w.endsWith("sion") || w.endsWith("ou") || w.endsWith("ism") || w.endsWith("ate") || w.endsWith("iti") || w.endsWith("ous") || w.endsWith("ive") || w.endsWith("ize") || w.endsWith("ise")) {
		const suffixLen = w.match(/(ement|ment|tion|sion|ance|ence|able|ible|ism|ate|iti|ous|ive|ize|ise|ant|ent|al|er|ic|ou)$/)?.[0]?.length ?? 0;
		if (suffixLen > 0) {
			const base = w.slice(0, -suffixLen);
			if (measure(base) > 1) w = base;
		}
	}
	if (w.endsWith("e")) {
		const base = w.slice(0, -1);
		if (measure(base) > 1 || measure(base) === 1 && !endsCVC(base)) w = base;
	}
	if (endsDoubleConsonant(w) && w.endsWith("l") && measure(w.slice(0, -1)) > 1) w = w.slice(0, -1);
	return w;
}

//#endregion
//#region src/state/synonyms.ts
const SYNONYM_GROUPS = [
	[
		"auth",
		"authentication",
		"authn",
		"authenticating"
	],
	[
		"authz",
		"authorization",
		"authorizing"
	],
	[
		"db",
		"database",
		"datastore"
	],
	[
		"perf",
		"performance",
		"latency",
		"throughput",
		"slow",
		"bottleneck"
	],
	[
		"optim",
		"optimization",
		"optimizing",
		"optimise",
		"query-optimization"
	],
	[
		"k8s",
		"kubernetes",
		"kube"
	],
	[
		"config",
		"configuration",
		"configuring",
		"setup"
	],
	[
		"deps",
		"dependencies",
		"dependency"
	],
	["env", "environment"],
	["fn", "function"],
	[
		"impl",
		"implementation",
		"implementing"
	],
	[
		"msg",
		"message",
		"messaging"
	],
	["repo", "repository"],
	["req", "request"],
	["res", "response"],
	["ts", "typescript"],
	["js", "javascript"],
	[
		"pg",
		"postgres",
		"postgresql"
	],
	[
		"err",
		"error",
		"errors"
	],
	[
		"api",
		"endpoint",
		"endpoints"
	],
	["ci", "continuous-integration"],
	["cd", "continuous-deployment"],
	[
		"test",
		"testing",
		"tests"
	],
	[
		"doc",
		"documentation",
		"docs"
	],
	["infra", "infrastructure"],
	[
		"deploy",
		"deployment",
		"deploying"
	],
	[
		"cache",
		"caching",
		"cached"
	],
	[
		"log",
		"logging",
		"logs"
	],
	["monitor", "monitoring"],
	["observe", "observability"],
	[
		"sec",
		"security",
		"secure"
	],
	[
		"validate",
		"validation",
		"validating"
	],
	[
		"migrate",
		"migration",
		"migrations"
	],
	["debug", "debugging"],
	[
		"container",
		"containerization",
		"docker"
	],
	[
		"crash",
		"crashloop",
		"crashloopbackoff"
	],
	[
		"webhook",
		"webhooks",
		"callback"
	],
	["middleware", "mw"],
	["paginate", "pagination"],
	["serialize", "serialization"],
	["encrypt", "encryption"],
	["hash", "hashing"]
];
const synonymMap = /* @__PURE__ */ new Map();
for (const group of SYNONYM_GROUPS) {
	const stemmed = group.map((t) => stem(t.toLowerCase()));
	for (const s of stemmed) {
		if (!synonymMap.has(s)) synonymMap.set(s, /* @__PURE__ */ new Set());
		for (const other of stemmed) if (other !== s) synonymMap.get(s).add(other);
	}
}
function getSynonyms(stemmedTerm) {
	const syns = synonymMap.get(stemmedTerm);
	return syns ? [...syns] : [];
}

//#endregion
//#region src/state/cjk-segmenter.ts
const cjkRequire = createRequire(import.meta.url);
const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const KANA_RE = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HANGUL_RE = /\p{Script=Hangul}/u;
const CJK_RUN_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+/gu;
const HANGUL_BLOCK_RE = /[가-힯]+/g;
const hintShown = /* @__PURE__ */ new Set();
function hasCjk(text) {
	return CJK_RE.test(text);
}
function showHintOnce(key, message) {
	if (hintShown.has(key)) return;
	hintShown.add(key);
	if (typeof process !== "undefined" && process.stderr?.write) process.stderr.write(`agentmemory: ${message}\n`);
}
let jiebaInstance = null;
let jiebaLoaded = false;
function getJieba() {
	if (jiebaLoaded) return jiebaInstance;
	jiebaLoaded = true;
	try {
		const mod = cjkRequire("@node-rs/jieba");
		try {
			const dictMod = cjkRequire("@node-rs/jieba/dict");
			jiebaInstance = mod.Jieba.withDict(dictMod.dict);
		} catch {
			jiebaInstance = new mod.Jieba();
		}
		return jiebaInstance;
	} catch {
		showHintOnce("jieba", "install @node-rs/jieba to improve Chinese search; falling back to whole-string tokenization");
		return null;
	}
}
let jaSegmenterInstance = null;
let jaSegmenterLoaded = false;
function getJaSegmenter() {
	if (jaSegmenterLoaded) return jaSegmenterInstance;
	jaSegmenterLoaded = true;
	try {
		jaSegmenterInstance = new (cjkRequire("tiny-segmenter"))();
		return jaSegmenterInstance;
	} catch {
		showHintOnce("tiny-segmenter", "install tiny-segmenter to improve Japanese search; falling back to whole-string tokenization");
		return null;
	}
}
function cleanTokens(tokens) {
	const out = [];
	for (const t of tokens) {
		const trimmed = t.trim();
		if (trimmed) out.push(trimmed);
	}
	return out;
}
function segmentHan(text) {
	const j = getJieba();
	if (!j) return [text];
	try {
		return cleanTokens(j.cut(text, true));
	} catch {
		return [text];
	}
}
function segmentKana(text) {
	const s = getJaSegmenter();
	if (!s) return [text];
	try {
		return cleanTokens(s.segment(text));
	} catch {
		return [text];
	}
}
function segmentHangul(text) {
	const out = [];
	for (const m of text.matchAll(HANGUL_BLOCK_RE)) if (m[0]) out.push(m[0]);
	return out;
}
function segmentCjk(text) {
	if (!hasCjk(text)) return [text];
	const out = [];
	let cursor = 0;
	for (const m of text.matchAll(CJK_RUN_RE)) {
		const start = m.index ?? 0;
		const run = m[0];
		const end = start + run.length;
		if (start > cursor) {
			const piece = text.slice(cursor, start).trim();
			if (piece) out.push(piece);
		}
		if (HANGUL_RE.test(run)) out.push(...segmentHangul(run));
		else if (KANA_RE.test(run)) out.push(...segmentKana(run));
		else out.push(...segmentHan(run));
		cursor = end;
	}
	if (cursor < text.length) {
		const trailing = text.slice(cursor).trim();
		if (trailing) out.push(trailing);
	}
	return out;
}

//#endregion
//#region src/state/search-index.ts
var SearchIndex = class SearchIndex {
	entries = /* @__PURE__ */ new Map();
	invertedIndex = /* @__PURE__ */ new Map();
	docTermCounts = /* @__PURE__ */ new Map();
	totalDocLength = 0;
	sortedTerms = null;
	k1 = 1.2;
	b = .75;
	add(obs) {
		const terms = this.extractTerms(obs);
		const termFreq = /* @__PURE__ */ new Map();
		let termCount = 0;
		for (const term of terms) {
			termFreq.set(term, (termFreq.get(term) || 0) + 1);
			termCount++;
		}
		this.entries.set(obs.id, {
			obsId: obs.id,
			sessionId: obs.sessionId,
			termCount
		});
		this.docTermCounts.set(obs.id, termFreq);
		this.totalDocLength += termCount;
		for (const term of termFreq.keys()) {
			if (!this.invertedIndex.has(term)) this.invertedIndex.set(term, /* @__PURE__ */ new Set());
			this.invertedIndex.get(term).add(obs.id);
		}
		this.sortedTerms = null;
	}
	has(id) {
		return this.entries.has(id);
	}
	search(query, limit = 20) {
		const rawTerms = this.tokenize(query.toLowerCase());
		if (rawTerms.length === 0) return [];
		const N = this.entries.size;
		if (N === 0) return [];
		const avgDocLen = this.totalDocLength / N;
		const queryTerms = [];
		const seen = /* @__PURE__ */ new Set();
		for (const term of rawTerms) {
			if (!seen.has(term)) {
				seen.add(term);
				queryTerms.push({
					term,
					weight: 1
				});
			}
			for (const syn of getSynonyms(term)) if (!seen.has(syn)) {
				seen.add(syn);
				queryTerms.push({
					term: syn,
					weight: .7
				});
			}
		}
		const scores = /* @__PURE__ */ new Map();
		const sorted = this.getSortedTerms();
		for (const { term, weight } of queryTerms) {
			const matchingDocs = this.invertedIndex.get(term);
			if (matchingDocs) {
				const df = matchingDocs.size;
				const idf = Math.log((N - df + .5) / (df + .5) + 1);
				for (const obsId of matchingDocs) {
					const entry = this.entries.get(obsId);
					const tf = this.docTermCounts.get(obsId)?.get(term) || 0;
					const docLen = entry.termCount;
					const bm25Score = idf * (tf * (this.k1 + 1) / (tf + this.k1 * (1 - this.b + this.b * (docLen / avgDocLen)))) * weight;
					scores.set(obsId, (scores.get(obsId) || 0) + bm25Score);
				}
			}
			const startIdx = this.lowerBound(sorted, term);
			for (let si = startIdx; si < sorted.length; si++) {
				const indexTerm = sorted[si];
				if (!indexTerm.startsWith(term)) break;
				if (indexTerm === term) continue;
				const obsIds = this.invertedIndex.get(indexTerm);
				const prefixDf = obsIds.size;
				const prefixIdf = Math.log((N - prefixDf + .5) / (prefixDf + .5) + 1) * .5;
				for (const obsId of obsIds) {
					const entry = this.entries.get(obsId);
					const tf = this.docTermCounts.get(obsId)?.get(indexTerm) || 0;
					const docLen = entry.termCount;
					const numerator = tf * (this.k1 + 1);
					const denominator = tf + this.k1 * (1 - this.b + this.b * (docLen / avgDocLen));
					scores.set(obsId, (scores.get(obsId) || 0) + prefixIdf * (numerator / denominator) * weight);
				}
			}
		}
		return Array.from(scores.entries()).map(([obsId, score]) => {
			return {
				obsId,
				sessionId: this.entries.get(obsId).sessionId,
				score
			};
		}).sort((a, b) => b.score - a.score).slice(0, limit);
	}
	get size() {
		return this.entries.size;
	}
	clear() {
		this.entries.clear();
		this.invertedIndex.clear();
		this.docTermCounts.clear();
		this.totalDocLength = 0;
		this.sortedTerms = null;
	}
	restoreFrom(other) {
		this.entries = new Map(Array.from(other.entries.entries()).map(([k, v]) => [k, { ...v }]));
		this.invertedIndex = new Map(Array.from(other.invertedIndex.entries()).map(([k, v]) => [k, new Set(v)]));
		this.docTermCounts = new Map(Array.from(other.docTermCounts.entries()).map(([k, v]) => [k, new Map(v)]));
		this.totalDocLength = other.totalDocLength;
		this.sortedTerms = null;
	}
	serialize() {
		const entries = Array.from(this.entries.entries());
		const inverted = Array.from(this.invertedIndex.entries()).map(([term, ids]) => [term, Array.from(ids)]);
		const docTerms = Array.from(this.docTermCounts.entries()).map(([id, counts]) => [id, Array.from(counts.entries())]);
		return JSON.stringify({
			v: 2,
			entries,
			inverted,
			docTerms,
			totalDocLength: this.totalDocLength
		});
	}
	static deserialize(json) {
		try {
			const idx = new SearchIndex();
			const data = JSON.parse(json);
			if (!data?.entries || !data?.inverted || !data?.docTerms) return idx;
			for (const [key, val] of data.entries) idx.entries.set(key, val);
			for (const [term, ids] of data.inverted) idx.invertedIndex.set(term, new Set(ids));
			for (const [id, counts] of data.docTerms) idx.docTermCounts.set(id, new Map(counts));
			const rawLen = Number(data.totalDocLength);
			idx.totalDocLength = Number.isFinite(rawLen) && rawLen >= 0 ? Math.floor(rawLen) : 0;
			return idx;
		} catch {
			return new SearchIndex();
		}
	}
	extractTerms(obs) {
		const parts = [
			obs.title,
			obs.subtitle || "",
			obs.narrative,
			...obs.facts,
			...obs.concepts,
			...obs.files,
			obs.type
		];
		return this.tokenize(parts.join(" ").toLowerCase());
	}
	tokenize(text) {
		const cleaned = text.replace(/[^\p{L}\p{N}\s/.\\-_]/gu, " ");
		const out = [];
		for (const raw of cleaned.split(/\s+/)) {
			if (raw.length < 2) continue;
			if (hasCjk(raw)) {
				for (const seg of segmentCjk(raw)) if (seg.length >= 1) out.push(seg);
			} else out.push(stem(raw));
		}
		return out;
	}
	getSortedTerms() {
		if (!this.sortedTerms) this.sortedTerms = Array.from(this.invertedIndex.keys()).sort();
		return this.sortedTerms;
	}
	lowerBound(arr, target) {
		let lo = 0;
		let hi = arr.length;
		while (lo < hi) {
			const mid = lo + hi >>> 1;
			if (arr[mid] < target) lo = mid + 1;
			else hi = mid;
		}
		return lo;
	}
};

//#endregion
//#region src/state/index-persistence.ts
const DEBOUNCE_MS = 5e3;
const FAILURE_LOG_THROTTLE_MS = 6e4;
var IndexPersistence = class {
	timer = null;
	lastFailureLogAt = 0;
	constructor(kv, bm25, vector) {
		this.kv = kv;
		this.bm25 = bm25;
		this.vector = vector;
	}
	scheduleSave() {
		if (this.timer) clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.save().catch((err) => this.logFailure(err));
		}, DEBOUNCE_MS);
	}
	async save() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
		try {
			await this.kv.set(KV.bm25Index, "data", this.bm25.serialize());
			if (this.vector && this.vector.size > 0) await this.kv.set(KV.bm25Index, "vectors", this.vector.serialize());
		} catch (err) {
			this.logFailure(err);
		}
	}
	async load() {
		let bm25 = null;
		let vector = null;
		const bm25Data = await this.kv.get(KV.bm25Index, "data").catch(() => null);
		if (bm25Data && typeof bm25Data === "string") bm25 = SearchIndex.deserialize(bm25Data);
		const vecData = await this.kv.get(KV.bm25Index, "vectors").catch(() => null);
		if (vecData && typeof vecData === "string") vector = VectorIndex.deserialize(vecData);
		return {
			bm25,
			vector
		};
	}
	stop() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}
	logFailure(err) {
		const now = Date.now();
		if (now - this.lastFailureLogAt < FAILURE_LOG_THROTTLE_MS) return;
		this.lastFailureLogAt = now;
		const code = err?.code;
		const message = err instanceof Error ? err.message : String(err);
		logger.warn("index persistence: failed to save BM25/vector index", {
			code,
			message,
			hint: code === "TIMEOUT" ? "iii-engine state::set timed out; recent index updates remain in memory and will retry on the next debounce flush" : void 0
		});
	}
};

//#endregion
//#region src/functions/privacy.ts
const PRIVATE_TAG_RE = /<private>[\s\S]*?<\/private>/gi;
const SECRET_PATTERN_SOURCES = [
	/(?:api[_-]?key|secret|token|password|credential|auth)[\s]*[=:]\s*["']?[A-Za-z0-9_\-/.+]{20,}["']?/gi,
	/Bearer\s+[A-Za-z0-9._\-+/=]{20,}/gi,
	/sk-proj-[A-Za-z0-9\-_]{20,}/g,
	/(?:sk|pk|rk|ak)-[A-Za-z0-9][A-Za-z0-9\-_]{19,}/g,
	/sk-ant-[A-Za-z0-9\-_]{20,}/g,
	/gh[pus]_[A-Za-z0-9]{36,}/g,
	/github_pat_[A-Za-z0-9_]{22,}/g,
	/xoxb-[A-Za-z0-9\-]+/g,
	/AKIA[0-9A-Z]{16}/g,
	/AIza[A-Za-z0-9\-_]{35}/g,
	/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
	/npm_[A-Za-z0-9]{36}/g,
	/glpat-[A-Za-z0-9\-_]{20,}/g,
	/dop_v1_[A-Za-z0-9]{64}/g
];
function stripPrivateData(input) {
	let result = input.replace(PRIVATE_TAG_RE, "[REDACTED]");
	for (const source of SECRET_PATTERN_SOURCES) {
		const pattern = new RegExp(source.source, source.flags);
		result = result.replace(pattern, "[REDACTED_SECRET]");
	}
	return result;
}
function registerPrivacyFunction(sdk) {
	sdk.registerFunction("mem::privacy", async (data) => {
		if (!data || typeof data.input !== "string") return {
			output: "",
			error: "invalid input: expected string field 'input'"
		};
		return { output: stripPrivateData(data.input) };
	});
}

//#endregion
//#region src/state/keyed-mutex.ts
const locks = /* @__PURE__ */ new Map();
function withKeyedLock(key, fn) {
	const next = (locks.get(key) ?? Promise.resolve()).then(fn, fn);
	const cleanup = next.then(() => {}, () => {});
	locks.set(key, cleanup);
	cleanup.then(() => {
		if (locks.get(key) === cleanup) locks.delete(key);
	});
	return next;
}

//#endregion
//#region src/functions/compress-synthetic.ts
function inferType(toolName, hookType) {
	if (hookType === "post_tool_failure") return "error";
	if (hookType === "prompt_submit") return "conversation";
	if (hookType === "subagent_stop" || hookType === "task_completed") return "subagent";
	if (hookType === "notification") return "notification";
	if (!toolName) return "other";
	const n = toolName.replace(/([a-z])([A-Z])/g, "$1_$2").replace(/[-\s]+/g, "_").toLowerCase();
	const hasWord = (word) => new RegExp(`(^|_)${word}(_|$)`).test(n) || n === word || n.endsWith(word) || n.startsWith(word);
	if ([
		"fetch",
		"http",
		"web"
	].some(hasWord)) return "web_fetch";
	if ([
		"grep",
		"search",
		"glob",
		"find"
	].some(hasWord)) return "search";
	if ([
		"bash",
		"shell",
		"exec",
		"run"
	].some(hasWord)) return "command_run";
	if ([
		"edit",
		"update",
		"patch",
		"replace"
	].some(hasWord)) return "file_edit";
	if (["write", "create"].some(hasWord)) return "file_write";
	if (["read", "view"].some(hasWord)) return "file_read";
	if (["task", "agent"].some(hasWord)) return "subagent";
	return "other";
}
function extractFiles$1(input) {
	if (!input || typeof input !== "object") return [];
	const o = input;
	const out = /* @__PURE__ */ new Set();
	for (const key of [
		"file_path",
		"filepath",
		"path",
		"filePath",
		"file",
		"pattern"
	]) {
		const v = o[key];
		if (typeof v === "string" && v.length > 0 && v.length < 512) out.add(v);
	}
	return [...out];
}
function stringifyForNarrative(v) {
	if (v == null) return "";
	if (typeof v === "string") return v;
	try {
		return JSON.stringify(v);
	} catch {
		return String(v);
	}
}
function truncate$2(s, n) {
	return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function buildSyntheticCompression(raw) {
	const toolName = raw.toolName ?? raw.hookType;
	const inputStr = stringifyForNarrative(raw.toolInput);
	const outputStr = stringifyForNarrative(raw.toolOutput);
	const narrativeParts = [
		raw.userPrompt ?? "",
		inputStr,
		outputStr
	].filter((s) => s.length > 0);
	const result = {
		id: raw.id,
		sessionId: raw.sessionId,
		timestamp: raw.timestamp,
		type: inferType(toolName, raw.hookType),
		title: truncate$2(toolName || "observation", 80),
		subtitle: inputStr ? truncate$2(inputStr, 120) : void 0,
		facts: [],
		narrative: truncate$2(narrativeParts.join(" | "), 400),
		concepts: [],
		files: extractFiles$1(raw.toolInput),
		importance: 5,
		confidence: .3
	};
	if (raw.modality) result.modality = raw.modality;
	if (raw.imageData) result.imageData = raw.imageData;
	return result;
}

//#endregion
//#region src/functions/access-tracker.ts
const RECENT_CAP = 20;
function emptyAccessLog(memoryId) {
	return {
		memoryId,
		count: 0,
		lastAt: "",
		recent: []
	};
}
function normalizeAccessLog(raw) {
	const r = raw ?? {};
	const rawCount = typeof r.count === "number" && Number.isFinite(r.count) ? r.count : 0;
	const count = Math.max(0, Math.floor(rawCount));
	const rawRecent = Array.isArray(r.recent) ? r.recent.filter((x) => typeof x === "number" && Number.isFinite(x)) : [];
	const recent = rawRecent.length > RECENT_CAP ? rawRecent.slice(-RECENT_CAP) : rawRecent;
	return {
		memoryId: typeof r.memoryId === "string" ? r.memoryId : "",
		count: Math.max(count, recent.length),
		lastAt: typeof r.lastAt === "string" ? r.lastAt : "",
		recent
	};
}
async function getAccessLog(kv, memoryId) {
	try {
		const raw = await kv.get(KV.accessLog, memoryId);
		if (!raw) return emptyAccessLog(memoryId);
		const normalized = normalizeAccessLog(raw);
		if (!normalized.memoryId) normalized.memoryId = memoryId;
		return normalized;
	} catch {
		return emptyAccessLog(memoryId);
	}
}
async function recordAccess(kv, memoryId, timestampMs) {
	if (!memoryId) return;
	const ts = timestampMs ?? Date.now();
	try {
		await withKeyedLock(`mem:access:${memoryId}`, async () => {
			const existing = await getAccessLog(kv, memoryId);
			existing.count += 1;
			existing.lastAt = new Date(ts).toISOString();
			existing.recent.push(ts);
			if (existing.recent.length > RECENT_CAP) existing.recent = existing.recent.slice(-RECENT_CAP);
			await kv.set(KV.accessLog, memoryId, existing);
		});
	} catch (err) {
		try {
			logger.warn("recordAccess failed", {
				memoryId,
				error: err instanceof Error ? err.message : String(err)
			});
		} catch {}
	}
}
async function recordAccessBatch(kv, memoryIds, timestampMs) {
	if (!memoryIds || memoryIds.length === 0) return;
	const ts = timestampMs ?? Date.now();
	const unique = Array.from(new Set(memoryIds.filter(Boolean)));
	await Promise.allSettled(unique.map((id) => recordAccess(kv, id, ts)));
}
async function deleteAccessLog(kv, memoryId) {
	if (!memoryId) return;
	try {
		await withKeyedLock(`mem:access:${memoryId}`, async () => {
			await kv.delete(KV.accessLog, memoryId);
		});
	} catch {}
}

//#endregion
//#region src/functions/search.ts
let index = null;
let vectorIndex = null;
let currentEmbeddingProvider = null;
function getSearchIndex() {
	if (!index) index = new SearchIndex();
	return index;
}
function setVectorIndex(idx) {
	vectorIndex = idx;
}
function setEmbeddingProvider(provider) {
	currentEmbeddingProvider = provider;
}
const EMBED_MAX_CHARS = 16e3;
function clipEmbedInput(text) {
	if (text.length <= EMBED_MAX_CHARS) return text;
	return text.slice(0, EMBED_MAX_CHARS);
}
async function vectorIndexAddGuarded(id, sessionId, text, context) {
	const vi = vectorIndex;
	const ep = currentEmbeddingProvider;
	if (!vi || !ep) return false;
	try {
		const embedding = await ep.embed(clipEmbedInput(text));
		if (embedding.length !== ep.dimensions) {
			logger.warn("vector-index add: dimension mismatch — skipping", {
				kind: context.kind,
				id: context.logId,
				provider: ep.name,
				expected: ep.dimensions,
				received: embedding.length
			});
			return false;
		}
		vi.add(id, sessionId, embedding);
		return true;
	} catch (err) {
		logger.warn("vector-index add: embed failed — skipping", {
			kind: context.kind,
			id: context.logId,
			provider: ep.name,
			error: err instanceof Error ? err.message : String(err)
		});
		return false;
	}
}
async function rebuildIndex(kv) {
	const idx = getSearchIndex();
	idx.clear();
	vectorIndex?.clear();
	let count = 0;
	try {
		const memories = await kv.list(KV.memories);
		for (const memory of memories) {
			if (memory.isLatest === false) continue;
			if (!memory.title || !memory.content) continue;
			idx.add(memoryToObservation(memory));
			await vectorIndexAddGuarded(memory.id, memory.sessionIds[0] ?? "memory", memory.title + " " + memory.content, {
				kind: "memory",
				logId: memory.id
			});
			count++;
		}
	} catch (err) {
		logger.warn("rebuildIndex: failed to load memories", { error: err instanceof Error ? err.message : String(err) });
	}
	const sessions = await kv.list(KV.sessions);
	if (!sessions.length) return count;
	const obsPerSession = [];
	const failedSessions = [];
	for (let batch = 0; batch < sessions.length; batch += 10) {
		const chunk = sessions.slice(batch, batch + 10);
		const results = await Promise.all(chunk.map(async (s) => {
			try {
				return await kv.list(KV.observations(s.id));
			} catch {
				failedSessions.push(s.id);
				return [];
			}
		}));
		obsPerSession.push(...results);
	}
	if (failedSessions.length > 0) logger.warn("rebuildIndex: failed to load observations for sessions", { failedSessions });
	for (const observations of obsPerSession) for (const obs of observations) if (obs.title && obs.narrative) {
		idx.add(obs);
		await vectorIndexAddGuarded(obs.id, obs.sessionId, obs.title + " " + obs.narrative, {
			kind: "observation",
			logId: obs.id
		});
		count++;
	}
	return count;
}
function registerSearchFunction(sdk, kv) {
	sdk.registerFunction("mem::search", async (data) => {
		const idx = getSearchIndex();
		if (typeof data?.query !== "string" || !data.query.trim()) throw new Error("mem::search: query must be a non-empty string");
		const query = data.query.trim();
		const MAX_LIMIT = 100;
		let effectiveLimit = 20;
		if (data.limit !== void 0) {
			if (!Number.isInteger(data.limit) || data.limit < 1) throw new Error("mem::search: limit must be a positive integer");
			effectiveLimit = Math.min(data.limit, MAX_LIMIT);
		}
		const projectFilter = typeof data.project === "string" && data.project.length > 0 ? data.project : void 0;
		const cwdFilter = typeof data.cwd === "string" && data.cwd.length > 0 ? data.cwd : void 0;
		const format = typeof data.format === "string" ? data.format : "full";
		if (![
			"full",
			"compact",
			"narrative"
		].includes(format)) throw new Error("mem::search: format must be one of 'full', 'compact', or 'narrative'");
		let tokenBudget;
		if (data.token_budget !== void 0) {
			if (!Number.isInteger(data.token_budget) || data.token_budget < 1) throw new Error("mem::search: token_budget must be a positive integer");
			tokenBudget = data.token_budget;
		}
		if (idx.size === 0) {
			const count = await rebuildIndex(kv);
			logger.info("Search index rebuilt", { entries: count });
		}
		const filtering = !!(projectFilter || cwdFilter);
		const fetchLimit = filtering ? Math.max(effectiveLimit * 10, 100) : effectiveLimit;
		const results = idx.search(query, fetchLimit);
		const sessionCache = /* @__PURE__ */ new Map();
		const loadSession = async (sessionId) => {
			if (sessionCache.has(sessionId)) return sessionCache.get(sessionId);
			const s = await kv.get(KV.sessions, sessionId);
			sessionCache.set(sessionId, s ?? null);
			return s ?? null;
		};
		const candidates = [];
		for (const r of results) {
			if (candidates.length >= effectiveLimit) break;
			if (filtering) {
				const s = await loadSession(r.sessionId);
				if (!s) continue;
				if (projectFilter && s.project !== projectFilter) continue;
				if (cwdFilter && s.cwd !== cwdFilter) continue;
			}
			candidates.push(r);
		}
		const obsResults = await Promise.all(candidates.map(async (r) => {
			const obs = await kv.get(KV.observations(r.sessionId), r.obsId).catch(() => null);
			if (obs) return obs;
			const mem = await kv.get(KV.memories, r.obsId).catch(() => null);
			return mem ? memoryToObservation(mem) : null;
		}));
		const enriched = [];
		for (let i = 0; i < candidates.length; i++) {
			const obs = obsResults[i];
			if (obs) enriched.push({
				observation: obs,
				score: candidates[i].score,
				sessionId: candidates[i].sessionId
			});
		}
		recordAccessBatch(kv, enriched.map((r) => r.observation.id));
		const estimateTokens = (value) => Math.max(1, Math.ceil(JSON.stringify(value).length / 3));
		const applyTokenBudget = (items) => {
			if (!tokenBudget) return {
				items,
				used: items.reduce((sum, item) => sum + estimateTokens(item), 0),
				truncated: false
			};
			const selected = [];
			let used = 0;
			for (const item of items) {
				const itemTokens = estimateTokens(item);
				if (used + itemTokens > tokenBudget) return {
					items: selected,
					used,
					truncated: selected.length < items.length
				};
				selected.push(item);
				used += itemTokens;
			}
			return {
				items: selected,
				used,
				truncated: false
			};
		};
		if (format === "compact") {
			const packed = applyTokenBudget(enriched.map((r) => ({
				obsId: r.observation.id,
				sessionId: r.sessionId,
				title: r.observation.title,
				type: r.observation.type,
				score: r.score,
				timestamp: r.observation.timestamp
			})));
			return {
				format,
				results: packed.items,
				tokens_used: packed.used,
				tokens_budget: tokenBudget,
				truncated: packed.truncated
			};
		}
		if (format === "narrative") {
			const packed = applyTokenBudget(enriched.map((r) => ({
				obsId: r.observation.id,
				sessionId: r.sessionId,
				title: r.observation.title,
				narrative: r.observation.narrative,
				score: r.score,
				timestamp: r.observation.timestamp
			})));
			const text = packed.items.map((r, index) => `${index + 1}. ${r.title}\n${r.narrative}`).join("\n\n");
			return {
				format,
				results: packed.items,
				text,
				tokens_used: packed.used,
				tokens_budget: tokenBudget,
				truncated: packed.truncated
			};
		}
		const packed = applyTokenBudget(enriched);
		logger.info("Search completed", {
			query,
			results: packed.items.length,
			hasProjectFilter: !!projectFilter,
			hasCwdFilter: !!cwdFilter
		});
		return {
			format,
			results: packed.items,
			tokens_used: packed.used,
			tokens_budget: tokenBudget,
			truncated: packed.truncated
		};
	});
}

//#endregion
//#region src/functions/observe.ts
function extractImage(d) {
	if (!d) return void 0;
	if (typeof d === "string") {
		if (d.startsWith("data:image/") || d.startsWith("iVBORw0KGgo") || d.startsWith("/9j/")) return d;
		return;
	}
	if (typeof d === "object" && d !== null) {
		const obj = d;
		if (typeof obj["image_data"] === "string") return obj["image_data"];
		if (typeof obj["image_path"] === "string") return obj["image_path"];
		if (typeof obj["imageBase64"] === "string") return obj["imageBase64"];
		if (typeof obj["imagePath"] === "string") return obj["imagePath"];
		for (const key of Object.keys(obj)) {
			const match = extractImage(obj[key]);
			if (match) return match;
		}
	}
}
function registerObserveFunction(sdk, kv, dedupMap, maxObservationsPerSession) {
	sdk.registerFunction("mem::observe", async (payload) => {
		if (!payload?.sessionId || typeof payload.sessionId !== "string" || !payload.hookType || typeof payload.hookType !== "string" || !payload.timestamp || typeof payload.timestamp !== "string") return {
			success: false,
			error: "Invalid payload: sessionId, hookType, and timestamp are required"
		};
		const obsId = generateId("obs");
		let dedupHash;
		if (dedupMap) {
			const d = typeof payload.data === "object" && payload.data !== null ? payload.data : {};
			const toolName = d["tool_name"] || payload.hookType;
			dedupHash = dedupMap.computeHash(payload.sessionId, toolName, d["tool_input"]);
			if (dedupMap.isDuplicate(dedupHash)) return {
				deduplicated: true,
				sessionId: payload.sessionId
			};
		}
		let sanitizedRaw = payload.data;
		try {
			const sanitized = stripPrivateData(JSON.stringify(payload.data));
			sanitizedRaw = JSON.parse(sanitized);
		} catch {
			sanitizedRaw = stripPrivateData(String(payload.data));
		}
		const raw = {
			id: obsId,
			sessionId: payload.sessionId,
			timestamp: payload.timestamp,
			hookType: payload.hookType,
			raw: sanitizedRaw
		};
		let extractedImage;
		if (typeof sanitizedRaw === "object" && sanitizedRaw !== null) {
			const d = sanitizedRaw;
			if (payload.hookType === "post_tool_use" || payload.hookType === "post_tool_failure") {
				raw.toolName = d["tool_name"];
				raw.toolInput = d["tool_input"];
				raw.toolOutput = d["tool_output"] || d["error"];
			}
			if (payload.hookType === "prompt_submit") raw.userPrompt = d["prompt"];
			extractedImage = extractImage(sanitizedRaw);
			if (extractedImage) raw.modality = raw.toolInput || raw.toolOutput || raw.userPrompt ? "mixed" : "image";
		} else if (typeof sanitizedRaw === "string") {
			extractedImage = extractImage(sanitizedRaw);
			if (extractedImage) raw.modality = "image";
		}
		const pendingImageData = extractedImage;
		return withKeyedLock(`obs:${payload.sessionId}`, async () => {
			if (maxObservationsPerSession && maxObservationsPerSession > 0) {
				if ((await kv.list(KV.observations(payload.sessionId))).length >= maxObservationsPerSession) return {
					success: false,
					error: `Session observation limit reached (${maxObservationsPerSession})`
				};
			}
			if (pendingImageData && (pendingImageData.startsWith("data:image/") || pendingImageData.startsWith("iVBORw0KGgo") || pendingImageData.startsWith("/9j/"))) {
				const { saveImageToDisk } = await Promise.resolve().then(() => image_store_exports);
				const { filePath, bytesWritten } = await saveImageToDisk(pendingImageData);
				raw.imageData = filePath;
				const { incrementImageRef } = await Promise.resolve().then(() => image_refs_exports);
				await incrementImageRef(kv, filePath);
				sdk.triggerVoid("mem::disk-size-delta", { deltaBytes: bytesWritten });
				if (process.env["AGENTMEMORY_IMAGE_EMBEDDINGS"] === "true") sdk.triggerVoid("mem::vision-embed", {
					imageRef: filePath,
					sessionId: payload.sessionId,
					observationId: obsId
				});
			}
			try {
				await kv.set(KV.observations(payload.sessionId), obsId, raw);
			} catch (error) {
				if (raw.imageData) {
					const { deleteImage } = await Promise.resolve().then(() => image_store_exports);
					const { deletedBytes } = await deleteImage(raw.imageData);
					if (deletedBytes > 0) sdk.triggerVoid("mem::disk-size-delta", { deltaBytes: -deletedBytes });
				}
				throw error;
			}
			if (dedupMap && dedupHash) dedupMap.record(dedupHash);
			await sdk.trigger({
				function_id: "stream::set",
				payload: {
					stream_name: STREAM.name,
					group_id: STREAM.group(payload.sessionId),
					item_id: obsId,
					data: {
						type: "raw",
						observation: raw
					}
				}
			});
			await sdk.trigger({
				function_id: "stream::send",
				payload: {
					stream_name: STREAM.name,
					group_id: STREAM.viewerGroup,
					id: `raw-${obsId}`,
					type: "raw_observation",
					data: {
						type: "raw",
						observation: raw,
						sessionId: payload.sessionId
					}
				},
				action: TriggerAction.Void()
			});
			const session = await kv.get(KV.sessions, payload.sessionId);
			if (session) {
				const updates = [{
					type: "set",
					path: "updatedAt",
					value: (/* @__PURE__ */ new Date()).toISOString()
				}, {
					type: "set",
					path: "observationCount",
					value: (session.observationCount || 0) + 1
				}];
				if (!session.firstPrompt && typeof raw.userPrompt === "string") {
					const trimmed = raw.userPrompt.replace(/\s+/g, " ").trim();
					if (trimmed.length > 0) updates.push({
						type: "set",
						path: "firstPrompt",
						value: trimmed.slice(0, 200)
					});
				}
				await kv.update(KV.sessions, payload.sessionId, updates);
			}
			if (isAutoCompressEnabled()) await sdk.trigger({
				function_id: "mem::compress",
				payload: {
					observationId: obsId,
					sessionId: payload.sessionId,
					raw
				},
				action: TriggerAction.Void()
			});
			else {
				const synthetic = buildSyntheticCompression(raw);
				await kv.set(KV.observations(payload.sessionId), obsId, synthetic);
				getSearchIndex().add(synthetic);
				await vectorIndexAddGuarded(synthetic.id, synthetic.sessionId, synthetic.title + " " + (synthetic.narrative || ""), {
					kind: "synthetic",
					logId: synthetic.id
				});
				await sdk.trigger({
					function_id: "stream::set",
					payload: {
						stream_name: STREAM.name,
						group_id: STREAM.group(payload.sessionId),
						item_id: obsId,
						data: {
							type: "compressed",
							observation: synthetic
						}
					}
				});
				await sdk.trigger({
					function_id: "stream::set",
					payload: {
						stream_name: STREAM.name,
						group_id: STREAM.viewerGroup,
						item_id: obsId,
						data: {
							type: "compressed",
							observation: synthetic,
							sessionId: payload.sessionId
						}
					}
				});
			}
			logger.info("Observation captured", {
				obsId,
				sessionId: payload.sessionId,
				hook: payload.hookType,
				compress: isAutoCompressEnabled() ? "llm" : "synthetic"
			});
			return { observationId: obsId };
		});
	});
}

//#endregion
//#region src/utils/image-store.ts
var image_store_exports = /* @__PURE__ */ __exportAll({
	IMAGES_DIR: () => IMAGES_DIR,
	deleteImage: () => deleteImage,
	getMaxBytes: () => getMaxBytes,
	isManagedImagePath: () => isManagedImagePath,
	saveImageToDisk: () => saveImageToDisk,
	touchImage: () => touchImage
});
const IMAGES_DIR = join(homedir(), ".agentmemory", "images");
const DEFAULT_MAX_BYTES = 500 * 1024 * 1024;
function getMaxBytes() {
	return Number(process.env.AGENTMEMORY_IMAGE_STORE_MAX_BYTES) || DEFAULT_MAX_BYTES;
}
function isManagedImagePath(filePath) {
	const resolved = resolve(filePath);
	const normalizedImagesDir = resolve(IMAGES_DIR);
	return resolved.startsWith(normalizedImagesDir + sep) || resolved === normalizedImagesDir;
}
function contentHash(data) {
	return createHash("sha256").update(data).digest("hex");
}
async function saveImageToDisk(base64Data) {
	if (!base64Data) return {
		filePath: "",
		bytesWritten: 0
	};
	if (!existsSync(IMAGES_DIR)) await mkdir(IMAGES_DIR, { recursive: true });
	let cleanBase64 = base64Data;
	let ext = "png";
	if (base64Data.startsWith("data:image/")) {
		const commaIdx = base64Data.indexOf(",");
		if (commaIdx !== -1) {
			const meta = base64Data.substring(0, commaIdx);
			if (meta.includes("jpeg") || meta.includes("jpg")) ext = "jpg";
			else if (meta.includes("webp")) ext = "webp";
			else if (meta.includes("gif")) ext = "gif";
			cleanBase64 = base64Data.substring(commaIdx + 1);
		}
	} else if (base64Data.startsWith("/9j/")) ext = "jpg";
	const filePath = join(IMAGES_DIR, `${contentHash(cleanBase64)}.${ext}`);
	if (existsSync(filePath)) return {
		filePath,
		bytesWritten: 0
	};
	await writeFile(filePath, Buffer.from(cleanBase64, "base64"));
	return {
		filePath,
		bytesWritten: (await stat(filePath)).size
	};
}
async function deleteImage(filePath) {
	if (!filePath) return { deletedBytes: 0 };
	if (!isManagedImagePath(filePath)) return { deletedBytes: 0 };
	try {
		if (existsSync(filePath)) {
			const size = (await stat(filePath)).size;
			await unlink(filePath);
			return { deletedBytes: size };
		}
	} catch (err) {
		console.error("[agentmemory] Failed to delete image context:", err);
	}
	return { deletedBytes: 0 };
}
/** Touch an image file to update its mtime (marking it as recently used for LRU eviction) */
async function touchImage(filePath) {
	if (!filePath || !isManagedImagePath(filePath)) return;
	try {
		if (existsSync(filePath)) {
			const now = /* @__PURE__ */ new Date();
			await utimes(filePath, now, now);
		}
	} catch (err) {}
}

//#endregion
//#region src/functions/image-refs.ts
var image_refs_exports = /* @__PURE__ */ __exportAll({
	decrementImageRef: () => decrementImageRef,
	getImageRefCount: () => getImageRefCount,
	incrementImageRef: () => incrementImageRef
});
async function getImageRefCount(kv, filePath) {
	const count = await kv.get(KV.imageRefs, filePath);
	return count ? Number(count) : 0;
}
async function incrementImageRef(kv, filePath) {
	return withKeyedLock(`imgRef:${filePath}`, async () => {
		const current = await getImageRefCount(kv, filePath);
		await kv.set(KV.imageRefs, filePath, current + 1);
		await touchImage(filePath);
	});
}
async function decrementImageRef(kv, sdk, filePath) {
	return withKeyedLock(`imgRef:${filePath}`, async () => {
		const current = await getImageRefCount(kv, filePath);
		if (current <= 1) {
			await kv.delete(KV.imageEmbeddings, filePath);
			await kv.delete(KV.imageRefs, filePath);
			const { deletedBytes } = await deleteImage(filePath);
			if (deletedBytes > 0) sdk.triggerVoid("mem::disk-size-delta", { deltaBytes: -deletedBytes });
		} else await kv.set(KV.imageRefs, filePath, current - 1);
	});
}

//#endregion
//#region src/functions/image-quota-cleanup.ts
const GRACE_PERIOD_MS = 3e4;
function registerImageQuotaCleanup(sdk, kv) {
	sdk.registerFunction("mem::image-quota-cleanup", async () => {
		const now = Date.now();
		return withKeyedLock("system:cleanupLock", async () => {
			let totalSize = 0;
			const fileStats = [];
			try {
				const files = await readdir(IMAGES_DIR);
				for (const file of files) {
					if (file.startsWith(".")) continue;
					const filePath = join(IMAGES_DIR, file);
					const s = await stat(filePath);
					if (s.isFile()) {
						fileStats.push({
							filePath,
							size: s.size,
							mtimeMs: s.mtimeMs
						});
						totalSize += s.size;
					}
				}
			} catch {
				return {
					success: true,
					evicted: 0,
					freedBytes: 0
				};
			}
			const limit = getMaxBytes();
			if (totalSize <= limit) return {
				success: true,
				evicted: 0,
				freedBytes: 0,
				underQuota: true
			};
			fileStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
			let totalToFree = totalSize - limit;
			let evicted = 0;
			let freedBytes = 0;
			for (const f of fileStats) {
				if (totalToFree <= 0) break;
				if (now - f.mtimeMs < GRACE_PERIOD_MS) continue;
				await withKeyedLock(`imgRef:${f.filePath}`, async () => {
					let refCount;
					try {
						refCount = await getImageRefCount(kv, f.filePath);
					} catch (err) {
						logger.error("Failed to read refCount; skipping eviction", {
							filePath: f.filePath,
							error: err instanceof Error ? err.message : String(err)
						});
						return;
					}
					if (refCount > 0) return;
					const { deletedBytes } = await deleteImage(f.filePath);
					if (deletedBytes > 0) {
						sdk.triggerVoid("mem::disk-size-delta", { deltaBytes: -deletedBytes });
						totalToFree -= deletedBytes;
						freedBytes += deletedBytes;
						evicted++;
					}
				});
			}
			if (evicted > 0) {
				const freedMb = (freedBytes / (1024 * 1024)).toFixed(1);
				logger.info("Image quota cleanup complete", {
					evicted,
					freedMb
				});
			}
			return {
				success: true,
				evicted,
				freedBytes
			};
		});
	});
}

//#endregion
//#region src/functions/audit.ts
async function recordAudit(kv, operation, functionId, targetIds, details = {}, qualityScore, userId) {
	const entry = {
		id: generateId("aud"),
		timestamp: (/* @__PURE__ */ new Date()).toISOString(),
		operation,
		userId,
		functionId,
		targetIds,
		details,
		qualityScore
	};
	await kv.set(KV.audit, entry.id, entry);
	return entry;
}
async function safeAudit(kv, operation, functionId, targetIds, details = {}, qualityScore, userId) {
	try {
		await recordAudit(kv, operation, functionId, targetIds, details, qualityScore, userId);
	} catch (err) {
		try {
			logger.warn("audit write failed", {
				functionId,
				operation,
				targetIds,
				error: err instanceof Error ? err.message : String(err)
			});
		} catch {}
	}
}
async function queryAudit(kv, filter) {
	let entries = [...await kv.list(KV.audit)].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
	if (filter?.operation) entries = entries.filter((e) => e.operation === filter.operation);
	if (filter?.dateFrom) {
		const from = new Date(filter.dateFrom).getTime();
		if (Number.isNaN(from)) throw new Error(`Invalid dateFrom: ${filter.dateFrom}`);
		entries = entries.filter((e) => new Date(e.timestamp).getTime() >= from);
	}
	if (filter?.dateTo) {
		const to = new Date(filter.dateTo).getTime();
		if (Number.isNaN(to)) throw new Error(`Invalid dateTo: ${filter.dateTo}`);
		entries = entries.filter((e) => new Date(e.timestamp).getTime() <= to);
	}
	return entries.slice(0, filter?.limit || 100);
}

//#endregion
//#region src/functions/vision-search.ts
function registerVisionSearchFunctions(sdk, kv, imageProvider) {
	sdk.registerFunction("mem::vision-embed", async (data) => {
		if (!imageProvider?.embedImage) return {
			success: false,
			error: "image embeddings disabled (set AGENTMEMORY_IMAGE_EMBEDDINGS=true)"
		};
		if (!data?.imageRef || typeof data.imageRef !== "string") return {
			success: false,
			error: "imageRef required"
		};
		if (!isManagedImagePath(data.imageRef)) return {
			success: false,
			error: "imageRef must point to a file under the managed image store"
		};
		const refCount = await kv.get(KV.imageRefs, data.imageRef);
		if (!refCount || Number(refCount) < 1) return {
			success: false,
			error: "imageRef not registered in mem:image-refs"
		};
		try {
			const vec = await imageProvider.embedImage(data.imageRef);
			const stored = {
				imageRef: data.imageRef,
				vector: Array.from(vec),
				modelName: imageProvider.name,
				dimensions: imageProvider.dimensions,
				updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
				sessionId: data.sessionId,
				observationId: data.observationId
			};
			await kv.set(KV.imageEmbeddings, data.imageRef, stored);
			await recordAudit(kv, "vision_embed", "mem::vision-embed", [data.imageRef], {
				modelName: imageProvider.name,
				dimensions: stored.dimensions,
				sessionId: data.sessionId,
				observationId: data.observationId
			});
			return {
				success: true,
				imageRef: data.imageRef,
				dimensions: stored.dimensions
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.warn("vision-embed failed", {
				imageRef: data.imageRef,
				error: msg
			});
			return {
				success: false,
				error: msg
			};
		}
	});
	sdk.registerFunction("mem::vision-search", async (data) => {
		if (!imageProvider?.embedImage) return {
			success: false,
			error: "image embeddings disabled (set AGENTMEMORY_IMAGE_EMBEDDINGS=true)"
		};
		const requestedTopK = typeof data?.topK === "number" && Number.isFinite(data.topK) ? Math.trunc(data.topK) : 10;
		const topK = Math.min(50, Math.max(1, requestedTopK));
		let queryVec = null;
		try {
			if (data?.queryText) queryVec = await imageProvider.embed(data.queryText);
			else if (data?.queryImageBase64) {
				const b64 = data.queryImageBase64.startsWith("data:") ? data.queryImageBase64 : `data:image/png;base64,${data.queryImageBase64}`;
				queryVec = await imageProvider.embedImage(b64);
			} else if (data?.queryImageRef) {
				if (!isManagedImagePath(data.queryImageRef)) return {
					success: false,
					error: "queryImageRef must point to a file under the managed image store"
				};
				const refCount = await kv.get(KV.imageRefs, data.queryImageRef);
				if (!refCount || Number(refCount) < 1) return {
					success: false,
					error: "queryImageRef not registered in mem:image-refs"
				};
				queryVec = await imageProvider.embedImage(data.queryImageRef);
			} else return {
				success: false,
				error: "queryText, queryImageRef, or queryImageBase64 required"
			};
		} catch (err) {
			return {
				success: false,
				error: `query embed failed: ${err instanceof Error ? err.message : String(err)}`
			};
		}
		if (!queryVec) return {
			success: false,
			error: "failed to build query vector"
		};
		const stored = await kv.list(KV.imageEmbeddings);
		const scored = (data?.sessionId ? stored.filter((s) => s.sessionId === data.sessionId) : stored).map((s) => ({
			imageRef: s.imageRef,
			score: cosine(queryVec, s.vector),
			sessionId: s.sessionId,
			observationId: s.observationId,
			updatedAt: s.updatedAt
		}));
		scored.sort((a, b) => b.score - a.score);
		return {
			success: true,
			results: scored.slice(0, topK),
			total: scored.length
		};
	});
}
function cosine(a, b) {
	if (a.length !== b.length) return 0;
	let dot = 0;
	let normA = 0;
	let normB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		normA += a[i] * a[i];
		normB += b[i] * b[i];
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB);
	return denom === 0 ? 0 : dot / denom;
}

//#endregion
//#region src/functions/slots.ts
const DEFAULT_SIZE_LIMIT = 2e3;
const DEFAULT_SLOTS = [
	{
		label: "persona",
		content: "",
		sizeLimit: 1e3,
		description: "How the agent should see itself: role, tone, behavioural guidelines.",
		pinned: true,
		readOnly: false,
		scope: "global"
	},
	{
		label: "user_preferences",
		content: "",
		sizeLimit: 2e3,
		description: "Coding style, tool preferences, naming conventions, and other habits the user wants preserved across sessions.",
		pinned: true,
		readOnly: false,
		scope: "global"
	},
	{
		label: "tool_guidelines",
		content: "",
		sizeLimit: 1500,
		description: "Rules the agent should follow when picking or sequencing tools (e.g. prefer X over Y, never run Z without confirmation).",
		pinned: true,
		readOnly: false,
		scope: "global"
	},
	{
		label: "project_context",
		content: "",
		sizeLimit: 3e3,
		description: "Architecture decisions, codebase conventions, build/test commands, and cross-cutting constraints for the current project.",
		pinned: true,
		readOnly: false,
		scope: "project"
	},
	{
		label: "guidance",
		content: "",
		sizeLimit: 1500,
		description: "Active advice for the next session: what to focus on, what to avoid, open risks.",
		pinned: true,
		readOnly: false,
		scope: "project"
	},
	{
		label: "pending_items",
		content: "",
		sizeLimit: 2e3,
		description: "Unfinished work, explicit TODOs, and promises made but not yet delivered.",
		pinned: true,
		readOnly: false,
		scope: "project"
	},
	{
		label: "session_patterns",
		content: "",
		sizeLimit: 1500,
		description: "Recurring behaviours and common struggles observed across recent sessions.",
		pinned: false,
		readOnly: false,
		scope: "project"
	},
	{
		label: "self_notes",
		content: "",
		sizeLimit: 1500,
		description: "Free-form notes the agent keeps for itself: hypotheses, dead ends, things to revisit.",
		pinned: false,
		readOnly: false,
		scope: "project"
	}
];
function isSlotsEnabled() {
	return process.env["AGENTMEMORY_SLOTS"] === "true";
}
function isReflectEnabled() {
	return process.env["AGENTMEMORY_REFLECT"] === "true";
}
function scopeKv(scope) {
	return scope === "global" ? KV.globalSlots : KV.slots;
}
function nowIso() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
function validateLabel(label) {
	if (typeof label !== "string") return null;
	const trimmed = label.trim();
	if (!trimmed || trimmed.length > 64) return null;
	if (!/^[a-z][a-z0-9_]*$/.test(trimmed)) return null;
	return trimmed;
}
async function readSlot(kv, label) {
	const project = await kv.get(KV.slots, label);
	if (project) return {
		slot: project,
		scope: "project"
	};
	const global = await kv.get(KV.globalSlots, label);
	if (global) return {
		slot: global,
		scope: "global"
	};
	return {
		slot: null,
		scope: "project"
	};
}
async function readSlotInScope(kv, label, scope) {
	return kv.get(scopeKv(scope), label);
}
function validateScope(raw) {
	if (raw === void 0 || raw === null) return "project";
	if (raw === "project" || raw === "global") return raw;
	return null;
}
function validateSizeLimit(raw) {
	if (raw === void 0 || raw === null) return DEFAULT_SIZE_LIMIT;
	if (typeof raw !== "number") return null;
	if (!Number.isInteger(raw) || raw < 1 || raw > 2e4) return null;
	return raw;
}
async function seedDefaults(kv) {
	const ts = nowIso();
	for (const tmpl of DEFAULT_SLOTS) {
		const target = scopeKv(tmpl.scope);
		if (await kv.get(target, tmpl.label)) continue;
		const slot = {
			...tmpl,
			createdAt: ts,
			updatedAt: ts
		};
		await kv.set(target, tmpl.label, slot);
	}
}
async function listPinnedSlots(kv) {
	const [project, global] = await Promise.all([kv.list(KV.slots), kv.list(KV.globalSlots)]);
	const merged = /* @__PURE__ */ new Map();
	for (const s of global) merged.set(s.label, s);
	for (const s of project) merged.set(s.label, s);
	return Array.from(merged.values()).filter((s) => s.pinned && s.content.trim().length > 0).sort((a, b) => a.label.localeCompare(b.label));
}
function renderPinnedContext(slots) {
	if (slots.length === 0) return "";
	const lines = ["# agentmemory pinned slots", ""];
	for (const slot of slots) {
		lines.push(`## ${slot.label}`);
		lines.push(slot.content.trim());
		lines.push("");
	}
	return lines.join("\n");
}
function registerSlotsFunctions(sdk, kv) {
	seedDefaults(kv).catch((err) => {
		logger.warn("slot defaults seed failed", { error: err instanceof Error ? err.message : String(err) });
	});
	sdk.registerFunction("mem::slot-list", async () => {
		const [project, global] = await Promise.all([kv.list(KV.slots), kv.list(KV.globalSlots)]);
		const merged = /* @__PURE__ */ new Map();
		for (const s of global) merged.set(s.label, s);
		for (const s of project) merged.set(s.label, s);
		return {
			success: true,
			slots: Array.from(merged.values()).sort((a, b) => a.label.localeCompare(b.label))
		};
	});
	sdk.registerFunction("mem::slot-get", async (data) => {
		const label = validateLabel(data?.label);
		if (!label) return {
			success: false,
			error: "label required (lowercase, starts with letter, [a-z0-9_])"
		};
		const { slot, scope } = await readSlot(kv, label);
		if (!slot) return {
			success: false,
			error: "slot not found"
		};
		return {
			success: true,
			slot,
			scope
		};
	});
	sdk.registerFunction("mem::slot-create", async (data) => {
		const label = validateLabel(data?.label);
		if (!label) return {
			success: false,
			error: "label required (lowercase, starts with letter, [a-z0-9_])"
		};
		const scope = validateScope(data?.scope);
		if (!scope) return {
			success: false,
			error: "scope must be 'project' or 'global'"
		};
		const sizeLimit = validateSizeLimit(data?.sizeLimit);
		if (sizeLimit === null) return {
			success: false,
			error: "sizeLimit must be an integer between 1 and 20000"
		};
		const content = typeof data?.content === "string" ? data.content : "";
		if (content.length > sizeLimit) return {
			success: false,
			error: `content exceeds sizeLimit (${content.length} > ${sizeLimit})`
		};
		const description = typeof data?.description === "string" ? data.description : "";
		const pinned = typeof data?.pinned === "boolean" ? data.pinned : true;
		return withKeyedLock(`slot:${label}`, async () => {
			if (await readSlotInScope(kv, label, scope)) return {
				success: false,
				error: `slot already exists in ${scope} scope`
			};
			const ts = nowIso();
			const slot = {
				label,
				content,
				sizeLimit,
				description,
				pinned,
				readOnly: false,
				scope,
				createdAt: ts,
				updatedAt: ts
			};
			await kv.set(scopeKv(scope), label, slot);
			await recordAudit(kv, "slot_create", "mem::slot-create", [label], {
				scope,
				sizeLimit: slot.sizeLimit,
				pinned: slot.pinned
			});
			return {
				success: true,
				slot
			};
		});
	});
	sdk.registerFunction("mem::slot-append", async (data) => {
		const label = validateLabel(data?.label);
		if (!label) return {
			success: false,
			error: "label required"
		};
		const text = typeof data?.text === "string" ? data.text : "";
		if (!text) return {
			success: false,
			error: "text required"
		};
		return withKeyedLock(`slot:${label}`, async () => {
			const { slot, scope } = await readSlot(kv, label);
			if (!slot) return {
				success: false,
				error: "slot not found (use mem::slot-create first)"
			};
			if (slot.readOnly) return {
				success: false,
				error: "slot is read-only"
			};
			const sep = slot.content && !slot.content.endsWith("\n") ? "\n" : "";
			const next = `${slot.content}${sep}${text}`;
			if (next.length > slot.sizeLimit) return {
				success: false,
				error: `append would exceed sizeLimit (${next.length} > ${slot.sizeLimit}). Use mem::slot-replace to compact first.`,
				currentSize: slot.content.length,
				sizeLimit: slot.sizeLimit
			};
			const updated = {
				...slot,
				content: next,
				updatedAt: nowIso()
			};
			await kv.set(scopeKv(scope), label, updated);
			await recordAudit(kv, "slot_append", "mem::slot-append", [label], {
				scope,
				added: text.length,
				total: next.length
			});
			return {
				success: true,
				slot: updated,
				size: next.length
			};
		});
	});
	sdk.registerFunction("mem::slot-replace", async (data) => {
		const label = validateLabel(data?.label);
		if (!label) return {
			success: false,
			error: "label required"
		};
		if (typeof data?.content !== "string") return {
			success: false,
			error: "content required (string)"
		};
		return withKeyedLock(`slot:${label}`, async () => {
			const { slot, scope } = await readSlot(kv, label);
			if (!slot) return {
				success: false,
				error: "slot not found (use mem::slot-create first)"
			};
			if (slot.readOnly) return {
				success: false,
				error: "slot is read-only"
			};
			if (data.content.length > slot.sizeLimit) return {
				success: false,
				error: `content exceeds sizeLimit (${data.content.length} > ${slot.sizeLimit})`,
				sizeLimit: slot.sizeLimit
			};
			const updated = {
				...slot,
				content: data.content,
				updatedAt: nowIso()
			};
			await kv.set(scopeKv(scope), label, updated);
			await recordAudit(kv, "slot_replace", "mem::slot-replace", [label], {
				scope,
				before: slot.content.length,
				after: data.content.length
			});
			return {
				success: true,
				slot: updated,
				size: data.content.length
			};
		});
	});
	sdk.registerFunction("mem::slot-delete", async (data) => {
		const label = validateLabel(data?.label);
		if (!label) return {
			success: false,
			error: "label required"
		};
		return withKeyedLock(`slot:${label}`, async () => {
			const { slot, scope } = await readSlot(kv, label);
			if (!slot) return {
				success: false,
				error: "slot not found"
			};
			if (slot.readOnly) return {
				success: false,
				error: "slot is read-only"
			};
			await kv.delete(scopeKv(scope), label);
			await recordAudit(kv, "slot_delete", "mem::slot-delete", [label], {
				scope,
				size: slot.content.length
			});
			return { success: true };
		});
	});
	sdk.registerFunction("mem::slot-reflect", async (data) => {
		if (!data?.sessionId || typeof data.sessionId !== "string") return {
			success: false,
			error: "sessionId required"
		};
		const max = typeof data.maxObservations === "number" && Number.isInteger(data.maxObservations) && data.maxObservations > 0 ? Math.min(200, data.maxObservations) : 50;
		const observations = await kv.list(KV.observations(data.sessionId));
		if (observations.length === 0) return {
			success: true,
			applied: 0,
			reason: "no observations for session"
		};
		const recent = observations.slice().sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")).slice(0, max);
		const pendingLines = [];
		const patternCounts = /* @__PURE__ */ new Map();
		const files = /* @__PURE__ */ new Set();
		for (const obs of recent) {
			const title = (obs.title || "").toLowerCase();
			if ((obs.narrative || "").toLowerCase().includes("todo") || title.includes("todo")) pendingLines.push(`- ${obs.title || obs.id}`);
			if (obs.type === "error") patternCounts.set("errors", (patternCounts.get("errors") ?? 0) + 1);
			if (obs.type === "command_run") patternCounts.set("commands", (patternCounts.get("commands") ?? 0) + 1);
			if (obs.files) for (const f of obs.files) files.add(f);
		}
		let applied = 0;
		if (pendingLines.length > 0) {
			if (await withKeyedLock(`slot:pending_items`, async () => {
				const { slot, scope } = await readSlot(kv, "pending_items");
				if (!slot) return false;
				const already = new Set(slot.content.split("\n"));
				const fresh = pendingLines.filter((line) => !already.has(line));
				if (fresh.length === 0) return false;
				const sep = slot.content && !slot.content.endsWith("\n") ? "\n" : "";
				const next = `${slot.content}${sep}${fresh.join("\n")}`;
				const truncated = next.length > slot.sizeLimit ? next.slice(next.length - slot.sizeLimit) : next;
				await kv.set(scopeKv(scope), "pending_items", {
					...slot,
					content: truncated,
					updatedAt: nowIso()
				});
				return true;
			})) applied++;
		}
		if (patternCounts.size > 0) {
			if (await withKeyedLock(`slot:session_patterns`, async () => {
				const { slot, scope } = await readSlot(kv, "session_patterns");
				if (!slot) return false;
				const summary = [`last reflection: ${nowIso()}`, ...Array.from(patternCounts.entries()).map(([kind, count]) => `- ${kind}: ${count} in last ${recent.length} observations`)].join("\n");
				const next = summary.length > slot.sizeLimit ? summary.slice(0, slot.sizeLimit) : summary;
				await kv.set(scopeKv(scope), "session_patterns", {
					...slot,
					content: next,
					updatedAt: nowIso()
				});
				return true;
			})) applied++;
		}
		if (files.size > 0) {
			if (await withKeyedLock(`slot:project_context`, async () => {
				const { slot, scope } = await readSlot(kv, "project_context");
				if (!slot) return false;
				const already = slot.content;
				const fresh = Array.from(files).filter((f) => !already.includes(f)).slice(0, 20);
				if (fresh.length === 0) return false;
				const header = already.length === 0 ? "Files touched in recent sessions:" : "";
				const nextRaw = `${already}${already && !already.endsWith("\n") ? "\n" : ""}${header ? header + "\n" : ""}${fresh.map((f) => `- ${f}`).join("\n")}`;
				const next = nextRaw.length > slot.sizeLimit ? nextRaw.slice(nextRaw.length - slot.sizeLimit) : nextRaw;
				await kv.set(scopeKv(scope), "project_context", {
					...slot,
					content: next,
					updatedAt: nowIso()
				});
				return true;
			})) applied++;
		}
		if (applied > 0) await recordAudit(kv, "slot_reflect", "mem::slot-reflect", [data.sessionId], {
			observationCount: recent.length,
			slotsUpdated: applied
		});
		return {
			success: true,
			applied,
			observationsReviewed: recent.length
		};
	});
}

//#endregion
//#region src/functions/disk-size-manager.ts
const DISK_SIZE_KEY = "system:currentDiskSize";
function registerDiskSizeManager(sdk, kv) {
	sdk.registerFunction("mem::disk-size-delta", async (data) => {
		if (typeof data?.deltaBytes !== "number" || !isFinite(data.deltaBytes)) return {
			success: false,
			error: "deltaBytes must be a finite number"
		};
		return withKeyedLock(DISK_SIZE_KEY, async () => {
			let newTotal = (await kv.get(KV.state, DISK_SIZE_KEY) || 0) + data.deltaBytes;
			if (newTotal < 0) newTotal = 0;
			await kv.set(KV.state, DISK_SIZE_KEY, newTotal);
			if (data.deltaBytes > 0 && newTotal > getMaxBytes()) {
				sdk.triggerVoid("mem::image-quota-cleanup", {});
				logger.info("Disk quota exceeded, cleanup triggered", {
					currentBytes: newTotal,
					maxBytes: getMaxBytes()
				});
			}
			return {
				success: true,
				currentTotal: newTotal
			};
		});
	});
}

//#endregion
//#region src/prompts/compression.ts
const COMPRESSION_SYSTEM = `You are a memory compression engine for an AI coding agent. Your job is to extract the essential information from a tool usage observation and compress it into structured data.

Output EXACTLY this XML format with no additional text:

<observation>
  <type>one of: file_read, file_write, file_edit, command_run, search, web_fetch, conversation, error, decision, discovery, subagent, notification, task, other</type>
  <title>Short descriptive title (max 80 chars)</title>
  <subtitle>One-line context (optional)</subtitle>
  <facts>
    <fact>Specific factual detail 1</fact>
    <fact>Specific factual detail 2</fact>
  </facts>
  <narrative>2-3 sentence summary of what happened and why it matters</narrative>
  <concepts>
    <concept>technical concept or pattern</concept>
  </concepts>
  <files>
    <file>path/to/file</file>
  </files>
  <importance>1-10 scale, 10 being critical architectural decision</importance>
</observation>

Rules:
- Be concise but preserve ALL technically relevant details
- File paths must be exact
- Importance: 1-3 for routine reads, 4-6 for edits/commands, 7-9 for architectural decisions, 10 for breaking changes
- Concepts should be reusable search terms (e.g., "React hooks", "SQL migration", "auth middleware")
- Strip any secrets, tokens, or credentials from the output`;
function buildCompressionPrompt(observation) {
	const parts = [`Timestamp: ${observation.timestamp}`, `Hook: ${observation.hookType}`];
	if (observation.toolName) parts.push(`Tool: ${observation.toolName}`);
	if (observation.toolInput) {
		const input = typeof observation.toolInput === "string" ? observation.toolInput : JSON.stringify(observation.toolInput, null, 2);
		parts.push(`Input:\n${truncate$1(input, 4e3)}`);
	}
	if (observation.toolOutput) {
		const output = typeof observation.toolOutput === "string" ? observation.toolOutput : JSON.stringify(observation.toolOutput, null, 2);
		parts.push(`Output:\n${truncate$1(output, 4e3)}`);
	}
	if (observation.userPrompt) parts.push(`User prompt:\n${truncate$1(observation.userPrompt, 2e3)}`);
	return parts.join("\n\n");
}
function truncate$1(s, max) {
	return s.length > max ? s.slice(0, max) + "\n[...truncated]" : s;
}

//#endregion
//#region src/prompts/vision.ts
const VISION_DESCRIPTION_PROMPT = `Describe what this image shows in the context of software development. Extract:
- What type of image this is (screenshot, diagram, mockup, terminal output, error, etc.)
- Key entities visible (files, components, UI elements, error messages)
- Relationships or flow shown
- Any decisions, errors, or state visible
- Text content visible in the image

Be concise but preserve all technically relevant details. Output plain text, no XML.`;

//#endregion
//#region src/prompts/xml.ts
const VALID_TAG = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
function getXmlTag(xml, tag) {
	if (!VALID_TAG.test(tag)) return "";
	const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
	return match ? match[1].trim() : "";
}
function getXmlChildren(xml, parentTag, childTag) {
	if (!VALID_TAG.test(parentTag) || !VALID_TAG.test(childTag)) return [];
	const parentMatch = xml.match(new RegExp(`<${parentTag}>([\\s\\S]*?)</${parentTag}>`));
	if (!parentMatch) return [];
	const items = [];
	const re = new RegExp(`<${childTag}>([\\s\\S]*?)</${childTag}>`, "g");
	let m;
	while ((m = re.exec(parentMatch[1])) !== null) items.push(m[1].trim());
	return items;
}

//#endregion
//#region src/eval/schemas.ts
const HookTypeEnum = z.enum([
	"session_start",
	"prompt_submit",
	"pre_tool_use",
	"post_tool_use",
	"post_tool_failure",
	"pre_compact",
	"subagent_start",
	"subagent_stop",
	"notification",
	"task_completed",
	"stop",
	"session_end"
]);
const ObservationTypeEnum = z.enum([
	"file_read",
	"file_write",
	"file_edit",
	"command_run",
	"search",
	"web_fetch",
	"conversation",
	"error",
	"decision",
	"discovery",
	"subagent",
	"notification",
	"task",
	"other"
]);
const ObserveInputSchema = z.object({
	hookType: HookTypeEnum,
	sessionId: z.string().min(1),
	project: z.string().min(1),
	cwd: z.string().min(1),
	timestamp: z.string().min(1),
	data: z.unknown()
});
const CompressOutputSchema = z.object({
	type: ObservationTypeEnum,
	title: z.string().min(1).max(120),
	subtitle: z.string().optional(),
	facts: z.array(z.string()).min(1),
	narrative: z.string().min(10),
	concepts: z.array(z.string()),
	files: z.array(z.string()),
	importance: z.number().int().min(1).max(10)
});
const SummaryOutputSchema = z.object({
	title: z.string().min(1),
	narrative: z.string().min(20),
	keyDecisions: z.array(z.string()),
	filesModified: z.array(z.string()),
	concepts: z.array(z.string())
});
const SearchInputSchema = z.object({
	query: z.string().min(1),
	limit: z.number().int().positive().optional()
});
const ContextInputSchema = z.object({
	sessionId: z.string().min(1),
	project: z.string().min(1),
	budget: z.number().positive().optional()
});
const RememberInputSchema = z.object({
	content: z.string().min(1),
	type: z.enum([
		"pattern",
		"preference",
		"architecture",
		"bug",
		"workflow",
		"fact"
	]).optional(),
	concepts: z.array(z.string()).optional(),
	files: z.array(z.string()).optional()
});
const SmartSearchInputSchema = z.object({
	query: z.string().optional(),
	expandIds: z.array(z.string()).optional(),
	limit: z.number().int().positive().optional()
});
const TimelineInputSchema = z.object({
	anchor: z.string().min(1),
	project: z.string().optional(),
	before: z.number().int().nonnegative().optional(),
	after: z.number().int().nonnegative().optional()
});
const ProfileInputSchema = z.object({
	project: z.string().min(1),
	refresh: z.boolean().optional()
});
const RelateInputSchema = z.object({
	sourceId: z.string().min(1),
	targetId: z.string().min(1),
	type: z.enum([
		"supersedes",
		"extends",
		"derives",
		"contradicts",
		"related"
	])
});
const EvolveInputSchema = z.object({
	memoryId: z.string().min(1),
	newContent: z.string().min(1),
	newTitle: z.string().optional()
});
const ExportImportInputSchema = z.object({
	exportData: z.object({
		version: z.union([z.literal("0.3.0"), z.literal("0.4.0")]),
		exportedAt: z.string(),
		sessions: z.array(z.unknown()),
		observations: z.record(z.string(), z.array(z.unknown())),
		memories: z.array(z.unknown()),
		summaries: z.array(z.unknown()),
		profiles: z.array(z.unknown()).optional()
	}),
	strategy: z.enum([
		"merge",
		"replace",
		"skip"
	]).optional()
});

//#endregion
//#region src/eval/validator.ts
function validateInput(schema, data, functionId) {
	const parsed = schema.safeParse(data);
	if (parsed.success) return {
		valid: true,
		data: parsed.data
	};
	return {
		valid: false,
		result: {
			valid: false,
			errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
			qualityScore: 0,
			latencyMs: 0,
			functionId
		}
	};
}
function validateOutput(schema, data, functionId) {
	return validateInput(schema, data, functionId);
}

//#endregion
//#region src/eval/quality.ts
function scoreCompression(obs) {
	let score = 0;
	if (obs.facts && obs.facts.length > 0) score += 25;
	if (obs.facts && obs.facts.length >= 3) score += 10;
	if (obs.narrative && obs.narrative.length >= 20) score += 20;
	if (obs.narrative && obs.narrative.length >= 50) score += 5;
	if (obs.title && obs.title.length >= 5 && obs.title.length <= 120) score += 15;
	if (obs.concepts && obs.concepts.length > 0) score += 15;
	if (obs.importance && obs.importance >= 1 && obs.importance <= 10) score += 10;
	return Math.min(100, score);
}
function scoreSummary(summary) {
	let score = 0;
	if (summary.title && summary.title.length >= 5) score += 20;
	if (summary.narrative && summary.narrative.length >= 20) score += 25;
	if (summary.narrative && summary.narrative.length >= 100) score += 5;
	if (summary.keyDecisions && summary.keyDecisions.length > 0) score += 20;
	if (summary.filesModified && summary.filesModified.length > 0) score += 15;
	if (summary.concepts && summary.concepts.length > 0) score += 15;
	return Math.min(100, score);
}

//#endregion
//#region src/eval/self-correct.ts
const STRICTER_SUFFIX = `

IMPORTANT: Your previous response was invalid. Please ensure your output strictly follows the required XML format. Every required field must be present with valid values.`;
async function compressWithRetry(provider, systemPrompt, userPrompt, validator, maxRetries = 1) {
	const first = await provider.compress(systemPrompt, userPrompt);
	if (validator(first).valid) return {
		response: first,
		retried: false
	};
	for (let i = 0; i < maxRetries; i++) {
		const retry = await provider.compress(systemPrompt + STRICTER_SUFFIX, userPrompt);
		if (validator(retry).valid) return {
			response: retry,
			retried: true
		};
	}
	return {
		response: first,
		retried: true
	};
}

//#endregion
//#region src/functions/compress.ts
const VALID_TYPES$1 = new Set([
	"file_read",
	"file_write",
	"file_edit",
	"command_run",
	"search",
	"web_fetch",
	"conversation",
	"error",
	"decision",
	"discovery",
	"subagent",
	"notification",
	"task",
	"image",
	"other"
]);
function parseCompressionXml(xml) {
	const rawType = getXmlTag(xml, "type");
	const title = getXmlTag(xml, "title");
	if (!rawType || !title) return null;
	return {
		type: VALID_TYPES$1.has(rawType) ? rawType : "other",
		title,
		subtitle: getXmlTag(xml, "subtitle") || void 0,
		facts: getXmlChildren(xml, "facts", "fact"),
		narrative: getXmlTag(xml, "narrative"),
		concepts: getXmlChildren(xml, "concepts", "concept"),
		files: getXmlChildren(xml, "files", "file"),
		importance: Math.max(1, Math.min(10, parseInt(getXmlTag(xml, "importance") || "5", 10) || 5))
	};
}
function registerCompressFunction(sdk, kv, provider, metricsStore) {
	sdk.registerFunction("mem::compress", async (data) => {
		const startMs = Date.now();
		let imageDescription;
		const hasImage = data.raw.modality === "image" || data.raw.modality === "mixed";
		if (hasImage && data.raw.imageData && provider.describeImage) try {
			let base64Data = data.raw.imageData;
			let mimeType = "image/png";
			if (!data.raw.imageData.startsWith("/9j/") && !data.raw.imageData.startsWith("iVBOR")) {
				if (!isManagedImagePath(data.raw.imageData)) throw new Error(`Refusing to read image outside managed store: ${data.raw.imageData}`);
				base64Data = readFileSync(data.raw.imageData).toString("base64");
				if (data.raw.imageData.endsWith(".jpg") || data.raw.imageData.endsWith(".jpeg")) mimeType = "image/jpeg";
				else if (data.raw.imageData.endsWith(".webp")) mimeType = "image/webp";
				else if (data.raw.imageData.endsWith(".gif")) mimeType = "image/gif";
			}
			imageDescription = await provider.describeImage(base64Data, mimeType, VISION_DESCRIPTION_PROMPT);
			logger.info("Image described by vision model", { obsId: data.observationId });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.warn("Vision model call failed, falling back to text-only compression", {
				obsId: data.observationId,
				error: msg
			});
		}
		const prompt = buildCompressionPrompt({
			hookType: data.raw.hookType,
			toolName: data.raw.toolName,
			toolInput: data.raw.toolInput,
			toolOutput: imageDescription ? `[Image Description]: ${imageDescription}\n\n${data.raw.toolOutput ?? ""}` : data.raw.toolOutput,
			userPrompt: data.raw.userPrompt,
			timestamp: data.raw.timestamp
		});
		try {
			const validator = (response) => {
				const parsed = parseCompressionXml(response);
				if (!parsed) return {
					valid: false,
					errors: ["xml_parse_failed"]
				};
				const result = validateOutput(CompressOutputSchema, parsed, "mem::compress");
				return result.valid ? { valid: true } : {
					valid: false,
					errors: result.result.errors
				};
			};
			const { response, retried } = await compressWithRetry(provider, COMPRESSION_SYSTEM, prompt, validator, 1);
			const parsed = parseCompressionXml(response);
			if (!parsed) {
				const latencyMs = Date.now() - startMs;
				if (metricsStore) await metricsStore.record("mem::compress", latencyMs, false);
				logger.warn("Failed to parse compression XML", {
					obsId: data.observationId,
					retried
				});
				return {
					success: false,
					error: "parse_failed"
				};
			}
			const qualityScore = scoreCompression(parsed);
			const compressed = {
				id: data.observationId,
				sessionId: data.sessionId,
				timestamp: data.raw.timestamp,
				...parsed,
				confidence: qualityScore / 100,
				...hasImage ? { modality: data.raw.modality } : {},
				...imageDescription ? { imageDescription } : {},
				...data.raw.imageData ? { imageRef: data.raw.imageData } : {}
			};
			await kv.set(KV.observations(data.sessionId), data.observationId, compressed);
			try {
				getSearchIndex().add(compressed);
			} catch (err) {
				logger.warn("Failed to index compressed observation into BM25", {
					obsId: compressed.id,
					sessionId: compressed.sessionId,
					title: compressed.title,
					error: err instanceof Error ? err.message : String(err)
				});
			}
			await vectorIndexAddGuarded(compressed.id, compressed.sessionId, compressed.title + " " + (compressed.narrative || ""), {
				kind: "observation",
				logId: compressed.id
			});
			const streamResults = await Promise.allSettled([sdk.trigger({
				function_id: "stream::set",
				payload: {
					stream_name: STREAM.name,
					group_id: STREAM.group(data.sessionId),
					item_id: data.observationId,
					data: {
						type: "compressed",
						observation: compressed
					}
				}
			}), sdk.trigger({
				function_id: "stream::send",
				payload: {
					stream_name: STREAM.name,
					group_id: STREAM.viewerGroup,
					id: `compressed-${data.observationId}`,
					type: "compressed_observation",
					data: {
						type: "compressed",
						observation: compressed,
						sessionId: data.sessionId
					}
				},
				action: TriggerAction.Void()
			})]);
			for (const result of streamResults) if (result.status === "rejected") logger.warn("Non-fatal stream publish failure after compress", {
				sessionId: data.sessionId,
				observationId: data.observationId,
				error: result.reason instanceof Error ? result.reason.message : String(result.reason)
			});
			const latencyMs = Date.now() - startMs;
			if (metricsStore) await metricsStore.record("mem::compress", latencyMs, true, qualityScore);
			logger.info("Observation compressed", {
				obsId: data.observationId,
				type: compressed.type,
				importance: compressed.importance,
				qualityScore,
				retried
			});
			return {
				success: true,
				compressed,
				qualityScore
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			const latencyMs = Date.now() - startMs;
			if (metricsStore) await metricsStore.record("mem::compress", latencyMs, false);
			logger.error("Compression failed", {
				obsId: data.observationId,
				error: msg
			});
			return {
				success: false,
				error: "compression_failed"
			};
		}
	});
}

//#endregion
//#region src/functions/context.ts
function estimateTokens$1(text) {
	return Math.ceil(text.length / 3);
}
function escapeXmlAttr(s) {
	return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function registerContextFunction(sdk, kv, tokenBudget) {
	sdk.registerFunction("mem::context", async (data) => {
		const budget = data.budget || tokenBudget;
		const blocks = [];
		const [pinnedSlots, profile, lessons] = await Promise.all([
			isSlotsEnabled() ? listPinnedSlots(kv).catch(() => []) : Promise.resolve([]),
			kv.get(KV.profiles, data.project).catch(() => null),
			kv.list(KV.lessons).catch(() => [])
		]);
		const slotContent = renderPinnedContext(pinnedSlots);
		if (slotContent) blocks.push({
			type: "memory",
			content: slotContent,
			tokens: estimateTokens$1(slotContent),
			recency: Date.now()
		});
		if (profile) {
			const profileParts = [];
			if (profile.topConcepts.length > 0) profileParts.push(`Concepts: ${profile.topConcepts.slice(0, 8).map((c) => c.concept).join(", ")}`);
			if (profile.topFiles.length > 0) profileParts.push(`Key files: ${profile.topFiles.slice(0, 5).map((f) => f.file).join(", ")}`);
			if (profile.conventions.length > 0) profileParts.push(`Conventions: ${profile.conventions.join("; ")}`);
			if (profile.commonErrors.length > 0) profileParts.push(`Common errors: ${profile.commonErrors.slice(0, 3).join("; ")}`);
			if (profileParts.length > 0) {
				const profileContent = `## Project Profile\n${profileParts.join("\n")}`;
				blocks.push({
					type: "memory",
					content: profileContent,
					tokens: estimateTokens$1(profileContent),
					recency: new Date(profile.updatedAt).getTime()
				});
			}
		}
		const relevantLessons = lessons.filter((l) => !l.deleted && (!l.project || l.project === data.project)).sort((a, b) => {
			const scoreA = (a.project === data.project ? 1.5 : 1) * a.confidence;
			return (b.project === data.project ? 1.5 : 1) * b.confidence - scoreA;
		}).slice(0, 10);
		if (relevantLessons.length > 0) {
			const lessonsContent = `## Lessons Learned\n${relevantLessons.map((l) => `- (${l.confidence.toFixed(2)}) ${l.content}${l.context ? ` — ${l.context}` : ""}`).join("\n")}`;
			const mostRecent = relevantLessons.reduce((acc, l) => {
				const t = new Date(l.lastReinforcedAt || l.updatedAt).getTime();
				return t > acc ? t : acc;
			}, 0);
			blocks.push({
				type: "memory",
				content: lessonsContent,
				tokens: estimateTokens$1(lessonsContent),
				recency: mostRecent,
				sourceIds: relevantLessons.map((l) => l.id)
			});
		}
		const sessions = (await kv.list(KV.sessions)).filter((s) => s.project === data.project && s.id !== data.sessionId).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 10);
		const summariesPerSession = await Promise.all(sessions.map((s) => kv.get(KV.summaries, s.id).catch(() => null)));
		const sessionsNeedingObs = [];
		for (let i = 0; i < sessions.length; i++) {
			const summary = summariesPerSession[i];
			if (summary) {
				const content = `## ${summary.title}\n${summary.narrative}\nDecisions: ${summary.keyDecisions.join("; ")}\nFiles: ${summary.filesModified.join(", ")}`;
				blocks.push({
					type: "summary",
					content,
					tokens: estimateTokens$1(content),
					recency: new Date(summary.createdAt).getTime()
				});
			} else sessionsNeedingObs.push(i);
		}
		const obsResults = await Promise.all(sessionsNeedingObs.map((i) => kv.list(KV.observations(sessions[i].id)).catch(() => [])));
		for (let j = 0; j < sessionsNeedingObs.length; j++) {
			const i = sessionsNeedingObs[j];
			const important = obsResults[j].filter((o) => o.title && o.importance >= 5);
			if (important.length > 0) {
				const top = important.sort((a, b) => b.importance - a.importance).slice(0, 5);
				const items = top.map((o) => `- [${o.type}] ${o.title}: ${o.narrative}`).join("\n");
				const content = `## Session ${sessions[i].id.slice(0, 8)} (${sessions[i].startedAt})\n${items}`;
				blocks.push({
					type: "observation",
					content,
					tokens: estimateTokens$1(content),
					recency: new Date(sessions[i].startedAt).getTime(),
					sourceIds: top.map((o) => o.id)
				});
			}
		}
		blocks.sort((a, b) => b.recency - a.recency);
		let usedTokens = 0;
		const selected = [];
		const accessedIds = [];
		const header = `<agentmemory-context project="${escapeXmlAttr(data.project)}">`;
		const footer = `</agentmemory-context>`;
		usedTokens += estimateTokens$1(header) + estimateTokens$1(footer);
		for (const block of blocks) {
			if (usedTokens + block.tokens > budget) continue;
			selected.push(block.content);
			usedTokens += block.tokens;
			if (block.sourceIds && block.sourceIds.length > 0) accessedIds.push(...block.sourceIds);
		}
		if (accessedIds.length > 0) recordAccessBatch(kv, accessedIds);
		if (selected.length === 0) {
			logger.info("No context available", { project: data.project });
			return {
				context: "",
				blocks: 0,
				tokens: 0
			};
		}
		const result = `${header}\n${selected.join("\n\n")}\n${footer}`;
		logger.info("Context generated", {
			blocks: selected.length,
			tokens: usedTokens
		});
		return {
			context: result,
			blocks: selected.length,
			tokens: usedTokens
		};
	});
}

//#endregion
//#region src/prompts/summary.ts
const SUMMARY_SYSTEM = `You are a session summarizer for an AI coding agent's memory system. Given all compressed observations from a coding session, produce a concise session summary.

Output EXACTLY this XML format with no additional text:

<summary>
  <title>Short session title (max 100 chars)</title>
  <narrative>3-5 sentence narrative of what was accomplished</narrative>
  <decisions>
    <decision>Key technical decision made</decision>
  </decisions>
  <files>
    <file>path/to/modified/file</file>
  </files>
  <concepts>
    <concept>key concept from session</concept>
  </concepts>
</summary>

Rules:
- Focus on outcomes, not individual tool calls
- Highlight decisions and their rationale
- List all files that were created or modified
- Concepts should be searchable terms for future context retrieval`;
function buildSummaryPrompt(observations) {
	const lines = observations.map((obs, i) => {
		const facts = obs.facts.map((f) => `  - ${f}`).join("\n");
		return `[${i + 1}] ${obs.type}: ${obs.title}\n${obs.narrative}\nFacts:\n${facts}\nFiles: ${obs.files.join(", ")}`;
	});
	return `Session observations (${observations.length} total):\n\n${lines.join("\n\n---\n\n")}`;
}

//#endregion
//#region src/functions/summarize.ts
function parseSummaryXml(xml, sessionId, project, obsCount) {
	const title = getXmlTag(xml, "title");
	if (!title) return null;
	return {
		sessionId,
		project,
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		title,
		narrative: getXmlTag(xml, "narrative"),
		keyDecisions: getXmlChildren(xml, "decisions", "decision"),
		filesModified: getXmlChildren(xml, "files", "file"),
		concepts: getXmlChildren(xml, "concepts", "concept"),
		observationCount: obsCount
	};
}
function registerSummarizeFunction(sdk, kv, provider, metricsStore) {
	sdk.registerFunction("mem::summarize", async (data) => {
		const startMs = Date.now();
		if (!data || typeof data.sessionId !== "string" || !data.sessionId.trim()) return {
			success: false,
			error: "sessionId is required"
		};
		const sessionId = data.sessionId.trim();
		const session = await kv.get(KV.sessions, sessionId);
		if (!session) {
			logger.warn("Session not found for summarize", { sessionId });
			return {
				success: false,
				error: "session_not_found"
			};
		}
		const compressed = (await kv.list(KV.observations(sessionId))).filter((o) => o.title);
		if (compressed.length === 0) {
			logger.info("No observations to summarize", { sessionId });
			return {
				success: false,
				error: "no_observations"
			};
		}
		if (provider.name === "noop") {
			logger.info("Summarize skipped — no LLM provider configured", { sessionId });
			return {
				success: false,
				error: "no_provider",
				reason: "No LLM provider key set; Summarize is a no-op. Set ANTHROPIC_API_KEY (or GEMINI/OPENROUTER/MINIMAX) in ~/.agentmemory/.env to enable."
			};
		}
		try {
			const prompt = buildSummaryPrompt(compressed);
			const response = await provider.summarize(SUMMARY_SYSTEM, prompt);
			if (!response || !response.trim()) {
				const latencyMs = Date.now() - startMs;
				if (metricsStore) await metricsStore.record("mem::summarize", latencyMs, false);
				logger.warn("Empty provider response on summarize", {
					sessionId,
					provider: provider.name,
					promptBytes: prompt.length,
					systemBytes: SUMMARY_SYSTEM.length,
					observationCount: compressed.length
				});
				return {
					success: false,
					error: "empty_provider_response"
				};
			}
			const summary = parseSummaryXml(response, sessionId, session.project, compressed.length);
			if (!summary) {
				const latencyMs = Date.now() - startMs;
				if (metricsStore) await metricsStore.record("mem::summarize", latencyMs, false);
				logger.warn("Failed to parse summary XML", { sessionId });
				return {
					success: false,
					error: "parse_failed"
				};
			}
			const summaryForValidation = {
				title: summary.title,
				narrative: summary.narrative,
				keyDecisions: summary.keyDecisions,
				filesModified: summary.filesModified,
				concepts: summary.concepts
			};
			const validation = validateOutput(SummaryOutputSchema, summaryForValidation, "mem::summarize");
			if (!validation.valid) {
				const latencyMs = Date.now() - startMs;
				if (metricsStore) await metricsStore.record("mem::summarize", latencyMs, false);
				logger.warn("Summary validation failed", {
					sessionId,
					errors: validation.result.errors
				});
				return {
					success: false,
					error: "validation_failed"
				};
			}
			const qualityScore = scoreSummary(summaryForValidation);
			await kv.set(KV.summaries, sessionId, summary);
			await safeAudit(kv, "compress", "mem::summarize", [sessionId], {
				title: summary.title,
				observationCount: compressed.length
			});
			const latencyMs = Date.now() - startMs;
			if (metricsStore) await metricsStore.record("mem::summarize", latencyMs, true, qualityScore);
			logger.info("Session summarized", {
				sessionId,
				title: summary.title,
				decisions: summary.keyDecisions.length,
				qualityScore,
				valid: validation.valid
			});
			return {
				success: true,
				summary,
				qualityScore
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			const latencyMs = Date.now() - startMs;
			if (metricsStore) await metricsStore.record("mem::summarize", latencyMs, false);
			logger.error("Summarize failed", {
				sessionId,
				error: msg
			});
			return {
				success: false,
				error: msg
			};
		}
	});
}

//#endregion
//#region src/functions/migrate.ts
const ALLOWED_DIRS = [resolve(homedir(), ".agentmemory")];
function isAllowedPath(dbPath) {
	const resolved = resolve(dbPath);
	return ALLOWED_DIRS.some((dir) => resolved.startsWith(dir + "/"));
}
function registerMigrateFunction(sdk, kv) {
	sdk.registerFunction("mem::migrate", async (data) => {
		logger.info("Migration started", { dbPath: data.dbPath });
		if (!isAllowedPath(data.dbPath)) return {
			success: false,
			error: `Path not allowed. Must be under: ${ALLOWED_DIRS.join(", ")}`
		};
		let Database;
		try {
			Database = (await import("better-sqlite3")).default;
		} catch {
			return {
				success: false,
				error: "better-sqlite3 not installed. Run: npm install better-sqlite3"
			};
		}
		if (!(await import("node:fs")).existsSync(data.dbPath)) return {
			success: false,
			error: `Database not found: ${data.dbPath}`
		};
		let db;
		try {
			db = Database(data.dbPath, { readonly: true });
			let sessionCount = 0;
			let obsCount = 0;
			let summaryCount = 0;
			const sessions = db.prepare("SELECT * FROM sessions ORDER BY created_at DESC").all();
			for (const row of sessions) {
				const session = {
					id: row.session_id || row.id,
					project: row.project_path || row.project || "unknown",
					cwd: row.cwd || row.project_path || "",
					startedAt: row.created_at || row.started_at || (/* @__PURE__ */ new Date()).toISOString(),
					endedAt: row.ended_at || row.updated_at,
					status: "completed",
					observationCount: 0
				};
				await kv.set(KV.sessions, session.id, session);
				sessionCount++;
			}
			let observations = [];
			try {
				observations = db.prepare("SELECT * FROM observations ORDER BY created_at ASC").all();
			} catch {
				try {
					observations = db.prepare("SELECT * FROM compressed_observations ORDER BY created_at ASC").all();
				} catch {
					logger.warn("No observation tables found");
				}
			}
			for (const row of observations) {
				const sessionId = row.session_id || "migrated";
				const obs = {
					id: row.id || generateId("mig"),
					sessionId,
					timestamp: row.created_at || (/* @__PURE__ */ new Date()).toISOString(),
					type: row.type || "other",
					title: row.title || row.summary || "Migrated observation",
					subtitle: row.subtitle,
					facts: safeJsonParse(row.facts, []),
					narrative: row.narrative || row.content || "",
					concepts: safeJsonParse(row.concepts, []),
					files: safeJsonParse(row.files, []),
					importance: row.importance || 5
				};
				await kv.set(KV.observations(sessionId), obs.id, obs);
				obsCount++;
			}
			let summaries = [];
			try {
				summaries = db.prepare("SELECT * FROM session_summaries").all();
			} catch {
				logger.warn("No summaries table found");
			}
			for (const row of summaries) {
				const summary = {
					sessionId: row.session_id,
					project: row.project || "unknown",
					createdAt: row.created_at || (/* @__PURE__ */ new Date()).toISOString(),
					title: row.title || "Migrated session",
					narrative: row.narrative || row.summary || "",
					keyDecisions: safeJsonParse(row.key_decisions, []),
					filesModified: safeJsonParse(row.files_modified, []),
					concepts: safeJsonParse(row.concepts, []),
					observationCount: row.observation_count || 0
				};
				await kv.set(KV.summaries, row.session_id, summary);
				summaryCount++;
			}
			logger.info("Migration complete", {
				sessionCount,
				obsCount,
				summaryCount
			});
			return {
				success: true,
				sessionCount,
				obsCount,
				summaryCount
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Migration failed", { error: msg });
			return {
				success: false,
				error: "Migration failed"
			};
		} finally {
			try {
				if (db) db.close();
			} catch {}
		}
	});
}
function safeJsonParse(value, fallback) {
	if (Array.isArray(value)) return value;
	if (typeof value === "string") try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
	return fallback;
}

//#endregion
//#region src/functions/file-index.ts
function registerFileIndexFunction(sdk, kv) {
	sdk.registerFunction("mem::file-context", async (data) => {
		const sessionId = data && typeof data.sessionId === "string" ? data.sessionId.trim() : "";
		const normalizedProject = typeof data?.project === "string" ? data.project.trim() : void 0;
		const files = Array.isArray(data?.files) ? data.files.map((file) => typeof file === "string" ? file.trim() : "").filter(Boolean) : [];
		if (files.length === 0) {
			await recordAudit(kv, "observe", "mem::file-context", [sessionId || "unknown"], {
				error: "invalid_payload",
				hasSessionId: !!sessionId,
				hasProject: !!normalizedProject,
				fileCount: files.length
			});
			return {
				context: "",
				files: []
			};
		}
		const results = [];
		const sessions = await kv.list(KV.sessions);
		let otherSessions = sessionId ? sessions.filter((s) => s.id !== sessionId) : sessions;
		if (normalizedProject) otherSessions = otherSessions.filter((s) => s.project === normalizedProject);
		otherSessions = otherSessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 15);
		const obsCache = /* @__PURE__ */ new Map();
		for (const session of otherSessions) obsCache.set(session.id, await kv.list(KV.observations(session.id)));
		for (const file of files) {
			const history = {
				file,
				observations: []
			};
			const normalizedFile = file.replace(/^\.\//, "");
			for (const session of otherSessions) {
				const observations = obsCache.get(session.id) || [];
				for (const obs of observations) {
					if (!obs.files || !obs.title) continue;
					if (obs.files.some((f) => f === file || f === normalizedFile || f.endsWith(`/${normalizedFile}`) || normalizedFile.endsWith(`/${f}`)) && obs.importance >= 4) history.observations.push({
						sessionId: session.id,
						obsId: obs.id,
						type: obs.type,
						title: obs.title,
						narrative: obs.narrative,
						importance: obs.importance,
						timestamp: obs.timestamp
					});
				}
			}
			history.observations.sort((a, b) => b.importance - a.importance);
			history.observations = history.observations.slice(0, 5);
			if (history.observations.length > 0) results.push(history);
		}
		if (results.length === 0) return { context: "" };
		const lines = ["<agentmemory-file-context>"];
		for (const fh of results) {
			lines.push(`## ${fh.file}`);
			for (const obs of fh.observations) lines.push(`- [${obs.type}] ${obs.title}: ${obs.narrative}`);
		}
		lines.push("</agentmemory-file-context>");
		const accessedIds = [];
		for (const fh of results) for (const obs of fh.observations) accessedIds.push(obs.obsId);
		recordAccessBatch(kv, accessedIds);
		const context = lines.join("\n");
		logger.info("File context generated", {
			files: files.length,
			results: results.length
		});
		return { context };
	});
}

//#endregion
//#region src/functions/consolidate.ts
const CONSOLIDATION_SYSTEM = `You are a memory consolidation engine. Given a set of related observations from coding sessions, synthesize them into a single long-term memory.

Output XML:
<memory>
  <type>pattern|preference|architecture|bug|workflow|fact</type>
  <title>Concise memory title (max 80 chars)</title>
  <content>2-4 sentence description of the learned insight</content>
  <concepts>
    <concept>key term</concept>
  </concepts>
  <files>
    <file>relevant/file/path</file>
  </files>
  <strength>1-10 how confident/important this memory is</strength>
</memory>`;
function parseMemoryXml(xml, sessionIds) {
	const type = getXmlTag(xml, "type");
	const title = getXmlTag(xml, "title");
	const content = getXmlTag(xml, "content");
	if (!type || !title || !content) return null;
	return {
		type: new Set([
			"pattern",
			"preference",
			"architecture",
			"bug",
			"workflow",
			"fact"
		]).has(type) ? type : "fact",
		title,
		content,
		concepts: getXmlChildren(xml, "concepts", "concept"),
		files: getXmlChildren(xml, "files", "file"),
		sessionIds,
		strength: Math.max(1, Math.min(10, parseInt(getXmlTag(xml, "strength") || "5", 10) || 5)),
		version: 1,
		isLatest: true
	};
}
function registerConsolidateFunction(sdk, kv, provider) {
	sdk.registerFunction("mem::consolidate", async (data) => {
		const minObs = data.minObservations ?? 10;
		const sessions = await kv.list(KV.sessions);
		const filtered = data.project ? sessions.filter((s) => s.project === data.project) : sessions;
		const allObs = [];
		const obsPerSession = [];
		for (let batch = 0; batch < filtered.length; batch += 10) {
			const chunk = filtered.slice(batch, batch + 10);
			const results = await Promise.all(chunk.map((s) => kv.list(KV.observations(s.id)).catch(() => [])));
			obsPerSession.push(...results);
		}
		for (let i = 0; i < filtered.length; i++) for (const obs of obsPerSession[i]) if (obs.title && obs.importance >= 5) allObs.push({
			...obs,
			sid: filtered[i].id
		});
		if (allObs.length < minObs) return {
			consolidated: 0,
			reason: "insufficient_observations"
		};
		const conceptGroups = /* @__PURE__ */ new Map();
		for (const obs of allObs) for (const concept of obs.concepts) {
			const key = concept.toLowerCase();
			if (!conceptGroups.has(key)) conceptGroups.set(key, []);
			conceptGroups.get(key).push(obs);
		}
		let consolidated = 0;
		const existingMemories = await kv.list(KV.memories);
		const existingTitles = new Set(existingMemories.map((m) => m.title.toLowerCase()));
		const MAX_LLM_CALLS = 10;
		let llmCallCount = 0;
		const sortedGroups = [...conceptGroups.entries()].filter(([, g]) => g.length >= 3).sort((a, b) => b[1].length - a[1].length);
		for (const [concept, obsGroup] of sortedGroups) {
			if (llmCallCount >= MAX_LLM_CALLS) break;
			const top = obsGroup.sort((a, b) => b.importance - a.importance).slice(0, 8);
			const sessionIds = [...new Set(top.map((o) => o.sid))];
			const prompt = top.map((o) => `[${o.type}] ${o.title}\n${o.narrative}\nFiles: ${o.files.join(", ")}\nImportance: ${o.importance}`).join("\n\n");
			try {
				const response = await Promise.race([provider.compress(CONSOLIDATION_SYSTEM, `Concept: "${concept}"\n\nObservations:\n${prompt}`), new Promise((_, reject) => setTimeout(() => reject(/* @__PURE__ */ new Error("compress timeout")), 3e4))]);
				llmCallCount++;
				const parsed = parseMemoryXml(response, sessionIds);
				if (!parsed) continue;
				const existingMatch = existingMemories.find((m) => m.title.toLowerCase() === parsed.title.toLowerCase());
				const now = (/* @__PURE__ */ new Date()).toISOString();
				const obsIds = [...new Set(top.map((o) => o.id))];
				if (existingMatch) {
					existingMatch.isLatest = false;
					await kv.set(KV.memories, existingMatch.id, existingMatch);
					await recordAudit(kv, "evolve", "mem::consolidate", [existingMatch.id], {
						action: "mark_non_latest",
						concept
					});
					const evolved = {
						id: generateId("mem"),
						createdAt: now,
						updatedAt: now,
						...parsed,
						version: (existingMatch.version || 1) + 1,
						parentId: existingMatch.id,
						supersedes: [existingMatch.id, ...existingMatch.supersedes || []],
						sourceObservationIds: obsIds,
						isLatest: true
					};
					await kv.set(KV.memories, evolved.id, evolved);
					await recordAudit(kv, "evolve", "mem::consolidate", [evolved.id], {
						action: "evolve_memory",
						oldId: existingMatch.id,
						newId: evolved.id,
						concept
					});
					existingTitles.add(evolved.title.toLowerCase());
					consolidated++;
				} else {
					const memory = {
						id: generateId("mem"),
						createdAt: now,
						updatedAt: now,
						...parsed,
						sourceObservationIds: obsIds,
						version: 1,
						isLatest: true
					};
					await kv.set(KV.memories, memory.id, memory);
					await recordAudit(kv, "remember", "mem::consolidate", [memory.id], {
						action: "create_memory",
						concept
					});
					existingTitles.add(memory.title.toLowerCase());
					consolidated++;
				}
			} catch (err) {
				logger.warn("Consolidation failed for concept", {
					concept,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
		logger.info("Consolidation complete", {
			consolidated,
			totalObs: allObs.length
		});
		return {
			consolidated,
			totalObservations: allObs.length
		};
	});
}

//#endregion
//#region src/functions/patterns.ts
function registerPatternsFunction(sdk, kv) {
	sdk.registerFunction("mem::patterns", async (data) => {
		const patterns = [];
		const sessions = await kv.list(KV.sessions);
		const filtered = data.project ? sessions.filter((s) => s.project === data.project) : sessions;
		const fileCoOccurrences = /* @__PURE__ */ new Map();
		const fileSessionMap = /* @__PURE__ */ new Map();
		const errorPatterns = /* @__PURE__ */ new Map();
		for (const session of filtered) {
			const observations = await kv.list(KV.observations(session.id));
			if (!observations.length) continue;
			const sessionFiles = /* @__PURE__ */ new Set();
			for (const obs of observations) {
				if (!obs.files) continue;
				for (const f of obs.files) {
					sessionFiles.add(f);
					if (!fileSessionMap.has(f)) fileSessionMap.set(f, /* @__PURE__ */ new Set());
					fileSessionMap.get(f).add(session.id);
				}
				if (obs.type === "error" && obs.title) {
					const key = obs.title.toLowerCase();
					if (!errorPatterns.has(key)) errorPatterns.set(key, {
						count: 0,
						sessions: /* @__PURE__ */ new Set()
					});
					const ep = errorPatterns.get(key);
					ep.count++;
					ep.sessions.add(session.id);
				}
			}
			const fileList = [...sessionFiles].sort();
			for (let i = 0; i < fileList.length; i++) for (let j = i + 1; j < fileList.length; j++) {
				const pair = `${fileList[i]}::${fileList[j]}`;
				fileCoOccurrences.set(pair, (fileCoOccurrences.get(pair) || 0) + 1);
			}
		}
		for (const [pair, count] of fileCoOccurrences) {
			if (count < 3) continue;
			const [fileA, fileB] = pair.split("::");
			const sessionsA = fileSessionMap.get(fileA) || /* @__PURE__ */ new Set();
			const sessionsB = fileSessionMap.get(fileB) || /* @__PURE__ */ new Set();
			const commonSessions = [...sessionsA].filter((s) => sessionsB.has(s));
			patterns.push({
				type: "co_change",
				description: `${fileA} and ${fileB} are frequently modified together`,
				files: [fileA, fileB],
				frequency: count,
				sessions: commonSessions
			});
		}
		for (const [errorKey, { count, sessions: errorSessions }] of errorPatterns) {
			if (count < 2) continue;
			patterns.push({
				type: "error_repeat",
				description: `Recurring error: ${errorKey}`,
				files: [],
				frequency: count,
				sessions: [...errorSessions]
			});
		}
		patterns.sort((a, b) => b.frequency - a.frequency);
		logger.info("Pattern detection complete", {
			patterns: patterns.length,
			sessions: filtered.length
		});
		return { patterns: patterns.slice(0, 20) };
	});
	sdk.registerFunction("mem::generate-rules", async (data) => {
		const result = await sdk.trigger({
			function_id: "mem::patterns",
			payload: data
		});
		const rules = [];
		for (const pattern of result.patterns) {
			if (pattern.type === "co_change" && pattern.frequency >= 4) rules.push(`When modifying ${pattern.files[0]}, also check ${pattern.files[1]} (co-changed ${pattern.frequency} times).`);
			if (pattern.type === "error_repeat" && pattern.frequency >= 3) rules.push(`Watch for: ${pattern.description} (occurred ${pattern.frequency} times across ${pattern.sessions.length} sessions).`);
		}
		logger.info("Rules generated", { count: rules.length });
		return { rules };
	});
}

//#endregion
//#region src/functions/remember.ts
function registerRememberFunction(sdk, kv) {
	sdk.registerFunction("mem::remember", async (data) => {
		if (!data.content || typeof data.content !== "string" || !data.content.trim()) return {
			success: false,
			error: "content is required"
		};
		if (data.files && !Array.isArray(data.files)) return {
			success: false,
			error: "files must be an array"
		};
		if (data.concepts && !Array.isArray(data.concepts)) return {
			success: false,
			error: "concepts must be an array"
		};
		if (data.sourceObservationIds && !Array.isArray(data.sourceObservationIds)) return {
			success: false,
			error: "sourceObservationIds must be an array"
		};
		const memType = new Set([
			"pattern",
			"preference",
			"architecture",
			"bug",
			"workflow",
			"fact"
		]).has(data.type || "") ? data.type : "fact";
		const now = (/* @__PURE__ */ new Date()).toISOString();
		return withKeyedLock("mem:remember", async () => {
			const existingMemories = await kv.list(KV.memories);
			let supersededId;
			let supersededVersion = 1;
			let supersededMemory;
			const lowerContent = data.content.toLowerCase();
			for (const existing of existingMemories) {
				if (existing.isLatest === false) continue;
				if (jaccardSimilarity(lowerContent, existing.content.toLowerCase()) > .7) {
					supersededId = existing.id;
					supersededVersion = existing.version ?? 1;
					supersededMemory = existing;
					break;
				}
			}
			const memory = {
				id: generateId("mem"),
				createdAt: now,
				updatedAt: now,
				type: memType,
				title: data.content.slice(0, 80),
				content: data.content,
				concepts: data.concepts || [],
				files: data.files || [],
				sessionIds: [],
				strength: 7,
				version: supersededId ? supersededVersion + 1 : 1,
				parentId: supersededId,
				supersedes: supersededId ? [supersededId] : [],
				sourceObservationIds: (data.sourceObservationIds || []).filter((id) => typeof id === "string" && id.length > 0),
				isLatest: true
			};
			if (data.ttlDays && typeof data.ttlDays === "number" && data.ttlDays > 0) memory.forgetAfter = new Date(Date.now() + data.ttlDays * 864e5).toISOString();
			if (supersededMemory) {
				supersededMemory.isLatest = false;
				await kv.set(KV.memories, supersededMemory.id, supersededMemory);
			}
			await kv.set(KV.memories, memory.id, memory);
			try {
				getSearchIndex().add(memoryToObservation(memory));
			} catch (err) {
				logger.warn("Failed to index saved memory into BM25", {
					memId: memory.id,
					error: err instanceof Error ? err.message : String(err)
				});
			}
			await vectorIndexAddGuarded(memory.id, memory.sessionIds[0] ?? "memory", memory.title + " " + memory.content, {
				kind: "memory",
				logId: memory.id
			});
			if (supersededId) await sdk.trigger({
				function_id: "mem::cascade-update",
				payload: { supersededMemoryId: supersededId },
				action: TriggerAction.Void()
			});
			logger.info("Memory saved", {
				memId: memory.id,
				type: memory.type
			});
			return {
				success: true,
				memory
			};
		});
	});
	sdk.registerFunction("mem::forget", async (data) => {
		let deleted = 0;
		const deletedMemoryIds = [];
		const deletedObservationIds = [];
		let deletedSession = false;
		const { decrementImageRef } = await Promise.resolve().then(() => image_refs_exports);
		if (data.memoryId) {
			const mem = await kv.get(KV.memories, data.memoryId);
			await kv.delete(KV.memories, data.memoryId);
			if (mem?.imageRef) await decrementImageRef(kv, sdk, mem.imageRef);
			await deleteAccessLog(kv, data.memoryId);
			deletedMemoryIds.push(data.memoryId);
			deleted++;
		}
		if (data.sessionId && data.observationIds && data.observationIds.length > 0) for (const obsId of data.observationIds) {
			const obs = await kv.get(KV.observations(data.sessionId), obsId);
			await kv.delete(KV.observations(data.sessionId), obsId);
			if (obs?.imageData) await decrementImageRef(kv, sdk, obs.imageData);
			if (obs?.imageRef && obs.imageRef !== obs.imageData) await decrementImageRef(kv, sdk, obs.imageRef);
			deletedObservationIds.push(obsId);
			deleted++;
		}
		if (data.sessionId && (!data.observationIds || data.observationIds.length === 0) && !data.memoryId) {
			const observations = await kv.list(KV.observations(data.sessionId));
			for (const obs of observations) {
				await kv.delete(KV.observations(data.sessionId), obs.id);
				if (obs.imageData) await decrementImageRef(kv, sdk, obs.imageData);
				if (obs.imageRef && obs.imageRef !== obs.imageData) await decrementImageRef(kv, sdk, obs.imageRef);
				deletedObservationIds.push(obs.id);
				deleted++;
			}
			await kv.delete(KV.sessions, data.sessionId);
			await kv.delete(KV.summaries, data.sessionId);
			deletedSession = true;
			deleted += 2;
		}
		if (deleted > 0) await recordAudit(kv, "forget", "mem::forget", [...deletedMemoryIds, ...deletedObservationIds], {
			sessionId: data.sessionId,
			deleted,
			memoriesDeleted: deletedMemoryIds.length,
			observationsDeleted: deletedObservationIds.length,
			sessionDeleted: deletedSession,
			reason: "user-initiated forget"
		});
		logger.info("Memory forgotten", { deleted });
		return {
			success: true,
			deleted
		};
	});
}

//#endregion
//#region src/functions/evict.ts
const MS_PER_DAY$1 = 1440 * 60 * 1e3;
const DEFAULTS$1 = {
	staleSessionDays: 30,
	lowImportanceMaxDays: 90,
	lowImportanceThreshold: 3,
	maxObservationsPerProject: 1e4
};
function isValidRecoveryResult(result) {
	if (!result || typeof result !== "object") return false;
	if (!("success" in result)) return true;
	return result.success !== false;
}
function isCompressedObservation(observation) {
	return "title" in observation && typeof observation.title === "string" && observation.title.length > 0;
}
async function recoverStaleSession(sdk, sessionId) {
	try {
		const result = await sdk.trigger({
			function_id: "event::session::stopped",
			payload: { sessionId }
		});
		if (!isValidRecoveryResult(result)) {
			logger.warn("Stale session recovery failed", {
				sessionId,
				result
			});
			return false;
		}
		return true;
	} catch (err) {
		logger.warn("Stale session recovery failed", {
			sessionId,
			error: err instanceof Error ? err.message : String(err)
		});
		return false;
	}
}
async function runRecoveredSessionConsolidation(sdk) {
	try {
		await sdk.trigger({
			function_id: "mem::consolidate-pipeline",
			payload: { tier: "all" }
		});
	} catch (err) {
		logger.warn("Recovered session consolidation failed", { error: err instanceof Error ? err.message : String(err) });
	}
}
function registerEvictFunction(sdk, kv) {
	sdk.registerFunction("mem::evict", async (data) => {
		const dryRun = data?.dryRun ?? false;
		const { decrementImageRef } = await Promise.resolve().then(() => image_refs_exports);
		const configOverride = await kv.get(KV.config, "eviction").catch(() => null);
		const cfg = {
			...DEFAULTS$1,
			...configOverride
		};
		const now = Date.now();
		const stats = {
			staleSessions: 0,
			lowImportanceObs: 0,
			capEvictions: 0,
			expiredMemories: 0,
			nonLatestMemories: 0,
			dryRun
		};
		let recoveredStaleSessions = 0;
		const sessions = await kv.list(KV.sessions).catch(() => []);
		const summaries = await kv.list(KV.summaries).catch(() => []);
		const summaryIds = new Set(summaries.map((s) => s.sessionId));
		for (const session of sessions) {
			if (!session.startedAt) continue;
			if (now - new Date(session.startedAt).getTime() > cfg.staleSessionDays * MS_PER_DAY$1 && !summaryIds.has(session.id)) if (dryRun) stats.staleSessions++;
			else {
				const observations = await kv.list(KV.observations(session.id)).catch((err) => {
					logger.warn("Stale session observation scan failed", {
						sessionId: session.id,
						error: err instanceof Error ? err.message : String(err)
					});
					return null;
				});
				if (!observations) continue;
				let recovered = false;
				if (observations.some(isCompressedObservation)) {
					recovered = await recoverStaleSession(sdk, session.id);
					if (!recovered) continue;
					recoveredStaleSessions++;
				} else if (observations.length > 0) {
					logger.warn("Stale session has no compressed observations", { sessionId: session.id });
					continue;
				}
				try {
					await kv.delete(KV.sessions, session.id);
					stats.staleSessions++;
				} catch (err) {
					logger.warn("Eviction delete failed", {
						resource: "session",
						id: session.id,
						error: err instanceof Error ? err.message : String(err)
					});
					continue;
				}
				await recordAudit(kv, "delete", "mem::evict", [session.id], {
					resource: "session",
					reason: recovered ? "stale_session_recovered_then_evicted" : "stale_session_without_summary",
					dryRun
				});
			}
		}
		if (!dryRun && recoveredStaleSessions > 0) await runRecoveredSessionConsolidation(sdk);
		const projectObs = /* @__PURE__ */ new Map();
		for (const session of sessions) {
			const compressed = (await kv.list(KV.observations(session.id)).catch(() => [])).filter((o) => o.title);
			for (const o of compressed) {
				if (!o.timestamp) continue;
				if (now - new Date(o.timestamp).getTime() > cfg.lowImportanceMaxDays * MS_PER_DAY$1 && (o.importance ?? 5) < cfg.lowImportanceThreshold) if (dryRun) stats.lowImportanceObs++;
				else {
					try {
						await kv.delete(KV.observations(session.id), o.id);
						stats.lowImportanceObs++;
					} catch (err) {
						logger.warn("Eviction delete failed", {
							resource: "observation",
							id: o.id,
							sessionId: session.id,
							error: err instanceof Error ? err.message : String(err)
						});
						continue;
					}
					if (o.imageData) await decrementImageRef(kv, sdk, o.imageData);
					if (o.imageRef && o.imageRef !== o.imageData) await decrementImageRef(kv, sdk, o.imageRef);
					await recordAudit(kv, "delete", "mem::evict", [o.id], {
						resource: "observation",
						reason: "low_importance_old_observation",
						sessionId: session.id,
						dryRun
					});
				}
			}
			const project = session.project || "unknown";
			const existing = projectObs.get(project) || [];
			existing.push(...compressed);
			projectObs.set(project, existing);
		}
		for (const [, obs] of projectObs) if (obs.length > cfg.maxObservationsPerProject) {
			const toEvict = obs.sort((a, b) => (a.importance ?? 5) - (b.importance ?? 5)).slice(0, obs.length - cfg.maxObservationsPerProject);
			if (dryRun) stats.capEvictions += toEvict.length;
			else for (const o of toEvict) {
				try {
					await kv.delete(KV.observations(o.sessionId), o.id);
					stats.capEvictions++;
				} catch (err) {
					logger.warn("Eviction delete failed", {
						resource: "observation",
						id: o.id,
						sessionId: o.sessionId,
						error: err instanceof Error ? err.message : String(err)
					});
					continue;
				}
				if (o.imageData) await decrementImageRef(kv, sdk, o.imageData);
				if (o.imageRef && o.imageRef !== o.imageData) await decrementImageRef(kv, sdk, o.imageRef);
				await recordAudit(kv, "delete", "mem::evict", [o.id], {
					resource: "observation",
					reason: "project_observation_cap",
					sessionId: o.sessionId,
					dryRun
				});
			}
		}
		const memories = await kv.list(KV.memories).catch(() => []);
		const evictedMemIds = /* @__PURE__ */ new Set();
		for (const mem of memories) {
			if (mem.forgetAfter) {
				if (now > new Date(mem.forgetAfter).getTime()) if (dryRun) {
					stats.expiredMemories++;
					evictedMemIds.add(mem.id);
				} else {
					try {
						await kv.delete(KV.memories, mem.id);
						stats.expiredMemories++;
						evictedMemIds.add(mem.id);
					} catch (err) {
						logger.warn("Eviction delete failed", {
							resource: "memory",
							id: mem.id,
							reason: "expired_memory",
							error: err instanceof Error ? err.message : String(err)
						});
						continue;
					}
					if (mem.imageRef) await decrementImageRef(kv, sdk, mem.imageRef);
					await recordAudit(kv, "delete", "mem::evict", [mem.id], {
						resource: "memory",
						reason: "expired_memory",
						dryRun
					});
					await deleteAccessLog(kv, mem.id);
				}
			}
			if (!evictedMemIds.has(mem.id) && mem.isLatest === false && mem.createdAt) {
				if (now - new Date(mem.createdAt).getTime() > cfg.lowImportanceMaxDays * MS_PER_DAY$1) if (dryRun) stats.nonLatestMemories++;
				else {
					try {
						await kv.delete(KV.memories, mem.id);
						stats.nonLatestMemories++;
					} catch (err) {
						logger.warn("Eviction delete failed", {
							resource: "memory",
							id: mem.id,
							reason: "old_non_latest_memory",
							error: err instanceof Error ? err.message : String(err)
						});
						continue;
					}
					if (mem.imageRef) await decrementImageRef(kv, sdk, mem.imageRef);
					await recordAudit(kv, "delete", "mem::evict", [mem.id], {
						resource: "memory",
						reason: "old_non_latest_memory",
						dryRun
					});
					await deleteAccessLog(kv, mem.id);
				}
			}
		}
		logger.info("Eviction complete", { stats });
		return stats;
	});
}

//#endregion
//#region src/functions/relations.ts
function computeConfidence(source, target, relationType) {
	let score = .5;
	const sharedSessions = source.sessionIds.filter((sid) => target.sessionIds.includes(sid));
	score += Math.min(sharedSessions.length * .1, .3);
	const now = Date.now();
	const sourceAge = now - new Date(source.updatedAt).getTime();
	const targetAge = now - new Date(target.updatedAt).getTime();
	const sevenDays = 10080 * 60 * 1e3;
	const ninetyDays = 2160 * 60 * 60 * 1e3;
	if (sourceAge < sevenDays && targetAge < sevenDays) score += .1;
	else if (sourceAge > ninetyDays && targetAge > ninetyDays) score -= .1;
	if (relationType === "supersedes") score += .1;
	if (relationType === "contradicts") score -= .05;
	return Math.max(0, Math.min(1, score));
}
function registerRelationsFunction(sdk, kv) {
	sdk.registerFunction("mem::relate", async (data) => {
		const [firstId, secondId] = [data.sourceId, data.targetId].sort();
		return withKeyedLock(firstId === secondId ? `mem:${firstId}` : `mem:${firstId}:${secondId}`, async () => {
			const source = await kv.get(KV.memories, data.sourceId);
			const target = await kv.get(KV.memories, data.targetId);
			if (!source || !target) return {
				success: false,
				error: "source or target memory not found"
			};
			const confidence = data.confidence !== void 0 ? Math.max(0, Math.min(1, data.confidence)) : computeConfidence(source, target, data.type);
			const relation = {
				type: data.type,
				sourceId: data.sourceId,
				targetId: data.targetId,
				createdAt: (/* @__PURE__ */ new Date()).toISOString(),
				confidence
			};
			const relationId = generateId("rel");
			await kv.set(KV.relations, relationId, relation);
			if (!source.relatedIds) source.relatedIds = [];
			let sourceUpdated = false;
			if (!source.relatedIds.includes(data.targetId)) {
				source.relatedIds.push(data.targetId);
				await kv.set(KV.memories, data.sourceId, source);
				sourceUpdated = true;
			}
			if (!target.relatedIds) target.relatedIds = [];
			let targetUpdated = false;
			if (!target.relatedIds.includes(data.sourceId)) {
				target.relatedIds.push(data.sourceId);
				await kv.set(KV.memories, data.targetId, target);
				targetUpdated = true;
			}
			await safeAudit(kv, "relation_create", "mem::relate", [relationId], {
				type: data.type,
				sourceId: data.sourceId,
				targetId: data.targetId,
				confidence
			});
			if (sourceUpdated) await safeAudit(kv, "relation_update", "mem::relate", [data.sourceId], {
				relationId,
				updatedRelatedId: data.targetId
			});
			if (targetUpdated) await safeAudit(kv, "relation_update", "mem::relate", [data.targetId], {
				relationId,
				updatedRelatedId: data.sourceId
			});
			logger.info("Memory relation created", {
				relationId,
				type: data.type,
				source: data.sourceId,
				target: data.targetId
			});
			return {
				success: true,
				relationId,
				relation
			};
		});
	});
	sdk.registerFunction("mem::evolve", async (data) => {
		const existing = await kv.get(KV.memories, data.memoryId);
		if (!existing) return {
			success: false,
			error: "memory not found"
		};
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const evolved = {
			...existing,
			id: generateId("mem"),
			createdAt: now,
			updatedAt: now,
			title: data.newTitle || existing.title,
			content: data.newContent,
			version: (existing.version || 1) + 1,
			parentId: existing.id,
			supersedes: [existing.id, ...existing.supersedes || []],
			isLatest: true
		};
		existing.isLatest = false;
		await kv.set(KV.memories, existing.id, existing);
		await safeAudit(kv, "evolve", "mem::evolve", [existing.id], {
			operation: "evolve",
			action: "mark_non_latest",
			newId: evolved.id
		});
		await kv.set(KV.memories, evolved.id, evolved);
		await safeAudit(kv, "evolve", "mem::evolve", [evolved.id], {
			operation: "evolve",
			oldId: existing.id,
			newId: evolved.id,
			version: evolved.version
		});
		const relation = {
			type: "supersedes",
			sourceId: evolved.id,
			targetId: existing.id,
			createdAt: now,
			confidence: 1
		};
		const relationId = generateId("rel");
		await kv.set(KV.relations, relationId, relation);
		await safeAudit(kv, "evolve", "mem::evolve", [relationId], {
			operation: "supersedes",
			oldId: existing.id,
			newId: evolved.id
		});
		logger.info("Memory evolved", {
			oldId: existing.id,
			newId: evolved.id,
			version: evolved.version
		});
		return {
			success: true,
			memory: evolved,
			previousId: existing.id
		};
	});
	sdk.registerFunction("mem::get-related", async (data) => {
		const maxHops = Math.min(data.maxHops ?? 2, 5);
		const MAX_VISITED = 500;
		const rawMinConf = Number(data.minConfidence);
		const minConfidence = Number.isFinite(rawMinConf) ? Math.max(0, Math.min(1, rawMinConf)) : 0;
		const allRelations = await kv.list(KV.relations).catch(() => []);
		const visited = /* @__PURE__ */ new Set();
		const result = [];
		const queue = [{
			id: data.memoryId,
			hop: 0
		}];
		while (queue.length > 0 && visited.size < MAX_VISITED) {
			const current = queue.shift();
			if (visited.has(current.id) || current.hop > maxHops) continue;
			visited.add(current.id);
			const memory = await kv.get(KV.memories, current.id);
			if (!memory) continue;
			if (current.hop > 0) {
				const matchingRelations = allRelations.filter((r) => r.sourceId === current.id && visited.has(r.targetId) || r.targetId === current.id && visited.has(r.sourceId));
				const confidence = matchingRelations.length > 0 ? Math.max(...matchingRelations.map((r) => r.confidence ?? .5)) : .5;
				if (confidence >= minConfidence) result.push({
					memory,
					hop: current.hop,
					confidence
				});
			}
			const relatedIds = memory.relatedIds || [];
			const supersedes = memory.supersedes || [];
			const parentId = memory.parentId ? [memory.parentId] : [];
			const kvLinked = allRelations.filter((r) => r.sourceId === current.id || r.targetId === current.id).map((r) => r.sourceId === current.id ? r.targetId : r.sourceId);
			const allLinks = [...new Set([
				...relatedIds,
				...supersedes,
				...parentId,
				...kvLinked
			])];
			for (const nextId of allLinks) if (!visited.has(nextId)) queue.push({
				id: nextId,
				hop: current.hop + 1
			});
		}
		result.sort((a, b) => b.confidence - a.confidence);
		recordAccessBatch(kv, result.map((r) => r.memory.id));
		logger.info("Related memories retrieved", {
			memoryId: data.memoryId,
			found: result.length
		});
		return { results: result };
	});
}

//#endregion
//#region src/functions/timeline.ts
function registerTimelineFunction(sdk, kv) {
	sdk.registerFunction("mem::timeline", async (data) => {
		const before = Math.max(0, Math.floor(data.before ?? 5));
		const after = Math.max(0, Math.floor(data.after ?? 5));
		if (!data.anchor || typeof data.anchor !== "string") return {
			entries: [],
			anchor: data.anchor,
			reason: "invalid_anchor"
		};
		let anchorTime;
		if (/^\d{4}-\d{2}-\d{2}/.test(data.anchor)) {
			anchorTime = new Date(data.anchor).getTime();
			if (isNaN(anchorTime)) return {
				entries: [],
				anchor: data.anchor,
				reason: "invalid_date"
			};
		} else {
			const searchResults = await findByKeyword(kv, data.anchor, data.project);
			if (searchResults.length === 0) return {
				entries: [],
				anchor: data.anchor,
				reason: "no_match"
			};
			anchorTime = new Date(searchResults[0].timestamp).getTime();
		}
		const sessions = await kv.list(KV.sessions);
		const filtered = data.project ? sessions.filter((s) => s.project === data.project) : sessions;
		const allObs = [];
		for (const session of filtered) {
			const observations = await kv.list(KV.observations(session.id));
			for (const obs of observations) if (obs.title && obs.timestamp) allObs.push({
				...obs,
				sid: session.id
			});
		}
		allObs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
		let anchorIdx = 0;
		let minDist = Infinity;
		for (let i = 0; i < allObs.length; i++) {
			const dist = Math.abs(new Date(allObs[i].timestamp).getTime() - anchorTime);
			if (dist < minDist) {
				minDist = dist;
				anchorIdx = i;
			}
		}
		const startIdx = Math.max(0, anchorIdx - before);
		const endIdx = Math.min(allObs.length - 1, anchorIdx + after);
		const entries = [];
		for (let i = startIdx; i <= endIdx; i++) {
			const { sid, ...observation } = allObs[i];
			entries.push({
				observation,
				sessionId: sid,
				relativePosition: i - anchorIdx
			});
		}
		recordAccessBatch(kv, entries.map((e) => e.observation.id));
		logger.info("Timeline retrieved", {
			anchor: data.anchor,
			entries: entries.length
		});
		return {
			entries,
			anchorIndex: anchorIdx - startIdx
		};
	});
}
async function findByKeyword(kv, keyword, project) {
	const sessions = await kv.list(KV.sessions);
	const filtered = project ? sessions.filter((s) => s.project === project) : sessions;
	const lower = keyword.toLowerCase();
	const matches = [];
	for (const session of filtered) {
		const observations = await kv.list(KV.observations(session.id));
		for (const obs of observations) if (obs.title?.toLowerCase().includes(lower) || obs.narrative?.toLowerCase().includes(lower) || obs.concepts?.some((c) => c.toLowerCase().includes(lower))) matches.push(obs);
	}
	return matches.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

//#endregion
//#region src/functions/smart-search.ts
function registerSmartSearchFunction(sdk, kv, searchFn) {
	sdk.registerFunction("mem::smart-search", async (data) => {
		if (data.expandIds && data.expandIds.length > 0) {
			const raw = data.expandIds.slice(0, 20);
			const items = raw.map((entry) => {
				if (typeof entry === "string") return {
					obsId: entry,
					sessionId: void 0
				};
				if (entry && typeof entry === "object" && typeof entry.obsId === "string") return {
					obsId: entry.obsId,
					sessionId: entry.sessionId
				};
				return null;
			}).filter((item) => item !== null);
			const expanded = [];
			const results = await Promise.all(items.map(({ obsId, sessionId }) => findObservation$1(kv, obsId, sessionId).then((obs) => obs ? {
				obsId,
				sessionId: obs.sessionId,
				observation: obs
			} : null)));
			for (const r of results) if (r) expanded.push(r);
			recordAccessBatch(kv, expanded.map((e) => e.observation.id));
			const truncated = data.expandIds.length > raw.length;
			logger.info("Smart search expanded", {
				requested: data.expandIds.length,
				attempted: raw.length,
				returned: expanded.length,
				truncated
			});
			return {
				mode: "expanded",
				results: expanded,
				truncated
			};
		}
		if (!data.query || typeof data.query !== "string" || !data.query.trim()) return {
			mode: "compact",
			results: [],
			error: "query is required"
		};
		const limit = Math.max(1, Math.min(data.limit ?? 20, 100));
		const compact = (await searchFn(data.query, limit)).map((r) => ({
			obsId: r.observation.id,
			sessionId: r.sessionId,
			title: r.observation.title,
			type: r.observation.type,
			score: r.combinedScore,
			timestamp: r.observation.timestamp
		}));
		recordAccessBatch(kv, compact.map((r) => r.obsId));
		logger.info("Smart search compact", {
			query: data.query,
			results: compact.length
		});
		return {
			mode: "compact",
			results: compact
		};
	});
}
async function findObservation$1(kv, obsId, sessionIdHint) {
	if (sessionIdHint) {
		const obs = await kv.get(KV.observations(sessionIdHint), obsId).catch(() => null);
		if (obs) return obs;
	}
	const sessions = await kv.list(KV.sessions);
	for (let i = 0; i < sessions.length; i += 5) {
		const batch = sessions.slice(i, i + 5);
		const found = (await Promise.all(batch.map((s) => kv.get(KV.observations(s.id), obsId).catch(() => null)))).find((r) => r !== null);
		if (found) return found;
	}
	return null;
}

//#endregion
//#region src/functions/profile.ts
function registerProfileFunction(sdk, kv) {
	sdk.registerFunction("mem::profile", async (data) => {
		if (!data || typeof data.project !== "string" || !data.project.trim()) return {
			success: false,
			error: "project is required"
		};
		const project = data.project.trim();
		if (!data.refresh) {
			const cached = await kv.get(KV.profiles, project).catch(() => null);
			if (cached) {
				if (Date.now() - new Date(cached.updatedAt).getTime() < 36e5) return {
					profile: cached,
					cached: true
				};
			}
		}
		const projectSessions = (await kv.list(KV.sessions)).filter((s) => s.project === project);
		if (projectSessions.length === 0) return {
			profile: null,
			reason: "no_sessions"
		};
		const conceptFreq = /* @__PURE__ */ new Map();
		const fileFreq = /* @__PURE__ */ new Map();
		const errors = [];
		const recentActivity = [];
		let totalObs = 0;
		const top20Sessions = projectSessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 20);
		const obsPerSession = await Promise.all(top20Sessions.map((s) => kv.list(KV.observations(s.id)).catch(() => [])));
		for (let i = 0; i < top20Sessions.length; i++) {
			const session = top20Sessions[i];
			const observations = obsPerSession[i];
			totalObs += observations.length;
			for (const obs of observations) {
				for (const concept of obs.concepts || []) conceptFreq.set(concept, (conceptFreq.get(concept) || 0) + 1);
				for (const file of obs.files || []) fileFreq.set(file, (fileFreq.get(file) || 0) + 1);
				if (obs.type === "error") errors.push(obs.title);
			}
			const important = observations.filter((o) => o.importance >= 7).sort((a, b) => b.importance - a.importance);
			if (important.length > 0) recentActivity.push(`[${session.startedAt.slice(0, 10)}] ${important[0].title}`);
		}
		const topConcepts = Array.from(conceptFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([concept, frequency]) => ({
			concept,
			frequency
		}));
		const topFiles = Array.from(fileFreq.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([file, frequency]) => ({
			file,
			frequency
		}));
		const uniqueErrors = [...new Set(errors)].slice(0, 10);
		const profile = {
			project,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
			topConcepts,
			topFiles,
			conventions: extractConventions(topConcepts, topFiles),
			commonErrors: uniqueErrors,
			recentActivity: recentActivity.slice(0, 10),
			sessionCount: projectSessions.length,
			totalObservations: totalObs
		};
		await kv.set(KV.profiles, project, profile);
		await recordAudit(kv, "share", "mem::profile", [project], {
			sessionCount: projectSessions.length,
			totalObservations: totalObs
		});
		logger.info("Profile generated", {
			project,
			sessions: projectSessions.length,
			observations: totalObs
		});
		return {
			profile,
			cached: false
		};
	});
}
function extractConventions(concepts, files) {
	const conventions = [];
	const tsFiles = files.filter((f) => f.file.endsWith(".ts")).length;
	if (tsFiles > files.filter((f) => f.file.endsWith(".js")).length && tsFiles > 0) conventions.push("TypeScript project");
	if (files.filter((f) => f.file.includes("/src/")).length > files.length * .5) conventions.push("Standard src/ directory structure");
	if (files.filter((f) => f.file.includes("test") || f.file.includes("spec")).length > 0) conventions.push("Has test files");
	for (const { concept, frequency } of concepts.slice(0, 5)) if (frequency >= 3) conventions.push(`Frequently uses: ${concept}`);
	return conventions;
}

//#endregion
//#region src/functions/auto-forget.ts
const MS_PER_DAY = 1440 * 60 * 1e3;
const CONTRADICTION_THRESHOLD = .9;
function registerAutoForgetFunction(sdk, kv) {
	sdk.registerFunction("mem::auto-forget", async (data) => {
		const dryRun = data?.dryRun ?? false;
		const now = Date.now();
		const { decrementImageRef } = await Promise.resolve().then(() => image_refs_exports);
		const result = {
			ttlExpired: [],
			contradictions: [],
			lowValueObs: [],
			dryRun
		};
		const memories = await kv.list(KV.memories);
		const deletedIds = /* @__PURE__ */ new Set();
		for (const mem of memories) if (mem.forgetAfter) {
			if (now > new Date(mem.forgetAfter).getTime()) {
				result.ttlExpired.push(mem.id);
				deletedIds.add(mem.id);
				if (!dryRun) {
					if (mem.imageRef) await decrementImageRef(kv, sdk, mem.imageRef);
					await kv.delete(KV.memories, mem.id);
					await recordAudit(kv, "delete", "mem::auto-forget", [mem.id], {
						resource: "memory",
						reason: "auto-forget TTL",
						timestamp: mem.forgetAfter
					});
					await deleteAccessLog(kv, mem.id);
				}
			}
		}
		const latestMemories = memories.filter((m) => m.isLatest !== false && !deletedIds.has(m.id)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 1e3);
		const tokenCache = /* @__PURE__ */ new Map();
		for (const mem of latestMemories) tokenCache.set(mem.id, new Set(mem.content.toLowerCase().split(/\s+/).filter((t) => t.length > 2)));
		const memById = new Map(latestMemories.map((m) => [m.id, m]));
		const conceptIndex = /* @__PURE__ */ new Map();
		for (const mem of latestMemories) {
			const concepts = mem.concepts || [];
			for (const c of concepts) {
				const key = c.toLowerCase();
				if (!conceptIndex.has(key)) conceptIndex.set(key, []);
				conceptIndex.get(key).push(mem.id);
			}
		}
		const compared = /* @__PURE__ */ new Set();
		for (const [, memIds] of conceptIndex) for (let i = 0; i < memIds.length; i++) for (let j = i + 1; j < memIds.length; j++) {
			const key = memIds[i] < memIds[j] ? `${memIds[i]}|${memIds[j]}` : `${memIds[j]}|${memIds[i]}`;
			if (compared.has(key)) continue;
			compared.add(key);
			const setA = tokenCache.get(memIds[i]);
			const setB = tokenCache.get(memIds[j]);
			let intersection = 0;
			if (setA.size === 0 && setB.size === 0) continue;
			if (setA.size === 0 || setB.size === 0) continue;
			for (const word of setA) if (setB.has(word)) intersection++;
			const sim = intersection / (setA.size + setB.size - intersection);
			if (sim > CONTRADICTION_THRESHOLD) {
				const memA = memById.get(memIds[i]);
				const memB = memById.get(memIds[j]);
				result.contradictions.push({
					memoryA: memA.id,
					memoryB: memB.id,
					similarity: sim
				});
				if (!dryRun) {
					const older = new Date(memA.createdAt).getTime() < new Date(memB.createdAt).getTime() ? memA : memB;
					older.isLatest = false;
					await kv.set(KV.memories, older.id, older);
					await recordAudit(kv, "forget", "mem::auto-forget", [older.id], {
						resource: "memory",
						reason: "auto-forget contradiction",
						olderId: older.id,
						similarity: sim
					});
				}
			}
		}
		const sessions = await kv.list(KV.sessions);
		const obsPerSession = [];
		for (let batch = 0; batch < sessions.length; batch += 10) {
			const chunk = sessions.slice(batch, batch + 10);
			const results = await Promise.all(chunk.map((s) => kv.list(KV.observations(s.id)).catch(() => [])));
			obsPerSession.push(...results);
		}
		for (let i = 0; i < sessions.length; i++) for (const obs of obsPerSession[i]) {
			if (!obs.timestamp) continue;
			if (now - new Date(obs.timestamp).getTime() > 180 * MS_PER_DAY && (obs.importance ?? 5) <= 2) {
				result.lowValueObs.push(obs.id);
				if (!dryRun) {
					let deletedOk = false;
					try {
						await kv.delete(KV.observations(sessions[i].id), obs.id);
						deletedOk = true;
					} catch {
						deletedOk = false;
					}
					if (deletedOk) {
						if (obs.imageData) await decrementImageRef(kv, sdk, obs.imageData);
						if (obs.imageRef && obs.imageRef !== obs.imageData) await decrementImageRef(kv, sdk, obs.imageRef);
						await recordAudit(kv, "delete", "mem::auto-forget", [obs.id], {
							resource: "observation",
							reason: "auto-forget low-value observation",
							sessionId: sessions[i].id,
							timestamp: obs.timestamp
						});
					}
				}
			}
		}
		logger.info("Auto-forget complete", {
			ttlExpired: result.ttlExpired.length,
			contradictions: result.contradictions.length,
			lowValueObs: result.lowValueObs.length,
			dryRun
		});
		return result;
	});
}

//#endregion
//#region src/version.ts
const VERSION = "0.9.19";

//#endregion
//#region src/functions/export-import.ts
function registerExportImportFunction(sdk, kv) {
	sdk.registerFunction("mem::export", async (data) => {
		const rawMax = Number(data?.maxSessions);
		const maxSessions = Number.isFinite(rawMax) && rawMax > 0 ? Math.min(Math.floor(rawMax), 1e3) : void 0;
		const rawOffset = Number(data?.offset);
		const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
		const allSessions = await kv.list(KV.sessions);
		const paginatedSessions = maxSessions !== void 0 ? allSessions.slice(offset, offset + maxSessions) : allSessions;
		const memories = await kv.list(KV.memories);
		const summaries = await kv.list(KV.summaries);
		const observations = {};
		const obsResults = await Promise.all(paginatedSessions.map((session) => kv.list(KV.observations(session.id)).catch(() => []).then((obs) => ({
			sessionId: session.id,
			obs
		}))));
		for (const { sessionId, obs } of obsResults) if (obs.length > 0) observations[sessionId] = obs;
		const profiles = [];
		const uniqueProjects = [...new Set(paginatedSessions.map((s) => s.project))];
		const profileResults = await Promise.all(uniqueProjects.map((project) => kv.get(KV.profiles, project).catch(() => null)));
		for (const profile of profileResults) if (profile) profiles.push(profile);
		const [graphNodes, graphEdges, semanticMemories, proceduralMemories, actions, actionEdges, sentinels, sketches, crystals, facets, lessons, insights, routines, signals, checkpoints, accessLogs] = await Promise.all([
			kv.list(KV.graphNodes).catch(() => []),
			kv.list(KV.graphEdges).catch(() => []),
			kv.list(KV.semantic).catch(() => []),
			kv.list(KV.procedural).catch(() => []),
			kv.list(KV.actions).catch(() => []),
			kv.list(KV.actionEdges).catch(() => []),
			kv.list(KV.sentinels).catch(() => []),
			kv.list(KV.sketches).catch(() => []),
			kv.list(KV.crystals).catch(() => []),
			kv.list(KV.facets).catch(() => []),
			kv.list(KV.lessons).catch(() => []),
			kv.list(KV.insights).catch(() => []),
			kv.list(KV.routines).catch(() => []),
			kv.list(KV.signals).catch(() => []),
			kv.list(KV.checkpoints).catch(() => []),
			kv.list(KV.accessLog).catch(() => [])
		]);
		const exportData = {
			version: VERSION,
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			sessions: paginatedSessions,
			observations,
			memories,
			summaries,
			profiles: profiles.length > 0 ? profiles : void 0,
			graphNodes: graphNodes.length > 0 ? graphNodes : void 0,
			graphEdges: graphEdges.length > 0 ? graphEdges : void 0,
			semanticMemories: semanticMemories.length > 0 ? semanticMemories : void 0,
			proceduralMemories: proceduralMemories.length > 0 ? proceduralMemories : void 0,
			actions: actions.length > 0 ? actions : void 0,
			actionEdges: actionEdges.length > 0 ? actionEdges : void 0,
			sentinels: sentinels.length > 0 ? sentinels : void 0,
			sketches: sketches.length > 0 ? sketches : void 0,
			crystals: crystals.length > 0 ? crystals : void 0,
			facets: facets.length > 0 ? facets : void 0,
			lessons: lessons.length > 0 ? lessons : void 0,
			insights: insights.length > 0 ? insights : void 0,
			routines: routines.length > 0 ? routines : void 0,
			signals: signals.length > 0 ? signals : void 0,
			checkpoints: checkpoints.length > 0 ? checkpoints : void 0,
			accessLogs: accessLogs.length > 0 ? accessLogs : void 0
		};
		if (maxSessions !== void 0) exportData.pagination = {
			offset,
			limit: maxSessions,
			total: allSessions.length,
			hasMore: offset + maxSessions < allSessions.length
		};
		const totalObs = Object.values(observations).reduce((sum, arr) => sum + arr.length, 0);
		logger.info("Export complete", {
			sessions: paginatedSessions.length,
			totalSessions: allSessions.length,
			observations: totalObs,
			memories: memories.length,
			summaries: summaries.length
		});
		return exportData;
	});
	sdk.registerFunction("mem::import", async (data) => {
		if (!data?.exportData || typeof data.exportData !== "object" || typeof data.exportData.version !== "string") return {
			success: false,
			error: "exportData with string version is required"
		};
		const strategy = data.strategy || "merge";
		const importData = data.exportData;
		if (!new Set([
			"0.3.0",
			"0.4.0",
			"0.5.0",
			"0.6.0",
			"0.6.1",
			"0.7.0",
			"0.7.2",
			"0.7.3",
			"0.7.4",
			"0.7.5",
			"0.7.6",
			"0.7.7",
			"0.7.9",
			"0.8.0",
			"0.8.1",
			"0.8.2",
			"0.8.3",
			"0.8.4",
			"0.8.5",
			"0.8.6",
			"0.8.7",
			"0.8.8",
			"0.8.9",
			"0.8.10",
			"0.8.11",
			"0.8.12",
			"0.8.13",
			"0.9.0",
			"0.9.1",
			"0.9.2",
			"0.9.3",
			"0.9.4",
			"0.9.5",
			"0.9.6",
			"0.9.7",
			"0.9.8",
			"0.9.9",
			"0.9.10",
			"0.9.11",
			"0.9.12",
			"0.9.13",
			"0.9.14",
			"0.9.15",
			"0.9.16",
			"0.9.17",
			"0.9.18",
			"0.9.19"
		]).has(importData.version)) return {
			success: false,
			error: `Unsupported export version: ${importData.version}`
		};
		const MAX_SESSIONS = 1e4;
		const MAX_MEMORIES = 5e4;
		const MAX_SUMMARIES = 1e4;
		const MAX_OBS_PER_SESSION = 5e3;
		const MAX_TOTAL_OBSERVATIONS = 5e5;
		const MAX_ACCESS_LOGS = 5e4;
		if (!Array.isArray(importData.sessions)) return {
			success: false,
			error: "sessions must be an array"
		};
		if (!Array.isArray(importData.memories)) return {
			success: false,
			error: "memories must be an array"
		};
		if (!Array.isArray(importData.summaries)) return {
			success: false,
			error: "summaries must be an array"
		};
		if (typeof importData.observations !== "object" || importData.observations === null || Array.isArray(importData.observations)) return {
			success: false,
			error: "observations must be an object"
		};
		if (importData.sessions.length > MAX_SESSIONS) return {
			success: false,
			error: `Too many sessions (max ${MAX_SESSIONS})`
		};
		if (importData.memories.length > MAX_MEMORIES) return {
			success: false,
			error: `Too many memories (max ${MAX_MEMORIES})`
		};
		if (importData.summaries.length > MAX_SUMMARIES) return {
			success: false,
			error: `Too many summaries (max ${MAX_SUMMARIES})`
		};
		const MAX_OBS_BUCKETS = 1e4;
		if (Object.keys(importData.observations).length > MAX_OBS_BUCKETS) return {
			success: false,
			error: `Too many observation buckets (max ${MAX_OBS_BUCKETS})`
		};
		let totalObservations = 0;
		for (const [, obs] of Object.entries(importData.observations)) {
			if (!Array.isArray(obs)) return {
				success: false,
				error: "observation values must be arrays"
			};
			if (obs.length > MAX_OBS_PER_SESSION) return {
				success: false,
				error: `Too many observations per session (max ${MAX_OBS_PER_SESSION})`
			};
			totalObservations += obs.length;
		}
		if (totalObservations > MAX_TOTAL_OBSERVATIONS) return {
			success: false,
			error: `Too many total observations (max ${MAX_TOTAL_OBSERVATIONS})`
		};
		const stats = {
			sessions: 0,
			observations: 0,
			memories: 0,
			summaries: 0,
			skipped: 0
		};
		if (strategy === "replace") {
			const existing = await kv.list(KV.sessions);
			for (const session of existing) {
				await kv.delete(KV.sessions, session.id);
				const obs = await kv.list(KV.observations(session.id)).catch(() => []);
				for (const o of obs) await kv.delete(KV.observations(session.id), o.id);
			}
			const existingMem = await kv.list(KV.memories);
			for (const m of existingMem) await kv.delete(KV.memories, m.id);
			const existingSummaries = await kv.list(KV.summaries);
			for (const s of existingSummaries) await kv.delete(KV.summaries, s.sessionId);
			for (const a of await kv.list(KV.actions).catch(() => [])) await kv.delete(KV.actions, a.id);
			for (const e of await kv.list(KV.actionEdges).catch(() => [])) await kv.delete(KV.actionEdges, e.id);
			for (const r of await kv.list(KV.routines).catch(() => [])) await kv.delete(KV.routines, r.id);
			for (const s of await kv.list(KV.signals).catch(() => [])) await kv.delete(KV.signals, s.id);
			for (const c of await kv.list(KV.checkpoints).catch(() => [])) await kv.delete(KV.checkpoints, c.id);
			for (const s of await kv.list(KV.sentinels).catch(() => [])) await kv.delete(KV.sentinels, s.id);
			for (const s of await kv.list(KV.sketches).catch(() => [])) await kv.delete(KV.sketches, s.id);
			for (const c of await kv.list(KV.crystals).catch(() => [])) await kv.delete(KV.crystals, c.id);
			for (const f of await kv.list(KV.facets).catch(() => [])) await kv.delete(KV.facets, f.id);
			for (const l of await kv.list(KV.lessons).catch(() => [])) await kv.delete(KV.lessons, l.id);
			for (const i of await kv.list(KV.insights).catch(() => [])) await kv.delete(KV.insights, i.id);
			for (const n of await kv.list(KV.graphNodes).catch(() => [])) await kv.delete(KV.graphNodes, n.id);
			for (const e of await kv.list(KV.graphEdges).catch(() => [])) await kv.delete(KV.graphEdges, e.id);
			for (const s of await kv.list(KV.semantic).catch(() => [])) await kv.delete(KV.semantic, s.id);
			for (const p of await kv.list(KV.procedural).catch(() => [])) await kv.delete(KV.procedural, p.id);
			for (const profile of await kv.list(KV.profiles).catch(() => [])) await kv.delete(KV.profiles, profile.project);
			for (const a of await kv.list(KV.accessLog).catch(() => [])) await kv.delete(KV.accessLog, a.memoryId);
		}
		for (const session of importData.sessions) {
			if (strategy === "skip") {
				if (await kv.get(KV.sessions, session.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.sessions, session.id, session);
			stats.sessions++;
		}
		for (const [sessionId, obs] of Object.entries(importData.observations)) for (const o of obs) {
			if (strategy === "skip") {
				if (await kv.get(KV.observations(sessionId), o.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.observations(sessionId), o.id, o);
			stats.observations++;
		}
		for (const memory of importData.memories) {
			if (strategy === "skip") {
				if (await kv.get(KV.memories, memory.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.memories, memory.id, memory);
			stats.memories++;
		}
		for (const summary of importData.summaries) {
			if (strategy === "skip") {
				if (await kv.get(KV.summaries, summary.sessionId).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.summaries, summary.sessionId, summary);
			stats.summaries++;
		}
		if (importData.graphNodes) for (const node of importData.graphNodes) {
			if (strategy === "skip") {
				if (await kv.get(KV.graphNodes, node.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.graphNodes, node.id, node);
		}
		if (importData.graphEdges) for (const edge of importData.graphEdges) {
			if (strategy === "skip") {
				if (await kv.get(KV.graphEdges, edge.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.graphEdges, edge.id, edge);
		}
		if (importData.semanticMemories) for (const sem of importData.semanticMemories) {
			if (strategy === "skip") {
				if (await kv.get(KV.semantic, sem.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.semantic, sem.id, sem);
		}
		if (importData.proceduralMemories) for (const proc of importData.proceduralMemories) {
			if (strategy === "skip") {
				if (await kv.get(KV.procedural, proc.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.procedural, proc.id, proc);
		}
		if (importData.profiles) for (const profile of importData.profiles) {
			if (strategy === "skip") {
				if (await kv.get(KV.profiles, profile.project).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.profiles, profile.project, profile);
		}
		if (importData.actions) for (const action of importData.actions) {
			if (strategy === "skip") {
				if (await kv.get(KV.actions, action.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.actions, action.id, action);
		}
		if (importData.actionEdges) for (const edge of importData.actionEdges) {
			if (strategy === "skip") {
				if (await kv.get(KV.actionEdges, edge.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.actionEdges, edge.id, edge);
		}
		if (importData.routines) for (const routine of importData.routines) {
			if (strategy === "skip") {
				if (await kv.get(KV.routines, routine.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.routines, routine.id, routine);
		}
		if (importData.signals) for (const signal of importData.signals) {
			if (strategy === "skip") {
				if (await kv.get(KV.signals, signal.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.signals, signal.id, signal);
		}
		if (importData.checkpoints) for (const checkpoint of importData.checkpoints) {
			if (strategy === "skip") {
				if (await kv.get(KV.checkpoints, checkpoint.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.checkpoints, checkpoint.id, checkpoint);
		}
		if (importData.sentinels) for (const sentinel of importData.sentinels) {
			if (strategy === "skip") {
				if (await kv.get(KV.sentinels, sentinel.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.sentinels, sentinel.id, sentinel);
		}
		if (importData.sketches) for (const sketch of importData.sketches) {
			if (strategy === "skip") {
				if (await kv.get(KV.sketches, sketch.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.sketches, sketch.id, sketch);
		}
		if (importData.crystals) for (const crystal of importData.crystals) {
			if (strategy === "skip") {
				if (await kv.get(KV.crystals, crystal.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.crystals, crystal.id, crystal);
		}
		if (importData.facets) for (const facet of importData.facets) {
			if (strategy === "skip") {
				if (await kv.get(KV.facets, facet.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.facets, facet.id, facet);
		}
		if (importData.lessons) for (const lesson of importData.lessons) {
			if (strategy === "skip") {
				if (await kv.get(KV.lessons, lesson.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.lessons, lesson.id, lesson);
		}
		if (importData.insights) for (const insight of importData.insights) {
			if (strategy === "skip") {
				if (await kv.get(KV.insights, insight.id).catch(() => null)) {
					stats.skipped++;
					continue;
				}
			}
			await kv.set(KV.insights, insight.id, insight);
		}
		if (importData.accessLogs) {
			if (!Array.isArray(importData.accessLogs)) return {
				success: false,
				error: "accessLogs must be an array"
			};
			if (importData.accessLogs.length > MAX_ACCESS_LOGS) return {
				success: false,
				error: `Too many access logs (max ${MAX_ACCESS_LOGS})`
			};
			const memoryIds = new Set(importData.memories.map((m) => m.id));
			for (const raw of importData.accessLogs) {
				const log = normalizeAccessLog(raw);
				if (!log.memoryId || !memoryIds.has(log.memoryId)) continue;
				if (strategy === "skip") {
					if (await kv.get(KV.accessLog, log.memoryId).catch(() => null)) {
						stats.skipped++;
						continue;
					}
				}
				await kv.set(KV.accessLog, log.memoryId, log);
			}
		}
		logger.info("Import complete", {
			strategy,
			...stats
		});
		await recordAudit(kv, "import", "mem::import", [], {
			strategy,
			stats
		});
		return {
			success: true,
			strategy,
			...stats
		};
	});
}

//#endregion
//#region src/functions/enrich.ts
const MAX_CONTEXT_LENGTH = 4e3;
function escapeXml(s) {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function registerEnrichFunction(sdk, kv) {
	sdk.registerFunction("mem::enrich", async (data) => {
		const parts = [];
		const fileContextPromise = sdk.trigger({
			function_id: "mem::file-context",
			payload: {
				sessionId: data.sessionId,
				files: data.files
			}
		}).catch(() => ({ context: "" }));
		const searchQueries = [...data.files.map((f) => f.split("/").pop() || f), ...data.terms || []].filter((q) => q.length > 0);
		const searchPromise = searchQueries.length > 0 ? sdk.trigger({
			function_id: "mem::search",
			payload: {
				query: searchQueries.join(" "),
				limit: 5
			}
		}).catch(() => ({ results: [] })) : Promise.resolve({ results: [] });
		const bugMemoriesPromise = kv.list(KV.memories).then((memories) => memories.filter((m) => m.type === "bug" && m.isLatest && m.files.some((f) => data.files.some((df) => f.includes(df) || df.includes(f)))).sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())).catch(() => []);
		const [fileContext, searchResult, bugMemories] = await Promise.all([
			fileContextPromise,
			searchPromise,
			bugMemoriesPromise
		]);
		if (fileContext.context) parts.push(fileContext.context);
		if (searchResult.results.length > 0) {
			const observations = searchResult.results.map((r) => r.observation?.narrative).filter(Boolean).map((n) => escapeXml(n)).join("\n");
			if (observations) parts.push(`<agentmemory-relevant-context>\n${observations}\n</agentmemory-relevant-context>`);
		}
		if (bugMemories.length > 0) {
			const bugs = bugMemories.slice(0, 3).map((m) => `- ${escapeXml(m.title)}: ${escapeXml(m.content)}`).join("\n");
			parts.push(`<agentmemory-past-errors>\n${bugs}\n</agentmemory-past-errors>`);
		}
		let context = parts.join("\n\n");
		let truncated = false;
		if (context.length > MAX_CONTEXT_LENGTH) {
			context = context.slice(0, MAX_CONTEXT_LENGTH);
			truncated = true;
		}
		logger.info("Enrichment completed", {
			sessionId: data.sessionId,
			fileCount: data.files.length,
			contextLength: context.length,
			truncated
		});
		return {
			context,
			truncated
		};
	});
}

//#endregion
//#region src/functions/claude-bridge.ts
function parseMemoryMd(content) {
	const sections = /* @__PURE__ */ new Map();
	let currentSection = "";
	let currentContent = [];
	for (const line of content.split("\n")) if (line.startsWith("## ")) {
		if (currentSection) sections.set(currentSection, currentContent.join("\n").trim());
		currentSection = line.slice(3).trim();
		currentContent = [];
	} else currentContent.push(line);
	if (currentSection) sections.set(currentSection, currentContent.join("\n").trim());
	return {
		sections,
		raw: content
	};
}
function serializeToMemoryMd(memories, projectSummary, lineBudget) {
	const lines = [];
	lines.push("# Agent Memory (auto-synced by agentmemory)");
	lines.push("");
	if (projectSummary) {
		lines.push("## Project Summary");
		lines.push(projectSummary);
		lines.push("");
	}
	lines.push("## Key Memories");
	lines.push("");
	const sorted = [...memories].filter((m) => m.isLatest).sort((a, b) => b.strength - a.strength);
	for (const mem of sorted) {
		if (lines.length >= lineBudget - 2) break;
		lines.push(`### ${mem.title}`);
		const contentLines = mem.content.split("\n");
		for (const cl of contentLines) {
			if (lines.length >= lineBudget - 1) break;
			lines.push(cl);
		}
		lines.push("");
	}
	return lines.slice(0, lineBudget).join("\n");
}
function registerClaudeBridgeFunction(sdk, kv, config) {
	sdk.registerFunction("mem::claude-bridge-read", async () => {
		if (!config.enabled || !config.memoryFilePath) return {
			success: false,
			error: "Claude bridge not configured"
		};
		try {
			if (!existsSync(config.memoryFilePath)) return {
				success: true,
				content: "",
				parsed: false
			};
			const content = readFileSync(config.memoryFilePath, "utf-8");
			const { sections } = parseMemoryMd(content);
			await kv.set(KV.claudeBridge, "last-read", {
				timestamp: (/* @__PURE__ */ new Date()).toISOString(),
				sections: Object.fromEntries(sections),
				lineCount: content.split("\n").length
			});
			await recordAudit(kv, "export", "mem::claude-bridge-read", ["last-read"], {
				timestamp: (/* @__PURE__ */ new Date()).toISOString(),
				sections: Object.keys(Object.fromEntries(sections)),
				lineCount: content.split("\n").length
			});
			logger.info("Claude bridge: read MEMORY.md", {
				path: config.memoryFilePath,
				lines: content.split("\n").length
			});
			return {
				success: true,
				content,
				sections: Object.fromEntries(sections)
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Claude bridge read failed", { error: msg });
			return {
				success: false,
				error: msg
			};
		}
	});
	sdk.registerFunction("mem::claude-bridge-sync", async () => {
		if (!config.enabled || !config.memoryFilePath) return {
			success: false,
			error: "Claude bridge not configured"
		};
		try {
			const latestMemories = (await kv.list(KV.memories)).filter((m) => m.isLatest);
			let projectSummary = "";
			if (config.projectPath) projectSummary = (await kv.get(KV.profiles, config.projectPath).catch(() => null))?.summary || "";
			const md = serializeToMemoryMd(latestMemories, projectSummary, config.lineBudget);
			const dir = dirname(config.memoryFilePath);
			if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
			writeFileSync(config.memoryFilePath, md, "utf-8");
			await recordAudit(kv, "export", "mem::claude-bridge-sync", [], {
				path: config.memoryFilePath,
				memoryCount: latestMemories.length,
				lines: md.split("\n").length
			});
			logger.info("Claude bridge: synced to MEMORY.md", {
				path: config.memoryFilePath,
				memories: latestMemories.length
			});
			return {
				success: true,
				path: config.memoryFilePath,
				lines: md.split("\n").length
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Claude bridge sync failed", { error: msg });
			return {
				success: false,
				error: msg
			};
		}
	});
}

//#endregion
//#region src/prompts/graph-extraction.ts
const GRAPH_EXTRACTION_SYSTEM = `You are a knowledge graph extraction engine. Given a compressed observation from a coding session, extract entities and relationships.

Output format (XML):
<entities>
  <entity type="file|function|concept|error|decision|pattern|library|person" name="exact name">
    <property key="key">value</property>
  </entity>
</entities>
<relationships>
  <relationship type="uses|imports|modifies|causes|fixes|depends_on|related_to" source="entity name" target="entity name" weight="0.1-1.0"/>
</relationships>

Rules:
- Extract concrete entities only (real file paths, function names, library names)
- Use the most specific type available
- Weight relationships by how strong/direct the connection is
- If no entities found, output empty tags`;
function buildGraphExtractionPrompt(observations) {
	return `Extract entities and relationships from these observations:\n\n${observations.map((o, i) => `[${i + 1}] Type: ${o.type}\nTitle: ${o.title}\nNarrative: ${o.narrative}\nConcepts: ${(o.concepts ?? []).join(", ")}\nFiles: ${(o.files ?? []).join(", ")}`).join("\n\n")}`;
}

//#endregion
//#region src/functions/graph.ts
function parseGraphXml(xml, observationIds) {
	const nodes = [];
	const edges = [];
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const entityRegex = /<entity\s+type="([^"]+)"\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/entity>/g;
	let match;
	while ((match = entityRegex.exec(xml)) !== null) {
		const type = match[1];
		const name = match[2];
		const propsBlock = match[3];
		const properties = {};
		const propRegex = /<property\s+key="([^"]+)">([^<]*)<\/property>/g;
		let propMatch;
		while ((propMatch = propRegex.exec(propsBlock)) !== null) properties[propMatch[1]] = propMatch[2];
		nodes.push({
			id: generateId("gn"),
			type,
			name,
			properties,
			sourceObservationIds: observationIds,
			createdAt: now
		});
	}
	const relRegex = /<relationship\s+type="([^"]+)"\s+source="([^"]+)"\s+target="([^"]+)"\s+weight="([^"]+)"\s*\/>/g;
	while ((match = relRegex.exec(xml)) !== null) {
		const type = match[1];
		const sourceName = match[2];
		const targetName = match[3];
		const parsedWeight = parseFloat(match[4]);
		const weight = Number.isNaN(parsedWeight) ? .5 : parsedWeight;
		const sourceNode = nodes.find((n) => n.name === sourceName);
		const targetNode = nodes.find((n) => n.name === targetName);
		if (sourceNode && targetNode) edges.push({
			id: generateId("ge"),
			type,
			sourceNodeId: sourceNode.id,
			targetNodeId: targetNode.id,
			weight: Math.max(0, Math.min(1, weight)),
			sourceObservationIds: observationIds,
			createdAt: now
		});
	}
	return {
		nodes,
		edges
	};
}
function registerGraphFunction(sdk, kv, provider) {
	sdk.registerFunction("mem::graph-extract", async (data) => {
		if (!data.observations || data.observations.length === 0) return {
			success: false,
			error: "No observations provided"
		};
		const prompt = buildGraphExtractionPrompt(data.observations.map((o) => ({
			title: o.title,
			narrative: o.narrative,
			concepts: o.concepts,
			files: o.files,
			type: o.type
		})));
		try {
			const response = await provider.compress(GRAPH_EXTRACTION_SYSTEM, prompt);
			const obsIds = data.observations.map((o) => o.id);
			const { nodes, edges } = parseGraphXml(response, obsIds);
			const existingNodes = await kv.list(KV.graphNodes);
			const existingEdges = await kv.list(KV.graphEdges);
			for (const node of nodes) {
				const existing = existingNodes.find((n) => n.name === node.name && n.type === node.type);
				if (existing) {
					const merged = {
						...existing,
						sourceObservationIds: [...new Set([...existing.sourceObservationIds, ...obsIds])],
						properties: {
							...existing.properties,
							...node.properties
						}
					};
					await kv.set(KV.graphNodes, existing.id, merged);
					const idx = existingNodes.findIndex((n) => n.id === existing.id);
					if (idx !== -1) existingNodes[idx] = merged;
				} else {
					await kv.set(KV.graphNodes, node.id, node);
					existingNodes.push(node);
				}
			}
			for (const edge of edges) {
				const edgeKey = `${edge.sourceNodeId}|${edge.targetNodeId}|${edge.type}`;
				const existingEdge = existingEdges.find((e) => `${e.sourceNodeId}|${e.targetNodeId}|${e.type}` === edgeKey);
				if (existingEdge) {
					existingEdge.sourceObservationIds = [...new Set([...existingEdge.sourceObservationIds, ...obsIds])];
					await kv.set(KV.graphEdges, existingEdge.id, existingEdge);
				} else {
					await kv.set(KV.graphEdges, edge.id, edge);
					existingEdges.push(edge);
				}
			}
			await recordAudit(kv, "observe", "mem::graph-extract", obsIds, {
				nodesExtracted: nodes.length,
				edgesExtracted: edges.length
			});
			logger.info("Graph extraction complete", {
				nodes: nodes.length,
				edges: edges.length
			});
			return {
				success: true,
				nodesAdded: nodes.length,
				edgesAdded: edges.length
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Graph extraction failed", { error: msg });
			return {
				success: false,
				error: msg
			};
		}
	});
	sdk.registerFunction("mem::graph-query", async (data) => {
		const allNodes = (await kv.list(KV.graphNodes)).filter((n) => !n.stale);
		const allEdges = (await kv.list(KV.graphEdges)).filter((e) => !e.stale);
		const maxDepth = Math.min(data.maxDepth || 3, 5);
		if (data.query) {
			const lower = data.query.toLowerCase();
			const matchingNodes = allNodes.filter((n) => n.name.toLowerCase().includes(lower) || Object.values(n.properties).some((v) => typeof v === "string" && v.toLowerCase().includes(lower)));
			const nodeIds = new Set(matchingNodes.map((n) => n.id));
			return {
				nodes: matchingNodes,
				edges: allEdges.filter((e) => nodeIds.has(e.sourceNodeId) || nodeIds.has(e.targetNodeId)),
				depth: 0
			};
		}
		if (data.startNodeId) {
			const visited = /* @__PURE__ */ new Set();
			const visitedEdges = /* @__PURE__ */ new Set();
			const resultNodes = [];
			const resultEdges = [];
			const queue = [{
				nodeId: data.startNodeId,
				depth: 0
			}];
			while (queue.length > 0) {
				const { nodeId, depth } = queue.shift();
				if (visited.has(nodeId) || depth > maxDepth) continue;
				visited.add(nodeId);
				const node = allNodes.find((n) => n.id === nodeId);
				if (node) {
					if (!data.nodeType || node.type === data.nodeType) resultNodes.push(node);
				}
				const neighborEdges = allEdges.filter((e) => e.sourceNodeId === nodeId || e.targetNodeId === nodeId);
				for (const edge of neighborEdges) {
					if (!visitedEdges.has(edge.id)) {
						visitedEdges.add(edge.id);
						resultEdges.push(edge);
					}
					const nextId = edge.sourceNodeId === nodeId ? edge.targetNodeId : edge.sourceNodeId;
					if (!visited.has(nextId)) queue.push({
						nodeId: nextId,
						depth: depth + 1
					});
				}
			}
			return {
				nodes: resultNodes,
				edges: resultEdges,
				depth: maxDepth
			};
		}
		let filtered = allNodes;
		if (data.nodeType) filtered = allNodes.filter((n) => n.type === data.nodeType);
		return {
			nodes: filtered,
			edges: allEdges,
			depth: 0
		};
	});
	sdk.registerFunction("mem::graph-stats", async () => {
		const nodes = await kv.list(KV.graphNodes);
		const edges = await kv.list(KV.graphEdges);
		const nodesByType = {};
		for (const n of nodes) nodesByType[n.type] = (nodesByType[n.type] || 0) + 1;
		const edgesByType = {};
		for (const e of edges) edgesByType[e.type] = (edgesByType[e.type] || 0) + 1;
		return {
			totalNodes: nodes.length,
			totalEdges: edges.length,
			nodesByType,
			edgesByType
		};
	});
}

//#endregion
//#region src/prompts/consolidation.ts
const SEMANTIC_MERGE_SYSTEM = `You are a memory consolidation engine. Given overlapping episodic memories (session summaries), extract stable factual knowledge.

Output format (XML):
<facts>
  <fact confidence="0.0-1.0">Concise factual statement</fact>
</facts>

Rules:
- Extract only facts that appear in 2+ episodes or are highly confident
- Confidence reflects how well-supported the fact is across episodes
- Combine overlapping information into single concise facts
- Skip ephemeral details (specific error messages, temporary states)`;
function buildSemanticMergePrompt(episodes) {
	return `Consolidate these episodic memories into stable facts:\n\n${episodes.map((e, i) => `[Episode ${i + 1}]\nTitle: ${e.title}\nNarrative: ${e.narrative}\nConcepts: ${e.concepts.join(", ")}`).join("\n\n")}`;
}
const PROCEDURAL_EXTRACTION_SYSTEM = `You are a procedural memory extractor. Given repeated patterns and workflows observed across sessions, extract reusable procedures.

Output format (XML):
<procedures>
  <procedure name="short descriptive name" trigger="when to use this procedure">
    <step>Step 1 description</step>
    <step>Step 2 description</step>
  </procedure>
</procedures>

Rules:
- Only extract procedures observed 2+ times
- Steps should be concrete and actionable
- Trigger condition should be specific enough to match automatically`;
function buildProceduralExtractionPrompt(patterns) {
	return `Extract reusable procedures from these recurring patterns:\n\n${patterns.map((p, i) => `[Pattern ${i + 1}] (seen ${p.frequency}x)\n${p.content}`).join("\n\n")}`;
}

//#endregion
//#region src/functions/consolidation-pipeline.ts
function applyDecay(items, decayDays) {
	if (decayDays <= 0 || !Number.isFinite(decayDays)) return;
	const now = Date.now();
	for (const item of items) {
		const lastAccess = item.lastAccessedAt || item.updatedAt;
		const daysSince = (now - new Date(lastAccess).getTime()) / (1e3 * 60 * 60 * 24);
		if (daysSince > decayDays) {
			const decayPeriods = Math.floor(daysSince / decayDays);
			item.strength = Math.max(.1, item.strength * Math.pow(.9, decayPeriods));
		}
	}
}
function registerConsolidationPipelineFunction(sdk, kv, provider) {
	sdk.registerFunction("mem::consolidate-pipeline", async (data) => {
		if (!data?.force && !isConsolidationEnabled()) return {
			success: false,
			skipped: true,
			reason: "CONSOLIDATION_ENABLED is not set to true"
		};
		const tier = data?.tier || "all";
		const decayDays = getConsolidationDecayDays();
		const results = {};
		if (tier === "all" || tier === "semantic") {
			const summaries = await kv.list(KV.summaries);
			const existingSemantic = await kv.list(KV.semantic);
			if (summaries.length >= 5) {
				const recentSummaries = summaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 20);
				const prompt = buildSemanticMergePrompt(recentSummaries.map((s) => ({
					title: s.title,
					narrative: s.narrative,
					concepts: s.concepts
				})));
				try {
					const response = await provider.summarize(SEMANTIC_MERGE_SYSTEM, prompt);
					const factRegex = /<fact\s+confidence="([^"]+)">([^<]+)<\/fact>/g;
					let match;
					let newFacts = 0;
					const now = (/* @__PURE__ */ new Date()).toISOString();
					while ((match = factRegex.exec(response)) !== null) {
						const parsedConf = parseFloat(match[1]);
						const confidence = Number.isNaN(parsedConf) ? .5 : parsedConf;
						const fact = match[2].trim();
						const existing = existingSemantic.find((s) => s.fact.toLowerCase() === fact.toLowerCase());
						if (existing) {
							existing.accessCount++;
							existing.lastAccessedAt = now;
							existing.updatedAt = now;
							existing.confidence = Math.max(existing.confidence, confidence);
							await kv.set(KV.semantic, existing.id, existing);
						} else {
							const sem = {
								id: generateId("sem"),
								fact,
								confidence,
								sourceSessionIds: recentSummaries.map((s) => s.sessionId),
								sourceMemoryIds: [],
								accessCount: 1,
								lastAccessedAt: now,
								strength: confidence,
								createdAt: now,
								updatedAt: now
							};
							await kv.set(KV.semantic, sem.id, sem);
							newFacts++;
						}
					}
					results.semantic = {
						newFacts,
						totalSummaries: summaries.length
					};
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					logger.error("Semantic consolidation failed", { error: msg });
					results.semantic = { error: msg };
				}
			} else results.semantic = {
				skipped: true,
				reason: "fewer than 5 summaries"
			};
		}
		if (tier === "all" || tier === "reflect") try {
			results.reflect = await sdk.trigger({
				function_id: "mem::reflect",
				payload: {
					maxClusters: 10,
					project: data?.project
				}
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.warn("Reflect tier failed", { error: msg });
			results.reflect = { error: msg };
		}
		if (tier === "all" || tier === "procedural") {
			const patterns = (await kv.list(KV.memories)).filter((m) => m.isLatest && m.type === "pattern").map((m) => ({
				content: m.content,
				frequency: m.sessionIds.length || 1
			})).filter((p) => p.frequency >= 2);
			if (patterns.length >= 2) {
				const prompt = buildProceduralExtractionPrompt(patterns);
				try {
					const response = await provider.summarize(PROCEDURAL_EXTRACTION_SYSTEM, prompt);
					const procRegex = /<procedure\s+name="([^"]+)"\s+trigger="([^"]+)">([\s\S]*?)<\/procedure>/g;
					let match;
					let newProcs = 0;
					const now = (/* @__PURE__ */ new Date()).toISOString();
					const existingProcs = await kv.list(KV.procedural);
					while ((match = procRegex.exec(response)) !== null) {
						const name = match[1];
						const trigger = match[2];
						const stepsBlock = match[3];
						const steps = [];
						const stepRegex = /<step>([^<]+)<\/step>/g;
						let stepMatch;
						while ((stepMatch = stepRegex.exec(stepsBlock)) !== null) steps.push(stepMatch[1].trim());
						const existing = existingProcs.find((p) => p.name.toLowerCase() === name.toLowerCase());
						if (existing) {
							existing.frequency++;
							existing.updatedAt = now;
							existing.strength = Math.min(1, existing.strength + .1);
							await kv.set(KV.procedural, existing.id, existing);
						} else {
							const proc = {
								id: generateId("proc"),
								name,
								steps,
								triggerCondition: trigger,
								frequency: 1,
								sourceSessionIds: [],
								strength: .5,
								createdAt: now,
								updatedAt: now
							};
							await kv.set(KV.procedural, proc.id, proc);
							newProcs++;
						}
					}
					results.procedural = {
						newProcedures: newProcs,
						patternsAnalyzed: patterns.length
					};
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					logger.error("Procedural extraction failed", { error: msg });
					results.procedural = { error: msg };
				}
			} else results.procedural = {
				skipped: true,
				reason: "fewer than 2 recurring patterns"
			};
		}
		if (tier === "all" || tier === "decay") {
			const semantic = await kv.list(KV.semantic);
			applyDecay(semantic, decayDays);
			for (const s of semantic) await kv.set(KV.semantic, s.id, s);
			const procedural = await kv.list(KV.procedural);
			applyDecay(procedural, decayDays);
			for (const p of procedural) await kv.set(KV.procedural, p.id, p);
			results.decay = {
				semantic: semantic.length,
				procedural: procedural.length
			};
		}
		if (process.env["OBSIDIAN_AUTO_EXPORT"] === "true") try {
			await sdk.trigger({
				function_id: "mem::obsidian-export",
				payload: {}
			});
			results.obsidianExport = { success: true };
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.warn("Obsidian auto-export failed", { error: msg });
			results.obsidianExport = {
				success: false,
				error: msg
			};
		}
		await recordAudit(kv, "consolidate", "mem::consolidate-pipeline", [], {
			tier,
			results
		});
		logger.info("Consolidation pipeline complete", {
			tier,
			results
		});
		return {
			success: true,
			results
		};
	});
}

//#endregion
//#region src/functions/team.ts
const VALID_ITEM_TYPES = new Set([
	"memory",
	"pattern",
	"observation"
]);
function registerTeamFunction(sdk, kv, config) {
	sdk.registerFunction("mem::team-share", async (data) => {
		if (!data) return {
			success: false,
			error: "payload required"
		};
		if (!data.itemId || !data.itemType) return {
			success: false,
			error: "itemId and itemType are required"
		};
		if (!VALID_ITEM_TYPES.has(data.itemType)) return {
			success: false,
			error: `Invalid itemType: ${data.itemType}`
		};
		let content;
		if (data.itemType === "observation") {
			if (!data.sessionId) return {
				success: false,
				error: "sessionId is required for observations"
			};
			content = await kv.get(KV.observations(data.sessionId), data.itemId);
		} else content = await kv.get(KV.memories, data.itemId);
		if (!content) return {
			success: false,
			error: "Item not found"
		};
		const shared = {
			id: generateId("ts"),
			sharedBy: config.userId,
			sharedAt: (/* @__PURE__ */ new Date()).toISOString(),
			type: data.itemType,
			content,
			project: data.project || "",
			visibility: "shared"
		};
		await kv.set(KV.teamShared(config.teamId), shared.id, shared);
		await recordAudit(kv, "share", "mem::team-share", [data.itemId], {
			teamId: config.teamId,
			userId: config.userId,
			itemType: data.itemType
		});
		logger.info("Team share", {
			teamId: config.teamId,
			itemId: data.itemId
		});
		return {
			success: true,
			sharedItem: shared
		};
	});
	sdk.registerFunction("mem::team-feed", async (data) => {
		const limit = data?.limit ?? 20;
		const filtered = (await kv.list(KV.teamShared(config.teamId))).filter((i) => i.visibility === "shared");
		return {
			items: filtered.sort((a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime()).slice(0, limit),
			total: filtered.length
		};
	});
	sdk.registerFunction("mem::team-profile", async () => {
		const items = await kv.list(KV.teamShared(config.teamId));
		const members = [...new Set(items.map((i) => i.sharedBy))];
		const conceptCounts = /* @__PURE__ */ new Map();
		const fileCounts = /* @__PURE__ */ new Map();
		const patterns = [];
		for (const item of items) if (item.type === "memory" || item.type === "pattern") {
			const mem = item.content;
			if (mem?.concepts) for (const c of mem.concepts) conceptCounts.set(c, (conceptCounts.get(c) || 0) + 1);
			if (mem?.files) for (const f of mem.files) fileCounts.set(f, (fileCounts.get(f) || 0) + 1);
			if (item.type === "pattern" && mem?.content) patterns.push(mem.content.slice(0, 100));
		}
		const topConcepts = [...conceptCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([concept, frequency]) => ({
			concept,
			frequency
		}));
		const topFiles = [...fileCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([file, frequency]) => ({
			file,
			frequency
		}));
		const profile = {
			teamId: config.teamId,
			members,
			topConcepts,
			topFiles,
			sharedPatterns: patterns.slice(0, 10),
			totalSharedItems: items.length,
			updatedAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		await kv.set(KV.teamProfile(config.teamId), "profile", profile);
		await recordAudit(kv, "share", "mem::team-profile", ["profile"], {
			teamId: config.teamId,
			members: members.length,
			totalSharedItems: items.length
		}, void 0, config.userId);
		return profile;
	});
}

//#endregion
//#region src/functions/governance.ts
function registerGovernanceFunction(sdk, kv) {
	sdk.registerFunction("mem::governance-delete", async (data) => {
		if (!data.memoryIds || !Array.isArray(data.memoryIds) || data.memoryIds.length === 0) return {
			success: false,
			error: "memoryIds array is required"
		};
		let deleted = 0;
		for (const id of data.memoryIds) if (await kv.get(KV.memories, id)) {
			await kv.delete(KV.memories, id);
			await deleteAccessLog(kv, id);
			deleted++;
		}
		await recordAudit(kv, "delete", "mem::governance-delete", data.memoryIds, {
			reason: data.reason || "manual deletion",
			deleted
		});
		logger.info("Governance delete", {
			requested: data.memoryIds.length,
			deleted
		});
		return {
			success: true,
			deleted,
			total: data.memoryIds.length
		};
	});
	sdk.registerFunction("mem::governance-bulk", async (data) => {
		if (!(data.type && data.type.length > 0 || data.dateFrom || data.dateTo || data.qualityBelow !== void 0) && !data.dryRun) return {
			success: false,
			error: "At least one filter is required for non-dryRun bulk delete"
		};
		let candidates = await kv.list(KV.memories);
		if (data.type && data.type.length > 0) candidates = candidates.filter((m) => data.type.includes(m.type));
		if (data.dateFrom) {
			const from = new Date(data.dateFrom).getTime();
			if (Number.isNaN(from)) return {
				success: false,
				error: "Invalid dateFrom format"
			};
			candidates = candidates.filter((m) => new Date(m.createdAt).getTime() >= from);
		}
		if (data.dateTo) {
			const to = new Date(data.dateTo).getTime();
			if (Number.isNaN(to)) return {
				success: false,
				error: "Invalid dateTo format"
			};
			candidates = candidates.filter((m) => new Date(m.createdAt).getTime() <= to);
		}
		if (data.qualityBelow !== void 0) candidates = candidates.filter((m) => m.strength < data.qualityBelow);
		if (data.dryRun) return {
			success: true,
			dryRun: true,
			wouldDelete: candidates.length,
			ids: candidates.map((m) => m.id)
		};
		const BATCH_SIZE = 50;
		const successfulIds = [];
		const failures = [];
		for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
			const batch = candidates.slice(i, i + BATCH_SIZE);
			(await Promise.allSettled(batch.map(async (mem) => {
				await kv.delete(KV.memories, mem.id);
				await deleteAccessLog(kv, mem.id);
			}))).forEach((result, j) => {
				const mem = batch[j];
				if (result.status === "fulfilled") successfulIds.push(mem.id);
				else {
					logger.warn("Governance bulk delete failed", {
						memoryId: mem.id,
						error: result.reason instanceof Error ? result.reason.message : String(result.reason)
					});
					failures.push({
						id: mem.id,
						error: "delete_failed"
					});
				}
			});
		}
		await safeAudit(kv, "delete", "mem::governance-bulk", successfulIds, {
			filter: data,
			deleted: successfulIds.length,
			failed: failures.length,
			failures: failures.length > 0 ? failures : void 0
		});
		logger.info("Governance bulk delete", {
			deleted: successfulIds.length,
			failed: failures.length
		});
		return {
			success: failures.length === 0,
			deleted: successfulIds.length,
			failed: failures.length,
			failures: failures.length > 0 ? failures : void 0
		};
	});
	sdk.registerFunction("mem::audit-query", async (data) => {
		return queryAudit(kv, data);
	});
}

//#endregion
//#region src/functions/snapshot.ts
const COMMIT_HASH_RE = /^[0-9a-f]{7,40}$/i;
const execFileAsync = promisify(execFile);
async function gitExec(dir, args) {
	const { stdout } = await execFileAsync("git", args, { cwd: dir });
	return stdout.trim();
}
async function ensureGitRepo(dir) {
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	if (!existsSync(join(dir, ".git"))) {
		await gitExec(dir, ["init"]);
		await gitExec(dir, [
			"config",
			"user.email",
			"agentmemory@local"
		]);
		await gitExec(dir, [
			"config",
			"user.name",
			"agentmemory"
		]);
	}
}
function registerSnapshotFunction(sdk, kv, snapshotDir) {
	sdk.registerFunction("mem::snapshot-create", async (data) => {
		try {
			await ensureGitRepo(snapshotDir);
			const ts = (/* @__PURE__ */ new Date()).toISOString();
			const sessions = await kv.list(KV.sessions);
			const memories = await kv.list(KV.memories);
			const graphNodes = await kv.list(KV.graphNodes);
			const accessLogs = await kv.list(KV.accessLog).catch(() => []);
			const observations = {};
			for (const session of sessions) {
				const obs = await kv.list(KV.observations(session.id)).catch(() => []);
				if (obs.length > 0) observations[session.id] = obs;
			}
			const state = {
				version: VERSION,
				timestamp: ts,
				sessions,
				memories,
				graphNodes,
				observations,
				accessLogs
			};
			writeFileSync(join(snapshotDir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
			await gitExec(snapshotDir, ["add", "."]);
			const message = data?.message || `Snapshot ${ts}`;
			try {
				await gitExec(snapshotDir, [
					"commit",
					"-m",
					message
				]);
			} catch (commitErr) {
				if ((commitErr instanceof Error ? commitErr.message : String(commitErr)).includes("nothing to commit")) return {
					success: true,
					message: "No changes to snapshot"
				};
				throw commitErr;
			}
			const commitHash = await gitExec(snapshotDir, ["rev-parse", "HEAD"]);
			const meta = {
				id: generateId("snap"),
				commitHash,
				createdAt: ts,
				message,
				stats: {
					sessions: sessions.length,
					observations: Object.values(observations).reduce((sum, arr) => sum + arr.length, 0),
					memories: memories.length,
					graphNodes: graphNodes.length
				}
			};
			await recordAudit(kv, "export", "mem::snapshot-create", [meta.id], {
				commitHash,
				stats: meta.stats
			});
			logger.info("Snapshot created", { commitHash });
			return {
				success: true,
				snapshot: meta
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Snapshot failed", { error: msg });
			return {
				success: false,
				error: msg
			};
		}
	});
	sdk.registerFunction("mem::snapshot-list", async () => {
		try {
			if (!existsSync(join(snapshotDir, ".git"))) return { snapshots: [] };
			return { snapshots: (await gitExec(snapshotDir, [
				"log",
				"--format=%H|%aI|%s",
				"-20"
			])).split("\n").filter(Boolean).map((line) => {
				const parts = line.split("|");
				const [hash, date] = parts;
				return {
					commitHash: hash,
					createdAt: date,
					message: parts.slice(2).join("|")
				};
			}) };
		} catch {
			return { snapshots: [] };
		}
	});
	sdk.registerFunction("mem::snapshot-restore", async (data) => {
		if (!data || typeof data.commitHash !== "string" || !data.commitHash.trim()) return {
			success: false,
			error: "commitHash is required"
		};
		if (!COMMIT_HASH_RE.test(data.commitHash)) return {
			success: false,
			error: "Invalid commitHash format"
		};
		try {
			await gitExec(snapshotDir, [
				"checkout",
				data.commitHash,
				"--",
				"state.json"
			]);
			const content = readFileSync(join(snapshotDir, "state.json"), "utf-8");
			const state = JSON.parse(content);
			if (state.sessions) for (const session of state.sessions) await kv.set(KV.sessions, session.id, session);
			if (state.memories) for (const memory of state.memories) await kv.set(KV.memories, memory.id, memory);
			if (state.graphNodes) for (const node of state.graphNodes) await kv.set(KV.graphNodes, node.id, node);
			if (state.observations) for (const [sessionId, obs] of Object.entries(state.observations)) for (const o of obs) await kv.set(KV.observations(sessionId), o.id, o);
			if (state.accessLogs) for (const log of state.accessLogs) await kv.set(KV.accessLog, log.memoryId, log);
			await gitExec(snapshotDir, [
				"checkout",
				"HEAD",
				"--",
				"state.json"
			]);
			await recordAudit(kv, "import", "mem::snapshot-restore", [], {
				commitHash: data.commitHash,
				sessions: state.sessions?.length || 0,
				memories: state.memories?.length || 0,
				graphNodes: state.graphNodes?.length || 0
			});
			logger.info("Snapshot restored", { commitHash: data.commitHash });
			return {
				success: true,
				commitHash: data.commitHash
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Snapshot restore failed", { error: msg });
			return {
				success: false,
				error: msg
			};
		}
	});
}

//#endregion
//#region src/functions/actions.ts
function registerActionsFunction(sdk, kv) {
	sdk.registerFunction("mem::action-create", async (data) => {
		if (!data.title || typeof data.title !== "string") return {
			success: false,
			error: "title is required"
		};
		return withKeyedLock("mem:actions", async () => {
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const action = {
				id: generateId("act"),
				title: data.title.trim(),
				description: (data.description || "").trim(),
				status: "pending",
				priority: Math.max(1, Math.min(10, data.priority || 5)),
				createdAt: now,
				updatedAt: now,
				createdBy: data.createdBy || "unknown",
				project: data.project,
				tags: data.tags || [],
				sourceObservationIds: data.sourceObservationIds || [],
				sourceMemoryIds: data.sourceMemoryIds || [],
				parentId: data.parentId
			};
			if (data.parentId) {
				if (!await kv.get(KV.actions, data.parentId)) return {
					success: false,
					error: "parent action not found"
				};
			}
			const validEdgeTypes = [
				"requires",
				"unlocks",
				"spawned_by",
				"gated_by",
				"conflicts_with"
			];
			const pendingEdges = [];
			let hasRequires = false;
			if (data.edges && Array.isArray(data.edges)) for (const e of data.edges) {
				if (!validEdgeTypes.includes(e.type)) return {
					success: false,
					error: `invalid edge type: ${e.type}`
				};
				if (!await kv.get(KV.actions, e.targetActionId)) return {
					success: false,
					error: `target action not found: ${e.targetActionId}`
				};
				if (e.type === "requires") hasRequires = true;
				pendingEdges.push({
					id: generateId("ae"),
					type: e.type,
					sourceActionId: action.id,
					targetActionId: e.targetActionId,
					createdAt: now
				});
			}
			if (hasRequires) action.status = "blocked";
			await kv.set(KV.actions, action.id, action);
			await recordAudit(kv, "action_create", "mem::action-create", [action.id], {
				actor: data.createdBy || "unknown",
				action,
				edges: pendingEdges
			});
			for (const edge of pendingEdges) await kv.set(KV.actionEdges, edge.id, edge);
			return {
				success: true,
				action,
				edges: pendingEdges
			};
		});
	});
	sdk.registerFunction("mem::action-update", async (data) => {
		if (!data.actionId) return {
			success: false,
			error: "actionId is required"
		};
		return withKeyedLock(`mem:action:${data.actionId}`, async () => {
			const action = await kv.get(KV.actions, data.actionId);
			if (!action) return {
				success: false,
				error: "action not found"
			};
			const before = { ...action };
			if (data.status !== void 0) action.status = data.status;
			if (data.title !== void 0) action.title = data.title.trim();
			if (data.description !== void 0) action.description = data.description.trim();
			if (data.priority !== void 0) action.priority = Math.max(1, Math.min(10, data.priority));
			if (data.assignedTo !== void 0) action.assignedTo = data.assignedTo;
			if (data.result !== void 0) action.result = data.result;
			if (data.tags !== void 0) action.tags = data.tags;
			action.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
			await kv.set(KV.actions, action.id, action);
			await recordAudit(kv, "action_update", "mem::action-update", [action.id], {
				actor: data.assignedTo || "unknown",
				before,
				after: action
			});
			if (data.status === "done") await propagateCompletion(kv, action.id);
			return {
				success: true,
				action
			};
		});
	});
	sdk.registerFunction("mem::action-edge-create", async (data) => {
		if (!data.sourceActionId || !data.targetActionId || !data.type) return {
			success: false,
			error: "sourceActionId, targetActionId, and type are required"
		};
		const validTypes = [
			"requires",
			"unlocks",
			"spawned_by",
			"gated_by",
			"conflicts_with"
		];
		if (!validTypes.includes(data.type)) return {
			success: false,
			error: `type must be one of: ${validTypes.join(", ")}`
		};
		if (!await kv.get(KV.actions, data.sourceActionId)) return {
			success: false,
			error: "source action not found"
		};
		if (!await kv.get(KV.actions, data.targetActionId)) return {
			success: false,
			error: "target action not found"
		};
		const edge = {
			id: generateId("ae"),
			type: data.type,
			sourceActionId: data.sourceActionId,
			targetActionId: data.targetActionId,
			createdAt: (/* @__PURE__ */ new Date()).toISOString(),
			metadata: data.metadata
		};
		await kv.set(KV.actionEdges, edge.id, edge);
		await recordAudit(kv, "action_create", "mem::action-edge-create", [edge.id], {
			actor: "unknown",
			edge
		});
		return {
			success: true,
			edge
		};
	});
	sdk.registerFunction("mem::action-list", async (data) => {
		let actions = await kv.list(KV.actions);
		if (data.status) actions = actions.filter((a) => a.status === data.status);
		if (data.project) actions = actions.filter((a) => a.project === data.project);
		if (data.parentId) actions = actions.filter((a) => a.parentId === data.parentId);
		if (data.tags && data.tags.length > 0) actions = actions.filter((a) => data.tags.some((t) => a.tags.includes(t)));
		actions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
		const limit = data.limit || 50;
		return {
			success: true,
			actions: actions.slice(0, limit)
		};
	});
	sdk.registerFunction("mem::action-get", async (data) => {
		if (!data.actionId) return {
			success: false,
			error: "actionId is required"
		};
		const action = await kv.get(KV.actions, data.actionId);
		if (!action) return {
			success: false,
			error: "action not found"
		};
		return {
			success: true,
			action,
			edges: (await kv.list(KV.actionEdges)).filter((e) => e.sourceActionId === data.actionId || e.targetActionId === data.actionId),
			children: (await kv.list(KV.actions)).filter((a) => a.parentId === data.actionId)
		};
	});
}
async function propagateCompletion(kv, completedActionId) {
	const allEdges = await kv.list(KV.actionEdges);
	const unlockEdges = allEdges.filter((e) => e.targetActionId === completedActionId && (e.type === "requires" || e.type === "unlocks"));
	const allActions = await kv.list(KV.actions);
	const actionMap = new Map(allActions.map((a) => [a.id, a]));
	for (const edge of unlockEdges) {
		const candidateId = edge.sourceActionId;
		await withKeyedLock(`mem:action:${candidateId}`, async () => {
			const action = await kv.get(KV.actions, candidateId);
			if (action && action.status === "blocked") {
				if (allEdges.filter((e) => e.sourceActionId === action.id && e.type === "requires").every((d) => {
					const target = actionMap.get(d.targetActionId);
					return target && target.status === "done";
				})) {
					action.status = "pending";
					action.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
					await kv.set(KV.actions, action.id, action);
				}
			}
		});
	}
}

//#endregion
//#region src/functions/frontier.ts
function registerFrontierFunction(sdk, kv) {
	sdk.registerFunction("mem::frontier", async (data) => {
		const actions = await kv.list(KV.actions);
		const edges = await kv.list(KV.actionEdges);
		const leases = await kv.list(KV.leases);
		const checkpoints = await kv.list(KV.checkpoints);
		const now = Date.now();
		const activeLeaseMap = /* @__PURE__ */ new Map();
		for (const lease of leases) if (lease.status === "active" && new Date(lease.expiresAt).getTime() > now) activeLeaseMap.set(lease.actionId, lease);
		const checkpointMap = /* @__PURE__ */ new Map();
		for (const cp of checkpoints) checkpointMap.set(cp.id, cp);
		const actionMap = /* @__PURE__ */ new Map();
		for (const a of actions) actionMap.set(a.id, a);
		const frontier = [];
		for (const action of actions) {
			if (action.status === "done" || action.status === "cancelled") continue;
			if (data.project && action.project !== data.project) continue;
			const blockers = [];
			const inEdges = edges.filter((e) => e.sourceActionId === action.id && e.type === "requires");
			for (const edge of inEdges) {
				const dep = actionMap.get(edge.targetActionId);
				if (dep && dep.status !== "done") blockers.push(`requires:${dep.id}:${dep.title}`);
			}
			const gateEdges = edges.filter((e) => e.sourceActionId === action.id && e.type === "gated_by");
			for (const edge of gateEdges) {
				const cp = checkpointMap.get(edge.targetActionId);
				if (cp && cp.status !== "passed") blockers.push(`checkpoint:${cp.id}:${cp.name}`);
			}
			const conflictEdges = edges.filter((e) => (e.sourceActionId === action.id || e.targetActionId === action.id) && e.type === "conflicts_with");
			for (const edge of conflictEdges) {
				const otherId = edge.sourceActionId === action.id ? edge.targetActionId : edge.sourceActionId;
				const other = actionMap.get(otherId);
				if (other && other.status === "active") blockers.push(`conflict:${other.id}:${other.title}`);
			}
			if (blockers.length > 0) continue;
			const lease = activeLeaseMap.get(action.id);
			if (lease && data.agentId && lease.agentId !== data.agentId && !data.includeLeasedByOthers) continue;
			const score = computeScore(action, edges, now);
			frontier.push({
				action,
				score,
				blockers: [],
				leased: !!lease
			});
		}
		frontier.sort((a, b) => b.score - a.score);
		const limit = data.limit || 20;
		return {
			success: true,
			frontier: frontier.slice(0, limit),
			totalActions: actions.length,
			totalUnblocked: frontier.length
		};
	});
	sdk.registerFunction("mem::next", async (data) => {
		const result = await sdk.trigger({
			function_id: "mem::frontier",
			payload: {
				project: data.project,
				agentId: data.agentId,
				limit: 1
			}
		});
		if (!result.success) return {
			success: false,
			suggestion: null,
			message: "Failed to compute frontier",
			totalActions: 0
		};
		if (result.frontier.length === 0) return {
			success: true,
			suggestion: null,
			message: "No actionable work found",
			totalActions: result.totalActions || 0
		};
		const top = result.frontier[0];
		return {
			success: true,
			suggestion: {
				actionId: top.action.id,
				title: top.action.title,
				description: top.action.description,
				priority: top.action.priority,
				score: top.score,
				tags: top.action.tags
			},
			message: `Suggested: ${top.action.title} (priority ${top.action.priority}, score ${top.score.toFixed(2)})`,
			totalActions: result.totalActions,
			totalUnblocked: result.totalUnblocked
		};
	});
}
function computeScore(action, edges, now) {
	let score = action.priority * 10;
	const ageHours = (now - new Date(action.createdAt).getTime()) / (1e3 * 60 * 60);
	score += Math.min(ageHours * .5, 20);
	const unlockCount = edges.filter((e) => e.sourceActionId === action.id && e.type === "unlocks").length;
	score += unlockCount * 5;
	if (edges.some((e) => e.sourceActionId === action.id && e.type === "spawned_by")) score += 3;
	if (action.status === "active") score += 15;
	return Math.round(score * 100) / 100;
}

//#endregion
//#region src/functions/leases.ts
const DEFAULT_LEASE_TTL_MS = 600 * 1e3;
const MAX_LEASE_TTL_MS = 3600 * 1e3;
function registerLeasesFunction(sdk, kv) {
	sdk.registerFunction("mem::lease-acquire", async (data) => {
		if (!data.actionId || !data.agentId) return {
			success: false,
			error: "actionId and agentId are required"
		};
		const rawTtl = typeof data.ttlMs === "number" && Number.isFinite(data.ttlMs) && data.ttlMs > 0 ? data.ttlMs : DEFAULT_LEASE_TTL_MS;
		const ttl = Math.min(rawTtl, MAX_LEASE_TTL_MS);
		return withKeyedLock(`mem:action:${data.actionId}`, async () => {
			const action = await kv.get(KV.actions, data.actionId);
			if (!action) return {
				success: false,
				error: "action not found"
			};
			if (action.status === "done" || action.status === "cancelled") return {
				success: false,
				error: "action already completed"
			};
			if (action.status === "blocked") return {
				success: false,
				error: "action is blocked"
			};
			const activeLease = (await kv.list(KV.leases)).find((l) => l.actionId === data.actionId && l.status === "active" && new Date(l.expiresAt).getTime() > Date.now());
			if (activeLease) {
				if (activeLease.agentId === data.agentId) return {
					success: true,
					lease: activeLease,
					renewed: false,
					message: "Already holding this lease"
				};
				return {
					success: false,
					error: "action already leased",
					heldBy: activeLease.agentId,
					expiresAt: activeLease.expiresAt
				};
			}
			const now = /* @__PURE__ */ new Date();
			const lease = {
				id: generateId("lse"),
				actionId: data.actionId,
				agentId: data.agentId,
				acquiredAt: now.toISOString(),
				expiresAt: new Date(now.getTime() + ttl).toISOString(),
				status: "active"
			};
			await kv.set(KV.leases, lease.id, lease);
			await recordAudit(kv, "lease_acquire", "mem::lease-acquire", [lease.id], {
				actionId: data.actionId,
				agentId: data.agentId,
				expiresAt: lease.expiresAt
			});
			const before = { ...action };
			action.status = "active";
			action.assignedTo = data.agentId;
			action.updatedAt = now.toISOString();
			await kv.set(KV.actions, action.id, action);
			await recordAudit(kv, "action_update", "mem::lease-acquire", [action.id], {
				before,
				after: action
			});
			return {
				success: true,
				lease,
				renewed: false
			};
		});
	});
	sdk.registerFunction("mem::lease-release", async (data) => {
		if (!data.actionId || !data.agentId) return {
			success: false,
			error: "actionId and agentId are required"
		};
		return withKeyedLock(`mem:action:${data.actionId}`, async () => {
			const activeLease = (await kv.list(KV.leases)).find((l) => l.actionId === data.actionId && l.agentId === data.agentId && l.status === "active" && new Date(l.expiresAt).getTime() > Date.now());
			if (!activeLease) return {
				success: false,
				error: "no active lease found for this agent"
			};
			activeLease.status = "released";
			await kv.set(KV.leases, activeLease.id, activeLease);
			await recordAudit(kv, "lease_release", "mem::lease-release", [activeLease.id], {
				actionId: data.actionId,
				agentId: data.agentId,
				status: "released"
			});
			const action = await kv.get(KV.actions, data.actionId);
			if (action && action.status === "active" && action.assignedTo === data.agentId) {
				const before = { ...action };
				if (data.result) {
					action.status = "done";
					action.result = data.result;
				} else action.status = "pending";
				action.assignedTo = void 0;
				action.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
				await kv.set(KV.actions, action.id, action);
				await recordAudit(kv, "action_update", "mem::lease-release", [action.id], {
					before,
					after: action,
					agentId: data.agentId
				});
			}
			return {
				success: true,
				released: true
			};
		});
	});
	sdk.registerFunction("mem::lease-renew", async (data) => {
		if (!data.actionId || !data.agentId) return {
			success: false,
			error: "actionId and agentId are required"
		};
		const rawTtl = typeof data.ttlMs === "number" && Number.isFinite(data.ttlMs) && data.ttlMs > 0 ? data.ttlMs : DEFAULT_LEASE_TTL_MS;
		const ttl = Math.min(rawTtl, MAX_LEASE_TTL_MS);
		return withKeyedLock(`mem:action:${data.actionId}`, async () => {
			const activeLease = (await kv.list(KV.leases)).find((l) => l.actionId === data.actionId && l.agentId === data.agentId && l.status === "active" && new Date(l.expiresAt).getTime() > Date.now());
			if (!activeLease) return {
				success: false,
				error: "no active (non-expired) lease to renew"
			};
			const now = /* @__PURE__ */ new Date();
			const base = Math.max(now.getTime(), new Date(activeLease.expiresAt).getTime());
			const beforeLease = { ...activeLease };
			activeLease.expiresAt = new Date(base + ttl).toISOString();
			activeLease.renewedAt = now.toISOString();
			await kv.set(KV.leases, activeLease.id, activeLease);
			await recordAudit(kv, "lease_renew", "mem::lease-renew", [activeLease.id], {
				actionId: data.actionId,
				agentId: data.agentId,
				before: beforeLease,
				after: activeLease
			});
			return {
				success: true,
				lease: activeLease
			};
		});
	});
	sdk.registerFunction("mem::lease-cleanup", async () => {
		const leases = await kv.list(KV.leases);
		const now = Date.now();
		let expired = 0;
		for (const lease of leases) if (lease.status === "active" && new Date(lease.expiresAt).getTime() <= now) {
			if (await withKeyedLock(`mem:action:${lease.actionId}`, async () => {
				const currentLease = await kv.get(KV.leases, lease.id);
				if (!currentLease || currentLease.status !== "active" || new Date(currentLease.expiresAt).getTime() > Date.now()) return false;
				currentLease.status = "expired";
				await kv.set(KV.leases, currentLease.id, currentLease);
				await recordAudit(kv, "lease_release", "mem::lease-cleanup", [currentLease.id], {
					action: "expire",
					actionId: currentLease.actionId,
					agentId: currentLease.agentId
				});
				const action = await kv.get(KV.actions, currentLease.actionId);
				const otherActiveLease = (await kv.list(KV.leases)).some((l) => l.id !== currentLease.id && l.actionId === currentLease.actionId && l.status === "active" && new Date(l.expiresAt).getTime() > Date.now());
				if (action && !otherActiveLease && action.status === "active" && action.assignedTo === currentLease.agentId) {
					action.status = "pending";
					action.assignedTo = void 0;
					action.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
					await kv.set(KV.actions, action.id, action);
					await recordAudit(kv, "action_update", "mem::lease-cleanup", [action.id], {
						action: "status-change",
						newStatus: action.status,
						actionId: action.id
					});
				}
				return true;
			})) expired++;
		}
		return {
			success: true,
			expired
		};
	});
}

//#endregion
//#region src/functions/routines.ts
function registerRoutinesFunction(sdk, kv) {
	sdk.registerFunction("mem::routine-create", async (data) => {
		if (!data.name || !Array.isArray(data.steps) || data.steps.length === 0) return {
			success: false,
			error: "name and steps are required"
		};
		for (let i = 0; i < data.steps.length; i++) if (!data.steps[i].title?.trim()) return {
			success: false,
			error: `step ${i} must have a title`
		};
		const orders = data.steps.map((s, i) => s.order ?? i);
		const uniqueOrders = new Set(orders);
		if (uniqueOrders.size !== orders.length) return {
			success: false,
			error: "duplicate step orders"
		};
		for (const step of data.steps) if (step.dependsOn) {
			for (const dep of step.dependsOn) if (!uniqueOrders.has(dep)) return {
				success: false,
				error: `step ${step.order ?? data.steps.indexOf(step)} depends on unknown order ${dep}`
			};
		}
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const routine = {
			id: generateId("rtn"),
			name: data.name.trim(),
			description: (data.description || "").trim(),
			steps: data.steps.map((s, i) => ({
				order: s.order ?? i,
				title: s.title,
				description: s.description || "",
				actionTemplate: s.actionTemplate || {},
				dependsOn: s.dependsOn || []
			})),
			createdAt: now,
			updatedAt: now,
			frozen: data.frozen ?? true,
			tags: data.tags || [],
			sourceProceduralIds: data.sourceProceduralIds || []
		};
		await kv.set(KV.routines, routine.id, routine);
		await recordAudit(kv, "routine_run", "mem::routine-create", [routine.id], {
			action: "routine.create",
			stepCount: routine.steps.length
		});
		return {
			success: true,
			routine
		};
	});
	sdk.registerFunction("mem::routine-list", async (data) => {
		let routines = await kv.list(KV.routines);
		if (data.frozen !== void 0) routines = routines.filter((r) => r.frozen === data.frozen);
		if (data.tags && data.tags.length > 0) routines = routines.filter((r) => data.tags.some((t) => r.tags.includes(t)));
		routines.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
		return {
			success: true,
			routines
		};
	});
	sdk.registerFunction("mem::routine-run", async (data) => {
		if (!data.routineId) return {
			success: false,
			error: "routineId is required"
		};
		return withKeyedLock(`mem:routine:${data.routineId}`, async () => {
			const routine = await kv.get(KV.routines, data.routineId);
			if (!routine) return {
				success: false,
				error: "routine not found"
			};
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const stepOrderToActionId = /* @__PURE__ */ new Map();
			const actionIds = [];
			const stepStatus = {};
			for (const step of routine.steps) {
				const template = step.actionTemplate || {};
				const override = data.overrides?.[step.order] || {};
				const hasDeps = (step.dependsOn || []).length > 0;
				const action = {
					id: generateId("act"),
					title: override.title || template.title || step.title,
					description: override.description || template.description || step.description,
					status: hasDeps ? "blocked" : "pending",
					priority: override.priority ?? template.priority ?? 5,
					createdAt: now,
					updatedAt: now,
					createdBy: data.initiatedBy || "routine",
					project: data.project || template.project,
					tags: [
						...template.tags || [],
						...override.tags || [],
						`routine:${routine.id}`
					],
					sourceObservationIds: [],
					sourceMemoryIds: [],
					metadata: {
						routineId: routine.id,
						stepOrder: step.order
					}
				};
				await kv.set(KV.actions, action.id, action);
				stepOrderToActionId.set(step.order, action.id);
				actionIds.push(action.id);
				stepStatus[step.order] = "pending";
			}
			for (const step of routine.steps) {
				const actionId = stepOrderToActionId.get(step.order);
				if (!actionId) continue;
				for (const depOrder of step.dependsOn) {
					const depActionId = stepOrderToActionId.get(depOrder);
					if (!depActionId) continue;
					const edge = {
						id: generateId("ae"),
						type: "requires",
						sourceActionId: actionId,
						targetActionId: depActionId,
						createdAt: now
					};
					await kv.set(KV.actionEdges, edge.id, edge);
				}
			}
			const run = {
				id: generateId("run"),
				routineId: routine.id,
				status: "running",
				startedAt: now,
				actionIds,
				stepStatus,
				initiatedBy: data.initiatedBy || "unknown"
			};
			await kv.set(KV.routineRuns, run.id, run);
			await recordAudit(kv, "routine_run", "mem::routine-run", [run.id], {
				action: "routine.run",
				routineId: routine.id,
				actionIds,
				initiatedBy: data.initiatedBy || "unknown"
			});
			return {
				success: true,
				run,
				actionsCreated: actionIds.length
			};
		});
	});
	sdk.registerFunction("mem::routine-status", async (data) => {
		if (!data.runId) return {
			success: false,
			error: "runId is required"
		};
		const run = await kv.get(KV.routineRuns, data.runId);
		if (!run) return {
			success: false,
			error: "run not found"
		};
		const actionStates = [];
		let allDone = true;
		let anyFailed = false;
		let statusChanged = false;
		for (const actionId of run.actionIds) {
			const action = await kv.get(KV.actions, actionId);
			if (action) {
				actionStates.push({
					actionId: action.id,
					status: action.status,
					title: action.title
				});
				if (action.status !== "done") allDone = false;
				if (action.status === "cancelled") anyFailed = true;
				const stepOrder = action.metadata?.stepOrder;
				if (stepOrder !== void 0 && stepOrder in run.stepStatus) {
					let mapped;
					if (action.status === "cancelled") mapped = "failed";
					else if (action.status === "blocked") mapped = "pending";
					else mapped = action.status;
					if (run.stepStatus[stepOrder] !== mapped) {
						run.stepStatus[stepOrder] = mapped;
						statusChanged = true;
					}
				}
			} else {
				actionStates.push({
					actionId,
					status: "cancelled",
					title: "(missing)"
				});
				allDone = false;
				anyFailed = true;
			}
		}
		if (allDone && run.status === "running") {
			run.status = "completed";
			run.completedAt = (/* @__PURE__ */ new Date()).toISOString();
			statusChanged = true;
		} else if (anyFailed && run.status === "running") {
			run.status = "failed";
			statusChanged = true;
		}
		if (statusChanged) {
			await kv.set(KV.routineRuns, run.id, run);
			await recordAudit(kv, "routine_run", "mem::routine-status", [run.id], {
				action: "routine.status",
				status: run.status
			});
		}
		return {
			success: true,
			run,
			actions: actionStates,
			progress: {
				total: run.actionIds.length,
				done: actionStates.filter((a) => a.status === "done").length,
				active: actionStates.filter((a) => a.status === "active").length,
				pending: actionStates.filter((a) => a.status === "pending").length,
				blocked: actionStates.filter((a) => a.status === "blocked").length,
				cancelled: actionStates.filter((a) => a.status === "cancelled").length
			}
		};
	});
	sdk.registerFunction("mem::routine-freeze", async (data) => {
		if (!data.routineId) return {
			success: false,
			error: "routineId is required"
		};
		return withKeyedLock(`mem:routine:${data.routineId}`, async () => {
			const routine = await kv.get(KV.routines, data.routineId);
			if (!routine) return {
				success: false,
				error: "routine not found"
			};
			routine.frozen = true;
			routine.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
			await kv.set(KV.routines, routine.id, routine);
			await recordAudit(kv, "routine_run", "mem::routine-freeze", [routine.id], {
				action: "routine.freeze",
				frozen: true
			});
			return {
				success: true,
				routine
			};
		});
	});
}

//#endregion
//#region src/functions/signals.ts
function registerSignalsFunction(sdk, kv) {
	sdk.registerFunction("mem::signal-send", async (data) => {
		if (!data.from?.trim() || !data.content?.trim()) return {
			success: false,
			error: "from and non-empty content are required"
		};
		const now = /* @__PURE__ */ new Date();
		let threadId = data.threadId;
		if (data.replyTo && !threadId) {
			const parent = await kv.get(KV.signals, data.replyTo);
			if (parent) threadId = parent.threadId || parent.id;
		}
		const signal = {
			id: generateId("sig"),
			from: data.from,
			to: data.to,
			content: data.content.trim(),
			type: data.type || "info",
			threadId: threadId || generateId("thr"),
			replyTo: data.replyTo,
			metadata: data.metadata,
			createdAt: now.toISOString(),
			expiresAt: data.expiresInMs ? new Date(now.getTime() + data.expiresInMs).toISOString() : void 0
		};
		await kv.set(KV.signals, signal.id, signal);
		await recordAudit(kv, "signal_send", "mem::signal-send", [signal.id], {
			action: "create",
			from: data.from,
			to: data.to,
			type: signal.type
		});
		return {
			success: true,
			signal
		};
	});
	sdk.registerFunction("mem::signal-read", async (data) => {
		if (!data.agentId) return {
			success: false,
			error: "agentId is required"
		};
		let signals = await kv.list(KV.signals);
		const now = Date.now();
		signals = signals.filter((s) => {
			if (s.expiresAt && new Date(s.expiresAt).getTime() <= now) return false;
			if (s.to && s.to !== data.agentId && s.from !== data.agentId) return false;
			if (!s.to && s.from !== data.agentId) return true;
			return true;
		});
		if (data.unreadOnly) signals = signals.filter((s) => !s.readAt && s.to === data.agentId);
		if (data.threadId) signals = signals.filter((s) => s.threadId === data.threadId);
		if (data.type) signals = signals.filter((s) => s.type === data.type);
		signals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		const limit = data.limit || 50;
		const results = signals.slice(0, limit);
		for (const sig of results) if (!sig.readAt && sig.to === data.agentId) {
			const beforeReadAt = sig.readAt;
			sig.readAt = (/* @__PURE__ */ new Date()).toISOString();
			await recordAudit(kv, "signal_send", "mem::signal-read", [sig.id], {
				action: "signal.mark_read",
				actor: data.agentId,
				beforeReadAt,
				afterReadAt: sig.readAt
			});
			await kv.set(KV.signals, sig.id, sig);
		}
		return {
			success: true,
			signals: results
		};
	});
	sdk.registerFunction("mem::signal-threads", async (data) => {
		if (!data.agentId) return {
			success: false,
			error: "agentId is required"
		};
		const signals = await kv.list(KV.signals);
		const now = Date.now();
		const relevant = signals.filter((s) => {
			if (s.expiresAt && new Date(s.expiresAt).getTime() <= now) return false;
			return s.from === data.agentId || s.to === data.agentId || !s.to;
		});
		const threadMap = /* @__PURE__ */ new Map();
		for (const sig of relevant) {
			const tid = sig.threadId || sig.id;
			const existing = threadMap.get(tid);
			if (existing) {
				existing.messages++;
				existing.participants.add(sig.from);
				if (sig.to) existing.participants.add(sig.to);
				if (new Date(sig.createdAt) > new Date(existing.lastMessage)) existing.lastMessage = sig.createdAt;
			} else {
				const participants = new Set([sig.from]);
				if (sig.to) participants.add(sig.to);
				threadMap.set(tid, {
					threadId: tid,
					messages: 1,
					lastMessage: sig.createdAt,
					participants
				});
			}
		}
		return {
			success: true,
			threads: Array.from(threadMap.values()).map((t) => ({
				...t,
				participants: Array.from(t.participants)
			})).sort((a, b) => new Date(b.lastMessage).getTime() - new Date(a.lastMessage).getTime()).slice(0, data.limit || 20)
		};
	});
	sdk.registerFunction("mem::signal-cleanup", async () => {
		const signals = await kv.list(KV.signals);
		const now = Date.now();
		let removed = 0;
		for (const sig of signals) if (sig.expiresAt && new Date(sig.expiresAt).getTime() <= now) {
			await recordAudit(kv, "delete", "mem::signal-cleanup", [sig.id], {
				action: "delete",
				resource: "Signal",
				before: sig
			});
			await kv.delete(KV.signals, sig.id);
			removed++;
		}
		return {
			success: true,
			removed
		};
	});
}

//#endregion
//#region src/functions/checkpoints.ts
function registerCheckpointsFunction(sdk, kv) {
	sdk.registerFunction("mem::checkpoint-create", async (data) => {
		if (!data.name) return {
			success: false,
			error: "name is required"
		};
		const validTypes = [
			"ci",
			"approval",
			"deploy",
			"external",
			"timer"
		];
		if (data.type && !validTypes.includes(data.type)) return {
			success: false,
			error: `invalid checkpoint type: ${data.type}. Must be one of: ${validTypes.join(", ")}`
		};
		const now = /* @__PURE__ */ new Date();
		const checkpoint = {
			id: generateId("ckpt"),
			name: data.name.trim(),
			description: (data.description || "").trim(),
			status: "pending",
			type: data.type || "external",
			createdAt: now.toISOString(),
			linkedActionIds: data.linkedActionIds || [],
			expiresAt: data.expiresInMs ? new Date(now.getTime() + data.expiresInMs).toISOString() : void 0
		};
		if (data.linkedActionIds && data.linkedActionIds.length > 0) {
			for (const actionId of data.linkedActionIds) if (!await kv.get(KV.actions, actionId)) return {
				success: false,
				error: `linked action not found: ${actionId}`
			};
		}
		await kv.set(KV.checkpoints, checkpoint.id, checkpoint);
		await recordAudit(kv, "checkpoint_resolve", "mem::checkpoint-create", [checkpoint.id], {
			action: "create",
			type: checkpoint.type,
			name: checkpoint.name
		});
		if (data.linkedActionIds && data.linkedActionIds.length > 0) for (const actionId of data.linkedActionIds) {
			const edge = {
				id: generateId("ae"),
				type: "gated_by",
				sourceActionId: actionId,
				targetActionId: checkpoint.id,
				createdAt: now.toISOString()
			};
			await kv.set(KV.actionEdges, edge.id, edge);
			const action = await kv.get(KV.actions, actionId);
			if (action && action.status === "pending") {
				const previousStatus = action.status;
				action.status = "blocked";
				action.updatedAt = now.toISOString();
				await kv.set(KV.actions, action.id, action);
				await recordAudit(kv, "action_update", "mem::checkpoint-create", [action.id], {
					action: "status-change",
					previousStatus,
					newStatus: action.status,
					checkpointId: checkpoint.id
				});
			}
		}
		return {
			success: true,
			checkpoint
		};
	});
	sdk.registerFunction("mem::checkpoint-resolve", async (data) => {
		if (!data.checkpointId || !data.status) return {
			success: false,
			error: "checkpointId and status are required"
		};
		return withKeyedLock(`mem:checkpoint:${data.checkpointId}`, async () => {
			const checkpoint = await kv.get(KV.checkpoints, data.checkpointId);
			if (!checkpoint) return {
				success: false,
				error: "checkpoint not found"
			};
			if (checkpoint.status !== "pending") return {
				success: false,
				error: `checkpoint already ${checkpoint.status}`
			};
			checkpoint.status = data.status;
			checkpoint.resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
			checkpoint.resolvedBy = data.resolvedBy;
			checkpoint.result = data.result;
			await kv.set(KV.checkpoints, checkpoint.id, checkpoint);
			await recordAudit(kv, "checkpoint_resolve", "mem::checkpoint-resolve", [checkpoint.id], {
				action: "resolve",
				resolvedBy: data.resolvedBy,
				result: data.result,
				newStatus: checkpoint.status
			});
			let unblockedCount = 0;
			if (data.status === "passed" && checkpoint.linkedActionIds.length > 0) {
				const allEdges = await kv.list(KV.actionEdges);
				const allCheckpoints = await kv.list(KV.checkpoints);
				const allActions = await kv.list(KV.actions);
				const cpMap = new Map(allCheckpoints.map((c) => [c.id, c]));
				const actionMap = new Map(allActions.map((a) => [a.id, a]));
				for (const actionId of checkpoint.linkedActionIds) await withKeyedLock(`mem:action:${actionId}`, async () => {
					const action = await kv.get(KV.actions, actionId);
					if (action && action.status === "blocked") {
						const allGatesPassed = allEdges.filter((e) => e.sourceActionId === actionId && e.type === "gated_by").every((g) => {
							const cp = cpMap.get(g.targetActionId);
							return cp && cp.status === "passed";
						});
						const allRequiresMet = allEdges.filter((e) => e.sourceActionId === actionId && e.type === "requires").every((r) => {
							const dep = actionMap.get(r.targetActionId);
							return dep && dep.status === "done";
						});
						if (allGatesPassed && allRequiresMet) {
							const previousStatus = action.status;
							action.status = "pending";
							action.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
							await kv.set(KV.actions, action.id, action);
							await recordAudit(kv, "action_update", "mem::checkpoint-resolve", [action.id], {
								action: "unblock",
								checkpointId: checkpoint.id,
								previousStatus,
								newStatus: action.status
							});
							unblockedCount++;
						}
					}
				});
			}
			return {
				success: true,
				checkpoint,
				unblockedCount
			};
		});
	});
	sdk.registerFunction("mem::checkpoint-list", async (data) => {
		let checkpoints = await kv.list(KV.checkpoints);
		if (data.status) checkpoints = checkpoints.filter((c) => c.status === data.status);
		if (data.type) checkpoints = checkpoints.filter((c) => c.type === data.type);
		checkpoints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return {
			success: true,
			checkpoints
		};
	});
	sdk.registerFunction("mem::checkpoint-expire", async () => {
		const checkpoints = await kv.list(KV.checkpoints);
		const now = Date.now();
		let expired = 0;
		for (const cp of checkpoints) if (cp.status === "pending" && cp.expiresAt && new Date(cp.expiresAt).getTime() <= now) {
			if (await withKeyedLock(`mem:checkpoint:${cp.id}`, async () => {
				const fresh = await kv.get(KV.checkpoints, cp.id);
				if (!fresh || fresh.status !== "pending") return false;
				fresh.status = "expired";
				fresh.resolvedAt = (/* @__PURE__ */ new Date()).toISOString();
				await kv.set(KV.checkpoints, fresh.id, fresh);
				await recordAudit(kv, "checkpoint_resolve", "mem::checkpoint-expire", [fresh.id], {
					action: "expire",
					previousStatus: "pending",
					newStatus: "expired"
				});
				return true;
			})) expired++;
		}
		return {
			success: true,
			expired
		};
	});
}

//#endregion
//#region src/functions/flow-compress.ts
const FLOW_COMPRESS_SYSTEM = `You are a workflow summarizer. Given a completed action chain, produce a concise summary capturing:
1. The overall goal and outcome
2. Key steps taken and their results
3. Any notable decisions or discoveries
4. Lessons learned

Output as XML:
<summary>
<goal>What was the workflow trying to achieve</goal>
<outcome>What happened</outcome>
<steps>Numbered list of key steps</steps>
<discoveries>Any new insights or discoveries</discoveries>
<lesson>What to remember for next time</lesson>
</summary>`;
function registerFlowCompressFunction(sdk, kv, provider) {
	sdk.registerFunction("mem::flow-compress", async (data) => {
		let actionsToCompress = [];
		if (data.runId) {
			const run = await kv.get(KV.routineRuns, data.runId);
			if (!run) return {
				success: false,
				error: "run not found"
			};
			for (const id of run.actionIds) {
				const action = await kv.get(KV.actions, id);
				if (action) actionsToCompress.push(action);
			}
		} else if (data.actionIds && data.actionIds.length > 0) for (const id of data.actionIds) {
			const action = await kv.get(KV.actions, id);
			if (action) actionsToCompress.push(action);
		}
		else if (data.project) actionsToCompress = (await kv.list(KV.actions)).filter((a) => a.project === data.project && a.status === "done");
		else return {
			success: false,
			error: "runId, actionIds, or project is required"
		};
		const doneActions = actionsToCompress.filter((a) => a.status === "done");
		if (doneActions.length === 0) return {
			success: true,
			message: "No completed actions to compress",
			compressed: 0
		};
		const allEdges = await kv.list(KV.actionEdges);
		const relevantIds = new Set(doneActions.map((a) => a.id));
		const prompt = buildFlowPrompt(doneActions, allEdges.filter((e) => relevantIds.has(e.sourceActionId) || relevantIds.has(e.targetActionId)));
		try {
			const summary = parseFlowSummary(await provider.summarize(FLOW_COMPRESS_SYSTEM, prompt));
			const ts = (/* @__PURE__ */ new Date()).toISOString();
			const memory = {
				id: generateId("mem"),
				createdAt: ts,
				updatedAt: ts,
				type: "workflow",
				title: summary.goal || `Workflow: ${doneActions.length} actions`,
				content: formatSummary(summary),
				concepts: extractConcepts(doneActions),
				files: extractFiles(doneActions),
				sessionIds: [],
				strength: 1,
				version: 1,
				isLatest: true,
				metadata: {
					flowCompressed: true,
					actionCount: doneActions.length,
					actionIds: doneActions.map((a) => a.id)
				}
			};
			await kv.set(KV.memories, memory.id, memory);
			await recordAudit(kv, "compress", "mem::flow-compress", [memory.id], {
				action: "compress_flow",
				flowCompressed: true,
				actionCount: doneActions.length,
				project: data.project
			});
			return {
				success: true,
				compressed: doneActions.length,
				memoryId: memory.id,
				summary
			};
		} catch (err) {
			return {
				success: false,
				error: `compression failed: ${String(err)}`,
				compressed: 0
			};
		}
	});
}
function buildFlowPrompt(actions, edges) {
	const lines = ["## Completed Action Chain\n"];
	const sorted = [...actions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	for (const action of sorted) {
		lines.push(`### ${action.title}`);
		if (action.description) lines.push(action.description);
		if (action.result) lines.push(`Result: ${action.result}`);
		lines.push(`Priority: ${action.priority}, Tags: ${(action.tags ?? []).join(", ")}`);
		lines.push("");
	}
	if (edges.length > 0) {
		lines.push("## Dependencies");
		for (const edge of edges) lines.push(`- ${edge.sourceActionId} --${edge.type}--> ${edge.targetActionId}`);
	}
	return lines.join("\n");
}
function parseFlowSummary(response) {
	const extract = (tag) => {
		const match = response.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
		return match ? match[1].trim() : "";
	};
	return {
		goal: extract("goal"),
		outcome: extract("outcome"),
		steps: extract("steps"),
		discoveries: extract("discoveries"),
		lesson: extract("lesson")
	};
}
function formatSummary(s) {
	const parts = [];
	if (s.goal) parts.push(`Goal: ${s.goal}`);
	if (s.outcome) parts.push(`Outcome: ${s.outcome}`);
	if (s.steps) parts.push(`Steps: ${s.steps}`);
	if (s.discoveries) parts.push(`Discoveries: ${s.discoveries}`);
	if (s.lesson) parts.push(`Lesson: ${s.lesson}`);
	return parts.join("\n\n");
}
function extractConcepts(actions) {
	const concepts = /* @__PURE__ */ new Set();
	for (const a of actions) for (const tag of a.tags ?? []) if (!tag.startsWith("routine:")) concepts.add(tag);
	return Array.from(concepts);
}
function extractFiles(actions) {
	const files = /* @__PURE__ */ new Set();
	for (const a of actions) if (a.metadata && typeof a.metadata === "object") {
		const meta = a.metadata;
		if (Array.isArray(meta.files)) {
			for (const f of meta.files) if (typeof f === "string") files.add(f);
		}
	}
	return Array.from(files);
}

//#endregion
//#region src/functions/mesh.ts
function isPrivateIP(ip) {
	if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
	if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
	if (ip === "169.254.169.254") return true;
	if (ip.startsWith("fe80:") || ip.startsWith("fc00:") || ip.startsWith("fd")) return true;
	if (ip.startsWith("::ffff:")) return isPrivateIP(ip.slice(7));
	return false;
}
async function isAllowedUrl(urlStr) {
	try {
		const parsed = new URL(urlStr);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
		if (parsed.username || parsed.password) return false;
		const host = parsed.hostname.toLowerCase();
		if (host === "localhost") return false;
		if (isIP(host) && isPrivateIP(host)) return false;
		if (!isIP(host)) try {
			if ((await lookup(host, { all: true })).some((r) => isPrivateIP(r.address))) return false;
		} catch {}
		return true;
	} catch {
		return false;
	}
}
const DEFAULT_SHARED_SCOPES = [
	"memories",
	"actions",
	"semantic",
	"procedural",
	"relations",
	"graph:nodes",
	"graph:edges"
];
async function lwwMergeList(kv, scope, items, lockPrefix, tsField) {
	if (!items || !Array.isArray(items)) return 0;
	let count = 0;
	for (const item of items) {
		if (!item.id || typeof item.id !== "string") continue;
		const ts = item[tsField];
		if (typeof ts !== "string" || Number.isNaN(new Date(ts).getTime())) continue;
		if (await withKeyedLock(`${lockPrefix}:${item.id}`, async () => {
			const existing = await kv.get(scope, item.id);
			if (!existing) {
				await kv.set(scope, item.id, item);
				return true;
			}
			const existingTs = existing[tsField];
			if (new Date(ts) > new Date(existingTs)) {
				await kv.set(scope, item.id, item);
				return true;
			}
			return false;
		})) count++;
	}
	return count;
}
function graphNodeTs(node) {
	return node.updatedAt || node.createdAt;
}
async function lwwMergeGraphNodes(kv, items) {
	if (!items || !Array.isArray(items)) return 0;
	let count = 0;
	for (const item of items) {
		if (!item.id || typeof item.id !== "string") continue;
		const ts = graphNodeTs(item);
		if (!ts || Number.isNaN(new Date(ts).getTime())) continue;
		if (await withKeyedLock(`mem:gnode:${item.id}`, async () => {
			const existing = await kv.get(KV.graphNodes, item.id);
			if (!existing) {
				await kv.set(KV.graphNodes, item.id, item);
				return true;
			}
			if (new Date(ts) > new Date(graphNodeTs(existing))) {
				await kv.set(KV.graphNodes, item.id, item);
				return true;
			}
			return false;
		})) count++;
	}
	return count;
}
function registerMeshFunction(sdk, kv, meshAuthToken) {
	sdk.registerFunction("mem::mesh-register", async (data) => {
		if (!data || typeof data !== "object") return {
			success: false,
			error: "payload required"
		};
		if (!data.url || !data.name) return {
			success: false,
			error: "url and name are required"
		};
		if (!await isAllowedUrl(data.url)) return {
			success: false,
			error: "URL blocked: private/local address not allowed"
		};
		const duplicate = (await kv.list(KV.mesh)).find((p) => p.url === data.url);
		if (duplicate) return {
			success: false,
			error: "peer already registered",
			peerId: duplicate.id
		};
		const peer = {
			id: generateId("peer"),
			url: data.url,
			name: data.name,
			status: "disconnected",
			sharedScopes: data.sharedScopes || DEFAULT_SHARED_SCOPES,
			syncFilter: data.syncFilter
		};
		await kv.set(KV.mesh, peer.id, peer);
		await recordAudit(kv, "mesh_sync", "mem::mesh-register", [peer.id], {
			action: "mesh.register",
			peerId: peer.id,
			name: peer.name,
			url: peer.url,
			sharedScopes: peer.sharedScopes
		});
		return {
			success: true,
			peer
		};
	});
	sdk.registerFunction("mem::mesh-list", async () => {
		return {
			success: true,
			peers: await kv.list(KV.mesh)
		};
	});
	sdk.registerFunction("mem::mesh-sync", async (data) => {
		if (!meshAuthToken) return {
			success: false,
			error: "mesh sync requires AGENTMEMORY_SECRET"
		};
		if (!data || typeof data !== "object") data = {};
		const direction = data.direction || "both";
		let peers;
		if (data.peerId) {
			const peer = await kv.get(KV.mesh, data.peerId);
			if (!peer) return {
				success: false,
				error: "peer not found"
			};
			peers = [peer];
		} else peers = await kv.list(KV.mesh);
		const results = [];
		for (const peer of peers) {
			const result = {
				peerId: peer.id,
				peerName: peer.name,
				pushed: 0,
				pulled: 0,
				errors: []
			};
			peer.status = "syncing";
			await kv.set(KV.mesh, peer.id, peer);
			await recordAudit(kv, "mesh_sync", "mem::mesh-sync", [peer.id], {
				action: "mesh.sync.start",
				direction,
				scopes: data.scopes || peer.sharedScopes
			});
			const scopes = data.scopes || peer.sharedScopes;
			try {
				if (!await isAllowedUrl(peer.url)) {
					result.errors.push("peer URL blocked: private/local address not allowed");
					peer.status = "error";
					await kv.set(KV.mesh, peer.id, peer);
					await recordAudit(kv, "mesh_sync", "mem::mesh-sync", [peer.id], {
						action: "mesh.sync.error",
						error: "peer URL blocked: private/local address not allowed"
					});
					results.push(result);
					continue;
				}
				if (direction === "push" || direction === "both") {
					const pushData = await collectSyncData(kv, scopes, peer.lastSyncAt, peer.syncFilter);
					try {
						const response = await fetch(`${peer.url}/agentmemory/mesh/receive`, {
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${meshAuthToken}`
							},
							body: JSON.stringify(pushData),
							signal: AbortSignal.timeout(3e4),
							redirect: "error"
						});
						if (response.ok) result.pushed = (await response.json()).accepted || 0;
						else result.errors.push(`push failed: HTTP ${response.status}`);
					} catch (err) {
						result.errors.push(`push failed: ${String(err)}`);
					}
				}
				if (direction === "pull" || direction === "both") try {
					const response = await fetch(`${peer.url}/agentmemory/mesh/export?since=${peer.lastSyncAt || ""}`, {
						headers: { Authorization: `Bearer ${meshAuthToken}` },
						signal: AbortSignal.timeout(3e4),
						redirect: "error"
					});
					if (response.ok) result.pulled = await applySyncData(kv, await response.json(), scopes);
					else result.errors.push(`pull failed: HTTP ${response.status}`);
				} catch (err) {
					result.errors.push(`pull failed: ${String(err)}`);
				}
				peer.status = result.errors.length > 0 ? "error" : "connected";
				if (result.errors.length === 0) peer.lastSyncAt = (/* @__PURE__ */ new Date()).toISOString();
			} catch (err) {
				peer.status = "disconnected";
				result.errors.push(String(err));
			}
			await kv.set(KV.mesh, peer.id, peer);
			await recordAudit(kv, "mesh_sync", "mem::mesh-sync", [peer.id], {
				action: result.errors.length > 0 ? "mesh.sync.error" : "mesh.sync.complete",
				direction,
				scopes,
				pushed: result.pushed,
				pulled: result.pulled,
				errors: result.errors,
				lastSyncAt: peer.lastSyncAt
			});
			results.push(result);
		}
		return {
			success: true,
			results
		};
	});
	sdk.registerFunction("mem::mesh-receive", async (data) => {
		if (!data || typeof data !== "object") return {
			success: false,
			error: "payload required"
		};
		let accepted = 0;
		accepted += await lwwMergeList(kv, KV.memories, data.memories, "mem:memory", "updatedAt");
		accepted += await lwwMergeList(kv, KV.actions, data.actions, "mem:action", "updatedAt");
		accepted += await lwwMergeList(kv, KV.semantic, data.semantic, "mem:semantic", "updatedAt");
		accepted += await lwwMergeList(kv, KV.procedural, data.procedural, "mem:procedural", "updatedAt");
		if (data.relations && Array.isArray(data.relations)) for (const rel of data.relations) {
			if (!rel.sourceId || !rel.targetId || !rel.type) continue;
			const relKey = `${rel.sourceId}:${rel.targetId}:${rel.type}`;
			await withKeyedLock(`mem:relation:${relKey}`, async () => {
				if (!await kv.get(KV.relations, relKey)) {
					await kv.set(KV.relations, relKey, rel);
					await recordAudit(kv, "mesh_sync", "mem::mesh-receive", [relKey], {
						action: "mesh.receive.relation",
						accepted: true
					});
					accepted++;
				}
			});
		}
		accepted += await lwwMergeGraphNodes(kv, data.graphNodes);
		accepted += await lwwMergeList(kv, KV.graphEdges, data.graphEdges, "mem:gedge", "createdAt");
		await recordAudit(kv, "mesh_sync", "mem::mesh-receive", [], {
			action: "mesh.receive",
			accepted
		});
		return {
			success: true,
			accepted
		};
	});
	sdk.registerFunction("mem::mesh-remove", async (data) => {
		if (!data || typeof data !== "object" || !data.peerId) return {
			success: false,
			error: "peerId is required"
		};
		await kv.delete(KV.mesh, data.peerId);
		await recordAudit(kv, "mesh_sync", "mem::mesh-remove", [data.peerId], { action: "mesh.remove" });
		return { success: true };
	});
}
function deltaFilter(items, sinceTime, tsField) {
	return items.filter((item) => new Date(item[tsField]).getTime() > sinceTime);
}
async function collectSyncData(kv, scopes, since, syncFilter) {
	const result = {};
	const parsed = since ? new Date(since).getTime() : 0;
	const sinceTime = Number.isNaN(parsed) ? 0 : parsed;
	if (scopes.includes("memories")) result.memories = deltaFilter(await kv.list(KV.memories), sinceTime, "updatedAt");
	if (scopes.includes("actions")) {
		let all = await kv.list(KV.actions);
		if (syncFilter?.project) all = all.filter((a) => a.project === syncFilter.project);
		result.actions = deltaFilter(all, sinceTime, "updatedAt");
	}
	const projectScoped = !!syncFilter?.project;
	if (scopes.includes("semantic") && !projectScoped) result.semantic = deltaFilter(await kv.list(KV.semantic), sinceTime, "updatedAt");
	if (scopes.includes("procedural") && !projectScoped) result.procedural = deltaFilter(await kv.list(KV.procedural), sinceTime, "updatedAt");
	if (scopes.includes("relations") && !projectScoped) result.relations = deltaFilter(await kv.list(KV.relations), sinceTime, "createdAt");
	if (scopes.includes("graph:nodes") && !projectScoped) result.graphNodes = (await kv.list(KV.graphNodes)).filter((n) => new Date(graphNodeTs(n)).getTime() > sinceTime);
	if (scopes.includes("graph:edges") && !projectScoped) result.graphEdges = deltaFilter(await kv.list(KV.graphEdges), sinceTime, "createdAt");
	return result;
}
async function applySyncData(kv, data, scopes) {
	let applied = 0;
	if (scopes.includes("memories")) applied += await lwwMergeList(kv, KV.memories, data.memories, "mem:memory", "updatedAt");
	if (scopes.includes("actions")) applied += await lwwMergeList(kv, KV.actions, data.actions, "mem:action", "updatedAt");
	if (scopes.includes("semantic")) applied += await lwwMergeList(kv, KV.semantic, data.semantic, "mem:semantic", "updatedAt");
	if (scopes.includes("procedural")) applied += await lwwMergeList(kv, KV.procedural, data.procedural, "mem:procedural", "updatedAt");
	if (scopes.includes("relations") && data.relations) for (const rel of data.relations) {
		if (!rel.sourceId || !rel.targetId || !rel.type) continue;
		const relKey = `${rel.sourceId}:${rel.targetId}:${rel.type}`;
		if (await withKeyedLock(`mem:relation:${relKey}`, async () => {
			if (!await kv.get(KV.relations, relKey)) {
				await kv.set(KV.relations, relKey, rel);
				return true;
			}
			return false;
		})) applied++;
	}
	if (scopes.includes("graph:nodes")) applied += await lwwMergeGraphNodes(kv, data.graphNodes);
	if (scopes.includes("graph:edges")) applied += await lwwMergeList(kv, KV.graphEdges, data.graphEdges, "mem:gedge", "createdAt");
	return applied;
}

//#endregion
//#region src/functions/branch-aware.ts
function execAsync(cmd, args, cwd) {
	return new Promise((resolve, reject) => {
		execFile(cmd, args, {
			cwd,
			timeout: 5e3
		}, (err, stdout) => {
			if (err) reject(err);
			else resolve(stdout.trim());
		});
	});
}
function registerBranchAwareFunction(sdk, kv) {
	sdk.registerFunction("mem::detect-worktree", async (data) => {
		if (!data.cwd) return {
			success: false,
			error: "cwd is required"
		};
		try {
			const gitDir = await execAsync("git", ["rev-parse", "--git-dir"], data.cwd);
			const commonDir = await execAsync("git", ["rev-parse", "--git-common-dir"], data.cwd);
			const branch = await execAsync("git", [
				"rev-parse",
				"--abbrev-ref",
				"HEAD"
			], data.cwd).catch(() => "detached");
			const topLevel = await execAsync("git", ["rev-parse", "--show-toplevel"], data.cwd);
			const isWorktree = resolve(data.cwd, gitDir) !== resolve(data.cwd, commonDir);
			return {
				success: true,
				isWorktree,
				branch,
				topLevel,
				mainRepoRoot: isWorktree ? resolve(data.cwd, commonDir, "..") : topLevel,
				gitDir: resolve(data.cwd, gitDir),
				commonDir: resolve(data.cwd, commonDir)
			};
		} catch {
			return {
				success: true,
				isWorktree: false,
				branch: null,
				topLevel: data.cwd,
				mainRepoRoot: data.cwd,
				gitDir: null,
				commonDir: null
			};
		}
	});
	sdk.registerFunction("mem::list-worktrees", async (data) => {
		if (!data.cwd) return {
			success: false,
			error: "cwd is required"
		};
		try {
			const output = await execAsync("git", [
				"worktree",
				"list",
				"--porcelain"
			], data.cwd);
			const worktrees = [];
			const blocks = output.split("\n\n").filter(Boolean);
			for (const block of blocks) {
				const lines = block.split("\n");
				const wt = {
					path: "",
					head: "",
					branch: "",
					bare: false
				};
				for (const line of lines) if (line.startsWith("worktree ")) wt.path = line.slice(9);
				else if (line.startsWith("HEAD ")) wt.head = line.slice(5);
				else if (line.startsWith("branch ")) wt.branch = line.slice(7).replace("refs/heads/", "");
				else if (line === "bare") wt.bare = true;
				if (wt.path) worktrees.push(wt);
			}
			return {
				success: true,
				worktrees
			};
		} catch {
			return {
				success: true,
				worktrees: []
			};
		}
	});
	sdk.registerFunction("mem::branch-sessions", async (data) => {
		if (!data.cwd) return {
			success: false,
			error: "cwd is required"
		};
		const worktreeInfo = await sdk.trigger({
			function_id: "mem::detect-worktree",
			payload: { cwd: data.cwd }
		});
		const projectRoot = worktreeInfo.mainRepoRoot || data.cwd;
		const branch = data.branch || worktreeInfo.branch;
		const matching = (await kv.list(KV.sessions)).filter((s) => {
			if (s.project === projectRoot || s.cwd === projectRoot) return true;
			if (s.cwd.startsWith(projectRoot + "/")) return true;
			return false;
		});
		matching.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
		return {
			success: true,
			sessions: matching,
			projectRoot,
			branch,
			isWorktree: worktreeInfo.isWorktree
		};
	});
}

//#endregion
//#region src/functions/sentinels.ts
const VALID_TYPES = [
	"webhook",
	"timer",
	"threshold",
	"pattern",
	"approval",
	"custom"
];
function registerSentinelsFunction(sdk, kv) {
	sdk.registerFunction("mem::sentinel-create", async (data) => {
		if (!data.name || typeof data.name !== "string") return {
			success: false,
			error: "name is required"
		};
		if (!data.type || !VALID_TYPES.includes(data.type)) return {
			success: false,
			error: `type must be one of: ${VALID_TYPES.join(", ")}`
		};
		if (data.type === "threshold") {
			const cfg = data.config;
			if (!cfg || !cfg.metric || ![
				"gt",
				"lt",
				"eq"
			].includes(cfg.operator || "") || typeof cfg.value !== "number") return {
				success: false,
				error: "threshold config requires metric, operator (gt|lt|eq), and numeric value"
			};
		}
		if (data.type === "pattern") {
			const cfg = data.config;
			if (!cfg || !cfg.pattern || typeof cfg.pattern !== "string") return {
				success: false,
				error: "pattern config requires a pattern string"
			};
		}
		if (data.type === "webhook") {
			const cfg = data.config;
			if (!cfg || !cfg.path || typeof cfg.path !== "string") return {
				success: false,
				error: "webhook config requires a path string"
			};
		}
		if (data.type === "timer") {
			const cfg = data.config;
			if (!cfg || typeof cfg.durationMs !== "number" || cfg.durationMs <= 0) return {
				success: false,
				error: "timer config requires a positive durationMs"
			};
		}
		if (data.linkedActionIds && data.linkedActionIds.length > 0) {
			for (const actionId of data.linkedActionIds) if (!await kv.get(KV.actions, actionId)) return {
				success: false,
				error: `linked action not found: ${actionId}`
			};
		}
		const now = /* @__PURE__ */ new Date();
		const sentinel = {
			id: generateId("snl"),
			name: data.name.trim(),
			type: data.type,
			status: "watching",
			config: data.config || {},
			createdAt: now.toISOString(),
			linkedActionIds: data.linkedActionIds || [],
			expiresAt: data.expiresInMs ? new Date(now.getTime() + data.expiresInMs).toISOString() : void 0
		};
		await kv.set(KV.sentinels, sentinel.id, sentinel);
		await recordAudit(kv, "sentinel_create", "mem::sentinel-create", [sentinel.id], {
			action: "sentinel.create",
			type: sentinel.type,
			linkedActionIds: sentinel.linkedActionIds
		});
		if (data.linkedActionIds && data.linkedActionIds.length > 0) for (const actionId of data.linkedActionIds) {
			const edge = {
				id: generateId("ae"),
				type: "gated_by",
				sourceActionId: actionId,
				targetActionId: sentinel.id,
				createdAt: now.toISOString()
			};
			await kv.set(KV.actionEdges, edge.id, edge);
			await recordAudit(kv, "sentinel_create", "mem::sentinel-create", [edge.id], {
				action: "sentinel.create.edge",
				sentinelId: sentinel.id,
				sourceActionId: actionId
			});
		}
		if (data.type === "timer") {
			const durationMs = data.config.durationMs;
			setTimeout(async () => {
				try {
					await withKeyedLock(`mem:sentinel:${sentinel.id}`, async () => {
						const fresh = await kv.get(KV.sentinels, sentinel.id);
						if (!fresh || fresh.status !== "watching") return;
						fresh.status = "triggered";
						fresh.triggeredAt = (/* @__PURE__ */ new Date()).toISOString();
						fresh.result = {
							reason: "timer_elapsed",
							durationMs
						};
						await kv.set(KV.sentinels, fresh.id, fresh);
						await recordAudit(kv, "sentinel_trigger", "mem::sentinel-create", [fresh.id], {
							action: "sentinel.timer_trigger",
							reason: "timer_elapsed",
							durationMs
						});
						await unblockLinkedActions(kv, fresh);
					});
				} catch (err) {
					console.error("sentinel timer callback failed", sentinel.id, err);
				}
			}, durationMs);
		}
		return {
			success: true,
			sentinel
		};
	});
	sdk.registerFunction("mem::sentinel-trigger", async (data) => {
		if (!data.sentinelId) return {
			success: false,
			error: "sentinelId is required"
		};
		return withKeyedLock(`mem:sentinel:${data.sentinelId}`, async () => {
			const sentinel = await kv.get(KV.sentinels, data.sentinelId);
			if (!sentinel) return {
				success: false,
				error: "sentinel not found"
			};
			if (sentinel.status !== "watching") return {
				success: false,
				error: `sentinel already ${sentinel.status}`
			};
			sentinel.status = "triggered";
			sentinel.triggeredAt = (/* @__PURE__ */ new Date()).toISOString();
			sentinel.result = data.result;
			await kv.set(KV.sentinels, sentinel.id, sentinel);
			await recordAudit(kv, "sentinel_trigger", "mem::sentinel-trigger", [sentinel.id], {
				action: "sentinel.trigger",
				result: data.result
			});
			let unblockedCount = 0;
			if (sentinel.linkedActionIds.length > 0) unblockedCount = await unblockLinkedActions(kv, sentinel);
			return {
				success: true,
				sentinel,
				unblockedCount
			};
		});
	});
	sdk.registerFunction("mem::sentinel-check", async () => {
		const active = (await kv.list(KV.sentinels)).filter((s) => s.status === "watching");
		const triggered = [];
		for (const sentinel of active) {
			if (sentinel.type === "threshold") {
				const cfg = sentinel.config;
				const metrics = await kv.get(KV.metrics, cfg.metric);
				if (!metrics) continue;
				const current = metrics.totalCalls;
				let matched = false;
				if (cfg.operator === "gt") matched = current > cfg.value;
				else if (cfg.operator === "lt") matched = current < cfg.value;
				else if (cfg.operator === "eq") matched = current === cfg.value;
				if (matched) {
					await withKeyedLock(`mem:sentinel:${sentinel.id}`, async () => {
						const fresh = await kv.get(KV.sentinels, sentinel.id);
						if (!fresh || fresh.status !== "watching") return;
						fresh.status = "triggered";
						fresh.triggeredAt = (/* @__PURE__ */ new Date()).toISOString();
						fresh.result = {
							reason: "threshold_crossed",
							metric: cfg.metric,
							currentValue: current,
							threshold: cfg.value,
							operator: cfg.operator
						};
						await kv.set(KV.sentinels, fresh.id, fresh);
						await recordAudit(kv, "sentinel_trigger", "mem::sentinel-check", [fresh.id], {
							action: "sentinel.threshold_trigger",
							result: fresh.result
						});
						await unblockLinkedActions(kv, fresh);
					});
					triggered.push(sentinel.id);
				}
			}
			if (sentinel.type === "pattern") {
				const cfg = sentinel.config;
				const regex = new RegExp(cfg.pattern, "i");
				const sessions = await kv.list(KV.sessions);
				let matchedObs = null;
				for (const session of sessions) {
					const recent = (await kv.list(KV.observations(session.id))).filter((o) => new Date(o.timestamp).getTime() >= new Date(sentinel.createdAt).getTime()).find((o) => regex.test(o.title));
					if (recent) {
						matchedObs = recent;
						break;
					}
				}
				if (matchedObs) {
					await withKeyedLock(`mem:sentinel:${sentinel.id}`, async () => {
						const fresh = await kv.get(KV.sentinels, sentinel.id);
						if (!fresh || fresh.status !== "watching") return;
						fresh.status = "triggered";
						fresh.triggeredAt = (/* @__PURE__ */ new Date()).toISOString();
						fresh.result = {
							reason: "pattern_matched",
							pattern: cfg.pattern,
							matchedObservationId: matchedObs.id,
							matchedTitle: matchedObs.title
						};
						await kv.set(KV.sentinels, fresh.id, fresh);
						await recordAudit(kv, "sentinel_trigger", "mem::sentinel-check", [fresh.id], {
							action: "sentinel.pattern_trigger",
							result: fresh.result
						});
						await unblockLinkedActions(kv, fresh);
					});
					triggered.push(sentinel.id);
				}
			}
		}
		return {
			success: true,
			triggered,
			checkedCount: active.length
		};
	});
	sdk.registerFunction("mem::sentinel-cancel", async (data) => {
		if (!data.sentinelId) return {
			success: false,
			error: "sentinelId is required"
		};
		return withKeyedLock(`mem:sentinel:${data.sentinelId}`, async () => {
			const sentinel = await kv.get(KV.sentinels, data.sentinelId);
			if (!sentinel) return {
				success: false,
				error: "sentinel not found"
			};
			if (sentinel.status !== "watching") return {
				success: false,
				error: `cannot cancel sentinel with status ${sentinel.status}`
			};
			sentinel.status = "cancelled";
			await kv.set(KV.sentinels, sentinel.id, sentinel);
			await recordAudit(kv, "sentinel_trigger", "mem::sentinel-cancel", [sentinel.id], {
				action: "sentinel.cancel",
				status: "cancelled"
			});
			return {
				success: true,
				sentinel
			};
		});
	});
	sdk.registerFunction("mem::sentinel-list", async (data) => {
		let sentinels = await kv.list(KV.sentinels);
		if (data.status) sentinels = sentinels.filter((s) => s.status === data.status);
		if (data.type) sentinels = sentinels.filter((s) => s.type === data.type);
		sentinels.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return {
			success: true,
			sentinels
		};
	});
	sdk.registerFunction("mem::sentinel-expire", async () => {
		const sentinels = await kv.list(KV.sentinels);
		const now = Date.now();
		let expired = 0;
		for (const sentinel of sentinels) if (sentinel.status === "watching" && sentinel.expiresAt && new Date(sentinel.expiresAt).getTime() <= now) {
			if (await withKeyedLock(`mem:sentinel:${sentinel.id}`, async () => {
				const fresh = await kv.get(KV.sentinels, sentinel.id);
				if (!fresh || fresh.status !== "watching") return false;
				fresh.status = "expired";
				fresh.triggeredAt = (/* @__PURE__ */ new Date()).toISOString();
				await kv.set(KV.sentinels, fresh.id, fresh);
				await recordAudit(kv, "sentinel_trigger", "mem::sentinel-expire", [fresh.id], {
					action: "sentinel.expire",
					status: "expired"
				});
				return true;
			})) expired++;
		}
		return {
			success: true,
			expired
		};
	});
}
async function unblockLinkedActions(kv, sentinel) {
	if (sentinel.linkedActionIds.length === 0) return 0;
	const allEdges = await kv.list(KV.actionEdges);
	const allSentinels = await kv.list(KV.sentinels);
	const allCheckpoints = await kv.list(KV.checkpoints);
	const gateMap = /* @__PURE__ */ new Map();
	for (const s of allSentinels) gateMap.set(s.id, { status: s.status === "triggered" ? "passed" : s.status });
	for (const c of allCheckpoints) gateMap.set(c.id, { status: c.status });
	let unblockedCount = 0;
	for (const actionId of sentinel.linkedActionIds) await withKeyedLock(`mem:action:${actionId}`, async () => {
		const action = await kv.get(KV.actions, actionId);
		if (action && action.status === "blocked") {
			if (allEdges.filter((e) => e.sourceActionId === actionId && e.type === "gated_by").every((g) => {
				const gate = gateMap.get(g.targetActionId);
				return gate && gate.status === "passed";
			})) {
				action.status = "pending";
				action.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
				await kv.set(KV.actions, action.id, action);
				await recordAudit(kv, "action_update", "mem::sentinel-unblock", [action.id], {
					action: "action.unblocked",
					sentinelId: sentinel.id
				});
				unblockedCount++;
			}
		}
	});
	return unblockedCount;
}

//#endregion
//#region src/functions/sketches.ts
function registerSketchesFunction(sdk, kv) {
	sdk.registerFunction("mem::sketch-create", async (data) => {
		if (!data.title || typeof data.title !== "string") return {
			success: false,
			error: "title is required"
		};
		const now = /* @__PURE__ */ new Date();
		const expiresInMs = data.expiresInMs || 36e5;
		const sketch = {
			id: generateId("sk"),
			title: data.title.trim(),
			description: (data.description || "").trim(),
			status: "active",
			actionIds: [],
			project: data.project,
			createdAt: now.toISOString(),
			expiresAt: new Date(now.getTime() + expiresInMs).toISOString()
		};
		await kv.set(KV.sketches, sketch.id, sketch);
		await safeAudit(kv, "sketch_create", "mem::sketch-create", [sketch.id], {
			action: "create",
			title: sketch.title
		});
		return {
			success: true,
			sketch
		};
	});
	sdk.registerFunction("mem::sketch-add", async (data) => {
		if (!data.sketchId) return {
			success: false,
			error: "sketchId is required"
		};
		if (!data.title || typeof data.title !== "string") return {
			success: false,
			error: "title is required"
		};
		return withKeyedLock(`mem:sketch:${data.sketchId}`, async () => {
			const sketch = await kv.get(KV.sketches, data.sketchId);
			if (!sketch) return {
				success: false,
				error: "sketch not found"
			};
			if (sketch.status !== "active") return {
				success: false,
				error: "sketch is not active"
			};
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const action = {
				id: generateId("act"),
				title: data.title.trim(),
				description: (data.description || "").trim(),
				status: "pending",
				priority: Math.max(1, Math.min(10, data.priority || 5)),
				createdAt: now,
				updatedAt: now,
				createdBy: "sketch",
				project: sketch.project,
				tags: [],
				sourceObservationIds: [],
				sourceMemoryIds: [],
				sketchId: data.sketchId
			};
			if (data.dependsOn && data.dependsOn.length > 0) {
				const sketchActionSet = new Set(sketch.actionIds);
				for (const depId of data.dependsOn) if (!sketchActionSet.has(depId)) return {
					success: false,
					error: `dependency ${depId} not found in this sketch`
				};
			}
			await kv.set(KV.actions, action.id, action);
			await safeAudit(kv, "sketch_create", "mem::sketch-add", [action.id], {
				action: "add.action",
				sketchId: sketch.id
			});
			const createdEdges = [];
			if (data.dependsOn && data.dependsOn.length > 0) for (const depId of data.dependsOn) {
				const edge = {
					id: generateId("ae"),
					type: "requires",
					sourceActionId: action.id,
					targetActionId: depId,
					createdAt: now
				};
				await kv.set(KV.actionEdges, edge.id, edge);
				await safeAudit(kv, "sketch_create", "mem::sketch-add", [edge.id], {
					action: "add.edge",
					sketchId: sketch.id
				});
				createdEdges.push(edge);
			}
			sketch.actionIds.push(action.id);
			await kv.set(KV.sketches, sketch.id, sketch);
			await safeAudit(kv, "sketch_create", "mem::sketch-add", [sketch.id], {
				action: "add.sketch-update",
				addedActionId: action.id
			});
			return {
				success: true,
				action,
				edges: createdEdges
			};
		});
	});
	sdk.registerFunction("mem::sketch-promote", async (data) => {
		if (!data.sketchId) return {
			success: false,
			error: "sketchId is required"
		};
		return withKeyedLock(`mem:sketch:${data.sketchId}`, async () => {
			const sketch = await kv.get(KV.sketches, data.sketchId);
			if (!sketch) return {
				success: false,
				error: "sketch not found"
			};
			if (sketch.status !== "active") return {
				success: false,
				error: "sketch is not active"
			};
			const promotedIds = [];
			for (const actionId of sketch.actionIds) {
				const action = await kv.get(KV.actions, actionId);
				if (action) {
					delete action.sketchId;
					if (data.project) action.project = data.project;
					action.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
					await kv.set(KV.actions, action.id, action);
					await safeAudit(kv, "sketch_promote", "mem::sketch-promote", [action.id], {
						action: "promote.action",
						sketchId: sketch.id
					});
					promotedIds.push(action.id);
				}
			}
			sketch.status = "promoted";
			sketch.promotedAt = (/* @__PURE__ */ new Date()).toISOString();
			await kv.set(KV.sketches, sketch.id, sketch);
			await safeAudit(kv, "sketch_promote", "mem::sketch-promote", [sketch.id], {
				action: "promote.sketch",
				promotedIds
			});
			return {
				success: true,
				promotedIds
			};
		});
	});
	sdk.registerFunction("mem::sketch-discard", async (data) => {
		if (!data.sketchId) return {
			success: false,
			error: "sketchId is required"
		};
		return withKeyedLock(`mem:sketch:${data.sketchId}`, async () => {
			const sketch = await kv.get(KV.sketches, data.sketchId);
			if (!sketch) return {
				success: false,
				error: "sketch not found"
			};
			if (sketch.status !== "active") return {
				success: false,
				error: "sketch is not active"
			};
			const actionIdSet = new Set(sketch.actionIds);
			const allEdges = await kv.list(KV.actionEdges);
			for (const edge of allEdges) if (actionIdSet.has(edge.sourceActionId) || actionIdSet.has(edge.targetActionId)) {
				await kv.delete(KV.actionEdges, edge.id);
				await safeAudit(kv, "sketch_discard", "mem::sketch-discard", [edge.id], {
					action: "discard.edge",
					sketchId: sketch.id
				});
			}
			for (const actionId of sketch.actionIds) {
				await kv.delete(KV.actions, actionId);
				await safeAudit(kv, "sketch_discard", "mem::sketch-discard", [actionId], {
					action: "discard.action",
					sketchId: sketch.id
				});
			}
			sketch.status = "discarded";
			sketch.discardedAt = (/* @__PURE__ */ new Date()).toISOString();
			await kv.set(KV.sketches, sketch.id, sketch);
			await safeAudit(kv, "sketch_discard", "mem::sketch-discard", [sketch.id], { action: "discard.sketch" });
			return {
				success: true,
				discardedCount: sketch.actionIds.length
			};
		});
	});
	sdk.registerFunction("mem::sketch-list", async (data) => {
		let sketches = await kv.list(KV.sketches);
		if (data.status) sketches = sketches.filter((s) => s.status === data.status);
		if (data.project) sketches = sketches.filter((s) => s.project === data.project);
		sketches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return {
			success: true,
			sketches: sketches.map((s) => ({
				...s,
				actionCount: s.actionIds.length
			}))
		};
	});
	sdk.registerFunction("mem::sketch-gc", async () => {
		const sketches = await kv.list(KV.sketches);
		const now = Date.now();
		let collected = 0;
		for (const sketch of sketches) {
			if (sketch.status !== "active" || new Date(sketch.expiresAt).getTime() > now) continue;
			await withKeyedLock(`mem:sketch:${sketch.id}`, async () => {
				const current = await kv.get(KV.sketches, sketch.id);
				if (!current || current.status !== "active" || new Date(current.expiresAt).getTime() > now) return;
				const actionIdSet = new Set(current.actionIds);
				const allEdges = await kv.list(KV.actionEdges);
				for (const edge of allEdges) if (actionIdSet.has(edge.sourceActionId) || actionIdSet.has(edge.targetActionId)) {
					await kv.delete(KV.actionEdges, edge.id);
					await safeAudit(kv, "sketch_discard", "mem::sketch-gc", [edge.id], {
						action: "gc.edge",
						sketchId: current.id
					});
				}
				for (const actionId of current.actionIds) {
					await kv.delete(KV.actions, actionId);
					await safeAudit(kv, "sketch_discard", "mem::sketch-gc", [actionId], {
						action: "gc.action",
						sketchId: current.id
					});
				}
				current.status = "discarded";
				current.discardedAt = (/* @__PURE__ */ new Date()).toISOString();
				await kv.set(KV.sketches, current.id, current);
				await safeAudit(kv, "sketch_discard", "mem::sketch-gc", [current.id], { action: "gc.sketch" });
				collected++;
			});
		}
		return {
			success: true,
			collected
		};
	});
}

//#endregion
//#region src/functions/crystallize.ts
const CRYSTALLIZE_SYSTEM = `You are summarizing a completed chain of agent actions into a compact digest.
Extract: (1) what was accomplished in 1-2 sentences, (2) key decisions as bullet points,
(3) files affected, (4) any lessons or patterns worth remembering.
Return as JSON: { "narrative": "...", "keyOutcomes": ["..."], "filesAffected": ["..."], "lessons": ["..."] }`;
function registerCrystallizeFunction(sdk, kv, provider) {
	sdk.registerFunction("mem::crystallize", async (data) => {
		if (!data.actionIds || data.actionIds.length === 0) return {
			success: false,
			error: "actionIds is required"
		};
		const actions = [];
		for (const id of data.actionIds) {
			const action = await kv.get(KV.actions, id);
			if (!action) return {
				success: false,
				error: `action not found: ${id}`
			};
			if (action.status !== "done" && action.status !== "cancelled") return {
				success: false,
				error: `action ${id} has status "${action.status}", expected "done" or "cancelled"`
			};
			actions.push(action);
		}
		const allEdges = await kv.list(KV.actionEdges);
		const idSet = new Set(data.actionIds);
		const prompt = buildChainText(actions, allEdges.filter((e) => idSet.has(e.sourceActionId) || idSet.has(e.targetActionId)));
		try {
			const digest = parseDigest(await provider.summarize(CRYSTALLIZE_SYSTEM, prompt));
			const crystal = {
				id: generateId("crys"),
				narrative: digest.narrative,
				keyOutcomes: digest.keyOutcomes,
				filesAffected: digest.filesAffected,
				lessons: digest.lessons,
				sourceActionIds: data.actionIds,
				sessionId: data.sessionId,
				project: data.project,
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			await kv.set(KV.crystals, crystal.id, crystal);
			await Promise.all(digest.lessons.map((lesson) => sdk.trigger({
				function_id: "mem::lesson-save",
				payload: {
					content: lesson,
					context: crystal.narrative,
					confidence: .6,
					project: data.project,
					tags: [],
					source: "crystal",
					sourceIds: [crystal.id]
				}
			}).catch(() => {})));
			for (const action of actions) {
				const updated = {
					...action,
					crystallizedInto: crystal.id
				};
				await kv.set(KV.actions, action.id, updated);
			}
			return {
				success: true,
				crystal
			};
		} catch (err) {
			return {
				success: false,
				error: `crystallization failed: ${String(err)}`
			};
		}
	});
	sdk.registerFunction("mem::crystal-list", async (data) => {
		const limit = data.limit ?? 20;
		let crystals = await kv.list(KV.crystals);
		if (data.project) crystals = crystals.filter((c) => c.project === data.project);
		if (data.sessionId) crystals = crystals.filter((c) => c.sessionId === data.sessionId);
		crystals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
		return {
			success: true,
			crystals: crystals.slice(0, limit)
		};
	});
	sdk.registerFunction("mem::crystal-get", async (data) => {
		if (!data.crystalId) return {
			success: false,
			error: "crystalId is required"
		};
		const crystal = await kv.get(KV.crystals, data.crystalId);
		if (!crystal) return {
			success: false,
			error: "crystal not found"
		};
		return {
			success: true,
			crystal
		};
	});
	sdk.registerFunction("mem::auto-crystallize", async (data) => {
		const olderThanDays = data.olderThanDays ?? 7;
		const dryRun = data.dryRun ?? false;
		const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1e3;
		let allActions = await kv.list(KV.actions);
		allActions = allActions.filter((a) => a.status === "done" && !a.crystallizedInto && new Date(a.createdAt).getTime() < cutoff);
		if (data.project) allActions = allActions.filter((a) => a.project === data.project);
		if (allActions.length === 0) return {
			success: true,
			groupCount: 0,
			crystalIds: []
		};
		const groups = /* @__PURE__ */ new Map();
		for (const action of allActions) {
			const key = action.parentId ?? action.project ?? "_ungrouped";
			const group = groups.get(key);
			if (group) group.push(action);
			else groups.set(key, [action]);
		}
		if (dryRun) {
			const groupSummaries = Array.from(groups.entries()).map(([key, actions]) => ({
				groupKey: key,
				actionCount: actions.length,
				actionIds: actions.map((a) => a.id)
			}));
			return {
				success: true,
				dryRun: true,
				groupCount: groups.size,
				groups: groupSummaries,
				crystalIds: []
			};
		}
		const crystalIds = [];
		for (const [, groupActions] of groups) {
			const actionIds = groupActions.map((a) => a.id);
			const project = groupActions[0].project;
			try {
				const result = await sdk.trigger({
					function_id: "mem::crystallize",
					payload: {
						actionIds,
						project
					}
				});
				if (result.success && result.crystal) crystalIds.push(result.crystal.id);
			} catch {
				continue;
			}
		}
		return {
			success: true,
			groupCount: groups.size,
			crystalIds
		};
	});
}
function buildChainText(actions, edges) {
	const lines = ["## Completed Action Chain\n"];
	const sorted = [...actions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	for (const action of sorted) {
		lines.push(`### ${action.title}`);
		if (action.description) lines.push(action.description);
		if (action.result) lines.push(`Result: ${action.result}`);
		lines.push(`Tags: ${(action.tags ?? []).join(", ")}`);
		lines.push("");
	}
	if (edges.length > 0) {
		lines.push("## Dependencies");
		for (const edge of edges) lines.push(`- ${edge.sourceActionId} --${edge.type}--> ${edge.targetActionId}`);
	}
	return lines.join("\n");
}
function parseDigest(response) {
	try {
		const jsonMatch = response.match(/\{[\s\S]*\}/);
		if (!jsonMatch) return {
			narrative: response,
			keyOutcomes: [],
			filesAffected: [],
			lessons: []
		};
		const parsed = JSON.parse(jsonMatch[0]);
		return {
			narrative: typeof parsed.narrative === "string" ? parsed.narrative : response,
			keyOutcomes: Array.isArray(parsed.keyOutcomes) ? parsed.keyOutcomes : [],
			filesAffected: Array.isArray(parsed.filesAffected) ? parsed.filesAffected : [],
			lessons: Array.isArray(parsed.lessons) ? parsed.lessons : []
		};
	} catch {
		return {
			narrative: response,
			keyOutcomes: [],
			filesAffected: [],
			lessons: []
		};
	}
}

//#endregion
//#region src/functions/diagnostics.ts
const ALL_CATEGORIES = [
	"actions",
	"leases",
	"sentinels",
	"sketches",
	"signals",
	"sessions",
	"memories",
	"mesh"
];
const TWENTY_FOUR_HOURS_MS = 1440 * 60 * 1e3;
const ONE_HOUR_MS = 3600 * 1e3;
function registerDiagnosticsFunction(sdk, kv) {
	sdk.registerFunction("mem::diagnose", async (data) => {
		const categories = data.categories && data.categories.length > 0 ? data.categories.filter((c) => ALL_CATEGORIES.includes(c)) : ALL_CATEGORIES;
		const checks = [];
		const now = Date.now();
		if (categories.includes("actions")) {
			const actions = await kv.list(KV.actions);
			const allEdges = await kv.list(KV.actionEdges);
			const leases = await kv.list(KV.leases);
			const actionMap = new Map(actions.map((a) => [a.id, a]));
			for (const action of actions) {
				if (action.status === "active") {
					if (!leases.some((l) => l.actionId === action.id && l.status === "active" && new Date(l.expiresAt).getTime() > now)) checks.push({
						name: `active-no-lease:${action.id}`,
						category: "actions",
						status: "warn",
						message: `Action "${action.title}" is active but has no active lease`,
						fixable: false
					});
				}
				if (action.status === "blocked") {
					const deps = allEdges.filter((e) => e.sourceActionId === action.id && e.type === "requires");
					if (deps.length > 0) {
						if (deps.every((d) => {
							const target = actionMap.get(d.targetActionId);
							return target && target.status === "done";
						})) checks.push({
							name: `blocked-deps-done:${action.id}`,
							category: "actions",
							status: "fail",
							message: `Action "${action.title}" is blocked but all dependencies are done`,
							fixable: true
						});
					}
				}
				if (action.status === "pending") {
					const deps = allEdges.filter((e) => e.sourceActionId === action.id && e.type === "requires");
					if (deps.length > 0) {
						if (deps.some((d) => {
							const target = actionMap.get(d.targetActionId);
							return !target || target.status !== "done";
						})) checks.push({
							name: `pending-unsatisfied-deps:${action.id}`,
							category: "actions",
							status: "fail",
							message: `Action "${action.title}" is pending but has unsatisfied dependencies`,
							fixable: true
						});
					}
				}
			}
			if (!checks.some((c) => c.category === "actions" && c.status !== "pass")) checks.push({
				name: "actions-ok",
				category: "actions",
				status: "pass",
				message: `All ${actions.length} actions are consistent`,
				fixable: false
			});
		}
		if (categories.includes("leases")) {
			const leases = await kv.list(KV.leases);
			const actions = await kv.list(KV.actions);
			const actionIds = new Set(actions.map((a) => a.id));
			let leaseIssues = 0;
			for (const lease of leases) {
				if (lease.status === "active" && new Date(lease.expiresAt).getTime() <= now) {
					checks.push({
						name: `expired-lease:${lease.id}`,
						category: "leases",
						status: "fail",
						message: `Lease ${lease.id} for action ${lease.actionId} expired at ${lease.expiresAt}`,
						fixable: true
					});
					leaseIssues++;
				}
				if (!actionIds.has(lease.actionId)) {
					checks.push({
						name: `orphaned-lease:${lease.id}`,
						category: "leases",
						status: "fail",
						message: `Lease ${lease.id} references non-existent action ${lease.actionId}`,
						fixable: true
					});
					leaseIssues++;
				}
			}
			if (leaseIssues === 0) checks.push({
				name: "leases-ok",
				category: "leases",
				status: "pass",
				message: `All ${leases.length} leases are healthy`,
				fixable: false
			});
		}
		if (categories.includes("sentinels")) {
			const sentinels = await kv.list(KV.sentinels);
			const actions = await kv.list(KV.actions);
			const actionIds = new Set(actions.map((a) => a.id));
			let sentinelIssues = 0;
			for (const sentinel of sentinels) {
				if (sentinel.status === "watching" && sentinel.expiresAt && new Date(sentinel.expiresAt).getTime() <= now) {
					checks.push({
						name: `expired-sentinel:${sentinel.id}`,
						category: "sentinels",
						status: "fail",
						message: `Sentinel "${sentinel.name}" expired at ${sentinel.expiresAt}`,
						fixable: true
					});
					sentinelIssues++;
				}
				for (const actionId of sentinel.linkedActionIds) if (!actionIds.has(actionId)) {
					checks.push({
						name: `sentinel-missing-action:${sentinel.id}:${actionId}`,
						category: "sentinels",
						status: "warn",
						message: `Sentinel "${sentinel.name}" references non-existent action ${actionId}`,
						fixable: false
					});
					sentinelIssues++;
				}
			}
			if (sentinelIssues === 0) checks.push({
				name: "sentinels-ok",
				category: "sentinels",
				status: "pass",
				message: `All ${sentinels.length} sentinels are healthy`,
				fixable: false
			});
		}
		if (categories.includes("sketches")) {
			const sketches = await kv.list(KV.sketches);
			let sketchIssues = 0;
			for (const sketch of sketches) if (sketch.status === "active" && new Date(sketch.expiresAt).getTime() <= now) {
				checks.push({
					name: `expired-sketch:${sketch.id}`,
					category: "sketches",
					status: "fail",
					message: `Sketch "${sketch.title}" expired at ${sketch.expiresAt}`,
					fixable: true
				});
				sketchIssues++;
			}
			if (sketchIssues === 0) checks.push({
				name: "sketches-ok",
				category: "sketches",
				status: "pass",
				message: `All ${sketches.length} sketches are healthy`,
				fixable: false
			});
		}
		if (categories.includes("signals")) {
			const signals = await kv.list(KV.signals);
			let signalIssues = 0;
			for (const signal of signals) if (signal.expiresAt && new Date(signal.expiresAt).getTime() <= now) {
				checks.push({
					name: `expired-signal:${signal.id}`,
					category: "signals",
					status: "fail",
					message: `Signal from "${signal.from}" expired at ${signal.expiresAt}`,
					fixable: true
				});
				signalIssues++;
			}
			if (signalIssues === 0) checks.push({
				name: "signals-ok",
				category: "signals",
				status: "pass",
				message: `All ${signals.length} signals are healthy`,
				fixable: false
			});
		}
		if (categories.includes("sessions")) {
			const sessions = await kv.list(KV.sessions);
			let sessionIssues = 0;
			for (const session of sessions) if (session.status === "active" && now - new Date(session.startedAt).getTime() > TWENTY_FOUR_HOURS_MS) {
				checks.push({
					name: `abandoned-session:${session.id}`,
					category: "sessions",
					status: "warn",
					message: `Session ${session.id} has been active for over 24 hours`,
					fixable: false
				});
				sessionIssues++;
			}
			if (sessionIssues === 0) checks.push({
				name: "sessions-ok",
				category: "sessions",
				status: "pass",
				message: `All ${sessions.length} sessions are healthy`,
				fixable: false
			});
		}
		if (categories.includes("memories")) {
			const memories = await kv.list(KV.memories);
			const memoryIds = new Set(memories.map((m) => m.id));
			const supersededBy = /* @__PURE__ */ new Map();
			let memoryIssues = 0;
			for (const memory of memories) if (memory.supersedes && memory.supersedes.length > 0) for (const sid of memory.supersedes) {
				if (!memoryIds.has(sid)) {
					checks.push({
						name: `memory-missing-supersedes:${memory.id}:${sid}`,
						category: "memories",
						status: "warn",
						message: `Memory "${memory.title}" supersedes non-existent memory ${sid}`,
						fixable: false
					});
					memoryIssues++;
				}
				supersededBy.set(sid, memory.id);
			}
			for (const memory of memories) if (memory.isLatest && supersededBy.has(memory.id)) {
				checks.push({
					name: `memory-stale-latest:${memory.id}`,
					category: "memories",
					status: "fail",
					message: `Memory "${memory.title}" has isLatest=true but is superseded by ${supersededBy.get(memory.id)}`,
					fixable: true
				});
				memoryIssues++;
			}
			if (memoryIssues === 0) checks.push({
				name: "memories-ok",
				category: "memories",
				status: "pass",
				message: `All ${memories.length} memories are consistent`,
				fixable: false
			});
		}
		if (categories.includes("mesh")) {
			const peers = await kv.list(KV.mesh);
			let meshIssues = 0;
			for (const peer of peers) {
				if (peer.lastSyncAt && now - new Date(peer.lastSyncAt).getTime() > ONE_HOUR_MS) {
					checks.push({
						name: `stale-peer:${peer.id}`,
						category: "mesh",
						status: "warn",
						message: `Peer "${peer.name}" last synced over 1 hour ago`,
						fixable: false
					});
					meshIssues++;
				}
				if (peer.status === "error") {
					checks.push({
						name: `error-peer:${peer.id}`,
						category: "mesh",
						status: "warn",
						message: `Peer "${peer.name}" is in error state`,
						fixable: false
					});
					meshIssues++;
				}
			}
			if (meshIssues === 0) checks.push({
				name: "mesh-ok",
				category: "mesh",
				status: "pass",
				message: `All ${peers.length} mesh peers are healthy`,
				fixable: false
			});
		}
		return {
			success: true,
			checks,
			summary: {
				pass: checks.filter((c) => c.status === "pass").length,
				warn: checks.filter((c) => c.status === "warn").length,
				fail: checks.filter((c) => c.status === "fail").length,
				fixable: checks.filter((c) => c.fixable).length
			}
		};
	});
	sdk.registerFunction("mem::heal", async (data) => {
		const dryRun = data.dryRun ?? false;
		const categories = data.categories && data.categories.length > 0 ? data.categories.filter((c) => ALL_CATEGORIES.includes(c)) : ALL_CATEGORIES;
		let fixed = 0;
		let skipped = 0;
		const details = [];
		const now = Date.now();
		if (categories.includes("actions")) {
			const actions = await kv.list(KV.actions);
			const allEdges = await kv.list(KV.actionEdges);
			const actionMap = new Map(actions.map((a) => [a.id, a]));
			for (const action of actions) {
				if (action.status === "blocked") {
					const deps = allEdges.filter((e) => e.sourceActionId === action.id && e.type === "requires");
					if (deps.length > 0) {
						if (deps.every((d) => {
							const target = actionMap.get(d.targetActionId);
							return target && target.status === "done";
						})) {
							if (dryRun) {
								details.push(`[dry-run] Would unblock action "${action.title}" (${action.id})`);
								fixed++;
								continue;
							}
							if (await withKeyedLock(`mem:action:${action.id}`, async () => {
								const fresh = await kv.get(KV.actions, action.id);
								if (!fresh || fresh.status !== "blocked") return false;
								const freshDeps = (await kv.list(KV.actionEdges)).filter((e) => e.sourceActionId === fresh.id && e.type === "requires");
								const freshActions = await kv.list(KV.actions);
								const freshMap = new Map(freshActions.map((a) => [a.id, a]));
								if (!freshDeps.every((d) => {
									const target = freshMap.get(d.targetActionId);
									return target && target.status === "done";
								})) return false;
								fresh.status = "pending";
								fresh.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
								await kv.set(KV.actions, fresh.id, fresh);
								await recordAudit(kv, "heal", "mem::heal", [fresh.id], {
									reason: "blocked-deps-done",
									previousStatus: "blocked",
									newStatus: "pending"
								});
								return true;
							})) {
								details.push(`Unblocked action "${action.title}" (${action.id})`);
								fixed++;
							} else skipped++;
						}
					}
				}
				if (action.status === "pending") {
					const deps = allEdges.filter((e) => e.sourceActionId === action.id && e.type === "requires");
					if (deps.length > 0) {
						if (deps.some((d) => {
							const target = actionMap.get(d.targetActionId);
							return !target || target.status !== "done";
						})) {
							if (dryRun) {
								details.push(`[dry-run] Would block action "${action.title}" (${action.id})`);
								fixed++;
								continue;
							}
							if (await withKeyedLock(`mem:action:${action.id}`, async () => {
								const fresh = await kv.get(KV.actions, action.id);
								if (!fresh || fresh.status !== "pending") return false;
								const freshDeps = (await kv.list(KV.actionEdges)).filter((e) => e.sourceActionId === fresh.id && e.type === "requires");
								const freshActions = await kv.list(KV.actions);
								const freshMap = new Map(freshActions.map((a) => [a.id, a]));
								if (!freshDeps.some((d) => {
									const target = freshMap.get(d.targetActionId);
									return !target || target.status !== "done";
								})) return false;
								fresh.status = "blocked";
								fresh.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
								await kv.set(KV.actions, fresh.id, fresh);
								await recordAudit(kv, "heal", "mem::heal", [fresh.id], {
									reason: "pending-unsatisfied-deps",
									previousStatus: "pending",
									newStatus: "blocked"
								});
								return true;
							})) {
								details.push(`Blocked action "${action.title}" (${action.id})`);
								fixed++;
							} else skipped++;
						}
					}
				}
			}
		}
		if (categories.includes("leases")) {
			const leases = await kv.list(KV.leases);
			const actions = await kv.list(KV.actions);
			const actionIds = new Set(actions.map((a) => a.id));
			for (const lease of leases) {
				if (lease.status === "active" && new Date(lease.expiresAt).getTime() <= now) {
					if (dryRun) {
						details.push(`[dry-run] Would expire lease ${lease.id} for action ${lease.actionId}`);
						fixed++;
						continue;
					}
					if (await withKeyedLock(`mem:action:${lease.actionId}`, async () => {
						const fresh = await kv.get(KV.leases, lease.id);
						if (!fresh || fresh.status !== "active" || new Date(fresh.expiresAt).getTime() > Date.now()) return false;
						fresh.status = "expired";
						await kv.set(KV.leases, fresh.id, fresh);
						await recordAudit(kv, "heal", "mem::heal", [fresh.id], {
							entityType: "lease",
							reason: "expired-lease",
							newStatus: "expired"
						});
						const action = await kv.get(KV.actions, fresh.actionId);
						if (action && action.status === "active" && action.assignedTo === fresh.agentId) {
							action.status = "pending";
							action.assignedTo = void 0;
							action.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
							await kv.set(KV.actions, action.id, action);
							await recordAudit(kv, "heal", "mem::heal", [action.id], {
								entityType: "action",
								reason: "release-expired-lease",
								newStatus: "pending"
							});
						}
						return true;
					})) {
						details.push(`Expired lease ${lease.id} for action ${lease.actionId}`);
						fixed++;
					} else skipped++;
					continue;
				}
				if (!actionIds.has(lease.actionId)) {
					if (dryRun) {
						details.push(`[dry-run] Would delete orphaned lease ${lease.id}`);
						fixed++;
						continue;
					}
					await kv.delete(KV.leases, lease.id);
					await recordAudit(kv, "heal", "mem::heal", [lease.id], {
						entityType: "lease",
						reason: "orphaned-lease",
						action: "delete"
					});
					details.push(`Deleted orphaned lease ${lease.id}`);
					fixed++;
				}
			}
		}
		if (categories.includes("sentinels")) {
			const sentinels = await kv.list(KV.sentinels);
			for (const sentinel of sentinels) if (sentinel.status === "watching" && sentinel.expiresAt && new Date(sentinel.expiresAt).getTime() <= now) {
				if (dryRun) {
					details.push(`[dry-run] Would expire sentinel "${sentinel.name}" (${sentinel.id})`);
					fixed++;
					continue;
				}
				if (await withKeyedLock(`mem:sentinel:${sentinel.id}`, async () => {
					const fresh = await kv.get(KV.sentinels, sentinel.id);
					if (!fresh || fresh.status !== "watching") return false;
					if (!fresh.expiresAt || new Date(fresh.expiresAt).getTime() > Date.now()) return false;
					fresh.status = "expired";
					await kv.set(KV.sentinels, fresh.id, fresh);
					await recordAudit(kv, "heal", "mem::heal", [fresh.id], {
						entityType: "sentinel",
						reason: "expired-sentinel",
						newStatus: "expired"
					});
					return true;
				})) {
					details.push(`Expired sentinel "${sentinel.name}" (${sentinel.id})`);
					fixed++;
				} else skipped++;
			}
		}
		if (categories.includes("sketches")) {
			const sketches = await kv.list(KV.sketches);
			for (const sketch of sketches) if (sketch.status === "active" && new Date(sketch.expiresAt).getTime() <= now) {
				if (dryRun) {
					details.push(`[dry-run] Would discard expired sketch "${sketch.title}" (${sketch.id})`);
					fixed++;
					continue;
				}
				if (await withKeyedLock(`mem:sketch:${sketch.id}`, async () => {
					const fresh = await kv.get(KV.sketches, sketch.id);
					if (!fresh || fresh.status !== "active" || new Date(fresh.expiresAt).getTime() > Date.now()) return false;
					const allEdges = await kv.list(KV.actionEdges);
					const actionIdSet = new Set(fresh.actionIds);
					for (const edge of allEdges) if (actionIdSet.has(edge.sourceActionId) || actionIdSet.has(edge.targetActionId)) {
						await kv.delete(KV.actionEdges, edge.id);
						await recordAudit(kv, "heal", "mem::heal", [edge.id], {
							entityType: "actionEdge",
							reason: "sketch-gc-discard",
							action: "delete"
						});
					}
					for (const actionId of fresh.actionIds) {
						await kv.delete(KV.actions, actionId);
						await recordAudit(kv, "heal", "mem::heal", [actionId], {
							entityType: "action",
							reason: "sketch-gc-discard",
							action: "delete"
						});
					}
					fresh.status = "discarded";
					fresh.discardedAt = (/* @__PURE__ */ new Date()).toISOString();
					await kv.set(KV.sketches, fresh.id, fresh);
					await recordAudit(kv, "heal", "mem::heal", [fresh.id], {
						entityType: "sketch",
						reason: "expired-sketch",
						newStatus: "discarded"
					});
					return true;
				})) {
					details.push(`Discarded expired sketch "${sketch.title}" (${sketch.id})`);
					fixed++;
				} else skipped++;
			}
		}
		if (categories.includes("signals")) {
			const signals = await kv.list(KV.signals);
			for (const signal of signals) if (signal.expiresAt && new Date(signal.expiresAt).getTime() <= now) {
				if (dryRun) {
					details.push(`[dry-run] Would delete expired signal ${signal.id}`);
					fixed++;
					continue;
				}
				await kv.delete(KV.signals, signal.id);
				await recordAudit(kv, "heal", "mem::heal", [signal.id], {
					entityType: "signal",
					reason: "expired-signal",
					action: "delete"
				});
				details.push(`Deleted expired signal ${signal.id}`);
				fixed++;
			}
		}
		if (categories.includes("memories")) {
			const memories = await kv.list(KV.memories);
			const supersededBy = /* @__PURE__ */ new Map();
			for (const memory of memories) if (memory.supersedes && memory.supersedes.length > 0) for (const sid of memory.supersedes) supersededBy.set(sid, memory.id);
			for (const memory of memories) if (memory.isLatest && supersededBy.has(memory.id)) {
				if (dryRun) {
					details.push(`[dry-run] Would set isLatest=false on memory "${memory.title}" (${memory.id})`);
					fixed++;
					continue;
				}
				if (await withKeyedLock(`mem:memory:${memory.id}`, async () => {
					const fresh = await kv.get(KV.memories, memory.id);
					if (!fresh || !fresh.isLatest) return false;
					fresh.isLatest = false;
					fresh.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
					await kv.set(KV.memories, fresh.id, fresh);
					await recordAudit(kv, "heal", "mem::heal", [fresh.id], {
						entityType: "memory",
						reason: "superseded-memory-mark-non-latest",
						action: "update"
					});
					return true;
				})) {
					details.push(`Set isLatest=false on memory "${memory.title}" (${memory.id})`);
					fixed++;
				} else skipped++;
			}
		}
		return {
			success: true,
			fixed,
			skipped,
			details
		};
	});
}

//#endregion
//#region src/functions/facets.ts
function registerFacetsFunction(sdk, kv) {
	sdk.registerFunction("mem::facet-tag", async (data) => {
		if (!data.targetId || typeof data.targetId !== "string") return {
			success: false,
			error: "targetId is required"
		};
		const validTypes = [
			"action",
			"memory",
			"observation"
		];
		if (!validTypes.includes(data.targetType)) return {
			success: false,
			error: `targetType must be one of: ${validTypes.join(", ")}`
		};
		if (!data.dimension || typeof data.dimension !== "string" || data.dimension.trim() === "") return {
			success: false,
			error: "dimension is required"
		};
		if (!data.value || typeof data.value !== "string" || data.value.trim() === "") return {
			success: false,
			error: "value is required"
		};
		const dimension = data.dimension.trim();
		const value = data.value.trim();
		const duplicate = (await kv.list(KV.facets)).find((f) => f.targetId === data.targetId && f.dimension === dimension && f.value === value);
		if (duplicate) return {
			success: true,
			facet: duplicate,
			skipped: true
		};
		const facet = {
			id: generateId("fct"),
			targetId: data.targetId,
			targetType: data.targetType,
			dimension,
			value,
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		};
		await kv.set(KV.facets, facet.id, facet);
		return {
			success: true,
			facet
		};
	});
	sdk.registerFunction("mem::facet-untag", async (data) => {
		if (!data.targetId) return {
			success: false,
			error: "targetId is required"
		};
		if (!data.dimension) return {
			success: false,
			error: "dimension is required"
		};
		const matches = (await kv.list(KV.facets)).filter((f) => {
			if (f.targetId !== data.targetId || f.dimension !== data.dimension) return false;
			if (data.value !== void 0) return f.value === data.value;
			return true;
		});
		for (const f of matches) await kv.delete(KV.facets, f.id);
		return {
			success: true,
			removed: matches.length
		};
	});
	sdk.registerFunction("mem::facet-query", async (data) => {
		if ((!data.matchAll || data.matchAll.length === 0) && (!data.matchAny || data.matchAny.length === 0)) return {
			success: false,
			error: "at least one of matchAll or matchAny is required"
		};
		const all = await kv.list(KV.facets);
		const filtered = data.targetType ? all.filter((f) => f.targetType === data.targetType) : all;
		const targetFacetMap = /* @__PURE__ */ new Map();
		for (const f of filtered) {
			const key = `${f.dimension}:${f.value}`;
			let entry = targetFacetMap.get(f.targetId);
			if (!entry) {
				entry = {
					targetType: f.targetType,
					facetKeys: /* @__PURE__ */ new Set()
				};
				targetFacetMap.set(f.targetId, entry);
			}
			entry.facetKeys.add(key);
		}
		const results = [];
		for (const [targetId, entry] of targetFacetMap) {
			const matched = [];
			if (data.matchAll && data.matchAll.length > 0) {
				if (!data.matchAll.every((k) => entry.facetKeys.has(k))) continue;
				for (const k of data.matchAll) if (!matched.includes(k)) matched.push(k);
			}
			if (data.matchAny && data.matchAny.length > 0) {
				const anyPresent = data.matchAny.filter((k) => entry.facetKeys.has(k));
				if (anyPresent.length === 0) continue;
				for (const k of anyPresent) if (!matched.includes(k)) matched.push(k);
			}
			results.push({
				targetId,
				targetType: entry.targetType,
				matchedFacets: matched
			});
		}
		const limit = data.limit || 50;
		return {
			success: true,
			results: results.slice(0, limit)
		};
	});
	sdk.registerFunction("mem::facet-get", async (data) => {
		if (!data.targetId) return {
			success: false,
			error: "targetId is required"
		};
		const targetFacets = (await kv.list(KV.facets)).filter((f) => f.targetId === data.targetId);
		const dimMap = /* @__PURE__ */ new Map();
		for (const f of targetFacets) {
			let values = dimMap.get(f.dimension);
			if (!values) {
				values = [];
				dimMap.set(f.dimension, values);
			}
			values.push(f.value);
		}
		return {
			success: true,
			dimensions: Array.from(dimMap.entries()).map(([dimension, values]) => ({
				dimension,
				values
			}))
		};
	});
	sdk.registerFunction("mem::facet-stats", async (data) => {
		const all = await kv.list(KV.facets);
		const filtered = data.targetType ? all.filter((f) => f.targetType === data.targetType) : all;
		const dimMap = /* @__PURE__ */ new Map();
		for (const f of filtered) {
			let valueMap = dimMap.get(f.dimension);
			if (!valueMap) {
				valueMap = /* @__PURE__ */ new Map();
				dimMap.set(f.dimension, valueMap);
			}
			valueMap.set(f.value, (valueMap.get(f.value) || 0) + 1);
		}
		return {
			success: true,
			dimensions: Array.from(dimMap.entries()).map(([dimension, valueMap]) => ({
				dimension,
				values: Array.from(valueMap.entries()).map(([value, count]) => ({
					value,
					count
				}))
			})),
			totalFacets: filtered.length
		};
	});
	sdk.registerFunction("mem::facet-dimensions", async () => {
		const all = await kv.list(KV.facets);
		const counts = /* @__PURE__ */ new Map();
		for (const f of all) counts.set(f.dimension, (counts.get(f.dimension) || 0) + 1);
		return {
			success: true,
			dimensions: Array.from(counts.entries()).map(([dimension, count]) => ({
				dimension,
				count
			}))
		};
	});
}

//#endregion
//#region src/functions/verify.ts
function registerVerifyFunction(sdk, kv) {
	sdk.registerFunction("mem::verify", async (data) => {
		if (!data.id || typeof data.id !== "string") return {
			success: false,
			error: "id is required"
		};
		const memory = await kv.get(KV.memories, data.id);
		if (memory) {
			const observationIds = memory.sourceObservationIds || [];
			const observations = [];
			for (const obsId of observationIds) {
				const obs = await findObservation(kv, obsId, memory.sessionIds);
				if (obs) {
					const session = await kv.get(KV.sessions, obs.sessionId);
					observations.push({
						observation: obs,
						session: session || void 0
					});
				}
			}
			return {
				success: true,
				type: "memory",
				memory: {
					id: memory.id,
					title: memory.title,
					type: memory.type,
					version: memory.version,
					strength: memory.strength,
					isLatest: memory.isLatest,
					createdAt: memory.createdAt,
					updatedAt: memory.updatedAt,
					supersedes: memory.supersedes,
					parentId: memory.parentId
				},
				citations: observations.map((o) => ({
					observationId: o.observation.id,
					title: o.observation.title,
					type: o.observation.type,
					confidence: o.observation.confidence,
					timestamp: o.observation.timestamp,
					sessionId: o.observation.sessionId,
					sessionProject: o.session?.project,
					sessionStatus: o.session?.status
				})),
				citationCount: observations.length
			};
		}
		const obs = await findObservation(kv, data.id);
		if (obs) {
			const session = await kv.get(KV.sessions, obs.sessionId);
			return {
				success: true,
				type: "observation",
				observation: {
					id: obs.id,
					title: obs.title,
					type: obs.type,
					confidence: obs.confidence,
					importance: obs.importance,
					timestamp: obs.timestamp,
					sessionId: obs.sessionId
				},
				session: session ? {
					id: session.id,
					project: session.project,
					status: session.status,
					startedAt: session.startedAt
				} : null,
				citationCount: 0,
				citations: []
			};
		}
		return {
			success: false,
			error: "not found"
		};
	});
}
async function findObservation(kv, obsId, hintSessionIds) {
	if (hintSessionIds) for (const sid of hintSessionIds) {
		const obs = await kv.get(KV.observations(sid), obsId);
		if (obs) return obs;
	}
	const sessions = await kv.list(KV.sessions);
	for (const session of sessions) {
		if (hintSessionIds?.includes(session.id)) continue;
		const obs = await kv.get(KV.observations(session.id), obsId);
		if (obs) return obs;
	}
	return null;
}

//#endregion
//#region src/functions/cascade.ts
function registerCascadeFunction(sdk, kv) {
	sdk.registerFunction("mem::cascade-update", async (data) => {
		if (!data.supersededMemoryId || typeof data.supersededMemoryId !== "string") return {
			success: false,
			error: "supersededMemoryId is required"
		};
		const superseded = await kv.get(KV.memories, data.supersededMemoryId);
		if (!superseded) return {
			success: false,
			error: "superseded memory not found"
		};
		let flaggedNodes = 0;
		let flaggedEdges = 0;
		let flaggedMemories = 0;
		const obsIds = new Set(superseded.sourceObservationIds || []);
		if (obsIds.size > 0) {
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const nodes = await kv.list(KV.graphNodes);
			for (const node of nodes) {
				if (node.stale) continue;
				if ((node.sourceObservationIds ?? []).some((id) => obsIds.has(id))) {
					node.stale = true;
					node.updatedAt = now;
					await kv.set(KV.graphNodes, node.id, node);
					await recordAudit(kv, "consolidate", "mem::cascade-update", [node.id], {
						resourceType: "GraphNode",
						change: "marked stale from superseded memory",
						supersededMemoryId: data.supersededMemoryId
					});
					flaggedNodes++;
				}
			}
			const edges = await kv.list(KV.graphEdges);
			for (const edge of edges) {
				if (edge.stale) continue;
				if ((edge.sourceObservationIds ?? []).some((id) => obsIds.has(id))) {
					edge.stale = true;
					await kv.set(KV.graphEdges, edge.id, edge);
					await recordAudit(kv, "consolidate", "mem::cascade-update", [edge.id], {
						resourceType: "GraphEdge",
						change: "marked stale from superseded memory",
						supersededMemoryId: data.supersededMemoryId
					});
					flaggedEdges++;
				}
			}
		}
		const supersededConcepts = new Set((superseded.concepts ?? []).map((c) => c.toLowerCase()));
		if (supersededConcepts.size >= 2) {
			const allMemories = await kv.list(KV.memories);
			for (const mem of allMemories) {
				if (mem.id === data.supersededMemoryId) continue;
				if (!mem.isLatest) continue;
				if ((mem.concepts ?? []).filter((c) => supersededConcepts.has(c.toLowerCase())).length >= 2) flaggedMemories++;
			}
		}
		return {
			success: true,
			flagged: {
				nodes: flaggedNodes,
				edges: flaggedEdges,
				siblingMemories: flaggedMemories
			},
			total: flaggedNodes + flaggedEdges + flaggedMemories
		};
	});
}

//#endregion
//#region src/functions/lessons.ts
function reinforceLesson(lesson) {
	const now = (/* @__PURE__ */ new Date()).toISOString();
	lesson.reinforcements++;
	lesson.confidence = Math.min(1, lesson.confidence + .1 * (1 - lesson.confidence));
	lesson.lastReinforcedAt = now;
	lesson.updatedAt = now;
}
function registerLessonsFunctions(sdk, kv) {
	sdk.registerFunction("mem::lesson-save", async (data) => {
		if (!data.content?.trim()) return {
			success: false,
			error: "content is required"
		};
		const fp = fingerprintId("lsn", data.content.trim().toLowerCase());
		const existing = await kv.get(KV.lessons, fp);
		if (existing && !existing.deleted) {
			reinforceLesson(existing);
			if (data.context && !existing.context) existing.context = data.context;
			await kv.set(KV.lessons, existing.id, existing);
			try {
				await recordAudit(kv, "lesson_strengthen", "mem::lesson-save", [existing.id]);
			} catch {}
			return {
				success: true,
				action: "strengthened",
				lesson: existing
			};
		}
		const confidence = typeof data.confidence === "number" && data.confidence >= 0 && data.confidence <= 1 ? data.confidence : .5;
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const lesson = {
			id: fp,
			content: data.content.trim(),
			context: data.context?.trim() || "",
			confidence,
			reinforcements: 0,
			source: data.source || "manual",
			sourceIds: data.sourceIds || [],
			project: data.project,
			tags: data.tags || [],
			createdAt: now,
			updatedAt: now,
			decayRate: .05
		};
		await kv.set(KV.lessons, lesson.id, lesson);
		try {
			await recordAudit(kv, "lesson_save", "mem::lesson-save", [lesson.id]);
		} catch {}
		return {
			success: true,
			action: "created",
			lesson
		};
	});
	sdk.registerFunction("mem::lesson-recall", async (data) => {
		if (!data.query?.trim()) return {
			success: false,
			error: "query is required"
		};
		const query = data.query.toLowerCase();
		const minConfidence = data.minConfidence ?? .1;
		const limit = data.limit ?? 10;
		let lessons = await kv.list(KV.lessons);
		lessons = lessons.filter((l) => !l.deleted && l.confidence >= minConfidence);
		if (data.project) lessons = lessons.filter((l) => l.project === data.project);
		const scored = lessons.map((l) => {
			const text = `${l.content} ${l.context} ${l.tags.join(" ")}`.toLowerCase();
			const terms = query.split(/\s+/).filter((t) => t.length > 1);
			const matchCount = terms.filter((t) => text.includes(t)).length;
			if (matchCount === 0) return null;
			const relevance = matchCount / terms.length;
			const recencyBoost = 1 / (1 + (l.lastReinforcedAt ? (Date.now() - new Date(l.lastReinforcedAt).getTime()) / (1e3 * 60 * 60 * 24) : (Date.now() - new Date(l.createdAt).getTime()) / (1e3 * 60 * 60 * 24)) * .01);
			return {
				lesson: l,
				score: l.confidence * relevance * recencyBoost
			};
		}).filter(Boolean);
		scored.sort((a, b) => b.score - a.score);
		try {
			await recordAudit(kv, "lesson_recall", "mem::lesson-recall", [], {
				query: data.query,
				resultCount: scored.length
			});
		} catch {}
		return {
			success: true,
			lessons: scored.slice(0, limit).map((s) => ({
				...s.lesson,
				score: Math.round(s.score * 1e3) / 1e3
			}))
		};
	});
	sdk.registerFunction("mem::lesson-list", async (data) => {
		const limit = data.limit ?? 50;
		const minConfidence = data.minConfidence ?? 0;
		let lessons = await kv.list(KV.lessons);
		lessons = lessons.filter((l) => !l.deleted && l.confidence >= minConfidence);
		if (data.project) lessons = lessons.filter((l) => l.project === data.project);
		if (data.source) lessons = lessons.filter((l) => l.source === data.source);
		lessons.sort((a, b) => b.confidence - a.confidence);
		return {
			success: true,
			lessons: lessons.slice(0, limit)
		};
	});
	sdk.registerFunction("mem::lesson-strengthen", async (data) => {
		if (!data.lessonId) return {
			success: false,
			error: "lessonId is required"
		};
		const lesson = await kv.get(KV.lessons, data.lessonId);
		if (!lesson || lesson.deleted) return {
			success: false,
			error: "lesson not found"
		};
		reinforceLesson(lesson);
		await kv.set(KV.lessons, lesson.id, lesson);
		try {
			await recordAudit(kv, "lesson_strengthen", "mem::lesson-strengthen", [lesson.id]);
		} catch {}
		return {
			success: true,
			lesson
		};
	});
	sdk.registerFunction("mem::lesson-decay-sweep", async () => {
		const lessons = await kv.list(KV.lessons);
		let decayed = 0;
		let softDeleted = 0;
		const now = Date.now();
		const timestamp = (/* @__PURE__ */ new Date()).toISOString();
		const dirty = [];
		const auditEvents = [];
		for (const lesson of lessons) {
			if (lesson.deleted) continue;
			const baseline = lesson.lastDecayedAt || lesson.lastReinforcedAt || lesson.createdAt;
			const weeksSinceBaseline = (now - new Date(baseline).getTime()) / (1e3 * 60 * 60 * 24 * 7);
			if (weeksSinceBaseline < 1) continue;
			const decay = lesson.decayRate * weeksSinceBaseline;
			const newConfidence = Math.max(.05, lesson.confidence - decay);
			if (newConfidence !== lesson.confidence) {
				const beforeConfidence = lesson.confidence;
				const beforeDeleted = !!lesson.deleted;
				lesson.confidence = Math.round(newConfidence * 1e3) / 1e3;
				lesson.lastDecayedAt = timestamp;
				lesson.updatedAt = timestamp;
				if (lesson.confidence <= .1 && lesson.reinforcements === 0) {
					lesson.deleted = true;
					softDeleted++;
				} else decayed++;
				dirty.push(lesson);
				auditEvents.push({
					id: lesson.id,
					action: lesson.deleted ? "soft-delete" : "decay",
					beforeConfidence,
					afterConfidence: lesson.confidence,
					beforeDeleted,
					afterDeleted: !!lesson.deleted
				});
			}
		}
		await Promise.all(dirty.map((l) => kv.set(KV.lessons, l.id, l)));
		await Promise.all(auditEvents.map((event) => recordAudit(kv, "lesson_strengthen", "mem::lesson-decay-sweep", [event.id], {
			action: event.action,
			actor: "system",
			reason: "decay-sweep",
			before: {
				confidence: event.beforeConfidence,
				deleted: event.beforeDeleted
			},
			after: {
				confidence: event.afterConfidence,
				deleted: event.afterDeleted
			}
		})));
		return {
			success: true,
			decayed,
			softDeleted,
			total: lessons.length
		};
	});
}

//#endregion
//#region src/functions/obsidian-export.ts
const DEFAULT_EXPORT_ROOT = join(homedir(), ".agentmemory");
function getExportRoot() {
	return resolve(process.env["AGENTMEMORY_EXPORT_ROOT"] || DEFAULT_EXPORT_ROOT);
}
function resolveVaultDir(vaultDir) {
	const root = getExportRoot();
	const resolved = resolve(vaultDir || join(root, "vault"));
	if (resolved === root || resolved.startsWith(root + sep)) return resolved;
	return null;
}
function sanitize(name) {
	return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 100);
}
function toFrontmatter(obj) {
	const lines = ["---"];
	for (const [key, value] of Object.entries(obj)) {
		if (value === void 0 || value === null) continue;
		if (Array.isArray(value)) lines.push(`${key}: [${value.map((v) => JSON.stringify(String(v))).join(", ")}]`);
		else lines.push(`${key}: ${JSON.stringify(value)}`);
	}
	lines.push("---");
	return lines.join("\n");
}
function memoryToMd(m) {
	const fm = toFrontmatter({
		id: m.id,
		type: m.type,
		created: m.createdAt,
		updated: m.updatedAt,
		strength: m.strength,
		version: m.version,
		concepts: m.concepts,
		files: m.files
	});
	const related = (m.relatedIds || []).map((id) => `- [[${id}]]`).join("\n");
	const supersedes = (m.supersedes || []).map((id) => `- [[${id}]] (superseded)`).join("\n");
	const sections = [
		fm,
		"",
		`# ${m.title}`,
		"",
		m.content
	];
	if (m.concepts.length > 0) sections.push("", "## Concepts", m.concepts.map((c) => `#${c.replace(/\s+/g, "-")}`).join(" "));
	if (related) sections.push("", "## Related", related);
	if (supersedes) sections.push("", "## Supersedes", supersedes);
	return sections.join("\n");
}
function lessonToMd(l) {
	const fm = toFrontmatter({
		id: l.id,
		type: "lesson",
		source: l.source,
		confidence: l.confidence,
		reinforcements: l.reinforcements,
		created: l.createdAt,
		updated: l.updatedAt,
		project: l.project,
		tags: l.tags,
		decayRate: l.decayRate
	});
	const sourceLinks = l.sourceIds.map((id) => `- [[${id}]]`).join("\n");
	const sections = [
		fm,
		"",
		`# Lesson: ${l.content.slice(0, 80)}`,
		"",
		l.content
	];
	if (l.context) sections.push("", "## Context", l.context);
	if (l.tags.length > 0) sections.push("", "## Tags", l.tags.map((t) => `#${t.replace(/\s+/g, "-")}`).join(" "));
	if (sourceLinks) sections.push("", "## Sources", sourceLinks);
	return sections.join("\n");
}
function crystalToMd(c) {
	const fm = toFrontmatter({
		id: c.id,
		type: "crystal",
		created: c.createdAt,
		project: c.project,
		sessionId: c.sessionId,
		filesAffected: c.filesAffected
	});
	const actionLinks = c.sourceActionIds.map((id) => `- [[${id}]]`).join("\n");
	const sections = [
		fm,
		"",
		`# Crystal: ${c.narrative.slice(0, 80)}`,
		"",
		c.narrative,
		"",
		"## Key Outcomes",
		...c.keyOutcomes.map((o) => `- ${o}`)
	];
	if (c.lessons.length > 0) sections.push("", "## Lessons", ...c.lessons.map((l) => `- ${l}`));
	if (c.filesAffected.length > 0) sections.push("", "## Files", ...c.filesAffected.map((f) => `- \`${f}\``));
	if (actionLinks) sections.push("", "## Source Actions", actionLinks);
	return sections.join("\n");
}
function sessionToMd(s) {
	return [
		toFrontmatter({
			id: s.id,
			type: "session",
			project: s.project,
			status: s.status,
			started: s.startedAt,
			ended: s.endedAt,
			observations: s.observationCount
		}),
		"",
		`# Session: ${s.project}`,
		"",
		`**Status:** ${s.status}`,
		`**Started:** ${s.startedAt}`,
		s.endedAt ? `**Ended:** ${s.endedAt}` : "",
		`**Observations:** ${s.observationCount}`,
		`**CWD:** \`${s.cwd}\``
	].filter(Boolean).join("\n");
}
function registerObsidianExportFunction(sdk, kv) {
	sdk.registerFunction("mem::obsidian-export", async (data) => {
		if (!data || typeof data !== "object") return {
			success: false,
			error: "payload is required"
		};
		if (data.vaultDir !== void 0 && typeof data.vaultDir !== "string") return {
			success: false,
			error: "vaultDir must be a string"
		};
		if (data.types !== void 0) {
			if (!Array.isArray(data.types) || !data.types.every((t) => typeof t === "string")) return {
				success: false,
				error: "types must be an array of strings"
			};
		}
		const vaultDir = resolveVaultDir(data.vaultDir);
		if (!vaultDir) return {
			success: false,
			error: `vaultDir must be inside ${getExportRoot()}`
		};
		const exportTypes = new Set(data.types ?? [
			"memories",
			"lessons",
			"crystals",
			"sessions"
		]);
		const dirs = {
			memories: join(vaultDir, "memories"),
			lessons: join(vaultDir, "lessons"),
			crystals: join(vaultDir, "crystals"),
			sessions: join(vaultDir, "sessions")
		};
		await Promise.all(Object.values(dirs).map((dir) => mkdir(dir, { recursive: true })));
		const stats = {
			memories: 0,
			lessons: 0,
			crystals: 0,
			sessions: 0
		};
		const errors = [];
		const memoryMoc = [];
		const lessonMoc = [];
		const crystalMoc = [];
		const sessionMoc = [];
		const [memories, lessons, crystals, sessions] = await Promise.all([
			exportTypes.has("memories") ? kv.list(KV.memories) : Promise.resolve([]),
			exportTypes.has("lessons") ? kv.list(KV.lessons) : Promise.resolve([]),
			exportTypes.has("crystals") ? kv.list(KV.crystals) : Promise.resolve([]),
			exportTypes.has("sessions") ? kv.list(KV.sessions) : Promise.resolve([])
		]);
		for (const m of memories.filter((m) => m.isLatest)) {
			const filename = `${sanitize(m.id)}.md`;
			const filepath = join(dirs.memories, filename);
			try {
				await writeFile(filepath, memoryToMd(m));
				stats.memories++;
				memoryMoc.push(`- [[memories/${sanitize(m.id)}|${m.title}]] (${m.type}, strength: ${m.strength})`);
			} catch (err) {
				errors.push({
					id: m.id,
					path: filepath,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
		for (const l of lessons.filter((l) => !l.deleted)) {
			const filename = `${sanitize(l.id)}.md`;
			const filepath = join(dirs.lessons, filename);
			try {
				await writeFile(filepath, lessonToMd(l));
				stats.lessons++;
				lessonMoc.push(`- [[lessons/${sanitize(l.id)}|${l.content.slice(0, 60)}]] (confidence: ${l.confidence})`);
			} catch (err) {
				errors.push({
					id: l.id,
					path: filepath,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
		for (const c of crystals) {
			const filename = `${sanitize(c.id)}.md`;
			const filepath = join(dirs.crystals, filename);
			try {
				await writeFile(filepath, crystalToMd(c));
				stats.crystals++;
				crystalMoc.push(`- [[crystals/${sanitize(c.id)}|${c.narrative.slice(0, 60)}]]`);
			} catch (err) {
				errors.push({
					id: c.id,
					path: filepath,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
		const recent = sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 50);
		for (const s of recent) {
			const filename = `${sanitize(s.id)}.md`;
			const filepath = join(dirs.sessions, filename);
			try {
				await writeFile(filepath, sessionToMd(s));
				stats.sessions++;
				sessionMoc.push(`- [[sessions/${sanitize(s.id)}|${s.project} (${s.status})]]`);
			} catch (err) {
				errors.push({
					id: s.id,
					path: filepath,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
		const exportedAt = (/* @__PURE__ */ new Date()).toISOString();
		const moc = [
			"---",
			"type: moc",
			`exported: ${exportedAt}`,
			"---",
			"",
			"# agentmemory vault",
			"",
			`Exported: ${exportedAt}`,
			"",
			`## Memories (${stats.memories})`,
			...memoryMoc,
			"",
			`## Lessons (${stats.lessons})`,
			...lessonMoc,
			"",
			`## Crystals (${stats.crystals})`,
			...crystalMoc,
			"",
			`## Sessions (${stats.sessions})`,
			...sessionMoc
		].join("\n");
		await writeFile(join(vaultDir, "MOC.md"), moc);
		await recordAudit(kv, "obsidian_export", "mem::obsidian-export", [], {
			vaultDir,
			stats
		});
		return {
			success: true,
			exported: stats,
			errors: errors.length > 0 ? errors : void 0,
			vaultDir
		};
	});
}

//#endregion
//#region src/prompts/reflect.ts
const REFLECT_SYSTEM = `You are a higher-order reasoning engine. Given a cluster of related concepts, facts, lessons, and action outcomes, synthesize cross-cutting insights that span multiple individual memories.

Output format (XML):
<insights>
  <insight confidence="0.0-1.0" title="Short descriptive title">
    The higher-order observation or principle. Should be actionable and non-obvious — something that only becomes visible when viewing multiple memories together.
  </insight>
</insights>

Rules:
- Identify patterns, principles, or strategies that span 2+ source items
- Confidence reflects how well-supported the insight is across sources
- Title should be a concise label (under 60 chars)
- Content should be the actual observation (1-3 sentences)
- Prefer actionable insights over abstract summaries
- Skip insights that merely restate a single source item
- Always emit confidence attribute before title attribute`;
function buildReflectPrompt(cluster) {
	const sections = [];
	sections.push(`## Concept Cluster: ${cluster.concepts.join(", ")}`);
	if (cluster.facts.length > 0) sections.push("\n## Known Facts", ...cluster.facts.map((f) => `- [confidence=${f.confidence}] ${f.fact}`));
	if (cluster.lessons.length > 0) sections.push("\n## Lessons Learned", ...cluster.lessons.map((l) => `- [confidence=${l.confidence}] ${l.content}`));
	if (cluster.crystalNarratives.length > 0) sections.push("\n## Completed Work Summaries", ...cluster.crystalNarratives.map((n) => `- ${n}`));
	return `Synthesize higher-order insights from this cluster of related memories:\n\n${sections.join("\n")}`;
}

//#endregion
//#region src/functions/reflect.ts
function reinforceInsight(insight) {
	const now = (/* @__PURE__ */ new Date()).toISOString();
	insight.reinforcements++;
	insight.confidence = Math.min(1, insight.confidence + .1 * (1 - insight.confidence));
	insight.lastReinforcedAt = now;
	insight.updatedAt = now;
}
function buildGraphClusters(nodes, edges, maxClusters) {
	const conceptNodes = nodes.filter((n) => n.type === "concept" && !n.stale);
	if (conceptNodes.length === 0) return [];
	const edgeMap = /* @__PURE__ */ new Map();
	for (const edge of edges) {
		if (edge.stale) continue;
		if (!edgeMap.has(edge.sourceNodeId)) edgeMap.set(edge.sourceNodeId, /* @__PURE__ */ new Set());
		if (!edgeMap.has(edge.targetNodeId)) edgeMap.set(edge.targetNodeId, /* @__PURE__ */ new Set());
		edgeMap.get(edge.sourceNodeId).add(edge.targetNodeId);
		edgeMap.get(edge.targetNodeId).add(edge.sourceNodeId);
	}
	const degree = /* @__PURE__ */ new Map();
	for (const node of conceptNodes) degree.set(node.id, edgeMap.get(node.id)?.size || 0);
	const sorted = [...conceptNodes].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0));
	const visited = /* @__PURE__ */ new Set();
	const clusters = [];
	const conceptNodeIds = new Set(conceptNodes.map((n) => n.id));
	for (const seed of sorted) {
		if (visited.has(seed.id) || clusters.length >= maxClusters) break;
		const cluster = [];
		const queue = [seed.id];
		const seen = /* @__PURE__ */ new Set();
		let depth = 0;
		while (queue.length > 0 && depth <= 2) {
			const levelCount = queue.length;
			for (let i = 0; i < levelCount; i++) {
				const current = queue.shift();
				if (seen.has(current)) continue;
				seen.add(current);
				if (conceptNodeIds.has(current)) {
					const node = conceptNodes.find((n) => n.id === current);
					if (node) cluster.push(node.name);
					visited.add(current);
				}
				const neighbors = edgeMap.get(current) || /* @__PURE__ */ new Set();
				for (const neighbor of neighbors) if (!seen.has(neighbor)) queue.push(neighbor);
			}
			depth++;
		}
		if (cluster.length >= 2) clusters.push(cluster);
	}
	return clusters;
}
function buildJaccardClusters(semanticMemories, lessons, maxClusters) {
	const allConcepts = /* @__PURE__ */ new Map();
	for (const sem of semanticMemories) {
		const terms = sem.fact.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
		for (const term of terms) {
			if (!allConcepts.has(term)) allConcepts.set(term, /* @__PURE__ */ new Set());
			allConcepts.get(term).add(sem.id);
		}
	}
	for (const lesson of lessons) for (const tag of lesson.tags) {
		const key = tag.toLowerCase();
		if (!allConcepts.has(key)) allConcepts.set(key, /* @__PURE__ */ new Set());
		allConcepts.get(key).add(lesson.id);
	}
	const conceptList = [...allConcepts.keys()].filter((k) => (allConcepts.get(k)?.size || 0) >= 2);
	const visited = /* @__PURE__ */ new Set();
	const clusters = [];
	for (const concept of conceptList) {
		if (visited.has(concept) || clusters.length >= maxClusters) break;
		const cluster = [concept];
		visited.add(concept);
		const docsA = allConcepts.get(concept) || /* @__PURE__ */ new Set();
		for (const other of conceptList) {
			if (visited.has(other)) continue;
			const docsB = allConcepts.get(other) || /* @__PURE__ */ new Set();
			let intersection = 0;
			for (const d of docsA) if (docsB.has(d)) intersection++;
			const union = docsA.size + docsB.size - intersection;
			if ((union > 0 ? intersection / union : 0) > .3) {
				cluster.push(other);
				visited.add(other);
			}
		}
		if (cluster.length >= 2) clusters.push(cluster);
	}
	return clusters;
}
function registerReflectFunctions(sdk, kv, provider) {
	sdk.registerFunction("mem::reflect", async (data) => {
		const maxClusters = Math.min(data?.maxClusters ?? 10, 20);
		const maxInsightsPerCluster = 5;
		const maxTotal = 50;
		const [graphNodes, graphEdges, semanticMemories, lessons, crystals] = await Promise.all([
			kv.list(KV.graphNodes).catch(() => []),
			kv.list(KV.graphEdges).catch(() => []),
			kv.list(KV.semantic).catch(() => []),
			kv.list(KV.lessons).catch(() => []),
			kv.list(KV.crystals).catch(() => [])
		]);
		let activeLessons = lessons.filter((l) => !l.deleted);
		if (data?.project) activeLessons = activeLessons.filter((l) => l.project === data.project);
		let conceptClusters = buildGraphClusters(graphNodes, graphEdges, maxClusters);
		const usedFallback = conceptClusters.length === 0;
		if (usedFallback) conceptClusters = buildJaccardClusters(semanticMemories, activeLessons, maxClusters);
		let newInsights = 0;
		let reinforced = 0;
		let clustersSkipped = 0;
		let totalInsights = 0;
		for (const conceptNames of conceptClusters) {
			if (totalInsights >= maxTotal) break;
			const conceptSet = new Set(conceptNames.map((c) => c.toLowerCase()));
			const clusterFacts = semanticMemories.filter((s) => {
				return s.fact.toLowerCase().split(/\s+/).some((t) => conceptSet.has(t));
			});
			const clusterLessons = activeLessons.filter((l) => l.tags.some((t) => conceptSet.has(t.toLowerCase())) || conceptNames.some((c) => l.content.toLowerCase().includes(c.toLowerCase())));
			const clusterCrystals = crystals.filter((c) => (c.lessons || []).some((l) => conceptNames.some((cn) => l.toLowerCase().includes(cn.toLowerCase()))));
			if (clusterFacts.length + clusterLessons.length + clusterCrystals.length < 3) {
				clustersSkipped++;
				continue;
			}
			const cluster = {
				concepts: conceptNames,
				facts: clusterFacts.map((f) => ({
					fact: f.fact,
					confidence: f.confidence
				})),
				lessons: clusterLessons.map((l) => ({
					content: l.content,
					confidence: l.confidence
				})),
				crystalNarratives: clusterCrystals.map((c) => c.narrative),
				factIds: clusterFacts.map((f) => f.id),
				lessonIds: clusterLessons.map((l) => l.id),
				crystalIds: clusterCrystals.map((c) => c.id)
			};
			try {
				const prompt = buildReflectPrompt(cluster);
				const response = await provider.summarize(REFLECT_SYSTEM, prompt);
				const insightRegex = /<insight\s+confidence="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/insight>/g;
				let match;
				let clusterCount = 0;
				while ((match = insightRegex.exec(response)) !== null && clusterCount < maxInsightsPerCluster && totalInsights < maxTotal) {
					const parsedConf = parseFloat(match[1]);
					const confidence = Number.isNaN(parsedConf) ? .5 : Math.max(0, Math.min(1, parsedConf));
					const title = match[2].trim();
					const content = match[3].trim();
					if (!content) continue;
					const fp = fingerprintId("ins", content.trim().toLowerCase());
					const existing = await kv.get(KV.insights, fp);
					if (existing && !existing.deleted) {
						reinforceInsight(existing);
						await kv.set(KV.insights, existing.id, existing);
						reinforced++;
					} else {
						const now = (/* @__PURE__ */ new Date()).toISOString();
						const insight = {
							id: fp,
							title,
							content,
							confidence,
							reinforcements: 0,
							sourceConceptCluster: conceptNames,
							sourceMemoryIds: cluster.factIds,
							sourceLessonIds: cluster.lessonIds,
							sourceCrystalIds: cluster.crystalIds,
							project: data?.project,
							tags: conceptNames,
							createdAt: now,
							updatedAt: now,
							decayRate: .05
						};
						await kv.set(KV.insights, insight.id, insight);
						newInsights++;
					}
					clusterCount++;
					totalInsights++;
				}
			} catch {
				continue;
			}
		}
		try {
			await recordAudit(kv, "reflect", "mem::reflect", [], {
				newInsights,
				reinforced,
				clustersProcessed: conceptClusters.length - clustersSkipped,
				clustersSkipped,
				usedFallback
			});
		} catch {}
		return {
			success: true,
			newInsights,
			reinforced,
			clustersProcessed: conceptClusters.length - clustersSkipped,
			clustersSkipped,
			usedFallback
		};
	});
	sdk.registerFunction("mem::insight-list", async (data) => {
		const limit = data?.limit ?? 50;
		const minConfidence = data?.minConfidence ?? 0;
		let items = await kv.list(KV.insights);
		items = items.filter((i) => !i.deleted && i.confidence >= minConfidence);
		if (data?.project) items = items.filter((i) => i.project === data.project);
		items.sort((a, b) => b.confidence - a.confidence);
		return {
			success: true,
			insights: items.slice(0, limit)
		};
	});
	sdk.registerFunction("mem::insight-search", async (data) => {
		if (!data?.query?.trim()) return {
			success: false,
			error: "query is required"
		};
		const query = data.query.toLowerCase();
		const minConfidence = data.minConfidence ?? .1;
		const limit = data.limit ?? 10;
		let items = await kv.list(KV.insights);
		items = items.filter((i) => !i.deleted && i.confidence >= minConfidence);
		if (data.project) items = items.filter((i) => i.project === data.project);
		const terms = query.split(/\s+/).filter((t) => t.length > 1);
		const scored = items.map((i) => {
			const text = `${i.title} ${i.content} ${i.tags.join(" ")}`.toLowerCase();
			const matchCount = terms.filter((t) => text.includes(t)).length;
			if (matchCount === 0) return null;
			const relevance = matchCount / terms.length;
			const recencyBoost = 1 / (1 + (i.lastReinforcedAt ? (Date.now() - new Date(i.lastReinforcedAt).getTime()) / (1e3 * 60 * 60 * 24) : (Date.now() - new Date(i.createdAt).getTime()) / (1e3 * 60 * 60 * 24)) * .01);
			return {
				insight: i,
				score: i.confidence * relevance * recencyBoost
			};
		}).filter(Boolean);
		scored.sort((a, b) => b.score - a.score);
		try {
			await recordAudit(kv, "insight_search", "mem::insight-search", [], {
				query: data.query,
				resultCount: scored.length
			});
		} catch {}
		return {
			success: true,
			insights: scored.slice(0, limit).map((s) => ({
				...s.insight,
				score: Math.round(s.score * 1e3) / 1e3
			}))
		};
	});
	sdk.registerFunction("mem::insight-decay-sweep", async () => {
		const items = await kv.list(KV.insights);
		let decayed = 0;
		let softDeleted = 0;
		const now = Date.now();
		const timestamp = (/* @__PURE__ */ new Date()).toISOString();
		const dirty = [];
		for (const insight of items) {
			if (insight.deleted) continue;
			const baseline = insight.lastDecayedAt || insight.lastReinforcedAt || insight.createdAt;
			const weeksSince = (now - new Date(baseline).getTime()) / (1e3 * 60 * 60 * 24 * 7);
			if (weeksSince < 1) continue;
			const decay = insight.decayRate * weeksSince;
			const newConfidence = Math.max(.05, insight.confidence - decay);
			if (newConfidence !== insight.confidence) {
				insight.confidence = Math.round(newConfidence * 1e3) / 1e3;
				insight.lastDecayedAt = timestamp;
				insight.updatedAt = timestamp;
				if (insight.confidence <= .1 && insight.reinforcements === 0) {
					insight.deleted = true;
					softDeleted++;
				} else decayed++;
				dirty.push(insight);
			}
		}
		await Promise.all(dirty.map((i) => kv.set(KV.insights, i.id, i)));
		await recordAudit(kv, "reflect", "mem::insight-decay-sweep", dirty.map((i) => i.id), {
			event: "insight.decay",
			decayed,
			softDeleted,
			total: items.length,
			timestamp
		});
		return {
			success: true,
			decayed,
			softDeleted,
			total: items.length
		};
	});
}

//#endregion
//#region src/functions/working-memory.ts
const CORE_SCOPE = "mem:core-memory";
function estimateTokens(text) {
	return Math.ceil(text.length / 3);
}
function scoreEntry(entry, now) {
	const recencyScore = 1 / (1 + (now - new Date(entry.lastAccessedAt).getTime()) / (1e3 * 60 * 60 * 24) * .1);
	const accessScore = Math.log2(entry.accessCount + 1) / 10;
	return entry.importance / 10 * .5 + recencyScore * .3 + accessScore * .2;
}
function registerWorkingMemoryFunctions(sdk, kv, tokenBudget) {
	sdk.registerFunction("mem::core-add", async (data) => {
		if (!data?.content?.trim()) return {
			success: false,
			error: "content is required"
		};
		const now = (/* @__PURE__ */ new Date()).toISOString();
		const entry = {
			id: generateId("core"),
			content: data.content.trim(),
			importance: Math.min(10, Math.max(1, data.importance ?? 7)),
			pinned: data.pinned ?? false,
			accessCount: 0,
			lastAccessedAt: now,
			createdAt: now
		};
		await kv.set(CORE_SCOPE, entry.id, entry);
		try {
			await recordAudit(kv, "core_add", "mem::core-add", [entry.id], {
				content: entry.content.slice(0, 100),
				importance: entry.importance,
				pinned: entry.pinned
			});
		} catch {}
		return {
			success: true,
			id: entry.id
		};
	});
	sdk.registerFunction("mem::core-remove", async (data) => {
		if (!data?.id) return {
			success: false,
			error: "id is required"
		};
		await kv.delete(CORE_SCOPE, data.id);
		try {
			await recordAudit(kv, "core_remove", "mem::core-remove", [data.id], {});
		} catch {}
		return { success: true };
	});
	sdk.registerFunction("mem::core-list", async () => {
		const entries = await kv.list(CORE_SCOPE);
		entries.sort((a, b) => b.importance - a.importance);
		return {
			success: true,
			entries,
			totalTokens: entries.reduce((sum, e) => sum + estimateTokens(e.content), 0)
		};
	});
	sdk.registerFunction("mem::working-context", async (data) => {
		const budget = data.budget || tokenBudget;
		const now = Date.now();
		let usedTokens = 0;
		const coreEntries = await kv.list(CORE_SCOPE);
		const pinned = coreEntries.filter((e) => e.pinned);
		const unpinned = coreEntries.filter((e) => !e.pinned).sort((a, b) => scoreEntry(b, now) - scoreEntry(a, now));
		const coreLines = [];
		const coreBudget = Math.floor(budget * .3);
		const accessUpdates = [];
		const accessTimestamp = (/* @__PURE__ */ new Date()).toISOString();
		for (const entry of [...pinned, ...unpinned]) {
			const tokens = estimateTokens(entry.content);
			if (usedTokens + tokens > coreBudget && !entry.pinned) continue;
			coreLines.push(`- ${entry.content}`);
			usedTokens += tokens;
			entry.accessCount++;
			entry.lastAccessedAt = accessTimestamp;
			accessUpdates.push({
				id: entry.id,
				entry
			});
		}
		Promise.allSettled(accessUpdates.map(({ id, entry }) => kv.set(CORE_SCOPE, id, entry))).catch(() => {});
		const archivalLines = [];
		const active = (await kv.list(KV.memories)).filter((m) => m.isLatest !== false).sort((a, b) => {
			const strengthDiff = b.strength - a.strength;
			if (Math.abs(strengthDiff) > .2) return strengthDiff;
			return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
		});
		const archivalIds = [];
		for (const mem of active) {
			const tokens = estimateTokens(mem.content);
			if (usedTokens + tokens > budget) continue;
			archivalLines.push(`- [${mem.type}] ${mem.title}: ${mem.content}`);
			archivalIds.push(mem.id);
			usedTokens += tokens;
		}
		recordAccessBatch(kv, archivalIds);
		const pagedOut = active.length - archivalLines.length;
		const sections = [];
		if (coreLines.length > 0) sections.push(`## Core Memory\n${coreLines.join("\n")}`);
		if (archivalLines.length > 0) sections.push(`## Archival Memory\n${archivalLines.join("\n")}`);
		if (pagedOut > 0) sections.push(`_${pagedOut} memories paged to archival (use mem::search to retrieve)_`);
		const context = sections.join("\n\n");
		logger.info("Working context built", {
			coreEntries: coreLines.length,
			archivalEntries: archivalLines.length,
			pagedOut,
			tokens: usedTokens,
			budget
		});
		return {
			success: true,
			context,
			coreEntries: coreLines.length,
			archivalEntries: archivalLines.length,
			pagedOut,
			tokens: usedTokens,
			budget
		};
	});
	sdk.registerFunction("mem::auto-page", async (data) => {
		const budget = data?.budget || tokenBudget;
		const coreBudget = Math.floor(budget * .3);
		const entries = await kv.list(CORE_SCOPE);
		let totalTokens = entries.reduce((sum, e) => sum + estimateTokens(e.content), 0);
		if (totalTokens <= coreBudget) return {
			success: true,
			paged: 0,
			totalTokens,
			budget: coreBudget
		};
		const now = Date.now();
		const unpinned = entries.filter((e) => !e.pinned).sort((a, b) => scoreEntry(a, now) - scoreEntry(b, now));
		let paged = 0;
		const pagedIds = [];
		for (const entry of unpinned) {
			if (totalTokens <= coreBudget) break;
			const tokens = estimateTokens(entry.content);
			const archivalMemory = {
				id: generateId("mem"),
				createdAt: entry.createdAt,
				updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
				type: "fact",
				title: entry.content.slice(0, 80),
				content: entry.content,
				concepts: [],
				files: [],
				sessionIds: [],
				strength: entry.importance / 10,
				version: 1,
				isLatest: true
			};
			await kv.set(KV.memories, archivalMemory.id, archivalMemory);
			await kv.delete(CORE_SCOPE, entry.id);
			totalTokens -= tokens;
			paged++;
			pagedIds.push(entry.id);
		}
		if (paged > 0) try {
			await recordAudit(kv, "auto_page", "mem::auto-page", pagedIds, {
				paged,
				budget: coreBudget
			});
		} catch {}
		return {
			success: true,
			paged,
			totalTokens,
			budget: coreBudget
		};
	});
}

//#endregion
//#region src/functions/skill-extract.ts
const SKILL_EXTRACT_SYSTEM = `You are a skill extraction engine. Given a completed multi-step task session, extract a reusable procedural skill document.

Output format:
<skill>
<trigger>When the agent encounters [specific situation/pattern]</trigger>
<title>Short skill title</title>
<steps>
<step>First concrete action</step>
<step>Second concrete action</step>
</steps>
<expected_outcome>What success looks like</expected_outcome>
<tags>comma,separated,tags</tags>
</skill>

Rules:
- Extract ONLY if the session shows a clear multi-step procedure that succeeded
- Steps must be concrete and actionable, not vague
- The trigger should describe WHEN to apply this skill
- If the session is exploratory with no clear procedure, output <no-skill/>
- Maximum 10 steps per skill`;
function buildSkillPrompt(summary, observations) {
	const obsText = observations.filter((o) => o.importance >= 4).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(0, 30).map((o) => `[${o.type}] ${o.title}${o.narrative ? ": " + o.narrative : ""}`).join("\n");
	return `## Session Summary
Title: ${summary.title}
Narrative: ${summary.narrative}
Key Decisions: ${summary.keyDecisions.join("; ")}
Files Modified: ${summary.filesModified.join(", ")}
Concepts: ${summary.concepts.join(", ")}

## Observations (${observations.length} total, showing top by importance)
${obsText}`;
}
function parseSkillXml(xml) {
	if (xml.includes("<no-skill/>")) return null;
	const triggerMatch = xml.match(/<trigger>([\s\S]*?)<\/trigger>/);
	const titleMatch = xml.match(/<title>([\s\S]*?)<\/title>/);
	const stepsMatch = xml.match(/<steps>([\s\S]*?)<\/steps>/);
	const outcomeMatch = xml.match(/<expected_outcome>([\s\S]*?)<\/expected_outcome>/);
	const tagsMatch = xml.match(/<tags>([\s\S]*?)<\/tags>/);
	if (!triggerMatch || !titleMatch || !stepsMatch) return null;
	const stepRegex = /<step>([\s\S]*?)<\/step>/g;
	const steps = [];
	let match;
	while ((match = stepRegex.exec(stepsMatch[1])) !== null) {
		const step = match[1].trim();
		if (step) steps.push(step);
	}
	if (steps.length < 2) return null;
	return {
		trigger: triggerMatch[1].trim(),
		title: titleMatch[1].trim(),
		steps,
		expectedOutcome: outcomeMatch?.[1]?.trim() || "",
		tags: tagsMatch?.[1]?.split(",").map((t) => t.trim()).filter(Boolean) || []
	};
}
function registerSkillExtractFunctions(sdk, kv, provider) {
	sdk.registerFunction("mem::skill-extract", async (data) => {
		if (!data?.sessionId) return {
			success: false,
			error: "sessionId is required"
		};
		const session = await kv.get(KV.sessions, data.sessionId).catch(() => null);
		if (!session) return {
			success: false,
			error: "session not found"
		};
		if (session.status !== "completed") return {
			success: false,
			error: "session must be completed before skill extraction"
		};
		const [summary, observations] = await Promise.all([kv.get(KV.summaries, data.sessionId).catch(() => null), kv.list(KV.observations(data.sessionId)).catch(() => [])]);
		if (!summary) return {
			success: false,
			error: "no summary — run mem::summarize first"
		};
		if (observations.length < 3) return {
			success: false,
			error: "too few observations for skill extraction"
		};
		try {
			const prompt = buildSkillPrompt(summary, observations);
			const parsed = parseSkillXml(await provider.summarize(SKILL_EXTRACT_SYSTEM, prompt));
			if (!parsed) {
				logger.info("No skill extracted — session was exploratory", { sessionId: data.sessionId });
				return {
					success: true,
					extracted: false,
					reason: "no clear procedure found"
				};
			}
			const fp = fingerprintId("skill", JSON.stringify({
				title: parsed.title.toLowerCase(),
				trigger: parsed.trigger.toLowerCase(),
				steps: parsed.steps.map((s) => s.toLowerCase().trim())
			}));
			const existing = await kv.get(KV.procedural, fp).catch(() => null);
			if (existing) {
				if (!existing.sourceSessionIds.includes(data.sessionId)) {
					existing.strength = Math.min(1, existing.strength + .15);
					existing.frequency++;
					existing.sourceSessionIds = [...existing.sourceSessionIds, data.sessionId];
				}
				existing.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
				await kv.set(KV.procedural, existing.id, existing);
				try {
					await recordAudit(kv, "skill_extract", "mem::skill-extract", [], {
						skillId: existing.id,
						reinforced: true,
						sessionId: data.sessionId
					});
				} catch {}
				logger.info("Skill reinforced", {
					id: existing.id,
					name: parsed.title
				});
				return {
					success: true,
					extracted: true,
					reinforced: true,
					skill: existing
				};
			}
			const now = (/* @__PURE__ */ new Date()).toISOString();
			const skill = {
				id: fp,
				name: parsed.title,
				triggerCondition: parsed.trigger,
				steps: parsed.steps,
				expectedOutcome: parsed.expectedOutcome,
				strength: .6,
				frequency: 1,
				tags: parsed.tags,
				concepts: summary.concepts,
				sourceSessionIds: [data.sessionId],
				sourceObservationIds: observations.slice(0, 10).map((o) => o.id),
				createdAt: now,
				updatedAt: now
			};
			await kv.set(KV.procedural, skill.id, skill);
			try {
				await recordAudit(kv, "skill_extract", "mem::skill-extract", [], {
					skillId: skill.id,
					title: parsed.title,
					steps: parsed.steps.length,
					sessionId: data.sessionId
				});
			} catch {}
			logger.info("Skill extracted", {
				id: skill.id,
				title: parsed.title,
				steps: parsed.steps.length
			});
			return {
				success: true,
				extracted: true,
				reinforced: false,
				skill
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Skill extraction failed", { error: msg });
			return {
				success: false,
				error: msg
			};
		}
	});
	sdk.registerFunction("mem::skill-list", async (data) => {
		const limit = data?.limit ?? 50;
		const sorted = (await kv.list(KV.procedural)).sort((a, b) => b.strength - a.strength);
		return {
			success: true,
			skills: sorted.slice(0, limit),
			total: sorted.length
		};
	});
	sdk.registerFunction("mem::skill-match", async (data) => {
		if (!data?.query?.trim()) return {
			success: false,
			error: "query is required"
		};
		const limit = data.limit ?? 5;
		const terms = data.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
		const scored = (await kv.list(KV.procedural)).map((skill) => {
			const text = `${skill.name} ${skill.triggerCondition} ${(skill.tags || []).join(" ")} ${skill.steps.join(" ")}`.toLowerCase();
			const matchCount = terms.filter((t) => text.includes(t)).length;
			if (matchCount === 0) return null;
			return {
				skill,
				score: matchCount / terms.length * skill.strength
			};
		}).filter(Boolean);
		scored.sort((a, b) => b.score - a.score);
		return {
			success: true,
			matches: scored.slice(0, limit)
		};
	});
}

//#endregion
//#region src/functions/sliding-window.ts
const SLIDING_WINDOW_SYSTEM = `You are a contextual enrichment engine. Given a primary observation and its surrounding context window (previous and next observations from the same session), produce an enriched version.

Your tasks:
1. ENTITY RESOLUTION: Replace all pronouns, implicit references ("that framework", "the file", "it", "he/she") with the explicit entity names found in the context window.
2. PREFERENCE MAPPING: Extract any user preferences, constraints, or opinions expressed directly or indirectly.
3. CONTEXT BRIDGES: Add brief contextual links that make this chunk self-contained without reading adjacent chunks.

Output EXACTLY this XML:
<enriched>
  <content>The fully enriched, self-contained text with all references resolved</content>
  <resolved_entities>
    <entity original="pronoun or reference" resolved="explicit entity name"/>
  </resolved_entities>
  <preferences>
    <preference>extracted user preference or constraint</preference>
  </preferences>
  <context_bridges>
    <bridge>contextual link to adjacent information</bridge>
  </context_bridges>
</enriched>

Rules:
- The enriched content MUST be understandable in complete isolation
- Resolve ALL ambiguous references using the context window
- Do not hallucinate entities not present in the window
- Preserve factual accuracy while adding clarity`;
function buildWindowPrompt(primary, before, after) {
	const parts = [];
	if (before.length > 0) {
		parts.push("=== PRECEDING CONTEXT ===");
		for (const obs of before) {
			parts.push(`[${obs.type}] ${obs.title}: ${obs.narrative}`);
			if (obs.facts.length > 0) parts.push(`Facts: ${obs.facts.join("; ")}`);
			if (obs.concepts.length > 0) parts.push(`Concepts: ${obs.concepts.join(", ")}`);
		}
	}
	parts.push("\n=== PRIMARY OBSERVATION (enrich this) ===");
	parts.push(`Type: ${primary.type}`);
	parts.push(`Title: ${primary.title}`);
	if (primary.subtitle) parts.push(`Subtitle: ${primary.subtitle}`);
	parts.push(`Narrative: ${primary.narrative}`);
	if (primary.facts.length > 0) parts.push(`Facts: ${primary.facts.join("; ")}`);
	if (primary.concepts.length > 0) parts.push(`Concepts: ${primary.concepts.join(", ")}`);
	if (primary.files.length > 0) parts.push(`Files: ${primary.files.join(", ")}`);
	if (after.length > 0) {
		parts.push("\n=== FOLLOWING CONTEXT ===");
		for (const obs of after) {
			parts.push(`[${obs.type}] ${obs.title}: ${obs.narrative}`);
			if (obs.facts.length > 0) parts.push(`Facts: ${obs.facts.join("; ")}`);
		}
	}
	return parts.join("\n");
}
function parseEnrichedXml(xml) {
	const contentMatch = xml.match(/<content>([\s\S]*?)<\/content>/);
	if (!contentMatch) return null;
	const resolvedEntities = {};
	const entityRegex = /<entity\s+original="([^"]+)"\s+resolved="([^"]+)"\s*\/>/g;
	let match;
	while ((match = entityRegex.exec(xml)) !== null) resolvedEntities[match[1]] = match[2];
	const preferences = [];
	const prefRegex = /<preference>([^<]+)<\/preference>/g;
	while ((match = prefRegex.exec(xml)) !== null) preferences.push(match[1]);
	const contextBridges = [];
	const bridgeRegex = /<bridge>([^<]+)<\/bridge>/g;
	while ((match = bridgeRegex.exec(xml)) !== null) contextBridges.push(match[1]);
	return {
		content: contentMatch[1].trim(),
		resolvedEntities,
		preferences,
		contextBridges
	};
}
function registerSlidingWindowFunction(sdk, kv, provider) {
	sdk.registerFunction("mem::enrich-window", async (data) => {
		if (!data || typeof data.sessionId !== "string" || !data.sessionId.trim() || typeof data.observationId !== "string" || !data.observationId.trim()) return {
			success: false,
			error: "sessionId and observationId are required"
		};
		const sessionId = data.sessionId.trim();
		const observationId = data.observationId.trim();
		const hprev = data.lookback ?? 3;
		const hnext = data.lookahead ?? 2;
		const allObs = await kv.list(KV.observations(sessionId));
		allObs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
		const primaryIdx = allObs.findIndex((o) => o.id === observationId);
		if (primaryIdx === -1) return {
			success: false,
			error: "Observation not found"
		};
		const primary = allObs[primaryIdx];
		const before = allObs.slice(Math.max(0, primaryIdx - hprev), primaryIdx);
		const after = allObs.slice(primaryIdx + 1, primaryIdx + 1 + hnext);
		if (before.length === 0 && after.length === 0) return {
			success: true,
			enriched: null,
			reason: "No adjacent context available"
		};
		try {
			const prompt = buildWindowPrompt(primary, before, after);
			const parsed = parseEnrichedXml(await provider.compress(SLIDING_WINDOW_SYSTEM, prompt));
			if (!parsed) {
				logger.warn("Failed to parse enrichment XML", { obsId: data.observationId });
				return {
					success: false,
					error: "parse_failed"
				};
			}
			const enriched = {
				id: generateId("ec"),
				originalObsId: observationId,
				sessionId,
				content: parsed.content,
				resolvedEntities: parsed.resolvedEntities,
				preferences: parsed.preferences,
				contextBridges: parsed.contextBridges,
				windowStart: Math.max(0, primaryIdx - hprev),
				windowEnd: Math.min(allObs.length - 1, primaryIdx + hnext),
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			await kv.set(KV.enrichedChunks(sessionId), observationId, enriched);
			await recordAudit(kv, "observe", "mem::enrich-window", [enriched.id], {
				action: "persist_enriched_chunk",
				sessionId,
				observationId
			});
			logger.info("Observation enriched via sliding window", {
				obsId: observationId,
				entitiesResolved: Object.keys(parsed.resolvedEntities).length,
				preferencesFound: parsed.preferences.length,
				bridges: parsed.contextBridges.length
			});
			return {
				success: true,
				enriched
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Sliding window enrichment failed", { error: msg });
			return {
				success: false,
				error: msg
			};
		}
	});
	sdk.registerFunction("mem::enrich-session", async (data) => {
		if (!data || typeof data.sessionId !== "string" || !data.sessionId.trim()) return {
			success: false,
			error: "sessionId is required"
		};
		const sessionId = data.sessionId.trim();
		const allObs = await kv.list(KV.observations(sessionId));
		const minImp = data.minImportance ?? 4;
		const toEnrich = allObs.filter((o) => o.importance >= minImp);
		let enriched = 0;
		let failed = 0;
		for (const obs of toEnrich) try {
			if ((await sdk.trigger({
				function_id: "mem::enrich-window",
				payload: {
					observationId: obs.id,
					sessionId,
					lookback: data.lookback ?? 3,
					lookahead: data.lookahead ?? 2
				}
			}))?.success) enriched++;
			else failed++;
		} catch {
			failed++;
		}
		logger.info("Session enrichment complete", {
			sessionId,
			total: toEnrich.length,
			enriched,
			failed
		});
		return {
			success: true,
			total: toEnrich.length,
			enriched,
			failed
		};
	});
}

//#endregion
//#region src/functions/temporal-graph.ts
const TEMPORAL_EXTRACTION_SYSTEM = `You are a temporal knowledge extraction engine. Given observations, extract entities AND their temporal relationships with full context metadata.

For each relationship, you MUST provide:
1. Semantic relation type
2. Temporal validity (when this fact became true in the real world)
3. Context metadata: WHY this relationship exists, what reasoning led to it, what alternatives were considered

Output EXACTLY this XML:
<temporal_graph>
  <entities>
    <entity type="file|function|concept|error|decision|pattern|library|person|project|preference|location|organization|event" name="exact name">
      <property key="key">value</property>
      <alias>alternate name</alias>
    </entity>
  </entities>
  <relationships>
    <relationship type="uses|imports|modifies|causes|fixes|depends_on|related_to|works_at|prefers|blocked_by|caused_by|optimizes_for|rejected|avoids|located_in|succeeded_by"
      source="entity name" target="entity name" weight="0.1-1.0"
      valid_from="ISO date or 'unknown'" valid_to="ISO date or 'current'">
      <reasoning>WHY this relationship exists</reasoning>
      <sentiment>positive|negative|neutral</sentiment>
      <alternatives>
        <alt>alternative that was considered</alt>
      </alternatives>
    </relationship>
  </relationships>
</temporal_graph>

Rules:
- NEVER overwrite existing relationships — always create new versioned edges
- Extract temporal validity from context clues ("since last month", "in 2024", "currently")
- Capture reasoning/motivation behind each relationship
- Weight relationships by directness: 1.0 = explicit statement, 0.5 = inferred, 0.1 = speculative`;
function parseTemporalGraphXml(xml, observationIds) {
	const nodes = [];
	const edges = [];
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const entityRegex = /<entity\s+type="([^"]+)"\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/entity>/g;
	let match;
	while ((match = entityRegex.exec(xml)) !== null) {
		const type = match[1];
		const name = match[2];
		const propsBlock = match[3];
		const properties = {};
		const aliases = [];
		const propRegex = /<property\s+key="([^"]+)">([^<]*)<\/property>/g;
		let propMatch;
		while ((propMatch = propRegex.exec(propsBlock)) !== null) properties[propMatch[1]] = propMatch[2];
		const aliasRegex = /<alias>([^<]+)<\/alias>/g;
		while ((propMatch = aliasRegex.exec(propsBlock)) !== null) aliases.push(propMatch[1]);
		nodes.push({
			id: generateId("gn"),
			type,
			name,
			properties,
			sourceObservationIds: observationIds,
			createdAt: now,
			aliases: aliases.length > 0 ? aliases : void 0
		});
	}
	const relRegex = /<relationship\s+type="([^"]+)"\s+source="([^"]+)"\s+target="([^"]+)"\s+weight="([^"]+)"(?:\s+valid_from="([^"]*)")?(?:\s+valid_to="([^"]*)")?[^>]*>([\s\S]*?)<\/relationship>/g;
	while ((match = relRegex.exec(xml)) !== null) {
		const type = match[1];
		const sourceName = match[2];
		const targetName = match[3];
		const parsedWeight = parseFloat(match[4]);
		const weight = Number.isNaN(parsedWeight) ? .5 : parsedWeight;
		const validFrom = match[5] || void 0;
		const validTo = match[6] || void 0;
		const metaBlock = match[7] || "";
		const sourceNode = nodes.find((n) => n.name === sourceName || n.aliases && n.aliases.includes(sourceName));
		const targetNode = nodes.find((n) => n.name === targetName || n.aliases && n.aliases.includes(targetName));
		if (sourceNode && targetNode) {
			const reasoning = metaBlock.match(/<reasoning>([^<]*)<\/reasoning>/)?.[1] || void 0;
			const sentiment = metaBlock.match(/<sentiment>([^<]*)<\/sentiment>/)?.[1] || void 0;
			const alternatives = [];
			const altRegex = /<alt>([^<]+)<\/alt>/g;
			let altMatch;
			while ((altMatch = altRegex.exec(metaBlock)) !== null) alternatives.push(altMatch[1]);
			const context = {};
			if (reasoning) context.reasoning = reasoning;
			if (sentiment) context.sentiment = sentiment;
			if (alternatives.length > 0) context.alternatives = alternatives;
			context.confidence = Math.max(0, Math.min(1, weight));
			edges.push({
				id: generateId("ge"),
				type,
				sourceNodeId: sourceNode.id,
				targetNodeId: targetNode.id,
				weight: Math.max(0, Math.min(1, weight)),
				sourceObservationIds: observationIds,
				createdAt: now,
				tcommit: now,
				tvalid: validFrom && validFrom !== "unknown" ? validFrom : void 0,
				tvalidEnd: validTo && validTo !== "current" ? validTo : void 0,
				context: Object.keys(context).length > 0 ? context : void 0,
				version: 1,
				isLatest: true
			});
		}
	}
	return {
		nodes,
		edges
	};
}
function registerTemporalGraphFunctions(sdk, kv, provider) {
	sdk.registerFunction("mem::temporal-graph-extract", async (data) => {
		if (!data.observations || data.observations.length === 0) return {
			success: false,
			error: "No observations provided"
		};
		const items = data.observations.map((o, i) => `[${i + 1}] Type: ${o.type}\nTimestamp: ${o.timestamp}\nTitle: ${o.title}\nNarrative: ${o.narrative}\nConcepts: ${(o.concepts ?? []).join(", ")}\nFiles: ${(o.files ?? []).join(", ")}`).join("\n\n");
		try {
			const response = await provider.compress(TEMPORAL_EXTRACTION_SYSTEM, `Extract temporal knowledge graph from:\n\n${items}`);
			const obsIds = data.observations.map((o) => o.id);
			const { nodes, edges } = parseTemporalGraphXml(response, obsIds);
			const existingNodes = await kv.list(KV.graphNodes);
			const existingEdges = await kv.list(KV.graphEdges);
			const idRemap = /* @__PURE__ */ new Map();
			for (const node of nodes) {
				const existing = existingNodes.find((n) => n.name === node.name && n.type === node.type);
				if (existing) {
					const oldId = node.id;
					const merged = {
						...existing,
						sourceObservationIds: [...new Set([...existing.sourceObservationIds, ...obsIds])],
						properties: {
							...existing.properties,
							...node.properties
						},
						updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
						aliases: [...new Set([...existing.aliases || [], ...node.aliases || []])]
					};
					if (merged.aliases.length === 0) delete merged.aliases;
					await kv.set(KV.graphNodes, existing.id, merged);
					node.id = existing.id;
					idRemap.set(oldId, existing.id);
				} else {
					await kv.set(KV.graphNodes, node.id, node);
					existingNodes.push(node);
				}
			}
			for (const edge of edges) {
				if (idRemap.has(edge.sourceNodeId)) edge.sourceNodeId = idRemap.get(edge.sourceNodeId);
				if (idRemap.has(edge.targetNodeId)) edge.targetNodeId = idRemap.get(edge.targetNodeId);
				const existingKey = `${edge.sourceNodeId}|${edge.targetNodeId}|${edge.type}`;
				const existingEdge = existingEdges.find((e) => `${e.sourceNodeId}|${e.targetNodeId}|${e.type}` === existingKey);
				if (existingEdge) {
					const updatedOld = {
						...existingEdge,
						isLatest: false,
						tvalidEnd: existingEdge.tvalidEnd || (/* @__PURE__ */ new Date()).toISOString(),
						supersededBy: edge.id
					};
					await kv.set(KV.graphEdges, existingEdge.id, updatedOld);
					await kv.set(KV.graphEdgeHistory, existingEdge.id, updatedOld);
					edge.version = (existingEdge.version || 1) + 1;
				}
				await kv.set(KV.graphEdges, edge.id, edge);
				existingEdges.push(edge);
			}
			logger.info("Temporal graph extraction complete", {
				nodes: nodes.length,
				edges: edges.length
			});
			return {
				success: true,
				nodesAdded: nodes.length,
				edgesAdded: edges.length
			};
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			logger.error("Temporal graph extraction failed", { error: msg });
			return {
				success: false,
				error: msg
			};
		}
	});
	sdk.registerFunction("mem::temporal-query", async (data) => {
		const allNodes = await kv.list(KV.graphNodes);
		const allEdges = await kv.list(KV.graphEdges);
		const entity = allNodes.find((n) => n.name.toLowerCase() === data.entityName.toLowerCase() || n.aliases && n.aliases.some((a) => a.toLowerCase() === data.entityName.toLowerCase()));
		if (!entity) return { error: `Entity "${data.entityName}" not found` };
		const relatedEdges = allEdges.filter((e) => e.sourceNodeId === entity.id || e.targetNodeId === entity.id);
		const entityHistory = (await kv.list(KV.graphEdgeHistory).catch(() => [])).filter((e) => e.sourceNodeId === entity.id || e.targetNodeId === entity.id);
		const allEntityEdges = [...relatedEdges, ...entityHistory];
		if (data.asOf) {
			const asOfTime = new Date(data.asOf).getTime();
			const validEdges = allEntityEdges.filter((e) => {
				if (new Date(e.tcommit || e.createdAt).getTime() > asOfTime) return false;
				if (e.tvalid) {
					if (new Date(e.tvalid).getTime() > asOfTime) return false;
				}
				if (e.tvalidEnd) {
					if (new Date(e.tvalidEnd).getTime() < asOfTime) return false;
				}
				return true;
			});
			return {
				entity,
				currentEdges: getLatestByKey(validEdges),
				historicalEdges: data.includeHistory ? validEdges : [],
				timeline: buildTimeline(allEntityEdges)
			};
		}
		return {
			entity,
			currentEdges: relatedEdges.filter((e) => e.isLatest !== false),
			historicalEdges: data.includeHistory ? entityHistory : [],
			timeline: buildTimeline(allEntityEdges)
		};
	});
	sdk.registerFunction("mem::differential-state", async (data) => {
		const allNodes = await kv.list(KV.graphNodes);
		const allEdges = await kv.list(KV.graphEdges);
		const historicalEdges = await kv.list(KV.graphEdgeHistory).catch(() => []);
		const entity = allNodes.find((n) => n.name.toLowerCase() === data.entityName.toLowerCase());
		if (!entity) return { error: "Entity not found" };
		const allEntityEdges = [...allEdges.filter((e) => e.sourceNodeId === entity.id || e.targetNodeId === entity.id), ...historicalEdges.filter((e) => e.sourceNodeId === entity.id || e.targetNodeId === entity.id)];
		allEntityEdges.sort((a, b) => new Date(a.tcommit || a.createdAt).getTime() - new Date(b.tcommit || b.createdAt).getTime());
		const fromTime = data.from ? new Date(data.from).getTime() : 0;
		const toTime = data.to ? new Date(data.to).getTime() : Date.now();
		const changes = allEntityEdges.filter((e) => {
			const t = new Date(e.tcommit || e.createdAt).getTime();
			return t >= fromTime && t <= toTime;
		}).map((e) => ({
			type: e.type,
			target: e.sourceNodeId === entity.id ? e.targetNodeId : e.sourceNodeId,
			validFrom: e.tvalid || e.createdAt,
			validTo: e.tvalidEnd,
			reasoning: e.context?.reasoning,
			sentiment: e.context?.sentiment,
			version: e.version || 1,
			isLatest: e.isLatest !== false
		}));
		return {
			entity: entity.name,
			totalChanges: changes.length,
			changes
		};
	});
}
function getLatestByKey(edges) {
	const byKey = /* @__PURE__ */ new Map();
	for (const e of edges) {
		const key = `${e.sourceNodeId}|${e.targetNodeId}|${e.type}`;
		const existing = byKey.get(key);
		if (!existing || new Date(e.tcommit || e.createdAt).getTime() > new Date(existing.tcommit || existing.createdAt).getTime()) byKey.set(key, e);
	}
	return Array.from(byKey.values());
}
function buildTimeline(edges) {
	return [...edges].sort((a, b) => new Date(a.tcommit || a.createdAt).getTime() - new Date(b.tcommit || b.createdAt).getTime()).map((e) => ({
		edge: e,
		validFrom: e.tvalid || e.createdAt,
		validTo: e.tvalidEnd,
		context: e.context
	}));
}

//#endregion
//#region src/functions/retention.ts
const DEFAULT_DECAY = {
	lambda: .01,
	sigma: .3,
	tierThresholds: {
		hot: .7,
		warm: .4,
		cold: .15
	}
};
function resolveDecayConfig(input) {
	const tierThresholds = {
		...DEFAULT_DECAY.tierThresholds,
		...input?.tierThresholds ?? {}
	};
	const config = {
		lambda: typeof input?.lambda === "number" ? input.lambda : DEFAULT_DECAY.lambda,
		sigma: typeof input?.sigma === "number" ? input.sigma : DEFAULT_DECAY.sigma,
		tierThresholds
	};
	if (!Number.isFinite(config.lambda) || config.lambda <= 0) return { error: "config.lambda must be a positive number" };
	if (!Number.isFinite(config.sigma) || config.sigma < 0) return { error: "config.sigma must be a non-negative number" };
	const { hot, warm, cold } = config.tierThresholds;
	if (![
		hot,
		warm,
		cold
	].every((v) => Number.isFinite(v))) return { error: "config.tierThresholds.hot/warm/cold must be finite numbers" };
	if (!(hot >= warm && warm >= cold && cold >= 0)) return { error: "config.tierThresholds must satisfy hot >= warm >= cold >= 0" };
	return { config };
}
function computeReinforcementBoost(accessTimestamps, sigma) {
	const now = Date.now();
	let boost = 0;
	for (const tAccess of accessTimestamps) {
		if (!Number.isFinite(tAccess)) continue;
		const daysSinceAccess = (now - tAccess) / (1e3 * 60 * 60 * 24);
		if (daysSinceAccess > 0) boost += 1 / daysSinceAccess;
	}
	return boost * sigma;
}
function computeSalience(memory, accessCount) {
	let baseSalience = .5;
	if ("type" in memory) baseSalience = {
		architecture: .9,
		bug: .7,
		pattern: .8,
		preference: .85,
		workflow: .6,
		fact: .5
	}[memory.type] || .5;
	if ("confidence" in memory) baseSalience = Math.max(baseSalience, memory.confidence);
	const accessBonus = Math.min(.2, accessCount * .02);
	return Math.min(1, baseSalience + accessBonus);
}
function registerRetentionFunctions(sdk, kv) {
	sdk.registerFunction("mem::retention-score", async (data) => {
		const resolved = resolveDecayConfig(data?.config);
		if ("error" in resolved) return {
			success: false,
			error: resolved.error
		};
		const { config } = resolved;
		const [memories, semanticMems, allLogs] = await Promise.all([
			kv.list(KV.memories),
			kv.list(KV.semantic),
			kv.list(KV.accessLog).catch(() => [])
		]);
		const logsById = /* @__PURE__ */ new Map();
		for (const raw of allLogs) {
			const log = normalizeAccessLog(raw);
			if (log.memoryId) logsById.set(log.memoryId, log);
		}
		const scores = [];
		const computeDecay = (createdAt) => Math.exp(-config.lambda * ((Date.now() - new Date(createdAt).getTime()) / (1e3 * 60 * 60 * 24)));
		const pendingWrites = [];
		let episodicScored = 0;
		let semanticScored = 0;
		for (const mem of memories) {
			if (!mem.isLatest) continue;
			const log = logsById.get(mem.id) ?? emptyAccessLog(mem.id);
			const salience = computeSalience(mem, log.count);
			const temporalDecay = computeDecay(mem.createdAt);
			const reinforcementBoost = computeReinforcementBoost(log.recent, config.sigma);
			const score = Math.min(1, salience * temporalDecay + reinforcementBoost);
			const entry = {
				memoryId: mem.id,
				source: "episodic",
				score,
				salience,
				temporalDecay,
				reinforcementBoost,
				lastAccessed: log.lastAt || mem.updatedAt,
				accessCount: log.count
			};
			scores.push(entry);
			pendingWrites.push([mem.id, entry]);
			episodicScored++;
		}
		for (const sem of semanticMems) {
			const log = logsById.get(sem.id) ?? emptyAccessLog(sem.id);
			let accessTimestamps;
			let effectiveCount;
			if (log.recent.length > 0 || log.count > 0) {
				accessTimestamps = log.recent;
				effectiveCount = log.count;
			} else if (sem.lastAccessedAt) {
				const legacyTs = Date.parse(sem.lastAccessedAt);
				accessTimestamps = Number.isFinite(legacyTs) ? [legacyTs] : [];
				effectiveCount = sem.accessCount;
			} else {
				accessTimestamps = [];
				effectiveCount = sem.accessCount;
			}
			const salience = computeSalience(sem, effectiveCount);
			const temporalDecay = computeDecay(sem.createdAt);
			const reinforcementBoost = computeReinforcementBoost(accessTimestamps, config.sigma);
			const score = Math.min(1, salience * temporalDecay + reinforcementBoost);
			const entry = {
				memoryId: sem.id,
				source: "semantic",
				score,
				salience,
				temporalDecay,
				reinforcementBoost,
				lastAccessed: log.lastAt || sem.lastAccessedAt,
				accessCount: effectiveCount
			};
			scores.push(entry);
			pendingWrites.push([sem.id, entry]);
			semanticScored++;
		}
		await Promise.all(pendingWrites.map(([id, entry]) => kv.set(KV.retentionScores, id, entry)));
		scores.sort((a, b) => b.score - a.score);
		const tiers = {
			hot: scores.filter((s) => s.score >= config.tierThresholds.hot).length,
			warm: scores.filter((s) => s.score >= config.tierThresholds.warm && s.score < config.tierThresholds.hot).length,
			cold: scores.filter((s) => s.score >= config.tierThresholds.cold && s.score < config.tierThresholds.warm).length,
			evictable: scores.filter((s) => s.score < config.tierThresholds.cold).length
		};
		logger.info("Retention scores computed", {
			total: scores.length,
			...tiers
		});
		if (scores.length > 0) await recordAudit(kv, "retention_score", "mem::retention-score", [], {
			total: scores.length,
			episodic: episodicScored,
			semantic: semanticScored,
			tiers,
			config
		});
		return {
			success: true,
			total: scores.length,
			tiers,
			scores
		};
	});
	sdk.registerFunction("mem::retention-evict", async (data) => {
		const threshold = typeof data?.threshold === "number" && Number.isFinite(data.threshold) ? data.threshold : DEFAULT_DECAY.tierThresholds.cold;
		const maxEvictRaw = typeof data?.maxEvict === "number" && Number.isInteger(data.maxEvict) ? data.maxEvict : 50;
		const maxEvict = Math.min(1e3, Math.max(0, maxEvictRaw));
		const { decrementImageRef } = await Promise.resolve().then(() => image_refs_exports);
		const candidates = (await kv.list(KV.retentionScores)).filter((s) => s.score < threshold).sort((a, b) => a.score - b.score).slice(0, maxEvict);
		if (data?.dryRun) return {
			success: true,
			dryRun: true,
			wouldEvict: candidates.length,
			candidates: candidates.map((c) => ({
				id: c.memoryId,
				score: c.score
			}))
		};
		let evicted = 0;
		let evictedEpisodic = 0;
		let evictedSemantic = 0;
		const evictedIds = [];
		for (const candidate of candidates) try {
			let scope = null;
			let resolvedSource = null;
			if (candidate.source === "semantic") {
				scope = KV.semantic;
				resolvedSource = "semantic";
			} else if (candidate.source === "episodic") {
				scope = KV.memories;
				resolvedSource = "episodic";
			} else if (await kv.get(KV.memories, candidate.memoryId) !== null) {
				scope = KV.memories;
				resolvedSource = "episodic";
			} else if (await kv.get(KV.semantic, candidate.memoryId) !== null) {
				scope = KV.semantic;
				resolvedSource = "semantic";
			}
			if (!scope || !resolvedSource) continue;
			const mem = await kv.get(scope, candidate.memoryId);
			if (mem && mem.imageRef) await decrementImageRef(kv, sdk, mem.imageRef);
			await kv.delete(scope, candidate.memoryId);
			await kv.delete(KV.retentionScores, candidate.memoryId);
			await deleteAccessLog(kv, candidate.memoryId);
			evicted++;
			evictedIds.push(candidate.memoryId);
			if (resolvedSource === "semantic") evictedSemantic++;
			else evictedEpisodic++;
		} catch {
			continue;
		}
		if (evicted > 0) await recordAudit(kv, "delete", "mem::retention-evict", evictedIds, {
			threshold,
			evicted,
			evictedEpisodic,
			evictedSemantic,
			reason: "retention score below threshold"
		});
		logger.info("Retention-based eviction complete", {
			evicted,
			evictedEpisodic,
			evictedSemantic,
			threshold
		});
		return {
			success: true,
			evicted,
			evictedEpisodic,
			evictedSemantic
		};
	});
}

//#endregion
//#region src/functions/compress-file.ts
const SENSITIVE_PATH_TERMS = [
	"secret",
	"credential",
	"private_key",
	".env",
	"id_rsa",
	"token"
];
const COMPRESS_FILE_SYSTEM_PROMPT = `You compress markdown while preserving structure.
Rules:
- Keep all headings exactly as-is.
- Keep all URLs exactly as-is.
- Keep all fenced code blocks exactly as-is.
- Do not remove sections; shorten prose under each section.
- Output only markdown, no wrappers or explanations.`;
function stripMarkdownFence(text) {
	const trimmed = text.trim();
	const match = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);
	return match ? match[1].trim() : trimmed;
}
function extractUrls(text) {
	return Array.from(new Set(text.match(/https?:\/\/[^\s)]+/g) || []));
}
function extractHeadings(text) {
	return text.split("\n").map((line) => line.trim()).filter((line) => /^#{1,6}\s+/.test(line));
}
function extractCodeBlocks(text) {
	return text.match(/```[\s\S]*?```/g) || [];
}
function validateCompression(original, compressed) {
	const errors = [];
	const originalHeadings = extractHeadings(original);
	const compressedHeadings = extractHeadings(compressed);
	for (const heading of originalHeadings) if (!compressedHeadings.includes(heading)) errors.push(`missing heading: ${heading}`);
	const originalUrls = extractUrls(original).sort();
	const compressedUrls = extractUrls(compressed).sort();
	if (originalUrls.length !== compressedUrls.length) errors.push("url count changed");
	else for (let i = 0; i < originalUrls.length; i++) if (originalUrls[i] !== compressedUrls[i]) {
		errors.push("url set changed");
		break;
	}
	const originalBlocks = extractCodeBlocks(original);
	const compressedBlocks = extractCodeBlocks(compressed);
	if (originalBlocks.length !== compressedBlocks.length) errors.push("code block count changed");
	else for (let i = 0; i < originalBlocks.length; i++) if (originalBlocks[i] !== compressedBlocks[i]) {
		errors.push("code block content changed");
		break;
	}
	return errors;
}
function resolveBackupPath(filePath) {
	const base = basename(filePath, extname(filePath));
	const name = base.endsWith(".original") ? `${base}.backup` : `${base}.original`;
	return join(dirname(filePath), `${name}.md`);
}
function registerCompressFileFunction(sdk, kv, provider) {
	sdk.registerFunction("mem::compress-file", async (data) => {
		if (!data?.filePath || typeof data.filePath !== "string") return {
			success: false,
			error: "filePath is required"
		};
		const absolutePath = resolve(data.filePath);
		const lowerPath = absolutePath.toLowerCase();
		if (extname(absolutePath).toLowerCase() !== ".md") return {
			success: false,
			error: "filePath must point to a .md file"
		};
		if (SENSITIVE_PATH_TERMS.some((term) => lowerPath.includes(term))) return {
			success: false,
			error: "refusing to process sensitive-looking path"
		};
		try {
			if ((await lstat(absolutePath)).isSymbolicLink()) return {
				success: false,
				error: "symlinks are not supported"
			};
		} catch {
			return {
				success: false,
				error: "file not found"
			};
		}
		let original;
		try {
			original = await readFile(absolutePath, "utf-8");
		} catch {
			return {
				success: false,
				error: "failed to read file"
			};
		}
		if (!original.trim()) return {
			success: true,
			skipped: true,
			reason: "file is empty"
		};
		const compressed = stripMarkdownFence(await provider.summarize(COMPRESS_FILE_SYSTEM_PROMPT, `Compress this markdown file while preserving structure and code blocks:\n\n${original}`));
		const validationErrors = validateCompression(original, compressed);
		if (validationErrors.length > 0) return {
			success: false,
			error: "compression validation failed",
			details: validationErrors
		};
		const backupPath = resolveBackupPath(absolutePath);
		await writeFile(backupPath, original, "utf-8");
		let fd = null;
		try {
			fd = await open(absolutePath, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW);
			await fd.writeFile(compressed, "utf-8");
		} catch (err) {
			const code = err.code;
			if (code === "ELOOP" || code === "EINVAL") return {
				success: false,
				error: "symlinks are not supported"
			};
			return {
				success: false,
				error: "failed to write compressed file"
			};
		} finally {
			await fd?.close().catch(() => {});
		}
		try {
			await recordAudit(kv, "compress", "mem::compress-file", [], {
				filePath: absolutePath,
				backupPath,
				originalChars: original.length,
				compressedChars: compressed.length
			});
		} catch {}
		return {
			success: true,
			filePath: absolutePath,
			backupPath,
			originalChars: original.length,
			compressedChars: compressed.length
		};
	});
}

//#endregion
//#region src/replay/jsonl-parser.ts
function deriveProject(cwd) {
	if (!cwd) return "unknown";
	const parts = cwd.split("/").filter(Boolean);
	return parts[parts.length - 1] || "unknown";
}
function toText(content) {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	const parts = [];
	for (const item of content) {
		if (!item || typeof item !== "object") continue;
		const entry = item;
		if (entry.type === "text" && typeof entry.text === "string") parts.push(entry.text);
	}
	return parts.join("\n");
}
function extractToolUses(content) {
	if (!Array.isArray(content)) return [];
	const out = [];
	for (const item of content) {
		if (!item || typeof item !== "object") continue;
		const entry = item;
		if (entry.type === "tool_use") out.push({
			id: typeof entry.id === "string" ? entry.id : "",
			name: typeof entry.name === "string" ? entry.name : "unknown",
			input: entry.input
		});
	}
	return out;
}
function extractToolResults(content) {
	if (!Array.isArray(content)) return [];
	const out = [];
	for (const item of content) {
		if (!item || typeof item !== "object") continue;
		const entry = item;
		if (entry.type === "tool_result") out.push({
			toolUseId: typeof entry.tool_use_id === "string" ? entry.tool_use_id : "",
			output: entry.content,
			isError: entry.is_error === true
		});
	}
	return out;
}
function parseJsonlText(text, fallbackSessionId) {
	const lines = text.split("\n").filter((l) => l.trim().length > 0);
	const entries = [];
	for (const line of lines) try {
		const parsed = JSON.parse(line);
		if (parsed && typeof parsed === "object") entries.push(parsed);
	} catch {}
	let sessionId = "";
	let cwd = "";
	let firstTs = "";
	let lastTs = "";
	const observations = [];
	for (const entry of entries) {
		if (entry.sessionId && !sessionId) sessionId = entry.sessionId;
		if (entry.cwd && !cwd) cwd = entry.cwd;
		const ts = entry.timestamp || (/* @__PURE__ */ new Date()).toISOString();
		if (!firstTs) firstTs = ts;
		lastTs = ts;
		const role = entry.message?.role;
		const content = entry.message?.content;
		if (entry.type === "user" && role === "user") {
			const toolResults = extractToolResults(content);
			if (toolResults.length > 0) for (const result of toolResults) observations.push({
				id: generateId("obs"),
				sessionId: sessionId || "imported",
				timestamp: ts,
				hookType: result.isError ? "post_tool_failure" : "post_tool_use",
				toolName: void 0,
				toolInput: { toolUseId: result.toolUseId },
				toolOutput: result.output,
				raw: entry
			});
			else {
				const text = toText(content);
				if (text.trim().length > 0) observations.push({
					id: generateId("obs"),
					sessionId: sessionId || "imported",
					timestamp: ts,
					hookType: "prompt_submit",
					userPrompt: text,
					raw: entry
				});
			}
		} else if (entry.type === "assistant" && role === "assistant") {
			const text = toText(content);
			const tools = extractToolUses(content);
			if (text.trim().length > 0) observations.push({
				id: generateId("obs"),
				sessionId: sessionId || "imported",
				timestamp: ts,
				hookType: "stop",
				assistantResponse: text,
				raw: entry
			});
			for (const tool of tools) observations.push({
				id: generateId("obs"),
				sessionId: sessionId || "imported",
				timestamp: ts,
				hookType: "pre_tool_use",
				toolName: tool.name,
				toolInput: tool.input,
				raw: {
					toolUseId: tool.id,
					entry
				}
			});
		} else if (entry.type === "summary" || entry.type === "system") {}
	}
	const effectiveSessionId = sessionId || fallbackSessionId || generateId("sess");
	for (const obs of observations) if (obs.sessionId === "imported") obs.sessionId = effectiveSessionId;
	const nowIso = (/* @__PURE__ */ new Date()).toISOString();
	return {
		sessionId: effectiveSessionId,
		project: deriveProject(cwd),
		cwd: cwd || process.cwd(),
		startedAt: firstTs || nowIso,
		endedAt: lastTs || nowIso,
		observations
	};
}

//#endregion
//#region src/replay/timeline.ts
const DEFAULT_CHARS_PER_SEC = 40;
const MIN_EVENT_MS = 300;
const MAX_EVENT_MS = 2e4;
function kindFromHook(obs) {
	switch (obs.hookType) {
		case "session_start": return "session_start";
		case "session_end": return "session_end";
		case "prompt_submit": return "prompt";
		case "stop": return obs.assistantResponse ? "response" : "hook";
		case "pre_tool_use": return "tool_call";
		case "post_tool_use": return "tool_result";
		case "post_tool_failure": return "tool_error";
		default: return "hook";
	}
}
function labelFor(obs, kind) {
	switch (kind) {
		case "prompt": return truncate(obs.userPrompt || "User prompt", 80);
		case "response": return truncate(obs.assistantResponse || "Assistant response", 80);
		case "tool_call": return `${obs.toolName || "tool"} ▸ call`;
		case "tool_result": return `${obs.toolName || "tool"} ▸ result`;
		case "tool_error": return `${obs.toolName || "tool"} ▸ error`;
		case "session_start": return "Session start";
		case "session_end": return "Session end";
		default: return obs.hookType;
	}
}
function truncate(text, max) {
	if (text.length <= max) return text;
	return text.slice(0, max - 1) + "…";
}
function bodyFor(obs, kind) {
	if (kind === "prompt") return obs.userPrompt;
	if (kind === "response") return obs.assistantResponse;
}
function estimateDurationMs(ev) {
	const chars = (ev.body?.length || 0) + (typeof ev.toolInput === "string" ? ev.toolInput.length : 0) + (typeof ev.toolOutput === "string" ? ev.toolOutput.length : 0);
	if (chars === 0) return MIN_EVENT_MS;
	const ms = Math.round(chars / DEFAULT_CHARS_PER_SEC * 1e3);
	return Math.max(MIN_EVENT_MS, Math.min(MAX_EVENT_MS, ms));
}
function projectTimeline(observations) {
	if (observations.length === 0) {
		const now = (/* @__PURE__ */ new Date()).toISOString();
		return {
			sessionId: "",
			startedAt: now,
			endedAt: now,
			totalDurationMs: 0,
			eventCount: 0,
			events: []
		};
	}
	const sorted = [...observations].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
	const startedAt = sorted[0].timestamp;
	const startMs = Date.parse(startedAt);
	const events = [];
	let syntheticOffset = 0;
	const allSameTs = sorted.every((o) => o.timestamp === startedAt);
	for (const obs of sorted) {
		const kind = kindFromHook(obs);
		const body = bodyFor(obs, kind);
		const obsMs = Date.parse(obs.timestamp);
		const offsetMs = allSameTs ? syntheticOffset : Number.isFinite(obsMs) && Number.isFinite(startMs) ? Math.max(0, obsMs - startMs) : syntheticOffset;
		const event = {
			id: obs.id,
			sessionId: obs.sessionId,
			ts: obs.timestamp,
			offsetMs,
			durationMs: 0,
			kind,
			label: labelFor(obs, kind),
			body,
			toolName: obs.toolName,
			toolInput: obs.toolInput,
			toolOutput: obs.toolOutput
		};
		event.durationMs = estimateDurationMs(event);
		events.push(event);
		syntheticOffset += event.durationMs;
	}
	const last = events[events.length - 1];
	const totalDurationMs = last.offsetMs + last.durationMs;
	return {
		sessionId: sorted[0].sessionId,
		startedAt,
		endedAt: sorted[sorted.length - 1].timestamp,
		totalDurationMs,
		eventCount: events.length,
		events
	};
}

//#endregion
//#region src/functions/replay.ts
const MAX_FILES_DEFAULT = 200;
const MAX_FILES_UPPER_BOUND = 1e3;
const SENSITIVE_PATH_PATTERNS = [
	/(^|[\\/_.-])secret([\\/_.-]|s?$)/i,
	/(^|[\\/_.-])credentials?([\\/_.-]|$)/i,
	/(^|[\\/_.-])private[_-]?key([\\/_.-]|$)/i,
	/(^|[\\/])\.env(\.[\w-]+)?$/i,
	/(^|[\\/_.-])id_rsa([\\/_.-]|$)/i,
	/(^|[\\/])auth[_-]?token([\\/_.-]|$)/i,
	/(^|[\\/])bearer[_-]?token([\\/_.-]|$)/i,
	/(^|[\\/])access[_-]?token([\\/_.-]|$)/i,
	/(^|[\\/])api[_-]?token([\\/_.-]|$)/i
];
function isSensitive(path) {
	return SENSITIVE_PATH_PATTERNS.some((re) => re.test(path));
}
async function isSymlink(path) {
	try {
		return (await lstat(path)).isSymbolicLink();
	} catch {
		return false;
	}
}
function rawFromCompressed(obs) {
	return {
		id: obs.id,
		sessionId: obs.sessionId,
		timestamp: obs.timestamp,
		hookType: "post_tool_use",
		toolName: void 0,
		toolInput: void 0,
		toolOutput: void 0,
		userPrompt: obs.type === "conversation" ? obs.narrative : void 0,
		assistantResponse: void 0,
		raw: {
			title: obs.title,
			narrative: obs.narrative,
			facts: obs.facts
		}
	};
}
const LESSON_PATTERNS = [/\b(always|never|don'?t|do not|make sure|remember to|note:|caveat:|warning:)\b[^.\n]{10,200}[.!\n]/gi, /\b(prefer|avoid)\s[^.\n]{10,200}[.!\n]/gi];
async function deriveCrystalAndLessons(kv, sessionId, project, rawObs, compressed, firstPrompt) {
	if (rawObs.length === 0) return;
	const createdAt = (/* @__PURE__ */ new Date()).toISOString();
	const files = /* @__PURE__ */ new Set();
	const tools = /* @__PURE__ */ new Set();
	for (const c of compressed) {
		for (const f of c.files || []) files.add(f);
		if (c.type && c.type !== "conversation" && c.title) tools.add(c.title);
	}
	const assistantTexts = [];
	const userPrompts = [];
	for (const r of rawObs) {
		if (typeof r.assistantResponse === "string" && r.assistantResponse.trim()) assistantTexts.push(r.assistantResponse);
		if (typeof r.userPrompt === "string" && r.userPrompt.trim()) userPrompts.push(r.userPrompt);
	}
	const lessonMatches = /* @__PURE__ */ new Map();
	for (const text of assistantTexts.concat(userPrompts).slice(0, 200)) for (const pat of LESSON_PATTERNS) {
		pat.lastIndex = 0;
		let m;
		while ((m = pat.exec(text)) !== null && lessonMatches.size < 40) {
			const snippet = m[0].replace(/\s+/g, " ").trim();
			if (snippet.length >= 20 && snippet.length <= 220) {
				const key = snippet.toLowerCase();
				if (!lessonMatches.has(key)) lessonMatches.set(key, snippet);
			}
		}
	}
	const lessonEntries = Array.from(lessonMatches.values()).slice(0, 20);
	const lessonIds = [];
	for (const content of lessonEntries) {
		const lessonId = fingerprintId("lesson", content.trim().toLowerCase());
		try {
			const existing = await kv.get(KV.lessons, lessonId);
			if (existing) {
				const existingSources = existing.sourceIds || [];
				const mergedSources = existingSources.includes(sessionId) ? existingSources : [...existingSources, sessionId];
				const existingTags = existing.tags || [];
				const mergedTags = existingTags.includes("auto-import") ? existingTags : [...existingTags, "auto-import"];
				const merged = {
					...existing,
					sourceIds: mergedSources,
					tags: mergedTags,
					reinforcements: (existing.reinforcements || 0) + 1,
					updatedAt: createdAt,
					lastReinforcedAt: createdAt
				};
				await kv.set(KV.lessons, lessonId, merged);
			} else {
				const lesson = {
					id: lessonId,
					content,
					context: firstPrompt || project,
					confidence: .4,
					reinforcements: 0,
					source: "consolidation",
					sourceIds: [sessionId],
					project,
					tags: ["auto-import"],
					createdAt,
					updatedAt: createdAt,
					decayRate: .05
				};
				await kv.set(KV.lessons, lessonId, lesson);
			}
			lessonIds.push(lessonId);
		} catch {}
	}
	const crystalId = fingerprintId("crystal", sessionId);
	const narrativePreview = firstPrompt ? firstPrompt.slice(0, 300) : compressed.slice(0, 5).map((c) => c.narrative || c.title).filter(Boolean).join(" · ").slice(0, 300);
	try {
		const existingCrystal = await kv.get(KV.crystals, crystalId);
		const crystal = {
			id: crystalId,
			narrative: narrativePreview || `Session ${sessionId.slice(0, 12)} (${rawObs.length} observations)`,
			keyOutcomes: Array.from(tools).slice(0, 8),
			filesAffected: Array.from(files).slice(0, 20),
			lessons: lessonIds,
			sourceActionIds: existingCrystal?.sourceActionIds ?? [],
			sessionId,
			project,
			createdAt: existingCrystal?.createdAt ?? createdAt
		};
		await kv.set(KV.crystals, crystalId, crystal);
	} catch {}
}
function isRawShape(o) {
	if (!o || typeof o !== "object") return false;
	return typeof o.hookType === "string";
}
async function loadObservations(kv, sessionId) {
	return (await kv.list(KV.observations(sessionId))).map((r) => isRawShape(r) ? r : rawFromCompressed(r));
}
async function findJsonlFiles(root, limit = 200) {
	const out = [];
	let discovered = 0;
	let walked = 0;
	const traversalCap = Math.max(limit * 50, 5e4);
	async function walk(dir) {
		if (walked >= traversalCap) return;
		let names;
		try {
			names = await readdir(dir);
		} catch {
			return;
		}
		for (const name of names) {
			if (walked >= traversalCap) return;
			walked++;
			const full = join(dir, name);
			let st;
			try {
				st = await lstat(full);
			} catch {
				continue;
			}
			if (st.isSymbolicLink()) continue;
			if (st.isDirectory()) await walk(full);
			else if (st.isFile() && name.endsWith(".jsonl")) {
				discovered++;
				if (out.length < limit) out.push(full);
			}
		}
	}
	await walk(root);
	const traversalCapped = walked >= traversalCap;
	return {
		files: out,
		truncated: discovered > out.length || traversalCapped,
		discovered,
		traversalCapped
	};
}
function registerReplayFunctions(sdk, kv) {
	sdk.registerFunction("mem::replay::load", async (data) => {
		if (!data?.sessionId || typeof data.sessionId !== "string") return {
			success: false,
			error: "sessionId is required"
		};
		const session = await kv.get(KV.sessions, data.sessionId);
		return {
			success: true,
			timeline: projectTimeline(await loadObservations(kv, data.sessionId)),
			session
		};
	});
	sdk.registerFunction("mem::replay::sessions", async () => {
		const sessions = await kv.list(KV.sessions);
		sessions.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
		return {
			success: true,
			sessions
		};
	});
	sdk.registerFunction("mem::replay::import-jsonl", async (data = {}) => {
		const defaultRoot = join(homedir(), ".claude", "projects");
		const rawPath = data.path || defaultRoot;
		if (typeof rawPath !== "string" || rawPath.length === 0) return {
			success: false,
			error: "path must be a non-empty string"
		};
		const abs = resolve(rawPath.startsWith("~") ? join(homedir(), rawPath.slice(1)) : rawPath);
		if (isSensitive(abs)) return {
			success: false,
			error: "refusing to process sensitive-looking path"
		};
		if (await isSymlink(abs)) return {
			success: false,
			error: "symlinks are not supported"
		};
		let stat;
		try {
			stat = await lstat(abs);
		} catch {
			return {
				success: false,
				error: "path not found"
			};
		}
		const maxFiles = Number.isInteger(data.maxFiles) && data.maxFiles > 0 ? Math.min(data.maxFiles, MAX_FILES_UPPER_BOUND) : MAX_FILES_DEFAULT;
		let files = [];
		let truncated = false;
		let discovered = 0;
		let traversalCapped = false;
		if (stat.isDirectory()) {
			const found = await findJsonlFiles(abs, maxFiles);
			files = found.files;
			truncated = found.truncated;
			discovered = found.discovered;
			traversalCapped = found.traversalCapped;
		} else if (stat.isFile() && abs.endsWith(".jsonl")) {
			files = [abs];
			discovered = 1;
		} else return {
			success: false,
			error: "path must be a .jsonl file or directory"
		};
		if (files.length === 0) return {
			success: true,
			imported: 0,
			sessionIds: [],
			observations: 0,
			discovered,
			truncated,
			traversalCapped,
			maxFiles,
			maxFilesUpperBound: MAX_FILES_UPPER_BOUND
		};
		const sessionIds = [];
		let observationCount = 0;
		for (const file of files) {
			if (isSensitive(file)) continue;
			if (await isSymlink(file)) continue;
			let text;
			try {
				text = await readFile(file, "utf-8");
			} catch (err) {
				logger.warn("replay: failed to read jsonl", {
					file,
					error: err instanceof Error ? err.message : String(err)
				});
				continue;
			}
			const parsed = parseJsonlText(text, generateId("sess"));
			if (parsed.observations.length === 0) continue;
			const firstPromptObs = parsed.observations.find((o) => typeof o.userPrompt === "string" && o.userPrompt.trim().length > 0);
			const firstPrompt = firstPromptObs?.userPrompt ? firstPromptObs.userPrompt.replace(/\s+/g, " ").trim().slice(0, 200) : void 0;
			const existing = await kv.get(KV.sessions, parsed.sessionId);
			if (existing) {
				existing.observationCount = (existing.observationCount || 0) + parsed.observations.length;
				if (parsed.endedAt > (existing.endedAt || "")) existing.endedAt = parsed.endedAt;
				if (existing.status === "active") existing.status = "completed";
				const existingTags = existing.tags || [];
				if (!existingTags.includes("jsonl-import")) existing.tags = [...existingTags, "jsonl-import"];
				if (!existing.firstPrompt && firstPrompt) existing.firstPrompt = firstPrompt;
				await kv.set(KV.sessions, existing.id, existing);
			} else {
				const session = {
					id: parsed.sessionId,
					project: parsed.project,
					cwd: parsed.cwd,
					startedAt: parsed.startedAt,
					endedAt: parsed.endedAt,
					status: "completed",
					observationCount: parsed.observations.length,
					tags: ["jsonl-import"],
					firstPrompt
				};
				await kv.set(KV.sessions, session.id, session);
			}
			const searchIndex = getSearchIndex();
			const compressed = [];
			await Promise.all(parsed.observations.map(async (obs) => {
				const synthetic = buildSyntheticCompression(obs);
				compressed.push(synthetic);
				await kv.set(KV.observations(parsed.sessionId), obs.id, synthetic);
				searchIndex.add(synthetic);
			}));
			observationCount += parsed.observations.length;
			sessionIds.push(parsed.sessionId);
			await deriveCrystalAndLessons(kv, parsed.sessionId, parsed.project, parsed.observations, compressed, firstPrompt);
		}
		await safeAudit(kv, "import", "mem::replay::import-jsonl", sessionIds, {
			source: "jsonl",
			path: abs,
			files: files.length,
			observations: observationCount
		});
		return {
			success: true,
			imported: files.length,
			sessionIds,
			observations: observationCount,
			discovered,
			truncated,
			traversalCapped,
			maxFiles,
			maxFilesUpperBound: MAX_FILES_UPPER_BOUND
		};
	});
}

//#endregion
//#region src/health/thresholds.ts
const DEFAULTS = {
	eventLoopLagWarnMs: 100,
	eventLoopLagCriticalMs: 500,
	cpuWarnPercent: 80,
	cpuCriticalPercent: 90,
	memoryWarnPercent: 80,
	memoryCriticalPercent: 95,
	memoryRssFloorBytes: 512 * 1024 * 1024
};
function evaluateHealth(snapshot, config = {}) {
	const cfg = {
		...DEFAULTS,
		...config
	};
	const alerts = [];
	const notes = [];
	let critical = false;
	let degraded = false;
	if (snapshot.connectionState === "disconnected" || snapshot.connectionState === "failed") {
		alerts.push(`connection_${snapshot.connectionState}`);
		critical = true;
	} else if (snapshot.connectionState === "reconnecting") {
		alerts.push("connection_reconnecting");
		degraded = true;
	}
	if (snapshot.eventLoopLagMs > cfg.eventLoopLagCriticalMs) {
		alerts.push(`event_loop_lag_critical_${Math.round(snapshot.eventLoopLagMs)}ms`);
		critical = true;
	} else if (snapshot.eventLoopLagMs > cfg.eventLoopLagWarnMs) {
		alerts.push(`event_loop_lag_warn_${Math.round(snapshot.eventLoopLagMs)}ms`);
		degraded = true;
	}
	if (snapshot.cpu.percent > cfg.cpuCriticalPercent) {
		alerts.push(`cpu_critical_${Math.round(snapshot.cpu.percent)}%`);
		critical = true;
	} else if (snapshot.cpu.percent > cfg.cpuWarnPercent) {
		alerts.push(`cpu_warn_${Math.round(snapshot.cpu.percent)}%`);
		degraded = true;
	}
	const memPercent = snapshot.memory.heapTotal > 0 ? snapshot.memory.heapUsed / snapshot.memory.heapTotal * 100 : 0;
	const rss = snapshot.memory.rss ?? 0;
	const rssAboveFloor = rss >= cfg.memoryRssFloorBytes;
	const memMb = Math.round(rss / (1024 * 1024));
	if (memPercent > cfg.memoryCriticalPercent && rssAboveFloor) {
		alerts.push(`memory_critical_${Math.round(memPercent)}%_rss${memMb}mb`);
		critical = true;
	} else if (memPercent > cfg.memoryWarnPercent && rssAboveFloor) {
		alerts.push(`memory_warn_${Math.round(memPercent)}%_rss${memMb}mb`);
		degraded = true;
	} else if (memPercent > cfg.memoryWarnPercent) notes.push(`memory_heap_tight_${Math.round(memPercent)}%_rss${memMb}mb`);
	return {
		status: critical ? "critical" : degraded ? "degraded" : "healthy",
		alerts,
		notes
	};
}

//#endregion
//#region src/health/monitor.ts
function registerHealthMonitor(sdk, kv) {
	let connectionState = "connected";
	let prevCpuUsage = process.cpuUsage();
	let prevCpuTime = Date.now();
	if (typeof sdk.on === "function") sdk.on("connection_state", (state) => {
		connectionState = state;
	});
	async function collectHealth() {
		const mem = process.memoryUsage();
		const currentCpu = process.cpuUsage();
		const now = Date.now();
		const uptime = process.uptime();
		const elapsedMs = now - prevCpuTime;
		const userDelta = currentCpu.user - prevCpuUsage.user;
		const systemDelta = currentCpu.system - prevCpuUsage.system;
		const cpuPercent = elapsedMs > 0 ? (userDelta + systemDelta) / 1e3 / elapsedMs * 100 : 0;
		prevCpuUsage = currentCpu;
		prevCpuTime = now;
		const startMark = performance.now();
		await new Promise((resolve) => setImmediate(resolve));
		const eventLoopLagMs = performance.now() - startMark;
		let workers = [];
		try {
			const result = await sdk.trigger({
				function_id: "engine::workers::list",
				payload: {}
			});
			if (result?.workers) workers = result.workers;
		} catch {}
		const KV_PROBE_TIMEOUT = 5e3;
		let kvConnectivity;
		const kvStart = performance.now();
		try {
			await Promise.race([(async () => {
				await kv.set(KV.health, "_probe", { ts: Date.now() });
				await kv.get(KV.health, "_probe");
			})(), new Promise((_, reject) => setTimeout(() => reject(/* @__PURE__ */ new Error("timeout")), KV_PROBE_TIMEOUT))]);
			kvConnectivity = {
				status: "ok",
				latencyMs: Math.round((performance.now() - kvStart) * 100) / 100
			};
		} catch {
			kvConnectivity = {
				status: "error",
				error: "kv_probe_failed",
				latencyMs: Math.round((performance.now() - kvStart) * 100) / 100
			};
		}
		const snapshot = {
			connectionState,
			workers,
			memory: {
				heapUsed: mem.heapUsed,
				heapTotal: mem.heapTotal,
				rss: mem.rss,
				external: mem.external
			},
			cpu: {
				userMicros: currentCpu.user,
				systemMicros: currentCpu.system,
				percent: Math.round(cpuPercent * 100) / 100
			},
			eventLoopLagMs,
			uptimeSeconds: uptime,
			kvConnectivity,
			status: "healthy",
			alerts: []
		};
		const evaluated = evaluateHealth(snapshot);
		snapshot.status = evaluated.status;
		snapshot.alerts = evaluated.alerts;
		snapshot.notes = evaluated.notes;
		await kv.set(KV.health, "latest", snapshot).catch(() => {});
		return snapshot;
	}
	collectHealth().catch(() => {});
	const interval = setInterval(() => {
		collectHealth().catch(() => {});
	}, 3e4);
	interval.unref();
	return { stop: () => clearInterval(interval) };
}
async function getLatestHealth(kv) {
	return kv.get(KV.health, "latest");
}

//#endregion
//#region src/auth.ts
const hmacKey = randomBytes(32);
const VIEWER_NONCE_PLACEHOLDER = "__AGENTMEMORY_VIEWER_NONCE__";
function timingSafeCompare(a, b) {
	return timingSafeEqual(createHmac("sha256", hmacKey).update(a).digest(), createHmac("sha256", hmacKey).update(b).digest());
}
function createViewerNonce() {
	return randomBytes(16).toString("base64url");
}
function buildViewerCsp(nonce) {
	return [
		"default-src 'none'",
		"base-uri 'none'",
		"frame-ancestors 'none'",
		"object-src 'none'",
		"form-action 'none'",
		`script-src 'nonce-${nonce}'`,
		"script-src-attr 'none'",
		"style-src 'unsafe-inline'",
		"connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*",
		"img-src 'self'",
		"font-src 'self'"
	].join("; ");
}

//#endregion
//#region src/viewer/document.ts
const VIEWER_VERSION_PLACEHOLDER = "__AGENTMEMORY_VERSION__";
function loadViewerTemplate() {
	const base = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		join(base, "..", "src", "viewer", "index.html"),
		join(base, "..", "viewer", "index.html"),
		join(base, "viewer", "index.html")
	];
	for (const path of candidates) try {
		return readFileSync(path, "utf-8");
	} catch {}
	return null;
}
function renderViewerDocument() {
	const template = loadViewerTemplate();
	if (!template) return { found: false };
	const nonce = createViewerNonce();
	return {
		found: true,
		html: template.replaceAll(VIEWER_NONCE_PLACEHOLDER, nonce).replaceAll(VIEWER_VERSION_PLACEHOLDER, VERSION),
		csp: buildViewerCsp(nonce)
	};
}

//#endregion
//#region src/triggers/api.ts
function parseOptionalInt(raw) {
	if (raw === void 0 || raw === null || raw === "") return void 0;
	const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
	return Number.isFinite(n) ? n : void 0;
}
function checkAuth(req, secret) {
	if (!secret) return null;
	const auth = req.headers?.["authorization"] || req.headers?.["Authorization"];
	if (typeof auth !== "string" || !timingSafeCompare(auth, `Bearer ${secret}`)) return {
		status_code: 401,
		body: { error: "unauthorized" }
	};
	return null;
}
function requireConfiguredSecret(secret, feature) {
	if (secret) return null;
	return {
		status_code: 503,
		body: { error: `${feature} requires AGENTMEMORY_SECRET` }
	};
}
function flagDisabledResponse(opts) {
	return {
		status_code: 503,
		body: opts
	};
}
function graphDisabledResponse() {
	return flagDisabledResponse({
		error: "Knowledge graph not enabled",
		flag: "GRAPH_EXTRACTION_ENABLED",
		enableHow: "Set GRAPH_EXTRACTION_ENABLED=true and restart. Requires an LLM provider key.",
		docsHref: "https://github.com/rohitg00/agentmemory#knowledge-graph"
	});
}
function consolidationDisabledResponse() {
	return flagDisabledResponse({
		error: "Consolidation pipeline not enabled",
		flag: "CONSOLIDATION_ENABLED",
		enableHow: "Set CONSOLIDATION_ENABLED=true and restart. Requires an LLM provider key.",
		docsHref: "https://github.com/rohitg00/agentmemory#consolidation"
	});
}
function asNonEmptyString$1(value) {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}
function parseOptionalFiniteNumber(value) {
	if (value === void 0 || value === null) return void 0;
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "string") {
		const trimmed = value.trim();
		if (!trimmed) return void 0;
		const parsed = Number(trimmed);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}
function parseOptionalPositiveInt(value) {
	const parsed = parseOptionalFiniteNumber(value);
	if (parsed === void 0 || parsed === null) return parsed;
	if (!Number.isInteger(parsed) || parsed < 1) return null;
	return parsed;
}
function registerApiTriggers(sdk, kv, secret, metricsStore, provider) {
	sdk.registerFunction("middleware::api-auth", async (input) => {
		if (!secret) return { action: "continue" };
		const headers = input?.request?.headers || {};
		const auth = headers["authorization"] || headers["Authorization"];
		if (typeof auth !== "string" || !timingSafeCompare(auth, `Bearer ${secret}`)) return {
			action: "respond",
			response: {
				status_code: 401,
				body: { error: "unauthorized" }
			}
		};
		return { action: "continue" };
	});
	sdk.registerFunction("api::liveness", async () => ({
		status_code: 200,
		body: {
			status: "ok",
			service: "agentmemory"
		}
	}));
	sdk.registerTrigger({
		type: "http",
		function_id: "api::liveness",
		config: {
			api_path: "/agentmemory/livez",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::config-flags", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: {
				version: VERSION,
				provider: detectLlmProviderKind(),
				embeddingProvider: detectEmbeddingProvider() ? "embeddings" : "none",
				flags: [
					{
						key: "GRAPH_EXTRACTION_ENABLED",
						label: "Knowledge graph extraction",
						enabled: isGraphExtractionEnabled(),
						default: false,
						affects: ["Graph", "Dashboard"],
						needsLlm: true,
						description: "Extracts entities and relations from observations into a knowledge graph.",
						enableHow: "Set GRAPH_EXTRACTION_ENABLED=true and provide an LLM key, then restart.",
						docsHref: "https://github.com/rohitg00/agentmemory#knowledge-graph"
					},
					{
						key: "CONSOLIDATION_ENABLED",
						label: "Memory consolidation",
						enabled: isConsolidationEnabled(),
						default: false,
						affects: [
							"Dashboard",
							"Memories",
							"Crystals"
						],
						needsLlm: true,
						description: "Periodically summarizes sessions into semantic facts + procedures.",
						enableHow: "Set CONSOLIDATION_ENABLED=true and provide an LLM key, then restart.",
						docsHref: "https://github.com/rohitg00/agentmemory#consolidation"
					},
					{
						key: "AGENTMEMORY_AUTO_COMPRESS",
						label: "LLM-powered observation compression",
						enabled: isAutoCompressEnabled(),
						default: false,
						affects: ["Memories", "Timeline"],
						needsLlm: true,
						description: "Every observation is compressed by the LLM for richer summaries (costs tokens). OFF uses zero-LLM synthetic compression.",
						enableHow: "Set AGENTMEMORY_AUTO_COMPRESS=true and provide an LLM key.",
						docsHref: "https://github.com/rohitg00/agentmemory/issues/138"
					},
					{
						key: "AGENTMEMORY_INJECT_CONTEXT",
						label: "In-conversation context injection",
						enabled: isContextInjectionEnabled(),
						default: false,
						affects: ["Hooks"],
						needsLlm: false,
						description: "Hooks write recalled context into Claude Code's conversation. OFF captures in the background without injecting.",
						enableHow: "Set AGENTMEMORY_INJECT_CONTEXT=true and restart.",
						docsHref: "https://github.com/rohitg00/agentmemory/issues/143"
					}
				]
			}
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::config-flags",
		config: {
			api_path: "/agentmemory/config/flags",
			http_method: "GET",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::health", async (req) => {
		const health = await getLatestHealth(kv);
		const functionMetrics = metricsStore ? await metricsStore.getAll() : [];
		const circuitBreaker = provider && "circuitState" in provider ? provider.circuitState : null;
		const status = health?.status || "healthy";
		return {
			status_code: status === "critical" ? 503 : 200,
			body: {
				status,
				service: "agentmemory",
				version: VERSION,
				health: health || null,
				functionMetrics,
				circuitBreaker
			}
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::health",
		config: {
			api_path: "/agentmemory/health",
			http_method: "GET",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::observe", async (req) => {
		const body = req.body ?? {};
		const hookType = asNonEmptyString$1(body.hookType);
		const sessionId = asNonEmptyString$1(body.sessionId);
		const project = asNonEmptyString$1(body.project);
		const cwd = asNonEmptyString$1(body.cwd);
		const timestamp = asNonEmptyString$1(body.timestamp);
		if (!hookType || !sessionId || !project || !cwd || !timestamp) return {
			status_code: 400,
			body: { error: "hookType, sessionId, project, cwd, and timestamp are required strings" }
		};
		const payload = {
			hookType,
			sessionId,
			project,
			cwd,
			timestamp,
			data: body.data
		};
		return {
			status_code: 201,
			body: await sdk.trigger({
				function_id: "mem::observe",
				payload
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::observe",
		config: {
			api_path: "/agentmemory/observe",
			http_method: "POST",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::context", async (req) => {
		const body = req.body ?? {};
		const sessionId = asNonEmptyString$1(body.sessionId);
		const project = asNonEmptyString$1(body.project);
		if (!sessionId || !project) return {
			status_code: 400,
			body: { error: "sessionId and project are required strings" }
		};
		const budget = parseOptionalPositiveInt(body.budget);
		if (budget === null) return {
			status_code: 400,
			body: { error: "budget must be a positive integer" }
		};
		const payload = {
			sessionId,
			project
		};
		if (budget !== void 0) payload.budget = budget;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::context",
				payload
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::context",
		config: {
			api_path: "/agentmemory/context",
			http_method: "POST",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::search", async (req) => {
		const body = req.body ?? {};
		if (typeof body.query !== "string" || !body.query.trim()) return {
			status_code: 400,
			body: { error: "query is required and must be a non-empty string" }
		};
		if (body.limit !== void 0 && (!Number.isInteger(body.limit) || body.limit < 1)) return {
			status_code: 400,
			body: { error: "limit must be a positive integer" }
		};
		if (body.project !== void 0 && typeof body.project !== "string") return {
			status_code: 400,
			body: { error: "project must be a string" }
		};
		if (body.cwd !== void 0 && typeof body.cwd !== "string") return {
			status_code: 400,
			body: { error: "cwd must be a string" }
		};
		if (body.format !== void 0 && (typeof body.format !== "string" || ![
			"full",
			"compact",
			"narrative"
		].includes(body.format.trim().toLowerCase()))) return {
			status_code: 400,
			body: { error: "format must be one of: full, compact, narrative" }
		};
		if (body.token_budget !== void 0 && (!Number.isInteger(body.token_budget) || body.token_budget < 1)) return {
			status_code: 400,
			body: { error: "token_budget must be a positive integer" }
		};
		const payload = {
			query: body.query.trim(),
			limit: body.limit,
			project: body.project,
			cwd: body.cwd,
			format: typeof body.format === "string" ? body.format.trim().toLowerCase() : void 0,
			token_budget: body.token_budget
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::search",
				payload
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::search",
		config: {
			api_path: "/agentmemory/search",
			http_method: "POST",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::compress-file", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const filePath = asNonEmptyString$1((req.body ?? {}).filePath);
		if (!filePath) return {
			status_code: 400,
			body: { error: "filePath is required and must be a non-empty string" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::compress-file",
				payload: { filePath }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::compress-file",
		config: {
			api_path: "/agentmemory/compress-file",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::replay::load", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const sessionId = asNonEmptyString$1(req.query_params?.["sessionId"]);
		if (!sessionId) return {
			status_code: 400,
			body: { error: "sessionId is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::replay::load",
				payload: { sessionId }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::replay::load",
		config: {
			api_path: "/agentmemory/replay/load",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::replay::sessions", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const sessions = await kv.list(KV.sessions);
		sessions.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
		return {
			status_code: 200,
			body: {
				success: true,
				sessions
			}
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::replay::sessions",
		config: {
			api_path: "/agentmemory/replay/sessions",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::replay::import", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const body = req.body ?? {};
		const payload = {};
		if (body.path !== void 0) {
			if (typeof body.path !== "string" || body.path.trim().length === 0) return {
				status_code: 400,
				body: { error: "path must be a non-empty string" }
			};
			payload.path = body.path.trim();
		}
		if (body.maxFiles !== void 0) {
			const n = body.maxFiles;
			if (!Number.isInteger(n) || n < 1 || n > MAX_FILES_UPPER_BOUND) return {
				status_code: 400,
				body: { error: `maxFiles must be an integer between 1 and ${MAX_FILES_UPPER_BOUND}` }
			};
			payload.maxFiles = n;
		}
		return {
			status_code: 202,
			body: await sdk.trigger({
				function_id: "mem::replay::import-jsonl",
				payload
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::replay::import",
		config: {
			api_path: "/agentmemory/replay/import-jsonl",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::session::start", async (req) => {
		const body = req.body ?? {};
		const sessionId = asNonEmptyString$1(body.sessionId);
		const project = asNonEmptyString$1(body.project);
		const cwd = asNonEmptyString$1(body.cwd);
		if (!sessionId || !project || !cwd) return {
			status_code: 400,
			body: { error: "sessionId, project, and cwd are required non-empty strings" }
		};
		const session = {
			id: sessionId,
			project,
			cwd,
			startedAt: (/* @__PURE__ */ new Date()).toISOString(),
			status: "active",
			observationCount: 0
		};
		await kv.set(KV.sessions, sessionId, session);
		return {
			status_code: 200,
			body: {
				session,
				context: (await sdk.trigger({
					function_id: "mem::context",
					payload: {
						sessionId,
						project
					}
				})).context
			}
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::session::start",
		config: {
			api_path: "/agentmemory/session/start",
			http_method: "POST",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::session::end", async (req) => {
		const sessionId = asNonEmptyString$1(req.body?.sessionId);
		if (!sessionId) return {
			status_code: 400,
			body: { error: "sessionId is required and must be a non-empty string" }
		};
		await kv.update(KV.sessions, sessionId, [{
			type: "set",
			path: "endedAt",
			value: (/* @__PURE__ */ new Date()).toISOString()
		}, {
			type: "set",
			path: "status",
			value: "completed"
		}]);
		return {
			status_code: 200,
			body: { success: true }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::session::end",
		config: {
			api_path: "/agentmemory/session/end",
			http_method: "POST",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::summarize", async (req) => {
		const sessionId = asNonEmptyString$1(req.body?.sessionId);
		if (!sessionId) return {
			status_code: 400,
			body: { error: "sessionId is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::summarize",
				payload: { sessionId }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::summarize",
		config: {
			api_path: "/agentmemory/summarize",
			http_method: "POST",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::session::commit", async (req) => {
		const body = req.body ?? {};
		const sha = asNonEmptyString$1(body.sha);
		if (!sha) return {
			status_code: 400,
			body: { error: "sha is required and must be a non-empty string" }
		};
		const sessionId = asNonEmptyString$1(body.sessionId) ?? void 0;
		const branch = asNonEmptyString$1(body.branch) ?? void 0;
		const repo = asNonEmptyString$1(body.repo) ?? void 0;
		const message = asNonEmptyString$1(body.message) ?? void 0;
		const author = asNonEmptyString$1(body.author) ?? void 0;
		const authoredAt = asNonEmptyString$1(body.authoredAt) ?? void 0;
		const files = Array.isArray(body.files) ? body.files.filter((f) => typeof f === "string" && f.length > 0) : void 0;
		const link = await withKeyedLock(`commit:${sha}`, async () => {
			const existing = await kv.get(KV.commits, sha);
			const sessionSet = new Set(existing?.sessionIds ?? []);
			if (sessionId) sessionSet.add(sessionId);
			const merged = {
				sha,
				shortSha: existing?.shortSha ?? sha.slice(0, 7),
				branch: branch ?? existing?.branch,
				repo: repo ?? existing?.repo,
				message: message ?? existing?.message,
				author: author ?? existing?.author,
				authoredAt: authoredAt ?? existing?.authoredAt,
				files: files ?? existing?.files,
				sessionIds: Array.from(sessionSet),
				linkedAt: existing?.linkedAt ?? (/* @__PURE__ */ new Date()).toISOString()
			};
			await kv.set(KV.commits, sha, merged);
			return merged;
		});
		if (sessionId) await withKeyedLock(`session:${sessionId}`, async () => {
			const session = await kv.get(KV.sessions, sessionId);
			if (!session) return;
			const shaSet = new Set(session.commitShas ?? []);
			shaSet.add(sha);
			session.commitShas = Array.from(shaSet);
			await kv.set(KV.sessions, sessionId, session);
		});
		return {
			status_code: 200,
			body: { commit: link }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::session::commit",
		config: {
			api_path: "/agentmemory/session/commit",
			http_method: "POST",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::session::by-commit", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const sha = asNonEmptyString$1(req.query_params?.["sha"]);
		if (!sha) return {
			status_code: 400,
			body: { error: "sha is required and must be a non-empty string" }
		};
		const link = await kv.get(KV.commits, sha);
		if (!link) return {
			status_code: 404,
			body: { error: "no sessions linked to this commit" }
		};
		return {
			status_code: 200,
			body: {
				commit: link,
				sessions: (await Promise.all((link.sessionIds ?? []).map((sid) => kv.get(KV.sessions, sid)))).filter((s) => s !== null)
			}
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::session::by-commit",
		config: {
			api_path: "/agentmemory/session/by-commit",
			http_method: "GET",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::commits", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const branch = asNonEmptyString$1(req.query_params?.["branch"]);
		const repo = asNonEmptyString$1(req.query_params?.["repo"]);
		const rawLimit = parseOptionalInt(req.query_params?.["limit"]);
		const limit = Math.max(1, Math.min(500, rawLimit ?? 100));
		return {
			status_code: 200,
			body: { commits: (await kv.list(KV.commits)).filter((c) => !branch || c.branch === branch).filter((c) => !repo || c.repo === repo).sort((a, b) => (a.linkedAt ?? "") < (b.linkedAt ?? "") ? 1 : -1).slice(0, limit) }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::commits",
		config: {
			api_path: "/agentmemory/commits",
			http_method: "GET",
			middleware_function_ids: ["middleware::api-auth"]
		}
	});
	sdk.registerFunction("api::sessions", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: { sessions: await kv.list(KV.sessions) }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sessions",
		config: {
			api_path: "/agentmemory/sessions",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::observations", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const sessionId = asNonEmptyString$1(req.query_params?.["sessionId"]);
		if (!sessionId) return {
			status_code: 400,
			body: { error: "sessionId required" }
		};
		return {
			status_code: 200,
			body: { observations: await kv.list(KV.observations(sessionId)) }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::observations",
		config: {
			api_path: "/agentmemory/observations",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::file-context", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::file-context",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::file-context",
		config: {
			api_path: "/agentmemory/file-context",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::enrich", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.sessionId || typeof req.body.sessionId !== "string" || !Array.isArray(req.body?.files) || req.body.files.length === 0 || !req.body.files.every((f) => typeof f === "string")) return {
			status_code: 400,
			body: { error: "sessionId (string) and files (string[]) are required" }
		};
		if (req.body.terms !== void 0 && (!Array.isArray(req.body.terms) || !req.body.terms.every((t) => typeof t === "string"))) return {
			status_code: 400,
			body: { error: "terms must be an array of strings" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::enrich",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::enrich",
		config: {
			api_path: "/agentmemory/enrich",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::remember", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.content || typeof req.body.content !== "string" || !req.body.content.trim()) return {
			status_code: 400,
			body: { error: "content is required" }
		};
		return {
			status_code: 201,
			body: await sdk.trigger({
				function_id: "mem::remember",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::remember",
		config: {
			api_path: "/agentmemory/remember",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::forget", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.sessionId && !req.body?.memoryId) return {
			status_code: 400,
			body: { error: "sessionId or memoryId is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::forget",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::forget",
		config: {
			api_path: "/agentmemory/forget",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::consolidate", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::consolidate",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::consolidate",
		config: {
			api_path: "/agentmemory/consolidate",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::patterns", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::patterns",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::patterns",
		config: {
			api_path: "/agentmemory/patterns",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::generate-rules", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::generate-rules",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::generate-rules",
		config: {
			api_path: "/agentmemory/generate-rules",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::migrate", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.dbPath || typeof req.body.dbPath !== "string") return {
			status_code: 400,
			body: { error: "dbPath is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::migrate",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::migrate",
		config: {
			api_path: "/agentmemory/migrate",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::evict", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const dryRun = req.query_params?.["dryRun"] === "true" || req.body?.dryRun === true;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::evict",
				payload: { dryRun }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::evict",
		config: {
			api_path: "/agentmemory/evict",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::smart-search", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.query && (!req.body?.expandIds || req.body.expandIds.length === 0)) return {
			status_code: 400,
			body: { error: "query or expandIds is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::smart-search",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::smart-search",
		config: {
			api_path: "/agentmemory/smart-search",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::timeline", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.anchor) return {
			status_code: 400,
			body: { error: "anchor is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::timeline",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::timeline",
		config: {
			api_path: "/agentmemory/timeline",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::profile", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const project = req.query_params["project"];
		if (!project) return {
			status_code: 400,
			body: { error: "project query param is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::profile",
				payload: { project }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::profile",
		config: {
			api_path: "/agentmemory/profile",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::export", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::export",
				payload: {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::export",
		config: {
			api_path: "/agentmemory/export",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::import", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.exportData) return {
			status_code: 400,
			body: { error: "exportData is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::import",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::import",
		config: {
			api_path: "/agentmemory/import",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::relations", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.sourceId || !req.body?.targetId || !req.body?.type) return {
			status_code: 400,
			body: { error: "sourceId, targetId, and type are required" }
		};
		return {
			status_code: 201,
			body: await sdk.trigger({
				function_id: "mem::relate",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::relations",
		config: {
			api_path: "/agentmemory/relations",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::evolve", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.memoryId || !req.body?.newContent) return {
			status_code: 400,
			body: { error: "memoryId and newContent are required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::evolve",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::evolve",
		config: {
			api_path: "/agentmemory/evolve",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::auto-forget", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const dryRun = req.query_params?.["dryRun"] === "true" || req.body?.dryRun === true;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::auto-forget",
				payload: { dryRun }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::auto-forget",
		config: {
			api_path: "/agentmemory/auto-forget",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::claude-bridge-read", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		try {
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::claude-bridge-read",
					payload: {}
				})
			};
		} catch {
			return {
				status_code: 404,
				body: { error: "Claude bridge not enabled" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::claude-bridge-read",
		config: {
			api_path: "/agentmemory/claude-bridge/read",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::claude-bridge-sync", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		try {
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::claude-bridge-sync",
					payload: {}
				})
			};
		} catch {
			return {
				status_code: 404,
				body: { error: "Claude bridge not enabled" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::claude-bridge-sync",
		config: {
			api_path: "/agentmemory/claude-bridge/sync",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::graph-query", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		try {
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::graph-query",
					payload: req.body || {}
				})
			};
		} catch {
			return graphDisabledResponse();
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::graph-query",
		config: {
			api_path: "/agentmemory/graph/query",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::graph-stats", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		try {
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::graph-stats",
					payload: {}
				})
			};
		} catch {
			return graphDisabledResponse();
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::graph-stats",
		config: {
			api_path: "/agentmemory/graph/stats",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::graph-extract", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!Array.isArray(req.body?.observations) || req.body.observations.length === 0) return {
			status_code: 400,
			body: { error: "observations array is required" }
		};
		try {
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::graph-extract",
					payload: req.body
				})
			};
		} catch {
			return graphDisabledResponse();
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::graph-extract",
		config: {
			api_path: "/agentmemory/graph/extract",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::consolidate-pipeline", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		try {
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::consolidate-pipeline",
					payload: req.body || {}
				})
			};
		} catch {
			return consolidationDisabledResponse();
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::consolidate-pipeline",
		config: {
			api_path: "/agentmemory/consolidate-pipeline",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::team-share", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.itemId || !req.body?.itemType) return {
			status_code: 400,
			body: { error: "itemId and itemType are required" }
		};
		try {
			return {
				status_code: 201,
				body: await sdk.trigger({
					function_id: "mem::team-share",
					payload: req.body
				})
			};
		} catch {
			return {
				status_code: 404,
				body: { error: "Team memory not enabled" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::team-share",
		config: {
			api_path: "/agentmemory/team/share",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::team-feed", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		try {
			const limit = parseOptionalInt(req.query_params?.["limit"]) ?? 20;
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::team-feed",
					payload: { limit }
				})
			};
		} catch {
			return {
				status_code: 404,
				body: { error: "Team memory not enabled" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::team-feed",
		config: {
			api_path: "/agentmemory/team/feed",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::team-profile", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		try {
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::team-profile",
					payload: {}
				})
			};
		} catch {
			return {
				status_code: 404,
				body: { error: "Team memory not enabled" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::team-profile",
		config: {
			api_path: "/agentmemory/team/profile",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::audit", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const parsedLimit = parseOptionalInt(req.query_params?.["limit"]);
		return {
			status_code: 200,
			body: {
				entries: await sdk.trigger({
					function_id: "mem::audit-query",
					payload: {
						operation: req.query_params?.["operation"],
						limit: parsedLimit ?? 50
					}
				}),
				success: true
			}
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::audit",
		config: {
			api_path: "/agentmemory/audit",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::governance-delete", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.memoryIds || !Array.isArray(req.body.memoryIds)) return {
			status_code: 400,
			body: { error: "memoryIds array is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::governance-delete",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::governance-delete",
		config: {
			api_path: "/agentmemory/governance/memories",
			http_method: "DELETE"
		}
	});
	sdk.registerFunction("api::governance-bulk", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::governance-bulk",
				payload: req.body || {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::governance-bulk",
		config: {
			api_path: "/agentmemory/governance/bulk-delete",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::snapshots", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		try {
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::snapshot-list",
					payload: {}
				})
			};
		} catch {
			return {
				status_code: 404,
				body: { error: "Snapshots not enabled" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::snapshots",
		config: {
			api_path: "/agentmemory/snapshots",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::snapshot-create", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		try {
			return {
				status_code: 201,
				body: await sdk.trigger({
					function_id: "mem::snapshot-create",
					payload: req.body || {}
				})
			};
		} catch {
			return {
				status_code: 404,
				body: { error: "Snapshots not enabled" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::snapshot-create",
		config: {
			api_path: "/agentmemory/snapshot/create",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::snapshot-restore", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.commitHash) return {
			status_code: 400,
			body: { error: "commitHash is required" }
		};
		try {
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::snapshot-restore",
					payload: req.body
				})
			};
		} catch {
			return {
				status_code: 404,
				body: { error: "Snapshots not enabled" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::snapshot-restore",
		config: {
			api_path: "/agentmemory/snapshot/restore",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::memories", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const memories = await kv.list(KV.memories);
		return {
			status_code: 200,
			body: { memories: req.query_params?.["latest"] === "true" ? memories.filter((m) => m.isLatest) : memories }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::memories",
		config: {
			api_path: "/agentmemory/memories",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::memory-by-id", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const id = req.path_params?.["id"];
		if (!id || typeof id !== "string") return {
			status_code: 400,
			body: { error: "id path parameter is required" }
		};
		const memory = await kv.get(KV.memories, id);
		if (!memory) return {
			status_code: 404,
			body: { error: `memory not found: ${id}` }
		};
		return {
			status_code: 200,
			body: { memory }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::memory-by-id",
		config: {
			api_path: "/agentmemory/memories/:id",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::semantic-list", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: { semantic: await kv.list(KV.semantic) }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::semantic-list",
		config: {
			api_path: "/agentmemory/semantic",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::procedural-list", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: { procedural: await kv.list(KV.procedural) }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::procedural-list",
		config: {
			api_path: "/agentmemory/procedural",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::relations-list", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: { relations: await kv.list(KV.relations) }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::relations-list",
		config: {
			api_path: "/agentmemory/relations",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::vision-search", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const body = req.body ?? {};
		const queryText = asNonEmptyString$1(body["queryText"]);
		const queryImageRef = asNonEmptyString$1(body["queryImageRef"]);
		const queryImageBase64 = asNonEmptyString$1(body["queryImageBase64"]);
		const sessionId = asNonEmptyString$1(body["sessionId"]);
		if (!queryText && !queryImageRef && !queryImageBase64) return {
			status_code: 400,
			body: { error: "queryText, queryImageRef, or queryImageBase64 required" }
		};
		const topKParsed = parseOptionalPositiveInt(body["topK"]);
		if (topKParsed === null) return {
			status_code: 400,
			body: { error: "topK must be a positive integer" }
		};
		const payload = {};
		if (queryText) payload["queryText"] = queryText;
		if (queryImageRef) payload["queryImageRef"] = queryImageRef;
		if (queryImageBase64) payload["queryImageBase64"] = queryImageBase64;
		if (sessionId) payload["sessionId"] = sessionId;
		if (topKParsed !== void 0) payload["topK"] = Math.min(50, topKParsed);
		const result = await sdk.trigger({
			function_id: "mem::vision-search",
			payload
		});
		const resp = result;
		if (resp?.success === false) return {
			status_code: resp.error?.includes("disabled") ? 503 : 400,
			body: resp
		};
		return {
			status_code: 200,
			body: result
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::vision-search",
		config: {
			api_path: "/agentmemory/vision-search",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::vision-embed", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const body = req.body ?? {};
		const imageRef = asNonEmptyString$1(body["imageRef"]);
		const sessionId = asNonEmptyString$1(body["sessionId"]);
		const observationId = asNonEmptyString$1(body["observationId"]);
		if (!imageRef) return {
			status_code: 400,
			body: { error: "imageRef is required" }
		};
		const payload = { imageRef };
		if (sessionId) payload["sessionId"] = sessionId;
		if (observationId) payload["observationId"] = observationId;
		const result = await sdk.trigger({
			function_id: "mem::vision-embed",
			payload
		});
		const resp = result;
		if (resp?.success === false) return {
			status_code: resp.error?.includes("disabled") ? 503 : 400,
			body: resp
		};
		return {
			status_code: 200,
			body: result
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::vision-embed",
		config: {
			api_path: "/agentmemory/vision-embed",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::slot-list", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::slot-list",
				payload: {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::slot-list",
		config: {
			api_path: "/agentmemory/slots",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::slot-get", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const label = asNonEmptyString$1(req.query_params?.["label"]);
		if (!label) return {
			status_code: 400,
			body: { error: "label query param required" }
		};
		const result = await sdk.trigger({
			function_id: "mem::slot-get",
			payload: { label }
		});
		const resp = result;
		if (resp?.success === false) return {
			status_code: resp.error?.includes("not found") ? 404 : 400,
			body: resp
		};
		return {
			status_code: 200,
			body: result
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::slot-get",
		config: {
			api_path: "/agentmemory/slot",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::slot-create", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const body = req.body ?? {};
		const label = asNonEmptyString$1(body["label"]);
		if (!label) return {
			status_code: 400,
			body: { error: "label required" }
		};
		if (body["content"] !== void 0 && typeof body["content"] !== "string") return {
			status_code: 400,
			body: { error: "content must be a string" }
		};
		if (body["description"] !== void 0 && typeof body["description"] !== "string") return {
			status_code: 400,
			body: { error: "description must be a string" }
		};
		if (body["pinned"] !== void 0 && typeof body["pinned"] !== "boolean") return {
			status_code: 400,
			body: { error: "pinned must be a boolean" }
		};
		if (body["scope"] !== void 0 && body["scope"] !== "project" && body["scope"] !== "global") return {
			status_code: 400,
			body: { error: "scope must be 'project' or 'global'" }
		};
		const sizeLimit = parseOptionalPositiveInt(body["sizeLimit"]);
		if (sizeLimit === null) return {
			status_code: 400,
			body: { error: "sizeLimit must be a positive integer" }
		};
		if (sizeLimit !== void 0 && sizeLimit > 2e4) return {
			status_code: 400,
			body: { error: "sizeLimit must be <= 20000" }
		};
		const payload = { label };
		if (typeof body["content"] === "string") payload["content"] = body["content"];
		if (typeof body["description"] === "string") payload["description"] = body["description"];
		if (sizeLimit !== void 0) payload["sizeLimit"] = sizeLimit;
		if (typeof body["pinned"] === "boolean") payload["pinned"] = body["pinned"];
		if (body["scope"] === "project" || body["scope"] === "global") payload["scope"] = body["scope"];
		const result = await sdk.trigger({
			function_id: "mem::slot-create",
			payload
		});
		const resp = result;
		if (resp?.success === false) return {
			status_code: resp.error?.includes("exists") ? 409 : 400,
			body: resp
		};
		return {
			status_code: 201,
			body: result
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::slot-create",
		config: {
			api_path: "/agentmemory/slot",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::slot-append", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const body = req.body ?? {};
		const label = asNonEmptyString$1(body["label"]);
		const text = typeof body["text"] === "string" ? body["text"] : null;
		if (!label || !text) return {
			status_code: 400,
			body: { error: "label and text required" }
		};
		const result = await sdk.trigger({
			function_id: "mem::slot-append",
			payload: {
				label,
				text
			}
		});
		const resp = result;
		if (resp?.success === false) {
			const notFound = resp.error?.includes("not found");
			const overLimit = resp.error?.includes("exceed");
			return {
				status_code: notFound ? 404 : overLimit ? 413 : 400,
				body: resp
			};
		}
		return {
			status_code: 200,
			body: result
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::slot-append",
		config: {
			api_path: "/agentmemory/slot/append",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::slot-replace", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const body = req.body ?? {};
		const label = asNonEmptyString$1(body["label"]);
		const content = body["content"];
		if (!label || typeof content !== "string") return {
			status_code: 400,
			body: { error: "label and content (string) required" }
		};
		const result = await sdk.trigger({
			function_id: "mem::slot-replace",
			payload: {
				label,
				content
			}
		});
		const resp = result;
		if (resp?.success === false) {
			const notFound = resp.error?.includes("not found");
			const overLimit = resp.error?.includes("exceed");
			return {
				status_code: notFound ? 404 : overLimit ? 413 : 400,
				body: resp
			};
		}
		return {
			status_code: 200,
			body: result
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::slot-replace",
		config: {
			api_path: "/agentmemory/slot/replace",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::slot-delete", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const label = asNonEmptyString$1(req.query_params?.["label"]);
		if (!label) return {
			status_code: 400,
			body: { error: "label query param required" }
		};
		const result = await sdk.trigger({
			function_id: "mem::slot-delete",
			payload: { label }
		});
		const resp = result;
		if (resp?.success === false) return {
			status_code: resp.error?.includes("not found") ? 404 : 400,
			body: resp
		};
		return {
			status_code: 200,
			body: result
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::slot-delete",
		config: {
			api_path: "/agentmemory/slot",
			http_method: "DELETE"
		}
	});
	sdk.registerFunction("api::slot-reflect", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const body = req.body ?? {};
		const sessionId = asNonEmptyString$1(body["sessionId"]);
		if (!sessionId) return {
			status_code: 400,
			body: { error: "sessionId required" }
		};
		const maxObservations = parseOptionalPositiveInt(body["maxObservations"]);
		if (maxObservations === null) return {
			status_code: 400,
			body: { error: "maxObservations must be a positive integer" }
		};
		const payload = { sessionId };
		if (maxObservations !== void 0) payload["maxObservations"] = maxObservations;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::slot-reflect",
				payload
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::slot-reflect",
		config: {
			api_path: "/agentmemory/slot/reflect",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::action-create", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.title) return {
			status_code: 400,
			body: { error: "title is required" }
		};
		return {
			status_code: 201,
			body: await sdk.trigger({
				function_id: "mem::action-create",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::action-create",
		config: {
			api_path: "/agentmemory/actions",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::action-update", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.actionId) return {
			status_code: 400,
			body: { error: "actionId is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::action-update",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::action-update",
		config: {
			api_path: "/agentmemory/actions/update",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::action-list", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::action-list",
				payload: {
					status: req.query_params?.["status"],
					project: req.query_params?.["project"],
					parentId: req.query_params?.["parentId"]
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::action-list",
		config: {
			api_path: "/agentmemory/actions",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::action-get", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const actionId = req.query_params?.["actionId"];
		if (!actionId) return {
			status_code: 400,
			body: { error: "actionId required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::action-get",
				payload: { actionId }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::action-get",
		config: {
			api_path: "/agentmemory/actions/get",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::action-edge", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.sourceActionId || !req.body?.targetActionId || !req.body?.type) return {
			status_code: 400,
			body: { error: "sourceActionId, targetActionId, and type are required" }
		};
		return {
			status_code: 201,
			body: await sdk.trigger({
				function_id: "mem::action-edge-create",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::action-edge",
		config: {
			api_path: "/agentmemory/actions/edges",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::frontier", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const parsedLimit = parseOptionalInt(req.query_params?.["limit"]);
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::frontier",
				payload: {
					project: req.query_params?.["project"],
					agentId: req.query_params?.["agentId"],
					limit: parsedLimit
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::frontier",
		config: {
			api_path: "/agentmemory/frontier",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::next", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::next",
				payload: {
					project: req.query_params?.["project"],
					agentId: req.query_params?.["agentId"]
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::next",
		config: {
			api_path: "/agentmemory/next",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::lease-acquire", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.actionId || !req.body?.agentId) return {
			status_code: 400,
			body: { error: "actionId and agentId are required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::lease-acquire",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::lease-acquire",
		config: {
			api_path: "/agentmemory/leases/acquire",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::lease-release", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.actionId || !req.body?.agentId) return {
			status_code: 400,
			body: { error: "actionId and agentId are required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::lease-release",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::lease-release",
		config: {
			api_path: "/agentmemory/leases/release",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::lease-renew", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.actionId || !req.body?.agentId) return {
			status_code: 400,
			body: { error: "actionId and agentId are required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::lease-renew",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::lease-renew",
		config: {
			api_path: "/agentmemory/leases/renew",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::routine-create", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.name || !req.body?.steps) return {
			status_code: 400,
			body: { error: "name and steps are required" }
		};
		return {
			status_code: 201,
			body: await sdk.trigger({
				function_id: "mem::routine-create",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::routine-create",
		config: {
			api_path: "/agentmemory/routines",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::routine-list", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::routine-list",
				payload: { frozen: req.query_params?.["frozen"] === "true" ? true : void 0 }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::routine-list",
		config: {
			api_path: "/agentmemory/routines",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::routine-run", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.routineId) return {
			status_code: 400,
			body: { error: "routineId is required" }
		};
		return {
			status_code: 201,
			body: await sdk.trigger({
				function_id: "mem::routine-run",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::routine-run",
		config: {
			api_path: "/agentmemory/routines/run",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::routine-status", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const runId = req.query_params?.["runId"];
		if (!runId) return {
			status_code: 400,
			body: { error: "runId query param required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::routine-status",
				payload: { runId }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::routine-status",
		config: {
			api_path: "/agentmemory/routines/status",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::signal-send", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.from || !req.body?.content) return {
			status_code: 400,
			body: { error: "from and content are required" }
		};
		return {
			status_code: 201,
			body: await sdk.trigger({
				function_id: "mem::signal-send",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::signal-send",
		config: {
			api_path: "/agentmemory/signals/send",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::signal-read", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const agentId = req.query_params?.["agentId"];
		if (!agentId) return {
			status_code: 400,
			body: { error: "agentId query param required" }
		};
		const parsedLimit = parseOptionalInt(req.query_params?.["limit"]);
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::signal-read",
				payload: {
					agentId,
					unreadOnly: req.query_params?.["unreadOnly"] === "true",
					threadId: req.query_params?.["threadId"],
					limit: parsedLimit
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::signal-read",
		config: {
			api_path: "/agentmemory/signals",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::checkpoint-create", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.name) return {
			status_code: 400,
			body: { error: "name is required" }
		};
		return {
			status_code: 201,
			body: await sdk.trigger({
				function_id: "mem::checkpoint-create",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::checkpoint-create",
		config: {
			api_path: "/agentmemory/checkpoints",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::checkpoint-resolve", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.checkpointId || !req.body?.status) return {
			status_code: 400,
			body: { error: "checkpointId and status are required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::checkpoint-resolve",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::checkpoint-resolve",
		config: {
			api_path: "/agentmemory/checkpoints/resolve",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::checkpoint-list", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::checkpoint-list",
				payload: {
					status: req.query_params?.["status"],
					type: req.query_params?.["type"]
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::checkpoint-list",
		config: {
			api_path: "/agentmemory/checkpoints",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::mesh-register", async (req) => {
		const secretErr = requireConfiguredSecret(secret, "mesh");
		if (secretErr) return secretErr;
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body?.url || !req.body?.name) return {
			status_code: 400,
			body: { error: "url and name are required" }
		};
		return {
			status_code: 201,
			body: await sdk.trigger({
				function_id: "mem::mesh-register",
				payload: req.body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::mesh-register",
		config: {
			api_path: "/agentmemory/mesh/peers",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::mesh-list", async (req) => {
		const secretErr = requireConfiguredSecret(secret, "mesh");
		if (secretErr) return secretErr;
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::mesh-list",
				payload: {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::mesh-list",
		config: {
			api_path: "/agentmemory/mesh/peers",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::mesh-sync", async (req) => {
		const secretErr = requireConfiguredSecret(secret, "mesh");
		if (secretErr) return secretErr;
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::mesh-sync",
				payload: req.body || {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::mesh-sync",
		config: {
			api_path: "/agentmemory/mesh/sync",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::mesh-receive", async (req) => {
		const secretErr = requireConfiguredSecret(secret, "mesh");
		if (secretErr) return secretErr;
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::mesh-receive",
				payload: req.body || {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::mesh-receive",
		config: {
			api_path: "/agentmemory/mesh/receive",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::mesh-export", async (req) => {
		const secretErr = requireConfiguredSecret(secret, "mesh");
		if (secretErr) return secretErr;
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const since = req.query_params?.["since"];
		if (since) {
			const parsed = new Date(since).getTime();
			if (Number.isNaN(parsed)) return {
				status_code: 400,
				body: { error: "Invalid 'since' date format" }
			};
		}
		const project = req.query_params?.["project"];
		const sinceTime = since ? new Date(since).getTime() : 0;
		const df = (items, field) => items.filter((i) => new Date(i[field]).getTime() > sinceTime);
		const memories = await kv.list(KV.memories);
		let actions = await kv.list(KV.actions);
		if (project) actions = actions.filter((a) => a.project === project);
		const body = {
			memories: df(memories, "updatedAt"),
			actions: df(actions, "updatedAt")
		};
		if (!project) {
			const semantic = await kv.list(KV.semantic);
			const procedural = await kv.list(KV.procedural);
			const relations = await kv.list(KV.relations);
			const graphNodes = await kv.list(KV.graphNodes);
			const graphEdges = await kv.list(KV.graphEdges);
			body.semantic = df(semantic, "updatedAt");
			body.procedural = df(procedural, "updatedAt");
			body.relations = df(relations, "createdAt");
			body.graphNodes = graphNodes.filter((n) => new Date(n.updatedAt || n.createdAt).getTime() > sinceTime);
			body.graphEdges = df(graphEdges, "createdAt");
		}
		return {
			status_code: 200,
			body
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::mesh-export",
		config: {
			api_path: "/agentmemory/mesh/export",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::flow-compress", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		try {
			return {
				status_code: 200,
				body: await sdk.trigger({
					function_id: "mem::flow-compress",
					payload: req.body || {}
				})
			};
		} catch {
			return {
				status_code: 404,
				body: { error: "Flow compression requires a provider" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::flow-compress",
		config: {
			api_path: "/agentmemory/flow/compress",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::branch-detect", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const cwd = req.query_params?.["cwd"] || process.cwd();
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::detect-worktree",
				payload: { cwd }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::branch-detect",
		config: {
			api_path: "/agentmemory/branch/detect",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::branch-worktrees", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const cwd = req.query_params?.["cwd"] || process.cwd();
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::list-worktrees",
				payload: { cwd }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::branch-worktrees",
		config: {
			api_path: "/agentmemory/branch/worktrees",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::branch-sessions", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const cwd = req.query_params?.["cwd"] || process.cwd();
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::branch-sessions",
				payload: { cwd }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::branch-sessions",
		config: {
			api_path: "/agentmemory/branch/sessions",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::viewer", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const rendered = renderViewerDocument();
		if (rendered.found) return {
			status_code: 200,
			headers: {
				"Content-Type": "text/html",
				"Content-Security-Policy": rendered.csp
			},
			body: rendered.html
		};
		return {
			status_code: 404,
			headers: { "Content-Type": "text/html" },
			body: "<!DOCTYPE html><html><body><h1>agentmemory</h1><p>viewer not found</p></body></html>"
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::viewer",
		config: {
			api_path: "/agentmemory/viewer",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::sentinel-create", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.name) return {
			status_code: 400,
			body: { error: "name is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sentinel-create",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sentinel-create",
		config: {
			api_path: "/agentmemory/sentinels",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::sentinel-trigger", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.sentinelId) return {
			status_code: 400,
			body: { error: "sentinelId is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sentinel-trigger",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sentinel-trigger",
		config: {
			api_path: "/agentmemory/sentinels/trigger",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::sentinel-check", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sentinel-check",
				payload: {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sentinel-check",
		config: {
			api_path: "/agentmemory/sentinels/check",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::sentinel-cancel", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.sentinelId) return {
			status_code: 400,
			body: { error: "sentinelId is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sentinel-cancel",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sentinel-cancel",
		config: {
			api_path: "/agentmemory/sentinels/cancel",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::sentinel-list", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const params = req.query_params || {};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sentinel-list",
				payload: {
					status: params.status,
					type: params.type
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sentinel-list",
		config: {
			api_path: "/agentmemory/sentinels",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::sketch-create", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.title) return {
			status_code: 400,
			body: { error: "title is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sketch-create",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sketch-create",
		config: {
			api_path: "/agentmemory/sketches",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::sketch-add", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.sketchId || !body?.title) return {
			status_code: 400,
			body: { error: "sketchId and title are required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sketch-add",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sketch-add",
		config: {
			api_path: "/agentmemory/sketches/add",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::sketch-promote", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.sketchId) return {
			status_code: 400,
			body: { error: "sketchId is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sketch-promote",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sketch-promote",
		config: {
			api_path: "/agentmemory/sketches/promote",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::sketch-discard", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.sketchId) return {
			status_code: 400,
			body: { error: "sketchId is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sketch-discard",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sketch-discard",
		config: {
			api_path: "/agentmemory/sketches/discard",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::sketch-list", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const params = req.query_params || {};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sketch-list",
				payload: {
					status: params.status,
					project: params.project
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sketch-list",
		config: {
			api_path: "/agentmemory/sketches",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::sketch-gc", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::sketch-gc",
				payload: {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::sketch-gc",
		config: {
			api_path: "/agentmemory/sketches/gc",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::crystallize", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.actionIds) return {
			status_code: 400,
			body: { error: "actionIds is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::crystallize",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::crystallize",
		config: {
			api_path: "/agentmemory/crystals/create",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::crystal-list", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const params = req.query_params || {};
		const limit = parseOptionalPositiveInt(params.limit);
		if (limit === null) return {
			status_code: 400,
			body: { error: "invalid numeric parameter: limit" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::crystal-list",
				payload: {
					project: params.project,
					sessionId: params.sessionId,
					limit
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::crystal-list",
		config: {
			api_path: "/agentmemory/crystals",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::auto-crystallize", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::auto-crystallize",
				payload: body || {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::auto-crystallize",
		config: {
			api_path: "/agentmemory/crystals/auto",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::diagnose", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::diagnose",
				payload: body || {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::diagnose",
		config: {
			api_path: "/agentmemory/diagnostics",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::heal", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::heal",
				payload: body || {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::heal",
		config: {
			api_path: "/agentmemory/diagnostics/heal",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::facet-tag", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.targetId || !body?.dimension || !body?.value) return {
			status_code: 400,
			body: { error: "targetId, dimension, and value are required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::facet-tag",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::facet-tag",
		config: {
			api_path: "/agentmemory/facets",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::facet-untag", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.targetId || !body?.dimension) return {
			status_code: 400,
			body: { error: "targetId and dimension are required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::facet-untag",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::facet-untag",
		config: {
			api_path: "/agentmemory/facets/remove",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::facet-query", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::facet-query",
				payload: body || {}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::facet-query",
		config: {
			api_path: "/agentmemory/facets/query",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::facet-get", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const params = req.query_params || {};
		if (!params.targetId) return {
			status_code: 400,
			body: { error: "targetId query param is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::facet-get",
				payload: { targetId: params.targetId }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::facet-get",
		config: {
			api_path: "/agentmemory/facets",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::facet-stats", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const params = req.query_params || {};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::facet-stats",
				payload: { targetType: params.targetType }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::facet-stats",
		config: {
			api_path: "/agentmemory/facets/stats",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::verify", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.id || typeof body.id !== "string") return {
			status_code: 400,
			body: { error: "id is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::verify",
				payload: { id: body.id }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::verify",
		config: {
			api_path: "/agentmemory/verify",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::cascade-update", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.supersededMemoryId || typeof body.supersededMemoryId !== "string") return {
			status_code: 400,
			body: { error: "supersededMemoryId is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::cascade-update",
				payload: { supersededMemoryId: body.supersededMemoryId }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::cascade-update",
		config: {
			api_path: "/agentmemory/cascade-update",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::lesson-save", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.content || typeof body.content !== "string") return {
			status_code: 400,
			body: { error: "content is required" }
		};
		const tags = typeof body.tags === "string" ? body.tags.split(",").map((t) => t.trim()).filter(Boolean) : Array.isArray(body.tags) ? body.tags : [];
		const result = await sdk.trigger({
			function_id: "mem::lesson-save",
			payload: {
				content: body.content,
				context: body.context || "",
				confidence: typeof body.confidence === "number" ? body.confidence : void 0,
				project: typeof body.project === "string" ? body.project : void 0,
				tags,
				source: "manual"
			}
		});
		return {
			status_code: result?.action === "created" ? 201 : 200,
			body: result
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::lesson-save",
		config: {
			api_path: "/agentmemory/lessons",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::lesson-list", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const params = req.query_params || {};
		const minConfidence = parseOptionalFiniteNumber(params.minConfidence);
		if (minConfidence === null) return {
			status_code: 400,
			body: { error: "invalid numeric parameter: minConfidence" }
		};
		const limit = parseOptionalPositiveInt(params.limit);
		if (limit === null) return {
			status_code: 400,
			body: { error: "invalid numeric parameter: limit" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::lesson-list",
				payload: {
					project: params.project,
					source: params.source,
					minConfidence,
					limit
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::lesson-list",
		config: {
			api_path: "/agentmemory/lessons",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::lesson-search", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.query || typeof body.query !== "string") return {
			status_code: 400,
			body: { error: "query is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::lesson-recall",
				payload: body
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::lesson-search",
		config: {
			api_path: "/agentmemory/lessons/search",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::lesson-strengthen", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.lessonId || typeof body.lessonId !== "string") return {
			status_code: 400,
			body: { error: "lessonId is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::lesson-strengthen",
				payload: { lessonId: body.lessonId }
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::lesson-strengthen",
		config: {
			api_path: "/agentmemory/lessons/strengthen",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::obsidian-export", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body || {};
		const vaultDir = asNonEmptyString$1(body.vaultDir);
		if (!vaultDir) return {
			status_code: 400,
			body: { error: "vaultDir must be a non-empty string" }
		};
		const types = typeof body.types === "string" ? body.types.split(",").map((t) => t.trim()).filter(Boolean) : void 0;
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::obsidian-export",
				payload: {
					vaultDir,
					types
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::obsidian-export",
		config: {
			api_path: "/agentmemory/obsidian/export",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::reflect", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body || {};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::reflect",
				payload: {
					project: typeof body.project === "string" ? body.project : void 0,
					maxClusters: typeof body.maxClusters === "number" ? body.maxClusters : void 0
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::reflect",
		config: {
			api_path: "/agentmemory/reflect",
			http_method: "POST"
		}
	});
	sdk.registerFunction("api::insight-list", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const params = req.query_params || {};
		const minConfidence = parseOptionalFiniteNumber(params.minConfidence);
		if (minConfidence === null) return {
			status_code: 400,
			body: { error: "invalid numeric parameter: minConfidence" }
		};
		const limit = parseOptionalPositiveInt(params.limit);
		if (limit === null) return {
			status_code: 400,
			body: { error: "invalid numeric parameter: limit" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::insight-list",
				payload: {
					project: params.project,
					minConfidence,
					limit
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::insight-list",
		config: {
			api_path: "/agentmemory/insights",
			http_method: "GET"
		}
	});
	sdk.registerFunction("api::insight-search", async (req) => {
		const denied = checkAuth(req, secret);
		if (denied) return denied;
		const body = req.body;
		if (!body?.query || typeof body.query !== "string") return {
			status_code: 400,
			body: { error: "query is required" }
		};
		return {
			status_code: 200,
			body: await sdk.trigger({
				function_id: "mem::insight-search",
				payload: {
					query: body.query,
					project: typeof body.project === "string" ? body.project : void 0,
					minConfidence: typeof body.minConfidence === "number" ? body.minConfidence : void 0,
					limit: typeof body.limit === "number" ? body.limit : void 0
				}
			})
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "api::insight-search",
		config: {
			api_path: "/agentmemory/insights/search",
			http_method: "POST"
		}
	});
}

//#endregion
//#region src/triggers/events.ts
function registerEventTriggers(sdk, kv) {
	sdk.registerFunction("event::session::started", async (data) => {
		const session = {
			id: data.sessionId,
			project: data.project,
			cwd: data.cwd,
			startedAt: (/* @__PURE__ */ new Date()).toISOString(),
			status: "active",
			observationCount: 0
		};
		await kv.set(KV.sessions, data.sessionId, session);
		return {
			session,
			context: (await sdk.trigger({
				function_id: "mem::context",
				payload: {
					sessionId: data.sessionId,
					project: data.project
				}
			})).context
		};
	});
	sdk.registerTrigger({
		type: "durable:subscriber",
		function_id: "event::session::started",
		config: { topic: "agentmemory.session.started" }
	});
	sdk.registerFunction("event::observation", async (data) => sdk.trigger({
		function_id: "mem::observe",
		payload: data
	}));
	sdk.registerTrigger({
		type: "durable:subscriber",
		function_id: "event::observation",
		config: { topic: "agentmemory.observation" }
	});
	sdk.registerFunction("event::session::stopped", async (data) => {
		const summary = await sdk.trigger({
			function_id: "mem::summarize",
			payload: data
		});
		if (isReflectEnabled()) try {
			sdk.triggerVoid("mem::slot-reflect", { sessionId: data.sessionId });
		} catch (err) {
			logger.warn("slot-reflect triggerVoid failed", {
				sessionId: data.sessionId,
				error: err instanceof Error ? err.message : String(err)
			});
		}
		if (isGraphExtractionEnabled()) try {
			const compressed = (await kv.list(KV.observations(data.sessionId))).filter((o) => o.title);
			if (compressed.length > 0) sdk.triggerVoid("mem::graph-extract", { observations: compressed });
		} catch (err) {
			logger.warn("graph-extract triggerVoid failed", {
				sessionId: data.sessionId,
				error: err instanceof Error ? err.message : String(err)
			});
		}
		return summary;
	});
	sdk.registerTrigger({
		type: "durable:subscriber",
		function_id: "event::session::stopped",
		config: { topic: "agentmemory.session.stopped" }
	});
	sdk.registerFunction("event::session::ended", async (data) => {
		await kv.update(KV.sessions, data.sessionId, [{
			type: "set",
			path: "endedAt",
			value: (/* @__PURE__ */ new Date()).toISOString()
		}, {
			type: "set",
			path: "status",
			value: "completed"
		}]);
		return { success: true };
	});
	sdk.registerTrigger({
		type: "durable:subscriber",
		function_id: "event::session::ended",
		config: { topic: "agentmemory.session.ended" }
	});
	sdk.registerFunction("event::session::observation-count-changed", async (payload) => {
		if (payload.event_type === "delete") return { skipped: true };
		const oldCount = payload.old_value?.observationCount ?? 0;
		const newCount = payload.new_value?.observationCount ?? 0;
		if (newCount <= oldCount) return { skipped: true };
		await sdk.trigger({
			function_id: "stream::send",
			payload: {
				stream_name: STREAM.name,
				group_id: STREAM.viewerGroup,
				id: `session-activity-${payload.key}-${Date.now()}`,
				type: "session.activity",
				data: {
					sessionId: payload.key,
					observationCount: newCount,
					delta: newCount - oldCount,
					updatedAt: payload.new_value?.updatedAt ?? (/* @__PURE__ */ new Date()).toISOString()
				}
			},
			action: TriggerAction.Void()
		});
		return { emitted: true };
	});
	sdk.registerTrigger({
		type: "state",
		function_id: "event::session::observation-count-changed",
		config: { scope: KV.sessions }
	});
}

//#endregion
//#region src/mcp/tools-registry.ts
const CORE_TOOLS = [
	{
		name: "memory_recall",
		description: "Search past session observations for relevant context. Use when you need to recall what happened in previous sessions, find past decisions, or look up how a file was modified before.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search query (keywords, file names, concepts)"
				},
				limit: {
					type: "number",
					description: "Max results to return (default 10)"
				},
				format: {
					type: "string",
					description: "Result format: full, compact, or narrative (default full)"
				},
				token_budget: {
					type: "number",
					description: "Optional token budget to trim returned results"
				}
			},
			required: ["query"]
		}
	},
	{
		name: "memory_compress_file",
		description: "Compress a markdown file to reduce token usage while preserving headings, URLs, and code blocks. Creates a .original.md backup before writing.",
		inputSchema: {
			type: "object",
			properties: { filePath: {
				type: "string",
				description: "Path to the markdown file to compress"
			} },
			required: ["filePath"]
		}
	},
	{
		name: "memory_save",
		description: "Explicitly save an important insight, decision, or pattern to long-term memory.",
		inputSchema: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "The insight or decision to remember"
				},
				type: {
					type: "string",
					description: "Memory type: pattern, preference, architecture, bug, workflow, or fact"
				},
				concepts: {
					type: "string",
					description: "Comma-separated key concepts"
				},
				files: {
					type: "string",
					description: "Comma-separated relevant file paths"
				}
			},
			required: ["content"]
		}
	},
	{
		name: "memory_file_history",
		description: "Get past observations about specific files.",
		inputSchema: {
			type: "object",
			properties: {
				files: {
					type: "string",
					description: "Comma-separated file paths"
				},
				sessionId: {
					type: "string",
					description: "Current session ID to exclude"
				}
			},
			required: ["files"]
		}
	},
	{
		name: "memory_patterns",
		description: "Detect recurring patterns across sessions.",
		inputSchema: {
			type: "object",
			properties: { project: {
				type: "string",
				description: "Project path to analyze"
			} }
		}
	},
	{
		name: "memory_sessions",
		description: "List recent sessions with their status and observation counts.",
		inputSchema: {
			type: "object",
			properties: {}
		}
	},
	{
		name: "memory_smart_search",
		description: "Hybrid semantic+keyword search with progressive disclosure.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search query"
				},
				expandIds: {
					type: "string",
					description: "Comma-separated observation IDs to expand"
				},
				limit: {
					type: "number",
					description: "Max results (default 10)"
				}
			},
			required: ["query"]
		}
	},
	{
		name: "memory_vision_search",
		description: "Cross-modal image search via CLIP embeddings. Pass queryText to find screenshots matching a description, or queryImageBase64/queryImageRef to find similar images. Requires AGENTMEMORY_IMAGE_EMBEDDINGS=true.",
		inputSchema: {
			type: "object",
			properties: {
				queryText: {
					type: "string",
					description: "Text query (e.g. 'login form with error banner')"
				},
				queryImageRef: {
					type: "string",
					description: "Absolute path to a stored image to match against"
				},
				queryImageBase64: {
					type: "string",
					description: "Raw base64 image bytes or data URL"
				},
				topK: {
					type: "number",
					description: "Max results (default 10, max 50)"
				},
				sessionId: {
					type: "string",
					description: "Filter to a single session"
				}
			}
		}
	},
	{
		name: "memory_timeline",
		description: "Chronological observations around an anchor point.",
		inputSchema: {
			type: "object",
			properties: {
				anchor: {
					type: "string",
					description: "Anchor point: ISO date or keyword"
				},
				project: {
					type: "string",
					description: "Filter by project path"
				},
				before: {
					type: "number",
					description: "Observations before anchor (default 5)"
				},
				after: {
					type: "number",
					description: "Observations after anchor (default 5)"
				}
			},
			required: ["anchor"]
		}
	},
	{
		name: "memory_profile",
		description: "User/project profile with top concepts and file patterns.",
		inputSchema: {
			type: "object",
			properties: {
				project: {
					type: "string",
					description: "Project path"
				},
				refresh: {
					type: "string",
					description: "Set to 'true' to force rebuild"
				}
			},
			required: ["project"]
		}
	},
	{
		name: "memory_export",
		description: "Export all memory data as JSON.",
		inputSchema: {
			type: "object",
			properties: {}
		}
	},
	{
		name: "memory_relations",
		description: "Query the memory relationship graph.",
		inputSchema: {
			type: "object",
			properties: {
				memoryId: {
					type: "string",
					description: "Memory ID to find relations for"
				},
				maxHops: {
					type: "number",
					description: "Max traversal depth (default 2)"
				},
				minConfidence: {
					type: "number",
					description: "Min confidence (0-1, default 0)"
				}
			},
			required: ["memoryId"]
		}
	},
	{
		name: "memory_commit_lookup",
		description: "Look up the agent session(s) that produced a specific git commit, given its SHA. Returns the commit metadata and linked sessions.",
		inputSchema: {
			type: "object",
			properties: { sha: {
				type: "string",
				description: "Full git commit SHA"
			} },
			required: ["sha"]
		}
	},
	{
		name: "memory_commits",
		description: "List recent commits linked to agent sessions, optionally filtered by branch or repo.",
		inputSchema: {
			type: "object",
			properties: {
				branch: {
					type: "string",
					description: "Filter by branch name"
				},
				repo: {
					type: "string",
					description: "Filter by remote URL"
				},
				limit: {
					type: "number",
					description: "Max results (default 100, max 500)"
				}
			}
		}
	}
];
const V040_TOOLS = [
	{
		name: "memory_claude_bridge_sync",
		description: "Sync memory state to/from Claude Code's native MEMORY.md file.",
		inputSchema: {
			type: "object",
			properties: { direction: {
				type: "string",
				description: "'read' to import from MEMORY.md, 'write' to export to MEMORY.md"
			} },
			required: ["direction"]
		}
	},
	{
		name: "memory_graph_query",
		description: "Query the knowledge graph for entities and relationships.",
		inputSchema: {
			type: "object",
			properties: {
				startNodeId: {
					type: "string",
					description: "Starting node ID for traversal"
				},
				nodeType: {
					type: "string",
					description: "Filter by node type"
				},
				maxDepth: {
					type: "number",
					description: "Max BFS depth (default 3, max 5)"
				},
				query: {
					type: "string",
					description: "Search nodes by name"
				}
			}
		}
	},
	{
		name: "memory_consolidate",
		description: "Run the 4-tier memory consolidation pipeline (working -> episodic -> semantic -> procedural).",
		inputSchema: {
			type: "object",
			properties: { tier: {
				type: "string",
				description: "Target tier: episodic, semantic, or procedural"
			} }
		}
	},
	{
		name: "memory_team_share",
		description: "Share a memory or observation with team members.",
		inputSchema: {
			type: "object",
			properties: {
				itemId: {
					type: "string",
					description: "ID of memory or observation to share"
				},
				itemType: {
					type: "string",
					description: "Type: observation, memory, or pattern"
				}
			},
			required: ["itemId", "itemType"]
		}
	},
	{
		name: "memory_team_feed",
		description: "Get recent shared items from all team members.",
		inputSchema: {
			type: "object",
			properties: { limit: {
				type: "number",
				description: "Max items (default 20)"
			} }
		}
	},
	{
		name: "memory_audit",
		description: "View the audit trail of memory operations.",
		inputSchema: {
			type: "object",
			properties: {
				operation: {
					type: "string",
					description: "Filter by operation type"
				},
				limit: {
					type: "number",
					description: "Max entries (default 50)"
				}
			}
		}
	},
	{
		name: "memory_governance_delete",
		description: "Delete specific memories with audit trail.",
		inputSchema: {
			type: "object",
			properties: {
				memoryIds: {
					type: "string",
					description: "Comma-separated memory IDs to delete"
				},
				reason: {
					type: "string",
					description: "Reason for deletion"
				}
			},
			required: ["memoryIds"]
		}
	},
	{
		name: "memory_snapshot_create",
		description: "Create a git-versioned snapshot of current memory state.",
		inputSchema: {
			type: "object",
			properties: { message: {
				type: "string",
				description: "Snapshot description"
			} }
		}
	}
];
const V050_TOOLS = [
	{
		name: "memory_action_create",
		description: "Create an actionable work item with typed dependencies. Actions track what agents need to do and how work items relate to each other.",
		inputSchema: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Action title"
				},
				description: {
					type: "string",
					description: "Detailed description of the work"
				},
				priority: {
					type: "number",
					description: "Priority 1-10 (10 highest)"
				},
				project: {
					type: "string",
					description: "Project path"
				},
				tags: {
					type: "string",
					description: "Comma-separated tags"
				},
				parentId: {
					type: "string",
					description: "Parent action ID for hierarchical actions"
				},
				requires: {
					type: "string",
					description: "Comma-separated action IDs that must complete before this"
				}
			},
			required: ["title"]
		}
	},
	{
		name: "memory_action_update",
		description: "Update an action's status, priority, or details. Set status to 'done' to complete it and unblock dependent actions.",
		inputSchema: {
			type: "object",
			properties: {
				actionId: {
					type: "string",
					description: "Action ID to update"
				},
				status: {
					type: "string",
					description: "New status: pending, active, done, blocked, cancelled"
				},
				result: {
					type: "string",
					description: "Outcome description (when completing)"
				},
				priority: {
					type: "number",
					description: "New priority 1-10"
				}
			},
			required: ["actionId"]
		}
	},
	{
		name: "memory_frontier",
		description: "Get all unblocked actions ranked by priority and urgency. Returns the frontier of actionable work with no unsatisfied dependencies.",
		inputSchema: {
			type: "object",
			properties: {
				project: {
					type: "string",
					description: "Filter by project"
				},
				agentId: {
					type: "string",
					description: "Agent ID to check lease conflicts"
				},
				limit: {
					type: "number",
					description: "Max results (default 20)"
				}
			}
		}
	},
	{
		name: "memory_next",
		description: "Get the single most important next action to work on. Combines dependency resolution, priority, and recency into a score.",
		inputSchema: {
			type: "object",
			properties: {
				project: {
					type: "string",
					description: "Filter by project"
				},
				agentId: {
					type: "string",
					description: "Current agent ID"
				}
			}
		}
	},
	{
		name: "memory_lease",
		description: "Acquire, release, or renew an exclusive lease on an action. Prevents multiple agents from working on the same thing.",
		inputSchema: {
			type: "object",
			properties: {
				actionId: {
					type: "string",
					description: "Action ID"
				},
				agentId: {
					type: "string",
					description: "Agent claiming the action"
				},
				operation: {
					type: "string",
					description: "acquire, release, or renew"
				},
				result: {
					type: "string",
					description: "Result when releasing (marks action done)"
				},
				ttlMs: {
					type: "number",
					description: "Lease duration in ms (default 10min, max 1hr)"
				}
			},
			required: [
				"actionId",
				"agentId",
				"operation"
			]
		}
	},
	{
		name: "memory_routine_run",
		description: "Instantiate a frozen workflow routine, creating actions for each step with proper dependencies.",
		inputSchema: {
			type: "object",
			properties: {
				routineId: {
					type: "string",
					description: "Routine template ID"
				},
				project: {
					type: "string",
					description: "Project context"
				},
				initiatedBy: {
					type: "string",
					description: "Agent starting the run"
				}
			},
			required: ["routineId"]
		}
	},
	{
		name: "memory_signal_send",
		description: "Send a message to another agent or broadcast. Supports threading, typed messages, and TTL expiration.",
		inputSchema: {
			type: "object",
			properties: {
				from: {
					type: "string",
					description: "Sender agent ID"
				},
				to: {
					type: "string",
					description: "Recipient agent ID (omit for broadcast)"
				},
				content: {
					type: "string",
					description: "Message content"
				},
				type: {
					type: "string",
					description: "Message type: info, request, response, alert, handoff"
				},
				replyTo: {
					type: "string",
					description: "Signal ID to reply to (auto-threads)"
				}
			},
			required: ["from", "content"]
		}
	},
	{
		name: "memory_signal_read",
		description: "Read messages for an agent. Marks delivered messages as read.",
		inputSchema: {
			type: "object",
			properties: {
				agentId: {
					type: "string",
					description: "Agent to read messages for"
				},
				unreadOnly: {
					type: "string",
					description: "Set to 'true' for unread only"
				},
				threadId: {
					type: "string",
					description: "Filter by conversation thread"
				},
				limit: {
					type: "number",
					description: "Max messages (default 50)"
				}
			},
			required: ["agentId"]
		}
	},
	{
		name: "memory_checkpoint",
		description: "Create or resolve an external checkpoint (CI result, approval, deploy status) that gates action progress.",
		inputSchema: {
			type: "object",
			properties: {
				operation: {
					type: "string",
					description: "create, resolve, or list"
				},
				name: {
					type: "string",
					description: "Checkpoint name (for create)"
				},
				checkpointId: {
					type: "string",
					description: "Checkpoint ID (for resolve)"
				},
				status: {
					type: "string",
					description: "passed or failed (for resolve)"
				},
				type: {
					type: "string",
					description: "Checkpoint type: ci, approval, deploy, external, timer"
				},
				linkedActionIds: {
					type: "string",
					description: "Comma-separated action IDs this checkpoint gates (for create)"
				}
			},
			required: ["operation"]
		}
	},
	{
		name: "memory_mesh_sync",
		description: "Sync memories and actions with peer agentmemory instances for multi-agent collaboration.",
		inputSchema: {
			type: "object",
			properties: {
				peerId: {
					type: "string",
					description: "Specific peer ID (omit for all)"
				},
				direction: {
					type: "string",
					description: "push, pull, or both (default both)"
				}
			}
		}
	}
];
const V051_TOOLS = [
	{
		name: "memory_sentinel_create",
		description: "Create an event-driven sentinel that watches for conditions (webhook, timer, threshold, pattern, approval) and auto-unblocks gated actions when triggered.",
		inputSchema: {
			type: "object",
			properties: {
				name: {
					type: "string",
					description: "Sentinel name"
				},
				type: {
					type: "string",
					description: "Type: webhook, timer, threshold, pattern, approval, custom"
				},
				config: {
					type: "string",
					description: "JSON config (timer: {durationMs}, threshold: {metric,operator,value}, pattern: {pattern}, webhook: {path})"
				},
				linkedActionIds: {
					type: "string",
					description: "Comma-separated action IDs to gate"
				},
				expiresInMs: {
					type: "number",
					description: "Auto-expire after ms"
				}
			},
			required: ["name", "type"]
		}
	},
	{
		name: "memory_sentinel_trigger",
		description: "Externally fire a sentinel, providing an optional result payload. Unblocks any gated actions.",
		inputSchema: {
			type: "object",
			properties: {
				sentinelId: {
					type: "string",
					description: "Sentinel ID to trigger"
				},
				result: {
					type: "string",
					description: "JSON result payload"
				}
			},
			required: ["sentinelId"]
		}
	},
	{
		name: "memory_sketch_create",
		description: "Create an ephemeral action graph for exploratory work. Auto-expires after TTL. Can be promoted to permanent actions or discarded.",
		inputSchema: {
			type: "object",
			properties: {
				title: {
					type: "string",
					description: "Sketch title"
				},
				description: {
					type: "string",
					description: "What this sketch explores"
				},
				expiresInMs: {
					type: "number",
					description: "TTL in ms (default 1 hour)"
				},
				project: {
					type: "string",
					description: "Project context"
				}
			},
			required: ["title"]
		}
	},
	{
		name: "memory_sketch_promote",
		description: "Promote a sketch's ephemeral actions to permanent actions. Makes the exploratory work official.",
		inputSchema: {
			type: "object",
			properties: {
				sketchId: {
					type: "string",
					description: "Sketch ID to promote"
				},
				project: {
					type: "string",
					description: "Override project for promoted actions"
				}
			},
			required: ["sketchId"]
		}
	},
	{
		name: "memory_crystallize",
		description: "Compress completed action chains into compact crystal digests using LLM summarization. Extracts narrative, key outcomes, files affected, and lessons.",
		inputSchema: {
			type: "object",
			properties: {
				actionIds: {
					type: "string",
					description: "Comma-separated completed action IDs to crystallize"
				},
				project: {
					type: "string",
					description: "Project context"
				},
				sessionId: {
					type: "string",
					description: "Session context"
				}
			},
			required: ["actionIds"]
		}
	},
	{
		name: "memory_diagnose",
		description: "Run health checks across all subsystems (actions, leases, sentinels, sketches, signals, sessions, memories, mesh). Identifies stuck, orphaned, and inconsistent state.",
		inputSchema: {
			type: "object",
			properties: { categories: {
				type: "string",
				description: "Comma-separated categories to check (default all)"
			} }
		}
	},
	{
		name: "memory_heal",
		description: "Auto-fix all fixable issues found by diagnostics. Unblocks stuck actions, expires stale leases, cleans up orphaned data.",
		inputSchema: {
			type: "object",
			properties: {
				categories: {
					type: "string",
					description: "Comma-separated categories to heal (default all)"
				},
				dryRun: {
					type: "string",
					description: "Set to 'true' for dry run (report but don't fix)"
				}
			}
		}
	},
	{
		name: "memory_facet_tag",
		description: "Attach a structured tag (dimension:value) to an action, memory, or observation for multi-dimensional categorization.",
		inputSchema: {
			type: "object",
			properties: {
				targetId: {
					type: "string",
					description: "ID of the target to tag"
				},
				targetType: {
					type: "string",
					description: "Type: action, memory, or observation"
				},
				dimension: {
					type: "string",
					description: "Tag dimension (e.g., priority, team, status)"
				},
				value: {
					type: "string",
					description: "Tag value (e.g., urgent, backend, reviewed)"
				}
			},
			required: [
				"targetId",
				"targetType",
				"dimension",
				"value"
			]
		}
	},
	{
		name: "memory_facet_query",
		description: "Query targets by facet tags with AND/OR logic. Find all actions tagged priority:urgent AND team:backend.",
		inputSchema: {
			type: "object",
			properties: {
				matchAll: {
					type: "string",
					description: "Comma-separated dimension:value pairs (AND logic)"
				},
				matchAny: {
					type: "string",
					description: "Comma-separated dimension:value pairs (OR logic)"
				},
				targetType: {
					type: "string",
					description: "Filter by type: action, memory, or observation"
				}
			}
		}
	}
];
const V061_TOOLS = [{
	name: "memory_verify",
	description: "Verify a memory or observation by tracing its citation chain back to source observations and session context. Returns provenance information including confidence scores.",
	inputSchema: {
		type: "object",
		properties: { id: {
			type: "string",
			description: "Memory ID or observation ID to verify"
		} },
		required: ["id"]
	}
}];
const V070_TOOLS = [
	{
		name: "memory_lesson_save",
		description: "Save a lesson learned from this session. Lessons have confidence scores that strengthen when reinforced and decay when not used. Duplicate content auto-strengthens the existing lesson.",
		inputSchema: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description: "The lesson learned (what worked, what to avoid, when to use X approach)"
				},
				context: {
					type: "string",
					description: "When/where this lesson applies"
				},
				confidence: {
					type: "number",
					description: "Initial confidence 0.0-1.0 (default 0.5)"
				},
				project: {
					type: "string",
					description: "Project this lesson is about"
				},
				tags: {
					type: "string",
					description: "Comma-separated tags"
				}
			},
			required: ["content"]
		}
	},
	{
		name: "memory_lesson_recall",
		description: "Search lessons by query. Returns lessons sorted by confidence and recency. Use to check what the agent has learned before making decisions.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Search query"
				},
				project: {
					type: "string",
					description: "Filter by project"
				},
				minConfidence: {
					type: "number",
					description: "Minimum confidence threshold (default 0.1)"
				},
				limit: {
					type: "number",
					description: "Max results (default 10)"
				}
			},
			required: ["query"]
		}
	},
	{
		name: "memory_obsidian_export",
		description: "Export memories, lessons, and crystals as Obsidian-compatible Markdown files with YAML frontmatter and wikilinks for graph view.",
		inputSchema: {
			type: "object",
			properties: {
				vaultDir: {
					type: "string",
					description: "Output directory (default ~/.agentmemory/vault/)"
				},
				types: {
					type: "string",
					description: "Comma-separated types to export: memories,lessons,crystals,sessions (default all)"
				}
			}
		}
	}
];
const V073_TOOLS = [{
	name: "memory_reflect",
	description: "Traverse the knowledge graph, group related memories by concept clusters, and synthesize higher-order insights via LLM. Returns new and reinforced insights.",
	inputSchema: {
		type: "object",
		properties: {
			project: {
				type: "string",
				description: "Filter by project"
			},
			maxClusters: {
				type: "number",
				description: "Max concept clusters to process (default 10, max 20)"
			}
		}
	}
}, {
	name: "memory_insight_list",
	description: "List synthesized insights — higher-order observations derived from patterns across memories, lessons, and crystals.",
	inputSchema: {
		type: "object",
		properties: {
			project: {
				type: "string",
				description: "Filter by project"
			},
			minConfidence: {
				type: "number",
				description: "Minimum confidence threshold (default 0)"
			},
			limit: {
				type: "number",
				description: "Max results (default 50)"
			}
		}
	}
}];
const V010_SLOTS_TOOLS = [
	{
		name: "memory_slot_list",
		description: "List all memory slots (pinned + project + global). Slots are editable, size-limited memory units the agent can read and modify across sessions.",
		inputSchema: {
			type: "object",
			properties: {}
		}
	},
	{
		name: "memory_slot_get",
		description: "Read a single slot by label.",
		inputSchema: {
			type: "object",
			properties: { label: {
				type: "string",
				description: "Slot label (e.g. 'persona', 'pending_items')"
			} },
			required: ["label"]
		}
	},
	{
		name: "memory_slot_create",
		description: "Create a new slot. Reject if a slot with the same label already exists.",
		inputSchema: {
			type: "object",
			properties: {
				label: {
					type: "string",
					description: "Slot label — lowercase, starts with letter, [a-z0-9_]"
				},
				content: {
					type: "string",
					description: "Initial content (default empty)"
				},
				sizeLimit: {
					type: "number",
					description: "Max chars (default 2000, hard cap 20000)"
				},
				description: {
					type: "string",
					description: "What this slot is for"
				},
				pinned: {
					type: "string",
					description: "'false' to exclude from context injection; default true"
				},
				scope: {
					type: "string",
					description: "'project' (default) or 'global' (shared across projects)"
				}
			},
			required: ["label"]
		}
	},
	{
		name: "memory_slot_append",
		description: "Append text to an existing slot. Fails with 413 if the append would exceed the slot's sizeLimit — agent must compact via memory_slot_replace first.",
		inputSchema: {
			type: "object",
			properties: {
				label: {
					type: "string",
					description: "Slot label"
				},
				text: {
					type: "string",
					description: "Text to append"
				}
			},
			required: ["label", "text"]
		}
	},
	{
		name: "memory_slot_replace",
		description: "Replace slot content in place. Fails if content exceeds sizeLimit.",
		inputSchema: {
			type: "object",
			properties: {
				label: {
					type: "string",
					description: "Slot label"
				},
				content: {
					type: "string",
					description: "New full content"
				}
			},
			required: ["label", "content"]
		}
	},
	{
		name: "memory_slot_delete",
		description: "Delete a slot. Seeded default slots can be deleted unless marked readOnly.",
		inputSchema: {
			type: "object",
			properties: { label: {
				type: "string",
				description: "Slot label"
			} },
			required: ["label"]
		}
	}
];
const ESSENTIAL_TOOLS = new Set([
	"memory_save",
	"memory_recall",
	"memory_consolidate",
	"memory_smart_search",
	"memory_sessions",
	"memory_diagnose",
	"memory_lesson_save",
	"memory_reflect"
]);
function getAllTools() {
	return [
		...CORE_TOOLS,
		...V040_TOOLS,
		...V050_TOOLS,
		...V051_TOOLS,
		...V061_TOOLS,
		...V070_TOOLS,
		...V073_TOOLS,
		...V010_SLOTS_TOOLS
	];
}
function getVisibleTools() {
	if ((process.env["AGENTMEMORY_TOOLS"] || "core") === "all") return getAllTools();
	return getAllTools().filter((t) => ESSENTIAL_TOOLS.has(t.name));
}

//#endregion
//#region src/mcp/server.ts
function asNonEmptyString(value) {
	return typeof value === "string" && value.trim() ? value.trim() : void 0;
}
function asNumber(value, fallback) {
	const n = Number(value);
	if (Number.isFinite(n)) return n;
	return fallback;
}
function parseCsvList(value) {
	if (typeof value === "string") return value.split(",").map((v) => v.trim()).filter(Boolean);
	if (Array.isArray(value)) return value.map((v) => typeof v === "string" ? v.trim() : "").filter(Boolean);
	return [];
}
function registerMcpEndpoints(sdk, kv, secret) {
	function checkAuth(req, sec) {
		if (!sec) return null;
		const auth = req.headers?.["authorization"] || req.headers?.["Authorization"];
		if (typeof auth !== "string" || !timingSafeCompare(auth, `Bearer ${sec}`)) return {
			status_code: 401,
			body: { error: "unauthorized" }
		};
		return null;
	}
	sdk.registerFunction("mcp::tools::list", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: { tools: getVisibleTools() }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "mcp::tools::list",
		config: {
			api_path: "/agentmemory/mcp/tools",
			http_method: "GET"
		}
	});
	sdk.registerFunction("mcp::tools::call", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		if (!req.body || typeof req.body.name !== "string") return {
			status_code: 400,
			body: { error: "name is required" }
		};
		const { name, arguments: args = {} } = req.body;
		try {
			switch (name) {
				case "memory_recall": {
					if (typeof args.query !== "string" || !args.query.trim()) return {
						status_code: 400,
						body: { error: "query is required for memory_recall" }
					};
					const format = typeof args.format === "string" ? args.format.trim().toLowerCase() : "full";
					if (![
						"full",
						"compact",
						"narrative"
					].includes(format)) return {
						status_code: 400,
						body: { error: "format must be one of: full, compact, narrative" }
					};
					const tokenBudget = asNumber(args.token_budget);
					if (args.token_budget !== void 0 && (!Number.isInteger(tokenBudget) || (tokenBudget ?? 0) < 1)) return {
						status_code: 400,
						body: { error: "token_budget must be a positive integer" }
					};
					const result = await sdk.trigger({
						function_id: "mem::search",
						payload: {
							query: args.query,
							limit: typeof args.limit === "number" ? args.limit : 10,
							format,
							token_budget: tokenBudget
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: format === "narrative" && result && typeof result === "object" && "text" in result && typeof result.text === "string" ? result.text : JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_compress_file": {
					if (typeof args.filePath !== "string" || !args.filePath.trim()) return {
						status_code: 400,
						body: { error: "filePath is required for memory_compress_file" }
					};
					const result = await sdk.trigger({
						function_id: "mem::compress-file",
						payload: { filePath: args.filePath.trim() }
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_save": {
					if (typeof args.content !== "string" || !args.content.trim()) return {
						status_code: 400,
						body: { error: "content is required for memory_save" }
					};
					const type = args.type || "fact";
					const concepts = typeof args.concepts === "string" ? args.concepts.split(",").map((c) => c.trim()).filter(Boolean) : [];
					const files = typeof args.files === "string" ? args.files.split(",").map((f) => f.trim()).filter(Boolean) : [];
					const result = await sdk.trigger({
						function_id: "mem::remember",
						payload: {
							content: args.content,
							type,
							concepts,
							files
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result)
						}] }
					};
				}
				case "memory_file_history": {
					if (typeof args.files !== "string" || !args.files.trim()) return {
						status_code: 400,
						body: { error: "files is required for memory_file_history" }
					};
					const fileList = parseCsvList(args.files);
					if (!fileList.length) return {
						status_code: 400,
						body: { error: "files must contain at least one valid path" }
					};
					const payload = { files: fileList };
					const sessionId = asNonEmptyString(args.sessionId);
					if (sessionId) payload.sessionId = sessionId;
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: (await sdk.trigger({
								function_id: "mem::file-context",
								payload
							})).context || "No history found."
						}] }
					};
				}
				case "memory_patterns": {
					const result = await sdk.trigger({
						function_id: "mem::patterns",
						payload: { project: args.project }
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_sessions": {
					const sessions = await kv.list(KV.sessions);
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify({ sessions }, null, 2)
						}] }
					};
				}
				case "memory_smart_search": {
					if (typeof args.query !== "string" || !args.query.trim()) return {
						status_code: 400,
						body: { error: "query is required for memory_smart_search" }
					};
					const expandIds = parseCsvList(args.expandIds).slice(0, 20);
					const limit = Math.max(1, Math.min(100, asNumber(args.limit, 10) ?? 10));
					const result = await sdk.trigger({
						function_id: "mem::smart-search",
						payload: {
							query: args.query,
							expandIds,
							limit
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_vision_search": {
					const queryText = typeof args.queryText === "string" ? args.queryText : void 0;
					const queryImageRef = typeof args.queryImageRef === "string" ? args.queryImageRef : void 0;
					const queryImageBase64 = typeof args.queryImageBase64 === "string" ? args.queryImageBase64 : void 0;
					if (!queryText && !queryImageRef && !queryImageBase64) return {
						status_code: 400,
						body: { error: "queryText, queryImageRef, or queryImageBase64 required" }
					};
					const topK = Math.max(1, Math.min(50, asNumber(args.topK, 10) ?? 10));
					const sessionId = typeof args.sessionId === "string" ? args.sessionId : void 0;
					const result = await sdk.trigger({
						function_id: "mem::vision-search",
						payload: {
							queryText,
							queryImageRef,
							queryImageBase64,
							topK,
							sessionId
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_timeline": {
					if (typeof args.anchor !== "string" || !args.anchor.trim()) return {
						status_code: 400,
						body: { error: "anchor is required for memory_timeline" }
					};
					const result = await sdk.trigger({
						function_id: "mem::timeline",
						payload: {
							anchor: args.anchor,
							project: args.project || void 0,
							before: args.before || 5,
							after: args.after || 5
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_profile": {
					if (typeof args.project !== "string" || !args.project.trim()) return {
						status_code: 400,
						body: { error: "project is required for memory_profile" }
					};
					const result = await sdk.trigger({
						function_id: "mem::profile",
						payload: {
							project: args.project,
							refresh: args.refresh === true || args.refresh === "true"
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_export": {
					const result = await sdk.trigger({
						function_id: "mem::export",
						payload: {}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_relations": {
					if (typeof args.memoryId !== "string" || !args.memoryId.trim()) return {
						status_code: 400,
						body: { error: "memoryId is required for memory_relations" }
					};
					const rawMaxHops = Number(args.maxHops);
					const rawMinConf = Number(args.minConfidence);
					const result = await sdk.trigger({
						function_id: "mem::get-related",
						payload: {
							memoryId: args.memoryId,
							maxHops: Number.isFinite(rawMaxHops) ? rawMaxHops : 2,
							minConfidence: Number.isFinite(rawMinConf) ? Math.max(0, Math.min(1, rawMinConf)) : 0
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_claude_bridge_sync": {
					const funcId = (args.direction || "write") === "read" ? "mem::claude-bridge-read" : "mem::claude-bridge-sync";
					try {
						const result = await sdk.trigger({
							function_id: funcId,
							payload: {}
						});
						return {
							status_code: 200,
							body: { content: [{
								type: "text",
								text: JSON.stringify(result, null, 2)
							}] }
						};
					} catch {
						return {
							status_code: 200,
							body: { content: [{
								type: "text",
								text: "Claude bridge not enabled. Set CLAUDE_MEMORY_BRIDGE=true"
							}] }
						};
					}
				}
				case "memory_graph_query": try {
					const payload = {};
					const startNodeId = asNonEmptyString(args.startNodeId);
					const nodeType = asNonEmptyString(args.nodeType);
					const query = asNonEmptyString(args.query);
					const maxDepth = asNumber(args.maxDepth);
					if (startNodeId) payload.startNodeId = startNodeId;
					if (nodeType) payload.nodeType = nodeType;
					if (query) payload.query = query;
					if (maxDepth !== void 0) payload.maxDepth = Math.max(1, Math.min(8, maxDepth));
					const result = await sdk.trigger({
						function_id: "mem::graph-query",
						payload
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				} catch {
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: "Knowledge graph not enabled. Set GRAPH_EXTRACTION_ENABLED=true"
						}] }
					};
				}
				case "memory_consolidate": try {
					const result = await sdk.trigger({
						function_id: "mem::consolidate-pipeline",
						payload: { tier: args.tier }
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				} catch {
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: "Consolidation not enabled. Set CONSOLIDATION_ENABLED=true"
						}] }
					};
				}
				case "memory_team_share":
					if (typeof args.itemId !== "string" || typeof args.itemType !== "string") return {
						status_code: 400,
						body: { error: "itemId and itemType are required" }
					};
					try {
						const result = await sdk.trigger({
							function_id: "mem::team-share",
							payload: {
								itemId: args.itemId,
								itemType: args.itemType
							}
						});
						return {
							status_code: 200,
							body: { content: [{
								type: "text",
								text: JSON.stringify(result, null, 2)
							}] }
						};
					} catch {
						return {
							status_code: 200,
							body: { content: [{
								type: "text",
								text: "Team memory not enabled. Set TEAM_ID and USER_ID"
							}] }
						};
					}
				case "memory_team_feed": try {
					const result = await sdk.trigger({
						function_id: "mem::team-feed",
						payload: { limit: typeof args.limit === "number" ? args.limit : 20 }
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				} catch {
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: "Team memory not enabled. Set TEAM_ID and USER_ID"
						}] }
					};
				}
				case "memory_audit": try {
					const result = await sdk.trigger({
						function_id: "mem::audit-query",
						payload: {
							operation: args.operation,
							limit: typeof args.limit === "number" ? args.limit : 50
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				} catch {
					return {
						status_code: 200,
						body: {
							content: [{
								type: "text",
								text: "Audit query failed"
							}],
							isError: true
						}
					};
				}
				case "memory_governance_delete": {
					if (typeof args.memoryIds !== "string") return {
						status_code: 400,
						body: { error: "memoryIds is required" }
					};
					const ids = args.memoryIds.split(",").map((id) => id.trim()).filter(Boolean);
					try {
						const result = await sdk.trigger({
							function_id: "mem::governance-delete",
							payload: {
								memoryIds: ids,
								reason: args.reason
							}
						});
						return {
							status_code: 200,
							body: { content: [{
								type: "text",
								text: JSON.stringify(result, null, 2)
							}] }
						};
					} catch {
						return {
							status_code: 200,
							body: {
								content: [{
									type: "text",
									text: "Governance delete failed"
								}],
								isError: true
							}
						};
					}
				}
				case "memory_snapshot_create": try {
					const result = await sdk.trigger({
						function_id: "mem::snapshot-create",
						payload: { message: args.message }
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				} catch {
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: "Snapshots not enabled. Set SNAPSHOT_ENABLED=true"
						}] }
					};
				}
				case "memory_action_create": {
					if (typeof args.title !== "string" || !args.title.trim()) return {
						status_code: 400,
						body: { error: "title is required" }
					};
					const edges = [];
					if (typeof args.requires === "string" && args.requires.trim()) for (const id of args.requires.split(",").map((s) => s.trim()).filter(Boolean)) edges.push({
						type: "requires",
						targetActionId: id
					});
					const tags = typeof args.tags === "string" && args.tags.trim() ? args.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
					const actionResult = await sdk.trigger({
						function_id: "mem::action-create",
						payload: {
							title: args.title,
							description: args.description,
							priority: args.priority,
							project: args.project,
							tags,
							parentId: args.parentId,
							edges: edges.length > 0 ? edges : void 0
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(actionResult, null, 2)
						}] }
					};
				}
				case "memory_action_update": {
					if (typeof args.actionId !== "string" || !args.actionId.trim()) return {
						status_code: 400,
						body: { error: "actionId is required" }
					};
					const updateResult = await sdk.trigger({
						function_id: "mem::action-update",
						payload: {
							actionId: args.actionId,
							status: args.status,
							result: args.result,
							priority: args.priority
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(updateResult, null, 2)
						}] }
					};
				}
				case "memory_frontier": {
					const frontierResult = await sdk.trigger({
						function_id: "mem::frontier",
						payload: {
							project: args.project,
							agentId: args.agentId,
							limit: args.limit
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(frontierResult, null, 2)
						}] }
					};
				}
				case "memory_next": {
					const nextResult = await sdk.trigger({
						function_id: "mem::next",
						payload: {
							project: args.project,
							agentId: args.agentId
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(nextResult, null, 2)
						}] }
					};
				}
				case "memory_lease": {
					if (typeof args.actionId !== "string" || typeof args.agentId !== "string" || typeof args.operation !== "string") return {
						status_code: 400,
						body: { error: "actionId, agentId, and operation are required" }
					};
					const op = args.operation;
					let leaseResult;
					if (op === "acquire") leaseResult = await sdk.trigger({
						function_id: "mem::lease-acquire",
						payload: {
							actionId: args.actionId,
							agentId: args.agentId,
							ttlMs: args.ttlMs
						}
					});
					else if (op === "release") leaseResult = await sdk.trigger({
						function_id: "mem::lease-release",
						payload: {
							actionId: args.actionId,
							agentId: args.agentId,
							result: args.result
						}
					});
					else if (op === "renew") leaseResult = await sdk.trigger({
						function_id: "mem::lease-renew",
						payload: {
							actionId: args.actionId,
							agentId: args.agentId,
							ttlMs: args.ttlMs
						}
					});
					else return {
						status_code: 400,
						body: { error: "operation must be acquire, release, or renew" }
					};
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(leaseResult, null, 2)
						}] }
					};
				}
				case "memory_routine_run": {
					if (typeof args.routineId !== "string") return {
						status_code: 400,
						body: { error: "routineId is required" }
					};
					const runResult = await sdk.trigger({
						function_id: "mem::routine-run",
						payload: {
							routineId: args.routineId,
							project: args.project,
							initiatedBy: args.initiatedBy
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(runResult, null, 2)
						}] }
					};
				}
				case "memory_signal_send": {
					if (typeof args.from !== "string" || typeof args.content !== "string") return {
						status_code: 400,
						body: { error: "from and content are required" }
					};
					const sigResult = await sdk.trigger({
						function_id: "mem::signal-send",
						payload: {
							from: args.from,
							to: args.to,
							content: args.content,
							type: args.type,
							replyTo: args.replyTo
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(sigResult, null, 2)
						}] }
					};
				}
				case "memory_signal_read": {
					if (typeof args.agentId !== "string") return {
						status_code: 400,
						body: { error: "agentId is required" }
					};
					const readResult = await sdk.trigger({
						function_id: "mem::signal-read",
						payload: {
							agentId: args.agentId,
							unreadOnly: args.unreadOnly === true || args.unreadOnly === "true",
							threadId: args.threadId,
							limit: args.limit
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(readResult, null, 2)
						}] }
					};
				}
				case "memory_checkpoint": {
					const cpOp = args.operation;
					if (!cpOp) return {
						status_code: 400,
						body: { error: "operation is required" }
					};
					let cpResult;
					if (cpOp === "create") {
						const linkedIds = typeof args.linkedActionIds === "string" && args.linkedActionIds.trim() ? args.linkedActionIds.split(",").map((s) => s.trim()) : [];
						cpResult = await sdk.trigger({
							function_id: "mem::checkpoint-create",
							payload: {
								name: args.name,
								description: args.description,
								type: args.type,
								linkedActionIds: linkedIds
							}
						});
					} else if (cpOp === "resolve") {
						if (typeof args.checkpointId !== "string" || !args.checkpointId.trim()) return {
							status_code: 400,
							body: { error: "checkpointId is required for resolve operation" }
						};
						cpResult = await sdk.trigger({
							function_id: "mem::checkpoint-resolve",
							payload: {
								checkpointId: args.checkpointId,
								status: args.status
							}
						});
					} else if (cpOp === "list") cpResult = await sdk.trigger({
						function_id: "mem::checkpoint-list",
						payload: {
							status: args.status,
							type: args.type
						}
					});
					else return {
						status_code: 400,
						body: { error: "operation must be create, resolve, or list" }
					};
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(cpResult, null, 2)
						}] }
					};
				}
				case "memory_mesh_sync": {
					const meshResult = await sdk.trigger({
						function_id: "mem::mesh-sync",
						payload: {
							peerId: args.peerId,
							direction: args.direction
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(meshResult, null, 2)
						}] }
					};
				}
				case "memory_sentinel_create": {
					let snlConfig = {};
					if (typeof args.config === "object" && args.config !== null) snlConfig = args.config;
					else if (typeof args.config === "string" && args.config.trim()) try {
						snlConfig = JSON.parse(args.config);
					} catch {
						return {
							status_code: 400,
							body: { error: "invalid config JSON" }
						};
					}
					const snlLinked = parseCsvList(args.linkedActionIds);
					const expiresInMs = asNumber(args.expiresInMs);
					const name = asNonEmptyString(args.name);
					const type = asNonEmptyString(args.type);
					const payload = { config: snlConfig };
					if (name) payload.name = name;
					if (type) payload.type = type;
					if (snlLinked.length) payload.linkedActionIds = snlLinked;
					if (expiresInMs !== void 0) payload.expiresInMs = Math.max(0, expiresInMs);
					const snlResult = await sdk.trigger({
						function_id: "mem::sentinel-create",
						payload
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(snlResult, null, 2)
						}] }
					};
				}
				case "memory_sentinel_trigger": {
					let snlTrigPayload;
					if (args.result !== void 0 && args.result !== null) if (typeof args.result === "string") try {
						snlTrigPayload = JSON.parse(args.result);
					} catch {
						return {
							status_code: 400,
							body: { error: "invalid result JSON" }
						};
					}
					else snlTrigPayload = args.result;
					const sentinelId = asNonEmptyString(args.sentinelId);
					if (!sentinelId) return {
						status_code: 400,
						body: { error: "sentinelId is required for memory_sentinel_trigger" }
					};
					const snlTrigResult = await sdk.trigger({
						function_id: "mem::sentinel-trigger",
						payload: {
							sentinelId,
							result: snlTrigPayload
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(snlTrigResult, null, 2)
						}] }
					};
				}
				case "memory_sketch_create": {
					const title = asNonEmptyString(args.title);
					if (!title) return {
						status_code: 400,
						body: { error: "title is required for memory_sketch_create" }
					};
					const sketchPayload = {
						title,
						description: asNonEmptyString(args.description),
						expiresInMs: asNumber(args.expiresInMs),
						project: asNonEmptyString(args.project)
					};
					const skResult = await sdk.trigger({
						function_id: "mem::sketch-create",
						payload: sketchPayload
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(skResult, null, 2)
						}] }
					};
				}
				case "memory_sketch_promote": {
					const sketchId = asNonEmptyString(args.sketchId);
					if (!sketchId) return {
						status_code: 400,
						body: { error: "sketchId is required for memory_sketch_promote" }
					};
					const skpResult = await sdk.trigger({
						function_id: "mem::sketch-promote",
						payload: {
							sketchId,
							project: args.project
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(skpResult, null, 2)
						}] }
					};
				}
				case "memory_crystallize": {
					if (typeof args.actionIds !== "string" || !args.actionIds.trim()) return {
						status_code: 400,
						body: { error: "actionIds is required" }
					};
					const crysIds = args.actionIds.split(",").map((s) => s.trim()).filter(Boolean);
					const crysResult = await sdk.trigger({
						function_id: "mem::crystallize",
						payload: {
							actionIds: crysIds,
							project: args.project,
							sessionId: args.sessionId
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(crysResult, null, 2)
						}] }
					};
				}
				case "memory_diagnose": {
					const diagCats = typeof args.categories === "string" && args.categories.trim() ? args.categories.split(",").map((s) => s.trim()).filter(Boolean) : void 0;
					const diagResult = await sdk.trigger({
						function_id: "mem::diagnose",
						payload: { categories: diagCats }
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(diagResult, null, 2)
						}] }
					};
				}
				case "memory_heal": {
					const healCats = typeof args.categories === "string" && args.categories.trim() ? args.categories.split(",").map((s) => s.trim()).filter(Boolean) : void 0;
					const healResult = await sdk.trigger({
						function_id: "mem::heal",
						payload: {
							categories: healCats,
							dryRun: args.dryRun === true || args.dryRun === "true"
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(healResult, null, 2)
						}] }
					};
				}
				case "memory_facet_tag": {
					const fctResult = await sdk.trigger({
						function_id: "mem::facet-tag",
						payload: {
							targetId: args.targetId,
							targetType: args.targetType,
							dimension: args.dimension,
							value: args.value
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(fctResult, null, 2)
						}] }
					};
				}
				case "memory_facet_query": {
					if (args.matchAll !== void 0 && typeof args.matchAll !== "string") return {
						status_code: 400,
						body: { error: "matchAll must be a string" }
					};
					if (args.matchAny !== void 0 && typeof args.matchAny !== "string") return {
						status_code: 400,
						body: { error: "matchAny must be a string" }
					};
					const fqAll = typeof args.matchAll === "string" && args.matchAll.trim() ? args.matchAll.split(",").map((s) => s.trim()).filter(Boolean) : void 0;
					const fqAny = typeof args.matchAny === "string" && args.matchAny.trim() ? args.matchAny.split(",").map((s) => s.trim()).filter(Boolean) : void 0;
					const fqResult = await sdk.trigger({
						function_id: "mem::facet-query",
						payload: {
							matchAll: fqAll,
							matchAny: fqAny,
							targetType: args.targetType
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(fqResult, null, 2)
						}] }
					};
				}
				case "memory_verify": {
					if (!args.id || typeof args.id !== "string") return {
						status_code: 400,
						body: { error: "id is required" }
					};
					const verifyResult = await sdk.trigger({
						function_id: "mem::verify",
						payload: { id: args.id }
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(verifyResult, null, 2)
						}] }
					};
				}
				case "memory_lesson_save": {
					if (typeof args.content !== "string" || !args.content.trim()) return {
						status_code: 400,
						body: { error: "content is required" }
					};
					const lessonTags = typeof args.tags === "string" && args.tags.trim() ? args.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
					const lessonSaveResult = await sdk.trigger({
						function_id: "mem::lesson-save",
						payload: {
							content: args.content,
							context: args.context || "",
							confidence: args.confidence,
							project: args.project,
							tags: lessonTags,
							source: "manual"
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(lessonSaveResult, null, 2)
						}] }
					};
				}
				case "memory_lesson_recall": {
					if (typeof args.query !== "string" || !args.query.trim()) return {
						status_code: 400,
						body: { error: "query is required" }
					};
					const lessonRecallResult = await sdk.trigger({
						function_id: "mem::lesson-recall",
						payload: {
							query: args.query,
							project: args.project,
							minConfidence: args.minConfidence,
							limit: args.limit
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(lessonRecallResult, null, 2)
						}] }
					};
				}
				case "memory_reflect": {
					const reflectResult = await sdk.trigger({
						function_id: "mem::reflect",
						payload: {
							project: args.project,
							maxClusters: args.maxClusters
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(reflectResult, null, 2)
						}] }
					};
				}
				case "memory_insight_list": {
					const insightListResult = await sdk.trigger({
						function_id: "mem::insight-list",
						payload: {
							project: args.project,
							minConfidence: args.minConfidence,
							limit: args.limit
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(insightListResult, null, 2)
						}] }
					};
				}
				case "memory_obsidian_export": {
					const exportTypes = typeof args.types === "string" && args.types.trim() ? args.types.split(",").map((t) => t.trim()).filter(Boolean) : void 0;
					const obsidianResult = await sdk.trigger({
						function_id: "mem::obsidian-export",
						payload: {
							vaultDir: args.vaultDir,
							types: exportTypes
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(obsidianResult, null, 2)
						}] }
					};
				}
				case "memory_slot_list": {
					const result = await sdk.trigger({
						function_id: "mem::slot-list",
						payload: {}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_slot_get": {
					const label = asNonEmptyString(args.label);
					if (!label) return {
						status_code: 400,
						body: { error: "label required" }
					};
					const result = await sdk.trigger({
						function_id: "mem::slot-get",
						payload: { label }
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_slot_create": {
					const label = asNonEmptyString(args.label);
					if (!label) return {
						status_code: 400,
						body: { error: "label required" }
					};
					const payload = { label };
					if (typeof args.content === "string") payload.content = args.content;
					if (typeof args.description === "string") payload.description = args.description;
					if (typeof args.sizeLimit === "number") payload.sizeLimit = args.sizeLimit;
					if (args.pinned === false || args.pinned === "false") payload.pinned = false;
					else if (args.pinned === true || args.pinned === "true") payload.pinned = true;
					if (args.scope === "global" || args.scope === "project") payload.scope = args.scope;
					const result = await sdk.trigger({
						function_id: "mem::slot-create",
						payload
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_slot_append": {
					const label = asNonEmptyString(args.label);
					const text = typeof args.text === "string" ? args.text : null;
					if (!label || !text) return {
						status_code: 400,
						body: { error: "label and text required" }
					};
					const result = await sdk.trigger({
						function_id: "mem::slot-append",
						payload: {
							label,
							text
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_slot_replace": {
					const label = asNonEmptyString(args.label);
					if (!label || typeof args.content !== "string") return {
						status_code: 400,
						body: { error: "label and content (string) required" }
					};
					const result = await sdk.trigger({
						function_id: "mem::slot-replace",
						payload: {
							label,
							content: args.content
						}
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_slot_delete": {
					const label = asNonEmptyString(args.label);
					if (!label) return {
						status_code: 400,
						body: { error: "label required" }
					};
					const result = await sdk.trigger({
						function_id: "mem::slot-delete",
						payload: { label }
					});
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify(result, null, 2)
						}] }
					};
				}
				case "memory_commit_lookup": {
					const sha = asNonEmptyString(args.sha);
					if (!sha) return {
						status_code: 400,
						body: { error: "sha required" }
					};
					const link = await kv.get(KV.commits, sha);
					if (!link) return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify({
								commit: null,
								sessions: []
							}, null, 2)
						}] }
					};
					const linkRecord = link;
					const sessions = (await Promise.all((linkRecord.sessionIds ?? []).map((sid) => kv.get(KV.sessions, sid)))).filter((s) => s !== null);
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify({
								commit: link,
								sessions
							}, null, 2)
						}] }
					};
				}
				case "memory_commits": {
					const branch = typeof args.branch === "string" ? args.branch : void 0;
					const repo = typeof args.repo === "string" ? args.repo : void 0;
					const limit = Math.max(1, Math.min(500, asNumber(args.limit, 100) ?? 100));
					const filtered = (await kv.list(KV.commits)).filter((c) => !branch || c.branch === branch).filter((c) => !repo || c.repo === repo).sort((a, b) => (a.linkedAt ?? "") < (b.linkedAt ?? "") ? 1 : -1).slice(0, limit);
					return {
						status_code: 200,
						body: { content: [{
							type: "text",
							text: JSON.stringify({ commits: filtered }, null, 2)
						}] }
					};
				}
				default: return {
					status_code: 400,
					body: { error: `Unknown tool: ${name}` }
				};
			}
		} catch (err) {
			return {
				status_code: 500,
				body: { error: "Internal error" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "mcp::tools::call",
		config: {
			api_path: "/agentmemory/mcp/call",
			http_method: "POST"
		}
	});
	const MCP_RESOURCES = [
		{
			uri: "agentmemory://status",
			name: "Agent Memory Status",
			description: "Current session count, memory count, and health status",
			mimeType: "application/json"
		},
		{
			uri: "agentmemory://project/{name}/profile",
			name: "Project Profile",
			description: "Top concepts, frequently modified files, and conventions for a project",
			mimeType: "application/json"
		},
		{
			uri: "agentmemory://project/{name}/recent",
			name: "Recent Sessions",
			description: "Last 5 session summaries for a project",
			mimeType: "application/json"
		},
		{
			uri: "agentmemory://memories/latest",
			name: "Latest Memories",
			description: "Top 10 latest memories with their type and strength",
			mimeType: "application/json"
		},
		{
			uri: "agentmemory://graph/stats",
			name: "Knowledge Graph Stats",
			description: "Node and edge counts by type in the knowledge graph",
			mimeType: "application/json"
		},
		{
			uri: "agentmemory://team/{id}/profile",
			name: "Team Profile",
			description: "Team memory profile with shared concepts and patterns",
			mimeType: "application/json"
		}
	];
	sdk.registerFunction("mcp::resources::list", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: { resources: MCP_RESOURCES }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "mcp::resources::list",
		config: {
			api_path: "/agentmemory/mcp/resources",
			http_method: "GET"
		}
	});
	sdk.registerFunction("mcp::resources::read", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const uri = req.body?.uri;
		if (!uri || typeof uri !== "string") return {
			status_code: 400,
			body: { error: "uri is required" }
		};
		try {
			if (uri === "agentmemory://status") {
				const sessions = await kv.list(KV.sessions);
				const memories = await kv.list(KV.memories);
				const healthData = await kv.list(KV.health).catch(() => []);
				return {
					status_code: 200,
					body: { contents: [{
						uri,
						mimeType: "application/json",
						text: JSON.stringify({
							sessionCount: sessions.length,
							memoryCount: memories.length,
							healthStatus: healthData.length > 0 ? "available" : "no-data"
						})
					}] }
				};
			}
			const projectProfileMatch = uri.match(/^agentmemory:\/\/project\/(.+)\/profile$/);
			if (projectProfileMatch) {
				let projectName;
				try {
					projectName = decodeURIComponent(projectProfileMatch[1]);
				} catch {
					return {
						status_code: 400,
						body: { error: "Invalid percent-encoding in URI" }
					};
				}
				const profile = await sdk.trigger({
					function_id: "mem::profile",
					payload: { project: projectName }
				});
				return {
					status_code: 200,
					body: { contents: [{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(profile)
					}] }
				};
			}
			const projectRecentMatch = uri.match(/^agentmemory:\/\/project\/(.+)\/recent$/);
			if (projectRecentMatch) {
				let projectName;
				try {
					projectName = decodeURIComponent(projectRecentMatch[1]);
				} catch {
					return {
						status_code: 400,
						body: { error: "Invalid percent-encoding in URI" }
					};
				}
				const filtered = (await kv.list(KV.summaries)).filter((s) => s.project === projectName).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
				return {
					status_code: 200,
					body: { contents: [{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(filtered)
					}] }
				};
			}
			if (uri === "agentmemory://memories/latest") {
				const latest = (await kv.list(KV.memories)).filter((m) => m.isLatest).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 10).map((m) => ({
					id: m.id,
					title: m.title,
					type: m.type,
					strength: m.strength
				}));
				return {
					status_code: 200,
					body: { contents: [{
						uri,
						mimeType: "application/json",
						text: JSON.stringify(latest)
					}] }
				};
			}
			if (uri === "agentmemory://graph/stats") try {
				const nodes = await kv.list(KV.graphNodes);
				const edges = await kv.list(KV.graphEdges);
				const nodesByType = {};
				for (const n of nodes) nodesByType[n.type] = (nodesByType[n.type] || 0) + 1;
				const edgesByType = {};
				for (const e of edges) edgesByType[e.type] = (edgesByType[e.type] || 0) + 1;
				return {
					status_code: 200,
					body: { contents: [{
						uri,
						mimeType: "application/json",
						text: JSON.stringify({
							totalNodes: nodes.length,
							totalEdges: edges.length,
							nodesByType,
							edgesByType
						})
					}] }
				};
			} catch {
				return {
					status_code: 200,
					body: { contents: [{
						uri,
						mimeType: "application/json",
						text: JSON.stringify({
							totalNodes: 0,
							totalEdges: 0
						})
					}] }
				};
			}
			const teamProfileMatch = uri.match(/^agentmemory:\/\/team\/(.+)\/profile$/);
			if (teamProfileMatch) try {
				const teamId = decodeURIComponent(teamProfileMatch[1]);
				const items = await kv.list(KV.teamShared(teamId));
				return {
					status_code: 200,
					body: { contents: [{
						uri,
						mimeType: "application/json",
						text: JSON.stringify({
							teamId,
							sharedItems: items.length
						})
					}] }
				};
			} catch {
				return {
					status_code: 200,
					body: { contents: [{
						uri,
						mimeType: "application/json",
						text: JSON.stringify({
							teamId: teamProfileMatch[1],
							sharedItems: 0
						})
					}] }
				};
			}
			return {
				status_code: 404,
				body: { error: `Unknown resource: ${uri}` }
			};
		} catch {
			return {
				status_code: 500,
				body: { error: "Internal error" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "mcp::resources::read",
		config: {
			api_path: "/agentmemory/mcp/resources/read",
			http_method: "POST"
		}
	});
	const MCP_PROMPTS = [
		{
			name: "recall_context",
			description: "Search observations and memories to build context for a task",
			arguments: [{
				name: "task_description",
				description: "What you are working on",
				required: true
			}]
		},
		{
			name: "session_handoff",
			description: "Generate a handoff summary for continuing work in a new session",
			arguments: [{
				name: "session_id",
				description: "Session ID to hand off from",
				required: true
			}]
		},
		{
			name: "detect_patterns",
			description: "Detect recurring patterns across sessions for a project",
			arguments: [{
				name: "project",
				description: "Project path to analyze (optional)",
				required: false
			}]
		}
	];
	sdk.registerFunction("mcp::prompts::list", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		return {
			status_code: 200,
			body: { prompts: MCP_PROMPTS }
		};
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "mcp::prompts::list",
		config: {
			api_path: "/agentmemory/mcp/prompts",
			http_method: "GET"
		}
	});
	sdk.registerFunction("mcp::prompts::get", async (req) => {
		const authErr = checkAuth(req, secret);
		if (authErr) return authErr;
		const promptName = req.body?.name;
		if (!promptName || typeof promptName !== "string") return {
			status_code: 400,
			body: { error: "name is required" }
		};
		const promptArgs = req.body?.arguments || {};
		try {
			switch (promptName) {
				case "recall_context": {
					const taskDesc = promptArgs.task_description;
					if (typeof taskDesc !== "string" || !taskDesc.trim()) return {
						status_code: 400,
						body: { error: "task_description argument is required and must be a string" }
					};
					const searchResult = await sdk.trigger({
						function_id: "mem::search",
						payload: {
							query: taskDesc,
							limit: 10
						}
					}).catch(() => ({ results: [] }));
					const relevant = (await kv.list(KV.memories)).filter((m) => m.isLatest).slice(0, 5);
					return {
						status_code: 200,
						body: { messages: [{
							role: "user",
							content: {
								type: "text",
								text: `Here is relevant context from past sessions for the task: "${taskDesc}"\n\n## Past Observations\n${JSON.stringify(searchResult, null, 2)}\n\n## Relevant Memories\n${JSON.stringify(relevant, null, 2)}`
							}
						}] }
					};
				}
				case "session_handoff": {
					const sessionId = promptArgs.session_id;
					if (typeof sessionId !== "string" || !sessionId.trim()) return {
						status_code: 400,
						body: { error: "session_id argument is required and must be a string" }
					};
					const session = await kv.get(KV.sessions, sessionId);
					const summary = (await kv.list(KV.summaries)).find((s) => s.sessionId === sessionId);
					return {
						status_code: 200,
						body: { messages: [{
							role: "user",
							content: {
								type: "text",
								text: `## Session Handoff\n\n### Session\n${JSON.stringify(session, null, 2)}\n\n### Summary\n${JSON.stringify(summary || "No summary available", null, 2)}`
							}
						}] }
					};
				}
				case "detect_patterns": {
					if (promptArgs.project !== void 0 && typeof promptArgs.project !== "string") return {
						status_code: 400,
						body: { error: "project argument must be a string" }
					};
					const result = await sdk.trigger({
						function_id: "mem::patterns",
						payload: { project: promptArgs.project || void 0 }
					});
					return {
						status_code: 200,
						body: { messages: [{
							role: "user",
							content: {
								type: "text",
								text: `## Pattern Analysis\n\n${JSON.stringify(result, null, 2)}`
							}
						}] }
					};
				}
				default: return {
					status_code: 400,
					body: { error: `Unknown prompt: ${promptName}` }
				};
			}
		} catch {
			return {
				status_code: 500,
				body: { error: "Internal error" }
			};
		}
	});
	sdk.registerTrigger({
		type: "http",
		function_id: "mcp::prompts::get",
		config: {
			api_path: "/agentmemory/mcp/prompts/get",
			http_method: "POST"
		}
	});
}

//#endregion
//#region src/viewer/server.ts
function loadViewerFavicon() {
	const base = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		join(base, "..", "src", "viewer", "favicon.svg"),
		join(base, "..", "viewer", "favicon.svg"),
		join(base, "viewer", "favicon.svg")
	];
	for (const path of candidates) try {
		return readFileSync(path);
	} catch {}
	return null;
}
const ALLOWED_ORIGINS = (process.env.VIEWER_ALLOWED_ORIGINS || "http://localhost:3111,http://localhost:3113,http://127.0.0.1:3111,http://127.0.0.1:3113").split(",").map((o) => o.trim());
const ALLOWED_HOSTS_OVERRIDE = (process.env.VIEWER_ALLOWED_HOSTS || "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
function buildAllowedHosts(origins, listenPort) {
	const hosts = /* @__PURE__ */ new Set();
	for (const o of origins) try {
		const parsed = new URL(o);
		if (parsed.host) hosts.add(parsed.host.toLowerCase());
	} catch {}
	hosts.add(`localhost:${listenPort}`);
	hosts.add(`127.0.0.1:${listenPort}`);
	hosts.add(`[::1]:${listenPort}`);
	for (const h of ALLOWED_HOSTS_OVERRIDE) hosts.add(h);
	return hosts;
}
function isHostAllowed(headerHost, allowed) {
	if (typeof headerHost !== "string") return false;
	const lower = headerHost.toLowerCase().trim();
	if (!lower) return false;
	return allowed.has(lower);
}
function corsHeaders(req) {
	const origin = req.headers.origin || "";
	const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
	return {
		"Access-Control-Allow-Origin": allowed,
		"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization",
		Vary: "Origin"
	};
}
function json(res, status, data, req) {
	const body = JSON.stringify(data);
	const cors = req ? corsHeaders(req) : {
		"Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
		Vary: "Origin"
	};
	res.writeHead(status, {
		...cors,
		"Content-Type": "application/json"
	});
	res.end(body);
}
function readBody(req) {
	return new Promise((resolve, reject) => {
		let data = "";
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > 1e6) {
				req.destroy();
				reject(/* @__PURE__ */ new Error("too large"));
				return;
			}
			data += chunk.toString();
		});
		req.on("end", () => resolve(data));
		req.on("error", reject);
	});
}
const MAX_VIEWER_PORT_RETRIES = 10;
function startViewerServer(port, _kv, _sdk, secret, restPort) {
	const resolvedRestPort = restPort ?? port - 2;
	const requestedPort = port;
	let allowedHosts = null;
	const server = createServer(async (req, res) => {
		if (!allowedHosts) {
			const addr = server.address();
			allowedHosts = buildAllowedHosts(ALLOWED_ORIGINS, addr && typeof addr === "object" && "port" in addr ? addr.port : port);
		}
		if (!isHostAllowed(req.headers.host, allowedHosts)) {
			res.writeHead(403, { "Content-Type": "text/plain" });
			res.end("forbidden host");
			return;
		}
		const raw = req.url || "/";
		const qIdx = raw.indexOf("?");
		const pathname = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
		const qs = qIdx >= 0 ? raw.slice(qIdx + 1) : "";
		const method = req.method || "GET";
		if (method === "OPTIONS") {
			res.writeHead(204, {
				...corsHeaders(req),
				"Access-Control-Max-Age": "86400"
			});
			res.end();
			return;
		}
		if (method === "GET" && (pathname === "/" || pathname === "/viewer" || pathname === "/agentmemory/viewer")) {
			const rendered = renderViewerDocument();
			if (rendered.found) {
				res.writeHead(200, {
					"Content-Type": "text/html; charset=utf-8",
					"Content-Security-Policy": rendered.csp,
					"Cache-Control": "no-cache"
				});
				res.end(rendered.html);
				return;
			}
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("viewer not found");
			return;
		}
		if (method === "GET" && pathname === "/favicon.svg") {
			const favicon = loadViewerFavicon();
			if (favicon) {
				res.writeHead(200, {
					"Content-Type": "image/svg+xml",
					"Cache-Control": "public, max-age=3600"
				});
				res.end(favicon);
				return;
			}
			res.writeHead(404, { "Content-Type": "text/plain" });
			res.end("favicon not found");
			return;
		}
		try {
			await proxyToRestApi(resolvedRestPort, pathname, qs, method, req, res, secret);
		} catch (err) {
			console.error(`[viewer] proxy error on ${method} ${pathname}:`, err);
			json(res, 502, { error: "upstream error" }, req);
		}
	});
	let attempt = 0;
	let currentPort = requestedPort;
	const tryListen = () => {
		server.listen(currentPort, "127.0.0.1");
	};
	server.on("listening", () => {
		if (currentPort === requestedPort) console.log(`[agentmemory] Viewer: http://localhost:${currentPort}`);
		else console.log(`[agentmemory] Viewer started on http://localhost:${currentPort} (fallback from ${requestedPort})`);
	});
	server.on("error", (err) => {
		if (err.code === "EADDRINUSE" && attempt < MAX_VIEWER_PORT_RETRIES) {
			attempt++;
			currentPort = requestedPort + attempt;
			setImmediate(tryListen);
			return;
		}
		if (err.code === "EADDRINUSE") console.warn(`[agentmemory] Viewer ports ${requestedPort}-${requestedPort + MAX_VIEWER_PORT_RETRIES} all in use, skipping viewer.`);
		else console.error(`[agentmemory] Viewer error:`, err.message);
	});
	tryListen();
	return server;
}
async function proxyToRestApi(restPort, pathname, qs, method, req, res, secret) {
	const upstreamUrl = `http://127.0.0.1:${restPort}${pathname.startsWith("/agentmemory/") ? pathname : `/agentmemory${pathname.startsWith("/") ? pathname : "/" + pathname}`}${qs ? "?" + qs : ""}`;
	const headers = {};
	if (secret) headers["Authorization"] = `Bearer ${secret}`;
	const ct = req.headers["content-type"];
	if (ct) headers["Content-Type"] = ct;
	let body;
	if (method === "POST" || method === "PUT" || method === "DELETE" || method === "PATCH") body = await readBody(req);
	const controller = new AbortController();
	const fetchTimeout = setTimeout(() => controller.abort(), 1e4);
	let upstream;
	try {
		upstream = await fetch(upstreamUrl, {
			method,
			headers,
			body: body || void 0,
			signal: controller.signal
		});
		clearTimeout(fetchTimeout);
	} catch (err) {
		clearTimeout(fetchTimeout);
		if (err instanceof Error && err.name === "AbortError") {
			json(res, 504, { error: "upstream timeout" }, req);
			return;
		}
		throw err;
	}
	const cors = corsHeaders(req);
	const responseBody = await upstream.text();
	const responseHeaders = { ...cors };
	const upstreamCt = upstream.headers.get("content-type");
	if (upstreamCt) responseHeaders["Content-Type"] = upstreamCt;
	res.writeHead(upstream.status, responseHeaders);
	res.end(responseBody);
}

//#endregion
//#region src/eval/metrics-store.ts
var MetricsStore = class {
	cache = /* @__PURE__ */ new Map();
	qualityCallCounts = /* @__PURE__ */ new Map();
	constructor(kv) {
		this.kv = kv;
	}
	async record(functionId, latencyMs, success, qualityScore) {
		let m = this.cache.get(functionId);
		if (!m) m = await this.kv.get(KV.metrics, functionId) ?? {
			functionId,
			totalCalls: 0,
			successCount: 0,
			failureCount: 0,
			avgLatencyMs: 0,
			avgQualityScore: 0
		};
		const prev = m.totalCalls;
		m.totalCalls += 1;
		m.avgLatencyMs = (m.avgLatencyMs * prev + latencyMs) / m.totalCalls;
		if (success) m.successCount += 1;
		else m.failureCount += 1;
		if (qualityScore !== void 0) {
			const prevQualityCalls = this.qualityCallCounts.get(functionId) || 0;
			m.avgQualityScore = (m.avgQualityScore * prevQualityCalls + qualityScore) / (prevQualityCalls + 1);
			this.qualityCallCounts.set(functionId, prevQualityCalls + 1);
		}
		this.cache.set(functionId, m);
		await this.kv.set(KV.metrics, functionId, m).catch(() => {});
	}
	async get(functionId) {
		return this.cache.get(functionId) ?? await this.kv.get(KV.metrics, functionId);
	}
	async getAll() {
		const kvMetrics = await this.kv.list(KV.metrics).catch(() => []);
		const merged = /* @__PURE__ */ new Map();
		for (const m of kvMetrics) merged.set(m.functionId, m);
		for (const [id, m] of this.cache) merged.set(id, m);
		return Array.from(merged.values());
	}
};

//#endregion
//#region src/functions/dedup.ts
const TTL_MS = 300 * 1e3;
const CLEANUP_INTERVAL_MS = 6e4;
var DedupMap = class {
	entries = /* @__PURE__ */ new Map();
	cleanupTimer;
	constructor() {
		this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
		this.cleanupTimer.unref();
	}
	computeHash(sessionId, toolName, toolInput) {
		const raw = `${sessionId}:${toolName}:${typeof toolInput === "string" ? toolInput.slice(0, 500) : JSON.stringify(toolInput ?? "").slice(0, 500)}`;
		return createHash("sha256").update(raw).digest("hex");
	}
	isDuplicate(hash) {
		const entry = this.entries.get(hash);
		if (!entry) return false;
		if (Date.now() > entry.expiresAt) {
			this.entries.delete(hash);
			return false;
		}
		return true;
	}
	record(hash) {
		this.entries.set(hash, {
			hash,
			expiresAt: Date.now() + TTL_MS
		});
	}
	cleanup() {
		const now = Date.now();
		for (const [key, entry] of this.entries) if (now > entry.expiresAt) this.entries.delete(key);
	}
	stop() {
		clearInterval(this.cleanupTimer);
	}
	get size() {
		return this.entries.size;
	}
};

//#endregion
//#region src/telemetry/setup.ts
const OTEL_CONFIG = {
	serviceName: "agentmemory",
	serviceVersion: VERSION,
	metricsExportIntervalMs: 3e4
};
let counters = null;
let histograms = null;
const NOOP_COUNTER = { add: () => {} };
const NOOP_HISTOGRAM = { record: () => {} };
const COUNTER_NAMES = [
	["observationsTotal", "observations.total"],
	["compressionSuccess", "compression.success"],
	["compressionFailure", "compression.failure"],
	["searchTotal", "search.total"],
	["dedupSkipped", "dedup.skipped"],
	["evictionTotal", "eviction.total"],
	["circuitBreakerOpen", "circuit_breaker.open"],
	["embeddingSuccess", "embedding.success"],
	["embeddingFailure", "embedding.failure"],
	["vectorSearchTotal", "vector_search.total"],
	["autoForgetTotal", "auto_forget.total"],
	["profileGenerated", "profile.generated"],
	["claudeBridgeSync", "claude_bridge.sync"],
	["graphExtraction", "graph.extraction"],
	["consolidationRun", "consolidation.run"],
	["teamShare", "team.share"],
	["auditLog", "audit.log"],
	["snapshotCreate", "snapshot.create"],
	["governanceDelete", "governance.delete"]
];
const HISTOGRAM_NAMES = [
	["compressionLatency", "compression.latency_ms"],
	["searchLatency", "search.latency_ms"],
	["contextTokens", "context.tokens"],
	["qualityScore", "quality.score"],
	["embeddingLatency", "embedding.latency_ms"],
	["vectorSearchLatency", "vector_search.latency_ms"]
];
function initMetrics(getMeter) {
	const meter = getMeter?.("agentmemory");
	counters = Object.fromEntries(COUNTER_NAMES.map(([key, name]) => [key, meter ? meter.createCounter(name) : NOOP_COUNTER]));
	histograms = Object.fromEntries(HISTOGRAM_NAMES.map(([key, name]) => [key, meter ? meter.createHistogram(name) : NOOP_HISTOGRAM]));
	return {
		counters,
		histograms
	};
}

//#endregion
//#region src/index.ts
function hasGetMeter(sdk) {
	return typeof sdk === "object" && sdk !== null && "getMeter" in sdk && typeof sdk.getMeter === "function";
}
let lastUnhandledLogAt = 0;
process.on("unhandledRejection", (reason) => {
	const now = Date.now();
	if (now - lastUnhandledLogAt < 6e4) return;
	lastUnhandledLogAt = now;
	const r = reason;
	console.warn(`[agentmemory] unhandledRejection (suppressed):`, r?.code ? `${r.code} ${r.function_id ?? ""} ${r.message ?? ""}`.trim() : reason);
});
async function main() {
	const config = loadConfig();
	const embeddingConfig = loadEmbeddingConfig();
	const fallbackConfig = loadFallbackConfig();
	const provider = fallbackConfig.providers.length > 0 ? createFallbackProvider(config.provider, fallbackConfig) : createProvider(config.provider);
	const embeddingProvider = createEmbeddingProvider();
	const imageEmbeddingProvider = createImageEmbeddingProvider();
	bootLog(`Starting worker v${VERSION}...`);
	bootLog(`Engine: ${config.engineUrl}`);
	bootLog(`Provider: ${config.provider.provider} (${config.provider.model})`);
	if (embeddingProvider) bootLog(`Embedding provider: ${embeddingProvider.name} (${embeddingProvider.dimensions} dims)`);
	else bootLog(`Embedding provider: none (BM25-only mode)`);
	if (imageEmbeddingProvider) bootLog(`Image embedding provider: ${imageEmbeddingProvider.name} (${imageEmbeddingProvider.dimensions} dims) — vision-search active`);
	bootLog(`REST API: http://localhost:${config.restPort}/agentmemory/*`);
	bootLog(`Streams: ws://localhost:${config.streamsPort}`);
	const sdk = registerWorker(config.engineUrl, {
		workerName: "agentmemory",
		invocationTimeoutMs: 18e4,
		otel: {
			serviceName: OTEL_CONFIG.serviceName,
			serviceVersion: OTEL_CONFIG.serviceVersion,
			metricsExportIntervalMs: OTEL_CONFIG.metricsExportIntervalMs
		},
		telemetry: {
			project_name: "agentmemory",
			language: "node",
			framework: "iii-sdk"
		}
	});
	const kv = new StateKV(sdk);
	const secret = getEnvVar("AGENTMEMORY_SECRET");
	const metricsStore = new MetricsStore(kv);
	const dedupMap = new DedupMap();
	const vectorIndex = embeddingProvider ? new VectorIndex() : null;
	setVectorIndex(vectorIndex);
	setEmbeddingProvider(embeddingProvider);
	initMetrics(hasGetMeter(sdk) ? sdk.getMeter.bind(sdk) : void 0);
	registerPrivacyFunction(sdk);
	registerObserveFunction(sdk, kv, dedupMap, config.maxObservationsPerSession);
	registerImageQuotaCleanup(sdk, kv);
	registerVisionSearchFunctions(sdk, kv, imageEmbeddingProvider);
	if (isSlotsEnabled()) registerSlotsFunctions(sdk, kv);
	registerDiskSizeManager(sdk, kv);
	registerCompressFunction(sdk, kv, provider, metricsStore);
	registerSearchFunction(sdk, kv);
	registerContextFunction(sdk, kv, config.tokenBudget);
	registerSummarizeFunction(sdk, kv, provider, metricsStore);
	registerMigrateFunction(sdk, kv);
	registerFileIndexFunction(sdk, kv);
	registerConsolidateFunction(sdk, kv, provider);
	registerPatternsFunction(sdk, kv);
	registerRememberFunction(sdk, kv);
	registerEvictFunction(sdk, kv);
	registerRelationsFunction(sdk, kv);
	registerTimelineFunction(sdk, kv);
	registerProfileFunction(sdk, kv);
	registerAutoForgetFunction(sdk, kv);
	registerExportImportFunction(sdk, kv);
	registerEnrichFunction(sdk, kv);
	const claudeBridgeConfig = loadClaudeBridgeConfig();
	if (claudeBridgeConfig.enabled) {
		registerClaudeBridgeFunction(sdk, kv, claudeBridgeConfig);
		bootLog(`Claude bridge: syncing to ${claudeBridgeConfig.memoryFilePath}`);
	}
	if (isGraphExtractionEnabled()) {
		registerGraphFunction(sdk, kv, provider);
		bootLog(`Knowledge graph: extraction enabled`);
	}
	registerConsolidationPipelineFunction(sdk, kv, provider);
	bootLog(`Consolidation pipeline: registered (CONSOLIDATION_ENABLED=${isConsolidationEnabled() ? "true" : "false"})`);
	if (isAutoCompressEnabled()) bootLog(`WARNING: AGENTMEMORY_AUTO_COMPRESS=true — every PostToolUse observation will be sent to your LLM provider for compression. This spends API tokens proportional to your session tool-use frequency (see #138). Set AGENTMEMORY_AUTO_COMPRESS=false to disable.`);
	else bootLog(`Auto-compress: OFF (default, #138) — observations indexed via zero-LLM synthetic compression. Set AGENTMEMORY_AUTO_COMPRESS=true to opt-in to LLM-powered summaries (uses your API key).`);
	if (isContextInjectionEnabled()) bootLog(`WARNING: AGENTMEMORY_INJECT_CONTEXT=true — the PreToolUse and SessionStart hooks will inject up to ~4000 chars of memory context into every tool turn. On Claude Pro this burns session tokens proportional to your tool-call frequency (see #143). Set AGENTMEMORY_INJECT_CONTEXT=false to disable.`);
	else bootLog(`Context injection: OFF (default, #143) — hooks capture observations but do not inject context into Claude Code's conversation. Set AGENTMEMORY_INJECT_CONTEXT=true to opt-in (warning: expect your Claude Pro allocation to drain faster).`);
	const teamConfig = loadTeamConfig();
	if (teamConfig) {
		registerTeamFunction(sdk, kv, teamConfig);
		bootLog(`Team memory: ${teamConfig.teamId} (${teamConfig.mode})`);
	}
	registerGovernanceFunction(sdk, kv);
	registerActionsFunction(sdk, kv);
	registerFrontierFunction(sdk, kv);
	registerLeasesFunction(sdk, kv);
	registerRoutinesFunction(sdk, kv);
	registerSignalsFunction(sdk, kv);
	registerCheckpointsFunction(sdk, kv);
	registerMeshFunction(sdk, kv, secret);
	registerBranchAwareFunction(sdk, kv);
	registerFlowCompressFunction(sdk, kv, provider);
	registerSentinelsFunction(sdk, kv);
	registerSketchesFunction(sdk, kv);
	registerCrystallizeFunction(sdk, kv, provider);
	registerDiagnosticsFunction(sdk, kv);
	registerFacetsFunction(sdk, kv);
	registerVerifyFunction(sdk, kv);
	registerLessonsFunctions(sdk, kv);
	registerObsidianExportFunction(sdk, kv);
	registerReflectFunctions(sdk, kv, provider);
	registerWorkingMemoryFunctions(sdk, kv, config.tokenBudget);
	registerSkillExtractFunctions(sdk, kv, provider);
	registerCascadeFunction(sdk, kv);
	registerSlidingWindowFunction(sdk, kv, provider);
	registerQueryExpansionFunction(sdk, provider);
	registerTemporalGraphFunctions(sdk, kv, provider);
	registerRetentionFunctions(sdk, kv);
	registerCompressFileFunction(sdk, kv, provider);
	registerReplayFunctions(sdk, kv);
	bootLog(`v0.6 advanced retrieval: sliding-window, query-expansion, temporal-graph, retention-scoring`);
	bootLog(`Orchestration layer: actions, frontier, leases, routines, signals, checkpoints, flow-compress, mesh, branch-aware, sentinels, sketches, crystallize, diagnostics, facets`);
	if (isSlotsEnabled()) bootLog(`Slots: enabled (pinned editable memory). Reflect on Stop hook: ${isReflectEnabled() ? "on" : "off"}`);
	const snapshotConfig = loadSnapshotConfig();
	if (snapshotConfig.enabled) {
		registerSnapshotFunction(sdk, kv, snapshotConfig.dir);
		bootLog(`Git snapshots: ${snapshotConfig.dir} (every ${snapshotConfig.interval}s)`);
	}
	const bm25Index = getSearchIndex();
	const graphWeight = parseFloat(getEnvVar("AGENTMEMORY_GRAPH_WEIGHT") || "0.3");
	const hybridSearch = new HybridSearch(bm25Index, vectorIndex, embeddingProvider, kv, embeddingConfig.bm25Weight, embeddingConfig.vectorWeight, graphWeight);
	registerSmartSearchFunction(sdk, kv, (query, limit) => hybridSearch.search(query, limit));
	registerApiTriggers(sdk, kv, secret, metricsStore, provider);
	registerEventTriggers(sdk, kv);
	registerMcpEndpoints(sdk, kv, secret);
	const healthMonitor = registerHealthMonitor(sdk, kv);
	const indexPersistence = new IndexPersistence(kv, bm25Index, vectorIndex);
	const loaded = await indexPersistence.load().catch((err) => {
		console.warn(`[agentmemory] Failed to load persisted index:`, err);
		return null;
	});
	if (loaded?.bm25 && loaded.bm25.size > 0) {
		bm25Index.restoreFrom(loaded.bm25);
		bootLog(`Loaded persisted BM25 index (${bm25Index.size} docs)`);
	}
	if (loaded?.vector && vectorIndex && loaded.vector.size > 0) {
		const activeDim = embeddingProvider?.dimensions ?? 0;
		const { mismatches, seenDimensions } = activeDim > 0 ? loaded.vector.validateDimensions(activeDim) : {
			mismatches: [],
			seenDimensions: /* @__PURE__ */ new Set()
		};
		if (mismatches.length > 0) {
			const sample = mismatches.slice(0, 5).map((m) => `${m.obsId} (dim=${m.dim})`).join(", ");
			const distinct = Array.from(seenDimensions).sort((a, b) => a - b).join(", ");
			if (process.env["AGENTMEMORY_DROP_STALE_INDEX"] === "true") console.warn(`[agentmemory] Persisted vector index has ${mismatches.length} of ${loaded.vector.size} vectors with the wrong dimension. Active provider (${embeddingProvider?.name}) declares ${activeDim}; dimensions seen on disk: ${distinct}. AGENTMEMORY_DROP_STALE_INDEX=true is set — discarding the persisted vectors. Live observations will rebuild the index over time.`);
			else throw new Error(`[agentmemory] Refusing to start: persisted vector index has ${mismatches.length} of ${loaded.vector.size} vectors with the wrong dimension. Active provider (${embeddingProvider?.name}) declares ${activeDim}; dimensions seen on disk: ${distinct}. First mismatched obsIds: ${sample}. Loading would silently corrupt search (cross-dimension cosine returns 0). Choose one:\n  - Re-embed the existing index against the new provider, then start.\n  - Set AGENTMEMORY_DROP_STALE_INDEX=true to discard the persisted vectors and rebuild from live observations.\n  - Switch the embedding provider back to the one that wrote the index.`);
		} else {
			vectorIndex.restoreFrom(loaded.vector);
			bootLog(`Loaded persisted vector index (${vectorIndex.size} vectors)`);
		}
	}
	if (bm25Index.size === 0) {
		const indexCount = await rebuildIndex(kv).catch((err) => {
			console.warn(`[agentmemory] Failed to rebuild search index:`, err);
			return 0;
		});
		if (indexCount > 0) {
			bootLog(`Search index rebuilt: ${indexCount} entries`);
			indexPersistence.scheduleSave();
		}
	} else try {
		const memories = await kv.list(KV.memories);
		let backfilled = 0;
		for (const memory of memories) {
			if (memory.isLatest === false) continue;
			if (!memory.title || !memory.content) continue;
			if (bm25Index.has(memory.id)) continue;
			bm25Index.add({
				id: memory.id,
				sessionId: memory.sessionIds[0] ?? "memory",
				timestamp: memory.createdAt,
				type: "decision",
				title: memory.title,
				facts: [memory.content],
				narrative: memory.content,
				concepts: memory.concepts,
				files: memory.files,
				importance: memory.strength
			});
			backfilled++;
		}
		if (backfilled > 0) {
			bootLog(`Backfilled ${backfilled} memories into BM25 (legacy gap before #257)`);
			indexPersistence.scheduleSave();
		}
	} catch (err) {
		console.warn(`[agentmemory] Failed to backfill memories into BM25:`, err);
	}
	bootLog(`Ready. ${embeddingProvider ? "Triple-stream (BM25+Vector+Graph)" : "BM25+Graph"} search active.`);
	bootLog(`REST API: 124 endpoints at http://localhost:${config.restPort}/agentmemory/*`);
	bootLog(`MCP surface (opt-in via \`npx @agentmemory/mcp\`): ${getAllTools().length} tools · 6 resources · 3 prompts`);
	const viewerServer = startViewerServer(config.restPort + 2, kv, sdk, secret, config.restPort);
	const autoForgetIntervalMs = parseInt(process.env.AUTO_FORGET_INTERVAL_MS || "3600000", 10);
	const consolidationIntervalMs = parseInt(process.env.CONSOLIDATION_INTERVAL_MS || "7200000", 10);
	if (process.env.AUTO_FORGET_ENABLED !== "false") {
		setInterval(async () => {
			try {
				await sdk.trigger({
					function_id: "mem::auto-forget",
					payload: { dryRun: false }
				});
			} catch {}
		}, autoForgetIntervalMs).unref();
		bootLog(`Auto-forget: enabled (every ${autoForgetIntervalMs / 6e4}m)`);
	}
	if (process.env.LESSON_DECAY_ENABLED !== "false") {
		setInterval(async () => {
			try {
				await sdk.trigger({
					function_id: "mem::lesson-decay-sweep",
					payload: {}
				});
			} catch {}
		}, 864e5).unref();
		bootLog(`Lesson decay sweep: enabled (every 24h)`);
	}
	if (process.env.INSIGHT_DECAY_ENABLED !== "false") setInterval(async () => {
		try {
			await sdk.trigger({
				function_id: "mem::insight-decay-sweep",
				payload: {}
			});
		} catch {}
	}, 864e5).unref();
	if (isConsolidationEnabled()) {
		setInterval(async () => {
			try {
				await sdk.trigger({
					function_id: "mem::consolidate-pipeline",
					payload: {}
				});
			} catch {}
		}, consolidationIntervalMs).unref();
		bootLog(`Auto-consolidation: enabled (every ${consolidationIntervalMs / 6e4}m)`);
	}
	const shutdown = async () => {
		console.log(`\n[agentmemory] Shutting down...`);
		healthMonitor.stop();
		dedupMap.stop();
		indexPersistence.stop();
		await new Promise((resolve) => viewerServer.close(() => resolve()));
		await indexPersistence.save().catch((err) => {
			console.warn(`[agentmemory] Failed to save index on shutdown:`, err);
		});
		await sdk.shutdown();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}
main().catch((err) => {
	console.error(`[agentmemory] Fatal:`, err);
	process.exit(1);
});

//#endregion
export {  };
//# sourceMappingURL=index.mjs.map