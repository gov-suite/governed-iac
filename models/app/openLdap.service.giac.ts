import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class OpenLdapConfig extends TypicalImmutableServiceConfig {
  readonly image = "osixia/openldap:1.5.0";
  readonly isProxyEnabled = false;
  readonly volumes?: giac.ServiceVolumeConfig[];
  readonly ports: giac.ServicePublishPortConfig;

  constructor(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ) {
    super({ serviceName: "openLdap", ...optionals });
    this.ports = giac.portsFactory.publishSingle(
      ctx.envVars.defaultEnvVar(
        "PGDCP_EXPOSE_PORT",
        "OPENLDAP PGDCP EXPOSE PORT",
        389,
        this,
      ),
      389,
    );
    this.volumes = [
      {
        localVolName: "openldap_storage-lib",
        containerFsPath: "/var/lib/ldap",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable user generated and transactional content",
          contentRecoveryType:
            giac.MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
      },
      {
        localVolName: "openldap_storage-etc",
        containerFsPath: "/etc/ldap/slapd.d",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable user generated and transactional content",
          contentRecoveryType:
            giac.MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
      },
      {
        localVolName: "openldap_storage-cert",
        containerFsPath: "/container/service/slapd/assets/certs",
        mutable: {
          isServiceVolumeMutable: true,
          contentType: "Irrecoverable user generated and transactional content",
          contentRecoveryType:
            giac.MutableServiceVolumeContentRecoveryType.IRRECOVERABLE,
        },
      },
    ];
    ctx.envVars.requiredEnvVar(
      "OPENLDAP_PGDCP_DOMAIN",
      "Ldap domain",
    );
    ctx.envVars.requiredEnvVar(
      "OPENLDAP_PGDCP_ADMIN_PASSWORD",
      "Ldap Admin password",
    );
    this.environment.LDAP_DOMAIN = "${OPENLDAP_PGDCP_DOMAIN}";
    this.environment.LDAP_ADMIN_PASSWORD = "${OPENLDAP_PGDCP_ADMIN_PASSWORD}";
    this.environment.LDAP_CONFIG_PASSWORD = "${OPENLDAP_PGDCP_ADMIN_PASSWORD}";
  }
}

export const openLdapConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): OpenLdapConfig {
    return ctx.configured(
      new OpenLdapConfig(ctx, optionals),
    );
  }
})();
