import { governedIaCCore as giac } from "../deps.ts";
import {
  ProxiedPort,
  ReverseProxyTarget,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.iacs.ts";

export class DatabaseAdminerServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly image = "adminer";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(optionals: giac.ServiceConfigOptionals) {
    super({ serviceName: "adminer-app", ...optionals });
    this.environment.ADMINER_DESIGN = "pepa-linha";
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 8080;
        }
      })();
  }
}

export const adminerConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): DatabaseAdminerServiceConfig {
    return ctx.configured(new DatabaseAdminerServiceConfig(optionals || {}));
  }
})();
