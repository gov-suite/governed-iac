import type { governedIaCCore as giac } from "../deps.ts";
import type {
  ProxiedPort,
  ReverseProxyTarget,
  ReverseProxyTargetOptions,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class PushgatewayServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly image = "prom/pushgateway:latest";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly reverseProxyTargetOptions?: ReverseProxyTargetOptions | undefined;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ) {
    super({ serviceName: "pushGateway", ...optionals });
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 9091;
        }
      })();
    this.reverseProxyTargetOptions = proxyTargetOptions;
  }

  get proxyTargetOptions(): ReverseProxyTargetOptions {
    if (this.reverseProxyTargetOptions) {
      return this.reverseProxyTargetOptions;
    } else {
      return {
        isReverseProxyTargetOptionsEnabled: false,
        isCors: false,
        isForwardAuth: false,
        isNonAuth: false,
        isReplaceAuth: false,
        isReplaceWithShield: false,
        isShieldAuth: false,
        isNoServiceName: false,
        isCheckeMailExists: false,
        isPathPrefix: false,
        isPushGatewayAuth: false,
      };
    }
  }
}

export const pushgatewayConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ): PushgatewayServiceConfig {
    return ctx.configured(
      new PushgatewayServiceConfig(ctx, optionals, proxyTargetOptions),
    );
  }
})();
