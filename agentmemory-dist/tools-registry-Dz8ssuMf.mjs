import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

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
function getStandalonePersistPath() {
	return getMergedEnv()["STANDALONE_PERSIST_PATH"] || join(homedir(), ".agentmemory", "standalone.json");
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
export { loadTeamConfig as _, getConsolidationDecayDays as a, isAutoCompressEnabled as c, isGraphExtractionEnabled as d, loadClaudeBridgeConfig as f, loadSnapshotConfig as g, loadFallbackConfig as h, detectLlmProviderKind as i, isConsolidationEnabled as l, loadEmbeddingConfig as m, getVisibleTools as n, getEnvVar as o, loadConfig as p, detectEmbeddingProvider as r, getStandalonePersistPath as s, getAllTools as t, isContextInjectionEnabled as u };
//# sourceMappingURL=tools-registry-Dz8ssuMf.mjs.map