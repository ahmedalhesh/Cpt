// Role-based authorization middleware
import type { RequestHandler } from "express";
import { storage } from "../storage";

export const requireRole = (allowedRoles: string[]): RequestHandler => {
  return async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || !allowedRoles.includes(user.role)) {
        return res.status(403).json({ 
          message: "Insufficient permissions", 
          requiredRoles: allowedRoles,
          userRole: user?.role 
        });
      }

      // Attach user to request for later use
      req.currentUser = user;
      next();
    } catch (error) {
      console.error("Error in requireRole middleware:", error);
      res.status(500).json({ message: "Authorization check failed" });
    }
  };
};

// Workflow validation for status transitions
export const validateStatusTransition = (currentStatus: string, newStatus: string): boolean => {
  const validTransitions: Record<string, string[]> = {
    submitted: ['in_review', 'rejected'],
    in_review: ['closed', 'rejected'],
    closed: [], // Terminal state
    rejected: [], // Terminal state
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
};
