import { ConfigContext } from "../../../context.ts";
import {
  artfPersist as ap,
  contextMgr as cm,
  polyglotArtfNature,
  valueMgr as vm,
} from "../../../deps.ts";
import { Dockerfile } from "../../../docker/dockerfile.ts";
import * as img from "../../../image.ts";
import {
  ServiceBuildConfig,
  ServiceConfigOptionals,
} from "../../../service.ts";
import { TypicalImmutableServiceConfig } from "../../typical.iacs.ts";

export interface PostgreSqlEngineOptions {
  readonly baseDockerImage: string;
  readonly configureMessageDB: boolean;
}
export class MessageDBServiceConfig extends TypicalImmutableServiceConfig {
  readonly image: vm.TextValue | ServiceBuildConfig;
  readonly isProxyEnabled = false;

  readonly command: readonly vm.Value[];

  constructor(
    readonly ctx: ConfigContext,
    readonly engineOptions: PostgreSqlEngineOptions,
    optionals?: ServiceConfigOptionals,
  ) {
    super({ serviceName: "message-db", ...optionals });
    this.image = engineOptions?.configureMessageDB
      ? {
        dockerFile: new Dockerfile(
          "Dockerfile-postgreSqlEngine",
          new CustomPostgreSqlEngineInstructions(engineOptions),
        ),
      }
      : engineOptions?.baseDockerImage;

    this.environment.DATABASE_NAME = "message_store_test";
    this.environment.PGUSER = "postgres";
    this.environment.PGPASSWORD = "devl";
    this.environment.PGHOST = "middleware-rdbms-auto-baas_postgresqlengine";
    this.command = ['bash -c  "/usr/src/message-db/database/install.sh"'];
  }
}

export class CustomPostgreSqlEngineInstructions implements img.Instructions {
  readonly isInstructions = true;

  constructor(readonly options: PostgreSqlEngineOptions) {}
  configureInstructions(options: PostgreSqlEngineOptions): string {
    var value: string = "";
    if (options.configureMessageDB) {
      value += [
        `# clone Message DB`,
        "RUN cd /usr/src/ " + "\\",
        "  && git clone https://github.com/message-db/message-db.git",
        "WORKDIR /usr/src/message-db" + "\n",
      ].join("\n");
    }
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
        this.configureInstructions(this.options),
      ),
    );
    ph.persistTextArtifact(ctx, image.imageName, artifact);
  }
}

export const messageDBConfigurator = new (class {
  baseDockerImage = "middleware-rdbms-auto-baas_message-db:latest";
  configure(
    ctx: ConfigContext,
    optionals?: ServiceConfigOptionals,
  ): MessageDBServiceConfig {
    return ctx.configured(
      new MessageDBServiceConfig(ctx, {
        baseDockerImage: "middleware-rdbms-auto-baas_message-db:latest",
        configureMessageDB: true,
      }, optionals),
    );
  }
})();
