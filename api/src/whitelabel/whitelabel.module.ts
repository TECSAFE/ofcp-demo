import { Module } from '@nestjs/common';
import { WhitelabelController } from './whitelabel.controller';
import { WhitelabelService } from './whitelabel.service';

@Module({
  controllers: [WhitelabelController],
  providers: [WhitelabelService],
  exports: [WhitelabelService],
})
export class WhitelabelModule {}
