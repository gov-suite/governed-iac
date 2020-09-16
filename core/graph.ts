import * as de from "./docker/engine.ts";
import type * as img from "./image.ts";
import type * as orch from "./orchestrator.ts";
import type { valueMgr as vm } from "./deps.ts";

export type GraphName = vm.TextValue;

export interface ImageHandler {
  (graph: Graph, image: img.Image): void;
}

export interface OrchestratorHandler {
  (graph: Graph, orch: orch.Orchestrator): void;
}

export interface Graph {
  readonly isGraph: true;
  readonly graphName: GraphName;
  forEachImage(fn: ImageHandler): void;
  forEachOrchestrator(fn: OrchestratorHandler): void;
}

export function isGraph(x: unknown): x is Graph {
  return x && typeof x === "object" && "isGraph" in x;
}

export class MultiEngineGraph implements Graph {
  readonly isGraph = true;

  constructor(readonly docker: de.Docker, readonly graphName: GraphName) {}

  public forEachImage(fn: ImageHandler): void {
    this.docker.forEachImage(fn);
  }

  public forEachOrchestrator(fn: OrchestratorHandler): void {
    this.docker.forEachOrchestrator(fn);
  }
}

export const graphFactory = new (class {
  constructor() {}

  public multiEngineGraph(graphName: GraphName): MultiEngineGraph {
    return new MultiEngineGraph(
      new de.Docker(graphName, de.latestDockerVersion),
      graphName,
    );
  }
})();
