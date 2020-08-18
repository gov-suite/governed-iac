import { ConfigContext } from "../../context.ts";
import {
  artfPersist as ap,
  documentArtfNature,
  valueMgr as vm,
} from "../../deps.ts";
import { OrchestratorErrorReporter } from "../../orchestrator.ts";
import { portsFactory, ServicePortsConfig } from "../../ports.ts";
import {
  defaultServiceEngineListener,
  ServiceConfig,
  ServiceConfigOptionals,
  ServiceEngineListenerConfig,
  ServiceVolumeConfig,
} from "../../service.ts";
import { TypicalImmutableServiceConfig } from "../typical.iacs.ts";

export interface TraefikRouterOptions {
  readonly isTraefikRouterOptionsEnabled?: boolean;
  readonly dockerNetwork?: string;
  readonly redirectEntrypoints?: string;
  readonly redirectRule?: string;
  readonly redirectMiddlewares?: string;
  readonly redirectScheme?: string;
  readonly entrypoints?: string;
  readonly rule?: string;
  readonly tlsCertresolver?: string;
  readonly httpsRedirectPort?: number;
}

export interface TraefikServiceConfigOptionals extends ServiceConfigOptionals {
  readonly isTraefikServiceConfigOptionals: true;
  readonly isProxyEnabled: boolean;
  readonly isSecure: boolean;
  readonly routerOptions?: TraefikRouterOptions;
}

export interface ReverseProxyTarget {
  readonly isReverseProxyTarget: true;
  readonly isProxyEnabled: boolean;
  readonly proxyTargetConfig: ServiceConfig;
  readonly proxyTargetValues?: ReverseProxyTargetValuesSupplier;
}

export function isReverseProxyTarget(x: any): x is ReverseProxyTarget {
  return "isServiceConfig" in x && "isReverseProxyTarget" in x;
}

export type ProxiedPort = number | undefined;

export interface ReverseProxyTargetValuesSupplierConstructor {
  new (ctx: ConfigContext): ReverseProxyTargetValuesSupplier;
}

export interface ReverseProxyTargetValuesSupplier {
  readonly isReverseProxyTargetValuesSupplier: true;
  proxiedServiceName?(ctx: ConfigContext, sc: ServiceConfig): string;
  proxiedHostName?(ctx: ConfigContext, sc: ServiceConfig): string;
  proxiedPort?(ctx: ConfigContext, sc: ServiceConfig): ProxiedPort;
}

export function isReverseProxyTargetValuesSupplier(
  x: any,
): x is ReverseProxyTargetValuesSupplier {
  return "isReverseProxyTargetValuesSupplier" in x;
}

export class ReverseProxyServiceConfig extends TypicalImmutableServiceConfig {
  readonly isServiceConfig = true;
  readonly image = "traefik:2.2";
  readonly command: readonly vm.Value[];
  readonly ports: ServicePortsConfig;
  readonly engineListener: ServiceEngineListenerConfig;
  readonly isProxyEnabled = false;
  readonly proxySupplier: ReverseProxyTargetValuesSupplier;
  readonly volumes?: ServiceVolumeConfig[];
  readonly extraHosts?: vm.TextValue[];

