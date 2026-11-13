import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { setupApiDocumentation } from './interface/http/api-documentation/setup-api-documentation';
import { ApiValidationPipe } from './interface/http/api-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ApiValidationPipe());
  setupApiDocumentation(
    app,
    app.get(ConfigService).get<string>('API_DOCS_ENABLED'),
  );
  await app.listen(process.env.PORT ?? 4000);
}
void bootstrap();
