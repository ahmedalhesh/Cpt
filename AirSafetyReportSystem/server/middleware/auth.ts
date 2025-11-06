// Role-based authorization middleware
import type { RequestHandler } from "express";
import { storage } from "../storage";

const ADMIN_LIKE = new Set([
  'admin',
  'flight_operation_manager',
  'flight_operation_and_crew_affairs_manager',
  'flight_operations_training_manager',
  'chief_pilot_a330',
  'chief_pilot_a320',
  'technical_pilot_a330',
  'technical_pilot_a320',
  'head_of_safety_department',
  'head_of_compliance',
]);

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
      
      // Expand 'admin' to include admin-like roles
      const expandedAllowed = allowedRoles.includes('admin')
        ? Array.from(new Set([...allowedRoles.filter(r => r !== 'admin'), ...ADMIN_LIKE]))
        : allowedRoles;

      if (!user || !expandedAllowed.includes(user.role)) {
        console.log(`❌ [MIDDLEWARE] Access denied:`, {
          userExists: !!user,
          userRole: user?.role,
          requiredRoles: expandedAllowed,
          hasAccess: user && expandedAllowed.includes(user.role)
        });
        return res.status(403).json({ 
          message: "Insufficient permissions", 
          requiredRoles: expandedAllowed,
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
