import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { NotificacionesService } from '../notificaciones/notificaciones.service';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasosService } from './casos.service';
import { SesionesSimulacionService } from './sesiones-simulacion.service';

describe('SesionesSimulacionService', () => {
  const currentUser: AuthenticatedUser = {
    sub: 'prof-1',
    email: 'profesor@nuclear.local',
    role: Role.PROFESOR,
    tokenVersion: 1,
  };

  let postgrest: jest.Mocked<PostgrestService>;
  let casosService: jest.Mocked<CasosService>;
  let notificacionesService: jest.Mocked<NotificacionesService>;
  let service: SesionesSimulacionService;

  beforeEach(() => {
    postgrest = {
      select: jest.fn(),
    } as unknown as jest.Mocked<PostgrestService>;
    casosService = {
      findCasoById: jest.fn().mockResolvedValue({
        id: 'case-1',
        titulo: 'Caso de prueba',
        autor_docente_id: 'prof-1',
        estado: 'published',
        is_active: true,
      }),
      assertCanAccessCasoDocente: jest.fn(),
      isCasoAsignadoAEstudiante: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<CasosService>;
    notificacionesService = {
      crearParaUsuario: jest.fn(),
    } as unknown as jest.Mocked<NotificacionesService>;
    service = new SesionesSimulacionService(
      postgrest,
      casosService,
      notificacionesService,
    );
  });

  it('filtra evidencias por estudiantes realmente vinculados a grupos del profesor', async () => {
    postgrest.select.mockImplementation(async (table: string, options?: { filters?: Record<string, unknown> }) => {
      if (table === 'casos') {
        return [{ id: 'case-1' }] as never;
      }

      if (table === 'caso_grupo') {
        if (options?.filters?.casoId === 'case-1') {
          return [{ casoId: 'case-1', grupoId: 'grupo-1' }] as never;
        }

        return [{ casoId: 'case-1', grupoId: 'grupo-1' }] as never;
      }

      if (table === 'grupos') {
        return [{ id: 'grupo-1', profesorId: 'prof-1' }] as never;
      }

      if (table === 'estudiante_grupo') {
        return [{ grupoId: 'grupo-1', estudianteId: 'est-1' }] as never;
      }

      if (table === 'sesiones_simulacion') {
        return [
          {
            id: 'ses-1',
            caso_id: 'case-1',
            estudiante_id: 'est-1',
            estado: 'completed',
            puntaje_total: 90,
            total_preguntas: 10,
            respondidas: 10,
            started_at: '2026-06-09T10:00:00.000Z',
            finished_at: '2026-06-09T10:20:00.000Z',
          },
          {
            id: 'ses-2',
            caso_id: 'case-1',
            estudiante_id: 'est-2',
            estado: 'completed',
            puntaje_total: 70,
            total_preguntas: 10,
            respondidas: 10,
            started_at: '2026-06-09T11:00:00.000Z',
            finished_at: '2026-06-09T11:20:00.000Z',
          },
        ] as never;
      }

      return [] as never;
    });

    const evidencias = await service.findEvidenciasByCaso('case-1', currentUser);

    expect(evidencias).toHaveLength(1);
    expect(evidencias[0]).toMatchObject({
      sesionId: 'ses-1',
      estudianteId: 'est-1',
    });
  });

  it('bloquea iniciar un nuevo intento cuando el estudiante ya completo el caso', async () => {
    const estudiante: AuthenticatedUser = {
      sub: 'est-1',
      email: 'estudiante@nuclear.local',
      role: Role.ESTUDIANTE,
      tokenVersion: 1,
    };

    postgrest.select.mockImplementation(
      async (table: string, options?: { filters?: Record<string, unknown> }) => {
        if (table === 'escenarios') {
          return [
            {
              id: 'esc-1',
              caso_id: 'case-1',
              orden: 1,
              titulo: 'Escenario 1',
              situacion_texto: 'Situacion de prueba',
              fondo_codigo: 'aula',
              is_final: false,
            },
          ] as never;
        }

        if (table === 'sesiones_simulacion') {
          if (options?.filters?.estado === 'in_progress') {
            return [] as never;
          }

          if (options?.filters?.estado === 'completed') {
            return [
              {
                id: 'ses-completed',
                caso_id: 'case-1',
                estudiante_id: 'est-1',
                estado: 'completed',
              },
            ] as never;
          }
        }

        return [] as never;
      },
    );

    await expect(service.start({ casoId: 'case-1' }, estudiante)).rejects.toThrow(
      'Ya completaste este caso. Para realizar un nuevo intento necesitas autorización del docente.',
    );
  });
});
