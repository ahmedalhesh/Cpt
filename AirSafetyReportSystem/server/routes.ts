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
    try {
      const userId = req.user.id;
      
      // Validate the request body
      const validatedData = insertReportSchema.parse({
        ...req.body,
        submittedBy: userId,
      });

      const report = await storage.createReport(validatedData);
      
      res.status(201).json(report);
    } catch (error: any) {
      console.error("Error creating report:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid report data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create report" });
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
    try {
      const userId = req.user.id;
      
      const validatedData = insertCommentSchema.parse({
        ...req.body,
        userId,
      });

      const comment = await storage.createComment(validatedData);
      
      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Error creating comment:", error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid comment data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create comment" });
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
      await storage.deleteNotification(notificationId);
      res.json({ message: "Notification deleted" });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
