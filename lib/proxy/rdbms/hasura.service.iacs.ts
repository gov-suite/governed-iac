import { ConfigContext } from "../../../context.ts";
import {
  contextMgr as cm,
  valueMgr as vm,
} from "../../../deps.ts";
import { ServiceExposePortConfig } from "../../../ports.ts";
import { ServiceConfigOptionals } from "../../../service.ts";
import { PostgreSqlConnectionConfig } from "../../persistence/postgreSQL-engine.service.iacs.ts";
import { TypicalImmutableServiceConfig } from "../../typical.iacs.ts";

export class HasuraServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "hasura/graphql-engine";
  readonly isProxyEnabled = true;
  readonly ports: ServiceExposePortConfig;

  constructor(
    readonly conn: PostgreSqlConnectionConfig,
    optionals?: ServiceConfigOptionals,
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
    ctx: ConfigContext,
    conn: PostgreSqlConnectionConfig,
    optionals?: ServiceConfigOptionals,
  ): HasuraServiceConfig {
    return ctx.configured(new HasuraServiceConfig(conn, optionals));
  }
})();
