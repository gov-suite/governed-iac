import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.77.0/testing/asserts.ts";
import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  specModule as sm,
} from "../deps.ts";
import * as iacModel from "./middleware-medigytxmail-auto-baas.services.giac.ts";

Deno.test(
  "middleware-medigytxmail-auto-baas-graph Dockerfile and docker-compose.yaml Transformer",
  async () => {
    const ctx = cm.ctxFactory.projectContext(".");
    const p = new ap.InMemoryPersistenceHandler();
    giac.dockerTr.transformDockerArtifacts(
      {
        projectCtx: ctx,
        name: "graph",
        spec: sm.specFactory.spec<giac.ConfiguredServices>(
          new iacModel.AutoBaaS(ctx),
        ),
        persist: p,
        composeBuildContext: ctx.projectPath,
      },
    );

    assertEquals(p.resultsMap.size, 2);
    assert(p.resultsMap.get("Dockerfile-medigytxmail"));

    const dockerCompose = p.resultsMap.get("docker-compose.yaml");
    assert(dockerCompose);
    assertEquals(
      ap.readFileAsTextFromPaths(
        "medigytxmail-auto-baas.yaml.golden",
        [
          ".",
          "./omnibus",
          "./models/omnibus",
          "./governed-iac/models/omnibus",
        ],
      ),
      dockerCompose.artifactText,
    );
  },
);
