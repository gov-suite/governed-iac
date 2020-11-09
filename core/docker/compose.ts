// deno-lint-ignore-file

import type { ConfigContext } from "../context.ts";
import {
  artfPersist as ap,
  encodingYAML as yaml,
  polyglotArtfNature,
  testingAsserts as ta,
  valueMgr as vm,
} from "../deps.ts";
import type * as img from "../image.ts";
import type * as orch from "../orchestrator.ts";
import * as ports from "../ports.ts";
import {
  ConfiguredServices,
  isServiceBuildConfig,
  isServiceVolumeEngineStoreConfig,
  isServiceVolumeLocalFsPathConfig,
  isServiceVolumeMutable,
  ServiceBuildConfig,
  ServiceConfig,
  ServiceNetworkConfig,
  ServiceVolumeEngineStoreConfig,
} from "../service.ts";
import type * as de from "./engine.ts";

export const DEFAULT_COMPOSE_FILE_NAME: orch.OrchestratorName =
  "docker-compose.yaml";

export enum PersistRelatedComposeArtifactsResult {
  PersistRelatedServiceConfigArtifacts,
  DontPersistRelatedServiceConfigArtifacts,
}

export interface PersistRelatedComposeArtifacts {
  (
    ctx: ConfigContext,
    dc: DockerCompose,
    ph: ap.PersistenceHandler,
    er?: orch.OrchestratorErrorReporter,
  ): PersistRelatedComposeArtifactsResult;
}

export interface DockerComposeOptions {
  readonly name: orch.OrchestratorName;
  readonly configuredServices: ConfiguredServices;
  readonly buildContext: vm.TextValue;
  prePersistFinalizer?: (
    ctx: ConfigContext,
    composed: Record<string, unknown>,
  ) => Record<string, unknown>;
  persistRelatedArtifacts?: PersistRelatedComposeArtifacts;
}

export class DockerCompose implements orch.Orchestrator {
  readonly isOrchestrator: true = true;
  readonly volumes: ServiceVolumeEngineStoreConfig[] = [];
  readonly networks: ServiceNetworkConfig[] = [];
  readonly builds: ServiceBuildConfig[] = [];
  readonly name: orch.OrchestratorName;

  constructor(
    readonly engine: de.Docker,
    readonly options: DockerComposeOptions,
  ) {
    this.name = options.name;
  }

  preamble(ctx: ConfigContext): string[] {
    const result: string[] = [];
    for (const vol of this.volumes) {
      if (isServiceVolumeMutable(vol) && vol.mutable) {
        result.push(`#   ${vol.localVolName}: ${vol.mutable.contentType}`);
      }
    }
    if (result.length > 0) {
      result.unshift("# Mutable volumes to be mindful of:");
    }
    const volumeComments = result.length;

    for (const ev of ctx.envVars.required) {
      result.push(`#   * ${ev.qualifiedName(ctx)} - ${ev.purpose} (required)`);
    }
    for (const ev of ctx.envVars.defaulted) {
      result.push(
        `#   * ${
          ev.qualifiedName(ctx)
        } - ${ev.purpose} (default ${ev.defaultValue})`,
      );
    }
    if (result.length > volumeComments) {
      result.splice(volumeComments, 0, "#", "# Environment variables allowed:");
    }
    return [...result, "\n"];
  }

  persist(
    ctx: ConfigContext,
    ph: ap.PersistenceHandler,
    er?: orch.OrchestratorErrorReporter,
  ): void {
    let composed = this.toCompose(ctx, er);
    if (this.options.prePersistFinalizer) {
      composed = this.options.prePersistFinalizer(ctx, composed);
    }

    const store = ph.createMutableTextArtifact(ctx, {
      nature: polyglotArtfNature.yamlArtifact,
      preamble: vm.resolveTextValue(
        ctx,
        polyglotArtfNature.yamlArtifact.defaultPreamble,
      ) +
        this.preamble(ctx).join("\n"),
    });
    store.appendText(ctx, yaml.stringify(composed));
    ph.persistTextArtifact(ctx, this.name, store);

    for (const build of this.builds) {
      let ier: img.ImageErrorReporter | undefined = undefined;
      if (er) {
        ier = (o: img.Image, msg: string): void => {
          er(this, msg);
        };
      }
      build.dockerFile.persist(ctx, ph, ier);
    }

    this.persistRelated(ctx, ph, er);
  }

