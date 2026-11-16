import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import {
  createApiDocument,
  serializeApiDocument,
} from './interface/http/api-documentation/create-api-document';

// Run from the built output (dist/), so the repository root is three levels up.
const outputPath = resolve(__dirname, '../../../docs/api/openapi.json');

async function generate() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, serializeApiDocument(createApiDocument(app)));
  } finally {
    await app.close();
  }
}

void generate();
