import {
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../deps.ts";
import type { PostgreSqlConnectionConfig } from "../persistence/postgreSQL-engine.service.giac.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class PromscaleServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "timescale/promscale:latest";
  readonly isProxyEnabled = false;

  constructor(
    ctx: giac.ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "promscale", ...optionals });
    this.environment.PROMSCALE_DB_CONNECT_RETRIES = "10";
    this.environment.PROMSCALE_WEB_TELEMETRY_PATH = "/metrics-text";
    this.environment.PROMSCALE_DB_URI = (
      ctx: cm.Context,
    ): string => {
      return vm.resolveTextValue(ctx, conn.url) + "?sslmode=disable";
    };
  }
}

export const promscaleConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ): PromscaleServiceConfig {
    return ctx.configured(new PromscaleServiceConfig(ctx, conn, optionals));
  }
})();
