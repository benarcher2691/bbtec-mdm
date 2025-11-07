/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apkStorage from "../apkStorage.js";
import type * as applications from "../applications.js";
import type * as audit from "../audit.js";
import type * as companyUsers from "../companyUsers.js";
import type * as deviceClients from "../deviceClients.js";
import type * as deviceCommands from "../deviceCommands.js";
import type * as devices from "../devices.js";
import type * as enrollmentTokens from "../enrollmentTokens.js";
import type * as installCommands from "../installCommands.js";
import type * as policies from "../policies.js";
import type * as preferences from "../preferences.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  apkStorage: typeof apkStorage;
  applications: typeof applications;
  audit: typeof audit;
  companyUsers: typeof companyUsers;
  deviceClients: typeof deviceClients;
  deviceCommands: typeof deviceCommands;
  devices: typeof devices;
  enrollmentTokens: typeof enrollmentTokens;
  installCommands: typeof installCommands;
  policies: typeof policies;
  preferences: typeof preferences;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
