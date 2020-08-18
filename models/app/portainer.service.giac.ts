import { governedIaCCore as giac, valueMgr as vm } from "../deps.ts";
import {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class PortainerConfig extends TypicalImmutableServiceConfig {
  readonly image = "portainer/portainer";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly command: readonly vm.Value[];
  readonly ports: giac.ServicePortsConfig;
  readonly engineListener: giac.ServiceEngineListenerConfig;
  readonly volumes?: giac.ServiceVolumeConfig[];

  constructor(optionals?: giac.ServiceConfigOptionals) {
    super({ serviceName: "portainer", ...optionals });
    this.engineListener = giac.defaultServiceEngineListener();
    this.command = ["-H", "unix:///var/run/docker.sock"];
    this.ports = [
      giac.portsFactory.publishSingle(9000),
      giac.portsFactory.publishSingle(8000),
    ];
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
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
            giac.MutableServiceVolumeContentRecoveryType.RECONSTRUCTIBLE,
        },
      },
    ];
  }
}

export const portainerConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): PortainerConfig {
    return ctx.configured(new PortainerConfig(optionals));
  }
})();
