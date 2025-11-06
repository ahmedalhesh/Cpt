import { sql } from 'drizzle-orm';
import {
  index,
  sqliteTable,
  text,
  integer,
  real,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User storage table with role support
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text("email").unique(),
  password: text("password"), // Hashed password
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  role: text("role").notNull().default("captain"), // admin, captain, first_officer
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Company settings table
export const companySettings = sqliteTable("company_settings", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  companyName: text("company_name").notNull().default("Report Sys"),
  logo: text("logo"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export type UpsertCompanySettings = typeof companySettings.$inferInsert;
export type CompanySettings = typeof companySettings.$inferSelect;

// Notifications table
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"), // info, warning, error, success
  isRead: integer("is_read").notNull().default(0), // 0 = false, 1 = true
  relatedReportId: text("related_report_id").references(() => reports.id, { onDelete: "set null" }), // Changed from cascade to set null - notifications should persist even if report is deleted
  // Optional link to internal message
  relatedMessageId: text("related_message_id").references(() => messages.id, { onDelete: "set null" }),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export type UpsertNotification = typeof notifications.$inferInsert;
export type Notification = typeof notifications.$inferSelect;

// Reports table - stores all report types
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportType: text("report_type").notNull(), // asr, or, rir, ncr, cdf, chr
  status: text("status").notNull().default("submitted"), // submitted, in_review, closed, rejected
  submittedBy: text("submitted_by").notNull().references(() => users.id),
  isAnonymous: integer("is_anonymous").notNull().default(0), // 1 for CHR anonymous reports
  
  // Common fields
  description: text("description").notNull(),
  
  // Air Safety Report (ASR) fields
  flightNumber: text("flight_number"),
  aircraftType: text("aircraft_type"),
  route: text("route"),
  eventDateTime: text("event_date_time"),
  contributingFactors: text("contributing_factors"),
  correctiveActions: text("corrective_actions"),

  // ASR plot images and metadata
  planImage: text("plan_image"), // data URL (base64 PNG)
  elevImage: text("elev_image"), // data URL (base64 PNG)
  planUnits: text("plan_units"), // 'M' or 'NM'
  planGridX: integer("plan_grid_x"),
  planGridY: integer("plan_grid_y"),
  planDistanceX: real("plan_distance_x"),
  planDistanceY: real("plan_distance_y"),
  elevGridCol: integer("elev_grid_col"),
  elevGridRow: integer("elev_grid_row"),
  elevDistanceHorizM: real("elev_distance_horiz_m"),
  elevDistanceVertFt: real("elev_distance_vert_ft"),
  
  // Occurrence Report (OR) fields
  location: text("location"),
  phaseOfFlight: text("phase_of_flight"),
  riskLevel: text("risk_level"), // low, medium, high, critical
  followUpActions: text("follow_up_actions"),
  
  // Ramp Incident Report (RIR) fields
  groundCrewNames: text("ground_crew_names"),
  vehicleInvolved: text("vehicle_involved"),
  damageType: text("damage_type"),
  correctiveSteps: text("corrective_steps"),
  
  // Nonconformity Report (NCR) fields
  department: text("department"),
  nonconformityType: text("nonconformity_type"),
  rootCause: text("root_cause"),
  responsiblePerson: text("responsible_person"),
  preventiveActions: text("preventive_actions"),

  // Generic extra data (JSON string) for various report forms
  extraData: text("extra_data"),
  
  // Commander's Discretion Report (CDR) fields
  discretionReason: text("discretion_reason"),
  timeExtension: text("time_extension"),
  crewFatigueDetails: text("crew_fatigue_details"),
  finalDecision: text("final_decision"),
  
  // Confidential Hazard Report (CHR) fields
  potentialImpact: text("potential_impact"),
  preventionSuggestions: text("prevention_suggestions"),
  
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

export const reportsRelations = relations(reports, ({ one, many }) => ({
  submitter: one(users, {
    fields: [reports.submittedBy],
    references: [users.id],
  }),
  comments: many(comments),
  attachments: many(attachments),
}));

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

export const insertReportSchema = createInsertSchema(reports, {
  // Make ALL fields optional - using nullish() allows null, undefined, or value
  reportType: (schema) => schema.nullish(),
  status: (schema) => schema.nullish(),
  submittedBy: (schema) => schema.nullish(), // Will be set by server from auth
  isAnonymous: (schema) => schema.nullish(),
  description: (schema) => schema.nullish(),
  
  // Numeric fields - remove min validation when making optional
  planGridX: (schema) => schema.nullish(),
  planGridY: (schema) => schema.nullish(),
  planDistanceX: (schema) => schema.nullish(),
  planDistanceY: (schema) => schema.nullish(),
  elevGridCol: (schema) => schema.nullish(),
  elevGridRow: (schema) => schema.nullish(),
  elevDistanceHorizM: (schema) => schema.nullish(),
  elevDistanceVertFt: (schema) => schema.nullish(),
  
  // Image fields
  planImage: (schema) => schema.nullish(),
  elevImage: (schema) => schema.nullish(),
  
  // Text fields - all optional
  flightNumber: (schema) => schema.nullish(),
  aircraftType: (schema) => schema.nullish(),
  route: (schema) => schema.nullish(),
  eventDateTime: (schema) => schema.nullish(),
  contributingFactors: (schema) => schema.nullish(),
  correctiveActions: (schema) => schema.nullish(),
  location: (schema) => schema.nullish(),
  phaseOfFlight: (schema) => schema.nullish(),
  riskLevel: (schema) => schema.nullish(),
  followUpActions: (schema) => schema.nullish(),
  planUnits: (schema) => schema.nullish(),
  extraData: (schema) => schema.nullish(),
  
  // RIR fields
  groundCrewNames: (schema) => schema.nullish(),
  vehicleInvolved: (schema) => schema.nullish(),
  damageType: (schema) => schema.nullish(),
  correctiveSteps: (schema) => schema.nullish(),
  
  // NCR fields
  department: (schema) => schema.nullish(),
  nonconformityType: (schema) => schema.nullish(),
  rootCause: (schema) => schema.nullish(),
  responsiblePerson: (schema) => schema.nullish(),
  preventiveActions: (schema) => schema.nullish(),
  
  // CDR fields
  discretionReason: (schema) => schema.nullish(),
  timeExtension: (schema) => schema.nullish(),
  crewFatigueDetails: (schema) => schema.nullish(),
  finalDecision: (schema) => schema.nullish(),
  
  // CHR fields
  potentialImpact: (schema) => schema.nullish(),
  preventionSuggestions: (schema) => schema.nullish(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).passthrough(); // Allow extra fields that are not in the schema (will be ignored by drizzle)

export type InsertReportData = z.infer<typeof insertReportSchema>;

// Comments table
export const comments = sqliteTable("comments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportId: text("report_id").notNull().references(() => reports.id, { onDelete: 'cascade' }),
  userId: text("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const commentsRelations = relations(comments, ({ one }) => ({
  report: one(reports, {
    fields: [comments.reportId],
    references: [reports.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

export const insertCommentSchema = createInsertSchema(comments).omit({
  id: true,
  createdAt: true,
});

export type InsertCommentData = z.infer<typeof insertCommentSchema>;

// Attachments table
export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reportId: text("report_id").notNull().references(() => reports.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  report: one(reports, {
    fields: [attachments.reportId],
    references: [reports.id],
  }),
}));

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = typeof attachments.$inferInsert;

export const insertAttachmentSchema = createInsertSchema(attachments).omit({
  id: true,
  createdAt: true,
});

export type InsertAttachmentData = z.infer<typeof insertAttachmentSchema>;

// Helper types for report statistics
export type ReportStats = {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
};

// =========================
// Internal Messaging System
// =========================
export const messages = sqliteTable("messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  senderId: text("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const messageRecipients = sqliteTable("message_recipients", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  messageId: text("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  recipientId: text("recipient_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("unread"), // unread | read | deleted
  readAt: text("read_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return {
    byRecipientStatus: index("idx_msg_recipient_status").on(table.recipientId, table.status, table.createdAt),
    byMessage: index("idx_msg_message").on(table.messageId),
  };
});

export const messagesRelations = relations(messages, ({ one, many }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  recipients: many(messageRecipients),
}));

export const messageRecipientsRelations = relations(messageRecipients, ({ one }) => ({
  message: one(messages, {
    fields: [messageRecipients.messageId],
    references: [messages.id],
  }),
  recipient: one(users, {
    fields: [messageRecipients.recipientId],
    references: [users.id],
  }),
}));

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;
export type MessageRecipient = typeof messageRecipients.$inferSelect;
export type InsertMessageRecipient = typeof messageRecipients.$inferInsert;

