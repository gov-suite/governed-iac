import {
  contextMgr as cm,
  textInflect as infl,
  valueMgr as vm,
} from "./deps.ts";
import { ServiceConfig } from "./service.ts";

export class EnvVarPlaceholder implements vm.FutureInterpolatableValue {
  readonly isFutureInterpolatableValue = true;
  readonly isEnvVarPlaceholder = true;

  constructor(
    readonly name: infl.InflectableValue,
    readonly purpose: vm.TextValue,
    readonly defaultValue?: vm.Value,
    readonly scope?: ServiceConfig,
  ) {}

  qualifiedName(ctx: cm.Context, ...args: any): string {
    const nameOnly = infl.toEnvVarCase(this.name);
    return this.scope
      ? vm
        .resolveTextValue(ctx, this.scope.serviceName)
        .toLocaleUpperCase()
        .replace("-", "_") +
        "_" +
        nameOnly
      : nameOnly;
  }

  prepare(ctx: cm.Context, ...args: any): string {
    return this.defaultValue
      ? "${" +
        this.qualifiedName(ctx, ...args) +
        ":-" +
        this.defaultValue.toString() +
        "}"
      : "${" + infl.toEnvVarCase(this.name) + "}";
  }
}

export interface EnvVarPlaceholderListener {
  (evp: EnvVarPlaceholder, ...args: any): void;
}

export class EnvVarPlaceholders {
  readonly defined: { [name: string]: EnvVarPlaceholder } = {};
  readonly required: EnvVarPlaceholder[] = [];
  readonly defaulted: EnvVarPlaceholder[] = [];

  constructor(readonly listener?: EnvVarPlaceholderListener) {}

  public defaultEnvVar(
    name: string,
    purpose: vm.TextValue,
    defaultValue?: vm.Value,
    scope?: ServiceConfig,
    ...args: any
  ): EnvVarPlaceholder {
    const dictKey = scope ? scope.serviceName.toString() + name : name;
    const defined = this.defined[dictKey];
    if (defined) return defined;

    const evp = new EnvVarPlaceholder(
      vm.name(name),
      purpose,
      defaultValue,
      scope,
    );
    if (this.listener) this.listener(evp, ...args);
    this.defaulted.push(evp);
    this.defined[dictKey] = evp;
    return evp;
  }

  public requiredEnvVar(
    name: string,
    purpose: vm.TextValue,
    scope?: ServiceConfig,
    ...args: any
  ) {
    const dictKey = scope ? scope.serviceName.toString() + name : name;
    const defined = this.defined[dictKey];
    if (defined) return defined;

    const evp = new EnvVarPlaceholder(vm.name(name), purpose, scope);
    if (this.listener) this.listener(evp, ...args);
    this.required.push(evp);
    this.defined[dictKey] = evp;
    return evp;
  }
}

export const envVarPlaceholdersFactory = new (class {
  readonly placeholdersByName = new Map<string, EnvVarPlaceholders>();

  constructor() {}

  public envVarPlaceholders(
    name: string,
    listener?: EnvVarPlaceholderListener,
  ) {
    const evphs = new EnvVarPlaceholders(listener);
    this.placeholdersByName.set(name, evphs);
    return evphs;
  }
})();
