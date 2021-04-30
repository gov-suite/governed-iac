import {
  artfPersist as ap,
  governedIaCCore as giac,
  polyglotArtfNature,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class PrometheusServiceConfig extends TypicalImmutableServiceConfig {
  readonly image = "prom/prometheus:latest";
  readonly isProxyEnabled = false;
  readonly volumes?: giac.ServiceVolumeConfig[];

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "prometheus", ...optionals });
    this.volumes = [
      {
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable user generated and transactional content",
          contentRecoveryType:
            giac.MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
        localVolName: "${PWD}/prometheus.yml",
        containerFsPath: "/etc/prometheus/prometheus.yml",
      },
    ];
  }

  persistRelatedArtifacts(
    ctx: giac.ConfigContext,
    ph: ap.PersistenceHandler,
    er?: giac.OrchestratorErrorReporter,
  ): void {
    const mta = ph.createMutableTextArtifact(
      ctx,
      { nature: polyglotArtfNature.shfileArtifact },
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
    ph.persistTextArtifact(ctx, "prometheus.sh", mta, { chmod: 0o755 });
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
