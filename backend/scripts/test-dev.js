const { execSync } = require('child_process');

const path = require('path');
process.env.DOTENV_CONFIG_PATH = path.resolve(__dirname, '..', '.env.test');
console.log('Using DOTENV_CONFIG_PATH=', process.env.DOTENV_CONFIG_PATH);
require('dotenv').config({ path: process.env.DOTENV_CONFIG_PATH });

try {
  console.log('Running prisma db push --schema=prisma/schema.dev.prisma');
  execSync('npx prisma db push --schema=prisma/schema.dev.prisma', { stdio: 'inherit' });

  console.log('Running prisma generate --schema=prisma/schema.dev.prisma');
  execSync('npx prisma generate --schema=prisma/schema.dev.prisma', { stdio: 'inherit' });

  console.log('Running jest');
  execSync('npx jest --runInBand --detectOpenHandles', { stdio: 'inherit' });
} catch (err) {
  console.error('Error running test flow:', err);
  process.exit(1);
}
