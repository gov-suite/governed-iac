import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  polyglotArtfNature,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class PrometheusServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "prom/prometheus:latest";
  readonly isProxyEnabled = false;
  readonly volumes?: giac.ServiceVolumeConfig[];
  readonly initDbVolume: giac.ServiceVolumeLocalFsPathConfig;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "prometheus", ...optionals });
    this.initDbVolume = {
      localFsPath: (ctx: cm.Context) => {
        const pp = cm.isProjectContext(ctx) ? ctx.projectPath : ".";
        return "${PWD}/prometheus.yml";
      },
      containerFsPath: "/etc/prometheus/prometheus.yml",
    };
    this.volumes = [
      this.initDbVolume,
    ];
  }

  persistRelatedArtifacts(
    ctx: giac.ConfigContext,
    ph: ap.PersistenceHandler,
    er?: giac.OrchestratorErrorReporter,
  ): void {
    const mta = ph.createMutableTextArtifact(
      ctx,
      { nature: polyglotArtfNature.yamlArtifact },
    );
    mta.appendText(
      ctx,
      vm.resolveTextValue(
        ctx,
        [
          "global:",
          "  scrape_interval:     20s",
          "  evaluation_interval: 10s",
          "  scrape_timeout: 15s",
          "scrape_configs:",
          "  - job_name: github-exporter",
          "    static_configs:",
          "      - targets: ['github-exporter:9171']",
          "remote_write:",
          '  - url: "http://promscale:9201/write"',
          "remote_read:",
          '  - url: "http://promscale:9201/read"',
          "    read_recent: true",
        ].join("\n"),
      ),
    );
    ph.persistTextArtifact(ctx, "prometheus.yml", mta, { chmod: 0o755 });
  }
}

export const prometheusConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): PrometheusServiceConfig {
    return ctx.configured(new PrometheusServiceConfig(ctx, optionals));
  }
})();
