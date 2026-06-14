/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audit from "../audit.js";
import type * as crons from "../crons.js";
import type * as crypto from "../crypto.js";
import type * as devices from "../devices.js";
import type * as errors from "../errors.js";
import type * as events from "../events.js";
import type * as http from "../http.js";
import type * as ingest from "../ingest.js";
import type * as maintenance from "../maintenance.js";
import type * as people from "../people.js";
import type * as rbac from "../rbac.js";
import type * as settings from "../settings.js";
import type * as stats from "../stats.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audit: typeof audit;
  crons: typeof crons;
  crypto: typeof crypto;
  devices: typeof devices;
  errors: typeof errors;
  events: typeof events;
  http: typeof http;
  ingest: typeof ingest;
  maintenance: typeof maintenance;
  people: typeof people;
  rbac: typeof rbac;
  settings: typeof settings;
  stats: typeof stats;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
