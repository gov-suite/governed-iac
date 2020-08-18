import { ConfigContext, DefaultConfigContext } from "../context.ts";
import {
  contextMgr as cm,
  valueMgr as vm,
} from "../deps.ts";
import { ContainerRestartStrategy } from "../docker/engine.ts";
import { EnvVarPlaceholder } from "../env.ts";
import {
  ConfiguredServices,
  ServiceBuildConfig,
  ServiceConfig,
  ServiceConfigOptionals,
  ServiceNetworkConfig,
} from "../service.ts";
import {
  ProxiedPort,
  ReverseProxyTarget,
  ReverseProxyTargetValuesSupplier,
} from "./proxy/reverse-proxy.ts";

export abstract class TypicalImmutableServiceConfig
  implements ServiceConfig, ReverseProxyTarget {
  private static svcConstructIndex = 0;

  readonly serviceName: vm.TextValue;
  readonly envVarNamesPrefix: vm.TextValue;
  readonly isServiceConfig = true;
  readonly isReverseProxyTarget = true;
  readonly containerName: vm.TextValue;
  readonly labels: { [k: string]: any };
  readonly environment: { [envVarName: string]: vm.Value };
  readonly restart: ContainerRestartStrategy;
  readonly networks?: readonly ServiceNetworkConfig[];
  readonly dependsOn?: readonly ServiceConfig[];

  constructor({
    serviceName,
    containerName,
    networks,
    labels,
    environment,
    dependsOn,
    envVarNamesPrefix,
    restart,
  }: ServiceConfigOptionals) {
    this.serviceName = serviceName ??
      "service" + TypicalImmutableServiceConfig.svcConstructIndex;
    this.envVarNamesPrefix = envVarNamesPrefix ??
      (typeof this.serviceName === "string"
        ? this.serviceName.toLocaleUpperCase()
        : (ctx: cm.Context): string => {
          return vm.resolveTextValue(ctx, this.serviceName);
        });
    this.restart = restart ? restart : ContainerRestartStrategy.Always;
    this.labels = labels ? labels : {};
    this.environment = environment ? environment : {};
    this.networks = networks;
    this.dependsOn = dependsOn;
    this.containerName = containerName
      ? containerName
      : (ctx: cm.Context): string => {
        const cc = ctx as ConfigContext;
        return (
          vm.resolveTextValue(cc, cc.name) +
          "_" +
          vm.resolveTextValue(ctx, this.serviceName)
        );
      };
    TypicalImmutableServiceConfig.svcConstructIndex++;
  }

  abstract get image(): vm.TextValue | ServiceBuildConfig;
  abstract get isProxyEnabled(): boolean;

  get proxyTargetConfig(): ServiceConfig {
    return this;
  }

  applyLabel(key: string, value: any): void {
    this.labels[key] = value;
  }
}

export abstract class TypicalMutableServiceConfig
  extends TypicalImmutableServiceConfig {}

export abstract class TypicalPersistenceServiceConfig
  extends TypicalMutableServiceConfig {}

export abstract class TypicalComposeConfig extends DefaultConfigContext
  implements ConfiguredServices {
  readonly common: ServiceConfigOptionals;

  constructor(
    ctx: cm.ProjectContext,
    name?: vm.TextValue,
    common?: ServiceConfigOptionals,
  ) {
    super(
      ctx.projectPath,
      name ? name : (ctx: cm.Context): string => {
        return vm.resolveTextValue(ctx, this.servicesName);
      },
    );
    this.common = common ? common : {
      networks: [
        {
          localName: "network",
          externalName: (ctx: cm.Context): string => {
            return vm.resolveTextValue(ctx, this.servicesName);
          },
        },
      ],
    };
  }

  abstract get servicesName(): vm.TextValue;

  context(): ConfigContext {
    return this;
  }

  forEachService(action: (sc: ServiceConfig) => void): void {
    for (const sc of this.configuredServices) {
      action(sc);
    }
  }
}

export class TypicalReverseProxyTargetValuesSupplier
  implements ReverseProxyTargetValuesSupplier {
  readonly isReverseProxyTargetValuesSupplier = true;
  readonly epExecEnvName: EnvVarPlaceholder;
  readonly epBoundaryName: EnvVarPlaceholder;
  readonly epFqdnSuffix: EnvVarPlaceholder;

  constructor(readonly ctx: ConfigContext) {
    this.epExecEnvName = ctx.envVars.defaultEnvVar(
      "EP_EXECENV",
      "Endpoints' execution environment name like sandbox, devl, test, demo, or prod",
      "sandbox",
    );
    this.epBoundaryName = ctx.envVars.defaultEnvVar(
      "EP_BOUNDARY",
      "Endpoints' name of application or service",
      "appx",
    );
    this.epFqdnSuffix = ctx.envVars.defaultEnvVar(
      "EP_FQDNSUFFIX",
      "Endpoints' Fully qualified domain name suffix",
      "docker.localhost",
    );
  }

  proxiedHostName(ctx: ConfigContext, sc: ServiceConfig): string {
    return (
      this.epExecEnvName.prepare(ctx) +
      "." +
      sc.serviceName +
      "." +
      this.epBoundaryName.prepare(ctx) +
      "." +
      this.epFqdnSuffix.prepare(ctx)
    );
  }

  proxiedPort(ctx: ConfigContext, sc: ServiceConfig): ProxiedPort {
    return undefined;
  }
}
