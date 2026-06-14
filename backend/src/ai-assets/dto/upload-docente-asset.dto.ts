import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export const DOCENTE_ASSET_UPLOAD_TYPES = [
  'FONDO',
  'PERSONAJE',
  'OBJETO',
  'PISTA',
  'DECORACION',
] as const;

export type DocenteAssetUploadType = (typeof DOCENTE_ASSET_UPLOAD_TYPES)[number];

export class UploadDocenteAssetDto {
  @IsUUID()
  casoId: string;

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  nombre: string;

  @IsIn(DOCENTE_ASSET_UPLOAD_TYPES)
  tipo: DocenteAssetUploadType;
}
