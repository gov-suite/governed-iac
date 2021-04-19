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
import { imapConfigurator as imap } from "../proxy/imap.service.giac.ts";
import { hasuraConfigurator as hasura } from "../proxy/rdbms/hasura.service.giac.ts";
import { messageDBConfigurator as messageDB } from "../proxy/rdbms/messageDB.service.giac.ts";
import { postGraphileConfigurator as graphile } from "../proxy/rdbms/postGraphile.service.giac.ts";
import { postgRestConfigurator as postgREST } from "../proxy/rdbms/postgREST.service.giac.ts";
import { postHogConfigurator as postHog } from "../proxy/rdbms/postHog.service.giac.ts";
import { redisConfigurator as redis } from "../proxy/rdbms/redis.service.giac.ts";
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
    const pgDBE = pg.configureDevlEngine(this, this.common);
    const pgDbConn = pgDBE.connection(this);
    const pgDbeCommon = { dependsOn: [pgDBE], ...this.common };
    const postGraphileSvc = graphile.configure(
      this,
      pgDbConn,
      graphile.defaultPostgraphileOptions,
      pgDbeCommon,
    );
    const hasuraSvc = hasura.configure(this, pgDbConn, pgDbeCommon);
    const postgRestSvc = postgREST.configure(this, pgDbConn, pgDbeCommon);
    const redisSvc = redis.configure(this, this.common);
    const imapApp = imap.configure(this, this.common);
    const postHogSvc = postHog.configure(
      this,
      pgDbConn,
      { dependsOn: [pgDBE, redisSvc], ...this.common },
    );
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
    const messageDBSvc = messageDB.configure(this, this.common);
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
          redisSvc,
          postHogSvc,
          jwtValidatorApp,
          imapApp,
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
