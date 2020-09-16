import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  polyglotArtfNature,
  valueMgr as vm,
} from "../deps.ts";
import type {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export interface ImapServiceOptions {
  readonly baseDockerImage: string;
  readonly customImapSevice: boolean;
}

export class ImapServiceConfig extends TypicalImmutableServiceConfig {
  readonly image: vm.TextValue | giac.ServiceBuildConfig;
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly command: readonly vm.Value[];
  readonly volumes?: giac.ServiceVolumeConfig[];
  readonly initDbVolume: giac.ServiceVolumeLocalFsPathConfig;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "imapapi", ...optionals });
    this.image = {
      dockerFile: new giac.dockerTr.Dockerfile(
        "Dockerfile-IMAPapi",
        new CustomImapapiInstructions(),
      ),
    };
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return 3000;
        }
      })();
    this.initDbVolume = {
      localFsPath: (ctx: cm.Context) => {
        const pp = cm.isProjectContext(ctx) ? ctx.projectPath : ".";
        return `${pp}/imapapi.sh`;
      },
      containerFsPath: "/imapapi.sh",
    };
    this.volumes = [
      this.initDbVolume,
    ];
    this.command = ["/imapapi.sh"];
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
          'node server.js --api.host="0.0.0.0" --dbs.redis="redis://middleware-rdbms-auto-baas_redis:6379"',
        ].join("\n"),
      ),
    );
    ph.persistTextArtifact(ctx, "imapapi.sh", mta, { chmod: 0o755 });
  }
}

export class CustomImapapiInstructions implements giac.Instructions {
  readonly isInstructions = true;

  constructor() {}
  configureInstructions(): string {
    var value: string = "";
    value = [
      `FROM node:12.16.0-alpine` + "\n",
      "RUN apk add --no-cache git bash",
      "RUN cd /root && " + "\\",
      "    git clone https://github.com/andris9/imapapi.git",
      "WORKDIR /root/imapapi",
      "RUN npm install --production",
    ].join("\n");
    return value;
  }

  persist(
    ctx: cm.Context,
    image: giac.Image,
    ph: ap.PersistenceHandler,
    er?: giac.ImageErrorReporter,
  ): void {
    const artifact = ph.createMutableTextArtifact(ctx, {
      nature: polyglotArtfNature.dockerfileArtifact,
    });
    artifact.appendText(
      ctx,
      vm.resolveTextValue(
        ctx,
        this.configureInstructions(),
      ),
    );
    ph.persistTextArtifact(ctx, image.imageName, artifact);
  }
}

export const imapConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): ImapServiceConfig {
    return ctx.configured(new ImapServiceConfig(ctx, optionals));
  }
})();
