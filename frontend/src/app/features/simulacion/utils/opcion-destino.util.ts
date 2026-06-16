/** Valor del selector cuando la opción termina la simulación. */
export const FIN_SIMULACION_DESTINO = '__FIN_SIMULACION__';

export interface EscenarioOrdenRef {
  id: string;
  orden: number;
  titulo?: string;
}

export function hasNextScenarioByOrder(
  escenarioId: string,
  escenarios: EscenarioOrdenRef[],
): boolean {
  const sorted = [...escenarios].sort((a, b) => a.orden - b.orden);
  const index = sorted.findIndex((item) => item.id === escenarioId);
  return index >= 0 && index < sorted.length - 1;
}

/** Convierte el valor persistido de la opción al valor del &lt;select&gt;. */
export function destinoToSelectValue(
  escenarioDestinoId: string | null | undefined,
  escenarioId: string,
  escenarios: EscenarioOrdenRef[],
): string {
  if (escenarioDestinoId) {
    return escenarioDestinoId;
  }

  if (!hasNextScenarioByOrder(escenarioId, escenarios)) {
    return FIN_SIMULACION_DESTINO;
  }

  return '';
}

/** Convierte la selección del docente al payload de API (null = fin o siguiente por orden). */
export function selectValueToDestinoPayload(
  value: string,
): string | null {
  if (!value || value === FIN_SIMULACION_DESTINO) {
    return null;
  }

  return value;
}

export function labelDestinoOpcion(
  escenarioDestinoId: string | null | undefined,
  escenarioId: string,
  escenarios: EscenarioOrdenRef[],
): string {
  if (escenarioDestinoId) {
    const destino = escenarios.find((item) => item.id === escenarioDestinoId);
    return destino
      ? `E${destino.orden}${destino.titulo ? ` · ${destino.titulo}` : ''}`
      : 'Escenario destino';
  }

  if (!hasNextScenarioByOrder(escenarioId, escenarios)) {
    return 'Fin de simulación';
  }

  return 'Siguiente por orden';
}
