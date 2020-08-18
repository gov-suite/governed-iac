import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  polyglotArtfNature,
  valueMgr as vm,
} from "../../deps.ts";
import { TypicalImmutableServiceConfig } from "../../typical.iacs.ts";

export interface PostgreSqlEngineOptions {
  readonly baseDockerImage: string;
  readonly configureMessageDB: boolean;
}
export class MessageDBServiceConfig extends TypicalImmutableServiceConfig {
  readonly image: vm.TextValue | giac.ServiceBuildConfig;
  readonly isProxyEnabled = false;

  readonly command: readonly vm.Value[];

  constructor(
    readonly ctx: giac.ConfigContext,
    readonly engineOptions: PostgreSqlEngineOptions,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "message-db", ...optionals });
    this.image = engineOptions?.configureMessageDB
      ? {
        dockerFile: new giac.dockerTr.Dockerfile(
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

export class CustomPostgreSqlEngineInstructions implements giac.Instructions {
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
        this.configureInstructions(this.options),
      ),
    );
    ph.persistTextArtifact(ctx, image.imageName, artifact);
  }
}

export const messageDBConfigurator = new (class {
  baseDockerImage = "middleware-rdbms-auto-baas_message-db:latest";
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): MessageDBServiceConfig {
    return ctx.configured(
      new MessageDBServiceConfig(ctx, {
        baseDockerImage: "middleware-rdbms-auto-baas_message-db:latest",
        configureMessageDB: true,
      }, optionals),
    );
  }
})();
