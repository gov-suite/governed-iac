import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../deps.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class OpenprojectConfig extends TypicalImmutableServiceConfig {
  readonly image = "openproject/community:12";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly volumes?: giac.ServiceVolumeConfig[];

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "openproject", ...optionals });
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 80;
        }
      })();
    this.volumes = [
      {
        localVolName: "openproject-storage",
        containerFsPath: "/var/openproject/assets",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable user generated and transactional content",
          contentRecoveryType:
            giac.MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
      },
    ];
    ctx.envVars.requiredEnvVar(
      "POSTGRESQLENGINE_OPENPROJECT_DB",
      "PgDCP openproject database",
    );
    ctx.envVars.requiredEnvVar(
      "PGDCP_OP_SECRET_KEY_BASE",
      "Openproject secret key used for cookies",
    );
    this.environment.SECRET_KEY_BASE = "${PGDCP_OP_SECRET_KEY_BASE}";
    this.environment.DATABASE_URL =
      "postgres://${POSTGRESQLENGINE_OWNER_USER}:${POSTGRESQLENGINE_OWNER_PASSWORD}@${POSTGRESQLENGINE_HOST}:${POSTGRESQLENGINE_PORT}/${POSTGRESQLENGINE_OPENPROJECT_DB}?sslmode=disable";
  }
}

export const openprojectConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): OpenprojectConfig {
    return ctx.configured(
      new OpenprojectConfig(ctx, optionals),
    );
  }
})();
