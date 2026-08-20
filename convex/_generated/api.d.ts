/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as ai_comments from "../ai/comments.js";
import type * as ai_openrouter from "../ai/openrouter.js";
import type * as ai_prompts from "../ai/prompts.js";
import type * as ai_reactions from "../ai/reactions.js";
import type * as billing from "../billing.js";
import type * as billingNode from "../billingNode.js";
import type * as crons from "../crons.js";
import type * as feed from "../feed.js";
import type * as feedback_emails from "../feedback/emails.js";
import type * as feedback_feedback from "../feedback/feedback.js";
import type * as http from "../http.js";
import type * as interactions from "../interactions.js";
import type * as jobs_processQueue from "../jobs/processQueue.js";
import type * as jobs_scrapeProfileApify from "../jobs/scrapeProfileApify.js";
import type * as jobs_syncPosts from "../jobs/syncPosts.js";
import type * as jobs_syncPostsApify from "../jobs/syncPostsApify.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_apify from "../lib/apify.js";
import type * as lib_articleValidator from "../lib/articleValidator.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_feedRank from "../lib/feedRank.js";
import type * as lib_interactionLimit from "../lib/interactionLimit.js";
import type * as lib_languages from "../lib/languages.js";
import type * as lib_planLimits from "../lib/planLimits.js";
import type * as lib_policy from "../lib/policy.js";
import type * as lib_postLimit from "../lib/postLimit.js";
import type * as lib_profileOptions from "../lib/profileOptions.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_reactions from "../lib/reactions.js";
import type * as lib_stripePrices from "../lib/stripePrices.js";
import type * as lib_trialMilestone from "../lib/trialMilestone.js";
import type * as linkedin_auth from "../linkedin/auth.js";
import type * as linkedin_client from "../linkedin/client.js";
import type * as linkedin_oauth from "../linkedin/oauth.js";
import type * as linkedin_parsePostContent from "../linkedin/parsePostContent.js";
import type * as linkedin_parsePostUrl from "../linkedin/parsePostUrl.js";
import type * as linkedin_types from "../linkedin/types.js";
import type * as linkedin_verifyPostOwnership from "../linkedin/verifyPostOwnership.js";
import type * as migrations_seedPlanLimits from "../migrations/seedPlanLimits.js";
import type * as motd_motd from "../motd/motd.js";
import type * as posts from "../posts.js";
import type * as privacy_consent from "../privacy/consent.js";
import type * as privacy_deletion from "../privacy/deletion.js";
import type * as privacy_emails from "../privacy/emails.js";
import type * as privacy_export from "../privacy/export.js";
import type * as privacy_retention from "../privacy/retention.js";
import type * as sessions from "../sessions.js";
import type * as stripe from "../stripe.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "ai/comments": typeof ai_comments;
  "ai/openrouter": typeof ai_openrouter;
  "ai/prompts": typeof ai_prompts;
  "ai/reactions": typeof ai_reactions;
  billing: typeof billing;
  billingNode: typeof billingNode;
  crons: typeof crons;
  feed: typeof feed;
  "feedback/emails": typeof feedback_emails;
  "feedback/feedback": typeof feedback_feedback;
  http: typeof http;
  interactions: typeof interactions;
  "jobs/processQueue": typeof jobs_processQueue;
  "jobs/scrapeProfileApify": typeof jobs_scrapeProfileApify;
  "jobs/syncPosts": typeof jobs_syncPosts;
  "jobs/syncPostsApify": typeof jobs_syncPostsApify;
  "lib/access": typeof lib_access;
  "lib/apify": typeof lib_apify;
  "lib/articleValidator": typeof lib_articleValidator;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/email": typeof lib_email;
  "lib/feedRank": typeof lib_feedRank;
  "lib/interactionLimit": typeof lib_interactionLimit;
  "lib/languages": typeof lib_languages;
  "lib/planLimits": typeof lib_planLimits;
  "lib/policy": typeof lib_policy;
  "lib/postLimit": typeof lib_postLimit;
  "lib/profileOptions": typeof lib_profileOptions;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/reactions": typeof lib_reactions;
  "lib/stripePrices": typeof lib_stripePrices;
  "lib/trialMilestone": typeof lib_trialMilestone;
  "linkedin/auth": typeof linkedin_auth;
  "linkedin/client": typeof linkedin_client;
  "linkedin/oauth": typeof linkedin_oauth;
  "linkedin/parsePostContent": typeof linkedin_parsePostContent;
  "linkedin/parsePostUrl": typeof linkedin_parsePostUrl;
  "linkedin/types": typeof linkedin_types;
  "linkedin/verifyPostOwnership": typeof linkedin_verifyPostOwnership;
  "migrations/seedPlanLimits": typeof migrations_seedPlanLimits;
  "motd/motd": typeof motd_motd;
  posts: typeof posts;
  "privacy/consent": typeof privacy_consent;
  "privacy/deletion": typeof privacy_deletion;
  "privacy/emails": typeof privacy_emails;
  "privacy/export": typeof privacy_export;
  "privacy/retention": typeof privacy_retention;
  sessions: typeof sessions;
  stripe: typeof stripe;
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

export declare const components: {
  stripe: import("@convex-dev/stripe/_generated/component.js").ComponentApi<"stripe">;
};
