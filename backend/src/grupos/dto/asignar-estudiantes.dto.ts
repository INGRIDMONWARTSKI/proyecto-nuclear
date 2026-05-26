import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class AsignarEstudiantesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  estudianteIds: string[];
}
