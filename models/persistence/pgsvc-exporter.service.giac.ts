import { governedIaCCore as giac } from "../deps.ts";
import { TypicalPersistenceServiceConfig } from "../typical.giac.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";

export class PgsvcExporterServiceConfig
  extends TypicalPersistenceServiceConfig {
  readonly image = "weaponry/pgscv:latest";
  readonly ports?: giac.ServicePortsConfig;
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "pgsvc-exporter", ...optionals });
    this.ports = [
      giac.portsFactory.publishSingle(9890, 9890),
    ];
    this.environment.PGSCV_LISTEN_ADDRESS = "0.0.0.0:9890";
    this.environment.PGSCV_DISABLE_COLLECTORS = "system";
    this.environment.DATABASE_DSN =
      "postgres://${POSTGRESQLENGINE_OWNER_USER}:${POSTGRESQLENGINE_OWNER_PASSWORD}@${POSTGRESQLENGINE_HOST}:5432/${POSTGRESQLENGINE_DB}";
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 9890;
        }
      })();
  }
}

export const pgsvcExporterConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): PgsvcExporterServiceConfig {
    return ctx.configured(
      new PgsvcExporterServiceConfig(ctx, optionals),
    );
  }
})();
