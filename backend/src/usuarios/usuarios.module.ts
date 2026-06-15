import { Module } from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';

@Module({
  imports: [NotificacionesModule],
  controllers: [UsuariosController],
  providers: [UsuariosService, RolesGuard],
  exports: [UsuariosService],
})
export class UsuariosModule {}
