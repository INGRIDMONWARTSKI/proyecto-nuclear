import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  listar(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.notificacionesService.listarParaUsuarioActual(currentUser);
  }

  @Get('no-leidas/count')
  contarNoLeidas(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.notificacionesService.contarNoLeidas(currentUser);
  }

  @Patch('marcar-todas-leidas')
  marcarTodas(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.notificacionesService.marcarTodasComoLeidas(currentUser);
  }

  @Patch(':id/leida')
  marcarUna(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.notificacionesService.marcarComoLeida(id, currentUser);
  }
}
