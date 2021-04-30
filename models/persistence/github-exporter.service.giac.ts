import {
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalPersistenceServiceConfig } from "../typical.giac.ts";
import type { PostgreSqlConnectionConfig } from "../persistence/postgreSQL-engine.service.giac.ts";

export class GithubExporterServiceConfig
  extends TypicalPersistenceServiceConfig {
  readonly image = "infinityworks/github-exporter:latest";
  readonly ports?: giac.ServicePortsConfig;
  readonly isProxyEnabled = false;

  constructor(
    ctx: giac.ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "github-exporter", ...optionals });
    this.ports = [
      giac.portsFactory.publishSingle(9171, 9171),
    ];
    this.environment.REPOS = "${GITHUB_EXPORTER_REPOS}";
    this.environment.GITHUB_TOKEN = "${GITHUB_EXPORTER_TOKEN}";
  }
}

export const githubExporterConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ): GithubExporterServiceConfig {
    return ctx.configured(
      new GithubExporterServiceConfig(ctx, conn, optionals),
    );
  }
})();
