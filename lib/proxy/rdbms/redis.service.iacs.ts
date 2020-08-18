import { ConfigContext } from "../../../context.ts";
import {
  ServiceConfigOptionals,
  ServiceVolumeConfig,
  MutableServiceVolumeContentRecoveryType,
} from "../../../service.ts";
import { TypicalImmutableServiceConfig } from "../../typical.iacs.ts";

export class RedisServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "redis:alpine";
  readonly isProxyEnabled = false;
  readonly volumes?: ServiceVolumeConfig[];

  constructor(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
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
            MutableServiceVolumeContentRecoveryType.RECONSTRUCTIBLE,
        },
      },
    ];
  }
}

export const redisConfigurator = new (class {
  configure(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ): RedisServiceConfig {
    return ctx.configured(new RedisServiceConfig(ctx, optionals));
  }
})();
