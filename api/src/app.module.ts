import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule as DotenvModule } from '@nestjs/config';
import { ConfigModule } from './shared/config/config.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CleanupModule } from './cleanup/cleanup.module';
import { FileStoreModule } from './file-store/file-store.module';
import { AuthModule } from './auth/auth.module';
import { CartModule } from './cart/cart.module';
import { ConsentModule } from './consent/consent.module';
import { ProductsModule } from './products/products.module';
import { TecsafeModule } from './tecsafe/tecsafe.module';
import { WhitelabelModule } from './whitelabel/whitelabel.module';
import { SessionMiddleware } from './session/session.middleware';
import { SessionModule } from './session/session.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DotenvModule.forRoot({ isGlobal: true }),
    ConfigModule,
    ScheduleModule.forRoot(),
    FileStoreModule,
    SessionModule,
    ProductsModule,
    UsersModule,
    AuthModule,
    ConsentModule,
    CartModule,
    TecsafeModule,
    WhitelabelModule,
    CleanupModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionMiddleware).forRoutes('{*splat}');
  }
}
