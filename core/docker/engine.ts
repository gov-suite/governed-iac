import {
  contextMgr as cm,
  valueMgr as vm,
} from "../deps.ts";
import type * as eng from "../engine.ts";
import type * as gr from "../graph.ts";
import type * as img from "../image.ts";
import * as svc from "../service.ts";
import * as dc from "./compose.ts";
import * as df from "./dockerfile.ts";

export const engineVersions: DockerEngineVersion[] = [
  {
    engineRelease: new RegExp("19.[0-9][0-9].[0-9]+"),
    composeFileFormat: "3.3",
  },
  {
    engineRelease: new RegExp("18.[0-9][0-9].[0-9]+"),
    composeFileFormat: "3.3",
  },
];
export const latestDockerVersion = engineVersions[0];

export enum ContainerRestartStrategy {
  No = "no",
  Always = "always",
  OnFailure = "on-failure",
  UnlessStopped = "unless-stopped",
}

export function isDocker(c: unknown): c is Docker {
  return c && typeof c === "object" && "isDocker" in c;
}

export type DockerEngineRelease = RegExp;
export type DockerComposeFileFormat = string;

export interface DockerEngineVersion {
  readonly engineRelease: DockerEngineRelease;
  readonly composeFileFormat: DockerComposeFileFormat;
}

export type DockerNetworkName = vm.TextValue;

export class Docker implements eng.Engine, gr.Graph {
  readonly isEngine = true;
  readonly isGraph = true;
  readonly engineName = "Docker";
  readonly isDockerEngine = true;
  readonly images: df.Dockerfile[] = [];
  readonly orchestrators: dc.DockerCompose[] = [];

  constructor(
    readonly graphName: gr.GraphName,
    readonly version: DockerEngineVersion,
  ) {}

  public forEachImage(fn: gr.ImageHandler): void {
    for (const image of this.images) {
      fn(this, image);
    }
  }

  public forEachOrchestrator(fn: gr.OrchestratorHandler): void {
    for (const orchestrator of this.orchestrators) {
      fn(this, orchestrator);
    }
  }

  registryKeys(ctx: cm.Context): eng.EngineRegistryKeys {
    return [vm.resolveTextValue(ctx, this.graphName, this)];
  }

  public createDockerfile(
    instructions: img.Instructions,
    name?: img.ImageName,
  ): df.Dockerfile {
    const dckf = new df.Dockerfile(
      name ? name : df.DEFAULT_FILE_NAME,
      instructions,
    );
    this.images.push(dckf);
    return dckf;
  }

  public defaultDockerCommonNetworks(): svc.ServiceNetworkConfig[] {
    return [
      {
        localName: "network",
        externalName: svc.DEFAULT_COMMON_NETWORK_NAME,
      },
    ];
  }

  public defaultDockerEngineVolume(
    containerFsPath: vm.TextValue,
  ): svc.ServiceVolumeEngineStoreConfig {
    return {
      localVolName: "storage",
      containerFsPath: containerFsPath,
    };
  }

  public defaultServiceVolumes(
    containerFsPath: vm.TextValue,
  ): svc.ServiceVolumeConfig[] {
    return [this.defaultDockerEngineVolume(containerFsPath)];
  }

  public createDockerCompose(
    options: dc.DockerComposeOptions,
  ): dc.DockerCompose {
    const instance = new dc.DockerCompose(this, options);
    this.orchestrators.push(instance);
    return instance;
  }
}
