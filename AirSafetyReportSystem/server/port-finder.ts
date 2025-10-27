import { createServer } from 'http';

export async function findAvailablePort(startPort: number, maxAttempts: number = 20): Promise<number> {
  console.log(`🔍 Searching for available port starting from ${startPort}...`);
  
  for (let port = startPort; port <= startPort + maxAttempts; port++) {
    console.log(`🔍 Checking port ${port}...`);
    
    if (await isPortAvailable(port)) {
      if (port !== startPort) {
        console.log(`⚠️  Port ${startPort} is busy, using port ${port} instead`);
      } else {
        console.log(`✅ Port ${port} is available`);
      }
      return port;
    } else {
      console.log(`❌ Port ${port} is busy`);
    }
  }
  
  throw new Error(`No available ports found starting from ${startPort}`);
}

export function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    const timeout = setTimeout(() => {
      server.close();
      resolve(false);
    }, 1000); // 1 second timeout

    // Bind without an explicit host to match how apps usually listen (all interfaces)
    server.listen(port, () => {
      clearTimeout(timeout);
      server.close(() => {
        resolve(true);
      });
    });

    server.on('error', (err: any) => {
      clearTimeout(timeout);
      if (err.code === 'EADDRINUSE' || err.code === 'ENOTSUP' || err.code === 'EACCES') {
        resolve(false);
      } else {
        console.log(`⚠️  Error checking port ${port}: ${err.message}`);
        resolve(false);
      }
    });
  });
}

export function getPortFromEnv(): number {
  return parseInt(process.env.PORT || '3000', 10);
}
