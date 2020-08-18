import {
  artfPersist as ap,
  contextMgr as cm,
  specModule as sm,
  valueMgr as vm,
} from "../deps.ts";
import { graphFactory, GraphName } from "../graph.ts";
import * as orch from "../orchestrator.ts";
import { ConfiguredServices } from "../service.ts";
import * as compose from "./compose.ts";

export interface TransformOptions {
  readonly projectCtx: cm.ProjectContext;
  readonly spec: sm.Specification<ConfiguredServices>;
  readonly name?: GraphName;
  readonly persist?: ap.PersistenceHandler;
}

export interface DockerTransformOptions extends TransformOptions {
  readonly composeYamlName?: vm.TextValue;
  readonly composeBuildContext?: vm.TextValue;
  readonly persistRelatedArtifacts?: compose.PersistRelatedComposeArtifacts;
}

export function defaultDockerArtifactsPersistenceHandler(
  projectCtx: cm.ProjectContext,
): ap.PersistenceHandler {
  return new ap.FileSystemPersistenceHandler({
    projectPath: projectCtx.projectPath,
    destPath: projectCtx.projectPath,
    createDestPaths: true,
    report: ap.consolePersistenceResultReporter,
    logicalNamingStrategy: ap.asIsNamingStrategy,
  });
}

export function transformDockerArtifacts(
  {
    projectCtx,
    name,
    spec,
    persist,
    composeYamlName,
    composeBuildContext,
    persistRelatedArtifacts,
  }: DockerTransformOptions,
): void {
  const graph = graphFactory.multiEngineGraph(name || "graph");
  const dc = graph.docker.createDockerCompose({
    configuredServices: spec.target,
    name: composeYamlName || compose.DEFAULT_COMPOSE_FILE_NAME,
    buildContext: composeBuildContext || projectCtx.projectPath,
    persistRelatedArtifacts: persistRelatedArtifacts,
  });
  dc.persist(
    spec.target.context(),
    persist || defaultDockerArtifactsPersistenceHandler(projectCtx),
    (o: orch.Orchestrator, msg: string): void => {
      console.error("Orchestrator", dc.name, msg);
    },
  );
}
