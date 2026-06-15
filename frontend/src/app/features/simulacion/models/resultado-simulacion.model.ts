export interface ResultadoSimulacion {
  sesionId: string;
  caso: {
    id: string;
    titulo: string;
  };
  puntajeTotal: number;
  puntajeMaximo: number;
  porcentaje: number;
  nivel: 'Requiere refuerzo' | 'Adecuado' | 'Sobresaliente';
  respondidas: number;
  totalPreguntas: number;
  noRespondidas: number;
  respuestasAcertadas: number;
  respuestasParciales: number;
  respuestasFallidas: number;
  finalizacionTipo: 'manual' | 'timeout' | null;
  retroalimentacionDocenteGeneral: string | null;
  retroalimentacionDocenteAt: string | null;
  rubrica: Array<{
    id: string;
    criterio: string;
    descripcion: string;
    nivelEsperado: string | null;
    peso: number | null;
    orden: number;
  }>;
  resumen: string;
  respuestas: Array<{
    escenarioOrden: number;
    escenarioTitulo: string;
    pregunta: string;
    opcionSeleccionada: string;
    puntajeObtenido: number;
    tipoRespuesta: 'correcta' | 'alternativa' | 'incorrecta' | 'sin_respuesta';
    retroalimentacion: string | null;
  }>;
}
