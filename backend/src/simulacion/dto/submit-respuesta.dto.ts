import { IsUUID } from 'class-validator';

export class SubmitRespuestaDto {
  @IsUUID('4')
  preguntaId: string;

  @IsUUID('4')
  opcionId: string;
}
