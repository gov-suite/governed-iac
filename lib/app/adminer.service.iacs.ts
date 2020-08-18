import { ConfigContext } from "../../context.ts";
import { ServiceConfigOptionals } from "../../service.ts";
import {
  ReverseProxyTarget,
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.iacs.ts";

export class DatabaseAdminerServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly image = "adminer";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(optionals: ServiceConfigOptionals) {
    super({ serviceName: "adminer-app", ...optionals });
    this.environment.ADMINER_DESIGN = "pepa-linha";
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: ConfigContext): ProxiedPort {
          return 8080;
        }
      })();
  }
}

export const adminerConfigurator = new (class {
  configure(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ): DatabaseAdminerServiceConfig {
    return ctx.configured(new DatabaseAdminerServiceConfig(optionals || {}));
  }
})();
