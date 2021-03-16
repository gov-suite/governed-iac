import {
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalPersistenceServiceConfig } from "../typical.giac.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";

export class GraphqlExporterServiceConfig
  extends TypicalPersistenceServiceConfig {
  readonly image = "quay.io/ricardbejarano/graphql_exporter";
  readonly ports?: giac.ServicePortsConfig;
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "graphql-exporter", ...optionals });
    this.ports = [
      giac.portsFactory.publishSingle(9199, 9199),
    ];
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          // since multiple ports are exposed, we need to be explicit
          return 9199;
        }
      })();
  }
}

export const graphqlExporterConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): GraphqlExporterServiceConfig {
    return ctx.configured(
      new GraphqlExporterServiceConfig(ctx, optionals),
    );
  }
})();
