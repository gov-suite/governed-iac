import type { governedIaCCore as giac } from "../deps.ts";
import type { ReverseProxyTarget } from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class PgAdminServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly image = "dpage/pgadmin4";
  readonly isProxyEnabled = true;

  constructor(optionals: giac.ServiceConfigOptionals) {
    super({ serviceName: "pgAdmin", ...optionals });
    this.environment.PGADMIN_DEFAULT_EMAIL = "admin@docker.localhost";
    this.environment.PGADMIN_DEFAULT_PASSWORD = "devl";
  }
}

export const pgAdminConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): PgAdminServiceConfig {
    return ctx.configured(new PgAdminServiceConfig(optionals || {}));
  }
})();
