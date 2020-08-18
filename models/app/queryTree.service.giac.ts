import { governedIaCCore as giac } from "../deps.ts";
import {
  ProxiedPort,
  ReverseProxyTarget,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class QueryTreeServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly image = "d4software/querytree";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(optionals: giac.ServiceConfigOptionals) {
    super({ serviceName: "queryTree", ...optionals });
    this.proxyTargetValues =
      new (class implements ReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 80;
        }
      })();
  }
}

export const queryTreeConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): QueryTreeServiceConfig {
    return ctx.configured(new QueryTreeServiceConfig(optionals || {}));
  }
})();