  constructor(
    ctx: ConfigContext,
    proxySupplier:
      | ReverseProxyTargetValuesSupplier
      | ReverseProxyTargetValuesSupplierConstructor,
    optionals?: ServiceConfigOptionals,
    isSecure?: boolean,
    extraHosts?: vm.TextValue[],
  ) {
    super({ serviceName: "reverse-proxy", ...optionals });
    this.proxySupplier = isReverseProxyTargetValuesSupplier(proxySupplier)
      ? proxySupplier
      : new proxySupplier(ctx);
    if (extraHosts) {
      const extraHost: vm.TextValue[] = [];
      for (const c of extraHosts) {
        extraHost.push(
          "${EP_EXECENV:-sandbox}." + c +
            ".${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}:${HOST_MACHINE_IP}",
        );
      }
      this.extraHosts = extraHost;
      ctx.envVars.requiredEnvVar(
        "HOST_MACHINE_IP",
        "IP of host machine for using in traefik contianer as hosts entry.",
      );
    }
    this.engineListener = defaultServiceEngineListener();
    if (isSecure == true) {
      this.command = [
        "--providers.docker=true",
        "--providers.docker.endpoint=unix:///var/run/docker.sock",
        "--providers.docker.exposedByDefault=false",
        "--api.dashboard=true",
        "--api.insecure=true",
        "--accesslog=true",
        "--entrypoints.http.address=:80",
        "--entrypoints.https.address=:443",
        "--certificatesResolvers.default.acme.email=${LETSENCRYPT_SSL_EMAIL_ID}",
        "--certificatesResolvers.default.acme.storage=/acme.json",
        "--certificatesResolvers.default.acme.httpchallenge=true",
        "--certificatesresolvers.default.acme.httpchallenge.entrypoint=http",
        "--entryPoints.https.forwardedHeaders.insecure",
      ];
    } else {
      this.command = [
        "--providers.docker",
        "--providers.docker.endpoint=unix:///var/run/docker.sock",
        "--providers.docker.exposedByDefault=false",
        "--api.dashboard=true",
        "--api.insecure=true",
      ];
    }
    this.ports = [
      portsFactory.publishSingle(80),
      portsFactory.publishSingle(443),
      portsFactory.publishSingle(8099, 8080),
    ];
  }

  targetService(
    ctx: ConfigContext,
    rpt: ReverseProxyTarget,
  ): string {
    const sc = rpt.proxyTargetConfig;
    if (rpt.proxyTargetValues && rpt.proxyTargetValues.proxiedServiceName) {
      return rpt.proxyTargetValues.proxiedServiceName(ctx, sc);
    }
    return this.proxySupplier.proxiedServiceName
      ? this.proxySupplier.proxiedServiceName(ctx, sc)
      : vm.resolveTextValue(ctx, rpt.proxyTargetConfig.serviceName);
  }

  targetHost(
    ctx: ConfigContext,
    rpt: ReverseProxyTarget,
  ): string {
    const sc = rpt.proxyTargetConfig;
    if (rpt.proxyTargetValues && rpt.proxyTargetValues.proxiedHostName) {
      return rpt.proxyTargetValues.proxiedHostName(ctx, sc);
    }
    return this.proxySupplier.proxiedHostName
      ? this.proxySupplier.proxiedHostName(ctx, sc)
      : `${
        vm.resolveTextValue(
          ctx,
          rpt.proxyTargetConfig.serviceName,
        )
      }.docker.localhost`;
  }

  targetPort(
    ctx: ConfigContext,
    rpt: ReverseProxyTarget,
  ): ProxiedPort {
    const sc = rpt.proxyTargetConfig;
    if (rpt.proxyTargetValues && rpt.proxyTargetValues.proxiedPort) {
      return rpt.proxyTargetValues.proxiedPort(ctx, sc);
    }
    return this.proxySupplier.proxiedPort
      ? this.proxySupplier.proxiedPort(ctx, sc)
      : undefined;
  }

