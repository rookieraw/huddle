import { config } from 'dotenv';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

config({ path: path.resolve(process.cwd(), '../../.env') });

export default defineConfig({
  schema: 'src/infrastructure/prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
