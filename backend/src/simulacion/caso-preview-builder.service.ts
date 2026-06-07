import { Injectable } from '@nestjs/common';
import { normalizeLayout } from './editor-layout.util';
import { PostgrestService } from '../postgrest/postgrest.service';
import { Caso, CasoRecord } from './entities/caso.entity';
import { EscenarioRecord } from './entities/escenario.entity';
import { OpcionRespuestaRecord } from './entities/opcion-respuesta.entity';
import { PreguntaDecisionRecord } from './entities/pregunta-decision.entity';
import { RetroalimentacionRecord } from './entities/retroalimentacion.entity';
import {
  CasoPreviewTree,
  EscenarioPreview,
  OpcionPreview,
} from './types/caso-preview.types';

interface ElementoEscenaRecord {
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
  created_at: string;
  updated_at: string;
}

@Injectable()
export class CasoPreviewBuilderService {
  constructor(private readonly postgrest: PostgrestService) {}

  async build(caso: CasoRecord): Promise<CasoPreviewTree> {
    const escenarios = await this.postgrest.select<EscenarioRecord>('escenarios', {
      filters: { caso_id: caso.id },
      order: 'orden.asc',
    });

    const escenariosPreview: EscenarioPreview[] = [];

    for (const escenario of escenarios) {
      const elementos = await this.postgrest.select<ElementoEscenaRecord>(
        'elementos_escena',
        {
          filters: { escenario_id: escenario.id },
          order: 'z_index.asc',
        },
      );

      const [pregunta] = await this.postgrest.select<PreguntaDecisionRecord>(
        'preguntas_decision',
        {
          filters: { escenario_id: escenario.id },
          limit: 1,
        },
      );

      let preguntaPreview: EscenarioPreview['pregunta'] = null;

      if (pregunta) {
        const opciones = await this.postgrest.select<OpcionRespuestaRecord>(
          'opciones_respuesta',
          {
            filters: { pregunta_id: pregunta.id },
            order: 'orden.asc',
          },
        );

        const opcionesPreview: OpcionPreview[] = [];

        for (const opcion of opciones) {
          const [retro] = await this.postgrest.select<RetroalimentacionRecord>(
            'retroalimentaciones',
            {
              filters: { opcion_id: opcion.id },
              limit: 1,
            },
          );

          opcionesPreview.push({
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
          });
        }

        preguntaPreview = {
          id: pregunta.id,
          enunciado: pregunta.enunciado,
          tipo: pregunta.tipo,
          puntajeMaximo: pregunta.puntaje_maximo,
          opciones: opcionesPreview,
        };
      }

      escenariosPreview.push({
        id: escenario.id,
        orden: escenario.orden,
        titulo: escenario.titulo,
        situacionTexto: escenario.situacion_texto,
        fondoCodigo: escenario.fondo_codigo as EscenarioPreview['fondoCodigo'],
        isFinal: escenario.is_final,
        elementos: elementos.map((el) => ({
          id: el.id,
          tipo: el.tipo,
          assetCodigo: el.asset_codigo,
          textoContenido: el.texto_contenido,
          posX: el.pos_x,
          posY: el.pos_y,
          ancho: el.ancho,
          alto: el.alto,
          rotacion: el.rotacion,
          zIndex: el.z_index,
          createdAt: el.created_at,
          updatedAt: el.updated_at,
        })),
        layout: normalizeLayout(escenario.layout_data, escenario, elementos),
        pregunta: preguntaPreview,
      });
    }

    return {
      ...this.toCaso(caso),
      escenarios: escenariosPreview,
    };
  }

  private toCaso(record: CasoRecord): Caso {
    return {
      id: record.id,
      titulo: record.titulo,
      descripcion: record.descripcion,
      objetivoAprendizaje: record.objetivo_aprendizaje,
      autorDocenteId: record.autor_docente_id,
      estado: record.estado,
      isActive: record.is_active,
      publishedAt: record.published_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    };
  }
}