  protected persistRelated(
    ctx: ConfigContext,
    ph: ap.PersistenceHandler,
    er?: orch.OrchestratorErrorReporter,
  ): void {
    const options = this.options;
    let persistRelatedServiceConfigArtifacts = true;
    if (options.persistRelatedArtifacts) {
      persistRelatedServiceConfigArtifacts =
        options.persistRelatedArtifacts(ctx, this, ph, er) ==
          PersistRelatedComposeArtifactsResult
            .PersistRelatedServiceConfigArtifacts;
    }
    if (persistRelatedServiceConfigArtifacts) {
      options.configuredServices.forEachService((outerSC: ServiceConfig) => {
        if (outerSC.persistRelatedArtifacts) {
          outerSC.persistRelatedArtifacts(ctx, ph, er);
        }
        if (outerSC.persistOtherRelatedArtifacts) {
          options.configuredServices.forEachService(
            (innerSC: ServiceConfig) => {
              if (innerSC != outerSC) {
                outerSC.persistOtherRelatedArtifacts!(ctx, innerSC, ph, er);
              }
            },
          );
        }
      });
    }
  }

  protected toComposeServiceContainerName(
    ctx: ConfigContext,
    sc: ServiceConfig,
    service: { [k: string]: any },
  ) {
    if (sc.containerName) {
      service.container_name = vm.resolveTextValue(
        ctx,
        sc.containerName,
        sc,
        this,
      );
    }
  }

  protected toComposeServiceHostName(
    ctx: ConfigContext,
    sc: ServiceConfig,
    service: { [k: string]: any },
  ) {
    if (sc.hostName) {
      service.hostname = vm.resolveTextValue(
        ctx,
        sc.hostName,
        sc,
        this,
      );
    }
  }

  protected toComposeServicePort(
    ctx: ConfigContext,
    sc: ServiceConfig,
    port: ports.ServiceSinglePortConfig,
    service: { [k: string]: any },
  ) {
    if (ports.isServicePublishPortConfig(port)) {
      const published = vm.resolveNumericValueAsText(
        ctx,
        port.published,
        sc,
        this,
      );
      const inContainer = vm.resolveNumericValueAsText(
        ctx,
        port.target,
        sc,
        this,
      );
      if (!port.mode && !port.protocol) {
        if (!service.ports) service.ports = [];
        service.ports.push(`${published}:${inContainer}`);
      } else if (port.protocol) {
        if (!service.ports) service.ports = [];
        service.ports.push(`${published}:${inContainer}/${port.protocol}`);
      } else {
        throw new Error("Not available yet, need to implement.");
      }
    } else {
      const target = vm.resolveNumericValueAsText(ctx, port.target, sc, this);
      if (!service.expose) service.expose = [];
      service.expose.push(target);
    }
  }

  protected toComposeServicePorts(
    ctx: ConfigContext,
    sc: ServiceConfig,
    service: { [k: string]: any },
  ) {
    if (sc.ports) {
      if (ports.isServiceSinglePortConfig(sc.ports)) {
        this.toComposeServicePort(ctx, sc, sc.ports, service);
      } else {
        for (const port of sc.ports) {
          this.toComposeServicePort(ctx, sc, port, service);
        }
      }
    }
  }

