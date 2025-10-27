# Air Safety Report System - Cloudflare Deployment Guide

## ✅ Deployment Status

**Successfully Deployed!** 🎉

- **Live URL**: https://fc0f8c48.report-sys.pages.dev
- **Project Name**: report-sys
- **Account ID**: c65441278840d45ed3cd9cfef5b898b1
- **Database ID**: d9132e2d-6a48-48be-a261-25210670a15f

## 🔑 Default Login Credentials

- **Admin User**: admin@airline.com / password123
- **Demo User**: demo@airline.com / password123

## Prerequisites

1. Install Wrangler CLI:
```bash
npm install -g wrangler
```

2. Login to Cloudflare:
```bash
wrangler login
```

## Quick Setup

Run the complete setup command:
```bash
npm run setup
```

This will:
- Install all dependencies
- Create D1 database
- Generate and apply migrations

## Manual Setup Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Database Setup

Create D1 Database:
```bash
npm run db:create
```

Generate and apply migrations:
```bash
npm run db:migrate
```

Seed initial data:
```bash
npm run db:seed
```

### 3. Build and Deploy

Build the application:
```bash
npm run build:cloudflare
```

Deploy to Cloudflare Pages:
```bash
npm run deploy
```

## Environment Variables

Set these in Cloudflare Dashboard or via wrangler:

- `JWT_SECRET`: Your production JWT secret (change from default)
- `JWT_EXPIRES_IN`: JWT expiration time (default: 7d)
- `NODE_ENV`: production

## Database Management

- Apply migrations: `npm run deploy:db`
- Generate migrations: `drizzle-kit generate`
- View database: `wrangler d1 execute air-safety-db --command="SELECT * FROM users"`
- Seed data: `npm run db:seed`

## Account Information

- **Account ID**: `c65441278840d45ed3cd9cfef5b898b1`
- **Database Name**: `air-safety-db`
- **Database ID**: `d9132e2d-6a48-48be-a261-25210670a15f`

## Important Notes

1. **Update Database ID**: ✅ Already configured in `wrangler.toml`

2. **Change JWT Secret**: Update the `JWT_SECRET` in `wrangler.toml` with a secure production secret.

3. **Default Users**: The system creates two default users:
   - `admin@airline.com` (Admin role)
   - `demo@airline.com` (Captain role)
   - Password for both: `password123`

## Troubleshooting

### Database Connection Issues
- Ensure the database ID in `wrangler.toml` matches the actual D1 database ID
- Check that migrations have been applied: `npm run deploy:db`

### Build Issues
- Make sure all dependencies are installed: `npm install`
- Check TypeScript compilation: `npm run check`

### Deployment Issues
- Verify Cloudflare login: `wrangler whoami`
- Check account ID in `wrangler.toml`
- Ensure database exists: `wrangler d1 list`

## 🚀 Next Steps

1. **Update JWT Secret**: Change the default JWT secret in production
2. **Configure Domain**: Set up a custom domain in Cloudflare Pages
3. **Monitor Performance**: Use Cloudflare Analytics to monitor usage
4. **Backup Database**: Set up regular database backups
