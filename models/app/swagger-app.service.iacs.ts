import { governedIaCCore as giac } from "../deps.ts";
import {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.iacs.ts";

export class SwaggerAppConfig extends TypicalImmutableServiceConfig {
  readonly image = "swaggerapi/swagger-ui";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    readonly apiURL: string,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "swagger-ui", ...optionals });
    this.environment.API_URL = apiURL;

    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          // since both ports 80 and 8080 are exposed, we need to be explicit
          return 8080;
        }
      })();
  }
}

export const swaggerConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    apiURL: string,
    optionals?: giac.ServiceConfigOptionals,
  ): SwaggerAppConfig {
    return ctx.configured(new SwaggerAppConfig(apiURL, optionals));
  }
})();
