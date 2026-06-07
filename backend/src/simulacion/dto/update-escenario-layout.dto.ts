import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class LayoutPointDto {
  @IsNumber()
  @Min(-1000)
  @Max(2000)
  x: number;

  @IsNumber()
  @Min(-1000)
  @Max(2000)
  y: number;
}

class LayoutSizeDto {
  @IsNumber()
  @Min(1)
  @Max(4000)
  width: number;

  @IsNumber()
  @Min(1)
  @Max(4000)
  height: number;
}

class LayoutBindingsDto {
  @IsOptional()
  @IsUUID()
  preguntaId?: string | null;

  @IsOptional()
  @IsUUID()
  opcionId?: string | null;

  @IsOptional()
  @IsUUID()
  retroalimentacionId?: string | null;

  @IsOptional()
  @IsUUID()
  escenarioDestinoId?: string | null;
}

class LayoutElementDto {
  @IsString()
  id: string;

  @IsIn([
    'background',
    'character',
    'text',
    'image',
    'object',
    'audio',
    'question',
    'instruction',
    'feedback',
  ])
  type:
    | 'background'
    | 'character'
    | 'text'
    | 'image'
    | 'object'
    | 'audio'
    | 'question'
    | 'instruction'
    | 'feedback';

  @ValidateNested()
  @Type(() => LayoutPointDto)
  position: LayoutPointDto;

  @ValidateNested()
  @Type(() => LayoutSizeDto)
  size: LayoutSizeDto;

  @IsNumber()
  @Min(-360)
  @Max(360)
  rotation: number;

  @IsNumber()
  @Min(0)
  @Max(10000)
  zIndex: number;

  @IsBoolean()
  locked: boolean;

  @IsBoolean()
  hidden: boolean;

  @IsObject()
  style: Record<string, unknown>;

  @IsObject()
  content: Record<string, unknown>;

  @ValidateNested()
  @Type(() => LayoutBindingsDto)
  bindings: LayoutBindingsDto;
}

export class UpdateEscenarioLayoutDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  version?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutElementDto)
  elements: LayoutElementDto[];
}
