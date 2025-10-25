// API routes with authentication and business logic
import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
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

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Report routes
  app.get("/api/reports/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getReportStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching report stats:", error);
      res.status(500).json({ message: "Failed to fetch report statistics" });
    }
  });

  app.get("/api/reports/:id", isAuthenticated, async (req, res) => {
    try {
      const report = await storage.getReport(req.params.id);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      res.json(report);
    } catch (error) {
      console.error("Error fetching report:", error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  app.get("/api/reports", isAuthenticated, async (req, res) => {
    try {
      const { type, status } = req.query;
      const reports = await storage.getAllReports({
        type: type as string,
        status: status as string,
      });
      res.json(reports);
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
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

  app.patch("/api/reports/:id/status", isAuthenticated, requireRole(['safety_officer', 'administrator']), async (req: any, res) => {
    try {
      const { status } = req.body;
      if (!['submitted', 'in_review', 'closed', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      // Get current report to validate transition
      const currentReport = await storage.getReport(req.params.id);
      if (!currentReport) {
        return res.status(404).json({ message: "Report not found" });
      }

      // Validate status transition
      if (!validateStatusTransition(currentReport.status, status)) {
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

      const report = await storage.updateReportStatus(req.params.id, status);
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
      const userId = req.user.claims.sub;
      
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

  const httpServer = createServer(app);
  return httpServer;
}