  protected toComposeServiceDependsOn(
    ctx: ConfigContext,
    sc: ServiceConfig,
    service: { [k: string]: any },
  ) {
    if (sc.dependsOn && sc.dependsOn.length > 0) {
      const dependsOn: string[] = [];
      for (const depOn of sc.dependsOn) {
        dependsOn.push(vm.resolveTextValue(ctx, depOn.serviceName, sc, this));
      }
      service.depends_on = dependsOn;
    }
  }

  protected toComposeServiceEnvironment(
    ctx: ConfigContext,
    sc: ServiceConfig,
    service: { [k: string]: any },
  ) {
    if (
      sc.environment &&
      Object.getOwnPropertyNames(sc.environment).length > 0
    ) {
      const envVars: { [k: string]: string | number } = {};
      Object.entries(sc.environment).forEach((entry: [string, any]) => {
        const key = entry[0];
        const value = vm.resolveValue(ctx, entry[1], sc, this);
        switch (typeof value) {
          case "string":
          case "number":
            envVars[key] = value;
            break;

          default:
            envVars[key] = (value as any).toString();
        }
      });
      service.environment = envVars;
    }
  }

  protected toComposeServiceVolumes(
    ctx: ConfigContext,
    sc: ServiceConfig,
    service: { [k: string]: any },
    er?: orch.OrchestratorErrorReporter,
  ): void {
    const volumes: string[] = [];
    if (sc.engineListener) {
      volumes.push("/var/run/docker.sock:/var/run/docker.sock");
    }
    if (sc.volumes) {
      for (const vol of sc.volumes) {
        const readOnly = isServiceVolumeMutable(vol) ? "" : ":ro";
        if (isServiceVolumeLocalFsPathConfig(vol)) {
          volumes.push(
            `${vm.resolveTextValue(ctx, vol.localFsPath, this)}:${
              vm.resolveTextValue(
                ctx,
                vol.containerFsPath,
                sc,
                this,
              )
            }${readOnly}`,
          );
        } else if (isServiceVolumeEngineStoreConfig(vol)) {
          volumes.push(
            `${
              vm.resolveTextValue(
                ctx,
                vol.localVolName,
                this,
              )
            }:${
              vm.resolveTextValue(
                ctx,
                vol.containerFsPath,
                sc,
                this,
              )
            }${readOnly}`,
          );
        } else {
          if (er) {
            er(
              this,
              `Unknown volume type in service ${sc.serviceName}: ${vol}`,
            );
          }
        }
      }
    }
    if (volumes.length > 0) service.volumes = volumes;
  }

  protected toComposeServiceExtraHosts(
    ctx: ConfigContext,
    sc: ServiceConfig,
    service: { [k: string]: any },
  ) {
    if (sc.extraHosts) {
      const extraHosts: string[] = [];
      for (const c of sc.extraHosts) {
        extraHosts.push((vm.resolveValue(ctx, c, sc, this) as any).toString());
      }
      service.extra_hosts = extraHosts;
    }
  }

  protected toComposeServiceCommand(
    ctx: ConfigContext,
    sc: ServiceConfig,
    service: { [k: string]: any },
  ) {
    if (sc.command) {
      const command: string[] = [];
      for (const c of sc.command) {
        command.push((vm.resolveValue(ctx, c, sc, this) as any).toString());
      }
      service.command = command;
    }
  }

  protected toComposeServiceNetworks(
    ctx: ConfigContext,
    sc: ServiceConfig,
    service: { [k: string]: any },
  ) {
    if (sc.networks && sc.networks.length > 0) {
      const networks: string[] = [];
      for (const n of sc.networks) {
        networks.push(vm.resolveTextValue(ctx, n.localName, sc, this));
      }
      service.networks = networks;
    }
  }

