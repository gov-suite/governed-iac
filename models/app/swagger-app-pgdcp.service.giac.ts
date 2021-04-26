import { governedIaCCore as giac } from "../deps.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetOptions,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class SwaggerAppConfig extends TypicalImmutableServiceConfig {
  readonly image = "swaggerapi/swagger-ui";
  readonly isProxyEnabled = true;
  readonly ports: giac.ServicePortsConfig;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly reverseProxyTargetOptions?: ReverseProxyTargetOptions | undefined;

  constructor(
    readonly isSecure: boolean,
    optionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ) {
    super({ serviceName: "swagger-ui", ...optionals });
    this.ports = [
      giac.portsFactory.publishSingle(8080),
    ];
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          // since both ports 80 and 8080 are exposed, we need to be explicit
          return 8080;
        }
      })();
    if (isSecure) {
      this.environment.API_URL =
        "https://${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}/api";
    } else {
      this.environment.API_URL =
        "http://${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}/api";
    }
    this.environment.BASE_URL = "/doc/open-api";
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
      };
    }
  }
}

export const swaggerConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    isSecure: boolean,
    optionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ): SwaggerAppConfig {
    return ctx.configured(
      new SwaggerAppConfig(isSecure, optionals, proxyTargetOptions),
    );
  }
})();
