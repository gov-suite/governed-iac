import { ConfigContext } from "../../context.ts";
import {
  contextMgr as cm,
  valueMgr as vm,
} from "../../deps.ts";
import { portsFactory, ServicePortsConfig } from "../../ports.ts";
import {
  MutableServiceVolumeContentRecoveryType,
  ServiceConfigOptionals,
  ServiceVolumeConfig,
} from "../../service.ts";
import {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalPersistenceServiceConfig } from "../typical.iacs.ts";

export interface ElasticSearchConnectionSecrets {
  // TODO add authentication details (see PostgreSQL Engine as example)
}

export interface ElasticSearchConnectionConfig {
  readonly secrets: ElasticSearchConnectionSecrets;
  readonly host: vm.TextValue;
  readonly hostPort: vm.NumericValue;
  readonly url: vm.TextValue;
  // TODO add connection details (see PostgreSQL Engine as example)
}

export class ElasticSearchEngineServiceConfig
  extends TypicalPersistenceServiceConfig {
  readonly image = "docker.elastic.co/elasticsearch/elasticsearch:7.7.0";
  readonly volumes?: ServiceVolumeConfig[];
  readonly command?: vm.Value[];
  readonly ports: ServicePortsConfig;
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    ctx: ConfigContext,
    readonly conn: ElasticSearchConnectionConfig,
    optionals?: ServiceConfigOptionals,
  ) {
    super({ serviceName: "elasticSearchEngine", ...optionals });
    this.ports = [
      portsFactory.publishSingle(conn.hostPort, 9200),
      portsFactory.publishSingle(9300),
    ];
    this.environment["discovery.type"] = "single-node";
    this.volumes = [
      {
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable user generated search content",
          contentRecoveryType:
            MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
        localVolName: this.serviceName + "-storage",
        containerFsPath: "/usr/share/elasticsearch",
      },
    ];
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: ConfigContext): ProxiedPort {
          // since multiple ports are exposed, we need to be explicit
          return 9200;
        }
      })();
  }

  applyLabel(key: string, value: any): void {
    this.labels[key] = value;
  }

  public connection(): ElasticSearchConnectionConfig {
    return elasticSearchConfigurator.configureConn(
      this.conn.secrets,
      this.serviceName,
      this.conn.hostPort,
    );
  }
}

export const elasticSearchConfigurator = new (class {
  configureConn(
    secrets: ElasticSearchConnectionSecrets,
    host: vm.TextValue,
    hostPort: vm.NumericValue,
  ): ElasticSearchConnectionConfig {
    return new (class implements ElasticSearchConnectionConfig {
      readonly secrets = secrets;
      readonly host = host;
      readonly hostPort = hostPort;
      readonly url = (ctx: cm.Context): string => {
        return `http://${vm.resolveTextValue(ctx, this.host)}:${
          vm.resolveNumericValueAsText(
            ctx,
            this.hostPort,
          )
        }`;
      };
    })();
  }

  configureDevlEngine(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ): ElasticSearchEngineServiceConfig {
    const conn = this.configureConn({}, "0.0.0.0", 9200);
    return ctx.configured(
      new ElasticSearchEngineServiceConfig(ctx, conn, optionals),
    );
  }
})();
