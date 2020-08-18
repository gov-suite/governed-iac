import { assert } from "https://deno.land/std@v0.62.0/testing/asserts.ts";
import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  polyglotArtfNature,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalPersistenceServiceConfig } from "../typical.giac.ts";

export interface PostgreSqlEngineOptions {
  readonly baseDockerImage: string;
  readonly postgreSqlConfigOptions: PostgreSqlConfigOptions;
}

export interface PostgreSqlConfigOptions {
  readonly configurePlPgSqlCheckLinter?: boolean;
  readonly configurePostgis?: boolean;
  readonly configurePgtap?: boolean;
  readonly configurePlpython3?: boolean;
  readonly configurePgAudit?: boolean;
  readonly configurePlv8?: boolean;
  readonly configurePlJava?: boolean;
  readonly configureMessageDB?: boolean;
}

export interface PostgreSqlConnectionSecrets {
  user: vm.TextValue;
  password: vm.TextValue;
}

export interface PostgreSqlConnectionConfig {
  readonly dbName: vm.TextValue;
  readonly secrets: PostgreSqlConnectionSecrets;
  readonly schema: vm.TextValue;
  readonly host: vm.TextValue;
  readonly hostPort: vm.NumericValue;
  readonly url: vm.TextValue;
}

export class PostgreSqlEngineServiceConfig
  extends TypicalPersistenceServiceConfig {
  readonly image: vm.TextValue | giac.ServiceBuildConfig;
  readonly initDbVolume: giac.ServiceVolumeLocalFsPathConfig;
  readonly volumes?: giac.ServiceVolumeConfig[];
  readonly command?: vm.Value[];
  readonly ports: giac.ServicePublishPortConfig;
  readonly isProxyEnabled = false;

  constructor(
    ctx: giac.ConfigContext,
    readonly conn: PostgreSqlConnectionConfig,
    readonly engineOptions: PostgreSqlEngineOptions,
    scOptionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "postgresqlengine", ...scOptionals });

    this.image = engineOptions?.postgreSqlConfigOptions
      ? {
        dockerFile: new giac.dockerTr.Dockerfile(
          "Dockerfile-postgreSqlEngine",
          new CustomPostgreSqlEngineInstructions(engineOptions),
        ),
      }
      : engineOptions.baseDockerImage;

    this.ports = giac.portsFactory.publishSingle(
      ctx.envVars.defaultEnvVar(
        "PUBL_PORT",
        "PostgreSQL Engine published port",
        conn.hostPort,
        this,
      ),
      conn.hostPort,
    );
    this.environment.POSTGRES_DB = conn.dbName;
    this.environment.POSTGRES_USER = conn.secrets.user;
    this.environment.POSTGRES_PASSWORD = conn.secrets.password;
    this.initDbVolume = {
      localFsPath: (ctx: cm.Context) => {
        const pp = cm.isProjectContext(ctx) ? ctx.projectPath : ".";
        return `${pp}/initdb.d`;
      },
      containerFsPath: "/docker-entrypoint-initdb.d",
    };
    this.volumes = [
      {
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable user generated and transactional content",
          contentRecoveryType:
            giac.MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
        localVolName: this.serviceName + "-storage",
        containerFsPath: "/var/lib/postgresql/data",
      },
      this.initDbVolume,
    ];
  }

  applyLabel(key: string, value: any): void {
    this.labels[key] = value;
  }

  public connection(): PostgreSqlConnectionConfig {
    return postgreSqlConfigurator.configureConn(
      this.conn.dbName,
      this.conn.secrets,
      this.conn.schema,
      this.serviceName,
      this.ports.published,
    );
  }

  persistRelatedArtifacts(
    ctx: giac.ConfigContext,
    ph: ap.PersistenceHandler,
    er?: giac.OrchestratorErrorReporter,
  ): void {
    const mta = ph.createMutableTextArtifact(
      ctx,
      { nature: polyglotArtfNature.sqlArtifact },
    );
    mta.appendText(ctx, "CREATE EXTENSION IF NOT EXISTS pgcrypto;\n");
    mta.appendText(ctx, "CREATE EXTENSION IF NOT EXISTS plpgsql_check;\n");
    ph.persistTextArtifact(
      ctx,
      vm.resolveTextValue(ctx, this.initDbVolume.localFsPath) +
        `/000_${this.serviceName}-initdb.sql`,
      mta,
    );
    const mtaPermission = ph.createMutableTextArtifact(
      ctx,
      { nature: polyglotArtfNature.shfileArtifact },
    );
    mtaPermission.appendText(
      ctx,
      vm.resolveTextValue(
        ctx,
        [
          "#!/bin/bash",
          "set -e" + "\n",
          'echo "host replication $POSTGRES_USER 0.0.0.0/0 trust" >> $PGDATA/pg_hba.conf',
          'echo "shared_preload_libraries = ' +
          "'pg_stat_statements, pgaudit'" + '" >> $PGDATA/postgresql.conf',
          'echo "pg_stat_statements.max = 10000" >> $PGDATA/postgresql.conf',
          'echo "pg_stat_statements.track = all" >> $PGDATA/postgresql.conf',
          'echo "wal_level=logical" >> $PGDATA/postgresql.conf',
          'echo "max_replication_slots=5" >> $PGDATA/postgresql.conf',
          'echo "max_wal_senders=10" >> $PGDATA/postgresql.conf',
          'echo "log_destination=' + "'csvlog'" +
          '" >> $PGDATA/postgresql.conf',
          'echo "logging_collector=on" >> $PGDATA/postgresql.conf',
          'echo "log_filename=' + "'postgresql.log'" +
          '" >> $PGDATA/postgresql.conf',
          'echo "log_rotation_age=0" >> $PGDATA/postgresql.conf',
          'echo "log_rotation_size=0" >> $PGDATA/postgresql.conf',
        ].join("\n"),
      ),
    );
    ph.persistTextArtifact(
      ctx,
      "init-permissions.sh",
      mtaPermission,
      { chmod: 0o755 },
    );
  }

  initDbPersistenceHandler(
    projectCtx: cm.ProjectContext,
    parentPH: ap.PersistenceHandler,
  ): ap.PersistenceHandler {
    return new ap.FileSystemPersistenceHandler({
      projectPath: projectCtx.projectPath,
      destPath: vm.resolveTextValue(
        projectCtx,
        this.initDbVolume.localFsPath,
      ),
      createDestPaths: true,
      report: ap.consolePersistenceResultReporter,
      logicalNamingStrategy: ap.natureNamingStrategy(),
      physicalNamingStrategy: ap.sequencePrefixNamingStrategy(
        ap.natureNamingStrategy(),
        ap.startAtSequenceNumberSupplier(100),
      ),
    });
  }
}

