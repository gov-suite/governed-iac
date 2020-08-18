import { ConfigContext } from "../../context.ts";
import {
  artfPersist as ap,
  contextMgr as cm,
  polyglotArtfNature,
  valueMgr as vm,
} from "../../deps.ts";
import { Dockerfile } from "../../docker/dockerfile.ts";
import * as img from "../../image.ts";
import { OrchestratorErrorReporter } from "../../orchestrator.ts";
import {
  ServiceBuildConfig,
  ServiceConfigOptionals,

  ServiceVolumeConfig,
  ServiceVolumeLocalFsPathConfig,
} from "../../service.ts";
import {
  ProxiedPort,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import { TypicalImmutableServiceConfig } from "../typical.iacs.ts";

export interface ImapServiceOptions {
  readonly baseDockerImage: string;
  readonly customImapSevice: boolean;
}

export class ImapServiceConfig extends TypicalImmutableServiceConfig {
  readonly image: vm.TextValue | ServiceBuildConfig;
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly command: readonly vm.Value[];
  readonly volumes?: ServiceVolumeConfig[];
  readonly initDbVolume: ServiceVolumeLocalFsPathConfig;

  constructor(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ) {
    super({ serviceName: "imapapi", ...optionals });
    this.image = {
      dockerFile: new Dockerfile(
        "Dockerfile-IMAPapi",
        new CustomImapapiInstructions(),
      ),
    };
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: ConfigContext): ProxiedPort {
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
    ctx: ConfigContext,
    ph: ap.PersistenceHandler,
    er?: OrchestratorErrorReporter,
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

export class CustomImapapiInstructions implements img.Instructions {
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
    image: img.Image,
    ph: ap.PersistenceHandler,
    er?: img.ImageErrorReporter,
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
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ): ImapServiceConfig {
    return ctx.configured(new ImapServiceConfig(ctx, optionals));
  }
})();
