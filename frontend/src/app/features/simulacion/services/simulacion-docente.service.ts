import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CasoDocente,
  CasoDocenteDetalle,
  PublicarCasoResponse,
} from '../models/docente/caso-docente.model';
import { CasoPreview } from '../models/docente/caso-preview.model';
import { EscenarioDocente } from '../models/docente/escenario-docente.model';
import { EvidenciaDocente } from '../models/docente/evidencia-docente.model';
import { RevisionSesionDocente } from '../models/docente/revision-sesion-docente.model';
import { SesionEvidencia } from '../models/docente/sesion-evidencia.model';

@Injectable({ providedIn: 'root' })
export class SimulacionDocenteService {
  private readonly http = inject(HttpClient);
  private readonly casosUrl = `${environment.apiUrl}/simulacion/docente/casos`;
  private readonly docenteUrl = `${environment.apiUrl}/simulacion/docente`;

  listarCasos() {
    return this.http.get<CasoDocente[]>(this.casosUrl);
  }

  obtenerCaso(casoId: string) {
    return this.http.get<CasoDocenteDetalle>(`${this.casosUrl}/${casoId}`);
  }

  crearCaso(payload: {
    titulo: string;
    descripcion?: string;
    objetivoAprendizaje?: string;
  }) {
    return this.http.post<CasoDocente>(this.casosUrl, payload);
  }

  actualizarCaso(
    casoId: string,
    payload: {
      titulo?: string;
      descripcion?: string;
      objetivoAprendizaje?: string;
    },
  ) {
    return this.http.patch<CasoDocente>(`${this.casosUrl}/${casoId}`, payload);
  }

  listarEscenarios(casoId: string) {
    return this.http.get<EscenarioDocente[]>(
      `${this.docenteUrl}/casos/${casoId}/escenarios`,
    );
  }

  crearEscenario(
    casoId: string,
    payload: {
      orden: number;
      titulo: string;
      situacionTexto: string;
      fondoCodigo: string;
      isFinal?: boolean;
    },
  ) {
    return this.http.post<EscenarioDocente>(
      `${this.docenteUrl}/casos/${casoId}/escenarios`,
      payload,
    );
  }

  actualizarEscenario(
    escenarioId: string,
    payload: {
      orden?: number;
      titulo?: string;
      situacionTexto?: string;
      fondoCodigo?: string;
      isFinal?: boolean;
    },
  ) {
    return this.http.patch<EscenarioDocente>(
      `${this.docenteUrl}/escenarios/${escenarioId}`,
      payload,
    );
  }

  crearPregunta(
    escenarioId: string,
    payload: { enunciado: string; tipo?: string; puntajeMaximo?: number },
  ) {
    return this.http.post(`${this.docenteUrl}/escenarios/${escenarioId}/pregunta`, payload);
  }

  crearOpcion(
    preguntaId: string,
    payload: {
      texto: string;
      orden: number;
      puntaje: number;
      isCorrecta?: boolean;
      escenarioDestinoId?: string | null;
    },
  ) {
    return this.http.post(`${this.docenteUrl}/preguntas/${preguntaId}/opciones`, payload);
  }

  actualizarOpcion(
    opcionId: string,
    payload: {
      texto?: string;
      orden?: number;
      puntaje?: number;
      isCorrecta?: boolean;
      escenarioDestinoId?: string | null;
    },
  ) {
    return this.http.patch(`${this.docenteUrl}/opciones/${opcionId}`, payload);
  }

  eliminarOpcion(opcionId: string) {
    return this.http.delete(`${this.docenteUrl}/opciones/${opcionId}`);
  }

  crearRetroalimentacion(
    opcionId: string,
    payload: {
      mensaje: string;
      tipo?: string;
      referenciaTeorica?: string;
    },
  ) {
    return this.http.post(
      `${this.docenteUrl}/opciones/${opcionId}/retroalimentacion`,
      payload,
    );
  }

  actualizarRetroalimentacion(
    retroalimentacionId: string,
    payload: {
      mensaje?: string;
      tipo?: string;
      referenciaTeorica?: string;
    },
  ) {
    return this.http.patch(
      `${this.docenteUrl}/retroalimentaciones/${retroalimentacionId}`,
      payload,
    );
  }

  eliminarRetroalimentacion(retroalimentacionId: string) {
    return this.http.delete(
      `${this.docenteUrl}/retroalimentaciones/${retroalimentacionId}`,
    );
  }

  obtenerPreview(casoId: string) {
    return this.http.get<CasoPreview>(`${this.casosUrl}/${casoId}/preview`);
  }

  publicarCaso(casoId: string) {
    return this.http.post<PublicarCasoResponse>(
      `${this.casosUrl}/${casoId}/publicar`,
      {},
    );
  }

  listarEvidencias(): Observable<EvidenciaDocente[]>;
  listarEvidencias(casoId: string): Observable<SesionEvidencia[]>;
  listarEvidencias(casoId?: string) {
    if (casoId) {
      return this.http.get<SesionEvidencia[]>(`${this.casosUrl}/${casoId}/sesiones`);
    }
    return this.http.get<EvidenciaDocente[]>(`${this.docenteUrl}/evidencias`);
  }

  obtenerRevisionSesion(sesionId: string) {
    return this.http.get<RevisionSesionDocente>(
      `${this.docenteUrl}/sesiones/${sesionId}/revision`,
    );
  }

  listarGruposAsignados(casoId: string) {
    return this.http.get<CasoGrupoAsignado[]>(
      `${this.casosUrl}/${casoId}/grupos`,
    );
  }

  asignarGrupos(casoId: string, grupoIds: string[]) {
    return this.http.post<CasoGrupoAsignado[]>(
      `${this.casosUrl}/${casoId}/grupos`,
      { grupoIds },
    );
  }

  quitarAsignacion(casoId: string, grupoId: string) {
    return this.http.delete<{ message: string }>(
      `${this.casosUrl}/${casoId}/grupos/${grupoId}`,
    );
  }
}

export interface CasoGrupoAsignado {
  grupoId: string;
  nombre: string | null;
  isActive: boolean | null;
  asignadoPor: string;
  createdAt: string;
}
