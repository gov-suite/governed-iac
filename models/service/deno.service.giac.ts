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
  readonly serviceLaunchScriptName: string;
  readonly servicePort: number;
  readonly serviceLaunchScript: (
    ctx: giac.ConfigContext,
    ph: ap.PersistenceHandler,
  ) => ap.MutableTextArtifact;
}

export function denoServiceOptions(
  override?: Partial<DenoServiceOptions> & {
    serviceLaunchCommands?: string[];
  },
): DenoServiceOptions {
  return {
    imageTag: override?.imageTag || "deno_service",
    serviceLaunchScriptName: override?.serviceLaunchScriptName ||
      "deno-service.sh",
    serviceLaunchScript: override?.serviceLaunchScript ||
      ((
        ctx: giac.ConfigContext,
        ph: ap.PersistenceHandler,
      ): ap.MutableTextArtifact => {
        const mta = ph.createMutableTextArtifact(
          ctx,
          { nature: polyglotArtfNature.shfileArtifact },
        );
        mta.appendText(
          ctx,
          vm.resolveTextValue(
            ctx,
            (override?.serviceLaunchCommands ||
              ["# serviceLaunchScript or serviceLaunchCommand required"]).join(
                "\n",
              ),
          ),
        );
        return mta;
      }),
    servicePort: override?.servicePort || 8163,
    ...override,
  };
}

export class DenoServiceConfig extends TypicalImmutableServiceConfig
  implements ReverseProxyTarget {
  readonly image: vm.TextValue | giac.ServiceBuildConfig;
  readonly isProxyEnabled = true;
  readonly proxyTargetValues: ReverseProxyTargetValuesSupplier;
  readonly command: readonly vm.Value[];

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
        `Dockerfile-${this.serviceName}`,
        new DenoServiceInstructions(serviceOptions),
      ),
    };
    this.proxyTargetValues =
      new (class implementsReverseProxyTargetValuesSupplier {
        readonly isReverseProxyTargetValuesSupplier = true;
        proxiedPort(ctx: giac.ConfigContext): ProxiedPort {
          return serviceOptions.servicePort;
        }
      })();
    this.command = [`/${this.serviceOptions.serviceLaunchScriptName}`];
  }

  persistRelatedArtifacts(
    ctx: giac.ConfigContext,
    ph: ap.PersistenceHandler,
    er?: giac.OrchestratorErrorReporter,
  ): void {
    ph.persistTextArtifact(
      ctx,
      this.serviceOptions.serviceLaunchScriptName,
      this.serviceOptions.serviceLaunchScript(ctx, ph),
      { chmod: 0o755 },
    );
  }
}

export class DenoServiceInstructions implements giac.Instructions {
  readonly isInstructions = true;

  constructor(readonly serviceOptions: DenoServiceOptions) {}

  configureInstructions(): string {
    var value: string = "";
    value = [
      "FROM alpine:3.9.2",
      "RUN apk add --no-cache curl",
      "RUN curl -L https://deno.land/x/install/install.sh | sh",
      "FROM gcr.io/distroless/cc",
      "COPY --from=0 /root/.deno/bin/deno /",
      "COPY . /",
    ].join("\n");
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
