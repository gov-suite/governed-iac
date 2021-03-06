import type { valueMgr as vm } from "./deps.ts";
import { safety } from "./deps.ts";
export interface ServiceExposePortConfig {
  readonly isServiceExposePortConfig: true;
  readonly target: vm.NumericValue;
}

export const isServiceExposePortConfig = safety.typeGuard<
  ServiceExposePortConfig
>("isServiceExposePortConfig");

export interface ServicePublishPortConfig {
  readonly isServicePublishPortConfig: true;
  readonly published: vm.NumericValue;
  readonly target: vm.NumericValue;
  readonly protocol?: "tcp" | "udp";
  readonly mode?: "host" | "ingress";
}

export const isServicePublishPortConfig = safety.typeGuard<
  ServicePublishPortConfig
>("isServicePublishPortConfig");

export type ServiceSinglePortConfig =
  | ServiceExposePortConfig
  | ServicePublishPortConfig;

export function isServiceSinglePortConfig(
  c: unknown,
): c is ServiceSinglePortConfig {
  return isServiceExposePortConfig(c) || isServicePublishPortConfig(c);
}

export interface ServiceMultiplePortsConfig {
  readonly isServiceMultiplePortsConfig: true;
  readonly multiplePorts: ServiceSinglePortConfig[];
}

export function isServiceMultiplePortsConfig(
  c: ServicePortsConfig,
): c is ServiceSinglePortConfig[] {
  return Array.isArray(c);
}

export type ServicePortsConfig =
  | ServiceSinglePortConfig
  | ServiceSinglePortConfig[];

export const portsFactory = new (class {
  public exposeSingle(target: vm.NumericValue): ServiceExposePortConfig {
    return new (class implements ServiceExposePortConfig {
      readonly isServiceExposePortConfig = true;
      readonly target = target;
    })();
  }

  public publishSingle(
    published: vm.NumericValue,
    target: vm.NumericValue = published,
  ): ServicePublishPortConfig {
    return new (class implements ServicePublishPortConfig {
      readonly isServicePublishPortConfig = true;
      readonly published: vm.NumericValue = published;
      readonly target: vm.NumericValue = target;
    })();
  }

  public publishSingleUDP(
    published: vm.NumericValue,
    target: vm.NumericValue = published,
  ): ServicePublishPortConfig {
    return new (class implements ServicePublishPortConfig {
      readonly isServicePublishPortConfig = true;
      readonly published: vm.NumericValue = published;
      readonly target: vm.NumericValue = target;
      readonly protocol = "udp";
    })();
  }
})();
