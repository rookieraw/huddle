import type { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { IdentityModule } from '@huddle/identity';
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
    include: [IdentityModule, ChatContactRequestModule],
    // Tags are declared explicitly. The library would otherwise add a tag
    // derived from the class name to any controller without a class-level one.
    autoTagControllers: false,
    // Handler names are unique across the described controllers.
    operationIdFactory: (_controllerKey: string, methodKey: string) =>
      methodKey,
  });
}

/**
 * Serializes the document deterministically: two-space JSON and one trailing
 * newline, so the committed copy is stable under the commit hook's formatting.
 */
export function serializeApiDocument(document: OpenAPIObject): string {
  return `${JSON.stringify(document, null, 2)}\n`;
}
