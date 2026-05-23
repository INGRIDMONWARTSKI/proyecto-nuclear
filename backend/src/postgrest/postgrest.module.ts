import { Global, Module } from '@nestjs/common';
import { PostgrestService } from './postgrest.service';

@Global()
@Module({
  providers: [PostgrestService],
  exports: [PostgrestService],
})
export class PostgrestModule {}
