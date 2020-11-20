import {
  artfPersist as ap,
  contextMgr as cm,
  governedIaCCore as giac,
  polyglotArtfNature,
  valueMgr as vm,
} from "../deps.ts";
import { TypicalImmutableServiceConfig } from "../typical.giac.ts";

export class MedigyTxMailServiceConfig extends TypicalImmutableServiceConfig {
  readonly image: vm.TextValue | giac.ServiceBuildConfig;
  readonly isProxyEnabled = false;
  readonly ports: giac.ServicePortsConfig;
  readonly containerName = "medigy-tx-mail";

  constructor(optionals: giac.ServiceConfigOptionals) {
    super({ serviceName: "medigytxmail", ...optionals });
    this.ports = [
      giac.portsFactory.publishSingle(8163),
    ];
    this.image = {
      dockerFile: new giac.dockerTr.Dockerfile(
        "Dockerfile-" + this.serviceName,
        new CustomMedigyTxMailInstructions(),
      ),
    };
  }
}

export class CustomMedigyTxMailInstructions implements giac.Instructions {
  readonly isInstructions = true;

  constructor() {}
  configureInstructions(): string {
    var value: string = "";
    value = [
      `FROM alpine:3.9.2`,
      `RUN apk add --no-cache curl`,
      `RUN curl -L https://deno.land/x/install/install.sh | sh`,
      `FROM gcr.io/distroless/cc`,
      `COPY --from=0 /root/.deno/bin/deno /`,
      `COPY deps.ts /`,
      `COPY medigy-tx-authn-messages.ts /`,
      `COPY medigy-tx-claim-messages.ts /`,
      `COPY medigy-tx-email-layout.tmpl.ts /`,
      `COPY medigy-tx-email-messages.tmpl.ts /`,
      `COPY medigy-tx-feedback-messages.ts /`,
      `COPY medigy-tx-ilm-messages.ts /`,
      `COPY medigy-tx-insti-messages.ts /`,
      `COPY medigy-tx-invite-messages.ts /`,
      `COPY medigy-tx-offering-messages.ts /`,
      `COPY medigy-tx-suggest-messages.ts /`,
      `ENTRYPOINT ["/deno", "run", "-A", "--unstable", "https://denopkg.com/gov-suite/governed-text-template@v0.2.5/toctl.ts", "server", "--module=file:///medigy-tx-email-messages.tmpl.ts,medigy-email", "--verbose"]`,
    ].join("\n");
    return value;
  }

  persist(
    ctx: cm.Context,
    image: giac.Image,
    ph: ap.PersistenceHandler,
    er?: giac.ImageErrorReporter,
  ): void {
    const artifact = ph.createMutableTextArtifact(ctx, {
      nature: polyglotArtfNature.dockerfileArtifact,
    });
    artifact.appendText(
      ctx,
      vm.resolveTextValue(
        ctx,
        this.configureInstructions(),
      ),
    );
    ph.persistTextArtifact(ctx, image.imageName, artifact);
  }
}

export const medigyTxMailConfigurator = new (class {
  configure(
    ctx: giac.ConfigContext,
    optionals?: giac.ServiceConfigOptionals,
  ): MedigyTxMailServiceConfig {
    return ctx.configured(new MedigyTxMailServiceConfig(optionals || {}));
  }
})();
