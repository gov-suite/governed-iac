import { adminerConfigurator as adminer } from "../app/adminer.service.giac.ts";
import type { contextMgr as cm } from "../deps.ts";
import { postgreSqlConfigurator as pg } from "../persistence/postgreSQL-engine.service.giac.ts";
import { postGraphileAnonymousConfigurator as postGraphileAnonymous } from "../proxy/rdbms/postGraphileAnonymousPgdcp.service.giac.ts";
import { postGraphileConfigurator as graphile } from "../proxy/rdbms/postGraphilePgdcp.service.giac.ts";
import { postgRestAnonymousPgdcpConfigurator as postgRESTAnonymousPgdcp } from "../proxy/rdbms/postgRESTAnonymousPgdcp.service.giac.ts";
import { postgRestPgdcpConfigurator as postgRESTPgdcp } from "../proxy/rdbms/postgRESTPgdcp.service.giac.ts";
import { postgresExporterConfigurator as postgresExporter } from "../persistence/postgres-exporter.service.giac.ts";
import { graphqlExporterConfigurator as graphqlExporter } from "../app/graphql-exporter.service.giac.ts";
import { emailValidatorConfigurator as emailValidatorConfigurator } from "../app/email-validator.service.giac.ts";
import { swaggerConfigurator as swagger } from "../app/swagger-app-pgdcp.service.giac.ts";
import { prometheusConfigurator as prometheus } from "../app/prometheus.service.giac.ts";
import { promscaleConfigurator as promscale } from "../app/promscale.service.giac.ts";
import { githubExporterConfigurator as githubExporter } from "../persistence/github-exporter.service.giac.ts";
import { pgsvcExporterConfigurator as pgsvcExporter } from "../persistence/pgsvc-exporter.service.giac.ts";
import { keycloakPostgreSQLEngineConfigurator as keycloakPostgreSQLEngine } from "../persistence/keycloak-postgreSQL-engine.service.giac.ts";
import { KeycloakConfigurator as keycloak } from "../app/keycloak.service.giac.ts";
import { reverseProxyConfigurator as rp } from "../proxy/reverse-proxy.ts";
import {
  TypicalComposeConfig,
  TypicalReverseProxyTargetValuesSupplier,
} from "../typical.giac.ts";

export class AutoBaaS extends TypicalComposeConfig {
  readonly servicesName = "middleware-rdbms-auto-baas";

  constructor(ctx: cm.ProjectContext) {
    super(ctx);

    const rptvs = new TypicalReverseProxyTargetValuesSupplier(this);

    const pgDbConn = pg.configureConn(
      "${POSTGRESQLENGINE_DB}",
      {
        user: "${POSTGRESQLENGINE_USER}",
        password: "${POSTGRESQLENGINE_PASSWORD}",
      },
      "public",
      "${POSTGRESQLENGINE_HOST}",
      "${POSTGRESQLENGINE_PORT}",
    );
    const pgDbeCommon = this.common;
    const postgresExporterSvc = postgresExporter.configure(this, pgDbConn, {
      ...this.common,
    }, true);
    const postGraphileAnonymousSvc = postGraphileAnonymous.configure(
      this,
      pgDbConn,
      postGraphileAnonymous.defaultPostgraphileOptions,
      pgDbeCommon,
      {
        isReverseProxyTargetOptionsEnabled: true,
        isNoServiceName: true,
      },
    );
    const postGraphileSvc = graphile.configure(
      this,
      pgDbConn,
      graphile.defaultPostgraphileOptions,
      pgDbeCommon,
      {
        isReverseProxyTargetOptionsEnabled: true,
        isShieldAuth: true,
      },
    );
    const postgRestAnonymousPgdcpSvc = postgRESTAnonymousPgdcp.configure(
      this,
      pgDbConn,
      pgDbeCommon,
      {
        isReverseProxyTargetOptionsEnabled: true,
        isReplaceAuth: true,
      },
    );
    const postgRESTPgdcpSvc = postgRESTPgdcp.configure(
      this,
      pgDbConn,
      pgDbeCommon,
      {
        isReverseProxyTargetOptionsEnabled: true,
        isReplaceAuth: true,
        isReplaceWithShield: true,
      },
    );
    const adminerApp = adminer.configure(this, pgDbeCommon);
    const graphqlExporterApp = graphqlExporter.configure(
      this,
      this.common,
    );
    const emailValidatorApp = emailValidatorConfigurator.configure(
      this,
      this.common,
      {
        isReverseProxyTargetOptionsEnabled: true,
        isCheckeMailExists: true,
      },
    );
    const swaggerApp = swagger.configure(
      this,
      false,
      {
        dependsOn: [postgRestAnonymousPgdcpSvc, postgRESTPgdcpSvc],
        ...this.common,
      },
      {
        isReverseProxyTargetOptionsEnabled: true,
        isPathPrefix: true,
      },
    );
    const prometheusApp = prometheus.configure(
      this,
      this.common,
    );
    const promscaleApp = promscale.configure(
      this,
      { dependsOn: [prometheusApp], ...this.common },
    );
    const githubExporterApp = githubExporter.configure(
      this,
      pgDbConn,
      this.common,
    );
    const pgsvcExporterApp = pgsvcExporter.configure(
      this,
      this.common,
    );
    const keycloakPostgreSQLEngineSvc = keycloakPostgreSQLEngine.configure(
      this,
      pgDbConn,
      this.common,
    );
    const keycloakApp = keycloak.configure(
      this,
      {
        dependsOn: [keycloakPostgreSQLEngineSvc],
        ...this.common,
      },
    );

    rp.configure(
      this,
      rptvs,
      {
        dependsOn: [
          postgresExporterSvc,
          postGraphileAnonymousSvc,
          postGraphileSvc,
          postgRestAnonymousPgdcpSvc,
          postgRESTPgdcpSvc,
          adminerApp,
          graphqlExporterApp,
          emailValidatorApp,
          swaggerApp,
          pgsvcExporterApp,
          keycloakPostgreSQLEngineSvc,
          keycloakApp,
        ],
        ...this.common,
      },
      false,
    );

    this.finalize();
  }
}

export default AutoBaaS;
