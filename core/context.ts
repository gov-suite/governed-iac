import { contextMgr as cm, safety, valueMgr as vm } from "./deps.ts";
import { EnvVarPlaceholders, envVarPlaceholdersFactory } from "./env.ts";
import type { ServiceConfig } from "./service.ts";
export interface ConfigContextSubscriptionHandler<T> {
  (ctx: ConfigContext, x: T): void;
}

export interface ConfigContextSubscriptionSelector<T> {
  (x: unknown): x is T;
}

export type ConfigContextSubscriptionSelectors<T> =
  | ConfigContextSubscriptionSelector<T>
  | ConfigContextSubscriptionSelector<T>[];

export interface ConfigContext extends cm.ProjectContext {
  readonly isConfigContext: true;
  readonly name: vm.TextValue;
  readonly envVars: EnvVarPlaceholders;
  readonly configuredServices: readonly ServiceConfig[];
  configured<T extends ServiceConfig>(sc: T): T;
  subscribe<T>(
    select: ConfigContextSubscriptionSelectors<T>,
    handler: ConfigContextSubscriptionHandler<T>,
  ): void;
  finalize(): void;
}

export const isConfigContext = safety.typeGuard<ConfigContext>(
  "isConfigContext",
);

export class DefaultConfigContext implements ConfigContext {
  readonly isContext = true;
  readonly isSpecificationContext = true;
  readonly isProjectContext = true;
  readonly isConfigContext = true;
  readonly execEnvs = cm.ctxFactory.envTODO;
  readonly envVars = envVarPlaceholdersFactory.envVarPlaceholders(
    "ConfiguratorContext",
  );
  readonly configuredServices: ServiceConfig[] = [];
  readonly subscribers: [
    // deno-lint-ignore no-explicit-any
    ConfigContextSubscriptionSelectors<any>,
    // deno-lint-ignore no-explicit-any
    ConfigContextSubscriptionHandler<any>,
  ][] = [];

  constructor(
    readonly projectPath: string,
    readonly name: vm.TextValue,
  ) {}

  configured<T extends ServiceConfig>(sc: T): T {
    this.configuredServices.push(sc);
    return sc;
  }

  subscribe<T>(
    select: ConfigContextSubscriptionSelectors<T>,
    handler: ConfigContextSubscriptionHandler<T>,
  ): void {
    this.subscribers.push([select, handler]);
  }

  finalize(): void {
    for (const sc of this.configuredServices) {
      for (const subscriber of this.subscribers) {
        const [selectors, handle] = subscriber;
        if (Array.isArray(selectors)) {
          for (const select of selectors) {
            if (select(sc)) handle(this, sc);
          }
        } else {
          if (selectors(sc)) handle(this, sc);
        }
      }
    }
  }
}
