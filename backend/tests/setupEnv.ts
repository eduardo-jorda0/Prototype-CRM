import dotenv from 'dotenv';
import fs from 'fs';

// Prefer explicit test env file
const testEnvPath = '.env.test';
if (fs.existsSync(testEnvPath)) {
  dotenv.config({ path: testEnvPath });
} else {
  // fallback to default .env
  dotenv.config();
}

// Ensure NODE_ENV is test for any libraries that depend on it
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// If using Prisma dev schema, set PRISMA_SCHEMA env so helper scripts can pick it up
process.env.PRISMA_SCHEMA = process.env.PRISMA_SCHEMA || 'prisma/schema.dev.prisma';

export {};
