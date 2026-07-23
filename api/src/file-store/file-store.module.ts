import { Global, Module } from '@nestjs/common';
import { FileStoreService } from './file-store.service';

@Global()
@Module({
  providers: [FileStoreService],
  exports: [FileStoreService],
})
export class FileStoreModule {}
