import type { contextMgr as cm } from "../deps.ts";
import { medigyTxMailConfigurator as medigytxmail } from "../app/medigytxmail.service.giac.ts";
import { TypicalComposeConfig } from "../typical.giac.ts";

export class AutoBaaS extends TypicalComposeConfig {
  readonly servicesName = "medigytxmail";

  constructor(ctx: cm.ProjectContext) {
    super(ctx);
    const medigytxmailApp = medigytxmail.configure(this, this.common);
    this.finalize();
  }
}

export default AutoBaaS;
