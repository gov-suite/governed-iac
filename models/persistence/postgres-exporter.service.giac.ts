import {
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalPersistenceServiceConfig } from "../typical.giac.ts";
import type { PostgreSqlConnectionConfig } from "../persistence/postgreSQL-engine.service.giac.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";

export class PostgresExporterServiceConfig
  extends TypicalPersistenceServiceConfig {
  readonly image = "quay.io/prometheuscommunity/postgres-exporter";
  readonly ports?: giac.ServicePortsConfig;
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    ctx: giac.ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
    isOwnerPostgres?: boolean,
  ) {
    super({ serviceName: "postgres-exporter", ...optionals });
    this.ports = [
      giac.portsFactory.publishSingle(9187, 9187),
    ];
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          // since multiple ports are exposed, we need to be explicit
          return 9187;
        }
      })();
    if (isOwnerPostgres) {
      this.environment.DATA_SOURCE_NAME =
        "postgres://${POSTGRESQLENGINE_OWNER_USER}:${POSTGRESQLENGINE_OWNER_PASSWORD}@${POSTGRESQLENGINE_HOST}:${POSTGRESQLENGINE_PORT}/${POSTGRESQLENGINE_DB}?sslmode=disable";
    } else {
      this.environment.DATA_SOURCE_NAME = (
        ctx: cm.Context,
      ): string => {
        return vm.resolveTextValue(ctx, conn.url) + "?sslmode=disable";
      };
    }
  }
}

export const postgresExporterConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
    isOwnerPostgres?: boolean,
  ): PostgresExporterServiceConfig {
    return ctx.configured(
      new PostgresExporterServiceConfig(
        ctx,
        conn,
        optionals,
        isOwnerPostgres,
      ),
    );
  }
})();
