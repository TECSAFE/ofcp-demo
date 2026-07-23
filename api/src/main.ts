import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { ConfigService } from './shared/config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  config.validate();
  configureApp(app);
  await app.listen(config.PORT);
}
bootstrap();
