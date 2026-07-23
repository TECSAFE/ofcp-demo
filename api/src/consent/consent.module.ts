import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ConsentController } from './consent.controller';

@Module({
  imports: [UsersModule],
  controllers: [ConsentController],
})
export class ConsentModule {}
