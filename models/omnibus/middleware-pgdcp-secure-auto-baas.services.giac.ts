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
    });
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
      true,
      {
        dependsOn: [postgRestAnonymousPgdcpSvc, postgRESTPgdcpSvc],
        ...this.common,
      },
      {
        isReverseProxyTargetOptionsEnabled: true,
        isPathPrefix: true,
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
        ],
        ...this.common,
      },
      true,
    );

    this.finalize();
  }
}

export default AutoBaaS;