import { ConfigContext } from "../../context.ts";
import { valueMgr as vm } from "../../deps.ts";
import { portsFactory, ServicePortsConfig } from "../../ports.ts";
import {
  defaultServiceEngineListener,
  MutableServiceVolumeContentRecoveryType,
  ServiceConfigOptionals,
  ServiceEngineListenerConfig,
  ServiceVolumeConfig,
} from "../../service.ts";
import {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.iacs.ts";

export class PortainerConfig extends TypicalImmutableServiceConfig {
  readonly image = "portainer/portainer";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly command: readonly vm.Value[];
  readonly ports: ServicePortsConfig;
  readonly engineListener: ServiceEngineListenerConfig;
  readonly volumes?: ServiceVolumeConfig[];

  constructor(optionals?: ServiceConfigOptionals) {
    super({ serviceName: "portainer", ...optionals });
    this.engineListener = defaultServiceEngineListener();
    this.command = ["-H", "unix:///var/run/docker.sock"];
    this.ports = [
      portsFactory.publishSingle(9000),
      portsFactory.publishSingle(8000),
    ];
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: ConfigContext): ProxiedPort {
          // since multiple ports are exposed, we need to be explicit
          return 9000;
        }
      })();
    this.volumes = [
      {
        localVolName: this.serviceName + "-storage",
        containerFsPath: "/data",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Recoverable container configuration",
          contentRecoveryType:
            MutableServiceVolumeContentRecoveryType.RECONSTRUCTIBLE,
        },
      },
    ];
  }
}

export const portainerConfigurator = new (class {
  configure(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ): PortainerConfig {
    return ctx.configured(new PortainerConfig(optionals));
  }
})();
