import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CasoPublicado } from '../models/caso-publicado.model';
import { EscenarioActualResponse } from '../models/escenario-actual.model';
import {
  FinalizarSesionResponse,
  SesionInicioResponse,
} from '../models/sesion-simulacion.model';
import {
  RespuestaSubmitPayload,
  RespuestaSubmitResponse,
} from '../models/respuesta-submit.model';
import { ResultadoSimulacion } from '../models/resultado-simulacion.model';
import { HistorialIntento } from '../models/historial-intento.model';

@Injectable({ providedIn: 'root' })
export class SimulacionEstudianteService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/simulacion/estudiante`;

  getCasosPublicados() {
    return this.http.get<CasoPublicado[]>(`${this.baseUrl}/casos`);
  }

  startSesion(casoId: string) {
    return this.http.post<SesionInicioResponse>(`${this.baseUrl}/sesiones`, { casoId });
  }

  getEscenarioActual(sesionId: string) {
    return this.http.get<EscenarioActualResponse>(
      `${this.baseUrl}/sesiones/${sesionId}/escenario-actual`,
    );
  }

  submitRespuesta(sesionId: string, payload: RespuestaSubmitPayload) {
    return this.http.post<RespuestaSubmitResponse>(
      `${this.baseUrl}/sesiones/${sesionId}/respuestas`,
      payload,
    );
  }

  finalizarSesion(sesionId: string) {
    return this.http.post<FinalizarSesionResponse>(
      `${this.baseUrl}/sesiones/${sesionId}/finalizar`,
      {},
    );
  }

  getResultado(sesionId: string) {
    return this.http.get<ResultadoSimulacion>(
      `${this.baseUrl}/sesiones/${sesionId}/resultado`,
    );
  }

  listarHistorial() {
    return this.http.get<HistorialIntento[]>(`${this.baseUrl}/historial`);
  }
}
