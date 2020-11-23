import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  polyglotArtfNature,
  valueMgr as vm,
} from "../deps.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetOptions,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class JwtValidatorConfig extends TypicalImmutableServiceConfig {
  readonly image = "node:12";
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly command: readonly vm.Value[];
  readonly ports?: giac.ServicePortsConfig;
  readonly volumes?: giac.ServiceVolumeConfig[];
  readonly initDbVolume: giac.ServiceVolumeLocalFsPathConfig;
  readonly reverseProxyTargetOptions?: ReverseProxyTargetOptions;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ) {
    super({ serviceName: "jwt-validator", ...optionals });
    this.ports = { isServiceExposePortConfig: true, target: 3000 };
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          // since multiple ports are exposed, we need to be explicit
          return 3000;
        }
      })();
    this.environment.GITLAB_JWKS_URI = "${GITLAB_JWKS_URI}";
    ctx.envVars.requiredEnvVar(
      "GITLAB_JWKS_URI",
      "GitLab JSON Web Key Set URL endpoint, eg:- https://git.netspective.io/oauth/discovery/keys",
    );
    this.initDbVolume = {
      localFsPath: (ctx: cm.Context) => {
        const pp = cm.isProjectContext(ctx) ? ctx.projectPath : ".";
        return `${pp}/jwt-validator.sh`;
      },
      containerFsPath: "/jwt-validator.sh",
    };
    this.volumes = [
      this.initDbVolume,
    ];
    this.command = ["/jwt-validator.sh"];
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
      };
    }
  }

  persistRelatedArtifacts(
    ctx: giac.ConfigContext,
    ph: ap.PersistenceHandler,
    er?: giac.OrchestratorErrorReporter,
  ): void {
    const mta = ph.createMutableTextArtifact(
      ctx,
      { nature: polyglotArtfNature.shfileArtifact },
    );
    mta.appendText(
      ctx,
      vm.resolveTextValue(
        ctx,
        [
          "if [ ! -d /src ]; then",
          "git clone https://gitlab+deploy-token-3:y5CGrpqwn4yfxtBVsJBq@git.netspective.io/netspective-studios/jsonwebtoken-validator /src",
          "fi",
          "cd /src",
          'echo "JWKS_URI=${GITLAB_JWKS_URI}" > .env',
          "npm install",
          "node server.js",
        ].join("\n"),
      ),
    );
    ph.persistTextArtifact(ctx, "jwt-validator.sh", mta, { chmod: 0o755 });
  }
}

export const jwtValidatorConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ): JwtValidatorConfig {
    return ctx.configured(
      new JwtValidatorConfig(ctx, optionals, proxyTargetOptions),
    );
  }
})();
