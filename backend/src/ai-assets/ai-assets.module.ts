import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PostgrestModule } from '../postgrest/postgrest.module';
import { CasosService } from '../simulacion/casos.service';
import { AiAssetsController } from './ai-assets.controller';
import { AiAssetsService } from './ai-assets.service';
import { PromptBuilderService } from './prompt-builder.service';

@Module({
  imports: [PostgrestModule],
  controllers: [AiAssetsController],
  providers: [AiAssetsService, PromptBuilderService, CasosService, RolesGuard],
})
export class AiAssetsModule {}
