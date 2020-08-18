import { adminerConfigurator as adminer } from "../app/adminer.service.iacs.ts";
import { jwtValidatorConfigurator as jwtValidator } from "../app/jwt-validator.service.iacs.ts";
import { pgAdminConfigurator as pgAdmin } from "../app/pgAdmin.service.iacs.ts";
import { portainerConfigurator as portainer } from "../app/portainer.service.iacs.ts";
import { queryTreeConfigurator as queryTree } from "../app/queryTree.service.iacs.ts";
import { swaggerConfigurator as swagger } from "../app/swagger-app.service.iacs.ts";
import { contextMgr as cm } from "../deps.ts";
import { openTelemetryConfigurator as ot } from "../observability/openTelemetry.service.iacs.ts";
import { elasticSearchConfigurator as elasticSearch } from "../persistence/elasticSearch-engine.service.iacs.ts";
import { postgreSqlConfigurator as pg } from "../persistence/postgreSQL-engine.service.iacs.ts";
import { hasuraConfigurator as hasura } from "../proxy/rdbms/hasura.service.iacs.ts";
import { postGraphileConfigurator as graphile } from "../proxy/rdbms/postGraphile.service.iacs.ts";
import { postgRestConfigurator as postgREST } from "../proxy/rdbms/postgREST.service.iacs.ts";
import { reverseProxyConfigurator as rp } from "../proxy/reverse-proxy.ts";
import {
  TypicalComposeConfig,
  TypicalReverseProxyTargetValuesSupplier,
} from "../typical.iacs.ts";

export class AutoBaaS extends TypicalComposeConfig {
  readonly servicesName = "middleware-rdbms-auto-baas";

  constructor(ctx: cm.ProjectContext) {
    super(ctx);

    const rptvs = new TypicalReverseProxyTargetValuesSupplier(this);
    const pgDBE = pg.configureDevlEngine(this, this.common);
    const pgDbConn = pgDBE.connection();
    const pgDbeCommon = { dependsOn: [pgDBE], ...this.common };
    const postGraphileSvc = graphile.configure(
      this,
      pgDbConn,
      graphile.defaultPostgraphileOptions,
      pgDbeCommon,
    );
    const hasuraSvc = hasura.configure(this, pgDbConn, pgDbeCommon);
    const postgRestSvc = postgREST.configure(this, pgDbConn, pgDbeCommon);
    const swaggerApp = swagger.configure(
      this,
      "http://" + rptvs.proxiedHostName(this, postgRestSvc) + "/",
      { dependsOn: [postgRestSvc], ...this.common },
    );
    const esDBE = elasticSearch.configureDevlEngine(this, this.common);
    const telemetrySvc = ot.configure(this, this.common, esDBE);
    const pgAdminApp = pgAdmin.configure(this, pgDbeCommon);
    const adminerApp = adminer.configure(this, pgDbeCommon);
    const queryTreeApp = queryTree.configure(this, pgDbeCommon);
    const portainerApp = portainer.configure(this, this.common);
    const jwtValidatorApp = jwtValidator.configure(
      this,
      this.common,
    );
    rp.configure(
      this,
      rptvs,
      {
        dependsOn: [
          pgDBE,
          postGraphileSvc,
          hasuraSvc,
          postgRestSvc,
          swaggerApp,
          esDBE,
          telemetrySvc,
          adminerApp,
          pgAdminApp,
          queryTreeApp,
          portainerApp,
          jwtValidatorApp,
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
