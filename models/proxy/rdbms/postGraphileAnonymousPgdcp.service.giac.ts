import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  polyglotArtfNature,
  testingAsserts as ta,
  valueMgr as vm,
} from "../../deps.ts";
import type { PostgreSqlConnectionConfig } from "../../persistence/postgreSQL-engine.service.giac.ts";
import { TypicalImmutableServiceConfig } from "../../typical.giac.ts";
import type {
  ReverseProxyTarget,
  ReverseProxyTargetOptions,
} from "../reverse-proxy.ts";

export interface PostGraphileOptions {
  readonly retryOnInitFail?: boolean;
  readonly appendPlugins?: string[];
  readonly graphiQlUrl?: string;
  readonly enhanceGraphiQL?: boolean;
  readonly simpleCollections?: "both" | "only";
  readonly allowExplain?: boolean;
  readonly enableQueryBatching?: boolean;
  readonly legacyRelations?: "omit";
}

export class CustomPostGraphileAnonymousServiceDockerfile
  implements giac.Instructions {
  readonly isInstructions = true;

  constructor(readonly options?: PostGraphileOptions) {}

  persist(
    ctx: cm.Context,
    image: giac.Image,
    ph: ap.PersistenceHandler,
    er?: giac.ImageErrorReporter,
  ): void {
    ta.assert(this.options?.appendPlugins);
    const artifact = ph.createMutableTextArtifact(ctx, {
      nature: polyglotArtfNature.dockerfileArtifact,
    });
    artifact.appendText(
      ctx,
      vm.resolveTextValue(
        ctx,
        [
          `FROM node:14.15-alpine`,
          `ARG PGDCP_GIT_REPO_USERNAME`,
          `ARG PGDCP_GIT_REPO_TOKEN`,
          `ARG PGDCP_POSTGRAPHILE_ANONYMOUS_REPO`,
          `ARG PGDCP_POSTGRAPHILE_ANONYMOUS_REPO_BRANCH`,
          `RUN apk add git`,
          "RUN git clone https://${PGDCP_GIT_REPO_USERNAME}:${PGDCP_GIT_REPO_TOKEN}@${PGDCP_POSTGRAPHILE_ANONYMOUS_REPO} /src",
          `WORKDIR /src`,
          "RUN git checkout ${PGDCP_POSTGRAPHILE_ANONYMOUS_REPO_BRANCH}",
          `RUN npm install`,
          `EXPOSE 5000`,
          `CMD [ "node", "server.js" ]`,
        ].join("\n"),
      ),
    );
    ph.persistTextArtifact(ctx, image.imageName, artifact);
  }
}

