import {
  assert,
  assertEquals,
} from "https://deno.land/std@v0.62.0/testing/asserts.ts";
import {
  artfPersist as ap,
  contextMgr as cm,
  specModule as sm,
} from "../deps.ts";
import * as iacModel from "../lib/omnibus/middleware-rdbms-api-auto-baas.services.iacs.ts";
import { ConfiguredServices } from "../service.ts";
import { transformDockerArtifacts } from "./transform.ts";

Deno.test(
  "middleware-rdbms-api-auto-baas-graph Dockerfile and docker-compose.yaml Transformer",
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

    assertEquals(p.resultsMap.size, 7);
    assert(p.resultsMap.get("Dockerfile-postgreSqlEngine"));
    assert(p.resultsMap.get("Dockerfile-postGraphile"));
    assert(p.resultsMap.get("./initdb.d/000_postgresqlengine-initdb.sql"));
    assert(p.resultsMap.get("acme.json"));
    assert(p.resultsMap.get("jwt-validator.sh"));
    assert(p.resultsMap.get("init-permissions.sh"));

    const dockerCompose = p.resultsMap.get("docker-compose.yaml");
    assert(dockerCompose);
    assertEquals(
      ap.readFileAsTextFromPaths("docker_test-01.yaml.golden", [
        ".",
        "./docker",
      ]),
      dockerCompose.artifactText,
    );
  },
);
