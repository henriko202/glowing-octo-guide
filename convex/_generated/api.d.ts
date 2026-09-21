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
import type * as billingNotices from "../billingNotices.js";
import type * as crons from "../crons.js";
import type * as dev from "../dev.js";
import type * as feed from "../feed.js";
import type * as feedback_emails from "../feedback/emails.js";
import type * as feedback_feedback from "../feedback/feedback.js";
import type * as http from "../http.js";
import type * as interactions from "../interactions.js";
import type * as jobs_digest from "../jobs/digest.js";
import type * as jobs_processQueue from "../jobs/processQueue.js";
import type * as jobs_rankingSnapshot from "../jobs/rankingSnapshot.js";
import type * as jobs_refreshFeedEngagement from "../jobs/refreshFeedEngagement.js";
import type * as jobs_scrapeProfileApify from "../jobs/scrapeProfileApify.js";
import type * as jobs_survivalSnapshot from "../jobs/survivalSnapshot.js";
import type * as jobs_syncPosts from "../jobs/syncPosts.js";
import type * as jobs_syncPostsApify from "../jobs/syncPostsApify.js";
import type * as landingMetrics from "../landingMetrics.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_apify from "../lib/apify.js";
import type * as lib_articleValidator from "../lib/articleValidator.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_billingEmails from "../lib/billingEmails.js";
import type * as lib_checkoutCopy from "../lib/checkoutCopy.js";
import type * as lib_concurrency from "../lib/concurrency.js";
import type * as lib_cookies from "../lib/cookies.js";
import type * as lib_digest from "../lib/digest.js";
import type * as lib_digestEmails from "../lib/digestEmails.js";
import type * as lib_digestOptOut from "../lib/digestOptOut.js";
import type * as lib_discountGuard from "../lib/discountGuard.js";
import type * as lib_downgrade from "../lib/downgrade.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_emailLayout from "../lib/emailLayout.js";
import type * as lib_featuredPurchase from "../lib/featuredPurchase.js";
import type * as lib_feedHygiene from "../lib/feedHygiene.js";
import type * as lib_feedRank from "../lib/feedRank.js";
import type * as lib_fetchWithTimeout from "../lib/fetchWithTimeout.js";
import type * as lib_history from "../lib/history.js";
import type * as lib_html from "../lib/html.js";
import type * as lib_interactionGraph from "../lib/interactionGraph.js";
import type * as lib_interactionLimit from "../lib/interactionLimit.js";
import type * as lib_invite from "../lib/invite.js";
import type * as lib_landingVisitorKey from "../lib/landingVisitorKey.js";
import type * as lib_languages from "../lib/languages.js";
import type * as lib_pkce from "../lib/pkce.js";
import type * as lib_planLimits from "../lib/planLimits.js";
import type * as lib_planLimitsQuery from "../lib/planLimitsQuery.js";
import type * as lib_policy from "../lib/policy.js";
import type * as lib_portalConfig from "../lib/portalConfig.js";
import type * as lib_postCapNotice from "../lib/postCapNotice.js";
import type * as lib_postCounts from "../lib/postCounts.js";
import type * as lib_postLimit from "../lib/postLimit.js";
import type * as lib_profileOptions from "../lib/profileOptions.js";
import type * as lib_ranking from "../lib/ranking.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as lib_reactions from "../lib/reactions.js";
import type * as lib_recap from "../lib/recap.js";
import type * as lib_recordPost from "../lib/recordPost.js";
import type * as lib_safeText from "../lib/safeText.js";
import type * as lib_scrubError from "../lib/scrubError.js";
import type * as lib_stripePrices from "../lib/stripePrices.js";
import type * as lib_support from "../lib/support.js";
import type * as lib_survival from "../lib/survival.js";
import type * as lib_trialMilestone from "../lib/trialMilestone.js";
import type * as lib_unsubscribeToken from "../lib/unsubscribeToken.js";
import type * as linkedin_auth from "../linkedin/auth.js";
import type * as linkedin_client from "../linkedin/client.js";
import type * as linkedin_oauth from "../linkedin/oauth.js";
import type * as linkedin_parsePostContent from "../linkedin/parsePostContent.js";
import type * as linkedin_parsePostUrl from "../linkedin/parsePostUrl.js";
import type * as linkedin_tokenRefresh from "../linkedin/tokenRefresh.js";
import type * as linkedin_types from "../linkedin/types.js";
import type * as linkedin_verifyPostOwnership from "../linkedin/verifyPostOwnership.js";
import type * as migrations_backfillFeedFields from "../migrations/backfillFeedFields.js";
import type * as migrations_backfillInviteCodes from "../migrations/backfillInviteCodes.js";
import type * as migrations_normalizeContactFeaturedLimit from "../migrations/normalizeContactFeaturedLimit.js";
import type * as migrations_seedPlanLimits from "../migrations/seedPlanLimits.js";
import type * as motd_motd from "../motd/motd.js";
import type * as notifications from "../notifications.js";
import type * as posts from "../posts.js";
import type * as privacy_consent from "../privacy/consent.js";
import type * as privacy_deletion from "../privacy/deletion.js";
import type * as privacy_emails from "../privacy/emails.js";
import type * as privacy_export from "../privacy/export.js";
import type * as privacy_retention from "../privacy/retention.js";
import type * as rankings from "../rankings.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
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
  billingNotices: typeof billingNotices;
  crons: typeof crons;
  dev: typeof dev;
  feed: typeof feed;
  "feedback/emails": typeof feedback_emails;
  "feedback/feedback": typeof feedback_feedback;
  http: typeof http;
  interactions: typeof interactions;
  "jobs/digest": typeof jobs_digest;
  "jobs/processQueue": typeof jobs_processQueue;
  "jobs/rankingSnapshot": typeof jobs_rankingSnapshot;
  "jobs/refreshFeedEngagement": typeof jobs_refreshFeedEngagement;
  "jobs/scrapeProfileApify": typeof jobs_scrapeProfileApify;
  "jobs/survivalSnapshot": typeof jobs_survivalSnapshot;
  "jobs/syncPosts": typeof jobs_syncPosts;
  "jobs/syncPostsApify": typeof jobs_syncPostsApify;
  landingMetrics: typeof landingMetrics;
  "lib/access": typeof lib_access;
  "lib/apify": typeof lib_apify;
  "lib/articleValidator": typeof lib_articleValidator;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/billingEmails": typeof lib_billingEmails;
  "lib/checkoutCopy": typeof lib_checkoutCopy;
  "lib/concurrency": typeof lib_concurrency;
  "lib/cookies": typeof lib_cookies;
  "lib/digest": typeof lib_digest;
  "lib/digestEmails": typeof lib_digestEmails;
  "lib/digestOptOut": typeof lib_digestOptOut;
  "lib/discountGuard": typeof lib_discountGuard;
  "lib/downgrade": typeof lib_downgrade;
  "lib/email": typeof lib_email;
  "lib/emailLayout": typeof lib_emailLayout;
  "lib/featuredPurchase": typeof lib_featuredPurchase;
  "lib/feedHygiene": typeof lib_feedHygiene;
  "lib/feedRank": typeof lib_feedRank;
  "lib/fetchWithTimeout": typeof lib_fetchWithTimeout;
  "lib/history": typeof lib_history;
  "lib/html": typeof lib_html;
  "lib/interactionGraph": typeof lib_interactionGraph;
  "lib/interactionLimit": typeof lib_interactionLimit;
  "lib/invite": typeof lib_invite;
  "lib/landingVisitorKey": typeof lib_landingVisitorKey;
  "lib/languages": typeof lib_languages;
  "lib/pkce": typeof lib_pkce;
  "lib/planLimits": typeof lib_planLimits;
  "lib/planLimitsQuery": typeof lib_planLimitsQuery;
  "lib/policy": typeof lib_policy;
  "lib/portalConfig": typeof lib_portalConfig;
  "lib/postCapNotice": typeof lib_postCapNotice;
  "lib/postCounts": typeof lib_postCounts;
  "lib/postLimit": typeof lib_postLimit;
  "lib/profileOptions": typeof lib_profileOptions;
  "lib/ranking": typeof lib_ranking;
  "lib/rateLimit": typeof lib_rateLimit;
  "lib/reactions": typeof lib_reactions;
  "lib/recap": typeof lib_recap;
  "lib/recordPost": typeof lib_recordPost;
  "lib/safeText": typeof lib_safeText;
  "lib/scrubError": typeof lib_scrubError;
  "lib/stripePrices": typeof lib_stripePrices;
  "lib/support": typeof lib_support;
  "lib/survival": typeof lib_survival;
  "lib/trialMilestone": typeof lib_trialMilestone;
  "lib/unsubscribeToken": typeof lib_unsubscribeToken;
  "linkedin/auth": typeof linkedin_auth;
  "linkedin/client": typeof linkedin_client;
  "linkedin/oauth": typeof linkedin_oauth;
  "linkedin/parsePostContent": typeof linkedin_parsePostContent;
  "linkedin/parsePostUrl": typeof linkedin_parsePostUrl;
  "linkedin/tokenRefresh": typeof linkedin_tokenRefresh;
  "linkedin/types": typeof linkedin_types;
  "linkedin/verifyPostOwnership": typeof linkedin_verifyPostOwnership;
  "migrations/backfillFeedFields": typeof migrations_backfillFeedFields;
  "migrations/backfillInviteCodes": typeof migrations_backfillInviteCodes;
  "migrations/normalizeContactFeaturedLimit": typeof migrations_normalizeContactFeaturedLimit;
  "migrations/seedPlanLimits": typeof migrations_seedPlanLimits;
  "motd/motd": typeof motd_motd;
  notifications: typeof notifications;
  posts: typeof posts;
  "privacy/consent": typeof privacy_consent;
  "privacy/deletion": typeof privacy_deletion;
  "privacy/emails": typeof privacy_emails;
  "privacy/export": typeof privacy_export;
  "privacy/retention": typeof privacy_retention;
  rankings: typeof rankings;
  search: typeof search;
  seed: typeof seed;
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
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
