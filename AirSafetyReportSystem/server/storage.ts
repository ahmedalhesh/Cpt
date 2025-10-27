// Database storage implementation for all entities
import {
  users,
  reports,
  comments,
  attachments,
  companySettings,
  notifications,
  type User,
  type UpsertUser,
  type Report,
  type InsertReport,
  type Comment,
  type InsertComment,
  type Attachment,
  type InsertAttachment,
  type ReportStats,
  type CompanySettings,
  type UpsertCompanySettings,
  type Notification,
  type UpsertNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPassword(id: string, password: string): Promise<void>;
  
  // Report operations
  createReport(report: InsertReport): Promise<Report>;
  getReport(id: string): Promise<(Report & { submitter: User; comments: (Comment & { user: User })[]; }) | undefined>;
  getAllReports(filters?: { type?: string; status?: string }): Promise<(Report & { submitter: User })[]>;
  getUserReports(userId: string, filters?: { type?: string; status?: string }): Promise<(Report & { submitter: User })[]>;
  updateReportStatus(id: string, status: string): Promise<Report | undefined>;
  getReportStats(): Promise<ReportStats>;
  getUserReportStats(userId: string): Promise<ReportStats>;
  
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
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
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...userData, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUserPassword(id: string, password: string): Promise<void> {
    await db
      .update(users)
      .set({ password, updatedAt: new Date().toISOString() })
      .where(eq(users.id, id));
  }

  // Company Settings operations
  async getCompanySettings(): Promise<CompanySettings | null> {
    const [settings] = await db.select().from(companySettings).limit(1);
    return settings || null;
  }

  async updateCompanySettings(data: Partial<UpsertCompanySettings>): Promise<CompanySettings> {
    const existing = await this.getCompanySettings();
    
    if (existing) {
      const [updated] = await db
        .update(companySettings)
        .set({ ...data, updatedAt: new Date().toISOString() })
        .where(eq(companySettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(companySettings)
        .values({
          ...data,
          updatedAt: new Date().toISOString(),
        })
        .returning();
      return created;
    }
  }

  async deleteCompanyLogo(): Promise<void> {
    const existing = await this.getCompanySettings();
    if (existing) {
      await db
        .update(companySettings)
        .set({ logo: null, updatedAt: new Date().toISOString() })
        .where(eq(companySettings.id, existing.id));
    }
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

  async getUserReports(userId: string, filters?: { type?: string; status?: string }): Promise<(Report & { submitter: User })[]> {
    let query = db
      .select({
        report: reports,
        submitter: users,
      })
      .from(reports)
      .leftJoin(users, eq(reports.submittedBy, users.id))
      .where(eq(reports.submittedBy, userId));

    if (filters?.type && filters.type !== 'all') {
      query = query.where(eq(reports.reportType, filters.type));
    }

    if (filters?.status && filters.status !== 'all') {
      query = query.where(eq(reports.status, filters.status));
    }

    const results = await query.orderBy(desc(reports.createdAt));
    
    return results.map(r => ({
      ...r.report,
      submitter: r.submitter || {} as User,
    }));
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
    console.log(`💾 [STORAGE] Updating report status in database`);
    console.log(`💾 [STORAGE] Report ID: ${id}`);
    console.log(`💾 [STORAGE] New status: ${status}`);
    console.log(`💾 [STORAGE] Updated timestamp: ${new Date().toISOString()}`);
    
    try {
      const [report] = await db
        .update(reports)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(eq(reports.id, id))
        .returning();
      
      console.log(`✅ [STORAGE] Report status updated successfully`);
      console.log(`✅ [STORAGE] Updated report:`, {
        id: report?.id,
        status: report?.status,
        updatedAt: report?.updatedAt
      });
      
      return report;
    } catch (error) {
      console.error(`❌ [STORAGE] Database update failed:`, error);
      throw error;
    }
  }

  async getReportStats(): Promise<ReportStats> {
    // Get total count
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reports);

    // Get counts by type
    const typeResults = await db
      .select({
        type: reports.reportType,
        count: sql<number>`count(*)`,
      })
      .from(reports)
      .groupBy(reports.reportType);

    // Get counts by status
    const statusResults = await db
      .select({
        status: reports.status,
        count: sql<number>`count(*)`,
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

  async getUserReportStats(userId: string): Promise<ReportStats> {
    // Get total count for user's reports
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reports)
      .where(eq(reports.submittedBy, userId));

    // Get counts by type for user's reports
    const typeResults = await db
      .select({
        type: reports.reportType,
        count: sql<number>`count(*)`,
      })
      .from(reports)
      .where(eq(reports.submittedBy, userId))
      .groupBy(reports.reportType);

    // Get counts by status for user's reports
    const statusResults = await db
      .select({
        status: reports.status,
        count: sql<number>`count(*)`,
      })
      .from(reports)
      .where(eq(reports.submittedBy, userId))
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

  // Notification operations
  async createNotification(notificationData: UpsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    return notification;
  }

  async getNotifications(userId: string, filters?: { isRead?: boolean }): Promise<Notification[]> {
    let query = db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));

    if (filters?.isRead !== undefined) {
      query = query.where(eq(notifications.isRead, filters.isRead ? 1 : 0));
    }

    return await query.orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, 0)
      ));
    return result?.count || 0;
  }

  async markNotificationAsRead(notificationId: string): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: 1, updatedAt: new Date().toISOString() })
      .where(eq(notifications.id, notificationId))
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: 1, updatedAt: new Date().toISOString() })
      .where(eq(notifications.userId, userId));
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, notificationId));
  }

  // Auto-notification functions
  async createReportSubmittedNotification(reportId: string, submittedBy: string): Promise<void> {
    console.log(`🔔 [NOTIFICATIONS] Creating new report notification for report ${reportId.slice(0, 5).toUpperCase()}`);
    console.log(`🔔 [NOTIFICATIONS] Submitted by: ${submittedBy}`);
    
    // Get all admin users
    const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
    
    console.log(`📊 [NOTIFICATIONS] Found ${adminUsers.length} admin users`);
    
    for (const admin of adminUsers) {
      // Only notify admins who are not the submitter
      if (admin.id !== submittedBy) {
        console.log(`📤 [NOTIFICATIONS] Notifying admin: ${admin.email}`);
        await this.createNotification({
          userId: admin.id,
          title: 'New Report Submitted',
          message: `A new ${reportId.slice(0, 5).toUpperCase()} report has been submitted and requires review.`,
          type: 'info',
          isRead: 0,
          relatedReportId: reportId,
        });
      } else {
        console.log(`⏭️ [NOTIFICATIONS] Skipping admin notification (admin submitted the report)`);
      }
    }
  }

  async createReportStatusUpdatedNotification(reportId: string, userId: string, newStatus: string): Promise<void> {
    const statusMessages = {
      'in_review': 'Your report is now under review',
      'closed': 'Your report has been approved and closed',
      'rejected': 'Your report has been rejected'
    };

    const message = statusMessages[newStatus as keyof typeof statusMessages] || `Your report status has been updated to ${newStatus}`;

    await this.createNotification({
      userId: userId,
      title: 'Report Status Updated',
      message: message,
      type: newStatus === 'closed' ? 'success' : newStatus === 'rejected' ? 'error' : 'info',
      isRead: 0,
      relatedReportId: reportId,
    });
  }

  async createCommentAddedNotification(reportId: string, commenterId: string, commentText: string): Promise<void> {
    // Get the report to find the submitter
    const report = await this.getReport(reportId);
    if (!report) return;

    // Get commenter info
    const commenter = await this.getUser(commenterId);
    if (!commenter) return;

    console.log(`🔔 [NOTIFICATIONS] Creating comment notification for report ${reportId.slice(0, 5).toUpperCase()}`);
    console.log(`🔔 [NOTIFICATIONS] Commenter: ${commenter.firstName} ${commenter.lastName} (${commenter.role})`);
    console.log(`🔔 [NOTIFICATIONS] Report submitter: ${report.submittedBy}`);

    // Only notify the report submitter if they're not the one commenting
    if (report.submittedBy !== commenterId) {
      console.log(`📤 [NOTIFICATIONS] Notifying report submitter: ${report.submittedBy}`);
      await this.createNotification({
        userId: report.submittedBy,
        title: 'New Comment Added',
        message: `${commenter.firstName} ${commenter.lastName} added a comment on your report: "${commentText.slice(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
        type: 'info',
        isRead: 0,
        relatedReportId: reportId,
      });
    } else {
      console.log(`⏭️ [NOTIFICATIONS] Skipping notification for report submitter (they commented on their own report)`);
    }

    // Only notify admins if:
    // 1. The commenter is not an admin (to avoid self-notification)
    // 2. The admin is not the report submitter (already notified above)
    if (commenter.role !== 'admin') {
      console.log(`📤 [NOTIFICATIONS] Commenter is not admin, notifying admins...`);
      const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
      
      for (const admin of adminUsers) {
        if (admin.id !== report.submittedBy) {
          console.log(`📤 [NOTIFICATIONS] Notifying admin: ${admin.email}`);
          await this.createNotification({
            userId: admin.id,
            title: 'New Comment on Report',
            message: `${commenter.firstName} ${commenter.lastName} commented on report ${reportId.slice(0, 5).toUpperCase()}: "${commentText.slice(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
            type: 'info',
            isRead: 0,
            relatedReportId: reportId,
          });
        } else {
          console.log(`⏭️ [NOTIFICATIONS] Skipping admin notification (admin is the report submitter)`);
        }
      }
    } else {
      console.log(`⏭️ [NOTIFICATIONS] Commenter is admin, skipping admin notifications`);
    }
  }
}

export const storage = new DatabaseStorage();
