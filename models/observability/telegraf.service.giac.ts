import {
  artfPersist as ap,
  contextMgr as cm,
  encodingTOML as toml,
  governedIaCCore as giac,
  polyglotArtfNature,
  testingAsserts as ta,
  valueMgr as vm,
} from "../deps.ts";
import type {
  InfluxDbConnectionConfig,
  InfluxDbConnectionSecrets,
} from "../persistence/influxDB-engine.service.giac.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

interface TelegrafAgentConfig {
  readonly interval?: vm.TextValue;
  readonly collectionJitter?: vm.TextValue;
  readonly flushInterval?: vm.TextValue;
  readonly flushJitter?: vm.TextValue;
}

interface TelegrafMeasurementTags {
  readonly boundary?: vm.TextValue;
  readonly subBoundary?: vm.TextValue;
  readonly asset?: vm.TextValue;
  readonly subAsset?: vm.TextValue;
}

interface TelegrafInfluxDBConnectionConfig extends InfluxDbConnectionConfig {
  readonly dbOrg: vm.TextValue;
  readonly secrets: TelegrafInfluxDBSecrets;
}

interface TelegrafInfluxDBSecrets extends InfluxDbConnectionSecrets {
  token: vm.TextValue;
}

export interface TelegrafOptions {
  readonly retryOnInitFail?: boolean;
  readonly appendPlugins?: string[];
  readonly pluginName?: vm.TextValue;
  readonly controlName?: vm.TextValue;

  readonly telegrafAgentConfig?: TelegrafAgentConfig;
  readonly telegrafMeasurementTags?: TelegrafMeasurementTags;
  readonly telegrafDbConn?: TelegrafInfluxDBConnectionConfig;

  readonly serviceName: vm.TextValue;
}

function createTelegrafConfig(ctx: cm.Context, opts: TelegrafOptions) {
  const telegrafConf = {
    "agent": {
      "interval": opts.telegrafAgentConfig?.interval,
      "collection_jitter": opts.telegrafAgentConfig?.collectionJitter,
      "flush_interval": opts.telegrafAgentConfig?.flushInterval,
      "flush_jitter": opts.telegrafAgentConfig?.flushJitter,
    },
    "inputs": {
      "axp-control-plugin-xxxx": [
        {
          "boundary": opts.telegrafMeasurementTags?.boundary,
          "sub_boundary": opts.telegrafMeasurementTags?.subBoundary,
          "asset": opts.telegrafMeasurementTags?.asset,
          "sub_asset": opts.telegrafMeasurementTags?.subAsset,
        },
      ],
    },
    "outputs": {
      "influxdb_v2": [{
        "urls": [
          opts.telegrafDbConn?.url,
        ],
        "bucket": opts.telegrafDbConn?.dbName,
        "organization": opts.telegrafDbConn?.dbOrg,
        "token": opts.telegrafDbConn?.secrets.token,
      }],
    },
  };
  return addTelegrafConfigMultilines(
    replaceTelegrafConfigControlName(
      toml.stringify(telegrafConf),
      opts.controlName
        ? vm.resolveTextValue(ctx, opts.controlName)
        : "[controlName?]",
    ),
  );
}

function replaceTelegrafConfigControlName(telegrafConf: string, cname: string) {
  return telegrafConf.replace(/xxxx/g, cname);
}

function addTelegrafConfigMultilines(template: string) {
  let config: string = "";
  const maxlines = 25;
  var at = (template.split("\n", maxlines));

  for (const index in at) {
    at[index] += "\\n\\\n";
    config += at[index];
  }
  config += "\\n\\";
  return config;
}

export class TelegrafPluginServiceDockerfile implements giac.Instructions {
  readonly isInstructions = true;

  constructor(
    readonly options?: TelegrafOptions,
    readonly scOptionals?: giac.ServiceConfigOptionals,
  ) {}

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
          `FROM ${telegrafConfigurator.baseDockerImage}`,
          'LABEL description="Telegraf Plugin"\n',
          "RUN apt-get update && apt-get install -y git",
          "RUN go get github.com/influxdata/telegraf 2>&1",
          "WORKDIR /",
          "RUN git clone https://\${GIT_REPO_USERNAME}:\${GIT_REPO_TOKEN}@git.netspective.io/netspective-studios/ambient-experience-platform/axp-control-plugins.git",
          "WORKDIR axp-control-plugins/" + this.options?.pluginName,
          "RUN mkdir -p /go/src/github.com/influxdata/telegraf/plugins/inputs/" +
          this.options?.pluginName,
          "RUN mv all.go /go/src/github.com/influxdata/telegraf/plugins/inputs/all/",
          "RUN mv axp-control-plugin-" + this.options?.controlName +
          ".go /go/src/github.com/influxdata/telegraf/plugins/inputs/" +
          this.options?.pluginName,
          "RUN mv axp-control-plugin-" + this.options?.controlName +
          "_test.go /go/src/github.com/influxdata/telegraf/plugins/inputs/" +
          this.options?.pluginName,
          "WORKDIR /go/src/github.com/influxdata/telegraf",
          "RUN make",
          "FROM golang:latest",
          "WORKDIR /app",
          "RUN echo '\\n\\",
          this.options ? createTelegrafConfig(ctx, this.options) : "",
          "\\n'>>/app/telegraf-" + this.options?.controlName + "-influxv2.conf",
          "COPY --from=builder /go/src/github.com/influxdata/telegraf/telegraf /app",
          'ENTRYPOINT ["./telegraf"]',
        ].join("\n"),
      ),
    );
    ph.persistTextArtifact(ctx, image.imageName, artifact);
  }
}

export class TelegrafPluginServiceConfig extends TypicalImmutableServiceConfig {
  readonly isProxyEnabled = true;
  readonly image: vm.TextValue | giac.ServiceBuildConfig;
  readonly volumes?: giac.ServiceVolumeConfig[];
  readonly networks?: giac.ServiceNetworkConfig[];
  readonly initOsqueryLogVolume: giac.ServiceVolumeLocalFsPathConfig;
  readonly command?: readonly vm.Value[];

  constructor(
    ctx: giac.ConfigContext,
    readonly options: TelegrafOptions,
    scOptionals?: giac.ServiceConfigOptionals,
  ) {
    super({ ...scOptionals });
    this.image = options.appendPlugins
      ? {
        dockerFile: new giac.dockerTr.Dockerfile(
          "Dockerfile-" + scOptionals?.serviceName,
          new TelegrafPluginServiceDockerfile(options, scOptionals),
        ),
      }
      : telegrafConfigurator.baseDockerImage;
    this.initOsqueryLogVolume = {
      localFsPath: "/var/log/osquery",
      containerFsPath: "/var/log/osquery",
    };
    this.volumes = [
      this.initOsqueryLogVolume,
    ];
    this.command = [
      "--config",
      "/app/telegraf-" + this.options.controlName + "-influxv2.conf",
    ];
  }

  get proxyTargetConfig(): giac.ServiceConfig {
    return this;
  }

  protected createCommandsFromParams(): vm.Value[] {
    const result: vm.Value[] = [];

    result.push("--config", "${TELEGRAF_CONFIG}");

    if (!this.options) return result;

    const options = this.options;
    return result;
  }
}

export const telegrafConfigurator = new (class {
  readonly baseDockerImage = "golang:latest as builder";

  configure(
    ctx: giac.ConfigContext,
    options: TelegrafOptions,
    scOptionals?: giac.ServiceConfigOptionals,
  ): TelegrafPluginServiceConfig {
    return ctx.configured(
      new TelegrafPluginServiceConfig(ctx, options, scOptionals),
    );
  }
})();
