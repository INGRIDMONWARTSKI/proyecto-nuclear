import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CasoEditor,
} from '../models/docente/caso-editor.model';
import {
  AiAsset,
  AiAssetStyle,
  AiAssetType,
  DocenteAsset,
  DocenteAssetType,
  AiAssetVisibleType,
} from '../models/docente/ai-asset.model';
import {
  CasoDocente,
  CasoDocenteDetalle,
  PublicarCasoResponse,
} from '../models/docente/caso-docente.model';
import { CasoPreview } from '../models/docente/caso-preview.model';
import { EscenarioDocente } from '../models/docente/escenario-docente.model';
import { EvidenciaDocente } from '../models/docente/evidencia-docente.model';
import {
  GenerarCasoIaPayload,
  GenerarCasoIaResponse,
} from '../models/docente/generar-caso-ia.model';
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

  obtenerEditorCaso(casoId: string) {
    return this.http.get<CasoEditor>(`${this.casosUrl}/${casoId}/editor`);
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

  generarCasoConIa(payload: GenerarCasoIaPayload) {
    return this.http.post<GenerarCasoIaResponse>(
      `${this.casosUrl}/generar`,
      payload,
    );
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

  actualizarLayoutEscenario(
    escenarioId: string,
    payload: {
      version?: number;
      elements: unknown[];
    },
  ) {
    return this.http.patch<EscenarioDocente>(
      `${this.docenteUrl}/escenarios/${escenarioId}/layout`,
      payload,
    );
  }

  duplicarEscenario(escenarioId: string) {
    return this.http.post<EscenarioDocente>(
      `${this.docenteUrl}/escenarios/${escenarioId}/duplicate`,
      {},
    );
  }

  eliminarEscenario(casoId: string, escenarioId: string) {
    return this.http.delete<{
      success: boolean;
      deletedScenarioId: string;
      remainingScenarios: EscenarioDocente[];
    }>(`${this.docenteUrl}/casos/${casoId}/escenarios/${escenarioId}`);
  }

  generarAiAsset(payload: {
    casoId: string;
    escenarioId: string;
    tipo: AiAssetType;
    visibleType?: AiAssetVisibleType;
    descripcion: string;
    estilo: AiAssetStyle;
  }) {
    return this.http.post<AiAsset>(`${environment.apiUrl}/ai-assets/generate`, payload);
  }

  listarAiAssetsCaso(casoId: string) {
    return this.http.get<AiAsset[]>(`${environment.apiUrl}/ai-assets/caso/${casoId}`);
  }

  subirDocenteAsset(payload: {
    casoId: string;
    nombre: string;
    tipo: DocenteAssetType;
    file: File;
  }) {
    const formData = new FormData();
    formData.append('casoId', payload.casoId);
    formData.append('nombre', payload.nombre);
    formData.append('tipo', payload.tipo);
    formData.append('file', payload.file);

    return this.http.post<DocenteAsset>(`${environment.apiUrl}/ai-assets/upload`, formData);
  }

  listarDocenteAssetsCaso(casoId: string) {
    return this.http.get<DocenteAsset[]>(
      `${environment.apiUrl}/ai-assets/docente/caso/${casoId}`,
    );
  }

  insertarAiAssetEnEscenario(
    assetId: string,
    escenarioId: string,
    visibleType?: AiAssetVisibleType,
  ) {
    return this.http.post<AiAsset>(
      `${environment.apiUrl}/ai-assets/${assetId}/insertar-en-escenario`,
      { escenarioId, visibleType },
    );
  }

  crearPregunta(
    escenarioId: string,
    payload: { enunciado: string; tipo?: string; puntajeMaximo?: number },
  ) {
    return this.http.post(`${this.docenteUrl}/escenarios/${escenarioId}/pregunta`, payload);
  }

  actualizarPregunta(
    preguntaId: string,
    payload: { enunciado?: string; tipo?: string; puntajeMaximo?: number },
  ) {
    return this.http.patch(`${this.docenteUrl}/preguntas/${preguntaId}`, payload);
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
