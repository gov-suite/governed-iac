import { governedIaCCore as giac } from "../deps.ts";
import { TypicalPersistenceServiceConfig } from "../typical.giac.ts";
import type { PostgreSqlConnectionConfig } from "../persistence/postgreSQL-engine.service.giac.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";

export class KeycloakPostgreSQLEngineConfig
  extends TypicalPersistenceServiceConfig {
  readonly image = "postgres:13";
  readonly ports?: giac.ServicePortsConfig;
  readonly isProxyEnabled = false;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly volumes?: giac.ServiceVolumeConfig[];

  constructor(
    ctx: giac.ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "keycloakPostgresqlEngine", ...optionals });
    this.ports = giac.portsFactory.publishSingle(
      ctx.envVars.defaultEnvVar(
        "KEYCLOAK_POSTGRESQLENGINE_PUBL_PORT",
        "Keycloak database host port",
        5433,
      ),
      5432,
    );
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          // since multiple ports are exposed, we need to be explicit
          return 8080;
        }
      })();
    this.environment.POSTGRES_USER = "${KEYCLOAK_DB_USER}";
    this.environment.POSTGRES_PASSWORD = "${KEYCLOAK_DB_PASSWORD}";
    this.environment.POSTGRES_DB = "pgdcp_keycloak";
    this.volumes = [
      {
        localVolName: "keycloakpostgresqlengine-storage",
        containerFsPath: "/var/lib/postgresql/data",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable user generated and transactional content",
          contentRecoveryType:
            giac.MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
      },
    ];
  }
}

export const keycloakPostgreSQLEngineConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ): KeycloakPostgreSQLEngineConfig {
    return ctx.configured(
      new KeycloakPostgreSQLEngineConfig(
        ctx,
        conn,
        optionals,
      ),
    );
  }
})();