  protected toComposeServiceImage(
    ctx: ConfigContext,
    sc: ServiceConfig,
    service: { [k: string]: any },
  ) {
    if (isServiceBuildConfig(sc.image)) {
      const build: { [k: string]: any } = {};
      build.context = vm.resolveTextValue(
        ctx,
        this.options.buildContext,
        sc.image.dockerFile.imageName,
        sc.image,
      );
      build.dockerfile = vm.resolveTextValue(
        ctx,
        sc.image.dockerFile.imageName,
        sc.image,
      );
      service.build = build;
      ta.assert(sc.containerName);
      service.image = (
        vm.resolveTextValue(ctx, sc.containerName, sc, this) + ":latest"
      ).toLocaleLowerCase(); // Docker requires lowercase image names
    } else {
      service.image = vm.resolveTextValue(ctx, sc.image, sc);
    }
  }

  public initConfig(
    ctx: ConfigContext,
    er?: orch.OrchestratorErrorReporter,
  ): void {
    let serviceIndex = 0;
    this.options.configuredServices.forEachService((svc: ServiceConfig) => {
      if (isServiceBuildConfig(svc.image)) this.builds.push(svc.image);
      if (svc.networks) this.networks.push(...svc.networks);
      if (svc.volumes) {
        for (const vol of svc.volumes) {
          if (isServiceVolumeEngineStoreConfig(vol)) {
            if (!vol.engineVolName) {
              this.volumes.push({
                ...vol,
                engineVolName: vm.resolveTextValue(
                  ctx,
                  ctx.name,
                  this,
                ),
              });
            } else this.volumes.push(vol);
          }
        }
      }

      serviceIndex++;
    });
  }

  public toCompose(
    ctx: ConfigContext,
    er?: orch.OrchestratorErrorReporter,
  ): Record<string, unknown> {
    this.initConfig(ctx, er);
    let result: {
      version: string;
      services: { [k: string]: any };
      [k: string]: any;
    } = {
      version: this.engine.version.composeFileFormat,
      services: {},
    };
    this.options.configuredServices.forEachService((sc: ServiceConfig) => {
      ta.assert(sc.serviceName);
      let service: { [k: string]: any } = {};

      this.toComposeServiceContainerName(ctx, sc, service);
      this.toComposeServiceHostName(ctx, sc, service);
      this.toComposeServiceImage(ctx, sc, service);
      if (sc.restart) {
        service.restart = vm.resolveTextValue(ctx, sc.restart, sc, this);
      }
      this.toComposeServicePorts(ctx, sc, service);
      this.toComposeServiceDependsOn(ctx, sc, service);
      this.toComposeServiceEnvironment(ctx, sc, service);
      this.toComposeServiceVolumes(ctx, sc, service, er);
      this.toComposeServiceExtraHosts(ctx, sc, service);
      this.toComposeServiceNetworks(ctx, sc, service);
      this.toComposeServiceCommand(ctx, sc, service);
      if (Object.getOwnPropertyNames(sc.labels).length > 0) {
        service.labels = sc.labels;
      }

      result.services[
        vm.resolveTextValue(ctx, sc.serviceName, sc, this)
      ] = service;
    });

    if (this.networks.length > 0) {
      result.networks = {} as { [k: string]: { external: { name: string } } };
      for (const n of this.networks) {
        const localName = vm.resolveTextValue(ctx, n.localName, n, this);
        const externalName = vm.resolveTextValue(ctx, n.externalName, n, this);
        if (!result.networks[localName]) {
          result.networks[localName] = {
            external: {
              name: externalName,
            },
          };
        }
      }
    }

    if (this.volumes.length > 0) {
      result.volumes = {} as { [k: string]: {} };
      for (const v of this.volumes) {
        ta.assert(v.engineVolName);
        const localName = vm.resolveTextValue(ctx, v.localVolName, v, this);
        if (!result.volumes[localName]) {
          result.volumes[localName] = {};
        }
      }
    }

    return result;
  }

  isValid(ctx: ConfigContext, er?: orch.OrchestratorErrorReporter): boolean {
    return true;
  }

  registryKeys(ctx: ConfigContext): orch.OrchestratorRegistryKeys {
    return [this.name];
  }
}
