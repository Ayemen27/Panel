# Production Secrets Configuration

This file documents the required environment variables that must be set in the production environment for app2.

## Required Secrets

The following environment variables must be configured on the production server:

### Database Configuration
```bash
DATABASE_URL=postgresql://app2data:PASSWORD@93.127.142.144:5432/app2data?sslmode=require
```

### JWT Authentication Secrets
```bash
JWT_ACCESS_SECRET=your_jwt_access_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
```

### Encryption Key
```bash
ENCRYPTION_KEY=your_encryption_key_here
```

## Setup Instructions

1. **Server Environment Variables**: Set these variables in your server's environment:
   ```bash
   export DATABASE_URL="postgresql://app2data:PASSWORD@93.127.142.144:5432/app2data?sslmode=require"
   export JWT_ACCESS_SECRET="your_jwt_access_secret_here"
   export JWT_REFRESH_SECRET="your_jwt_refresh_secret_here"
   export ENCRYPTION_KEY="your_encryption_key_here"
   ```

2. **PM2 Environment File**: Create `/home/administrator/app2/.env` with:
   ```
   DATABASE_URL=postgresql://app2data:PASSWORD@93.127.142.144:5432/app2data?sslmode=require
   JWT_ACCESS_SECRET=your_jwt_access_secret_here
   JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
   ENCRYPTION_KEY=your_encryption_key_here
   ```

3. **Systemd Environment**: Add to `/etc/systemd/system/app2.service.d/environment.conf`

## Security Note

⚠️ **Never commit these values to version control**. The old secrets that were accidentally committed should be rotated immediately.

## Verification

The application will load these secrets using the EnvironmentLoader which checks:
1. .env file in working directory
2. ecosystem.config.json (now clean)
3. System environment variables