export class CustomPostgreSqlEngineInstructions implements giac.Instructions {
  readonly isInstructions = true;

  constructor(readonly options: PostgreSqlEngineOptions) {}
  configureInstructions(options: PostgreSqlEngineOptions): string {
    var value: string = "";
    if (options.postgreSqlConfigOptions.configurePlJava) {
      value = [
        `FROM postgres:12 as builder` + "\n",
        "RUN apt-get update " + "\\",
        "    && apt-get install -y build-essential default-jdk maven postgresql-server-dev-12 libecpg-dev libkrb5-dev git libssl-dev " +
        "\\",
        "    && cd /tmp " + "\\",
        "    && git clone https://github.com/tada/pljava.git " + "\\",
        "    && cd pljava " + "\\",
        "    && mvn clean install " + "\\",
        "    && ls -l pljava-packaging/target/" + "\n\n",
      ].join("\n");
    }
    value += "FROM postgres:12" + "\n\n";
    if (options.postgreSqlConfigOptions.configurePostgis) {
      value += [
        `# install postgis`,
        "ENV POSTGIS_MAJOR 3",
        "ENV POSTGIS_VERSION 3.0.0+dfsg-2~exp1.pgdg100+1",
        "RUN apt-get update " + "\\",
        "      && apt-cache showpkg postgresql-$PG_MAJOR-postgis-$POSTGIS_MAJOR " +
        "\\",
        "      && apt-get install -y --no-install-recommends " + "\\",
        "           postgresql-$PG_MAJOR-postgis-$POSTGIS_MAJOR " + "\\",
        "           postgresql-$PG_MAJOR-postgis-$POSTGIS_MAJOR-scripts " +
        "\\",
        "      && apt-get install software-properties-common -y " + "\\",
        "      && apt-get install git -y " + "\\",
        "      && apt-get install build-essential -y " + "\\",
        "      && rm -rf /var/lib/apt/lists/*" + "\n\n",
      ].join("\n");
    }
    if (options.postgreSqlConfigOptions.configurePgtap) {
      value += [
        `# install pgtap`,
        "ENV PGTAP_VERSION v1.1.0",
        "RUN git clone git://github.com/theory/pgtap.git " + "\\",
        "    && cd pgtap && git checkout tags/$PGTAP_VERSION " + "\\",
        "    && make install" + "\n\n",
      ].join("\n");
    }
    if (options.postgreSqlConfigOptions.configurePlpython3) {
      value += [
        `# install plpython3`,
        "RUN apt-get update " + "\\ ",
        "      && apt-get install postgresql-plpython3-12 -y" + "\n\n",
      ].join("\n");
    }
    if (options.postgreSqlConfigOptions.configurePgAudit) {
      value += [
        `# install pgAudit`,
        `ENV PGAUDIT_VERSION 1.4.0`,
        'RUN pgAuditDependencies="postgresql-server-dev-$PG_MAJOR ' + "\\",
        "    libssl-dev " + "\\",
        "    libkrb5-dev " + "\\",
        "    git-core " + "\\",
        '    wget" ' + "\\",
        "    && apt-get update " + "\\",
        "    && apt-get install -y --no-install-recommends ${pgAuditDependencies} " +
        "\\",
        "    && cd /tmp " + "\\",
        "    && wget https://github.com/pgaudit/pgaudit/archive/${PGAUDIT_VERSION}.tar.gz " +
        "\\",
        "    && tar -zxf 1.4.0.tar.gz " + "\\",
        "    && cd pgaudit-1.4.0 " + "\\",
        "    && make check USE_PGXS=1 " + "\\",
        "    && make install USE_PGXS=1 " + "\n\n",
      ].join("\n");
    }
    if (options.postgreSqlConfigOptions.configurePlv8) {
      value += [
        `# install plv8`,
        "ENV PLV8_VERSION=r3.0alpha" + "\n",
        'RUN buildDependencies="build-essential ' + "\\",
        "    ca-certificates " + "\\",
        "    curl " + "\\",
        "    git-core " + "\\",
        "    python " + "\\",
        "    gpp " + "\\",
        "    cpp " + "\\",
        "    pkg-config " + "\\",
        "    apt-transport-https " + "\\",
        "    cmake " + "\\",
        "    libc++-dev " + "\\",
        "    libc++abi-dev " + "\\",
        '    postgresql-server-dev-$PG_MAJOR" ' + "\\",
        '  && runtimeDependencies="libc++1 ' + "\\",
        "    libtinfo5 " + "\\",
        '    libc++abi1" ' + "\\",
        "  && apt-get update " + "\\",
        "  && apt-get install -y --no-install-recommends ${buildDependencies} ${runtimeDependencies} " +
        "\\",
        "  && mkdir -p /tmp/build " + "\\",
        "  && cd /tmp/build " + "\\",
        "  && git clone https://github.com/plv8/plv8.git " + "\\",
        "  && cd plv8 " + "\\",
        "  && git checkout ${PLV8_VERSION} " + "\\",
        "  && make static " + "\\",
        "  && make install " + "\\",
        "  && rm -rf /root/.vpython_cipd_cache /root/.vpython-root " + "\\",
        "  && apt-get clean " + "\\",
        "  && apt-get remove -y ${buildDependencies} " + "\\",
        "  && apt-get autoremove -y " + "\\",
        "  && rm -rf /tmp/build /var/lib/apt/lists/*" + "\n\n",
      ].join("\n");
    }
    if (options.postgreSqlConfigOptions.configurePlPgSqlCheckLinter) {
      value += [
        `# install plpgsql_check`,
        "RUN apt-get update " + "\\",
        "    && apt-get install -y gcc make libicu-dev postgresql-server-dev-12 " +
        "\\",
        "    && cd /tmp " + "\\",
        "    && git clone https://github.com/okbob/plpgsql_check.git " + "\\",
        "    && cd plpgsql_check " + "\\",
        "    && make clean " + "\\",
        "    && make install" + "\n\n",
      ].join("\n");
    }
    if (options.postgreSqlConfigOptions.configurePlJava) {
      value += [
        `# install PL/Java`,
        "ENV LIBJVM_PATH=/usr/lib/jvm/java-11-openjdk-amd64/lib/server/libjvm.so",
        "COPY --from=builder /tmp/pljava/pljava-packaging/target/pljava-pg12.3-amd64-Linux-gpp.jar /tmp/pljava-pg12.3-amd64-Linux-gpp.jar",
        "RUN apt-get install -y default-jre " + "\\",
        "    && java -jar /tmp/pljava-pg12.3-amd64-Linux-gpp.jar" + "\n",
        "RUN mkdir -p /docker-entrypoint-initdb.d",
        "COPY init-permissions.sh /docker-entrypoint-initdb.d/" + "\n\n",
      ].join("\n");
    }
    if (options.postgreSqlConfigOptions.configureMessageDB) {
      value += [
        `# clone Message DB`,
        "RUN cd /usr/src/ " + "\\",
        "  && git clone https://github.com/message-db/message-db.git",
        "WORKDIR /usr/src/message-db" + "\n",
      ].join("\n");
    }
    return value;
  }