export class PostGraphileAnonymousServiceConfig
  extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly isReverseProxyTarget = true;
  readonly isProxyEnabled = true;
  readonly image: vm.TextValue | giac.ServiceBuildConfig;
  readonly ports: giac.ServicePublishPortConfig;
  readonly reverseProxyTargetOptions?: ReverseProxyTargetOptions | undefined;

  constructor(
    ctx: giac.ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    readonly options?: PostGraphileOptions,
    scOptionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ) {
    super({ serviceName: "postGraphileAnonymous", ...scOptionals });
    this.image = options?.appendPlugins
      ? {
        dockerFile: new giac.dockerTr.Dockerfile(
          "Dockerfile-" + this.serviceName,
          new CustomPostGraphileAnonymousServiceDockerfile(options),
        ),
        args: {
          PGDCP_GIT_REPO_USERNAME: "${PGDCP_GIT_REPO_USERNAME}",
          PGDCP_GIT_REPO_TOKEN: "${PGDCP_GIT_REPO_TOKEN}",
          PGDCP_POSTGRAPHILE_ANONYMOUS_REPO:
            "${PGDCP_POSTGRAPHILE_ANONYMOUS_REPO}",
          PGDCP_POSTGRAPHILE_ANONYMOUS_REPO_BRANCH:
            "${PGDCP_POSTGRAPHILE_ANONYMOUS_REPO_BRANCH}",
        },
      }
      : postGraphileAnonymousConfigurator.baseDockerImage;
    this.environment.DATABASE_URL = (
      ctx: cm.Context,
    ): string => {
      return vm.resolveTextValue(ctx, conn.url);
    };
    this.environment.JWKS_URI = "${PGDCP_JWKS_URI}";
    this.environment.ISSUER = "${PGDCP_ISSUER}";
    this.environment.SCHEMA = "${PGDCP_ANONYMOUS_SCHEMA}";
    this.environment.PORT = 5000;
    ctx.envVars.requiredEnvVar(
      "POSTGRESQLENGINE_USER",
      "pgDCP database user",
    );
    ctx.envVars.requiredEnvVar(
      "POSTGRESQLENGINE_PASSWORD",
      "pgDCP database password",
    );
    ctx.envVars.requiredEnvVar(
      "POSTGRESQLENGINE_HOST",
      "pgDCP database host",
    );
    ctx.envVars.requiredEnvVar(
      "POSTGRESQLENGINE_PORT",
      "pgDCP database port",
    );
    ctx.envVars.requiredEnvVar(
      "POSTGRESQLENGINE_DB",
      "pgDCP database name",
    );
    ctx.envVars.requiredEnvVar(
      "PGDCP_GIT_REPO_USERNAME",
      "GitLab user",
    );
    ctx.envVars.requiredEnvVar(
      "PGDCP_GIT_REPO_TOKEN",
      "GitLab user Token",
    );
    ctx.envVars.requiredEnvVar(
      "PGDCP_POSTGRAPHILE_ANONYMOUS_REPO",
      "pgDCP postgraphile ananymous repository",
    );
    ctx.envVars.requiredEnvVar(
      "PGDCP_POSTGRAPHILE_ANONYMOUS_REPO_BRANCH",
      "pgDCP postgraphile ananymous repository branch",
    );
    ctx.envVars.requiredEnvVar(
      "PGDCP_JWKS_URI",
      "GitLab JSON Web Key Set URL endpoint, eg:- https://git.netspective.io/oauth/discovery/keys",
    );
    ctx.envVars.requiredEnvVar(
      "PGDCP_ISSUER",
      "IDP endpoint URL",
    );
    ctx.envVars.requiredEnvVar(
      "PGDCP_ANONYMOUS_SCHEMA",
      "pgDCP anonymous postgraphile schemas",
    );
    this.ports = giac.portsFactory.publishSingle(
      ctx.envVars.defaultEnvVar(
        "PGDCP_EXPOSE_PORT",
        "PGDCP POSTGRAPHILE ANONYMOUS EXPOSE PORT",
        5000,
        this,
      ),
      5000,
    );
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
        isNonAuth: false,
        isReplaceAuth: false,
        isReplaceWithShield: false,
        isShieldAuth: false,
        isNoServiceName: false,
        isCheckeMailExists: false,
      };
    }
  }

  get proxyTargetConfig(): giac.ServiceConfig {
    return this;
  }
}

export const postGraphileAnonymousConfigurator = new (class {
  readonly baseDockerImage = "postgraphile_anonymous:latest";
  readonly defaultPostgraphilePlugins = [
    "@graphile-contrib/pg-simplify-inflector",
    "postgraphile-plugin-connection-filter",
    "@graphile-contrib/pg-order-by-related",
  ];

  readonly defaultPostgraphileOptions = {
    appendPlugins: this.defaultPostgraphilePlugins,
    retryOnInitFail: true,
    graphiQlUrl: "/",
    enhanceGraphiQL: true,
    allowExplain: true,
    enableQueryBatching: true,
    legacyRelations: "omit",
    simpleCollections: "both",
  } as PostGraphileOptions;

  configure(
    ctx: giac.ConfigContext,
    conn: PostgreSqlConnectionConfig,
    options: PostGraphileOptions = this.defaultPostgraphileOptions,
    scOptionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ): PostGraphileAnonymousServiceConfig {
    return ctx.configured(
      new PostGraphileAnonymousServiceConfig(
        ctx,
        conn,
        options,
        scOptionals,
        proxyTargetOptions,
      ),
    );
  }
})();
