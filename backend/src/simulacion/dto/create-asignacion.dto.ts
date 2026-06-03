import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class CreateAsignacionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  grupoIds: string[];
}
