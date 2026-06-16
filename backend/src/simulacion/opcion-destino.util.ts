import { EscenarioRecord } from './entities/escenario.entity';
import { OpcionRespuestaRecord } from './entities/opcion-respuesta.entity';

export function resolveNextEscenarioFromOpcion(
  casoId: string,
  escenarioActual: EscenarioRecord,
  opcion: Pick<OpcionRespuestaRecord, 'escenario_destino_id'>,
  escenarios: EscenarioRecord[],
): EscenarioRecord | null {
  if (escenarioActual.is_final) {
    return null;
  }

  if (opcion.escenario_destino_id) {
    const destino = escenarios.find(
      (escenario) => escenario.id === opcion.escenario_destino_id,
    );

    if (!destino || destino.caso_id !== casoId) {
      return null;
    }

    return destino;
  }

  const sorted = [...escenarios].sort((a, b) => a.orden - b.orden);
  const indiceActual = sorted.findIndex(
    (escenario) => escenario.id === escenarioActual.id,
  );

  if (indiceActual === -1 || indiceActual >= sorted.length - 1) {
    return null;
  }

  return sorted[indiceActual + 1];
}
