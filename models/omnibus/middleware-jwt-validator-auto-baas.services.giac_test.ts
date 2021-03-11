import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  specModule as sm,
  testingAsserts as ta,
} from "../deps.ts";
import * as iacModel from "./middleware-jwt-validator-auto-baas.services.giac.ts";

Deno.test(
  "middleware-jwt-validator-auto-baas-graph Dockerfile and docker-compose.yaml Transformer",
  () => {
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
      ap.readFileAsTextFromPaths(
        "jwt-validator-auto-baas.yaml.golden",
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
