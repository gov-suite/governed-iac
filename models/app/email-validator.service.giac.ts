import type { governedIaCCore as giac } from "../deps.ts";
import type {
  ProxiedPort,
  ReverseProxyTarget,
  ReverseProxyTargetOptions,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class emailValidatorServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly image = "reacherhq/check-if-email-exists:latest";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly reverseProxyTargetOptions?: ReverseProxyTargetOptions | undefined;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ) {
    super({ serviceName: "email-validator", ...optionals });
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 3000;
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
      };
    }
  }
}

export const emailValidatorConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ): emailValidatorServiceConfig {
    return ctx.configured(
      new emailValidatorServiceConfig(ctx, optionals, proxyTargetOptions),
    );
  }
})();
