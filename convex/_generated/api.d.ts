/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 * To regenerate, run `npx convex dev`.
 * @module
 */

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: {
  agents: {
    create: any;
    updateStatus: any;
    listByUser: any;
    runNow: any;
    updateSchedule: any;
    delete: any;
  };
  agentLogs: {
    append: any;
    list: any;
    listByUser: any;
  };
  customWorkflows: {
    create: any;
    listByUser: any;
    update: any;
  };
  dashboard: {
    getOverview: any;
  };
  demo: {
    bootstrapWorkspace: any;
  };
  flowforge: {
    generateWorkflowSpec: any;
    generateAgentScript: any;
  };
  marketplace: {
    listTemplates: any;
    getTemplate: any;
    installTemplate: any;
    submitTemplate: any;
    reviewSubmission: any;
  };
  orchestrator: {
    triggerAgentRun: any;
    handleWebhook: any;
    resumeFromPendingAction: any;
  };
  pendingActions: {
    create: any;
    resolve: any;
    listByUser: any;
  };
  registrationMonitors: {
    create: any;
    listByUser: any;
  };
  scholarships: {
    listByUser: any;
    upsertFromRun: any;
  };
  users: {
    upsertProfile: any;
    getProfile: any;
  };
};

export declare const internal: typeof api;
