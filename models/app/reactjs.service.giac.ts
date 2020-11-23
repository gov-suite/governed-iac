import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  polyglotArtfNature,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class ReactJsConfig extends TypicalImmutableServiceConfig {
  readonly image: vm.TextValue | giac.ServiceBuildConfig;
  readonly isProxyEnabled = true;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "reactJs", ...optionals });
    this.image = {
      dockerFile: new giac.dockerTr.Dockerfile(
        "Dockerfile-" + this.serviceName,
        new CustomReactJsInstructions(),
      ),
      args: {
        GIT_REPO_USERNAME: "${GIT_REPO_USERNAME}",
        GIT_REPO_TOKEN: "${GIT_REPO_TOKEN}",
      },
    };
  }
}

export class CustomReactJsInstructions implements giac.Instructions {
  readonly isInstructions = true;

  constructor() {}
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
      vm.resolveTextValue(ctx, this.configureInstructions()),
    );
    ph.persistTextArtifact(ctx, image.imageName, artifact);
  }

  configureInstructions(): string {
    var value: string = "";
    value = [
      "FROM node:14 as builder",
      "ENV GENERATE_SOURCEMAP=false",
      "ARG GIT_REPO_USERNAME",
      "ARG GIT_REPO_TOKEN",
      "RUN apt-get install git -y",
      "RUN cd / && git clone https://${GIT_REPO_USERNAME}:${GIT_REPO_TOKEN}@${UI_REPO} src",
      "WORKDIR /src",
      "RUN npm install",
      "RUN npm run build",
      "EXPOSE 80",
    ].join("\n");
    return value;
  }
}

export const ReactjsConfigurator = new (class {
  readonly baseDockerImage = "reactjs:latest";
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): ReactJsConfig {
    return ctx.configured(
      new ReactJsConfig(ctx, optionals),
    );
  }
})();
