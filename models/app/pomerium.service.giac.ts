import { governedIaCCore as giac } from "../deps.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class PomeriumServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "pomerium/pomerium:latest";
  readonly containerName = "middleware-gitlab-auto-baas_pomerium";
  readonly isProxyEnabled = true;
  readonly volumes?: giac.ServiceVolumeConfig[];
  readonly networks?: giac.ServiceNetworkConfig[];
  readonly ports?: giac.ServiceExposePortConfig;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "pomerium", ...optionals });
    this.ports = { isServiceExposePortConfig: true, target: 443 };
    this.environment.AUTHENTICATE_SERVICE_URL =
      "${EP_EXECENV:-sandbox}.ztp.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}";
    this.environment.INSECURE_SERVER = true;
    this.environment.POMERIUM_DEBUG = true;
    this.environment.IDP_PROVIDER = "gitlab";
    this.environment.IDP_PROVIDER_URL =
      "https://${EP_EXECENV:-sandbox}.gitLab.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}";
    this.environment.IDP_CLIENT_ID = "${ZTP_CLIENT_ID}";
    this.environment.IDP_CLIENT_SECRET = "${ZTP_CLIENT_SECRET}";
    this.environment.IDP_SCOPES = "openid,read_user,read_api,email";
    this.environment.COOKIE_SECRET = "${ZTP_COOKIE_SECRET}";
    this.environment.SHARED_SECRET = "${ZTP_SHARED_SECRET}";
    this.environment.COOKIE_SECURE = false;
    this.environment.FORWARD_AUTH_URL =
      "${EP_EXECENV:-sandbox}.ztp-forward.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}";
    this.environment.POLICY = "${ZTP_BASE64_ENCODED_POLICY}";
    this.volumes = [
      {
        localVolName: "./pomerium-config.yaml:/pomerium/config.yaml:ro",
        containerFsPath: "",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable container configuration",
          contentRecoveryType:
            giac.MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
      },
    ];
  }
}

export const pomeriumConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): PomeriumServiceConfig {
    const result = new PomeriumServiceConfig(ctx, optionals);
    return ctx.configured(result);
  }
})();
