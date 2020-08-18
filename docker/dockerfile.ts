import {
  artfPersist as ap,
  contextMgr as cm,
} from "../deps.ts";
import * as img from "../image.ts";

export function isDockerfile(c: any): c is Dockerfile {
  return "isDockerfile" in c;
}

export const DEFAULT_FILE_NAME: string = "Dockerfile";

export class Dockerfile implements img.Image {
  readonly isImage: true = true;
  readonly isDockerfile: true = true;

  constructor(
    readonly imageName: img.ImageName,
    readonly instructions: img.Instructions,
  ) {}

  persist(
    ctx: cm.Context,
    ph: ap.PersistenceHandler,
    er?: img.ImageErrorReporter,
  ): void {
    this.instructions.persist(ctx, this, ph, er);
  }

  isValid(ctx: cm.Context, er?: img.ImageErrorReporter): boolean {
    return true;
  }

  registryKeys(ctx: cm.Context): img.ImageRegistryKeys {
    return [this.imageName];
  }
}
