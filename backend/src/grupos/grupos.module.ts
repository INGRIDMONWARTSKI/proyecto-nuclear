import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { GruposController } from './grupos.controller';
import { GruposService } from './grupos.service';

@Module({
  imports: [UsuariosModule, NotificacionesModule],
  controllers: [GruposController],
  providers: [GruposService, RolesGuard],
})
export class GruposModule {}
