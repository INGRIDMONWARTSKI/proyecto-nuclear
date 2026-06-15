import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
@UseGuards(JwtAuthGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  listar(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query('archivadas') archivadas?: string,
  ) {
    return this.notificacionesService.listarParaUsuarioActual(
      currentUser,
      archivadas === 'true',
    );
  }

  @Get('no-leidas/count')
  contarNoLeidas(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.notificacionesService.contarNoLeidas(currentUser);
  }

  @Patch('marcar-todas-leidas')
  marcarTodas(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.notificacionesService.marcarTodasComoLeidas(currentUser);
  }

  @Patch('archivar-leidas')
  archivarLeidas(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.notificacionesService.archivarLeidas(currentUser);
  }

  @Patch(':id/leida')
  marcarUna(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.notificacionesService.marcarComoLeida(id, currentUser);
  }

  @Patch(':id/archivar')
  archivar(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.notificacionesService.archivar(id, currentUser);
  }
}