  persist(
    ctx: cm.Context,
    image: giac.Image,
    ph: ap.PersistenceHandler,
    er?: giac.ImageErrorReporter,
  ): void {
    assert(this.options.postgreSqlConfigOptions);
    const artifact = ph.createMutableTextArtifact(ctx, {
      nature: polyglotArtfNature.dockerfileArtifact,
    });
    artifact.appendText(
      ctx,
      vm.resolveTextValue(
        ctx,
        this.configureInstructions(this.options),
      ),
    );
    ph.persistTextArtifact(ctx, image.imageName, artifact);
  }
}

export const postgreSqlConfigurator = new (class {
  configureConn(
    dbName: vm.TextValue,
    secrets: PostgreSqlConnectionSecrets,
    schema: vm.TextValue = "public",
    host: vm.TextValue = "0.0.0.0",
    hostPort: vm.NumericValue = 5432,
  ): PostgreSqlConnectionConfig {
    return new (class implements PostgreSqlConnectionConfig {
      readonly dbName = dbName;
      readonly secrets = secrets;
      readonly schema = schema;
      readonly host = host;
      readonly hostPort = hostPort;
      readonly url = (ctx: cm.Context): string => {
        return `postgres://${this.secrets.user}:${this.secrets.password}@${
          vm.resolveTextValue(ctx, this.host)
        }:${
          vm.resolveNumericValueAsText(
            ctx,
            this.hostPort,
          )
        }/${this.dbName}`;
      };
    })();
  }

  configureDevlConn(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): PostgreSqlConnectionConfig {
    return this.configureConn(
      "devl",
      {
        user: "postgres",
        password: "devl",
      },
      "public",
      "0.0.0.0",
      5432,
    );
  }

  configureDevlEngine(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
    postgreSqlConfigOptions?: PostgreSqlConfigOptions,
  ): PostgreSqlEngineServiceConfig {
    const conn = this.configureConn("devl", {
      user: "postgres",
      password: "devl",
    });
    return ctx.configured(
      new PostgreSqlEngineServiceConfig(
        ctx,
        conn,
        {
          baseDockerImage: "supabase/postgres",
          postgreSqlConfigOptions: {
            configurePlPgSqlCheckLinter:
              (postgreSqlConfigOptions?.configurePlPgSqlCheckLinter == false)
                ? false
                : true,
            configurePostgis:
              (postgreSqlConfigOptions?.configurePostgis == false)
                ? false
                : true,
            configurePgtap: (postgreSqlConfigOptions?.configurePgtap == false)
              ? false
              : true,
            configurePlpython3:
              (postgreSqlConfigOptions?.configurePlpython3 == false) ? false
              : true,
            configurePgAudit:
              (postgreSqlConfigOptions?.configurePgAudit == false) ? false
              : true,
            configurePlv8: (postgreSqlConfigOptions?.configurePlv8 == false)
              ? false
              : true,
            configurePlJava: (postgreSqlConfigOptions?.configurePlJava == false)
              ? false
              : true,
            configureMessageDB:
              (postgreSqlConfigOptions?.configureMessageDB == false) ? false
              : true,
          },
        },
        optionals,
      ),
    );
  }
})();
