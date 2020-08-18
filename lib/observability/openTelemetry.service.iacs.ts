import { ConfigContext } from "../../context.ts";
import { portsFactory, ServicePortsConfig } from "../../ports.ts";
import { ServiceConfigOptionals } from "../../service.ts";
import { ElasticSearchEngineServiceConfig } from "../persistence/elasticSearch-engine.service.iacs.ts";
import {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalMutableServiceConfig } from "../typical.iacs.ts";

export class OpenTelemetryConfig extends TypicalMutableServiceConfig {
  readonly image = "jaegertracing/all-in-one";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly ports: ServicePortsConfig;

  constructor(
    optionals?: ServiceConfigOptionals,
    esEngine?: ElasticSearchEngineServiceConfig,
  ) {
    super({ serviceName: "telemetry", ...optionals });
    this.environment.COLLECTOR_ZIPKIN_HTTP_PORT = 9411;
    if (esEngine) {
      const esConn = esEngine.connection();
      this.environment.SPAN_STORAGE_TYPE = "elasticsearch";
      this.environment.ES_SERVER_URLS = esConn.url;
    }
    this.ports = [
      portsFactory.publishSingleUDP(5775),
      portsFactory.publishSingleUDP(6831),
      portsFactory.publishSingleUDP(6832),
      portsFactory.publishSingle(5778),
      portsFactory.publishSingle(16686),
      portsFactory.publishSingle(14268),
      portsFactory.publishSingle(this.environment.COLLECTOR_ZIPKIN_HTTP_PORT),
    ];
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: ConfigContext): ProxiedPort {
          // since multiple ports are exposed, we need to be explicit
          return 16686;
        }
      })();
  }
}

export const openTelemetryConfigurator = new (class {
  configure(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
    esEngine?: ElasticSearchEngineServiceConfig,
  ): OpenTelemetryConfig {
    return ctx.configured(new OpenTelemetryConfig(optionals, esEngine));
  }
})();
