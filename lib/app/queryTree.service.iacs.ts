import { ConfigContext } from "../../context.ts";
import { ServiceConfigOptionals } from "../../service.ts";
import {
  ReverseProxyTarget,
  ReverseProxyTargetValuesSupplier,
  ProxiedPort,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.iacs.ts";

export class QueryTreeServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly image = "d4software/querytree";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(optionals: ServiceConfigOptionals) {
    super({ serviceName: "queryTree", ...optionals });
    this.proxyTargetValues =
      new (class implements ReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: ConfigContext): ProxiedPort {
          return 80;
        }
      })();
  }
}

export const queryTreeConfigurator = new (class {
  configure(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ): QueryTreeServiceConfig {
    return ctx.configured(new QueryTreeServiceConfig(optionals || {}));
  }
})();
