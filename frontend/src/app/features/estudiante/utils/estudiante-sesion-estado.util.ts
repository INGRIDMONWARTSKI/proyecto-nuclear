import { HistorialIntento } from '../../simulacion/models/historial-intento.model';
import { SesionActiva } from '../../simulacion/models/sesion-activa.model';

export type EstadoCasoEstudiante = 'disponible' | 'en_progreso' | 'finalizado';

export interface ResumenSesionCaso {
  estado: EstadoCasoEstudiante;
  sesionActivaId?: string;
  ultimaSesionCompletadaId?: string;
}

export function buildResumenSesionesPorCaso(
  sesionesActivas: SesionActiva[],
  historial: HistorialIntento[],
): Map<string, ResumenSesionCaso> {
  const map = new Map<string, ResumenSesionCaso>();

  for (const activa of sesionesActivas) {
    map.set(activa.casoId, {
      estado: 'en_progreso',
      sesionActivaId: activa.sesionId,
    });
  }

  for (const intento of historial) {
    if (map.get(intento.casoId)?.estado === 'en_progreso') {
      continue;
    }

    if (!map.has(intento.casoId)) {
      map.set(intento.casoId, {
        estado: 'finalizado',
        ultimaSesionCompletadaId: intento.sesionId,
      });
    }
  }

  return map;
}

export function getResumenCaso(
  map: Map<string, ResumenSesionCaso>,
  casoId: string,
): ResumenSesionCaso {
  return map.get(casoId) ?? { estado: 'disponible' };
}

export function obtenerSesionActivaReciente(
  sesionesActivas: SesionActiva[],
): SesionActiva | null {
  if (sesionesActivas.length === 0) {
    return null;
  }

  return [...sesionesActivas].sort(
    (a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime(),
  )[0];
}
