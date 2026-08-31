import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiValidationPipe } from './interface/http/api-validation.pipe';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ApiValidationPipe());
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
