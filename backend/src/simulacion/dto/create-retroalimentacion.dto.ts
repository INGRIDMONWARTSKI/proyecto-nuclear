import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRetroalimentacionDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1200)
  mensaje: string;

  @IsOptional()
  @IsIn(['pedagogica', 'correctiva', 'refuerzo'])
  tipo?: 'pedagogica' | 'correctiva' | 'refuerzo';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  referenciaTeorica?: string;
}
