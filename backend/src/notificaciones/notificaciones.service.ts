import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  CrearNotificacionPayload,
  Notificacion,
  NotificacionRecord,
} from './entities/notificacion.entity';

@Injectable()
export class NotificacionesService {
  constructor(private readonly postgrest: PostgrestService) {}

  async crearParaUsuario(usuarioId: string, payload: CrearNotificacionPayload) {
    return this.postgrest.insert<NotificacionRecord>(
      'notificaciones',
      {
        usuario_id_destino: usuarioId,
        ...payload,
      },
      { select: '*' },
    );
  }

  async crearParaAdmins(payload: CrearNotificacionPayload) {
    const admins = await this.postgrest.select<Usuario>('usuarios', {
      filters: { role: Role.ADMIN, isActive: true },
      select: 'id',
    });

    for (const admin of admins) {
      await this.crearParaUsuario(admin.id, payload);
    }
  }

  async listarParaUsuarioActual(currentUser: AuthenticatedUser) {
    const records = await this.postgrest.select<NotificacionRecord>(
      'notificaciones',
      {
        filters: { usuario_id_destino: currentUser.sub },
        order: 'created_at.desc',
      },
    );

    return records.map((item) => this.toNotificacion(item));
  }

  async contarNoLeidas(currentUser: AuthenticatedUser) {
    const records = await this.postgrest.select<Pick<NotificacionRecord, 'id'>>(
      'notificaciones',
      {
        filters: { usuario_id_destino: currentUser.sub, leida: false },
        select: 'id',
      },
    );

    return { count: records.length };
  }

  async marcarComoLeida(id: string, currentUser: AuthenticatedUser) {
    const record = await this.findOwned(id, currentUser);
    const [updated] = await this.postgrest.update<NotificacionRecord>(
      'notificaciones',
      { leida: true },
      { filters: { id: record.id }, select: '*' },
    );

    return this.toNotificacion(updated);
  }

  async marcarTodasComoLeidas(currentUser: AuthenticatedUser) {
    await this.postgrest.update<NotificacionRecord>(
      'notificaciones',
      { leida: true },
      { filters: { usuario_id_destino: currentUser.sub }, select: 'id' },
    );

    return { message: 'Notificaciones marcadas como leidas.' };
  }

  private async findOwned(id: string, currentUser: AuthenticatedUser) {
    const [record] = await this.postgrest.select<NotificacionRecord>(
      'notificaciones',
      { filters: { id }, limit: 1 },
    );

    if (!record) {
      throw new NotFoundException('Notificacion no encontrada.');
    }

    if (record.usuario_id_destino !== currentUser.sub) {
      throw new ForbiddenException('No puedes modificar esta notificacion.');
    }

    return record;
  }

  private toNotificacion(record: NotificacionRecord): Notificacion {
    return {
      id: record.id,
      usuarioIdDestino: record.usuario_id_destino,
      tipo: record.tipo,
      titulo: record.titulo,
      mensaje: record.mensaje,
      entidadTipo: record.entidad_tipo,
      entidadId: record.entidad_id,
      leida: record.leida,
      createdAt: record.created_at,
    };
  }
}
