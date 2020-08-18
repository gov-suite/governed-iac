import { ConfigContext } from "../../context.ts";
import { ServiceConfigOptionals } from "../../service.ts";
import { ReverseProxyTarget } from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.iacs.ts";

export class PgAdminServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly image = "dpage/pgadmin4";
  readonly isProxyEnabled = true;

  constructor(optionals: ServiceConfigOptionals) {
    super({ serviceName: "pgAdmin", ...optionals });
    this.environment.PGADMIN_DEFAULT_EMAIL = "admin@docker.localhost";
    this.environment.PGADMIN_DEFAULT_PASSWORD = "devl";
  }
}

export const pgAdminConfigurator = new (class {
  configure(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ): PgAdminServiceConfig {
    return ctx.configured(new PgAdminServiceConfig(optionals || {}));
  }
})();
