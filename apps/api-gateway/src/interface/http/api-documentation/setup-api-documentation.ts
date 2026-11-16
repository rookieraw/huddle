import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule } from '@nestjs/swagger';
import { isApiDocumentationEnabled } from './api-documentation-switch';
import { createApiDocument } from './create-api-document';

export const API_DOCUMENTATION_PATH = 'docs/api';
export const API_DOCUMENTATION_JSON_PATH = `${API_DOCUMENTATION_PATH}/openapi.json`;

export function setupApiDocumentation(
  app: NestExpressApplication,
  switchValue: string | undefined,
): void {
  if (!isApiDocumentationEnabled(switchValue)) {
    return;
  }

  SwaggerModule.setup(API_DOCUMENTATION_PATH, app, createApiDocument(app), {
    raw: ['json'],
    jsonDocumentUrl: API_DOCUMENTATION_JSON_PATH,
    swaggerOptions: { persistAuthorization: false },
  });
}
