import type { ConfigContext } from "./context.ts";
import type {
  artfPersist as ap,
  contextMgr as cm,
  valueMgr as vm,
} from "./deps.ts";
import type { Dockerfile } from "./docker/dockerfile.ts";
import type * as de from "./docker/engine.ts";
import type { OrchestratorErrorReporter } from "./orchestrator.ts";
import type * as ports from "./ports.ts";

export type ServiceEnvVarName = string;
export type ServiceEnvVarValue = vm.Value;

export interface ServiceBuildConfig {
  dockerFile: Dockerfile;
  context?: vm.TextValue;
  tag?: vm.TextValue;
  args?: { [argsVarName: string]: vm.TextValue };
}

export function isServiceBuildConfig(o: unknown): o is ServiceBuildConfig {
  return o && typeof o === "object" && "dockerFile" in o;
}

export const DEFAULT_COMMON_NETWORK_NAME = "appliance";

export interface ServiceNetworkConfig {
  readonly localName: vm.TextValue;
  readonly externalName: vm.TextValue;
}

export type MutableServiceVolumeContentType = vm.TextValue;

export enum MutableServiceVolumeContentRecoveryType {
  RECOVERABLE = "Recoverable", // can be recovered by other means
  RECONSTRUCTIBLE = "Reconstructible", // can be reconstructed
  IRRECOVERABLE = "Irrecoverable", // must be recoverable, data loss is an issue
  EXTERNAL = "External",
}

export interface ServiceVolumeMutable {
  readonly isServiceVolumeMutable: true;
  readonly contentType: MutableServiceVolumeContentType;
  readonly contentRecoveryType: MutableServiceVolumeContentRecoveryType;
}

export interface ServiceVolumeRetentionConfig {
  mutable?: ServiceVolumeMutable;
}

export function isServiceVolumeMutable(
  c: unknown,
): c is ServiceVolumeRetentionConfig {
  return c && typeof c === "object" && "mutable" in c;
}

export interface ServiceVolumeEngineStoreConfig
  extends ServiceVolumeRetentionConfig {
  readonly localVolName: vm.TextValue;
  readonly engineVolName?: vm.TextValue;
  readonly containerFsPath: vm.TextValue;
}

export function isServiceVolumeEngineStoreConfig(
  c: unknown,
): c is ServiceVolumeEngineStoreConfig {
  return c && typeof c === "object" &&
    ("localVolName" in c && "containerFsPath" in c);
}

export interface ServiceVolumeLocalFsPathConfig
  extends ServiceVolumeRetentionConfig {
  readonly localFsPath: vm.TextValue;
  readonly containerFsPath: vm.TextValue;
  readonly isReadOnly?: boolean;
}

export function isServiceVolumeLocalFsPathConfig(
  c: unknown,
): c is ServiceVolumeLocalFsPathConfig {
  return c && typeof c === "object" &&
    ("localFsPath" in c && "containerFsPath" in c);
}

export type ServiceVolumeConfig =
  | ServiceVolumeEngineStoreConfig
  | ServiceVolumeLocalFsPathConfig;

export interface ServiceEngineListenerConfig {
  readonly isServiceEngineListenerConfig: true;
}

export function isServiceEngineListenerConfig(
  c: unknown,
): c is ServiceEngineListenerConfig {
  return c && typeof c === "object" && "isServiceEngineListenerConfig" in c;
}

export function defaultServiceEngineListener() {
  return new (class implements ServiceEngineListenerConfig {
    readonly isServiceEngineListenerConfig = true;
  })();
}

export interface ServiceConfigOptionals {
  readonly serviceName?: vm.TextValue;
  readonly containerName?: vm.TextValue;
  readonly hostName?: vm.TextValue;
  readonly labels?: { [k: string]: string | boolean | number };
  readonly engineListener?: ServiceEngineListenerConfig;
  readonly restart?: de.ContainerRestartStrategy;
  readonly environment?: { [envVarName: string]: vm.Value };
  readonly envVarNamesPrefix?: vm.TextValue;
  readonly ports?: ports.ServicePortsConfig;
  readonly networks?: readonly ServiceNetworkConfig[];
  readonly volumes?: readonly ServiceVolumeConfig[];
  readonly command?: readonly vm.Value[];
  readonly dependsOn?: readonly ServiceConfig[];
  readonly extraHosts?: vm.TextValue[];
}

export interface ServiceConfig extends ServiceConfigOptionals {
  readonly isServiceConfig: true;

  readonly serviceName: vm.TextValue;
  readonly image: vm.TextValue | ServiceBuildConfig;

  applyLabel(key: string, value: string | boolean | number): void;
  persistRelatedArtifacts?(
    ctx: ConfigContext,
    ph: ap.PersistenceHandler,
    er?: OrchestratorErrorReporter,
  ): void;
  persistOtherRelatedArtifacts?(
    ctx: ConfigContext,
    sc: ServiceConfig,
    ph: ap.PersistenceHandler,
    er?: OrchestratorErrorReporter,
  ): void;
}

export function isServiceConfig(c: unknown): c is ServiceConfig {
  return c && typeof c === "object" && "isServiceConfig" in c;
}

export interface ServicesConfigConstructor {
  new (ctx?: cm.ProjectContext, ...args: unknown[]): ConfiguredServices;
}

export function isServicesConfigConstructor(
  f: unknown,
): f is ServicesConfigConstructor {
  return f && typeof f === "function" &&
    (!!f.prototype && !!f.prototype.constructor.name);
}

export interface ConfiguredServices {
  readonly servicesName: vm.TextValue;
  context(): ConfigContext;
  forEachService(action: (sc: ServiceConfig) => void): void;
}
