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
  messages,
  messageRecipients,
  type Message,
  type InsertMessage,
  type MessageRecipient,
  type InsertMessageRecipient,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByName(firstName: string, lastName: string): Promise<User | undefined>;
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

  // Messaging operations
  createMessage(message: InsertMessage): Promise<Message>;
  addMessageRecipients(recipients: InsertMessageRecipient[]): Promise<void>;
  getInbox(userId: string, opts?: { status?: string; limit?: number; offset?: number }): Promise<(MessageRecipient & { message: Message; sender: User })[]>;
  getSentMessages(senderId: string, opts?: { limit?: number; offset?: number }): Promise<(Message & { recipientsCount: number; readCount: number })[]>;
  getMessageForUser(messageId: string, userId: string): Promise<(Message & { sender: User; recipients: (MessageRecipient & { user: User })[] }) | undefined>;
  markMessageRead(messageId: string, userId: string): Promise<void>;
  getUnreadMessagesCount(userId: string): Promise<number>;
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

  async getUserByName(firstName: string, lastName: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(
        eq(users.firstName, firstName),
        eq(users.lastName, lastName)
      )
    );
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

    // Parse extraData from JSON string to object if it exists
    let parsedExtraData = null;
    if (report.extraData && typeof report.extraData === 'string') {
      try {
        parsedExtraData = JSON.parse(report.extraData);
      } catch (e) {
        // If parsing fails, keep it as is (might be plain text)
        parsedExtraData = report.extraData;
      }
    } else if (report.extraData) {
      parsedExtraData = report.extraData;
    }

    return {
      ...report,
      extraData: parsedExtraData,
      submitter: submitter || {} as User,
      comments: reportComments.map(rc => ({
        ...rc.comment,
        user: rc.user || {} as User,
      })),
    };
  }

  async getUserReports(userId: string, filters?: { type?: string; status?: string }): Promise<(Report & { submitter: User })[]> {
    // Build conditions array
    const conditions: any[] = [eq(reports.submittedBy, userId)];
    
    if (filters?.type && filters.type !== 'all') {
      conditions.push(eq(reports.reportType, filters.type));
    }

    if (filters?.status && filters.status !== 'all') {
      conditions.push(eq(reports.status, filters.status));
    }

    const query = db
      .select({
        report: reports,
        submitter: users,
      })
      .from(reports)
      .leftJoin(users, eq(reports.submittedBy, users.id))
      .where(and(...conditions));

    const results = await query.orderBy(desc(reports.createdAt));
    
    // Helper function to parse extraData from JSON string
    const parseExtraData = (extraData: any) => {
      if (!extraData) return null;
      if (typeof extraData === 'string') {
        try {
          return JSON.parse(extraData);
        } catch (e) {
          return extraData; // Keep as is if parsing fails
        }
      }
      return extraData;
    };
    
    return results.map(r => ({
      ...r.report,
      extraData: parseExtraData(r.report.extraData),
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

    // Helper function to parse extraData from JSON string
    const parseExtraData = (extraData: any) => {
      if (!extraData) return null;
      if (typeof extraData === 'string') {
        try {
          return JSON.parse(extraData);
        } catch (e) {
          return extraData; // Keep as is if parsing fails
        }
      }
      return extraData;
    };

    return results.map(r => ({
      ...r.report,
      extraData: parseExtraData(r.report.extraData),
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

  // ======================
  // Messaging operations
  // ======================
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const [msg] = await db.insert(messages).values(messageData).returning();
    return msg;
  }

  async addMessageRecipients(recipients: InsertMessageRecipient[]): Promise<void> {
    if (recipients.length === 0) return;
    await db.insert(messageRecipients).values(recipients);
  }

  async getInbox(userId: string, opts?: { status?: string; limit?: number; offset?: number }): Promise<(MessageRecipient & { message: Message; sender: User })[]> {
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    // Filter by status unless 'all'
    const conditions: any[] = [eq(messageRecipients.recipientId, userId)];
    if (opts?.status && opts.status !== 'all') {
      conditions.push(eq(messageRecipients.status, opts.status));
    }
    const rows = await db
      .select({
        mr: messageRecipients,
        msg: messages,
        sender: users,
      })
      .from(messageRecipients)
      .leftJoin(messages, eq(messageRecipients.messageId, messages.id))
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(and(...conditions))
      .orderBy(desc(messageRecipients.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map(r => ({
      ...r.mr,
      message: r.msg as Message,
      sender: r.sender as User,
    }));
  }

  async getSentMessages(senderId: string, opts?: { limit?: number; offset?: number }): Promise<(Message & { recipientsCount: number; readCount: number })[]> {
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    const msgRows = await db
      .select()
      .from(messages)
      .where(eq(messages.senderId, senderId))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(offset);
    if (msgRows.length === 0) return [];
    const ids = msgRows.map(m => m.id);
    const recAgg = await db
      .select({
        messageId: messageRecipients.messageId,
        total: sql<number>`count(*)`,
        readCount: sql<number>`sum(case when ${messageRecipients.status} = 'read' then 1 else 0 end)`,
      })
      .from(messageRecipients)
      .where(inArray(messageRecipients.messageId, ids))
      .groupBy(messageRecipients.messageId);
    const aggMap = new Map(recAgg.map(a => [a.messageId, a]));
    return msgRows.map(m => {
      const a = aggMap.get(m.id);
      return {
        ...m,
        recipientsCount: a?.total ?? 0,
        readCount: a?.readCount ?? 0,
      };
    });
  }

  async getMessageForUser(messageId: string, userId: string): Promise<(Message & { sender: User; recipients: (MessageRecipient & { user: User })[] }) | undefined> {
    // Check if user is sender or recipient
    const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
    if (!msg) return undefined;
    const isSender = msg.senderId === userId;
    const isRecipient = (await db.select().from(messageRecipients)
      .where(and(eq(messageRecipients.messageId, messageId), eq(messageRecipients.recipientId, userId)))).length > 0;
    if (!isSender && !isRecipient) return undefined;
    const [sender] = await db.select().from(users).where(eq(users.id, msg.senderId));
    const recipientRows = await db
      .select({ mr: messageRecipients, u: users })
      .from(messageRecipients)
      .leftJoin(users, eq(messageRecipients.recipientId, users.id))
      .where(eq(messageRecipients.messageId, messageId));
    return {
      ...msg,
      sender: sender as User,
      recipients: recipientRows.map(r => ({ ...r.mr, user: r.u as User })) as any,
    };
  }

  async markMessageRead(messageId: string, userId: string): Promise<void> {
    await db
      .update(messageRecipients)
      .set({ status: 'read', readAt: new Date().toISOString() })
      .where(and(eq(messageRecipients.messageId, messageId), eq(messageRecipients.recipientId, userId)));
  }

  async getUnreadMessagesCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(messageRecipients)
      .where(and(eq(messageRecipients.recipientId, userId), eq(messageRecipients.status, 'unread')));
    return result?.count ?? 0;
  }

  // Notification operations
  async createNotification(notificationData: UpsertNotification): Promise<Notification> {
    console.log('📝 [CREATE NOTIFICATION] Creating notification:', {
      userId: notificationData.userId,
      title: notificationData.title,
      type: notificationData.type,
      hasRelatedReport: !!notificationData.relatedReportId
    });
    
    try {
      const [notification] = await db
        .insert(notifications)
        .values(notificationData)
        .returning();
      
      console.log('✅ [CREATE NOTIFICATION] Notification created successfully:', {
        id: notification.id,
        userId: notification.userId,
        title: notification.title
      });
      
      return notification;
    } catch (error: any) {
      console.error('❌ [CREATE NOTIFICATION] Failed to create notification:', error);
      console.error('❌ [CREATE NOTIFICATION] Error details:', {
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      });
      throw error;
    }
  }

  async getNotifications(userId: string, filters?: { isRead?: boolean }): Promise<Notification[]> {
    // Build conditions array
    const conditions: any[] = [eq(notifications.userId, userId)];

    if (filters?.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, filters.isRead ? 1 : 0));
    }

    const query = db
      .select()
      .from(notifications)
      .where(and(...conditions)) as any;

    const results = await query.orderBy(desc(notifications.createdAt));
    
    // Convert isRead from integer (0/1) to boolean for client
    return results.map((n: any) => ({
      ...n,
      isRead: n.isRead === 1,
    })) as Notification[];
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
    
    if (!notification) return undefined;
    
    // Convert isRead from integer (0/1) to boolean
    const notificationWithBool = notification as any;
    return {
      ...notificationWithBool,
      isRead: notificationWithBool.isRead === 1,
    } as Notification;
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

  async deleteAllNotifications(userId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  }

  // Auto-notification functions
  async createReportSubmittedNotification(reportId: string, submittedBy: string): Promise<void> {
    console.log('🔔 [REPORT NOTIFICATION] ========== START ==========');
    console.log(`🔔 [REPORT NOTIFICATION] Report ID: ${reportId}`);
    console.log(`🔔 [REPORT NOTIFICATION] Report ID (short): ${reportId.slice(0, 5).toUpperCase()}`);
    console.log(`🔔 [REPORT NOTIFICATION] Submitted by user ID: ${submittedBy}`);
    
    try {
      // Get all admin users
      console.log('🔔 [REPORT NOTIFICATION] Querying database for admin users...');
      const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
      
      console.log(`📊 [REPORT NOTIFICATION] Database query completed`);
      console.log(`📊 [REPORT NOTIFICATION] Found ${adminUsers.length} admin user(s) in database`);
      
      if (adminUsers.length > 0) {
        console.log('📊 [REPORT NOTIFICATION] Admin users details:');
        adminUsers.forEach((admin, index) => {
          console.log(`  ${index + 1}. ${admin.email} (${admin.id}) - Role: ${admin.role}`);
        });
      }
      
      if (adminUsers.length === 0) {
        console.log(`⚠️ [REPORT NOTIFICATION] ❌ NO ADMIN USERS FOUND IN DATABASE!`);
        console.log(`⚠️ [REPORT NOTIFICATION] This means notifications will NOT be created.`);
        console.log(`⚠️ [REPORT NOTIFICATION] Please ensure at least one user has role='admin' in the database.`);
        return;
      }
      
      let notificationsCreated = 0;
      let skippedCount = 0;
      
      for (const admin of adminUsers) {
        console.log(`\n🔔 [REPORT NOTIFICATION] Processing admin: ${admin.email}`);
        console.log(`🔔 [REPORT NOTIFICATION] Admin ID: ${admin.id}`);
        console.log(`🔔 [REPORT NOTIFICATION] Submitter ID: ${submittedBy}`);
        console.log(`🔔 [REPORT NOTIFICATION] Admin is submitter? ${admin.id === submittedBy}`);
        
        // Only notify admins who are not the submitter
        if (admin.id !== submittedBy) {
          try {
            console.log(`📤 [REPORT NOTIFICATION] ✅ Admin is NOT the submitter, creating notification...`);
            const notification = await this.createNotification({
              userId: admin.id,
              title: 'New Report Submitted',
              message: `A new ${reportId.slice(0, 5).toUpperCase()} report has been submitted and requires review.`,
              type: 'info',
              isRead: 0,
              relatedReportId: reportId,
            });
            
            notificationsCreated++;
            console.log(`✅ [REPORT NOTIFICATION] ✅ Notification #${notificationsCreated} created successfully`);
            console.log(`✅ [REPORT NOTIFICATION] Notification ID: ${notification.id}`);
          } catch (error: any) {
            console.error(`❌ [REPORT NOTIFICATION] ❌ FAILED to create notification for admin ${admin.email}`);
            console.error(`❌ [REPORT NOTIFICATION] Error:`, error?.message);
            console.error(`❌ [REPORT NOTIFICATION] Stack:`, error?.stack);
          }
        } else {
          skippedCount++;
          console.log(`⏭️ [REPORT NOTIFICATION] ⏭️ Skipping admin (admin submitted the report)`);
        }
      }
      
      console.log(`\n🔔 [REPORT NOTIFICATION] ========== SUMMARY ==========`);
      console.log(`📊 [REPORT NOTIFICATION] Total admins found: ${adminUsers.length}`);
      console.log(`✅ [REPORT NOTIFICATION] Notifications created: ${notificationsCreated}`);
      console.log(`⏭️ [REPORT NOTIFICATION] Admins skipped: ${skippedCount}`);
      console.log(`🔔 [REPORT NOTIFICATION] ========== END ==========\n`);
    } catch (error: any) {
      console.error(`❌ [REPORT NOTIFICATION] ❌ CRITICAL ERROR in createReportSubmittedNotification`);
      console.error(`❌ [REPORT NOTIFICATION] Error message:`, error?.message);
      console.error(`❌ [REPORT NOTIFICATION] Error stack:`, error?.stack);
      throw error;
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
    console.log('💬 [COMMENT NOTIFICATION] ========== START ==========');
    console.log(`💬 [COMMENT NOTIFICATION] Report ID: ${reportId}`);
    console.log(`💬 [COMMENT NOTIFICATION] Commenter ID: ${commenterId}`);
    console.log(`💬 [COMMENT NOTIFICATION] Comment preview: ${commentText?.substring(0, 50)}`);
    
    try {
      // Get the report to find the submitter
      console.log('💬 [COMMENT NOTIFICATION] Fetching report from database...');
      const report = await this.getReport(reportId);
      if (!report) {
        console.log(`❌ [COMMENT NOTIFICATION] ❌ Report not found: ${reportId}`);
        return;
      }
      console.log(`✅ [COMMENT NOTIFICATION] Report found. Submitter: ${report.submittedBy}`);

      // Get commenter info
      console.log('💬 [COMMENT NOTIFICATION] Fetching commenter from database...');
      const commenter = await this.getUser(commenterId);
      if (!commenter) {
        console.log(`❌ [COMMENT NOTIFICATION] ❌ Commenter not found: ${commenterId}`);
        return;
      }
      console.log(`✅ [COMMENT NOTIFICATION] Commenter found: ${commenter.firstName} ${commenter.lastName} (Role: ${commenter.role})`);

      let notificationsCreated = 0;

      // Only notify the report submitter if they're not the one commenting
      console.log(`\n💬 [COMMENT NOTIFICATION] Checking if submitter should be notified...`);
      console.log(`💬 [COMMENT NOTIFICATION] Report submitter ID: ${report.submittedBy}`);
      console.log(`💬 [COMMENT NOTIFICATION] Commenter ID: ${commenterId}`);
      console.log(`💬 [COMMENT NOTIFICATION] Same person? ${report.submittedBy === commenterId}`);
      
      if (report.submittedBy !== commenterId) {
        try {
          console.log(`📤 [COMMENT NOTIFICATION] ✅ Submitter is NOT the commenter, creating notification...`);
          const notification = await this.createNotification({
            userId: report.submittedBy,
            title: 'New Comment Added',
            message: `${commenter.firstName} ${commenter.lastName} added a comment on your report: "${commentText.slice(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
            type: 'info',
            isRead: 0,
            relatedReportId: reportId,
          });
          notificationsCreated++;
          console.log(`✅ [COMMENT NOTIFICATION] ✅ Notification #${notificationsCreated} created for submitter`);
          console.log(`✅ [COMMENT NOTIFICATION] Notification ID: ${notification.id}`);
        } catch (error: any) {
          console.error(`❌ [COMMENT NOTIFICATION] ❌ FAILED to create notification for submitter`);
          console.error(`❌ [COMMENT NOTIFICATION] Error:`, error?.message);
          console.error(`❌ [COMMENT NOTIFICATION] Stack:`, error?.stack);
        }
      } else {
        console.log(`⏭️ [COMMENT NOTIFICATION] ⏭️ Skipping submitter notification (they commented on their own report)`);
      }

      // Only notify admins if commenter is not admin
      console.log(`\n💬 [COMMENT NOTIFICATION] Checking if admins should be notified...`);
      console.log(`💬 [COMMENT NOTIFICATION] Commenter role: ${commenter.role}`);
      console.log(`💬 [COMMENT NOTIFICATION] Commenter is admin? ${commenter.role === 'admin'}`);
      
      if (commenter.role !== 'admin') {
        console.log(`📤 [COMMENT NOTIFICATION] ✅ Commenter is NOT admin, querying admin users...`);
        const adminUsers = await db.select().from(users).where(eq(users.role, 'admin'));
        
        console.log(`📊 [COMMENT NOTIFICATION] Found ${adminUsers.length} admin user(s) in database`);
        
        if (adminUsers.length > 0) {
          console.log('📊 [COMMENT NOTIFICATION] Admin users details:');
          adminUsers.forEach((admin, index) => {
            console.log(`  ${index + 1}. ${admin.email} (${admin.id}) - Role: ${admin.role}`);
          });
        }
        
        if (adminUsers.length === 0) {
          console.log(`⚠️ [COMMENT NOTIFICATION] ❌ NO ADMIN USERS FOUND IN DATABASE!`);
        }
        
        for (const admin of adminUsers) {
          console.log(`\n💬 [COMMENT NOTIFICATION] Processing admin: ${admin.email}`);
          console.log(`💬 [COMMENT NOTIFICATION] Admin ID: ${admin.id}`);
          console.log(`💬 [COMMENT NOTIFICATION] Report submitter ID: ${report.submittedBy}`);
          console.log(`💬 [COMMENT NOTIFICATION] Admin is submitter? ${admin.id === report.submittedBy}`);
          
          if (admin.id !== report.submittedBy) {
            try {
              console.log(`📤 [COMMENT NOTIFICATION] ✅ Admin is NOT the submitter, creating notification...`);
              const notification = await this.createNotification({
                userId: admin.id,
                title: 'New Comment on Report',
                message: `${commenter.firstName} ${commenter.lastName} commented on report ${reportId.slice(0, 5).toUpperCase()}: "${commentText.slice(0, 50)}${commentText.length > 50 ? '...' : ''}"`,
                type: 'info',
                isRead: 0,
                relatedReportId: reportId,
              });
              notificationsCreated++;
              console.log(`✅ [COMMENT NOTIFICATION] ✅ Notification #${notificationsCreated} created for admin: ${admin.email}`);
              console.log(`✅ [COMMENT NOTIFICATION] Notification ID: ${notification.id}`);
            } catch (error: any) {
              console.error(`❌ [COMMENT NOTIFICATION] ❌ FAILED to create notification for admin ${admin.email}`);
              console.error(`❌ [COMMENT NOTIFICATION] Error:`, error?.message);
              console.error(`❌ [COMMENT NOTIFICATION] Stack:`, error?.stack);
            }
          } else {
            console.log(`⏭️ [COMMENT NOTIFICATION] ⏭️ Skipping admin notification (admin is the report submitter)`);
          }
        }
      } else {
        console.log(`⏭️ [COMMENT NOTIFICATION] ⏭️ Skipping admin notifications (commenter is admin)`);
      }
      
      console.log(`\n💬 [COMMENT NOTIFICATION] ========== SUMMARY ==========`);
      console.log(`✅ [COMMENT NOTIFICATION] Total notifications created: ${notificationsCreated}`);
      console.log(`💬 [COMMENT NOTIFICATION] ========== END ==========\n`);
    } catch (error: any) {
      console.error(`❌ [COMMENT NOTIFICATION] ❌ CRITICAL ERROR in createCommentAddedNotification`);
      console.error(`❌ [COMMENT NOTIFICATION] Error message:`, error?.message);
      console.error(`❌ [COMMENT NOTIFICATION] Error stack:`, error?.stack);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
