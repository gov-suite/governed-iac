import { testingAsserts as ta } from "../deps.ts";
import {
  artfPersist as ap,
  contextMgr as cm,
  specModule as sm,
} from "../deps.ts";
import * as iacModel from "../../models/omnibus/middleware-rdbms-api-auto-baas.services.giac.ts";
import type { ConfiguredServices } from "../service.ts";
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

    ta.assertEquals(p.resultsMap.size, 7);
    ta.assert(p.resultsMap.get("Dockerfile-postgreSqlEngine"));
    ta.assert(p.resultsMap.get("Dockerfile-postGraphile"));
    ta.assert(p.resultsMap.get("./initdb.d/000_postgresqlengine-initdb.sql"));
    ta.assert(p.resultsMap.get("acme.json"));
    ta.assert(p.resultsMap.get("jwt-validator.sh"));
    ta.assert(p.resultsMap.get("./initdb.d/init-permissions.sh"));

    const dockerCompose = p.resultsMap.get("docker-compose.yaml");
    ta.assert(dockerCompose);
    ta.assertEquals(
      ap.readFileAsTextFromPaths("docker_test-01.yaml.golden", [
        ".",
        "./docker",
        "./core/docker",
        "./governed-iac/core/docker",
      ]),
      dockerCompose.artifactText,
    );
  },
);
