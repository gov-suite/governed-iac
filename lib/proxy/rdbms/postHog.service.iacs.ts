import { ConfigContext } from "../../../context.ts";
import { ServiceConfigOptionals } from "../../../service.ts";
import { PostgreSqlConnectionConfig } from "../../persistence/postgreSQL-engine.service.iacs.ts";
import { TypicalImmutableServiceConfig } from "../../typical.iacs.ts";
import {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../../proxy/reverse-proxy.ts";

export class PostHogServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "posthog/posthog:latest";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    ctx: ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    optionals?: ServiceConfigOptionals,
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
        proxiedPort(ctx: ConfigContext): ProxiedPort {
          return 8000;
        }
      })();
  }
}

export const postHogConfigurator = new (class {
  configure(
    ctx: ConfigContext,
    conn: PostgreSqlConnectionConfig,
    optionals?: ServiceConfigOptionals,
  ): PostHogServiceConfig {
    return ctx.configured(new PostHogServiceConfig(ctx, conn, optionals));
  }
})();
