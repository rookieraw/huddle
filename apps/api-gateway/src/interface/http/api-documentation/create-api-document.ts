import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { ChatContactRequestModule } from '../../../composition/chat/chat-contact-request.module';

/**
 * Builds the OpenAPI document. The documentation route and the generator
 * script both use it, so the served and committed descriptions cannot differ.
 */
export function createApiDocument(app: NestExpressApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Huddle API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  return SwaggerModule.createDocument(app, config, {
    include: [ChatContactRequestModule],
  });
}

/**
 * Serializes the document deterministically: two-space JSON and one trailing
 * newline, so the committed copy is stable under the commit hook's formatting.
 */
export function serializeApiDocument(document: OpenAPIObject): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
