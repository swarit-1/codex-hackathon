/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentLogs from "../agentLogs.js";
import type * as agents from "../agents.js";
import type * as auth from "../auth.js";
import type * as cron from "../cron.js";
import type * as crons from "../crons.js";
import type * as customWorkflows from "../customWorkflows.js";
import type * as dashboard from "../dashboard.js";
import type * as demo from "../demo.js";
import type * as flowforge from "../flowforge.js";
import type * as lib_agentUtils from "../lib/agentUtils.js";
import type * as lib_cronParser from "../lib/cronParser.js";
import type * as lib_db from "../lib/db.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_fixtures from "../lib/fixtures.js";
import type * as lib_flowforge from "../lib/flowforge.js";
import type * as lib_logging from "../lib/logging.js";
import type * as lib_marketplace from "../lib/marketplace.js";
import type * as lib_orchestrator from "../lib/orchestrator.js";
import type * as lib_pagination from "../lib/pagination.js";
import type * as lib_records from "../lib/records.js";
import type * as lib_runControl from "../lib/runControl.js";
import type * as lib_runtimePrompt from "../lib/runtimePrompt.js";
import type * as lib_stubResponses from "../lib/stubResponses.js";
import type * as lib_validators from "../lib/validators.js";
import type * as marketplace from "../marketplace.js";
import type * as orchestrator from "../orchestrator.js";
import type * as pendingActions from "../pendingActions.js";
import type * as registrationMonitors from "../registrationMonitors.js";
import type * as runtime from "../runtime.js";
import type * as runtimeStore from "../runtimeStore.js";
import type * as scholarships from "../scholarships.js";
import type * as security_authz from "../security/authz.js";
import type * as security_encryption from "../security/encryption.js";
import type * as security_passwords from "../security/passwords.js";
import type * as types_contracts from "../types/contracts.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentLogs: typeof agentLogs;
  agents: typeof agents;
  auth: typeof auth;
  cron: typeof cron;
  crons: typeof crons;
  customWorkflows: typeof customWorkflows;
  dashboard: typeof dashboard;
  demo: typeof demo;
  flowforge: typeof flowforge;
  "lib/agentUtils": typeof lib_agentUtils;
  "lib/cronParser": typeof lib_cronParser;
  "lib/db": typeof lib_db;
  "lib/errors": typeof lib_errors;
  "lib/fixtures": typeof lib_fixtures;
  "lib/flowforge": typeof lib_flowforge;
  "lib/logging": typeof lib_logging;
  "lib/marketplace": typeof lib_marketplace;
  "lib/orchestrator": typeof lib_orchestrator;
  "lib/pagination": typeof lib_pagination;
  "lib/records": typeof lib_records;
  "lib/runControl": typeof lib_runControl;
  "lib/runtimePrompt": typeof lib_runtimePrompt;
  "lib/stubResponses": typeof lib_stubResponses;
  "lib/validators": typeof lib_validators;
  marketplace: typeof marketplace;
  orchestrator: typeof orchestrator;
  pendingActions: typeof pendingActions;
  registrationMonitors: typeof registrationMonitors;
  runtime: typeof runtime;
  runtimeStore: typeof runtimeStore;
  scholarships: typeof scholarships;
  "security/authz": typeof security_authz;
  "security/encryption": typeof security_encryption;
  "security/passwords": typeof security_passwords;
  "types/contracts": typeof types_contracts;
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
