import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../deps.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class KeycloakConfig extends TypicalImmutableServiceConfig {
  readonly image = "jboss/keycloak:14.0.0";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "keycloak", ...optionals });
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 8080;
        }
      })();
    this.environment.DB_VENDOR = "postgres";
    this.environment.DB_ADDR =
      "${POSTGRESQLENGINE_HOST}:${POSTGRESQLENGINE_PORT}";
    this.environment.DB_DATABASE = "${POSTGRESQLENGINE_KEYCLOAK_DB}";
    this.environment.DB_USER = "${POSTGRESQLENGINE_OWNER_USER}";
    this.environment.DB_PASSWORD = "${POSTGRESQLENGINE_OWNER_PASSWORD}";
    this.environment.KEYCLOAK_USER = "${KEYCLOAK_ADMIN_USER}";
    this.environment.KEYCLOAK_PASSWORD = "${KEYCLOAK_ADMIN_PASSWORD}";
    this.environment.PROXY_ADDRESS_FORWARDING = true;
    ctx.envVars.requiredEnvVar(
      "POSTGRESQLENGINE_KEYCLOAK_DB",
      "PgDCP keycloak database",
    );
    ctx.envVars.requiredEnvVar(
      "JWKS_URI",
      "Keycloak JWKS URL",
    );
    ctx.envVars.requiredEnvVar(
      "ISSUER",
      "Keycloak Realm URL",
    );
  }
}

export const KeycloakConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): KeycloakConfig {
    return ctx.configured(new KeycloakConfig(ctx, optionals));
  }
})();
