import {
  artfPersist as ap,
  contextMgr as cm,
  specModule as sm,
} from "../../deps.ts";
import { gitlabConfigurator as gitLab } from "../persistence/gitlab-engine.service.iacs.ts";
import { reverseProxyConfigurator as rp } from "../proxy/reverse-proxy.ts";
import { postgreSqlConfigurator as pg } from "../persistence/postgreSQL-engine.service.iacs.ts";
import { postgRestConfigurator as postgREST } from "../proxy/rdbms/postgREST.service.iacs.ts";
import { swaggerConfigurator as swagger } from "../app/swagger-app.service.iacs.ts";
import { adminerConfigurator as adminer } from "../app/adminer.service.iacs.ts";
import {
  TypicalComposeConfig,
  TypicalReverseProxyTargetValuesSupplier,
} from "../typical.iacs.ts";

export class AutoBaaS extends TypicalComposeConfig {
  readonly servicesName = "middleware-rdbms-auto-baas";

  constructor(ctx: cm.ProjectContext) {
    super(ctx);

    const rptvs = new TypicalReverseProxyTargetValuesSupplier(this);
    const pgDbConn = pg.configureDevlConn(this, this.common);
    const pgDbeCommon = { ...this.common };
    const gitLabApp = gitLab.configure(
      this,
      this.common,
    );
    const postgRestSvc = postgREST.configure(this, pgDbConn, this.common, true);
    const swaggerApp = swagger.configure(
      this,
      "http://" + rptvs.proxiedHostName(this, postgRestSvc) + "/",
      { dependsOn: [postgRestSvc], ...this.common },
    );
    const adminerApp = adminer.configure(this, pgDbeCommon);
    rp.configure(this, rptvs, {
      dependsOn: [
        postgRestSvc,
        swaggerApp,
        adminerApp,
        gitLabApp,
      ],
      ...this.common,
    }, true);
    this.finalize();
  }
}

export default AutoBaaS;
