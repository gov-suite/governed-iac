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

export class UnleashConfig extends TypicalImmutableServiceConfig {
  readonly image = "unleashorg/unleash-server:4.2.2-node14-alpine";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "unleash", ...optionals });
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 4242;
        }
      })();
    this.environment.DATABASE_URL =
      "postgres://${POSTGRESQLENGINE_OWNER_USER}:${POSTGRESQLENGINE_OWNER_PASSWORD}@${POSTGRESQLENGINE_HOST}:${POSTGRESQLENGINE_PORT}/${POSTGRESQLENGINE_UNLEASH_DB}?sslmode=disable";
    this.environment.UNLEASH_URL =
      "http://${EP_EXECENV:-sandbox}.unleash.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}";
    ctx.envVars.requiredEnvVar(
      "POSTGRESQLENGINE_UNLEASH_DB",
      "PgDCP unleash database",
    );
  }
}

export const unleashConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): UnleashConfig {
    return ctx.configured(
      new UnleashConfig(ctx, optionals),
    );
  }
})();
