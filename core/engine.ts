import type { ConfigContext } from "./context.ts";

export type EngineName = string;
export type EngineRegistryKey = string;
export type EngineRegistryKeys = EngineRegistryKey[];

export interface Engine {
  readonly isEngine: true;
  readonly engineName: EngineName;
  registryKeys(ctx: ConfigContext): EngineRegistryKeys;
}

export function isEngine(c: unknown): c is Engine {
  return c && typeof c === "object" && "isEngine" in c;
}
