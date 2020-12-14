import type { ConfigContext } from "./context.ts";
import { safety } from "./deps.ts";

export type EngineName = string;
export type EngineRegistryKey = string;
export type EngineRegistryKeys = EngineRegistryKey[];

export interface Engine {
  readonly isEngine: true;
  readonly engineName: EngineName;
  registryKeys(ctx: ConfigContext): EngineRegistryKeys;
}

export const isEngine = safety.typeGuard<Engine>("isEngine");
