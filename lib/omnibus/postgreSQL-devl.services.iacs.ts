import { contextMgr as cm } from "../../deps.ts";
import { pgAdminConfigurator as pgAdmin } from "../app/pgAdmin.service.iacs.ts";
import { postgreSqlConfigurator as pg } from "../persistence/postgreSQL-engine.service.iacs.ts";
import { reverseProxyConfigurator as rp } from "../proxy/reverse-proxy.ts";
import {
  TypicalComposeConfig,
  TypicalReverseProxyTargetValuesSupplier,
} from "../typical.iacs.ts";

export class PostgreSqlDevl extends TypicalComposeConfig {
  readonly servicesName = "postgres-devl";

  constructor(ctx: cm.ProjectContext) {
    super(ctx);

    const rptvs = new TypicalReverseProxyTargetValuesSupplier(this);
    const pgDBE = pg.configureDevlEngine(this, this.common);
    const pgDbConn = pgDBE.connection();
    const pgDbeCommon = { dependsOn: [pgDBE], ...this.common };
    const pgAdminApp = pgAdmin.configure(this, pgDbeCommon);
    rp.configure(this, rptvs, {
      dependsOn: [
        pgDBE,
        pgAdminApp,
      ],
      ...this.common,
    });

    this.finalize();
  }
}

export default PostgreSqlDevl;
