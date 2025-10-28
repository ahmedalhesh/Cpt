import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET as string,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  // Get user from database
  storage.getUser(payload.userId)
    .then(user => {
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      req.user = {
        id: user.id || '',
        email: user.email || '',
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        role: user.role || 'captain',
      };
      
      next();
    })
    .catch(error => {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Internal server error' });
    });
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: allowedRoles,
        current: req.user.role
      });
    }

    next();
  };
}

// Role-based permission helpers
export function isAdmin(user: any): boolean {
  return user?.role === 'admin';
}

export function isCaptain(user: any): boolean {
  return user?.role === 'captain';
}

export function isFirstOfficer(user: any): boolean {
  return user?.role === 'first_officer';
}

export function canManageUsers(user: any): boolean {
  return isAdmin(user);
}

export function canViewAllReports(user: any): boolean {
  return isAdmin(user);
}

export function canCreateReports(user: any): boolean {
  return isCaptain(user) || isFirstOfficer(user) || isAdmin(user);
}

export function setupAuth(app: any) {
  // Login endpoint
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // For demo purposes, we'll create a default password if none exists
      // In production, users should set their password during registration
      let hashedPassword = user.password;
      if (!hashedPassword) {
        // Set default password for demo
        hashedPassword = await hashPassword('password123');
        await storage.updateUserPassword(user.id, hashedPassword);
      }

      const isValidPassword = await comparePassword(password, hashedPassword);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = generateToken({
        id: user.id || '',
        email: user.email || '',
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        role: user.role || 'captain',
      });

      res.json({
        token,
        user: {
          id: user.id || '',
          email: user.email || '',
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          role: user.role || 'captain',
          profileImageUrl: user.profileImageUrl || undefined,
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Admin-only user creation endpoint
  app.post('/api/auth/create-user', isAuthenticated, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName, role = 'captain' } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      // Check if user already exists by email
      const existingUserByEmail = await storage.getUserByEmail(email);
      if (existingUserByEmail) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }

      // Check if user already exists by name (firstName + lastName)
      if (firstName && lastName) {
        const existingUserByName = await storage.getUserByName(firstName, lastName);
        if (existingUserByName) {
          return res.status(400).json({ message: 'User with this name already exists' });
        }
      }

      const hashedPassword = await hashPassword(password);
      
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
      });

      res.status(201).json({
        message: 'User created successfully',
        user: {
          id: user.id || '',
          email: user.email || '',
          firstName: user.firstName || undefined,
          lastName: user.lastName || undefined,
          role: user.role || 'captain',
        }
      });
    } catch (error) {
      console.error('User creation error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get current user
  app.get('/api/auth/user', isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Fetch full user data from database
      if (!req.user) {
        return res.status(401).json({ message: 'User not authenticated' });
      }
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profileImageUrl: user.profileImageUrl,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  // Admin endpoints for user management
  app.get('/api/admin/users', isAuthenticated, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/admin/users/:id', isAuthenticated, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { firstName, lastName, role, email } = req.body;

      // Check if email is being changed and if it already exists
      if (email) {
        const existingUserByEmail = await storage.getUserByEmail(email);
        if (existingUserByEmail && existingUserByEmail.id !== id) {
          return res.status(400).json({ message: 'User with this email already exists' });
        }
      }

      // Check if name is being changed and if it already exists
      if (firstName && lastName) {
        const existingUserByName = await storage.getUserByName(firstName, lastName);
        if (existingUserByName && existingUserByName.id !== id) {
          return res.status(400).json({ message: 'User with this name already exists' });
        }
      }

      const user = await storage.updateUser(id, {
        firstName,
        lastName,
        role,
        email,
      });

      res.json(user);
    } catch (error) {
      console.error('Error updating user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/admin/users/:id', isAuthenticated, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteUser(id);
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/admin/users/:id/reset-password', isAuthenticated, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;

      if (!newPassword) {
        return res.status(400).json({ message: 'New password is required' });
      }

      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUserPassword(id, hashedPassword);

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Company Settings endpoints
  // Public endpoint for company settings (for login page)
  app.get('/api/settings/public', async (req: Request, res: Response) => {
    try {
      const settings = await storage.getCompanySettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching public settings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Authenticated endpoint for company settings
  app.get('/api/settings', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getCompanySettings();
      res.json(settings);
    } catch (error) {
      console.error('Error fetching settings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/settings', isAuthenticated, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { companyName, email, phone, address } = req.body;
      
      const settings = await storage.updateCompanySettings({
        companyName,
        email,
        phone,
        address,
      });
      
      res.json(settings);
    } catch (error) {
      console.error('Error updating settings:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/settings/logo', isAuthenticated, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      const { logoUrl } = req.body;
      
      if (!logoUrl) {
        return res.status(400).json({ message: 'Logo URL is required' });
      }
      
      const settings = await storage.updateCompanySettings({
        logo: logoUrl,
      });
      
      res.json(settings);
    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/settings/logo', isAuthenticated, requireRole(['admin']), async (req: Request, res: Response) => {
    try {
      await storage.deleteCompanyLogo();
      res.json({ message: 'Logo deleted successfully' });
    } catch (error) {
      console.error('Error deleting logo:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Logout endpoint (client-side token removal)
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    res.json({ message: 'Logged out successfully' });
  });
}