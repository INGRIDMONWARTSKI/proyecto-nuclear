import { BadRequestException } from '@nestjs/common';
import { Role } from '../common/enums/role.enum';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasosService } from './casos.service';
import { DecisionesService } from './decisiones.service';

describe('DecisionesService', () => {
  const currentUser: AuthenticatedUser = {
    sub: 'prof-1',
    email: 'profesor@nuclear.local',
    role: Role.PROFESOR,
    tokenVersion: 1,
  };

  let postgrest: jest.Mocked<PostgrestService>;
  let casosService: jest.Mocked<CasosService>;
  let service: DecisionesService;

  beforeEach(() => {
    postgrest = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<PostgrestService>;

    casosService = {
      findCasoById: jest.fn().mockResolvedValue({
        id: 'case-1',
        autor_docente_id: 'prof-1',
        estado: 'draft',
      }),
      assertCanAccessCasoDocente: jest.fn(),
    } as unknown as jest.Mocked<CasosService>;

    service = new DecisionesService(postgrest, casosService);
  });

  it('rechaza crear una opcion con puntaje mayor al maximo de la pregunta', async () => {
    postgrest.select.mockImplementation(
      async (table: string, options?: { filters?: Record<string, unknown> }) => {
        if (table === 'preguntas_decision') {
          return [
            {
              id: 'preg-1',
              escenario_id: 'esc-1',
              enunciado: 'Pregunta de prueba suficientemente extensa',
              tipo: 'single_choice',
              puntaje_maximo: 10,
            },
          ] as never;
        }

        if (table === 'escenarios') {
          return [
            {
              id: 'esc-1',
              caso_id: 'case-1',
            },
          ] as never;
        }

        if (table === 'opciones_respuesta') {
          return [] as never;
        }

        return [] as never;
      },
    );

    await expect(
      service.createOpcion(
        'preg-1',
        {
          texto: 'Respuesta',
          orden: 1,
          puntaje: 15,
        },
        currentUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza reducir el puntaje maximo de la pregunta por debajo del mayor puntaje de sus respuestas', async () => {
    postgrest.select.mockImplementation(
      async (table: string, options?: { filters?: Record<string, unknown> }) => {
        if (table === 'preguntas_decision') {
          return [
            {
              id: 'preg-1',
              escenario_id: 'esc-1',
              enunciado: 'Pregunta de prueba suficientemente extensa',
              tipo: 'single_choice',
              puntaje_maximo: 10,
            },
          ] as never;
        }

        if (table === 'escenarios') {
          return [
            {
              id: 'esc-1',
              caso_id: 'case-1',
            },
          ] as never;
        }

        if (table === 'opciones_respuesta') {
          return [
            {
              id: 'opt-1',
              pregunta_id: 'preg-1',
              puntaje: 8,
            },
          ] as never;
        }

        return [] as never;
      },
    );

    await expect(
      service.updatePregunta(
        'preg-1',
        {
          puntajeMaximo: 5,
        },
        currentUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
