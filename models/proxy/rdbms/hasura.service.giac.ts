import {
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../../deps.ts";
import type { PostgreSqlConnectionConfig } from "../../persistence/postgreSQL-engine.service.giac.ts";
import { TypicalImmutableServiceConfig } from "../../typical.giac.ts";

export class HasuraServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "hasura/graphql-engine";
  readonly isProxyEnabled = true;
  readonly ports: giac.ServiceExposePortConfig;

  constructor(
    readonly conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "hasura", ...optionals });
    this.ports = { isServiceExposePortConfig: true, target: 8080 };
    this.environment.HASURA_GRAPHQL_DATABASE_URL = (
      ctx: cm.Context,
    ): string => {
      return vm.resolveTextValue(ctx, conn.url);
    };
    this.environment.HASURA_GRAPHQL_ENABLE_CONSOLE = true;
    this.environment.HASURA_GRAPHQL_ENABLED_LOG_TYPES =
      "startup,http-log,webhook-log,websocket-log,query-log";
  }
}

export const hasuraConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ): HasuraServiceConfig {
    return ctx.configured(new HasuraServiceConfig(conn, optionals));
  }
})();
