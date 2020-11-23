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
          `FROM ${postGraphileConfigurator.baseDockerImage}`,
          'LABEL description="PostGraphile for Information Governance Suite (IGS) Entity Attribute Graph Specification (EAGS)."\n',
          this.options?.appendPlugins
            ? `RUN yarn add ${
              this.options?.appendPlugins.join(
                " ",
              )
            } --production=true --no-progress`
            : "",
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
  readonly command?: readonly vm.Value[];
  readonly reverseProxyTargetOptions?: ReverseProxyTargetOptions | undefined;

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
      }
      : postGraphileConfigurator.baseDockerImage;
    this.command = this.createCommandsFromParams();
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

  get proxyTargetConfig(): giac.ServiceConfig {
    return this;
  }

  protected createCommandsFromParams(): vm.Value[] {
    const result: vm.Value[] = [];

    result.push("--cors");
    result.push("--connection", (ctx: cm.Context): string => {
      return vm.resolveTextValue(ctx, this.conn.url);
    });
    result.push("--host", "0.0.0.0"); // TODO need to make this a parameter
    result.push("--schema", this.conn.schema);

    if (!this.options) return result;

    const options = this.options;
    if (options.retryOnInitFail) {
      result.push("--retry-on-init-fail");
    }
    if (options.graphiQlUrl) {
      result.push("--graphiql", options.graphiQlUrl);
      if (options.enhanceGraphiQL) {
        result.push("--enhance-graphiql");
      }
    }
    if (options.simpleCollections) {
      result.push("--simple-collections", options.simpleCollections);
    }
    if (options.appendPlugins) {
      result.push("--append-plugins", options.appendPlugins.join(","));
    }
    return result;
  }
}

export const postGraphileConfigurator = new (class {
  readonly baseDockerImage = "graphile/postgraphile";
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
