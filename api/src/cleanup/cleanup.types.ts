/** All TTLs are expressed in milliseconds so the policy is unit-agnostic. */
export type CleanupTtls = {
  guestSessionMs: number;
  authedSessionMs: number;
  userMs: number;
};

/** What the pure policy decides should be removed. */
export type CleanupPlan = {
  expiredUserIds: string[];
  expiredSessionSids: string[];
};

/** What the service actually removed, for logging and test assertions. */
export type CleanupSummary = {
  sessionsRemoved: number;
  usersRemoved: number;
  cartsRemoved: number;
  sharesRemoved: number;
};
