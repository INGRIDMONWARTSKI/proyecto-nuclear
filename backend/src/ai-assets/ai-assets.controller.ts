import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AiAssetsService } from './ai-assets.service';
import type { DocenteAssetListItem } from './ai-assets.service';
import { GenerateAiAssetDto } from './dto/generate-ai-asset.dto';
import { InsertAiAssetDto } from './dto/insert-ai-asset.dto';
import { UploadDocenteAssetDto } from './dto/upload-docente-asset.dto';
import type { UploadedImageFile } from './interfaces/uploaded-image-file.interface';

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

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadDocenteAsset(
    @UploadedFile() file: UploadedImageFile | undefined,
    @Body() dto: UploadDocenteAssetDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<DocenteAssetListItem> {
    return this.aiAssetsService.uploadDocenteAsset(dto, file, currentUser);
  }

  @Get('docente/caso/:casoId')
  listDocenteAssetsByCaso(
    @Param('casoId') casoId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ): Promise<DocenteAssetListItem[]> {
    return this.aiAssetsService.listDocenteAssetsByCaso(casoId, currentUser);
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
