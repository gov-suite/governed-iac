import { governedIaCCore as giac } from "../deps.ts";
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
  readonly ports: giac.ServicePortsConfig;

  constructor(
    optionals?: giac.ServiceConfigOptionals,
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
      giac.portsFactory.publishSingleUDP(5775),
      giac.portsFactory.publishSingleUDP(6831),
      giac.portsFactory.publishSingleUDP(6832),
      giac.portsFactory.publishSingle(5778),
      giac.portsFactory.publishSingle(16686),
      giac.portsFactory.publishSingle(14268),
      giac.portsFactory.publishSingle(
        this.environment.COLLECTOR_ZIPKIN_HTTP_PORT,
      ),
    ];
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          // since multiple ports are exposed, we need to be explicit
          return 16686;
        }
      })();
  }
}

export const openTelemetryConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
    esEngine?: ElasticSearchEngineServiceConfig,
  ): OpenTelemetryConfig {
    return ctx.configured(new OpenTelemetryConfig(optionals, esEngine));
  }
})();
