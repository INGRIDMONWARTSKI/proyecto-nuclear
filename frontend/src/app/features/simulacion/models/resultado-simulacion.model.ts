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
