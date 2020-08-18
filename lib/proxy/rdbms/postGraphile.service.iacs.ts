import { assert } from "https://deno.land/std@v0.62.0/testing/asserts.ts";
import { ConfigContext } from "../../../context.ts";
import {
  artfPersist as ap,
  contextMgr as cm,
  polyglotArtfNature,
  valueMgr as vm,
} from "../../../deps.ts";
import { Dockerfile } from "../../../docker/dockerfile.ts";
import * as img from "../../../image.ts";
import { Instructions } from "../../../image.ts";
import {
  ServiceBuildConfig,
  ServiceConfig,
  ServiceConfigOptionals,
} from "../../../service.ts";
import { PostgreSqlConnectionConfig } from "../../persistence/postgreSQL-engine.service.iacs.ts";
import { TypicalImmutableServiceConfig } from "../../typical.iacs.ts";
import { ReverseProxyTarget } from "../reverse-proxy.ts";

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

export class CustomPostGraphileServiceDockerfile implements Instructions {
  readonly isInstructions = true;

  constructor(readonly options?: PostGraphileOptions) {}

  persist(
    ctx: cm.Context,
    image: img.Image,
    ph: ap.PersistenceHandler,
    er?: img.ImageErrorReporter,
  ): void {
    assert(this.options?.appendPlugins);
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
          `RUN yarn add ${
            this.options?.appendPlugins.join(
              " ",
            )
          } --production=true --no-progress`,
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
  readonly image: vm.TextValue | ServiceBuildConfig;
  readonly command?: readonly vm.Value[];

  constructor(
    ctx: ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    readonly options?: PostGraphileOptions,
    scOptionals?: ServiceConfigOptionals,
  ) {
    super({ serviceName: "postGraphile", ...scOptionals });
    this.image = options?.appendPlugins
      ? {
        dockerFile: new Dockerfile(
          "Dockerfile-" + this.serviceName,
          new CustomPostGraphileServiceDockerfile(options),
        ),
      }
      : postGraphileConfigurator.baseDockerImage;
    this.command = this.createCommandsFromParams();
  }

  get proxyTargetConfig(): ServiceConfig {
    return this;
  }

  protected createCommandsFromParams(): vm.Value[] {
    const result: vm.Value[] = [];

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
    ctx: ConfigContext,
    conn: PostgreSqlConnectionConfig,
    options: PostGraphileOptions = this.defaultPostgraphileOptions,
    scOptionals?: ServiceConfigOptionals,
  ): PostGraphileServiceConfig {
    return ctx.configured(
      new PostGraphileServiceConfig(ctx, conn, options, scOptionals),
    );
  }
})();
