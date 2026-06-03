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
  resumen: string;
  respuestas: Array<{
    pregunta: string;
    opcionSeleccionada: string;
    puntajeObtenido: number;
    retroalimentacion: string | null;
  }>;
}
