import {
  assert,
  assertEquals,
} from "https://deno.land/std@v0.62.0/testing/asserts.ts";
import {
  artfPersist as ap,
  contextMgr as cm,
  specModule as sm,
} from "../../deps.ts";
import { transformDockerArtifacts } from "../../docker/transform.ts";
import { ConfiguredServices } from "../../service.ts";
import * as iacModel from "./middleware-gitlab-auto-baas.services.iacs-sandbox.ts";

Deno.test(
  "middleware-gitlab-auto-baas-graph Dockerfile and docker-compose.yaml Transformer",
  async () => {
    const ctx = cm.ctxFactory.projectContext(".");
    const p = new ap.InMemoryPersistenceHandler();
    transformDockerArtifacts(
      {
        projectCtx: ctx,
        name: "graph",
        spec: sm.specFactory.spec<ConfiguredServices>(
          new iacModel.AutoBaaS(ctx),
        ),
        persist: p,
        composeBuildContext: ctx.projectPath,
      },
    );

    assertEquals(p.resultsMap.size, 2);
    assert(p.resultsMap.get("acme.json"));

    const dockerCompose = p.resultsMap.get("docker-compose.yaml");
    assert(dockerCompose);
    assertEquals(
      ap.readFileAsTextFromPaths(
        "gitlab-auto-baas-without-pomerium.yaml.golden",
        [
          ".",
          "./lib/omnibus",
        ],
      ),
      dockerCompose.artifactText,
    );
  },
);
