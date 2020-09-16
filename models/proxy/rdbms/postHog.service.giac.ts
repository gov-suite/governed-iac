import type { governedIaCCore as giac } from "../../deps.ts";
import type { PostgreSqlConnectionConfig } from "../../persistence/postgreSQL-engine.service.giac.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../../typical.giac.ts";

export class PostHogServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "posthog/posthog:latest";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    ctx: giac.ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "postHog", ...optionals });
    this.environment.IS_DOCKER = true;
    this.environment.DISABLE_SECURE_SSL_REDIRECT = 1;
    this.environment.DATABASE_URL =
      "postgres://postgres:devl@postgresqlengine:${POSTGRESQLENGINE_PUBL_PORT:-5432}/devl";
    this.environment.REDIS_URL = "redis://redis:6379/";
    this.environment.SECRET_KEY = "${POSTHOG_SECRET_KEY:-secret}";
    ctx.envVars.requiredEnvVar(
      "POSTHOG_SECRET_KEY",
      "PostHog Secret key (default secret)",
    );
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 8000;
        }
      })();
  }
}

export const postHogConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    conn: PostgreSqlConnectionConfig,
    optionals?: giac.ServiceConfigOptionals,
  ): PostHogServiceConfig {
    return ctx.configured(new PostHogServiceConfig(ctx, conn, optionals));
  }
})();
