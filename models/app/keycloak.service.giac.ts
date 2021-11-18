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
    this.environment.DB_ADDR = "${POSTGRESQLENGINE_HOST}:5432";
    this.environment.DB_DATABASE = "pgdcp_keycloak";
    this.environment.DB_USER = "${POSTGRESQLENGINE_OWNER_USER}";
    this.environment.DB_PASSWORD = "${POSTGRESQLENGINE_OWNER_PASSWORD}";
    this.environment.KEYCLOAK_USER = "${KEYCLOAK_ADMIN_USER}";
    this.environment.KEYCLOAK_PASSWORD = "${KEYCLOAK_ADMIN_PASSWORD}";
    this.environment.KEYCLOAK_CLIENT_ID = "${KEYCLOAK_CLIENT_ID}";
    this.environment.JWKS_URI =
      "${KEYCLOAK_SERVER_URL}/auth/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs";
    this.environment.ISSUER =
      "${KEYCLOAK_SERVER_URL}/auth/realms/${KEYCLOAK_REALM}";
    this.environment.PROXY_ADDRESS_FORWARDING = true;
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
