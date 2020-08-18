import { artfPersist as ap, contextMgr as cm, valueMgr as vm } from "./deps.ts";

export type ImageName = vm.TextValue;
export type ImageRegistryKey = vm.TextValue;
export type ImageRegistryKeys = ImageRegistryKey[];

export interface ImageErrorReporter {
  (o: Image, msg: string): void;
}

export interface Instructions {
  readonly isInstructions: true;
  persist(
    ctx: cm.Context,
    image: Image,
    ph: ap.PersistenceHandler,
    er?: ImageErrorReporter,
  ): void;
}

export function isInstructions(c: any): c is Instructions {
  return "isInstructions" in c;
}

export interface Image {
  readonly isImage: true;
  readonly imageName: ImageName;
  readonly instructions: Instructions;
  persist(
    ctx: cm.Context,
    ph: ap.PersistenceHandler,
    er?: ImageErrorReporter,
  ): void;
  isValid(ctx: cm.Context, er?: ImageErrorReporter): boolean;
  registryKeys(ctx: cm.Context): ImageRegistryKeys;
}

export function isImage(c: any): c is Image {
  return "isImage" in c;
}
