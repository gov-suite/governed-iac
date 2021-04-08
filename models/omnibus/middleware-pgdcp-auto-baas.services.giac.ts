import { adminerConfigurator as adminer } from "../app/adminer.service.giac.ts";
import { jwtValidatorConfigurator as jwtValidator } from "../app/jwt-validator.service.giac.ts";
import { pgAdminConfigurator as pgAdmin } from "../app/pgAdmin.service.giac.ts";
import { portainerConfigurator as portainer } from "../app/portainer.service.giac.ts";
import { queryTreeConfigurator as queryTree } from "../app/queryTree.service.giac.ts";
import { swaggerConfigurator as swagger } from "../app/swagger-app.service.giac.ts";
import type { contextMgr as cm } from "../deps.ts";
import { openTelemetryConfigurator as ot } from "../observability/openTelemetry.service.giac.ts";
import { elasticSearchConfigurator as elasticSearch } from "../persistence/elasticSearch-engine.service.giac.ts";
import { postgreSqlConfigurator as pg } from "../persistence/postgreSQL-engine.service.giac.ts";
import { hasuraConfigurator as hasura } from "../proxy/rdbms/hasura.service.giac.ts";
import { postGraphileConfigurator as graphile } from "../proxy/rdbms/postGraphile.service.giac.ts";
import { postgRestConfigurator as postgREST } from "../proxy/rdbms/postgREST.service.giac.ts";
import { postgresExporterConfigurator as postgresExporter } from "../persistence/postgres-exporter.service.giac.ts";
import { graphqlExporterConfigurator as graphqlExporter } from "../app/graphql-exporter.service.giac.ts";
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
      5432,
    );
    const pgDbeCommon = this.common;
    const postgresExporterSvc = postgresExporter.configure(this, pgDbConn, {
      ...this.common,
    });
    const postGraphileSvc = graphile.configure(
      this,
      pgDbConn,
      graphile.defaultPostgraphileOptions,
      pgDbeCommon,
    );
    const postgRestSvc = postgREST.configure(this, pgDbConn, pgDbeCommon);
    const adminerApp = adminer.configure(this, pgDbeCommon);
    const jwtValidatorApp = jwtValidator.configure(
      this,
      this.common,
    );
    const graphqlExporterApp = graphqlExporter.configure(
      this,
      this.common,
    );

    rp.configure(
      this,
      rptvs,
      {
        dependsOn: [
          postgresExporterSvc,
          postGraphileSvc,
          postgRestSvc,
          adminerApp,
          jwtValidatorApp,
          graphqlExporterApp,
        ],
        ...this.common,
      },
      false,
      [jwtValidatorApp.serviceName],
    );

    this.finalize();
  }
}

export default AutoBaaS;
