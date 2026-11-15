import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ChatContactRequestModule } from '../../../composition/chat/chat-contact-request.module';
import { isApiDocumentationEnabled } from './api-documentation-switch';

export const API_DOCUMENTATION_PATH = 'docs/api';
export const API_DOCUMENTATION_JSON_PATH = `${API_DOCUMENTATION_PATH}/openapi.json`;

export function setupApiDocumentation(
  app: NestExpressApplication,
  switchValue: string | undefined,
): void {
  if (!isApiDocumentationEnabled(switchValue)) {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Huddle API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    include: [ChatContactRequestModule],
  });

  SwaggerModule.setup(API_DOCUMENTATION_PATH, app, document, {
    raw: ['json'],
    jsonDocumentUrl: API_DOCUMENTATION_JSON_PATH,
    swaggerOptions: { persistAuthorization: false },
  });
}
