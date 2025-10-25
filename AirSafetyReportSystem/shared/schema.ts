import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table with role support
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 50 }).notNull().default("captain"), // captain, safety_officer, administrator
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Reports table - stores all report types
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportType: varchar("report_type", { length: 50 }).notNull(), // asr, or, rir, ncr, cdf, chr
  status: varchar("status", { length: 50 }).notNull().default("submitted"), // submitted, in_review, closed, rejected
  submittedBy: varchar("submitted_by").notNull().references(() => users.id),
  isAnonymous: integer("is_anonymous").notNull().default(0), // 1 for CHR anonymous reports
  
  // Common fields
  description: text("description").notNull(),
  
  // Air Safety Report (ASR) fields
  flightNumber: varchar("flight_number", { length: 20 }),
  aircraftType: varchar("aircraft_type", { length: 100 }),
  route: varchar("route", { length: 200 }),
  eventDateTime: timestamp("event_date_time"),
  contributingFactors: text("contributing_factors"),
  correctiveActions: text("corrective_actions"),
  
  // Occurrence Report (OR) fields
  location: varchar("location", { length: 200 }),
  phaseOfFlight: varchar("phase_of_flight", { length: 100 }),
  riskLevel: varchar("risk_level", { length: 50 }), // low, medium, high, critical
  followUpActions: text("follow_up_actions"),
  
  // Ramp Incident Report (RIR) fields
  groundCrewNames: text("ground_crew_names"),
  vehicleInvolved: varchar("vehicle_involved", { length: 200 }),
  damageType: varchar("damage_type", { length: 200 }),
  correctiveSteps: text("corrective_steps"),
  
  // Nonconformity Report (NCR) fields
  department: varchar("department", { length: 100 }),
  nonconformityType: varchar("nonconformity_type", { length: 200 }),
  rootCause: text("root_cause"),
  responsiblePerson: varchar("responsible_person", { length: 200 }),
  preventiveActions: text("preventive_actions"),
  
  // Commander's Discretion Form (CDF) fields
  discretionReason: text("discretion_reason"),
  timeExtension: varchar("time_extension", { length: 100 }),
  crewFatigueDetails: text("crew_fatigue_details"),
  finalDecision: text("final_decision"),
  
  // Confidential Hazard Report (CHR) fields
  potentialImpact: text("potential_impact"),
  preventionSuggestions: text("prevention_suggestions"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertReportData = z.infer<typeof insertReportSchema>;

// Comments table
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull().references(() => reports.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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
export const attachments = pgTable("attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").notNull().references(() => reports.id, { onDelete: 'cascade' }),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileType: varchar("file_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
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
