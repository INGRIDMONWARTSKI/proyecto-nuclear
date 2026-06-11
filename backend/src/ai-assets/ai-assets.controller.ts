import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AiAssetsService } from './ai-assets.service';
import { GenerateAiAssetDto } from './dto/generate-ai-asset.dto';
import { InsertAiAssetDto } from './dto/insert-ai-asset.dto';

@Controller('ai-assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PROFESOR)
export class AiAssetsController {
  constructor(private readonly aiAssetsService: AiAssetsService) {}

  @Post('generate')
  generate(
    @Body() dto: GenerateAiAssetDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.aiAssetsService.generate(dto, currentUser);
  }

  @Get('caso/:casoId')
  listByCaso(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.aiAssetsService.listByCaso(casoId, currentUser);
  }

  @Post(':id/insertar-en-escenario')
  insertIntoScenario(
    @Param('id') assetId: string,
    @Body() dto: InsertAiAssetDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.aiAssetsService.insertIntoScenario(assetId, dto, currentUser);
  }
}
