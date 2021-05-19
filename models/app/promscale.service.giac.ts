import { governedIaCCore as giac } from "../deps.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class PromscaleServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "timescale/promscale:latest";
  readonly isProxyEnabled = false;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "promscale", ...optionals });
    this.environment.PROMSCALE_DB_CONNECT_RETRIES = "10";
    this.environment.PROMSCALE_WEB_TELEMETRY_PATH = "/metrics-text";
    this.environment.PROMSCALE_DB_URI =
      "postgres://${POSTGRESQLENGINE_OWNER_USER}:${POSTGRESQLENGINE_OWNER_PASSWORD}@${POSTGRESQLENGINE_HOST}:${POSTGRESQLENGINE_PORT}/${POSTGRESQLENGINE_PROMSCALE_DB}?sslmode=disable";
  }
}

export const promscaleConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): PromscaleServiceConfig {
    return ctx.configured(new PromscaleServiceConfig(ctx, optionals));
  }
})();
