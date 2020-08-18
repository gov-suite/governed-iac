import { ConfigContext } from "../../context.ts";
import {
  ServiceConfigOptionals,
  ServiceVolumeConfig,
  ServiceNetworkConfig,
  MutableServiceVolumeContentRecoveryType,
} from "../../service.ts";
import { TypicalImmutableServiceConfig } from "../typical.iacs.ts";
import { portsFactory, ServicePortsConfig } from "../../ports.ts";
import {
  ReverseProxyTargetValuesSupplier,
  ProxiedPort,
} from "../proxy/reverse-proxy.ts";

export class GitlabServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "gitlab/gitlab-ee:latest";
  readonly hostName =
    "${EP_EXECENV:-sandbox}.gitLab.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly ports?: ServicePortsConfig;
  readonly volumes?: ServiceVolumeConfig[];
  readonly networks?: ServiceNetworkConfig[];

  constructor(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ) {
    super({ serviceName: "gitlab", ...optionals });
    this.ports = [
      portsFactory.publishSingle(8085, 80),
    ];
    ctx.envVars.requiredEnvVar(
      "PGREST_DB_URI",
      "example: postgres://user:passwor@containername:5432/dbname. You can use domain name instead of container name.Please change the port if PosgreSQL is using different port",
    );
    ctx.envVars.requiredEnvVar(
      "PGREST_DB_SCHEMA",
      "Schema of GitLab database",
    );
    ctx.envVars.requiredEnvVar(
      "PGREST_DB_USER",
      "User name of GitLab database",
    );
    ctx.envVars.requiredEnvVar(
      "LETSENCRYPT_SSL_EMAIL_ID",
      "Email id for ACME Let's Encrypt certificates for https endpoints",
    );
    this.environment.GITLAB_OMNIBUS_CONFIG =
      "external_url 'https://${EP_EXECENV:-sandbox}.gitLab.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}'; nginx['listen_port'] = 80; nginx['listen_https'] = false; nginx['enable'] = true; nginx['redirect_http_to_https'] = true; nginx['listen_addresses'] = ['0.0.0.0']";
    this.volumes = [
      {
        localVolName: "gitlabConfig-storage",
        containerFsPath: "/etc/gitlab",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "GitLab container configuration",
          contentRecoveryType: MutableServiceVolumeContentRecoveryType.EXTERNAL,
        },
      },
      {
        localVolName: "gitlabLogs-storage",
        containerFsPath: "/var/log/gitlab",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "GitLab container log content",
          contentRecoveryType: MutableServiceVolumeContentRecoveryType.EXTERNAL,
        },
      },
      {
        localVolName: "gitlabData-storage",
        containerFsPath: "/var/opt/gitlab",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "GitLab container data content",
          contentRecoveryType: MutableServiceVolumeContentRecoveryType.EXTERNAL,
        },
      },
    ];
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: ConfigContext): ProxiedPort {
          return 80;
        }
      })();
  }
}
export const gitlabConfigurator = new (class {
  configure(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ): GitlabServiceConfig {
    return ctx.configured(new GitlabServiceConfig(ctx, optionals));
  }
})();
