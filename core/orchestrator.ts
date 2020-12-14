import type { ConfigContext } from "./context.ts";
import type { artfPersist as ap, valueMgr as vm } from "./deps.ts";
import { safety } from "./deps.ts";

export type OrchestratorName = vm.TextValue;
export type OrchestratorRegistryKey = vm.TextValue;
export type OrchestratorRegistryKeys = OrchestratorRegistryKey[];

export interface OrchestratorErrorReporter {
  (o: Orchestrator, msg: string): void;
}

export interface Orchestrator {
  readonly isOrchestrator: true;
  readonly name: OrchestratorName;
  persist(
    ctx: ConfigContext,
    ph: ap.PersistenceHandler,
    er?: OrchestratorErrorReporter,
  ): void;
  isValid(ctx: ConfigContext, er?: OrchestratorErrorReporter): boolean;
  registryKeys(ctx: ConfigContext): OrchestratorRegistryKeys;
}

export const isOrchestrator = safety.typeGuard<Orchestrator>("isOrchestrator");
