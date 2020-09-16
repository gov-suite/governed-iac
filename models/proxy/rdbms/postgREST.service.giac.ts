import {
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../../deps.ts";
import type { PostgreSqlConnectionConfig } from "../../persistence/postgreSQL-engine.service.giac.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../../typical.giac.ts";

export class PostgRestServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "postgrest/postgrest";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    readonly conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
    isGitLabServiceEnabled?: boolean,
  ) {
    super({ serviceName: "postgREST", ...optionals });
    if (isGitLabServiceEnabled) {
      this.environment.PGRST_DB_URI = "${PGREST_DB_URI}";
      this.environment.PGRST_DB_SCHEMA = "${PGREST_DB_SCHEMA:-gitlab}";
      this.environment.PGRST_DB_ANON_ROLE = "${PGREST_DB_USER:-gitlab}";
    } else {
      this.environment.PGRST_DB_URI = (ctx: cm.Context): string => {
        return vm.resolveTextValue(ctx, conn.url);
      };
      this.environment.PGRST_DB_SCHEMA = conn.schema;
      this.environment.PGRST_DB_ANON_ROLE = conn.secrets.user;
    }
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 3000;
        }
      })();
  }
}

export const postgRestConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
    isGitLabServiceEnabled?: boolean,
  ): PostgRestServiceConfig {
    return ctx.configured(
      new PostgRestServiceConfig(conn, optionals, isGitLabServiceEnabled),
    );
  }
})();
