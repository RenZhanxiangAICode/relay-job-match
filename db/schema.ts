import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  emailVerifiedAt: integer("email_verified_at", { mode: "timestamp" }),
  reputation: integer("reputation").notNull().default(80),
  status: text("status", { enum: ["active", "suspended", "banned"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [uniqueIndex("users_email_unique").on(table.email)]);

export const emailVerificationCodes = sqliteTable("email_verification_codes", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  sentAt: integer("sent_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("sessions_user_idx").on(table.userId)]);

export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["role", "talent"] }).notNull(),
  anonymousCode: text("anonymous_code").notNull(),
  payload: text("payload", { mode: "json" }).$type<Record<string, unknown>>().notNull(),
  searchText: text("search_text").notNull().default(""),
  embedding: text("embedding", { mode: "json" }).$type<number[]>().notNull().default("[]"),
  contentVersion: integer("content_version").notNull().default(1),
  lastMatchedWeek: text("last_matched_week"),
  completion: integer("completion").notNull().default(0),
  status: text("status", { enum: ["draft", "pooled", "paused", "removed"] }).notNull().default("draft"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
}, (table) => [
  uniqueIndex("profiles_user_type_unique").on(table.userId, table.type),
  uniqueIndex("profiles_anonymous_code_unique").on(table.anonymousCode),
  index("profiles_pool_idx").on(table.type, table.status),
]);

export const profileKeywords = sqliteTable("profile_keywords", {
  profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  type: text("type", { enum: ["role", "talent"] }).notNull(),
  weight: integer("weight").notNull().default(1),
}, (table) => [
  primaryKey({ columns: [table.profileId, table.keyword] }),
  index("profile_keywords_lookup_idx").on(table.type, table.keyword),
]);

export const publicationCycles = sqliteTable("publication_cycles", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type", { enum: ["role", "talent"] }).notNull(),
  monthKey: text("month_key").notNull(),
  deleteCount: integer("delete_count").notNull().default(0),
  recreateCount: integer("recreate_count").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.userId, table.type, table.monthKey] })]);

export const aiParseUsage = sqliteTable("ai_parse_usage", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  dayKey: text("day_key").notNull(),
  requestCount: integer("request_count").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.userId, table.dayKey] })]);

export const matchRuns = sqliteTable("match_runs", {
  profileId: text("profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  weekKey: text("week_key").notNull(),
  contentVersion: integer("content_version").notNull(),
  candidateCount: integer("candidate_count").notNull().default(0),
  matchedCount: integer("matched_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [primaryKey({ columns: [table.profileId, table.weekKey] })]);

export const matchExclusions = sqliteTable("match_exclusions", {
  roleProfileId: text("role_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  talentProfileId: text("talent_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  reason: text("reason", { enum: ["hidden", "cancelled", "reported"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [primaryKey({ columns: [table.roleProfileId, table.talentProfileId] })]);

export const matches = sqliteTable("matches", {
  id: text("id").primaryKey(),
  roleProfileId: text("role_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  talentProfileId: text("talent_profile_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
  score: integer("score").notNull(),
  reasons: text("reasons", { mode: "json" }).$type<string[]>().notNull(),
  risks: text("risks", { mode: "json" }).$type<string[]>().notNull(),
  verifyOnMeeting: text("verify_on_meeting", { mode: "json" }).$type<string[]>().notNull(),
  weekKey: text("week_key").notNull(),
  roleDecision: text("role_decision", { enum: ["pending", "interested", "hidden"] }).notNull().default("pending"),
  talentDecision: text("talent_decision", { enum: ["pending", "interested", "hidden"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("matches_pair_week_unique").on(table.roleProfileId, table.talentProfileId, table.weekKey),
  index("matches_role_week_idx").on(table.roleProfileId, table.weekKey),
  index("matches_talent_week_idx").on(table.talentProfileId, table.weekKey),
]);

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull().references(() => matches.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [uniqueIndex("conversations_match_unique").on(table.matchId)]);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("messages_conversation_time_idx").on(table.conversationId, table.createdAt)]);

export const reputationEvents = sqliteTable("reputation_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason", { enum: ["successful_match", "positive_review", "false_profile", "fraud", "malicious_report", "malicious_jury", "appeal_correction"] }).notNull(),
  delta: integer("delta").notNull(),
  evidenceRef: text("evidence_ref"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("reputation_user_time_idx").on(table.userId, table.createdAt)]);

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportedUserId: text("reported_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: text("category", { enum: ["false_job", "false_resume", "fraud", "harassment", "other"] }).notNull(),
  summary: text("summary").notNull(),
  evidence: text("evidence", { mode: "json" }).$type<string[]>().notNull(),
  status: text("status", { enum: ["jury", "banned", "dismissed", "appealed", "closed"] }).notNull().default("jury"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("reports_status_idx").on(table.status, table.createdAt)]);

export const juryAssignments = sqliteTable("jury_assignments", {
  reportId: text("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  jurorId: text("juror_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: integer("assigned_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.reportId, table.jurorId] }),
  index("jury_assignments_juror_idx").on(table.jurorId, table.expiresAt),
]);

export const juryVotes = sqliteTable("jury_votes", {
  reportId: text("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  jurorId: text("juror_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  verdict: text("verdict", { enum: ["ban", "keep"] }).notNull(),
  votedAt: integer("voted_at", { mode: "timestamp" }).notNull(),
  upheldAfterAppeal: integer("upheld_after_appeal", { mode: "boolean" }),
}, (table) => [primaryKey({ columns: [table.reportId, table.jurorId] })]);

export const appeals = sqliteTable("appeals", {
  id: text("id").primaryKey(),
  reportId: text("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  statement: text("statement").notNull(),
  status: text("status", { enum: ["pending", "upheld", "reversed"] }).notNull().default("pending"),
  reviewedBy: text("reviewed_by").references(() => users.id),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [uniqueIndex("appeals_report_unique").on(table.reportId)]);
