import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  polyglotArtfNature,
  valueMgr as vm,
} from "../deps.ts";
import type {
  ProxiedPort,
  ReverseProxyTarget,
  ReverseProxyTargetValuesSupplier,
} from "../proxy/reverse-proxy.ts";
import {
  TypicalComposeConfig,
  TypicalImmutableServiceConfig,
} from "../typical.giac.ts";

export interface DenoServiceOptions {
  readonly imageTag: string;
  readonly port: number;
  readonly entryPoint: string[];
  readonly dockerfileName: string;
  readonly cacheURLs: string[];
}

export function denoServiceOptions(
  override?: Partial<DenoServiceOptions> & {
    serviceLaunchCommands?: string[];
  },
): DenoServiceOptions {
  return {
    imageTag: override?.imageTag || "deno_service",
    entryPoint: override?.entryPoint || ["ls -al"],
    port: override?.port || 8163,
    dockerfileName: override?.dockerfileName || "Dockerfile",
    cacheURLs: override?.cacheURLs || [],
    ...override,
  };
}

export class DenoServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly image: vm.TextValue | giac.ServiceBuildConfig;
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;

  constructor(
    ctx: giac.ConfigContext,
    readonly serviceOptions: DenoServiceOptions,
    scOptionals?: giac.ServiceConfigOptionals,
  ) {
    super(
      {
        serviceName: "deno",
        containerName: serviceOptions.imageTag,
        ...scOptionals,
      },
    );
    this.image = {
      tag: serviceOptions.imageTag,
      dockerFile: new giac.dockerTr.Dockerfile(
        serviceOptions.dockerfileName,
        new DenoServiceInstructions(serviceOptions),
      ),
    };
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return serviceOptions.port;
        }
      })();
  }
}

export class DenoServiceInstructions implements giac.Instructions {
  readonly isInstructions = true;

  constructor(readonly serviceOptions: DenoServiceOptions) {}

  configureInstructions(): string {
    const cache: string[] = [];
    for (const c of this.serviceOptions.cacheURLs) {
      cache.push(`RUN /root/.deno/bin/deno cache --unstable ${c}`);
    }
    return [
      "FROM debian:stable-slim as build",
      "ENV DEBIAN_FRONTEND noninteractive",
      "RUN apt-get -qqq update && apt-get install -qqq curl unzip",
      "RUN curl -L https://deno.land/x/install/install.sh | sh",
      "COPY deps.ts .",
      ...cache,
      "FROM gcr.io/distroless/cc-debian10",
      "COPY --from=build /root/.deno/bin/deno /",
      "COPY --from=build /root/.cache/deno /root/.cache/deno",
      "COPY . .",
      `EXPOSE ${this.serviceOptions.port}`,
      `ENTRYPOINT ${JSON.stringify(this.serviceOptions.entryPoint)}`,
    ].join("\n");
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

export class DenoServicesConfig extends TypicalComposeConfig {
  constructor(
    ctx: cm.ProjectContext,
    readonly dso: DenoServiceOptions,
    readonly servicesName = "deno-service",
  ) {
    super(ctx);
    this.configured(new DenoServiceConfig(this, dso));
    this.finalize();
  }
}
