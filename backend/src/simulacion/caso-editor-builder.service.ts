import { Injectable } from '@nestjs/common';
import { ALLOWED_BACKGROUND_CODES } from './constants/backgrounds.constant';
import { buildDefaultLayout, normalizeLayout } from './editor-layout.util';
import { PostgrestService } from '../postgrest/postgrest.service';
import { CasoRecord } from './entities/caso.entity';
import { EscenarioRecord } from './entities/escenario.entity';
import { OpcionRespuestaRecord } from './entities/opcion-respuesta.entity';
import { PreguntaDecisionRecord } from './entities/pregunta-decision.entity';
import { RetroalimentacionRecord } from './entities/retroalimentacion.entity';
import { CasoEditor, CasoEditorScenario } from './types/caso-editor.types';

interface LegacyElementoEscenaRecord {
  id: string;
  escenario_id: string;
  tipo: 'personaje' | 'objeto' | 'texto';
  asset_codigo: string | null;
  texto_contenido: string | null;
  pos_x: number;
  pos_y: number;
  ancho: number;
  alto: number;
  rotacion: number;
  z_index: number;
}

@Injectable()
export class CasoEditorBuilderService {
  constructor(private readonly postgrest: PostgrestService) {}

  async build(caso: CasoRecord, validationErrors: string[] = []): Promise<CasoEditor> {
    const escenarios = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: caso.id },
      order: 'orden.asc',
    });

    const legacyElements = escenarios.length
      ? await this.postgrest.select<LegacyElementoEscenaRecord>('elementos_escena', {
          filters: { escenario_id: escenarios.map((escenario) => escenario.id) },
          order: 'z_index.asc',
        })
      : [];

    const legacyByEscenarioId = new Map<string, LegacyElementoEscenaRecord[]>();

    for (const item of legacyElements) {
      const current = legacyByEscenarioId.get(item.escenario_id) ?? [];
      current.push(item);
      legacyByEscenarioId.set(item.escenario_id, current);
    }

    const preguntas = escenarios.length
      ? await this.postgrest.select<PreguntaDecisionRecord>('preguntas_decision', {
          filters: { escenario_id: escenarios.map((escenario) => escenario.id) },
        })
      : [];

    const preguntasByEscenarioId = new Map(
      preguntas.map((pregunta) => [pregunta.escenario_id, pregunta]),
    );

    const opciones = preguntas.length
      ? await this.postgrest.select<OpcionRespuestaRecord>('opciones_respuesta', {
          filters: { pregunta_id: preguntas.map((pregunta) => pregunta.id) },
          order: 'orden.asc',
        })
      : [];

    const opcionesByPreguntaId = new Map<string, OpcionRespuestaRecord[]>();
    for (const opcion of opciones) {
      const current = opcionesByPreguntaId.get(opcion.pregunta_id) ?? [];
      current.push(opcion);
      opcionesByPreguntaId.set(opcion.pregunta_id, current);
    }

    const retros = opciones.length
      ? await this.postgrest.select<RetroalimentacionRecord>('retroalimentaciones', {
          filters: { opcion_id: opciones.map((opcion) => opcion.id) },
        })
      : [];

    const retroByOpcionId = new Map(retros.map((retro) => [retro.opcion_id, retro]));

    const editorScenarios: CasoEditorScenario[] = escenarios.map((escenario) => {
      const pregunta = preguntasByEscenarioId.get(escenario.id) ?? null;
      const layout = normalizeLayout(
        escenario.layout_data,
        escenario,
        legacyByEscenarioId.get(escenario.id) ?? [],
      );

      return {
        id: escenario.id,
        orden: escenario.orden,
        titulo: escenario.titulo,
        situacionTexto: escenario.situacion_texto,
        fondoCodigo: escenario.fondo_codigo,
        isFinal: escenario.is_final,
        layout: layout.elements.length > 0 ? layout : buildDefaultLayout(escenario),
        pregunta: pregunta
          ? {
              id: pregunta.id,
              enunciado: pregunta.enunciado,
              tipo: pregunta.tipo,
              puntajeMaximo: pregunta.puntaje_maximo,
              opciones: (opcionesByPreguntaId.get(pregunta.id) ?? []).map((opcion) => {
                const retro = retroByOpcionId.get(opcion.id) ?? null;
                return {
                  id: opcion.id,
                  texto: opcion.texto,
                  orden: opcion.orden,
                  puntaje: opcion.puntaje,
                  isCorrecta: opcion.is_correcta,
                  escenarioDestinoId: opcion.escenario_destino_id ?? null,
                  retroalimentacion: retro
                    ? {
                        id: retro.id,
                        mensaje: retro.mensaje,
                        tipo: retro.tipo,
                        referenciaTeorica: retro.referencia_teorica,
                      }
                    : null,
                };
              }),
            }
          : null,
      };
    });

    const scenarioById = new Map(editorScenarios.map((item) => [item.id, item]));
    const conexiones = editorScenarios.flatMap((scenario, index) =>
      (scenario.pregunta?.opciones ?? []).map((opcion) => {
        const explicit = opcion.escenarioDestinoId
          ? scenarioById.get(opcion.escenarioDestinoId) ?? null
          : null;
        const ordered =
          explicit ?? (index < editorScenarios.length - 1 ? editorScenarios[index + 1] : null);
        const destino = scenario.isFinal ? null : ordered;

        return {
          opcionId: opcion.id,
          opcionTexto: opcion.texto,
          origenEscenarioId: scenario.id,
          origenOrden: scenario.orden,
          destinoEscenarioId: destino?.id ?? null,
          destinoOrden: destino?.orden ?? null,
          tipo: scenario.isFinal
            ? ('fin' as const)
            : explicit
              ? ('explicito' as const)
              : destino
                ? ('orden' as const)
                : ('fin' as const),
        };
      }),
    );

    return {
      id: caso.id,
      titulo: caso.titulo,
      descripcion: caso.descripcion,
      objetivoAprendizaje: caso.objetivo_aprendizaje,
      autorDocenteId: caso.autor_docente_id,
      estado: caso.estado,
      isActive: caso.is_active,
      publishedAt: caso.published_at,
      createdAt: caso.created_at,
      updatedAt: caso.updated_at,
      escenarios: editorScenarios,
      conexiones,
      catalogos: {
        backgrounds: [...ALLOWED_BACKGROUND_CODES],
        elementTypes: [
          'background',
          'character',
          'text',
          'image',
          'object',
          'audio',
          'question',
          'instruction',
          'feedback',
        ],
      },
      validationErrors,
    };
  }
}
