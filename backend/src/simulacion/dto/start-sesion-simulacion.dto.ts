import { IsUUID } from 'class-validator';

export class StartSesionSimulacionDto {
  @IsUUID('4')
  casoId: string;
}
