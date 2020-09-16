import {
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalPersistenceServiceConfig } from "../typical.giac.ts";

export interface InfluxDbConnectionSecrets {
  user: vm.TextValue;
  password: vm.TextValue;
}

export interface InfluxDbConnectionConfig {
  readonly dbName: vm.TextValue;
  readonly secrets: InfluxDbConnectionSecrets;
  readonly host: vm.TextValue;
  readonly hostPort: vm.NumericValue;
  readonly url: vm.TextValue;
}

export class InfluxDbEngineServiceConfig
  extends TypicalPersistenceServiceConfig {
  readonly image = "quay.io/influxdb/influxdb:2.0.0-beta";
  readonly volumes?: giac.ServiceVolumeConfig[];
  readonly command?: vm.Value[];
  readonly ports: giac.ServicePublishPortConfig;
  readonly isProxyEnabled = true;

  constructor(
    ctx: giac.ConfigContext,
    readonly conn: InfluxDbConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "influxDbEngine", ...optionals });
    this.ports = giac.portsFactory.publishSingle(
      ctx.envVars.defaultEnvVar(
        "PUBL_PORT",
        "InfluxDB Engine published port",
        conn.hostPort,
        this,
      ),
      conn.hostPort,
    );
    this.environment.INFLUXDB_DB = conn.dbName;
    this.environment.INFLUXDB_USER = conn.secrets.user;
    this.environment.INFLUXDB_USER_PASSWORD = conn.secrets.password;
    this.environment.INFLUXDB_HTTP_AUTH_ENABLED = true;
    this.volumes = [
      {
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable user generated and asset metrics content",
          contentRecoveryType:
            giac.MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
        localVolName: this.serviceName + "-storage",
        containerFsPath: "/var/lib/influxdb/data",
      },
    ];
  }

  applyLabel(key: string, value: string | number | boolean): void {
    this.labels[key] = value;
  }

  public connection(): InfluxDbConnectionConfig {
    return influxDbConfigurator.configureConn(
      this.conn.dbName,
      this.conn.secrets,
      this.serviceName,
      this.ports.published,
    );
  }
}

export const influxDbConfigurator = new (class {
  configureConn(
    dbName: vm.TextValue,
    secrets: InfluxDbConnectionSecrets,
    host: vm.TextValue = "0.0.0.0",
    hostPort: vm.NumericValue = 9999,
  ): InfluxDbConnectionConfig {
    return new (class implements InfluxDbConnectionConfig {
      readonly dbName = dbName;
      readonly secrets = secrets;
      readonly host = host;
      readonly hostPort = hostPort;
      readonly url = (ctx: cm.Context): string => {
        return `http://${
          vm.resolveTextValue(
            ctx,
            this.host,
          )
        }:${vm.resolveNumericValueAsText(ctx, this.hostPort)}`;
      };
    })();
  }

  configureDevlEngine(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): InfluxDbEngineServiceConfig {
    const conn = this.configureConn("devl", {
      user: "",
      password: "",
    });
    return ctx.configured(
      new InfluxDbEngineServiceConfig(ctx, conn, optionals),
    );
  }
})();
