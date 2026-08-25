import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import path from 'node:path';
import { IdentityModule } from '@huddle/identity';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ChatContactRequestModule } from './composition/chat/chat-contact-request.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(process.cwd(), '../../.env'),
    }),
    IdentityModule,
    ChatContactRequestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
