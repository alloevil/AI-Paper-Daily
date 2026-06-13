//#region src/mcp/in-memory-kv.d.ts
declare class InMemoryKV {
  private persistPath?;
  private store;
  constructor(persistPath?: string | undefined);
  get<T = unknown>(scope: string, key: string): Promise<T | null>;
  set<T = unknown>(scope: string, key: string, data: T): Promise<T>;
  delete(scope: string, key: string): Promise<void>;
  list<T = unknown>(scope: string): Promise<T[]>;
  persist(): void;
}
//#endregion
//#region src/mcp/standalone.d.ts
declare function handleToolCall(toolName: string, args: Record<string, unknown>, kvInstance?: InMemoryKV): Promise<{
  content: Array<{
    type: string;
    text: string;
  }>;
}>;
declare function handleToolsList(): Promise<{
  tools: unknown[];
}>;
//#endregion
export { handleToolCall, handleToolsList };
//# sourceMappingURL=standalone.d.mts.map