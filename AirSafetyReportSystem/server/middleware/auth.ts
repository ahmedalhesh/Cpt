// Role-based authorization middleware
import type { RequestHandler } from "express";
import { storage } from "../storage";

export const requireRole = (allowedRoles: string[]): RequestHandler => {
  return async (req: any, res, next) => {
    try {
      console.log(`🔐 [MIDDLEWARE] Role check started`);
      console.log(`🔐 [MIDDLEWARE] Required roles: ${allowedRoles.join(', ')}`);
      console.log(`🔐 [MIDDLEWARE] User object:`, {
        id: req.user?.id,
        claims: req.user?.claims,
        role: req.user?.role
      });
      
      const userId = req.user?.id || req.user?.claims?.sub;
      console.log(`🔐 [MIDDLEWARE] Extracted user ID: ${userId}`);
      
      if (!userId) {
        console.log(`❌ [MIDDLEWARE] No user ID found, returning 401`);
        return res.status(401).json({ message: "Unauthorized" });
      }

      console.log(`🔍 [MIDDLEWARE] Fetching user from database...`);
      const user = await storage.getUser(userId);
      console.log(`🔍 [MIDDLEWARE] User from database:`, {
        id: user?.id,
        role: user?.role,
        email: user?.email
      });
      
      if (!user || !allowedRoles.includes(user.role)) {
        console.log(`❌ [MIDDLEWARE] Access denied:`, {
          userExists: !!user,
          userRole: user?.role,
          requiredRoles: allowedRoles,
          hasAccess: user && allowedRoles.includes(user.role)
        });
        return res.status(403).json({ 
          message: "Insufficient permissions", 
          requiredRoles: allowedRoles,
          userRole: user?.role 
        });
      }

      console.log(`✅ [MIDDLEWARE] Access granted for user ${user.role}`);
      // Attach user to request for later use
      req.currentUser = user;
      next();
    } catch (error) {
      console.error(`❌ [MIDDLEWARE] Error in requireRole middleware:`, error);
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
