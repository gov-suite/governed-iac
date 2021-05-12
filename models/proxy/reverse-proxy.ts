import {
  artfPersist as ap,
  contextMgr as cm,
  documentArtfNature,
  governedIaCCore as giac,
  safety,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

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

export interface TraefikCorsOptions {
  readonly isTraefikCorsOptionsEnabled?: boolean;
  readonly backendMiddlewares?: string;
  readonly accessControlAllowHeaders?: string;
  readonly accessControlAllowMethods?: string;
  readonly accessControlAllowOrigin?: string;
}

export interface TraefikForwardAuthOptions {
  readonly isTraefikForwardAuthOptionsEnabled?: boolean;
  readonly backendMiddlewares?: string;
  readonly trustForwardHeader?: boolean;
  readonly address?: string;
}

export interface TraefikNonAuthOptions {
  readonly isTraefikNonAuthOptionsEnabled?: boolean;
  readonly rule?: string;
  readonly backendMiddlewares?: string;
  readonly replacepath?: string;
}

export interface TraefikReplaceAuthOptions {
  readonly isTraefikReplaceAuthOptionsEnabled?: boolean;
  readonly rule?: string;
  readonly backendMiddlewares?: string;
  readonly replacepath?: string;
  readonly replacepathRegex?: string;
}

export interface TraefikShieldAuthOptions {
  readonly isTraefikShieldAuthOptionsEnabled?: boolean;
  readonly rule?: string;
  readonly interfaceRule?: string;
}

export interface TraefikServiceConfigOptionals
  extends giac.ServiceConfigOptionals {
  readonly isTraefikServiceConfigOptionals: true;
  readonly isProxyEnabled: boolean;
  readonly isSecure?: boolean;
  readonly isCors?: boolean;
  readonly isForwardAuth?: boolean;
  readonly isNonAuth?: boolean;
  readonly isReplaceAuth?: boolean;
  readonly isReplaceWithShield?: boolean;
  readonly isShieldAuth?: boolean;
  readonly isNoServiceName?: boolean;
  readonly isCheckeMailExists?: Boolean;
  readonly isPathPrefix?: Boolean;
  readonly routerOptions?: TraefikRouterOptions;
  readonly corsOptions?: TraefikCorsOptions;
  readonly forwardAuthOptions?: TraefikForwardAuthOptions;
  readonly nonAuthOptions?: TraefikNonAuthOptions;
  readonly replaceAuthOptions?: TraefikReplaceAuthOptions;
  readonly shieldAuthOptions?: TraefikShieldAuthOptions;
}

export interface ReverseProxyTargetOptions {
  readonly isReverseProxyTargetOptionsEnabled: boolean;
  readonly isCors?: boolean;
  readonly isForwardAuth?: boolean;
  readonly isNonAuth?: boolean;
  readonly isReplaceAuth?: boolean;
  readonly isReplaceWithShield?: boolean;
  readonly isShieldAuth?: boolean;
  readonly isNoServiceName?: boolean;
  readonly isCheckeMailExists?: boolean;
  readonly isPathPrefix?: boolean;
}

export interface ReverseProxyTarget {
  readonly isReverseProxyTarget: true;
  readonly isProxyEnabled: boolean;
  readonly proxyTargetConfig: giac.ServiceConfig;
  readonly proxyTargetValues?: ReverseProxyTargetValuesSupplier;
  readonly proxyTargetOptions?: ReverseProxyTargetOptions;
}

export const isReverseProxyTarget = safety.typeGuard<ReverseProxyTarget>(
  "isReverseProxyTarget",
);

export type ProxiedPort = number | undefined;

export interface ReverseProxyTargetValuesSupplierConstructor {
  new (ctx: giac.ConfigContext): ReverseProxyTargetValuesSupplier;
}

export interface ReverseProxyTargetValuesSupplier {
  readonly isReverseProxyTargetValuesSupplier: true;
  proxiedServiceName?(ctx: giac.ConfigContext, sc: giac.ServiceConfig): string;
  proxiedHostName?(ctx: giac.ConfigContext, sc: giac.ServiceConfig): string;
  proxiedPort?(ctx: giac.ConfigContext, sc: giac.ServiceConfig): ProxiedPort;
}

export const isReverseProxyTargetValuesSupplier = safety.typeGuard<
  ReverseProxyTargetValuesSupplier
>("isReverseProxyTargetValuesSupplier");

export class ReverseProxyServiceConfig extends TypicalImmutableServiceConfig {
  readonly isServiceConfig = true;
  readonly image = "traefik:2.2";
  readonly command: readonly vm.Value[];
  readonly ports: giac.ServicePortsConfig;
  readonly engineListener: giac.ServiceEngineListenerConfig;
  readonly isProxyEnabled = false;
  readonly proxySupplier: ReverseProxyTargetValuesSupplier;
  readonly volumes?: giac.ServiceVolumeConfig[];
  readonly extraHosts?: vm.TextValue[];
  readonly initDbVolume?: giac.ServiceVolumeLocalFsPathConfig;

  constructor(
    ctx: giac.ConfigContext,
    proxySupplier: ReverseProxyTargetValuesSupplier,
    optionals?: giac.ServiceConfigOptionals,
    isSecure?: boolean | undefined,
    extraHosts?: vm.TextValue[],
  ) {
    super({ serviceName: "reverse-proxy", ...optionals });
    this.proxySupplier = proxySupplier;
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
    this.engineListener = giac.defaultServiceEngineListener();
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
      this.initDbVolume = {
        localFsPath: (ctx: cm.Context) => {
          const pp = cm.isProjectContext(ctx) ? ctx.projectPath : ".";
          return `${pp}/acme.json`;
        },
        containerFsPath: "/acme.json",
        isReadOnly: false,
      };
      this.volumes = [
        this.initDbVolume,
      ];
      ctx.envVars.requiredEnvVar(
        "LETSENCRYPT_SSL_EMAIL_ID",
        "Email id for ACME Let's Encrypt certificates for https endpoints",
      );
    } else {
      this.command = [
        "--providers.docker",
        "--providers.docker.endpoint=unix:///var/run/docker.sock",
        "--providers.docker.exposedByDefault=false",
        "--api.dashboard=true",
        "--api.insecure=true",
        "--entrypoints.http.address=:80",
        "--entryPoints.http.forwardedHeaders.insecure",
      ];
    }
    this.ports = [
      giac.portsFactory.publishSingle(80),
      giac.portsFactory.publishSingle(443),
      giac.portsFactory.publishSingle(8099, 8080),
    ];
  }

  targetService(
    ctx: giac.ConfigContext,
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
    ctx: giac.ConfigContext,
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
    ctx: giac.ConfigContext,
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
    ctx: giac.ConfigContext,
    rpt: ReverseProxyTarget,
    rptOptionals?: TraefikServiceConfigOptionals,
  ): void {
    const sc = rpt.proxyTargetConfig;
    const rpServiceName = this.targetService(ctx, rpt);
    if (rptOptionals) {
      if (rptOptionals?.isSecure == true) {
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
            if (ho.tlsCertresolver) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName + ".tls.certresolver",
                ho.tlsCertresolver,
              );
            }
            if (rptOptionals?.isReplaceAuth == true) {
              if (rptOptionals?.replaceAuthOptions) {
                const ra = rptOptionals?.replaceAuthOptions;
                if (rptOptionals?.isReplaceWithShield) {
                  sc.applyLabel(
                    "traefik.http.routers." + rpServiceName + ".rule",
                    "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)" +
                      " && PathPrefix(`/shield/api`)",
                  );
                } else {
                  sc.applyLabel(
                    "traefik.http.routers." + rpServiceName + ".rule",
                    "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)" +
                      " && PathPrefix(`/api`)",
                  );
                }
                if (ra.backendMiddlewares) {
                  sc.applyLabel(
                    "traefik.http.routers." + rpServiceName +
                      ".middlewares",
                    ra.backendMiddlewares + "-" + rpServiceName,
                  );
                }
                if (ra.replacepathRegex) {
                  sc.applyLabel(
                    "traefik.http.middlewares." + ra.backendMiddlewares +
                      "-" + rpServiceName +
                      ".replacepathRegex.regex",
                    ra.replacepathRegex,
                  );
                }
                if (ra.replacepath) {
                  sc.applyLabel(
                    "traefik.http.middlewares." + ra.backendMiddlewares +
                      "-" + rpServiceName +
                      ".replacepathRegex.replacement",
                    ra.replacepath,
                  );
                }
              }
            } else if (rptOptionals?.isShieldAuth == true) {
              if (rptOptionals?.shieldAuthOptions) {
                const sa = rptOptionals?.shieldAuthOptions;
                if (ho.tlsCertresolver) {
                  sc.applyLabel(
                    "traefik.http.routers." + rpServiceName + "Interface" +
                      ".tls.certresolver",
                    ho.tlsCertresolver,
                  );
                }
                sc.applyLabel(
                  "traefik.http.routers." + rpServiceName + ".rule",
                  "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)" +
                    " && Path(`/shield/graphql`)",
                );
                sc.applyLabel(
                  "traefik.http.routers." + rpServiceName + "Interface" +
                    ".rule",
                  "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)" +
                    " && Path(`/shield/graphiql`)",
                );
              }
            } else if (rptOptionals?.isNoServiceName == true) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName + ".rule",
                "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)",
              );
            } else if (rptOptionals?.isCheckeMailExists == true) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName + ".rule",
                "Host(`email.validation.infra.${EP_FQDNSUFFIX:-docker.localhost}`)",
              );
            } else if (rptOptionals?.isPathPrefix == true) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName + ".rule",
                "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)" +
                  " && PathPrefix(`/doc/open-api`)",
              );
            } else {
              if (ho.rule) {
                sc.applyLabel(
                  "traefik.http.routers." + rpServiceName + ".rule",
                  ho.rule,
                );
              }
            }
          }
        }
      } else {
        if (rptOptionals?.isReplaceAuth == true) {
          if (rptOptionals?.replaceAuthOptions) {
            const ra = rptOptionals?.replaceAuthOptions;
            if (rptOptionals?.isReplaceWithShield) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName + ".rule",
                "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)" +
                  " && PathPrefix(`/shield/api`)",
              );
            } else {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName + ".rule",
                "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)" +
                  " && PathPrefix(`/api`)",
              );
            }
            if (ra.backendMiddlewares) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName +
                  ".middlewares",
                ra.backendMiddlewares + "-" + rpServiceName,
              );
            }
            if (ra.replacepathRegex) {
              sc.applyLabel(
                "traefik.http.middlewares." + ra.backendMiddlewares +
                  "-" + rpServiceName +
                  ".replacepathRegex.regex",
                ra.replacepathRegex,
              );
            }
            if (ra.replacepath) {
              sc.applyLabel(
                "traefik.http.middlewares." + ra.backendMiddlewares +
                  "-" + rpServiceName +
                  ".replacepathRegex.replacement",
                ra.replacepath,
              );
            }
          }
        } else if (rptOptionals?.isShieldAuth == true) {
          if (rptOptionals?.shieldAuthOptions) {
            const sa = rptOptionals?.shieldAuthOptions;
            sc.applyLabel(
              "traefik.http.routers." + rpServiceName + ".rule",
              "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)" +
                " && Path(`/shield/graphql`)",
            );
            sc.applyLabel(
              "traefik.http.routers." + rpServiceName + "Interface" + ".rule",
              "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)" +
                " && Path(`/shield/graphiql`)",
            );
          }
        } else if (rptOptionals?.isNoServiceName == true) {
          sc.applyLabel(
            "traefik.http.routers." + rpServiceName + ".rule",
            "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)",
          );
        } else if (rptOptionals?.isCheckeMailExists == true) {
          sc.applyLabel(
            "traefik.http.routers." + rpServiceName + ".rule",
            "Host(`email.validation.infra.${EP_FQDNSUFFIX:-docker.localhost}`)",
          );
        } else if (rptOptionals?.isPathPrefix == true) {
          sc.applyLabel(
            "traefik.http.routers." + rpServiceName + ".rule",
            "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`)" +
              " && PathPrefix(`/doc/open-api`)",
          );
        } else {
          sc.applyLabel(
            "traefik.http.routers." + rpServiceName + ".rule",
            "Host(`" + this.targetHost(ctx, rpt) + "`)",
          );
        }
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
      if (
        rptOptionals?.isCors == true && rptOptionals?.isForwardAuth == true
      ) {
        if (
          rptOptionals?.corsOptions && rptOptionals?.forwardAuthOptions
        ) {
          const co = rptOptionals?.corsOptions;
          const fo = rptOptionals?.forwardAuthOptions;
          if (
            co.backendMiddlewares && fo.backendMiddlewares
          ) {
            sc.applyLabel(
              "traefik.http.routers." + rpServiceName +
                ".middlewares",
              rpServiceName + co.backendMiddlewares + ", " + rpServiceName +
                fo.backendMiddlewares,
            );
          }
        }
      }
      if (rptOptionals?.isCors == true) {
        if (rptOptionals?.corsOptions) {
          const co = rptOptionals?.corsOptions;
          if (rptOptionals?.isForwardAuth != true) {
            if (co.backendMiddlewares) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName +
                  ".middlewares",
                rpServiceName + co.backendMiddlewares,
              );
            }
          }
          if (co.accessControlAllowHeaders) {
            sc.applyLabel(
              "traefik.http.middlewares." + rpServiceName +
                "-cors.headers.customresponseheaders.Access-Control-Allow-Headers",
              co.accessControlAllowHeaders,
            );
          }
          if (co.accessControlAllowMethods) {
            sc.applyLabel(
              "traefik.http.middlewares." + rpServiceName +
                "-cors.headers.customresponseheaders.Access-Control-Allow-Methods",
              co.accessControlAllowMethods,
            );
          }
          if (co.accessControlAllowOrigin) {
            sc.applyLabel(
              "traefik.http.middlewares." + rpServiceName +
                "-cors.headers.customresponseheaders.Access-Control-Allow-Origin",
              co.accessControlAllowOrigin,
            );
          }
        }
      }
      if (rptOptionals?.isForwardAuth == true) {
        if (rptOptionals?.forwardAuthOptions) {
          const fo = rptOptionals?.forwardAuthOptions;
          if (rptOptionals?.isCors != true) {
            if (fo.backendMiddlewares) {
              sc.applyLabel(
                "traefik.http.routers." + rpServiceName +
                  ".middlewares",
                rpServiceName + fo.backendMiddlewares,
              );
            }
          }
          if (fo.trustForwardHeader) {
            sc.applyLabel(
              "traefik.http.middlewares." + rpServiceName +
                "-auth.forwardauth.trustForwardHeader",
              fo.trustForwardHeader,
            );
          }
          if (fo.address) {
            sc.applyLabel(
              "traefik.http.middlewares." + rpServiceName +
                "-auth.forwardauth.address",
              fo.address,
            );
          }
        }
      }
      if (rptOptionals?.isNonAuth == true) {
        if (rptOptionals?.nonAuthOptions) {
          const no = rptOptionals?.nonAuthOptions;
          if (no.rule) {
            sc.applyLabel(
              "traefik.http.routers." + rpServiceName + "NonAuth" +
                ".rule",
              no.rule,
            );
          }
          if (no.backendMiddlewares) {
            sc.applyLabel(
              "traefik.http.routers." + rpServiceName + "NonAuth" +
                ".middlewares",
              no.backendMiddlewares,
            );
          }
          if (no.replacepath) {
            sc.applyLabel(
              "traefik.http.middlewares." + no.backendMiddlewares +
                ".replacepath.path",
              no.replacepath,
            );
          }
        }
      }
    }
  }

  traefikRouterOptions(
    cfxContext: giac.ConfigContext,
    rpt: ReverseProxyTarget,
    isSecure?: boolean,
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

  traefikCorsOptions(
    isCors?: boolean,
  ): TraefikCorsOptions {
    return isCors
      ? {
        isTraefikCorsOptionsEnabled: true,
        backendMiddlewares: "-cors",
        accessControlAllowHeaders: "*",
        accessControlAllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        accessControlAllowOrigin: "*",
      }
      : {
        isTraefikCorsOptionsEnabled: false,
      };
  }

  traefikForwardAuthOptions(
    isForwardAuth?: boolean,
    isSecure?: boolean,
  ): TraefikForwardAuthOptions {
    return isForwardAuth
      ? {
        isTraefikForwardAuthOptionsEnabled: true,
        backendMiddlewares: "-auth",
        trustForwardHeader: true,
        address: isSecure
          ? "https://${EP_EXECENV:-sandbox}.jwt-validator.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}/token"
          : "http://${EP_EXECENV:-sandbox}.jwt-validator.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}/token",
      }
      : {
        isTraefikForwardAuthOptionsEnabled: false,
      };
  }

  traefikNonAuthOptions(
    isNonAuth?: boolean,
  ): TraefikNonAuthOptions {
    return isNonAuth
      ? {
        isTraefikNonAuthOptionsEnabled: true,
        rule:
          "Host(`${EP_EXECENV:-sandbox}.postGraphile.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`) && (Path(`/anonymousgraphql`))",
        backendMiddlewares: "replacepath-middleware",
        replacepath: "/graphql",
      }
      : {
        isTraefikNonAuthOptionsEnabled: false,
      };
  }

  traefikReplaceAuthOptions(
    isReplaceAuth?: boolean,
    isReplaceWithShield?: boolean,
  ): TraefikReplaceAuthOptions {
    if (isReplaceWithShield) {
      return isReplaceAuth
        ? {
          isTraefikReplaceAuthOptionsEnabled: true,
          rule:
            "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`) && PathPrefix(`/shield/api`)",
          backendMiddlewares: "replacepath-middleware",
          replacepath: "$$1",
          replacepathRegex: "^/shield/api(.*)",
        }
        : {
          isTraefikReplaceAuthOptionsEnabled: false,
        };
    } else {
      return isReplaceAuth
        ? {
          isTraefikReplaceAuthOptionsEnabled: true,
          rule:
            "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`) && PathPrefix(`/api`)",
          backendMiddlewares: "replacepath-middleware",
          replacepath: "$$1",
          replacepathRegex: "^/api(.*)",
        }
        : {
          isTraefikReplaceAuthOptionsEnabled: false,
        };
    }
  }

  traefikShieldAuthOptions(
    isShieldAuth?: boolean,
  ): TraefikShieldAuthOptions {
    return isShieldAuth
      ? {
        isTraefikShieldAuthOptionsEnabled: true,
        rule:
          "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`) && Path(`/shield/graphql`)",
        interfaceRule:
          "Host(`${EP_EXECENV:-sandbox}.${EP_BOUNDARY:-appx}.${EP_FQDNSUFFIX:-docker.localhost}`) && Path(`/shield/graphql`)",
      }
      : {
        isTraefikShieldAuthOptionsEnabled: false,
      };
  }

  traefikServiceConfigOptionals(
    ctx: giac.ConfigContext,
    rpt: ReverseProxyTarget,
    isSecure?: boolean,
    isCors?: boolean,
    isForwardAuth?: boolean,
    isNonAuth?: boolean,
    isReplaceAuth?: boolean,
    isReplaceWithShield?: boolean,
    isShieldAuth?: boolean,
    isNoServiceName?: boolean,
    isCheckeMailExists?: boolean,
    isPathPrefix?: boolean,
  ): TraefikServiceConfigOptionals {
    const traefikServiceConfigOptionals: TraefikServiceConfigOptionals = {
      isTraefikServiceConfigOptionals: true,
      isProxyEnabled: true,
      isSecure: isSecure,
      isCors: isCors,
      isForwardAuth: isForwardAuth,
      isNonAuth: isNonAuth,
      isReplaceAuth: isReplaceAuth,
      isReplaceWithShield: isReplaceWithShield,
      isShieldAuth: isShieldAuth,
      isNoServiceName: isNoServiceName,
      isCheckeMailExists: isCheckeMailExists,
      isPathPrefix: isPathPrefix,
      routerOptions: this.traefikRouterOptions(ctx, rpt, isSecure),
      corsOptions: this.traefikCorsOptions(isCors),
      forwardAuthOptions: this.traefikForwardAuthOptions(
        isForwardAuth,
        isSecure,
      ),
      nonAuthOptions: this.traefikNonAuthOptions(
        isNonAuth,
      ),
      replaceAuthOptions: this.traefikReplaceAuthOptions(
        isReplaceAuth,
        isReplaceWithShield,
      ),
      shieldAuthOptions: this.traefikShieldAuthOptions(
        isShieldAuth,
      ),
    };
    return traefikServiceConfigOptionals;
  }

  persistRelatedArtifacts(
    ctx: giac.ConfigContext,
    ph: ap.PersistenceHandler,
    er?: giac.OrchestratorErrorReporter,
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
    ctx: giac.ConfigContext,
    proxySupplier: ReverseProxyTargetValuesSupplier,
    optionals?: giac.ServiceConfigOptionals,
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
        ctx: giac.ConfigContext,
        rpt: ReverseProxyTarget,
      ): void => {
        if (rpt.isProxyEnabled) {
          if (
            rpt.proxyTargetOptions &&
            rpt.proxyTargetOptions.isReverseProxyTargetOptionsEnabled
          ) {
            result.registerTarget(
              ctx,
              rpt,
              result.traefikServiceConfigOptionals(
                ctx,
                rpt,
                isSecure,
                rpt.proxyTargetOptions.isCors,
                rpt.proxyTargetOptions.isForwardAuth,
                rpt.proxyTargetOptions.isNonAuth,
                rpt.proxyTargetOptions.isReplaceAuth,
                rpt.proxyTargetOptions.isReplaceWithShield,
                rpt.proxyTargetOptions.isShieldAuth,
                rpt.proxyTargetOptions.isNoServiceName,
                rpt.proxyTargetOptions.isCheckeMailExists,
                rpt.proxyTargetOptions.isPathPrefix,
              ),
            );
          } else {
            result.registerTarget(
              ctx,
              rpt,
              result.traefikServiceConfigOptionals(
                ctx,
                rpt,
                isSecure,
              ),
            );
          }
        }
      },
    );
    return ctx.configured(result);
  }
})();
