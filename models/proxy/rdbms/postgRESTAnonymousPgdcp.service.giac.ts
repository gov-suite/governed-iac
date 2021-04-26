import {
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../../deps.ts";
import type { PostgreSqlConnectionConfig } from "../../persistence/postgreSQL-engine.service.giac.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetOptions,
  ReverseProxyTargetValuesSupplier,
} from "../../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../../typical.giac.ts";

export class PostgRestAnonymousPgdcpServiceConfig
  extends TypicalImmutableServiceConfig {
  readonly image = "postgrest/postgrest";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly ports: giac.ServicePublishPortConfig;
  readonly reverseProxyTargetOptions?: ReverseProxyTargetOptions | undefined;

  constructor(
    ctx: giac.ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ) {
    super({ serviceName: "postgRESTAnonymous", ...optionals });
    this.environment.PGRST_DB_URI = (
      ctx: cm.Context,
    ): string => {
      return vm.resolveTextValue(ctx, conn.url);
    };
    this.environment.PGRST_DB_SCHEMA = "${PGDCP_ANONYMOUS_SCHEMA}";
    this.environment.PGRST_DB_ANON_ROLE = "${POSTGRESQLENGINE_USER}";

    this.ports = giac.portsFactory.publishSingle(
      ctx.envVars.defaultEnvVar(
        "PGDCP_EXPOSE_PORT",
        "POSTGRESTANONYMOUS PGDCP EXPOSE PORT",
        3000,
        this,
      ),
      3000,
    );
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 3000;
        }
      })();
    this.reverseProxyTargetOptions = proxyTargetOptions;
  }

  get proxyTargetOptions(): ReverseProxyTargetOptions {
    if (this.reverseProxyTargetOptions) {
      return this.reverseProxyTargetOptions;
    } else {
      return {
        isReverseProxyTargetOptionsEnabled: false,
        isCors: false,
        isForwardAuth: false,
        isNonAuth: false,
        isReplaceAuth: false,
        isReplaceWithShield: false,
        isShieldAuth: false,
        isNoServiceName: false,
        isCheckeMailExists: false,
        isPathPrefix: false,
      };
    }
  }
}

export const postgRestAnonymousPgdcpConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ): PostgRestAnonymousPgdcpServiceConfig {
    return ctx.configured(
      new PostgRestAnonymousPgdcpServiceConfig(
        ctx,
        conn,
        optionals,
        proxyTargetOptions,
      ),
    );
  }
})();
