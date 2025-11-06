// API routes with authentication and business logic
import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertReportSchema, insertCommentSchema } from "@shared/schema";
import { requireRole, validateStatusTransition } from "./middleware/auth";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: fileStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes are now handled in auth.ts

  // Report routes
  app.get("/api/reports/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Admin gets all reports stats, users get only their own reports stats
      const stats = userRole === 'admin' 
        ? await storage.getReportStats()
        : await storage.getUserReportStats(userId);
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching report stats:", error);
      res.status(500).json({ message: "Failed to fetch report statistics" });
    }
  });

  app.get("/api/reports/:id", isAuthenticated, async (req: any, res) => {
    try {
      const report = await storage.getReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      // Check if user can access this report
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Admin can see all reports, other users can only see their own
      if (userRole !== 'admin' && report.submittedBy !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.get("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const { type, status } = req.query;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Admin can see all reports, other users see only their own
      const reports = userRole === 'admin' 
        ? await storage.getAllReports({
            type: type as string,
            status: status as string,
          })
        : await storage.getUserReports(userId, {
        type: type as string,
        status: status as string,
      });
      
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Reports by type endpoints
  app.get("/api/reports/:type/:status", isAuthenticated, async (req: any, res) => {
    try {
      const { type, status } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;
      
      // Admin can see all reports, other users see only their own
      const reports = userRole === 'admin' 
        ? await storage.getAllReports({
            type: type,
            status: status,
          })
        : await storage.getUserReports(userId, {
            type: type,
            status: status,
          });
      
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports by type:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    console.log('🚀 [REPORT CREATE] ========== NEW REPORT CREATION STARTED ==========');
    console.log('🚀 [REPORT CREATE] User ID:', req.user?.id);
    console.log('🚀 [REPORT CREATE] User role:', req.user?.role);
    
    try {
      const userId = req.user.id;
      
      // Prepare data with defaults - all fields are optional now
      // First spread req.body, then apply defaults only for missing fields
      const reportData = {
        ...req.body, // All provided values first
        reportType: req.body.reportType ?? "asr", // Default only if null/undefined
        status: req.body.status ?? "submitted",
        isAnonymous: req.body.isAnonymous ?? 0,
        description: req.body.description ?? '', // Use empty string instead of null (database requires notNull)
        submittedBy: userId, // Always override with auth user
      };
      
      console.log('🚀 [REPORT CREATE] Report data prepared:', {
        reportType: reportData.reportType,
        status: reportData.status,
        submittedBy: reportData.submittedBy
      });
      
      // Convert extraData to JSON string if it's an object (database stores it as text)
      if (reportData.extraData && typeof reportData.extraData === 'object') {
        reportData.extraData = JSON.stringify(reportData.extraData);
      }
      
      // Validate the request body (all fields are optional in schema with nullish)
      const validatedData = insertReportSchema.parse(reportData);
      console.log('✅ [REPORT CREATE] Validation passed');

      // Ensure required fields are not null/undefined (database requires notNull)
      const reportDataForInsert = {
        ...validatedData,
        reportType: validatedData.reportType ?? "asr",
        status: validatedData.status ?? "submitted",
        description: validatedData.description ?? '',
        submittedBy: validatedData.submittedBy ?? userId,
        isAnonymous: validatedData.isAnonymous ?? 0,
      } as typeof validatedData & { 
        reportType: string; 
        status: string; 
        description: string; 
        submittedBy: string;
        isAnonymous: number;
      };

      const report = await storage.createReport(reportDataForInsert);
      console.log('✅ [REPORT CREATE] Report created in database:', {
        id: report.id,
        status: report.status,
        reportType: report.reportType
      });
      
      // Create notification for admins when a new report is submitted
      console.log('🔔 [REPORT CREATE] Checking if notification should be created...');
      console.log('🔔 [REPORT CREATE] Report status:', report.status);
      console.log('🔔 [REPORT CREATE] Status check (=== "submitted"):', report.status === 'submitted');
      
      if (report.status === 'submitted') {
        console.log('🔔 [REPORT CREATE] ✅ Status is "submitted", creating notifications...');
        console.log('🔔 [REPORT CREATE] Calling createReportSubmittedNotification...');
        console.log('🔔 [REPORT CREATE] Report ID:', report.id);
        console.log('🔔 [REPORT CREATE] User ID:', userId);
        
        // Use await to ensure it runs and we can catch errors immediately
        try {
          await storage.createReportSubmittedNotification(report.id, userId);
          console.log('✅ [REPORT CREATE] Notifications created successfully');
        } catch (notificationError: any) {
          console.error('❌ [REPORT CREATE] ERROR creating notifications:', notificationError);
          console.error('❌ [REPORT CREATE] Error stack:', notificationError?.stack);
          // Don't fail the request if notifications fail
        }
      } else {
        console.log('⏭️ [REPORT CREATE] Skipping notification (status is not "submitted"):', report.status);
      }
      
      console.log('✅ [REPORT CREATE] ========== REPORT CREATION COMPLETED ==========');
      res.status(201).json(report);
    } catch (error: any) {
      console.error("Error creating report:", error);
      if (error.name === 'ZodError') {
        console.error("Validation errors:", JSON.stringify(error.errors, null, 2));
        console.error("Received data keys:", Object.keys(req.body || {}));
        const reportDataForError = {
          reportType: req.body?.reportType ?? "asr",
          status: req.body?.status ?? "submitted",
        };
        console.error("Prepared data keys:", Object.keys(reportDataForError || {}));
        return res.status(400).json({ 
          message: "Invalid report data", 
          errors: error.errors,
          receivedData: {
            reportType: req.body?.reportType,
            hasPlanImage: !!req.body?.planImage,
            hasElevImage: !!req.body?.elevImage,
            planImageLength: req.body?.planImage?.length || 0,
            elevImageLength: req.body?.elevImage?.length || 0,
            keys: Object.keys(req.body || {}),
          }
        });
      }
      res.status(500).json({ message: error?.message || "Failed to create report" });
    }
  });

  app.patch("/api/reports/:id/status", isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      console.log(`🔄 [SERVER] Status update request received`);
      console.log(`🔄 [SERVER] Report ID: ${req.params.id}`);
      console.log(`🔄 [SERVER] New status: ${req.body.status}`);
      console.log(`🔄 [SERVER] User ID: ${req.user?.id}`);
      console.log(`🔄 [SERVER] User role: ${req.user?.role}`);
      
      const { status } = req.body;
      if (!['submitted', 'in_review', 'closed', 'rejected'].includes(status)) {
        console.log(`❌ [SERVER] Invalid status: ${status}`);
        return res.status(400).json({ message: "Invalid status" });
      }

      // Get current report to validate transition
      console.log(`🔍 [SERVER] Fetching current report from database...`);
      const currentReport = await storage.getReport(req.params.id);
      if (!currentReport) {
        console.log(`❌ [SERVER] Report not found: ${req.params.id}`);
        return res.status(404).json({ message: "Report not found" });
      }

      console.log(`📊 [SERVER] Current status: ${currentReport.status}, New status: ${status}`);

      // Validate status transition
      console.log(`🔍 [SERVER] Validating status transition...`);
      if (!validateStatusTransition(currentReport.status, status)) {
        console.log(`❌ [SERVER] Invalid transition: ${currentReport.status} -> ${status}`);
        return res.status(400).json({ 
          message: "Invalid status transition",
          currentStatus: currentReport.status,
          attemptedStatus: status,
          validTransitions: currentReport.status === 'submitted' 
            ? ['in_review', 'rejected']
            : currentReport.status === 'in_review'
            ? ['closed', 'rejected']
            : []
        });
      }

      console.log(`✅ [SERVER] Status transition valid, updating database...`);
      const report = await storage.updateReportStatus(req.params.id, status);
      console.log(`✅ [SERVER] Status updated successfully in database`);
      console.log(`✅ [SERVER] Updated report:`, {
        id: report?.id,
        status: report?.status,
        updatedAt: report?.updatedAt
      });

      // Create notification for report submitter when status changes
      if (report) {
        await storage.createReportStatusUpdatedNotification(report.id, report.submittedBy, status);
      }
      
      console.log(`📤 [SERVER] Sending response to client...`);
      res.json(report);
    } catch (error) {
      console.error("Error updating report status:", error);
      res.status(500).json({ message: "Failed to update report status" });
    }
  });

  // Comment routes
  app.get("/api/comments", isAuthenticated, async (req, res) => {
    try {
      const { reportId } = req.query;
      if (!reportId || typeof reportId !== 'string') {
        return res.status(400).json({ message: "Report ID is required" });
      }

      const comments = await storage.getCommentsByReportId(reportId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/comments", isAuthenticated, async (req: any, res) => {
    console.log('💬 [COMMENT CREATE] ========== NEW COMMENT CREATION STARTED ==========');
    console.log('💬 [COMMENT CREATE] User ID:', req.user?.id);
    console.log('💬 [COMMENT CREATE] Report ID:', req.body?.reportId);
    console.log('💬 [COMMENT CREATE] Comment content length:', req.body?.content?.length);
    
    try {
      const userId = req.user.id;
      
      const validatedData = insertCommentSchema.parse({
        ...req.body,
        userId,
      });

      const comment = await storage.createComment(validatedData);
      console.log('✅ [COMMENT CREATE] Comment created in database:', {
        id: comment.id,
        reportId: comment.reportId,
        userId: comment.userId
      });
      
      // Create notification when comment is added
      console.log('🔔 [COMMENT CREATE] Checking if notification should be created...');
      console.log('🔔 [COMMENT CREATE] Comment exists:', !!comment);
      console.log('🔔 [COMMENT CREATE] Report ID exists:', !!req.body.reportId);
      
      if (comment && req.body.reportId) {
        console.log('🔔 [COMMENT CREATE] ✅ Conditions met, creating notifications...');
        console.log('🔔 [COMMENT CREATE] Calling createCommentAddedNotification...');
        console.log('🔔 [COMMENT CREATE] Report ID:', req.body.reportId);
        console.log('🔔 [COMMENT CREATE] User ID:', userId);
        console.log('🔔 [COMMENT CREATE] Comment content preview:', comment.content?.substring(0, 50));
        
        // Use await to ensure it runs and we can catch errors immediately
        try {
          await storage.createCommentAddedNotification(
            req.body.reportId,
            userId,
            comment.content
          );
          console.log('✅ [COMMENT CREATE] Notifications created successfully');
        } catch (notificationError: any) {
          console.error('❌ [COMMENT CREATE] ERROR creating notifications:', notificationError);
          console.error('❌ [COMMENT CREATE] Error stack:', notificationError?.stack);
          // Don't fail the request if notifications fail
        }
      } else {
        console.log('⏭️ [COMMENT CREATE] Skipping notification:', {
          commentExists: !!comment,
          reportIdExists: !!req.body.reportId
        });
      }
      
      console.log('✅ [COMMENT CREATE] ========== COMMENT CREATION COMPLETED ==========');
      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Error creating comment:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid comment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // ======================
  // Internal Messaging API
  // ======================
  // Create message (admin only)
  app.post("/api/messages", isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const senderId = req.user.id;
      const { subject, body, recipients = [], roles = [], all = false } = req.body || {};
      if (!subject || !body) {
        return res.status(400).json({ message: "Subject and body are required" });
      }
      // Resolve recipients
      let recipientIds: string[] = [];
      const allUsers = await storage.getAllUsers();
      if (all) {
        recipientIds = allUsers.filter(u => u.id !== senderId).map(u => u.id);
      }
      if (roles?.length) {
        const byRoles = allUsers.filter(u => roles.includes((u.role || '').toLowerCase())).map(u => u.id);
        recipientIds.push(...byRoles);
      }
      if (Array.isArray(recipients) && recipients.length) {
        recipientIds.push(...recipients);
      }
      // unique and exclude sender
      const unique = Array.from(new Set(recipientIds)).filter(id => id && id !== senderId);
      if (unique.length === 0) {
        return res.status(400).json({ message: "No recipients resolved" });
      }
      // Create message
      const message = await storage.createMessage({ senderId, subject, body } as any);
      // Add recipients
      await storage.addMessageRecipients(unique.map(rid => ({ messageId: message.id, recipientId: rid } as any)));
      // Create notifications
      for (const rid of unique) {
        await storage.createNotification({
          userId: rid,
          title: subject.slice(0, 80),
          message: body.slice(0, 140),
          type: 'message',
          isRead: 0,
          relatedMessageId: message.id,
        });
      }
      res.status(201).json({ id: message.id, recipients: unique.length });
    } catch (error: any) {
      console.error("Error creating message:", error);
      res.status(500).json({ message: error?.message || "Failed to create message" });
    }
  });

  // Inbox for current user
  app.get("/api/messages/inbox", isAuthenticated, async (req: any, res) => {
    try {
      const status = (req.query.status as string) || 'all';
      const page = parseInt((req.query.page as string) || '1', 10);
      const pageSize = parseInt((req.query.pageSize as string) || '20', 10);
      const offset = (page - 1) * pageSize;
      const items = await storage.getInbox(req.user.id, { status, limit: pageSize, offset });
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching inbox:", error);
      res.status(500).json({ message: "Failed to fetch inbox" });
    }
  });

  // Sent for admin
  app.get("/api/messages/sent", isAuthenticated, requireRole(['admin']), async (req: any, res) => {
    try {
      const page = parseInt((req.query.page as string) || '1', 10);
      const pageSize = parseInt((req.query.pageSize as string) || '20', 10);
      const offset = (page - 1) * pageSize;
      const items = await storage.getSentMessages(req.user.id, { limit: pageSize, offset });
      res.json(items);
    } catch (error: any) {
      console.error("Error fetching sent:", error);
      res.status(500).json({ message: "Failed to fetch sent messages" });
    }
  });

  // Message detail
  app.get("/api/messages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const msg = await storage.getMessageForUser(req.params.id, req.user.id);
      if (!msg) return res.status(404).json({ message: "Message not found" });
      res.json(msg);
    } catch (error: any) {
      console.error("Error fetching message detail:", error);
      res.status(500).json({ message: "Failed to fetch message" });
    }
  });

  // Mark read
  app.patch("/api/messages/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      await storage.markMessageRead(req.params.id, req.user.id);
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to update message status" });
    }
  });

  // Unread count
  app.get("/api/messages/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const count = await storage.getUnreadMessagesCount(req.user.id);
      res.json({ unread: count });
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // File attachment routes
  app.post("/api/attachments", isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const { reportId } = req.body;
      if (!reportId) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Report ID is required" });
      }

      // Verify report exists and user has access
      const report = await storage.getReport(reportId);
      if (!report) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ message: "Report not found" });
      }

      const attachment = await storage.createAttachment({
        reportId,
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        filePath: req.file.path,
      });

      res.status(201).json(attachment);
    } catch (error) {
      console.error("Error uploading attachment:", error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: "Failed to upload attachment" });
    }
  });

  app.get("/api/attachments/:id/download", isAuthenticated, async (req, res) => {
    try {
      const attachment = await storage.getAttachment(req.params.id);
      if (!attachment) {
        return res.status(404).json({ message: "Attachment not found" });
      }

      // Check if file exists
      if (!fs.existsSync(attachment.filePath)) {
        return res.status(404).json({ message: "File not found on server" });
      }

      res.download(attachment.filePath, attachment.fileName);
    } catch (error) {
      console.error("Error downloading attachment:", error);
      res.status(500).json({ message: "Failed to download attachment" });
    }
  });

  // Notification routes
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { isRead } = req.query;
      
      const filters = isRead !== undefined ? { isRead: isRead === 'true' } : undefined;
      const notifications = await storage.getNotifications(userId, filters);
      
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const count = await storage.getUnreadNotificationCount(userId);
      res.json(count);
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = req.params.id;
      const notification = await storage.markNotificationAsRead(notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      res.json(notification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.markAllNotificationsAsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const notificationId = req.params.id;
      const userId = req.user.id;
      
      // Verify that the notification belongs to the user before deleting
      const notifications = await storage.getNotifications(userId);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found or access denied" });
      }
      
      await storage.deleteNotification(notificationId);
      res.json({ message: "Notification deleted" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  app.delete("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.deleteAllNotifications(userId);
      res.json({ message: "All notifications deleted" });
    } catch (error) {
      console.error("Error deleting all notifications:", error);
      res.status(500).json({ message: "Failed to delete all notifications" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
