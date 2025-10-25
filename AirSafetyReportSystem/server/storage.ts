// Database storage implementation for all entities
import {
  users,
  reports,
  comments,
  attachments,
  type User,
  type UpsertUser,
  type Report,
  type InsertReport,
  type Comment,
  type InsertComment,
  type Attachment,
  type InsertAttachment,
  type ReportStats,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Report operations
  createReport(report: InsertReport): Promise<Report>;
  getReport(id: string): Promise<(Report & { submitter: User; comments: (Comment & { user: User })[]; }) | undefined>;
  getAllReports(filters?: { type?: string; status?: string }): Promise<(Report & { submitter: User })[]>;
  updateReportStatus(id: string, status: string): Promise<Report | undefined>;
  getReportStats(): Promise<ReportStats>;
  
  // Comment operations
  createComment(comment: InsertComment): Promise<Comment>;
  getCommentsByReportId(reportId: string): Promise<(Comment & { user: User })[]>;
  
  // Attachment operations
  createAttachment(attachment: InsertAttachment): Promise<Attachment>;
  getAttachment(id: string): Promise<Attachment | undefined>;
  getAttachmentsByReportId(reportId: string): Promise<Attachment[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Report operations
  async createReport(reportData: InsertReport): Promise<Report> {
    const [report] = await db
      .insert(reports)
      .values(reportData)
      .returning();
    return report;
  }

  async getReport(id: string): Promise<(Report & { submitter: User; comments: (Comment & { user: User })[]; }) | undefined> {
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id));

    if (!report) {
      return undefined;
    }

    const [submitter] = await db
      .select()
      .from(users)
      .where(eq(users.id, report.submittedBy));

    const reportComments = await db
      .select({
        comment: comments,
        user: users,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.reportId, id))
      .orderBy(comments.createdAt);

    return {
      ...report,
      submitter: submitter || {} as User,
      comments: reportComments.map(rc => ({
        ...rc.comment,
        user: rc.user || {} as User,
      })),
    };
  }

  async getAllReports(filters?: { type?: string; status?: string }): Promise<(Report & { submitter: User })[]> {
    let query = db
      .select({
        report: reports,
        submitter: users,
      })
      .from(reports)
      .leftJoin(users, eq(reports.submittedBy, users.id))
      .orderBy(desc(reports.createdAt));

    const conditions: any[] = [];
    
    if (filters?.type && filters.type !== 'all') {
      conditions.push(eq(reports.reportType, filters.type));
    }
    
    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(reports.status, filters.status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query;

    return results.map(r => ({
      ...r.report,
      submitter: r.submitter || {} as User,
    }));
  }

  async updateReportStatus(id: string, status: string): Promise<Report | undefined> {
    const [report] = await db
      .update(reports)
      .set({ status, updatedAt: new Date() })
      .where(eq(reports.id, id))
      .returning();
    return report;
  }

  async getReportStats(): Promise<ReportStats> {
    // Get total count
    const [totalResult] = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(reports);

    // Get counts by type
    const typeResults = await db
      .select({
        type: reports.reportType,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(reports)
      .groupBy(reports.reportType);

    // Get counts by status
    const statusResults = await db
      .select({
        status: reports.status,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(reports)
      .groupBy(reports.status);

    const byType: Record<string, number> = {};
    typeResults.forEach(r => {
      if (r.type) {
        byType[r.type] = r.count;
      }
    });

    const byStatus: Record<string, number> = {};
    statusResults.forEach(r => {
      if (r.status) {
        byStatus[r.status] = r.count;
      }
    });

    return {
      total: totalResult?.count || 0,
      byType,
      byStatus,
    };
  }

  // Comment operations
  async createComment(commentData: InsertComment): Promise<Comment> {
    const [comment] = await db
      .insert(comments)
      .values(commentData)
      .returning();
    return comment;
  }

  async getCommentsByReportId(reportId: string): Promise<(Comment & { user: User })[]> {
    const results = await db
      .select({
        comment: comments,
        user: users,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.reportId, reportId))
      .orderBy(comments.createdAt);

    return results.map(r => ({
      ...r.comment,
      user: r.user || {} as User,
    }));
  }

  // Attachment operations
  async createAttachment(attachmentData: InsertAttachment): Promise<Attachment> {
    const [attachment] = await db
      .insert(attachments)
      .values(attachmentData)
      .returning();
    return attachment;
  }

  async getAttachment(id: string): Promise<Attachment | undefined> {
    const [attachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, id));
    return attachment;
  }

  async getAttachmentsByReportId(reportId: string): Promise<Attachment[]> {
    return await db
      .select()
      .from(attachments)
      .where(eq(attachments.reportId, reportId))
      .orderBy(attachments.createdAt);
  }
}

export const storage = new DatabaseStorage();
