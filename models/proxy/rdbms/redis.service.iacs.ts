import { governedIaCCore as giac } from "../../deps.ts";
import { TypicalImmutableServiceConfig } from "../../typical.iacs.ts";

export class RedisServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "redis:alpine";
  readonly isProxyEnabled = false;
  readonly volumes?: giac.ServiceVolumeConfig[];

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "redis", ...optionals });
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

export const redisConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): RedisServiceConfig {
    return ctx.configured(new RedisServiceConfig(ctx, optionals));
  }
})();
