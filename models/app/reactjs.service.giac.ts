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
        UI_REPO: "${UI_REPO}",
        NPM_AUTH_TOKEN: "${NPM_AUTH_TOKEN}",
        POSTGRAPHILE_URL: "${POSTGRAPHILE_URL}",
        GRAPHQL_PLM_URL: "${GRAPHQL_PLM_URL}",
        GITLAB_AUTH_URL: "${GITLAB_AUTH_URL}",
        GITLAB_AUTH_CLIENT_ID: "${GITLAB_AUTH_CLIENT_ID}",
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
      "ARG UI_REPO",
      "ARG NPM_AUTH_TOKEN",
      "ARG POSTGRAPHILE_URL",
      "ARG GRAPHQL_PLM_URL",
      "ARG GITLAB_AUTH_URL",
      "ARG GITLAB_AUTH_CLIENT_ID",
      "RUN apt-get install git -y",
      "RUN cd / && git clone https://${GIT_REPO_USERNAME}:${GIT_REPO_TOKEN}@${UI_REPO} src",
      "WORKDIR /src",
      "RUN git checkout feature",
      'RUN echo "//npm.pkg.github.com/:_authToken=$NPM_AUTH_TOKEN\n@medigy:registry=https://npm.pkg.github.com" > ~/.npmrc',
      'RUN echo "export const Config = {\\n postgraphileUrl: ' +
      "'$POSTGRAPHILE_URL',\\n graphqlUrl: '$GRAPHQL_PLM_URL'\\n};" +
      '" > /src/src/webpack.config.js',
      "RUN npm install",
      'RUN echo "export const ConfigGitLab = {\\n authUrl: ' +
      "'$GITLAB_AUTH_URL'\\n};\\n\\nexport const ConfigKeyClock = { \\n authUrl: '$KEYCLOAK_AUTH_URL',\\n clientId: '$KEYCLOAK_CLIENT_ID',\\n clientSecret: '$KEYCLOAK_CLIENT_SECRET'\\n};" +
      '" > node_modules/@medigy/authn-proxy-react/webpack.config.tsx',
      "RUN npm run build",
      "#Nginx",
      "FROM nginx:alpine",
      "RUN rm -rf /usr/share/nginx/html",
      "COPY --from=builder /src/build /usr/share/nginx/html",
      "RUN sed -i '/index.html.*/a try_files $uri /index.html;\\ngzip on;\\ngzip_vary on;\\ngzip_proxied any;\\ngzip_types application/javascript application/x-javascript application/xhtml+xml application/xml image/x-icon text/css text/javascript text/plain text/xml;' /etc/nginx/conf.d/default.conf",
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
