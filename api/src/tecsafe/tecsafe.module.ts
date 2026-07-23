import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { TecsafeController } from './tecsafe.controller';
import { TecsafeService } from './tecsafe.service';

@Module({
  imports: [UsersModule],
  controllers: [TecsafeController],
  providers: [TecsafeService],
})
export class TecsafeModule {}
