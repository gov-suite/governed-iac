import {
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "./deps.ts";
import {
  ProxiedPort,
  ReverseProxyTarget,
  ReverseProxyTargetValuesSupplier,
} from "./proxy/reverse-proxy.ts";

export abstract class TypicalImmutableServiceConfig
  implements giac.ServiceConfig, ReverseProxyTarget {
  private static svcConstructIndex = 0;

  readonly serviceName: vm.TextValue;
  readonly envVarNamesPrefix: vm.TextValue;
  readonly isServiceConfig = true;
  readonly isReverseProxyTarget = true;
  readonly containerName: vm.TextValue;
  readonly labels: { [k: string]: any };
  readonly environment: { [envVarName: string]: vm.Value };
  readonly restart: giac.dockerTr.ContainerRestartStrategy;
  readonly networks?: readonly giac.ServiceNetworkConfig[];
  readonly dependsOn?: readonly giac.ServiceConfig[];

  constructor({
    serviceName,
    containerName,
    networks,
    labels,
    environment,
    dependsOn,
    envVarNamesPrefix,
    restart,
  }: giac.ServiceConfigOptionals) {
    this.serviceName = serviceName ??
      "service" + TypicalImmutableServiceConfig.svcConstructIndex;
    this.envVarNamesPrefix = envVarNamesPrefix ??
      (typeof this.serviceName === "string"
        ? this.serviceName.toLocaleUpperCase()
        : (ctx: cm.Context): string => {
          return vm.resolveTextValue(ctx, this.serviceName);
        });
    this.restart = restart
      ? restart
      : giac.dockerTr.ContainerRestartStrategy.Always;
    this.labels = labels ? labels : {};
    this.environment = environment ? environment : {};
    this.networks = networks;
    this.dependsOn = dependsOn;
    this.containerName = containerName
      ? containerName
      : (ctx: cm.Context): string => {
        const cc = ctx as giac.ConfigContext;
        return (
          vm.resolveTextValue(cc, cc.name) +
          "_" +
          vm.resolveTextValue(ctx, this.serviceName)
        );
      };
    TypicalImmutableServiceConfig.svcConstructIndex++;
  }

  abstract get image(): vm.TextValue | giac.ServiceBuildConfig;
  abstract get isProxyEnabled(): boolean;

  get proxyTargetConfig(): giac.ServiceConfig {
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

export abstract class TypicalComposeConfig extends giac.DefaultConfigContext
  implements giac.ConfiguredServices {
  readonly common: giac.ServiceConfigOptionals;

  constructor(
    ctx: cm.ProjectContext,
    name?: vm.TextValue,
    common?: giac.ServiceConfigOptionals,
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

  context(): giac.ConfigContext {
    return this;
  }

  forEachService(action: (sc: giac.ServiceConfig) => void): void {
    for (const sc of this.configuredServices) {
      action(sc);
    }
  }
}

export class TypicalReverseProxyTargetValuesSupplier
  implements ReverseProxyTargetValuesSupplier {
  readonly isReverseProxyTargetValuesSupplier = true;
  readonly epExecEnvName: giac.EnvVarPlaceholder;
  readonly epBoundaryName: giac.EnvVarPlaceholder;
  readonly epFqdnSuffix: giac.EnvVarPlaceholder;

  constructor(readonly ctx: giac.ConfigContext) {
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

  proxiedHostName(ctx: giac.ConfigContext, sc: giac.ServiceConfig): string {
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

  proxiedPort(ctx: giac.ConfigContext, sc: giac.ServiceConfig): ProxiedPort {
    return undefined;
  }
}
