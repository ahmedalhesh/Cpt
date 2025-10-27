import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    url: process.env.DATABASE_URL || "./database.sqlite",
  },
  config: {
    wranglerConfigPath: "./wrangler.toml",
    dbName: "air-safety-db",
  },
});
