import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { findAvailablePort, getPortFromEnv } from "./port-finder";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb', // Increased limit to handle large base64 images (ASR plots)
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: false,
  limit: '50mb' // Increased limit for URL-encoded data
}));

// Basic CORS/preflight support (same-origin friendly)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Auto port selection - find available port automatically
  const defaultPort = getPortFromEnv();
  
  try {
    const availablePort = await findAvailablePort(defaultPort);

    const startServer = (portToUse: number) => {
      const s = server.listen(portToUse, () => {
        log(`✅ Server running on port ${portToUse}`);
        log(`🌐 Access the application at: http://localhost:${portToUse}`);
      });

      // In very rare race conditions, the port can become busy between check and listen
      s.on('error', async (err: any) => {
        if (err?.code === 'EADDRINUSE') {
          try {
            const fallback = await findAvailablePort(portToUse + 1);
            log(`⚠️ Port ${portToUse} just got busy. Switching to ${fallback}...`);
            startServer(fallback);
          } catch (_e) {
            log(`❌ Could not find a fallback port after ${portToUse}`);
            process.exit(1);
          }
        } else {
          log(`❌ Server listen error: ${err?.message || err}`);
          process.exit(1);
        }
      });
    };

    startServer(availablePort);

  } catch (error) {
    log(`❌ Could not find available port starting from ${defaultPort}`);
    log(`💡 Try closing other applications or change PORT in .env file`);
    process.exit(1);
  }
})();
