import { contextMgr as cm } from "../deps.ts";
import { influxDbConfigurator as influxDB } from "../persistence/influxDB-engine.service.giac.ts";
import { postgreSqlConfigurator as pg } from "../persistence/postgreSQL-engine.service.giac.ts";
import { reverseProxyConfigurator as rp } from "../proxy/reverse-proxy.ts";
import {
  TypicalComposeConfig,
  TypicalReverseProxyTargetValuesSupplier,
} from "../typical.giac.ts";

export class MeasurementResultsPersistence extends TypicalComposeConfig {
  readonly servicesName = "ops-measurement-results-persistence";

  constructor(ctx: cm.ProjectContext) {
    super(ctx);

    const rptvs = new TypicalReverseProxyTargetValuesSupplier(this);
    const inflDbe = influxDB.configureDevlEngine(this, this.common);
    const pgDbe = pg.configureDevlEngine(this, {
      serviceName: "osctrl-db",
      ...this.common,
    });

    rp.configure(this, rptvs, {
      dependsOn: [inflDbe],
      ...this.common,
    });

    this.finalize();
  }
}

export default MeasurementResultsPersistence;