  registerTarget(
    ctx: ConfigContext,
    rpt: ReverseProxyTarget,
    rptOptionals?: TraefikServiceConfigOptionals,
  ): void {
    const sc = rpt.proxyTargetConfig;
    const rpServiceName = this.targetService(ctx, rpt);
    if (rptOptionals) {
      if (rptOptionals.isSecure == true) {
        sc.applyLabel("traefik.enable", true);
        if (rptOptionals?.routerOptions) {
          const ho = rptOptionals?.routerOptions;
          if (ho.isTraefikRouterOptionsEnabled) {
            if (ho.dockerNetwork) {
              sc.applyLabel("traefik.docker.network", ho.dockerNetwork);
            }
            if (ho.redirectEntrypoints) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName +
                  "-https-redirect.entrypoints",
                ho.redirectEntrypoints,
              );
            }
            if (ho.redirectRule) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName +
                  "-https-redirect.rule",
                ho.redirectRule,
              );
            }
            if (ho.redirectMiddlewares) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName +
                  "-https-redirect.middlewares",
                rpServiceName + ho.redirectMiddlewares,
              );
            }
            if (ho.redirectScheme) {
              sc.applyLabel(
                "traefik.http.middlewares." + rpServiceName +
                  "-https-redirect.redirectscheme.scheme",
                ho.redirectScheme,
              );
            }
            const proxiedPort = this.targetPort(ctx, rpt);
            if (proxiedPort) {
              sc.applyLabel(
                "traefik.http.services." + rpServiceName +
                  "-https-redirect.loadbalancer.server.port",
                proxiedPort,
              );
            }
            if (ho.entrypoints) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName + ".entrypoints",
                ho.entrypoints,
              );
            }
            if (ho.rule) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName + ".rule",
                ho.rule,
              );
            }
            if (ho.tlsCertresolver) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName + ".tls.certresolver",
                ho.tlsCertresolver,
              );
            }
          }
        }
      } else {
        sc.applyLabel(
          "traefik.http.routers." + rpServiceName + ".rule",
          "Host(`" + this.targetHost(ctx, rpt) + "`)",
        );
        sc.applyLabel("traefik.enable", true);
        const proxiedPort = this.targetPort(ctx, rpt);
        if (proxiedPort) {
          sc.applyLabel(
            "traefik.http.services." + rpServiceName +
              ".loadbalancer.server.port",
            proxiedPort,
          );
        }
      }
    }
  }

  traefikRouterOptions(
    cfxContext: ConfigContext,
    rpt: ReverseProxyTarget,
    isSecure: boolean,
  ): TraefikRouterOptions {
    return isSecure
      ? {
        isTraefikRouterOptionsEnabled: true,
        dockerNetwork: "network",
        redirectEntrypoints: "http",
        redirectRule: "HostRegexp(`{any:.*}`)",
        redirectMiddlewares: "-https-redirect",
        redirectScheme: "https",
        entrypoints: "https",
        rule: "Host(`" + this.targetHost(cfxContext, rpt) + "`)",
        tlsCertresolver: "default",
      }
      : {
        isTraefikRouterOptionsEnabled: true,
        rule: "Host(`" + this.targetHost(cfxContext, rpt) + "`)",
      };
  }

  traefikServiceConfigOptionals(
    ctx: ConfigContext,
    rpt: ReverseProxyTarget,
    isSecure: boolean,
  ): TraefikServiceConfigOptionals {
    const traefikServiceConfigOptionals: TraefikServiceConfigOptionals = {
      isTraefikServiceConfigOptionals: true,
      isProxyEnabled: true,
      isSecure: isSecure,
      routerOptions: this.traefikRouterOptions(ctx, rpt, isSecure),
    };
    return traefikServiceConfigOptionals;
  }

  persistRelatedArtifacts(
    ctx: ConfigContext,
    ph: ap.PersistenceHandler,
    er?: OrchestratorErrorReporter,
  ): void {
    const mta = ph.createMutableTextArtifact(
      ctx,
      { nature: documentArtfNature.jsonArtifact },
    );
    ph.persistTextArtifact(ctx, "acme.json", mta, { chmod: 0o600 });
  }
}

export const reverseProxyConfigurator = new (class {
  configure(
    ctx: ConfigContext,
    proxySupplier:
      | ReverseProxyTargetValuesSupplier
      | ReverseProxyTargetValuesSupplierConstructor,
    optionals?: ServiceConfigOptionals,
    isSecure?: boolean,
    extraHosts?: vm.TextValue[],
  ): ReverseProxyServiceConfig {
    const result = new ReverseProxyServiceConfig(
      ctx,
      proxySupplier,
      optionals,
      isSecure,
      extraHosts,
    );
    ctx.subscribe<ReverseProxyTarget>(
      isReverseProxyTarget,
      (
        ctx: ConfigContext,
        rpt: ReverseProxyTarget,
      ): void => {
        if (rpt.isProxyEnabled) {
          var isHttps = isSecure ? true : false;
          result.registerTarget(
            ctx,
            rpt,
            result.traefikServiceConfigOptionals(ctx, rpt, isHttps),
          );
        }
      },
    );
    return ctx.configured(result);
  }
})();
