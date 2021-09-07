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

export class CustomPostGraphileServiceDockerfile implements giac.Instructions {
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
          `ARG PGDCP_POSTGRAPHILE_REPO`,
          `ARG PGDCP_POSTGRAPHILE_REPO_BRANCH`,
          `RUN apk add git`,
          "RUN git clone https://${PGDCP_GIT_REPO_USERNAME}:${PGDCP_GIT_REPO_TOKEN}@${PGDCP_POSTGRAPHILE_REPO} /src",
          `WORKDIR /src`,
          "RUN git checkout ${PGDCP_POSTGRAPHILE_REPO_BRANCH}",
          `RUN npm install`,
          `EXPOSE 5000`,
          `CMD [ "node", "server.js" ]`,
        ].join("\n"),
      ),
    );
    ph.persistTextArtifact(ctx, image.imageName, artifact);
  }
}

export class PostGraphileServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly isReverseProxyTarget = true;
  readonly isProxyEnabled = true;
  readonly image: vm.TextValue | giac.ServiceBuildConfig;
  readonly ports: giac.ServicePublishPortConfig;
  readonly reverseProxyTargetOptions?: ReverseProxyTargetOptions | undefined;
  readonly volumes?: giac.ServiceVolumeConfig[];
  readonly extraHosts?: vm.TextValue[];

  constructor(
    ctx: giac.ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    readonly options?: PostGraphileOptions,
    scOptionals?: giac.ServiceConfigOptionals,
    proxyTargetOptions?: ReverseProxyTargetOptions,
  ) {
    super({ serviceName: "postGraphile", ...scOptionals });
    this.image = options?.appendPlugins
      ? {
        dockerFile: new giac.dockerTr.Dockerfile(
          "Dockerfile-" + this.serviceName,
          new CustomPostGraphileServiceDockerfile(options),
        ),
        args: {
          PGDCP_GIT_REPO_USERNAME: "${PGDCP_GIT_REPO_USERNAME}",
          PGDCP_GIT_REPO_TOKEN: "${PGDCP_GIT_REPO_TOKEN}",
          PGDCP_POSTGRAPHILE_REPO: "${PGDCP_POSTGRAPHILE_REPO}",
          PGDCP_POSTGRAPHILE_REPO_BRANCH: "${PGDCP_POSTGRAPHILE_REPO_BRANCH}",
        },
      }
      : postGraphileConfigurator.baseDockerImage;
    this.environment.DATABASE_URL = (
      ctx: cm.Context,
    ): string => {
      return vm.resolveTextValue(ctx, conn.url);
    };
    this.environment.OWNER_CONNECTION_STRING =
      "postgres://${POSTGRESQLENGINE_OWNER_USER}:${POSTGRESQLENGINE_OWNER_PASSWORD}@${POSTGRESQLENGINE_HOST}:${POSTGRESQLENGINE_PORT}/${POSTGRESQLENGINE_DB}";
    this.environment.SCHEMA = "${PGDCP_SCHEMA}";
    this.environment.KEYCLOAK_CLIENT_ID = "${KEYCLOAK_CLIENT_ID}";
    this.environment.JWKS_URI =
      "${KEYCLOAK_SERVER_URL}/auth/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs";
    this.environment.ISSUER =
      "${KEYCLOAK_SERVER_URL}/auth/realms/${KEYCLOAK_REALM}";
    this.environment.PORT = 5000;
    ctx.envVars.requiredEnvVar(
      "PGDCP_POSTGRAPHILE_REPO",
      "pgDCP postgraphile shield repository",
    );
    ctx.envVars.requiredEnvVar(
      "PGDCP_POSTGRAPHILE_REPO_BRANCH",
      "pgDCP postgraphile shield repository branch",
    );
    ctx.envVars.requiredEnvVar(
      "PGDCP_SCHEMA",
      "pgDCP postgraphile schemas",
    );
    this.ports = giac.portsFactory.publishSingle(
      ctx.envVars.defaultEnvVar(
        "PGDCP_EXPOSE_PORT",
        "PGDCP POSTGRAPHILE EXPOSE PORT",
        5000,
        this,
      ),
      5000,
    );
    this.reverseProxyTargetOptions = proxyTargetOptions;
    this.volumes = [
      {
        localVolName: "postgraphileupload-storage",
        containerFsPath: "/src/shield/src/uploads",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable user generated and transactional content",
          contentRecoveryType:
            giac.MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
      },
    ];
    this.extraHosts = [
      "${EP_EXECENV:-sandbox}.keycloak.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}:${HOST_MACHINE_IP}",
    ];
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
        isPathPrefix: false,
      };
    }
  }

  get proxyTargetConfig(): giac.ServiceConfig {
    return this;
  }
}

export const postGraphileConfigurator = new (class {
  readonly baseDockerImage = "postgraphile:latest";
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
  ): PostGraphileServiceConfig {
    return ctx.configured(
      new PostGraphileServiceConfig(
        ctx,
        conn,
        options,
        scOptionals,
        proxyTargetOptions,
      ),
    );
  }
})();
