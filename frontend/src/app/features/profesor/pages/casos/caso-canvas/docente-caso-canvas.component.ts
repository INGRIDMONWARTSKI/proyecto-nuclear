import { NgStyle } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getErrorMessage } from '../../../../../core/utils/http-error.util';
import { AlertMessageComponent } from '../../../../../shared/ui/alert-message/alert-message.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { LoadingStateComponent } from '../../../../../shared/ui/loading-state/loading-state.component';
import {
  SiepStatusBadge,
  StatusBadgeComponent,
} from '../../../../../shared/ui/status-badge/status-badge.component';
import {
  CasoEditor,
  CasoEditorEscenario,
  CasoEditorOpcion,
} from '../../../../simulacion/models/docente/caso-editor.model';
import {
  AiAsset,
  AiAssetStyle,
  AiAssetVisibleType,
  DocenteAsset,
  DocenteAssetType,
} from '../../../../simulacion/models/docente/ai-asset.model';
import {
  EditorElement,
  EditorElementType,
} from '../../../../simulacion/models/docente/editor-layout.model';
import { SimulacionDocenteService } from '../../../../simulacion/services/simulacion-docente.service';

type EditorWorkspace = 'scene' | 'decisions' | 'student' | 'map';
type LibraryCategory = 'backgrounds' | 'characters' | 'texts' | 'objects' | 'questions' | 'audio';
type PropertySection = 'general' | 'appearance' | 'layout' | 'content' | 'advanced';

interface BibliotecaItem {
  id: string;
  nombre: string;
  tipo: EditorElementType;
  categoria: string;
  categoriaClave: LibraryCategory;
  icono: string;
  descripcion: string;
  tag: string;
  content: Record<string, unknown>;
  style?: Record<string, string | number | boolean | null>;
  size?: { width: number; height: number };
}

interface DragState {
  elementId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface ScenarioHistoryState {
  baseline: CasoEditorEscenario['layout'];
  past: CasoEditorEscenario['layout'][];
  future: CasoEditorEscenario['layout'][];
}

interface PatchScenarioOptions {
  trackHistory?: boolean;
}

@Component({
  selector: 'app-docente-caso-canvas',
  standalone: true,
  imports: [
    RouterLink,
    NgStyle,
    FormsModule,
    AlertMessageComponent,
    EmptyStateComponent,
    LoadingStateComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './docente-caso-canvas.component.html',
  styleUrl: './docente-caso-canvas.component.scss',
})
export class DocenteCasoCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly simulacionService = inject(SimulacionDocenteService);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly duplicating = signal(false);
  protected readonly deletingScenario = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly editor = signal<CasoEditor | null>(null);
  protected readonly workspace = signal<EditorWorkspace>('scene');
  protected readonly selectedEscenarioId = signal<string | null>(null);
  protected readonly selectedElementId = signal<string | null>(null);
  protected readonly resourcesPanelOpen = signal(false);
  protected readonly propertiesPanelOpen = signal(false);
  protected readonly selectedLibraryCategory = signal<LibraryCategory>('backgrounds');
  protected readonly selectedLibraryItemId = signal('ambientes-consultorio');
  protected readonly searchTerm = signal('');
  protected readonly dirtyScenarioIds = signal<string[]>([]);
  protected readonly openPropertySection = signal<PropertySection>('general');
  protected readonly zoomLevel = signal(1);
  protected readonly questionDraft = signal('');
  protected readonly questionScoreDraft = signal(10);
  protected readonly newOptionText = signal('');
  protected readonly newOptionScore = signal(0);
  protected readonly newOptionCorrect = signal(false);
  protected readonly newOptionDestino = signal('');
  protected readonly selectedDecisionOptionId = signal<string | null>(null);
  protected readonly feedbackDraft = signal('');
  protected readonly feedbackTypeDraft = signal<'pedagogica' | 'correctiva' | 'refuerzo'>(
    'pedagogica',
  );
  protected readonly feedbackReferenceDraft = signal('');
  protected readonly previewSelectedOptionId = signal<string | null>(null);
  protected readonly aiDescription = signal('');
  protected readonly aiStyle = signal<AiAssetStyle>('editorial_sereno');
  protected readonly aiVisibleType = signal<AiAssetVisibleType>('background');
  protected readonly aiGenerating = signal(false);
  protected readonly aiApplying = signal(false);
  protected readonly aiAssets = signal<AiAsset[]>([]);
  protected readonly selectedAiAssetId = signal<string | null>(null);
  protected readonly docenteAssets = signal<DocenteAsset[]>([]);
  protected readonly docenteAssetName = signal('');
  protected readonly docenteAssetType = signal<DocenteAssetType>('OBJETO');
  protected readonly docenteAssetFile = signal<File | null>(null);
  protected readonly docenteUploading = signal(false);
  protected readonly docenteMessage = signal<string | null>(null);
  protected readonly docenteErrorMessage = signal<string | null>(null);
  protected readonly libraryPanelTab = signal<'sistema' | 'docente' | 'ia' | 'capas'>('sistema');
  protected readonly aiErrorMessage = signal<string | null>(null);
  protected readonly deleteScenarioDialogId = signal<string | null>(null);

  protected casoId = '';
  protected readonly sceneBaseWidth = 1280;
  protected readonly sceneBaseHeight = 720;

  private dragState: DragState | null = null;
  private dragHistorySnapshot: CasoEditorEscenario['layout'] | null = null;
  private pendingAiInsertedElementId: string | null = null;
  private fitSceneTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private scenarioHistory = new Map<string, ScenarioHistoryState>();
  private readonly historyRevision = signal(0);
  private readonly onPointerMoveBound = (event: PointerEvent) => this.onPointerMove(event);
  private readonly onPointerUpBound = () => this.stopDragging();
  private readonly onWindowResizeBound = () => this.handleWindowResize();
  private readonly onWindowKeyDownBound = (event: KeyboardEvent) =>
    this.handleWindowKeyDown(event);
  @ViewChild('sceneViewport') private sceneViewport?: ElementRef<HTMLElement>;

  protected readonly libraryCategories = [
    { id: 'backgrounds', label: 'Fondos' },
    { id: 'characters', label: 'Personajes' },
    { id: 'texts', label: 'Textos' },
    { id: 'objects', label: 'Objetos' },
    { id: 'questions', label: 'Preguntas' },
    { id: 'audio', label: 'Audio' },
  ] as const;

  protected readonly propertySections = [
    { id: 'general', label: 'General' },
    { id: 'appearance', label: 'Apariencia' },
    { id: 'layout', label: 'Posición y tamaño' },
    { id: 'content', label: 'Contenido' },
    { id: 'advanced', label: 'Avanzado' },
  ] as const;

  protected readonly aiStyleOptions = [
    {
      id: 'editorial_sereno',
      label: 'Editorial sereno',
      description: 'Ilustración limpia, académica y equilibrada.',
    },
    {
      id: 'acuarela_suave',
      label: 'Acuarela suave',
      description: 'Textura ligera y atmósfera calmada.',
    },
    {
      id: 'minimal_calido',
      label: 'Minimal cálido',
      description: 'Composición simple, profesional y acogedora.',
    },
  ] as const;

  protected readonly aiVisibleTypeOptions = [
    { id: 'background', label: 'Fondo' },
    { id: 'character', label: 'Personaje' },
    { id: 'object', label: 'Objeto' },
    { id: 'symbol', label: 'Símbolo/emoción' },
  ] as const;

  protected readonly docenteAssetTypeOptions = [
    {
      id: 'FONDO',
      label: 'Como fondo de escena',
      description: 'Queda detrás de todos los elementos de la escena.',
    },
    {
      id: 'PERSONAJE',
      label: 'Como personaje',
      description: 'Se inserta como figura principal en primer plano.',
    },
    {
      id: 'OBJETO',
      label: 'Como objeto de escena',
      description: 'Se agrega como elemento visual manipulable.',
    },
    {
      id: 'PISTA',
      label: 'Como pista visual',
      description: 'Representa una señal, evidencia o clave narrativa.',
    },
    {
      id: 'DECORACION',
      label: 'Como decoración',
      description: 'Acompaña la escena sin afectar la narrativa principal.',
    },
  ] as const;

  protected readonly escenarios = computed(() => this.editor()?.escenarios ?? []);

  protected readonly escenarioSeleccionado = computed(() => {
    const escenarios = this.escenarios();
    const selectedId = this.selectedEscenarioId();

    if (!selectedId) {
      return escenarios[0] ?? null;
    }

    return escenarios.find((item) => item.id === selectedId) ?? escenarios[0] ?? null;
  });

  protected readonly selectedElement = computed(() => {
    const escenario = this.escenarioSeleccionado();
    const elementId = this.selectedElementId();

    if (!escenario || !elementId) {
      return null;
    }

    return escenario.layout.elements.find((item) => item.id === elementId) ?? null;
  });

  protected readonly orderedElements = computed(() =>
    [...(this.escenarioSeleccionado()?.layout.elements ?? [])].sort(
      (a, b) => a.zIndex - b.zIndex,
    ),
  );

  protected readonly layersDescending = computed(() =>
    [...this.orderedElements()].reverse(),
  );

  protected readonly validationErrors = computed(() => this.editor()?.validationErrors ?? []);
  protected readonly deleteScenarioTarget = computed(() => {
    const scenarioId = this.deleteScenarioDialogId();
    if (!scenarioId) {
      return null;
    }

    return this.escenarios().find((item) => item.id === scenarioId) ?? null;
  });
  protected readonly latestAiAsset = computed(() => {
    const selectedId = this.selectedAiAssetId();
    const assets = this.aiAssets();

    if (selectedId) {
      return assets.find((item) => item.id === selectedId) ?? assets[0] ?? null;
    }

    return assets[0] ?? null;
  });

  protected readonly selectedElementIsBackground = computed(
    () => this.selectedElement()?.type === 'background',
  );

  protected readonly allLibraryItems = computed((): BibliotecaItem[] => [
    {
      id: 'ambientes-consultorio',
      nombre: 'Consultorio',
      tipo: 'background',
      categoria: 'Fondo',
      categoriaClave: 'backgrounds',
      icono: '▦',
      descripcion: 'Ambiente sereno para entrevista y escucha activa.',
      tag: 'Base',
      content: { backgroundCode: 'oficina_psicologica' },
    },
    {
      id: 'ambientes-aula',
      nombre: 'Aula',
      tipo: 'background',
      categoria: 'Fondo',
      categoriaClave: 'backgrounds',
      icono: '▥',
      descripcion: 'Contexto escolar para convivencia y observación.',
      tag: 'Escena',
      content: { backgroundCode: 'aula' },
    },
    {
      id: 'personaje-paciente',
      nombre: 'Paciente',
      tipo: 'character',
      categoria: 'Personaje',
      categoriaClave: 'characters',
      icono: '◔',
      descripcion: 'Personaje editable para el caso clínico.',
      tag: 'Editable',
      content: {
        nombre: 'Paciente',
        rol: 'Paciente',
        avatar: 'patient-default',
        expresion: 'Pensativo',
        estadoEmocional: 'Ansiedad moderada',
        dialogo: 'Necesito ayuda para entender lo que estoy sintiendo.',
      },
      size: { width: 170, height: 240 },
    },
    {
      id: 'personaje-psicologo',
      nombre: 'Psicólogo',
      tipo: 'character',
      categoria: 'Personaje',
      categoriaClave: 'characters',
      icono: '◕',
      descripcion: 'Profesional que conduce la intervención.',
      tag: 'Guía',
      content: {
        nombre: 'Profesional',
        rol: 'Psicólogo',
        avatar: 'therapist-default',
        expresion: 'Empática',
        estadoEmocional: 'Regulación',
        dialogo: 'Explora con cuidado la situación antes de decidir.',
      },
      size: { width: 180, height: 250 },
    },
    {
      id: 'texto-dialogo',
      nombre: 'Diálogo',
      tipo: 'text',
      categoria: 'Texto',
      categoriaClave: 'texts',
      icono: 'T',
      descripcion: 'Texto libre para notas, pensamientos o pistas.',
      tag: 'Rápido',
      content: { texto: 'Escribe aquí un diálogo o una nota de escena.' },
      size: { width: 240, height: 90 },
    },
    {
      id: 'texto-instruccion',
      nombre: 'Instrucción',
      tipo: 'instruction',
      categoria: 'Texto',
      categoriaClave: 'texts',
      icono: 'i',
      descripcion: 'Guía breve para el estudiante dentro del escenario.',
      tag: 'Pedagógico',
      content: { texto: 'Analiza la situación antes de responder.' },
      size: { width: 260, height: 90 },
    },
    {
      id: 'objeto-nota',
      nombre: 'Nota clínica',
      tipo: 'object',
      categoria: 'Objeto',
      categoriaClave: 'objects',
      icono: '□',
      descripcion: 'Elemento de apoyo visual dentro del espacio.',
      tag: 'Apoyo',
      content: { nombre: 'Nota clinica', assetCodigo: 'nota-clinica' },
      size: { width: 150, height: 90 },
    },
    {
      id: 'audio-ambiente',
      nombre: 'Audio',
      tipo: 'audio',
      categoria: 'Audio',
      categoriaClave: 'audio',
      icono: '♪',
      descripcion: 'Referencia sonora de la escena.',
      tag: 'Audio',
      content: { nombre: 'Audio ambiental', assetCodigo: 'audio-ambiental' },
      size: { width: 150, height: 70 },
    },
    {
      id: 'pregunta-bloque',
      nombre: 'Pregunta',
      tipo: 'question',
      categoria: 'Pregunta',
      categoriaClave: 'questions',
      icono: '?',
      descripcion: 'Bloque visible que representa la pregunta del escenario.',
      tag: 'Clave',
      content: { enunciado: 'Formula aquí la decisión principal del escenario.' },
      size: { width: 320, height: 120 },
    },
    {
      id: 'feedback-bloque',
      nombre: 'Feedback',
      tipo: 'feedback',
      categoria: 'Pregunta',
      categoriaClave: 'questions',
      icono: '!',
      descripcion: 'Tarjeta para reforzar el aprendizaje.',
      tag: 'Refuerzo',
      content: { mensaje: 'El feedback aparece según la opción elegida.' },
      size: { width: 280, height: 110 },
    },
  ]);

  protected readonly curatedLibraryItems = computed((): BibliotecaItem[] => [
    {
      id: 'ambientes-consultorio',
      nombre: 'Consultorio',
      tipo: 'background',
      categoria: 'Fondo',
      categoriaClave: 'backgrounds',
      icono: 'C',
      descripcion: 'Escena profesional y serena para entrevistas clinicas.',
      tag: 'Sereno',
      content: { backgroundCode: 'oficina_psicologica' },
    },
    {
      id: 'ambientes-aula',
      nombre: 'Aula',
      tipo: 'background',
      categoria: 'Fondo',
      categoriaClave: 'backgrounds',
      icono: 'A',
      descripcion: 'Contexto pedagogico para convivencia, observacion y apoyo.',
      tag: 'Academico',
      content: { backgroundCode: 'aula' },
    },
    {
      id: 'personaje-estudiante',
      nombre: 'Estudiante',
      tipo: 'character',
      categoria: 'Personaje',
      categoriaClave: 'characters',
      icono: 'E',
      descripcion: 'Personaje central del caso con tono vulnerable y cercano.',
      tag: 'Caso',
      content: {
        nombre: 'Valeria',
        rol: 'Estudiante',
        avatar: 'student-support',
        expresion: 'Reservada',
        estadoEmocional: 'Ansiedad social',
        dialogo: 'No se como explicar lo que me pasa cuando entro al aula.',
      },
      style: {
        avatarGradient: 'linear-gradient(180deg, #ffd7ba 0%, #e99e75 100%)',
        accentColor: '#bf6d45',
        bubbleColor: 'rgba(255,255,255,0.94)',
      },
      size: { width: 196, height: 268 },
    },
    {
      id: 'personaje-psicologo',
      nombre: 'Docente orientador',
      tipo: 'character',
      categoria: 'Personaje',
      categoriaClave: 'characters',
      icono: 'D',
      descripcion: 'Figura de acompanamiento que estructura la intervencion.',
      tag: 'Guia',
      content: {
        nombre: 'Laura',
        rol: 'Orientadora',
        avatar: 'mentor-guide',
        expresion: 'Serena',
        estadoEmocional: 'Regulacion',
        dialogo: 'Vamos a leer la situacion con calma antes de intervenir.',
      },
      style: {
        avatarGradient: 'linear-gradient(180deg, #d9efc2 0%, #74a95b 100%)',
        accentColor: '#4f7d3d',
        bubbleColor: 'rgba(246,251,242,0.96)',
      },
      size: { width: 196, height: 268 },
    },
    {
      id: 'personaje-familiar',
      nombre: 'Familiar',
      tipo: 'character',
      categoria: 'Personaje',
      categoriaClave: 'characters',
      icono: 'F',
      descripcion: 'Actor del entorno cercano para tension o apoyo contextual.',
      tag: 'Entorno',
      content: {
        nombre: 'Acudiente',
        rol: 'Familiar',
        avatar: 'family-context',
        expresion: 'Preocupada',
        estadoEmocional: 'Tension contenida',
        dialogo: 'En casa tambien hemos notado cambios estas semanas.',
      },
      style: {
        avatarGradient: 'linear-gradient(180deg, #ffe2b8 0%, #d79d4e 100%)',
        accentColor: '#b0711b',
        bubbleColor: 'rgba(255,249,239,0.96)',
      },
      size: { width: 188, height: 256 },
    },
    {
      id: 'texto-dialogo',
      nombre: 'Globo narrativo',
      tipo: 'text',
      categoria: 'Texto',
      categoriaClave: 'texts',
      icono: 'T',
      descripcion: 'Texto breve para clima emocional, pensamiento o voz interna.',
      tag: 'Narrativa',
      content: {
        nombre: 'Clima del momento',
        texto: 'El silencio en el espacio hace visible la incomodidad de la escena.',
      },
      style: {
        backgroundColor: 'rgba(255,255,255,0.93)',
        borderColor: 'rgba(123,161,97,0.28)',
        accentColor: '#6f9358',
        textColor: '#24412d',
      },
      size: { width: 290, height: 96 },
    },
    {
      id: 'texto-instruccion',
      nombre: 'Guia pedagogica',
      tipo: 'instruction',
      categoria: 'Texto',
      categoriaClave: 'texts',
      icono: 'G',
      descripcion: 'Marco corto para orientar observacion, escucha o decision.',
      tag: 'Pedagogico',
      content: {
        nombre: 'Foco de observacion',
        texto: 'Identifica senales emocionales, lenguaje no verbal y factores del contexto.',
      },
      style: {
        backgroundColor: 'rgba(237,247,255,0.96)',
        borderColor: 'rgba(90,145,194,0.26)',
        accentColor: '#4f7fa8',
        textColor: '#21405a',
      },
      size: { width: 308, height: 108 },
    },
    {
      id: 'objeto-nota',
      nombre: 'Ficha de caso',
      tipo: 'object',
      categoria: 'Objeto',
      categoriaClave: 'objects',
      icono: 'R',
      descripcion: 'Tarjeta visual para antecedentes, factores o hallazgos.',
      tag: 'Apoyo',
      content: {
        nombre: 'Registro breve',
        texto: 'Antecedente relevante: evita la participacion oral frente al grupo.',
      },
      style: {
        backgroundColor: 'rgba(255,250,240,0.95)',
        borderColor: 'rgba(205,162,91,0.24)',
        accentColor: '#b07a2f',
        textColor: '#59411d',
      },
      size: { width: 248, height: 104 },
    },
    {
      id: 'audio-ambiente',
      nombre: 'Ambiente sonoro',
      tipo: 'audio',
      categoria: 'Audio',
      categoriaClave: 'audio',
      icono: 'S',
      descripcion: 'Indicador de sonido, murmullo o tension del entorno.',
      tag: 'Audio',
      content: {
        nombre: 'Murmullo del aula',
        texto: 'Se percibe ruido leve y varias miradas dirigidas hacia la estudiante.',
      },
      style: {
        backgroundColor: 'rgba(246,240,255,0.95)',
        borderColor: 'rgba(141,118,191,0.24)',
        accentColor: '#7c63a8',
        textColor: '#45345f',
      },
      size: { width: 250, height: 92 },
    },
    {
      id: 'pregunta-bloque',
      nombre: 'Decision principal',
      tipo: 'question',
      categoria: 'Pregunta',
      categoriaClave: 'questions',
      icono: 'P',
      descripcion: 'Tarjeta central para la intervencion o decision del estudiante.',
      tag: 'Clave',
      content: {
        enunciado: 'Que accion inicial favorece un abordaje seguro y empatico?',
        apoyo: 'Selecciona la respuesta que mejor cuide el contexto y la relacion de ayuda.',
      },
      style: {
        backgroundColor: 'rgba(255,255,255,0.97)',
        borderColor: 'rgba(86,140,98,0.22)',
        accentColor: '#4f7d57',
        textColor: '#1f3d2e',
      },
      size: { width: 364, height: 158 },
    },
    {
      id: 'feedback-bloque',
      nombre: 'Retroalimentacion',
      tipo: 'feedback',
      categoria: 'Pregunta',
      categoriaClave: 'questions',
      icono: 'F',
      descripcion: 'Refuerzo visual para el por que de una decision.',
      tag: 'Refuerzo',
      content: {
        nombre: 'Clave de aprendizaje',
        mensaje: 'La respuesta mas util valida la experiencia antes de explorar soluciones.',
      },
      style: {
        backgroundColor: 'rgba(241,249,242,0.96)',
        borderColor: 'rgba(103,165,110,0.24)',
        accentColor: '#5b8f62',
        textColor: '#27462d',
      },
      size: { width: 296, height: 120 },
    },
  ]);

  protected readonly library = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const category = this.selectedLibraryCategory();

    return this.curatedLibraryItems().filter((item) => {
      const matchesCategory = item.categoriaClave === category;
      const matchesTerm = term
        ? [item.nombre, item.categoria, item.descripcion, item.tag]
            .join(' ')
            .toLowerCase()
            .includes(term)
        : true;

      return matchesCategory && matchesTerm;
    });
  });

  protected readonly selectedLibraryItem = computed(
    () => this.library().find((item) => item.id === this.selectedLibraryItemId()) ?? this.library()[0] ?? null,
  );

  protected readonly saveStatusLabel = computed(() => {
    if (this.saving()) {
      return 'Guardando...';
    }

    const escenario = this.escenarioSeleccionado();
    if (escenario && this.hasUnsavedChanges(escenario.id)) {
      return 'Cambios sin guardar';
    }

    return 'Guardado';
  });

  protected readonly saveStatusVariant = computed<SiepStatusBadge>(() => {
    if (this.saving()) {
      return 'pending';
    }

    const escenario = this.escenarioSeleccionado();
    return escenario && this.hasUnsavedChanges(escenario.id) ? 'warning' : 'success';
  });

  protected readonly selectedDecisionOption = computed(() => {
    const pregunta = this.escenarioSeleccionado()?.pregunta;
    const optionId = this.selectedDecisionOptionId();

    if (!pregunta || !optionId) {
      return null;
    }

    return pregunta.opciones.find((item) => item.id === optionId) ?? null;
  });

  protected readonly previewSelectedOption = computed(() => {
    const pregunta = this.escenarioSeleccionado()?.pregunta;
    const optionId = this.previewSelectedOptionId();

    if (!pregunta || !optionId) {
      return null;
    }

    return pregunta.opciones.find((item) => item.id === optionId) ?? null;
  });

  protected readonly flowWarnings = computed(() => {
    const escenarios = this.escenarios();
    const warnings: string[] = [];

    escenarios
      .filter((escenario) => this.isScenarioDisconnected(escenario))
      .forEach((escenario) => warnings.push(`E${escenario.orden} no tiene conexiones claras.`));

    const implicitOnly = this.editor()?.conexiones.filter((item) => item.tipo === 'orden').length ?? 0;
    if (implicitOnly > 0) {
      warnings.push(`${implicitOnly} opciones usan la ruta por orden como destino.`);
    }

    return warnings;
  });

  protected readonly zoomPercentLabel = computed(() => `${Math.round(this.zoomLevel() * 100)}%`);
  protected readonly canUndoScene = computed(() => {
    this.historyRevision();
    const scenarioId = this.selectedEscenarioId();
    return scenarioId ? (this.scenarioHistory.get(scenarioId)?.past.length ?? 0) > 0 : false;
  });
  protected readonly canRedoScene = computed(() => {
    this.historyRevision();
    const scenarioId = this.selectedEscenarioId();
    return scenarioId ? (this.scenarioHistory.get(scenarioId)?.future.length ?? 0) > 0 : false;
  });

  protected readonly currentDocenteTypeDescription = computed((): string => {
    switch (this.docenteAssetType()) {
      case 'FONDO':
        return 'Queda detrás de todos los elementos de la escena.';
      case 'PERSONAJE':
        return 'Se inserta como figura principal en primer plano.';
      case 'OBJETO':
        return 'Se agrega como elemento visual manipulable.';
      case 'PISTA':
        return 'Representa una señal, evidencia o clave narrativa.';
      case 'DECORACION':
        return 'Acompaña la escena sin afectar la narrativa principal.';
      default:
        return '';
    }
  });

  ngOnInit(): void {
    this.casoId = this.route.snapshot.paramMap.get('casoId') ?? '';

    if (!this.casoId) {
      this.errorMessage.set('No se encontro el identificador del caso.');
      this.loading.set(false);
      return;
    }

    this.loadEditor();
  }

  ngOnDestroy(): void {
    this.stopDragging();
    window.removeEventListener('resize', this.onWindowResizeBound);
    window.removeEventListener('keydown', this.onWindowKeyDownBound);
    if (this.fitSceneTimeoutId) {
      clearTimeout(this.fitSceneTimeoutId);
    }
  }

  ngAfterViewInit(): void {
    window.addEventListener('resize', this.onWindowResizeBound);
    window.addEventListener('keydown', this.onWindowKeyDownBound);
    this.scheduleFitSceneToViewport();
  }

  loadEditor(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.simulacionService.obtenerEditorCaso(this.casoId).subscribe({
      next: (editor) => {
        this.initializeScenarioHistory(editor.escenarios);
        this.editor.set(editor);
        this.dirtyScenarioIds.set([]);
        const currentScenario = this.selectedEscenarioId()
          ? editor.escenarios.find((item) => item.id === this.selectedEscenarioId())
          : editor.escenarios[0];
        this.selectedEscenarioId.set(currentScenario?.id ?? null);
        const pendingElementId = this.pendingAiInsertedElementId;
        const insertedElement = pendingElementId
          ? currentScenario?.layout.elements.find((item) => item.id === pendingElementId)
          : null;
        const preferredElement =
          insertedElement ?? this.getPreferredSelectedElement(currentScenario ?? null);
        this.selectedElementId.set(preferredElement?.id ?? null);
        this.pendingAiInsertedElementId = null;
        this.ensureLibrarySelection();
        this.syncQuestionDraft();
        this.syncDecisionSelection();
        this.resetStudentPreview();
        this.loadAiAssets();
        this.loadDocenteAssets();
        this.loading.set(false);
        this.scheduleFitSceneToViewport();
      },
      error: (error) => {
        this.errorMessage.set(getErrorMessage(error, 'No fue posible cargar el editor del caso.'));
        this.loading.set(false);
      },
    });
  }

  setWorkspace(workspace: EditorWorkspace): void {
    this.workspace.set(workspace);
    if (workspace === 'student') {
      this.resetStudentPreview();
    }
    if (workspace === 'scene') {
      this.scheduleFitSceneToViewport();
    }
  }

  selectEscenario(escenarioId: string): void {
    this.selectedEscenarioId.set(escenarioId);
    const firstElement = this.getPreferredSelectedElement(
      this.escenarios().find((item) => item.id === escenarioId) ?? null,
    );
    this.selectedElementId.set(firstElement?.id ?? null);
    this.syncQuestionDraft();
    this.syncDecisionSelection();
    this.resetStudentPreview();
    this.scheduleFitSceneToViewport();
  }

  updateAiDescription(value: string): void {
    this.aiDescription.set(value);
  }

  updateAiStyle(value: AiAssetStyle): void {
    this.aiStyle.set(value);
  }

  updateAiVisibleType(value: AiAssetVisibleType): void {
    this.aiVisibleType.set(value);
  }

  selectAiAsset(assetId: string): void {
    this.selectedAiAssetId.set(assetId);
  }

  selectElement(elementId: string): void {
    this.selectedElementId.set(elementId);
    this.openPropertySection.set('general');
  }

  selectScenarioBackground(): void {
    const escenario = this.escenarioSeleccionado();
    if (!escenario) {
      return;
    }

    const background = this.ensureScenarioBackground(escenario);
    this.selectedElementId.set(background.id);
    this.openPropertySection.set('general');
  }

  clearSelectedElement(): void {
    this.selectedElementId.set(null);
  }

  updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
    this.ensureLibrarySelection();
  }

  setLibraryCategory(category: LibraryCategory): void {
    this.selectedLibraryCategory.set(category);
    this.ensureLibrarySelection();
  }

  selectLibraryItem(itemId: string): void {
    this.selectedLibraryItemId.set(itemId);
  }

  openSection(section: PropertySection): void {
    this.openPropertySection.set(this.openPropertySection() === section ? section : section);
  }

  isSectionOpen(section: PropertySection): boolean {
    return this.openPropertySection() === section;
  }

  updateQuestionDraft(value: string): void {
    this.questionDraft.set(value);
  }

  updateQuestionScoreDraft(value: string): void {
    this.questionScoreDraft.set(Number(value) || 0);
  }

  updateNewOptionText(value: string): void {
    this.newOptionText.set(value);
  }

  updateNewOptionScore(value: string): void {
    this.newOptionScore.set(Number(value) || 0);
  }

  updateNewOptionCorrect(value: boolean): void {
    this.newOptionCorrect.set(value);
  }

  updateNewOptionDestino(value: string): void {
    this.newOptionDestino.set(value);
  }

  selectDecisionOption(optionId: string): void {
    this.selectedDecisionOptionId.set(optionId);
    this.syncFeedbackDraft();
  }

  updateFeedbackDraft(value: string): void {
    this.feedbackDraft.set(value);
  }

  updateFeedbackTypeDraft(value: 'pedagogica' | 'correctiva' | 'refuerzo'): void {
    this.feedbackTypeDraft.set(value);
  }

  updateFeedbackReferenceDraft(value: string): void {
    this.feedbackReferenceDraft.set(value);
  }

  choosePreviewOption(optionId: string): void {
    this.previewSelectedOptionId.set(optionId);
  }

  resetStudentPreview(): void {
    this.previewSelectedOptionId.set(null);
  }

  toggleResourcesPanel(): void {
    this.resourcesPanelOpen.update((value) => !value);
    if (this.resourcesPanelOpen()) {
      this.propertiesPanelOpen.set(false);
    }
    this.scheduleFitSceneToViewport();
  }

  openResourcesPanel(): void {
    this.resourcesPanelOpen.set(true);
    this.propertiesPanelOpen.set(false);
    this.scheduleFitSceneToViewport();
  }

  closeResourcesPanel(): void {
    this.resourcesPanelOpen.set(false);
    this.scheduleFitSceneToViewport();
  }

  togglePropertiesPanel(): void {
    this.propertiesPanelOpen.update((value) => !value);
    if (this.propertiesPanelOpen()) {
      this.resourcesPanelOpen.set(false);
    }
    this.scheduleFitSceneToViewport();
  }

  openPropertiesPanel(): void {
    this.propertiesPanelOpen.set(true);
    this.resourcesPanelOpen.set(false);
    this.scheduleFitSceneToViewport();
  }

  closePropertiesPanel(): void {
    this.propertiesPanelOpen.set(false);
    this.scheduleFitSceneToViewport();
  }

  closeAllPanels(): void {
    this.resourcesPanelOpen.set(false);
    this.propertiesPanelOpen.set(false);
    this.scheduleFitSceneToViewport();
  }

  fitSceneToViewport(): void {
    const viewport = this.sceneViewport?.nativeElement;
    if (!viewport) {
      return;
    }

    const padding = 48;
    const availableWidth = Math.max(viewport.clientWidth - padding, 200);
    const availableHeight = Math.max(viewport.clientHeight - padding, 200);
    const widthScale = availableWidth / this.sceneBaseWidth;
    const heightScale = availableHeight / this.sceneBaseHeight;

    this.zoomLevel.set(this.clamp(Math.min(widthScale, heightScale), 0.5, 2));
    this.centerViewport();
  }

  zoomIn(): void {
    this.setZoomLevel(this.zoomLevel() + 0.1);
  }

  zoomOut(): void {
    this.setZoomLevel(this.zoomLevel() - 0.1);
  }

  resetZoom(): void {
    this.setZoomLevel(1);
  }

  undoSceneChange(): void {
    const scenarioId = this.selectedEscenarioId();
    if (!scenarioId) {
      return;
    }

    const history = this.scenarioHistory.get(scenarioId);
    const currentScenario = this.escenarioSeleccionado();
    const previousLayout = history?.past.at(-1);

    if (!history || !currentScenario || !previousLayout) {
      return;
    }

    const currentLayout = structuredClone(currentScenario.layout);
    history.past = history.past.slice(0, -1);
    history.future = [currentLayout, ...history.future];
    this.bumpHistoryRevision();

    this.applyScenarioLayout(scenarioId, previousLayout);
  }

  redoSceneChange(): void {
    const scenarioId = this.selectedEscenarioId();
    if (!scenarioId) {
      return;
    }

    const history = this.scenarioHistory.get(scenarioId);
    const currentScenario = this.escenarioSeleccionado();
    const nextLayout = history?.future[0];

    if (!history || !currentScenario || !nextLayout) {
      return;
    }

    const currentLayout = structuredClone(currentScenario.layout);
    history.past = [...history.past, currentLayout];
    history.future = history.future.slice(1);
    this.bumpHistoryRevision();

    this.applyScenarioLayout(scenarioId, nextLayout);
  }

  saveCurrentLayout(): void {
    const escenario = this.escenarioSeleccionado();

    if (!escenario) {
      return;
    }

    this.saving.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.simulacionService
      .actualizarLayoutEscenario(escenario.id, {
        version: escenario.layout.version,
        elements: escenario.layout.elements,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set('Cambios del escenario guardados.');
          this.dirtyScenarioIds.set(this.dirtyScenarioIds().filter((item) => item !== escenario.id));
          this.loadEditor();
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(getErrorMessage(error, 'No fue posible guardar el layout del escenario.'));
        },
      });
  }

  duplicateCurrentScenario(): void {
    const escenario = this.escenarioSeleccionado();
    if (!escenario) {
      return;
    }

    this.duplicating.set(true);
    this.simulacionService.duplicarEscenario(escenario.id).subscribe({
      next: () => {
        this.duplicating.set(false);
        this.loadEditor();
      },
      error: (error) => {
        this.duplicating.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible duplicar el escenario.'));
      },
    });
  }

  canDeleteScenario(escenario: CasoEditorEscenario | null = this.escenarioSeleccionado()): boolean {
    return this.deleteScenarioBlockedReason(escenario) === null;
  }

  deleteScenarioBlockedReason(
    escenario: CasoEditorEscenario | null = this.escenarioSeleccionado(),
  ): string | null {
    const editor = this.editor();
    if (!editor || !escenario) {
      return 'Selecciona una escena para continuar.';
    }

    if (editor.estado === 'published') {
      return 'No puedes eliminar escenas de un caso publicado. Crea una nueva versión o despublica el caso si el sistema lo permite.';
    }

    if (editor.estado === 'archived') {
      return 'No puedes eliminar escenas de un caso archivado.';
    }

    if (this.escenarios().length <= 1) {
      return 'El caso debe conservar al menos una escena.';
    }

    return null;
  }

  openDeleteScenarioDialog(escenarioId: string, event?: Event): void {
    event?.stopPropagation();
    const escenario = this.escenarios().find((item) => item.id === escenarioId) ?? null;
    if (!this.canDeleteScenario(escenario)) {
      return;
    }

    this.deleteScenarioDialogId.set(escenarioId);
  }

  closeDeleteScenarioDialog(): void {
    this.deleteScenarioDialogId.set(null);
  }

  confirmDeleteScenario(): void {
    const target = this.deleteScenarioTarget();
    if (!target || !this.canDeleteScenario(target)) {
      return;
    }

    const currentSelectedId = this.selectedEscenarioId();
    const nextScenarioId =
      currentSelectedId === target.id
        ? this.resolveFallbackScenarioId(target.id)
        : currentSelectedId;
    this.deletingScenario.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.simulacionService.eliminarEscenario(this.casoId, target.id).subscribe({
      next: () => {
        this.deletingScenario.set(false);
        this.deleteScenarioDialogId.set(null);
        this.selectedEscenarioId.set(nextScenarioId);
        this.selectedElementId.set(null);
        this.successMessage.set('Escena eliminada correctamente.');
        this.loadEditor();
      },
      error: (error) => {
        this.deletingScenario.set(false);
        this.errorMessage.set(
          getErrorMessage(error, 'No fue posible eliminar la escena seleccionada.'),
        );
      },
    });
  }

  createScenario(): void {
    const editor = this.editor();
    if (!editor) {
      return;
    }

    const nextOrder = Math.max(...editor.escenarios.map((item) => item.orden), 0) + 1;
    this.saving.set(true);
    this.simulacionService
      .crearEscenario(editor.id, {
        orden: nextOrder,
        titulo: `Escenario ${nextOrder}`,
        situacionTexto: 'Describe aquí el momento narrativo, el contexto y la tensión pedagógica.',
        fondoCodigo: editor.catalogos.backgrounds[0] ?? 'oficina_psicologica',
        isFinal: false,
      })
      .subscribe({
        next: (escenario) => {
          this.selectedEscenarioId.set(escenario.id);
          this.seedScenarioWithStarterElements(escenario);
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(getErrorMessage(error, 'No fue posible crear el escenario.'));
        },
      });
  }

  private seedScenarioWithStarterElements(
    escenario: Pick<CasoEditorEscenario, 'id' | 'titulo' | 'situacionTexto' | 'fondoCodigo'>,
  ): void {
    const starterLayout = this.buildStarterSceneLayout(escenario);

    this.simulacionService
      .actualizarLayoutEscenario(escenario.id, starterLayout)
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.successMessage.set('Escena inicial creada con elementos base editables.');
          this.loadEditor();
        },
        error: () => {
          this.saving.set(false);
          this.successMessage.set('Escena creada. El layout inicial no pudo preconfigurarse.');
          this.loadEditor();
        },
      });
  }

  addSelectedLibraryItem(): void {
    const scenario = this.escenarioSeleccionado();
    const libraryItem = this.selectedLibraryItem();

    if (!scenario || !libraryItem) {
      return;
    }

    if (libraryItem.tipo === 'background') {
      this.patchScenario((escenario) => {
        const background = this.ensureScenarioBackground(escenario);
        background.content = {
          ...background.content,
          backgroundCode: libraryItem.content['backgroundCode'] ?? scenario.fondoCodigo,
          aiAssetId: null,
          imageUrl: null,
        };
        background.style = {
          ...background.style,
          backgroundCode: String(libraryItem.content['backgroundCode'] ?? scenario.fondoCodigo),
          aiAssetId: null,
          imageUrl: null,
        };
        escenario.fondoCodigo = String(libraryItem.content['backgroundCode'] ?? scenario.fondoCodigo);
        escenario.aiBackgroundAssetId = null;
        escenario.aiBackgroundUrl = null;
      });
      return;
    }

    const nextZ = Math.max(...scenario.layout.elements.map((item) => item.zIndex), 0) + 1;
    const newElement: EditorElement = {
      id: crypto.randomUUID(),
      type: libraryItem.tipo,
      position: { x: 50, y: 50 },
      size: libraryItem.size ?? { width: 200, height: 110 },
      rotation: 0,
      zIndex: nextZ,
      locked: false,
      hidden: false,
      style: libraryItem.style ?? {},
      content: { ...libraryItem.content },
      bindings: {},
    };

    this.patchScenario((escenario) => {
      escenario.layout.elements.push(newElement);
    });
    this.selectedElementId.set(newElement.id);
  }

  generateAiAsset(): void {
    const escenario = this.escenarioSeleccionado();
    const descripcion = this.aiDescription().trim();
    const visibleType = this.aiVisibleType();

    if (!escenario) {
      return;
    }

    if (descripcion.length < 12) {
      this.aiErrorMessage.set('Describe el recurso con al menos 12 caracteres.');
      return;
    }

    this.aiGenerating.set(true);
    this.aiErrorMessage.set(null);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.simulacionService
      .generarAiAsset({
        casoId: this.casoId,
        escenarioId: escenario.id,
        tipo: this.backendAiType(visibleType),
        visibleType,
        descripcion,
        estilo: this.aiStyle(),
      })
      .subscribe({
        next: (asset) => {
          this.aiGenerating.set(false);
          this.aiDescription.set('');
          this.aiAssets.set([asset, ...this.aiAssets().filter((item) => item.id !== asset.id)]);
          this.selectedAiAssetId.set(asset.id);
          this.successMessage.set(
            visibleType === 'background'
              ? 'Fondo IA generado. Ya puedes usarlo en la escena.'
              : 'Recurso IA generado. Ya puedes insertarlo en la escena.',
          );
        },
        error: (error) => {
          this.aiGenerating.set(false);
          this.aiErrorMessage.set(
            getErrorMessage(error, 'No fue posible generar el recurso con IA.'),
          );
        },
      });
  }

  applyLatestAiAsset(): void {
    const escenario = this.escenarioSeleccionado();
    const asset = this.latestAiAsset();

    if (!escenario || !asset) {
      return;
    }

    this.aiApplying.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const visibleType = this.assetVisibleType(asset);
    this.simulacionService
      .insertarAiAssetEnEscenario(asset.id, escenario.id, visibleType)
      .subscribe({
        next: (appliedAsset) => {
          this.aiApplying.set(false);
          this.aiAssets.set(
            this.aiAssets().map((item) => (item.id === appliedAsset.id ? appliedAsset : item)),
          );
          this.selectedAiAssetId.set(appliedAsset.id);

          if (visibleType === 'background') {
            this.patchScenario((item) => {
              item.aiBackgroundAssetId = appliedAsset.id;
              item.aiBackgroundUrl = appliedAsset.publicUrl;
              const background = this.ensureScenarioBackground(item);
              background.style = {
                ...background.style,
                aiAssetId: appliedAsset.id,
                imageUrl: appliedAsset.publicUrl,
              };
              background.content = {
                ...background.content,
                aiAssetId: appliedAsset.id,
                imageUrl: appliedAsset.publicUrl,
              };
            });
            this.successMessage.set('Fondo IA aplicado al escenario actual.');
            return;
          }

          this.successMessage.set('Recurso IA insertado en la escena.');
          this.pendingAiInsertedElementId = appliedAsset.insertedElementId ?? null;
          this.loadEditor();
        },
        error: (error) => {
          this.aiApplying.set(false);
          this.aiErrorMessage.set(
            getErrorMessage(error, 'No fue posible insertar el recurso IA en la escena.'),
          );
        },
      });
  }

  startDrag(event: PointerEvent, elementId: string): void {
    const element = this.selectedScenarioElement(elementId);
    const escenario = this.escenarioSeleccionado();
    if (!element || element.locked) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.selectedElementId.set(elementId);
    this.dragHistorySnapshot = escenario ? structuredClone(escenario.layout) : null;
    this.dragState = {
      elementId,
      startX: event.clientX,
      startY: event.clientY,
      originX: element.position.x,
      originY: element.position.y,
    };

    window.addEventListener('pointermove', this.onPointerMoveBound);
    window.addEventListener('pointerup', this.onPointerUpBound);
  }

  stopDragging(): void {
    if (this.dragState && this.dragHistorySnapshot) {
      const escenario = this.escenarioSeleccionado();
      if (escenario && !this.layoutsEqual(this.dragHistorySnapshot, escenario.layout)) {
        this.pushScenarioHistory(escenario.id, this.dragHistorySnapshot);
        this.updateDirtyState(escenario.id, escenario.layout);
      }
    }

    this.dragState = null;
    this.dragHistorySnapshot = null;
    window.removeEventListener('pointermove', this.onPointerMoveBound);
    window.removeEventListener('pointerup', this.onPointerUpBound);
  }

  updateSelectedSize(axis: 'width' | 'height', value: string): void {
    const element = this.selectedElement();
    if (!element) {
      return;
    }

    const numeric = Number(value) || 1;
    this.updateElement(element.id, (item) => {
      item.size[axis] = this.clamp(numeric, 40, 1200);
    });
  }

  updateSelectedRotation(value: string): void {
    const element = this.selectedElement();
    if (!element) {
      return;
    }

    this.updateElement(element.id, (item) => {
      item.rotation = this.clamp(Number(value) || 0, -180, 180);
    });
  }

  updateSelectedContent(key: string, value: string): void {
    const element = this.selectedElement();
    if (!element) {
      return;
    }

    this.updateElement(element.id, (item) => {
      item.content = {
        ...item.content,
        [key]: value,
      };
    });
  }

  updateSelectedPosition(axis: 'x' | 'y', value: string): void {
    const element = this.selectedElement();
    if (!element) {
      return;
    }

    this.updateElement(element.id, (item) => {
      item.position[axis] = this.clamp(Number(value) || 0, -20, 120);
    });
  }

  toggleSelectedHidden(): void {
    const element = this.selectedElement();
    if (!element) {
      return;
    }

    this.updateElement(element.id, (item) => {
      item.hidden = !item.hidden;
    });
  }

  duplicateSelectedElement(): void {
    const element = this.selectedElement();
    const scenario = this.escenarioSeleccionado();
    if (!element || !scenario) {
      return;
    }

    if (element.type === 'background') {
      this.errorMessage.set('El fondo base del escenario no se puede duplicar.');
      return;
    }

    const duplicated: EditorElement = {
      ...structuredClone(element),
      id: crypto.randomUUID(),
      zIndex: Math.max(...scenario.layout.elements.map((item) => item.zIndex), 0) + 1,
      position: {
        x: element.position.x + 4,
        y: element.position.y + 4,
      },
    };

    this.patchScenario((escenario) => {
      escenario.layout.elements.push(duplicated);
    });
    this.selectedElementId.set(duplicated.id);
  }

  deleteSelectedElement(): void {
    const selectedId = this.selectedElementId();
    const selectedElement = this.selectedElement();
    if (!selectedId || !selectedElement) {
      return;
    }

    if (selectedElement.type === 'background') {
      this.clearSelectedBackground();
      return;
    }

    this.patchScenario((escenario) => {
      escenario.layout.elements = escenario.layout.elements.filter((item) => item.id !== selectedId);
    });
    const preferredElement = this.getPreferredSelectedElement(this.escenarioSeleccionado());
    this.selectedElementId.set(preferredElement?.id ?? null);
  }

  clearSelectedBackground(): void {
    this.patchScenario((escenario) => {
      this.resetScenarioBackground(escenario);
    });
    this.successMessage.set('Fondo del escenario limpiado.');
  }

  bringForward(): void {
    const element = this.selectedElement();
    if (!element) {
      return;
    }

    this.updateElement(element.id, (item) => {
      item.zIndex += 1;
    });
  }

  sendBackward(): void {
    const element = this.selectedElement();
    if (!element) {
      return;
    }

    this.updateElement(element.id, (item) => {
      item.zIndex = Math.max(item.zIndex - 1, 0);
    });
  }

  setLibraryPanelTab(tab: 'sistema' | 'docente' | 'ia' | 'capas'): void {
    this.libraryPanelTab.set(tab);
    this.aiErrorMessage.set(null);
    this.docenteErrorMessage.set(null);
  }

  updateDocenteAssetName(value: string): void {
    this.docenteAssetName.set(value);
  }

  updateDocenteAssetType(value: DocenteAssetType): void {
    this.docenteAssetType.set(value);
  }

  updateDocenteAssetFile(input: Event): void {
    const target = input.target as HTMLInputElement | null;
    const file = target?.files?.[0] ?? null;
    this.docenteAssetFile.set(file);

    if (file && !this.docenteAssetName().trim()) {
      const suggested = file.name
        .replace(/\.[^.]+$/, '')
        .replace(/[-_.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      if (suggested) {
        this.docenteAssetName.set(suggested);
      }
    }
  }

  uploadDocenteAsset(): void {
    const file = this.docenteAssetFile();
    const nombre = this.docenteAssetName().trim();
    const tipo = this.docenteAssetType();

    this.docenteErrorMessage.set(null);
    this.docenteMessage.set(null);

    if (!nombre) {
      this.docenteErrorMessage.set('El nombre del recurso es obligatorio.');
      return;
    }

    if (!file) {
      this.docenteErrorMessage.set('Debes seleccionar una imagen para subir.');
      return;
    }

    const mime = file.type.toLowerCase();
    const allowedMime = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!allowedMime.includes(mime)) {
      this.docenteErrorMessage.set('Formato no permitido. Usa PNG, JPG o WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.docenteErrorMessage.set('El archivo supera el máximo permitido de 5 MB.');
      return;
    }

    this.docenteUploading.set(true);
    this.simulacionService
      .subirDocenteAsset({
        casoId: this.casoId,
        nombre,
        tipo,
        file,
      })
      .subscribe({
        next: (asset) => {
          this.docenteUploading.set(false);
          this.docenteAssets.set([asset, ...this.docenteAssets().filter((item) => item.id !== asset.id)]);
          this.docenteAssetName.set('');
          this.docenteAssetFile.set(null);
          this.docenteMessage.set('Recurso subido correctamente. Ya puedes agregarlo a la escena.');
        },
        error: (error) => {
          this.docenteUploading.set(false);
          this.docenteErrorMessage.set(
            getErrorMessage(error, 'No fue posible subir el recurso del docente.'),
          );
        },
      });
  }

  addDocenteAssetToScene(asset: DocenteAsset): void {
    const escenario = this.escenarioSeleccionado();
    if (!escenario) {
      return;
    }

    if (asset.tipo === 'FONDO') {
      this.patchScenario((item) => {
        item.aiBackgroundAssetId = asset.id;
        item.aiBackgroundUrl = asset.url;
        const background = this.ensureScenarioBackground(item);
        background.style = {
          ...background.style,
          aiAssetId: asset.id,
          imageUrl: asset.url,
        };
        background.content = {
          ...background.content,
          aiAssetId: asset.id,
          imageUrl: asset.url,
          sourceType: 'docente',
        };
      });
      this.docenteMessage.set('Fondo del docente aplicado a la escena.');
      return;
    }

    const nextZ = Math.max(...escenario.layout.elements.map((item) => item.zIndex), 0) + 1;
    const size =
      asset.tipo === 'PERSONAJE'
        ? { width: 240, height: 280 }
        : asset.tipo === 'PISTA'
          ? { width: 150, height: 150 }
          : { width: 180, height: 180 };

    const imageElement: EditorElement = {
      id: crypto.randomUUID(),
      type: 'image',
      position: { x: 52, y: 52 },
      size,
      rotation: 0,
      zIndex: nextZ,
      locked: false,
      hidden: false,
      style: { objectFit: 'contain' },
      content: {
        nombre: asset.nombre,
        imageUrl: asset.url,
        aiAssetId: asset.id,
        aiType: asset.tipo.toLowerCase(),
        sourceType: 'docente',
      },
      bindings: {},
    };

    this.patchScenario((item) => {
      item.layout.elements.push(imageElement);
    });
    this.selectedElementId.set(imageElement.id);
    this.docenteMessage.set('Recurso del docente agregado a la escena.');
  }

  layerLabel(element: EditorElement): string {
    const labels: Partial<Record<EditorElementType, string>> = {
      background: 'Fondo',
      character: 'Personaje',
      text: 'Texto',
      image: 'Imagen IA',
      object: 'Objeto',
      audio: 'Audio',
      question: 'Pregunta',
      instruction: 'Instrucción',
      feedback: 'Retroalimentación',
    };
    const base = labels[element.type] ?? element.type;
    const name = (element.content as Record<string, unknown>)['nombre'] as string | undefined;
    return name ? `${base} · ${name}` : base;
  }

  bringForwardById(elementId: string): void {
    this.updateElement(elementId, (item) => {
      item.zIndex += 1;
    });
    this.selectElement(elementId);
  }

  sendBackwardById(elementId: string): void {
    this.updateElement(elementId, (item) => {
      item.zIndex = Math.max(item.zIndex - 1, 0);
    });
    this.selectElement(elementId);
  }

  saveQuestion(): void {
    const escenario = this.escenarioSeleccionado();
    if (!escenario) {
      return;
    }

    const enunciado = this.questionDraft().trim();
    const puntajeMaximo = this.questionScoreDraft();

    if (enunciado.length < 10) {
      this.errorMessage.set('La pregunta debe tener al menos 10 caracteres.');
      return;
    }

    this.saving.set(true);
    const request$ = escenario.pregunta
      ? this.simulacionService.actualizarPregunta(escenario.pregunta.id, {
          enunciado,
          puntajeMaximo,
          tipo: 'single_choice',
        })
      : this.simulacionService.crearPregunta(escenario.id, {
          enunciado,
          puntajeMaximo,
          tipo: 'single_choice',
        });

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Pregunta actualizada.');
        this.loadEditor();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible guardar la pregunta.'));
      },
    });
  }

  saveOption(opcion?: CasoEditorOpcion): void {
    const escenario = this.escenarioSeleccionado();
    const pregunta = escenario?.pregunta;

    if (!escenario || !pregunta) {
      this.errorMessage.set('Primero debes guardar la pregunta.');
      return;
    }

    const texto = (opcion?.texto ?? this.newOptionText()).trim();
    const puntaje = opcion?.puntaje ?? this.newOptionScore();
    const isCorrecta = opcion?.isCorrecta ?? this.newOptionCorrect();
    const escenarioDestinoId = opcion?.escenarioDestinoId ?? (this.newOptionDestino() || null);

    if (!texto) {
      this.errorMessage.set('La opción no puede quedar vacía.');
      return;
    }

    this.saving.set(true);
    const request$ = opcion
      ? this.simulacionService.actualizarOpcion(opcion.id, {
          texto,
          orden: opcion.orden,
          puntaje,
          isCorrecta,
          escenarioDestinoId,
        })
      : this.simulacionService.crearOpcion(pregunta.id, {
          texto,
          orden: pregunta.opciones.length + 1,
          puntaje,
          isCorrecta,
          escenarioDestinoId,
        });

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.newOptionText.set('');
        this.newOptionScore.set(0);
        this.newOptionCorrect.set(false);
        this.newOptionDestino.set('');
        this.successMessage.set(opcion ? 'Opción actualizada.' : 'Opción creada.');
        this.loadEditor();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible guardar la opción.'));
      },
    });
  }

  saveFeedback(): void {
    const opcion = this.selectedDecisionOption();
    if (!opcion) {
      return;
    }

    const mensaje = this.feedbackDraft().trim();
    if (!mensaje) {
      this.errorMessage.set('La retroalimentación no puede quedar vacía.');
      return;
    }

    this.saving.set(true);
    const payload = {
      mensaje,
      tipo: this.feedbackTypeDraft(),
      referenciaTeorica: this.feedbackReferenceDraft().trim() || undefined,
    };
    const request$ = opcion.retroalimentacion
      ? this.simulacionService.actualizarRetroalimentacion(opcion.retroalimentacion.id, payload)
      : this.simulacionService.crearRetroalimentacion(opcion.id, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Retroalimentación guardada.');
        this.loadEditor();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible guardar la retroalimentación.'));
      },
    });
  }

  updateOptionField(
    opcionId: string,
    field: 'texto' | 'puntaje' | 'isCorrecta' | 'escenarioDestinoId',
    value: string | number | boolean,
  ): void {
    this.patchQuestionOption(opcionId, (opcion) => {
      if (field === 'texto' && typeof value === 'string') {
        opcion.texto = value;
      } else if (field === 'puntaje' && typeof value === 'number') {
        opcion.puntaje = value;
      } else if (field === 'isCorrecta' && typeof value === 'boolean') {
        opcion.isCorrecta = value;
      } else if (field === 'escenarioDestinoId' && typeof value === 'string') {
        opcion.escenarioDestinoId = value || null;
      }
    });
  }

  stageElementStyle(element: EditorElement): Record<string, string> {
    const shouldAutoSizeHeight = [
      'text',
      'instruction',
      'object',
      'audio',
      'question',
      'feedback',
    ].includes(element.type);

    return {
      left: `${element.position.x}%`,
      top: `${element.position.y}%`,
      width: `${element.size.width}px`,
      ...(shouldAutoSizeHeight
        ? {
            minHeight: `${element.size.height}px`,
            height: 'auto',
          }
        : {
            height: `${element.size.height}px`,
          }),
      transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
      zIndex: String(element.zIndex),
    };
  }

  canvasBackground(): string {
    const escenario = this.escenarioSeleccionado();
    return (
      escenario?.aiBackgroundUrl ||
      this.backgroundGradient(escenario?.fondoCodigo ?? 'oficina_psicologica')
    );
  }

  canvasBackgroundStyle(escenario = this.escenarioSeleccionado()): Record<string, string> {
    const imageUrl = escenario?.aiBackgroundUrl ?? null;

    if (imageUrl) {
      return {
        backgroundImage: `linear-gradient(rgba(31, 61, 46, 0.08), rgba(31, 61, 46, 0.08)), url('${imageUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }

    return {
      background: this.backgroundGradient(
        escenario?.fondoCodigo ?? 'oficina_psicologica',
      ),
    };
  }

  scenarioThumbStyle(escenario: CasoEditorEscenario): Record<string, string> {
    if (escenario.aiBackgroundUrl) {
      return {
        backgroundImage: `url('${escenario.aiBackgroundUrl}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }

    return {
      background: this.backgroundGradient(escenario.fondoCodigo),
    };
  }

  hasAiBackground(escenario = this.escenarioSeleccionado()): boolean {
    return Boolean(escenario?.aiBackgroundUrl);
  }

  backgroundGradient(code: string): string {
    const lower = code.toLowerCase();

    if (lower.includes('hospital')) {
      return 'linear-gradient(160deg, #f5fbff 0%, #dbeeff 58%, #bcd9ef 100%)';
    }
    if (lower.includes('casa')) {
      return 'linear-gradient(160deg, #fff7ed 0%, #ffe0b2 55%, #ffcc80 100%)';
    }
    if (lower.includes('aula')) {
      return 'linear-gradient(160deg, #fefce8 0%, #dcedc8 55%, #c5e1a5 100%)';
    }
    if (lower.includes('oficina')) {
      return 'linear-gradient(160deg, #f4f7fb 0%, #dce7f7 55%, #c5d6f2 100%)';
    }

    return 'linear-gradient(160deg, #eff7f0 0%, #dbead8 48%, #bfd8be 100%)';
  }

  contentText(element: EditorElement, key = 'texto'): string {
    const value = element.content[key];
    return typeof value === 'string' ? value : '';
  }

  contentLabel(element: EditorElement, key: string): string {
    const value = element.content[key];
    return typeof value === 'string' ? value : '';
  }

  elementImageUrl(element: EditorElement): string {
    return this.contentLabel(element, 'imageUrl');
  }

  elementAiType(element: EditorElement): string {
    return this.contentLabel(element, 'aiType');
  }

  elementObjectFit(element: EditorElement): string {
    const value = element.style['objectFit'];
    return typeof value === 'string' ? value : 'contain';
  }

  elementSurfaceStyle(element: EditorElement): Record<string, string> {
    const backgroundColor = element.style['backgroundColor'];
    const borderColor = element.style['borderColor'];
    const textColor = element.style['textColor'];
    const accentColor = element.style['accentColor'];

    return {
      background: typeof backgroundColor === 'string' ? backgroundColor : 'rgba(255, 255, 255, 0.92)',
      borderColor: typeof borderColor === 'string' ? borderColor : 'rgba(31, 61, 46, 0.08)',
      color: typeof textColor === 'string' ? textColor : 'var(--siep-text)',
      '--element-accent': typeof accentColor === 'string' ? accentColor : '#4f7d57',
    };
  }

  combinedElementStyle(element: EditorElement): Record<string, string> {
    return {
      ...this.stageElementStyle(element),
      ...this.elementSurfaceStyle(element),
    };
  }

  characterAvatarStyle(element: EditorElement): Record<string, string> {
    const avatarGradient = element.style['avatarGradient'];
    const accentColor = element.style['accentColor'];

    return {
      background:
        typeof avatarGradient === 'string' ? avatarGradient : this.characterGradient(element),
      borderColor: typeof accentColor === 'string' ? accentColor : '#ffffff',
    };
  }

  characterBubbleStyle(element: EditorElement): Record<string, string> {
    const bubbleColor = element.style['bubbleColor'];
    const accentColor = element.style['accentColor'];

    return {
      background:
        typeof bubbleColor === 'string' ? bubbleColor : 'rgba(255, 255, 255, 0.9)',
      borderColor: typeof accentColor === 'string' ? `${accentColor}33` : 'rgba(31, 61, 46, 0.08)',
    };
  }

  characterInitials(element: EditorElement): string {
    const base = this.contentLabel(element, 'nombre') || this.contentLabel(element, 'rol') || 'P';
    return base
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  noteTitle(element: EditorElement): string {
    return (
      this.contentLabel(element, 'nombre') ||
      this.contentLabel(element, 'titulo') ||
      this.noteTypeLabel(element)
    );
  }

  noteBody(element: EditorElement): string {
    return (
      this.contentText(element) ||
      this.contentText(element, 'mensaje') ||
      this.contentLabel(element, 'enunciado') ||
      this.contentLabel(element, 'nombre') ||
      element.type
    );
  }

  noteTypeLabel(element: EditorElement): string {
    switch (element.type) {
      case 'instruction':
        return 'Guia';
      case 'feedback':
        return 'Retroalimentacion';
      case 'audio':
        return 'Audio';
      case 'object':
        return 'Registro';
      case 'text':
        return 'Narrativa';
      default:
        return 'Elemento';
    }
  }

  questionSupportText(element: EditorElement): string {
    return this.contentLabel(element, 'apoyo');
  }

  libraryCardStyle(item: BibliotecaItem): Record<string, string> {
    const palette = this.libraryPalette(item);
    return {
      background: palette.surface,
      borderColor: palette.border,
      '--library-accent': palette.accent,
    };
  }

  libraryIconStyle(item: BibliotecaItem): Record<string, string> {
    const palette = this.libraryPalette(item);
    return {
      background: palette.icon,
      color: palette.accentText,
      borderColor: palette.border,
    };
  }

  libraryPreviewStyle(item: BibliotecaItem): Record<string, string> {
    const palette = this.libraryPalette(item);
    return {
      background: palette.preview,
      borderColor: palette.border,
    };
  }

  libraryPreviewBadge(item: BibliotecaItem): string {
    switch (item.tipo) {
      case 'background':
        return 'Escena base';
      case 'character':
        return 'Actor';
      case 'question':
        return 'Decision';
      case 'instruction':
        return 'Guia';
      case 'feedback':
        return 'Refuerzo';
      case 'audio':
        return 'Ambiente';
      default:
        return 'Recurso';
    }
  }

  libraryPreviewTitle(item: BibliotecaItem): string {
    const contentTitle =
      (typeof item.content['nombre'] === 'string' && item.content['nombre']) ||
      (typeof item.content['enunciado'] === 'string' && item.content['enunciado']) ||
      (typeof item.content['texto'] === 'string' && item.content['texto']) ||
      (typeof item.content['mensaje'] === 'string' && item.content['mensaje']);

    return contentTitle || item.nombre;
  }

  libraryPreviewBody(item: BibliotecaItem): string {
    const contentBody =
      (typeof item.content['texto'] === 'string' && item.content['texto']) ||
      (typeof item.content['dialogo'] === 'string' && item.content['dialogo']) ||
      (typeof item.content['mensaje'] === 'string' && item.content['mensaje']) ||
      (typeof item.content['apoyo'] === 'string' && item.content['apoyo']) ||
      item.descripcion;

    return contentBody;
  }

  private libraryPalette(item: BibliotecaItem): {
    surface: string;
    preview: string;
    icon: string;
    border: string;
    accent: string;
    accentText: string;
  } {
    switch (item.categoriaClave) {
      case 'backgrounds':
        return {
          surface: 'linear-gradient(180deg, rgba(248,250,255,0.98) 0%, rgba(239,245,255,0.96) 100%)',
          preview: 'linear-gradient(145deg, #f5f8ff 0%, #dde9fb 48%, #c6d8f2 100%)',
          icon: 'rgba(219, 232, 252, 0.95)',
          border: 'rgba(108, 142, 196, 0.22)',
          accent: '#557cab',
          accentText: '#34506f',
        };
      case 'characters':
        return {
          surface: 'linear-gradient(180deg, rgba(255,251,246,0.98) 0%, rgba(255,245,234,0.96) 100%)',
          preview: 'linear-gradient(145deg, #fff3e6 0%, #ffd7ba 55%, #f0b184 100%)',
          icon: 'rgba(255, 228, 204, 0.94)',
          border: 'rgba(201, 132, 81, 0.22)',
          accent: '#b56f42',
          accentText: '#804a27',
        };
      case 'questions':
        return {
          surface: 'linear-gradient(180deg, rgba(255,252,241,0.99) 0%, rgba(255,247,224,0.96) 100%)',
          preview: 'linear-gradient(145deg, #fff8de 0%, #ffe9a8 52%, #ffd26f 100%)',
          icon: 'rgba(255, 241, 195, 0.95)',
          border: 'rgba(204, 159, 45, 0.2)',
          accent: '#a67912',
          accentText: '#7b5700',
        };
      case 'audio':
        return {
          surface: 'linear-gradient(180deg, rgba(249,245,255,0.98) 0%, rgba(243,236,255,0.96) 100%)',
          preview: 'linear-gradient(145deg, #f5efff 0%, #dccdf7 52%, #bca0ea 100%)',
          icon: 'rgba(232, 221, 255, 0.95)',
          border: 'rgba(131, 104, 187, 0.2)',
          accent: '#785cb1',
          accentText: '#564085',
        };
      default:
        return {
          surface: 'linear-gradient(180deg, rgba(247,251,246,0.98) 0%, rgba(239,247,237,0.96) 100%)',
          preview: 'linear-gradient(145deg, #f4fbf1 0%, #d9eccf 52%, #b9d8a7 100%)',
          icon: 'rgba(217, 238, 204, 0.95)',
          border: 'rgba(98, 152, 92, 0.2)',
          accent: '#5f8b53',
          accentText: '#44683c',
        };
    }
  }

  latestAiActionLabel(): string {
    return this.assetVisibleType(this.latestAiAsset()) === 'background'
      ? 'Usar como fondo'
      : 'Insertar en escena';
  }

  latestAiAssetWarning(): string {
    return this.latestAiAsset()?.metadata?.backgroundRemovalWarning ?? '';
  }

  latestAiAssetUrl(): string {
    const asset = this.latestAiAsset();
    return asset?.imageUrl || asset?.publicUrl || '';
  }

  assetPreviewUrl(asset: AiAsset): string {
    return asset.imageUrl || asset.publicUrl;
  }

  aiGenerationHint(): string {
    if (!this.aiGenerating()) {
      return '';
    }

    return this.aiVisibleType() === 'background'
      ? 'Generando fondo con Hugging Face...'
      : 'Generando imagen y preparando transparencia. La primera vez puede tardar un poco mas.';
  }

  aiTypeBadge(): string {
    switch (this.aiVisibleType()) {
      case 'character':
        return 'PERSONAJE';
      case 'object':
        return 'OBJETO';
      case 'symbol':
        return 'SIMBOLO';
      default:
        return 'FONDO';
    }
  }

  characterGradient(element: EditorElement): string {
    const avatar = this.contentLabel(element, 'avatar').toLowerCase();
    const rol = this.contentLabel(element, 'rol').toLowerCase();

    if (avatar.includes('therapist') || rol.includes('psico')) {
      return 'linear-gradient(180deg, #CDE8B5 0%, #7CB342 100%)';
    }

    if (rol.includes('familiar')) {
      return 'linear-gradient(180deg, #ffe0b2 0%, #ffb74d 100%)';
    }

    return 'linear-gradient(180deg, #f4c7ab 0%, #d79a7a 100%)';
  }

  destinoBadgeStatus(tipo: 'explicito' | 'orden' | 'fin'): SiepStatusBadge {
    switch (tipo) {
      case 'explicito':
        return 'success';
      case 'orden':
        return 'warning';
      default:
        return 'inactive';
    }
  }

  destinoBadgeLabel(tipo: 'explicito' | 'orden' | 'fin'): string {
    switch (tipo) {
      case 'explicito':
        return 'Destino explícito';
      case 'orden':
        return 'Siguiente por orden';
      default:
        return 'Fin';
    }
  }

  publishCase(): void {
    if (!this.editor()) {
      return;
    }

    this.saving.set(true);
    this.simulacionService.publicarCaso(this.casoId).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Caso publicado.');
        this.loadEditor();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible publicar el caso.'));
      },
    });
  }

  hasUnsavedChanges(escenarioId: string): boolean {
    return this.dirtyScenarioIds().includes(escenarioId);
  }

  currentScenarioStatusLabel(escenario: CasoEditorEscenario): string {
    if (this.isScenarioDisconnected(escenario)) {
      return 'Sin conexión';
    }

    if (!escenario.pregunta || escenario.pregunta.opciones.length === 0) {
      return 'Incompleto';
    }

    return 'Completo';
  }

  currentScenarioStatusVariant(escenario: CasoEditorEscenario): SiepStatusBadge {
    const status = this.currentScenarioStatusLabel(escenario);
    if (status === 'Completo') {
      return 'success';
    }
    if (status === 'Sin conexión') {
      return 'error';
    }
    return 'warning';
  }

  flowSummaryValue(kind: 'disconnected' | 'finals' | 'paths'): number {
    if (kind === 'disconnected') {
      return this.escenarios().filter((escenario) => this.isScenarioDisconnected(escenario)).length;
    }

    if (kind === 'finals') {
      return this.escenarios().filter((escenario) => escenario.isFinal).length;
    }

    return this.editor()?.conexiones.length ?? 0;
  }

  incomingConnections(escenario: CasoEditorEscenario): number {
    return (
      this.editor()?.conexiones.filter((conexion) => conexion.destinoEscenarioId === escenario.id || conexion.destinoOrden === escenario.orden)
        .length ?? 0
    );
  }

  outgoingConnections(escenario: CasoEditorEscenario): number {
    return this.editor()?.conexiones.filter((conexion) => conexion.origenEscenarioId === escenario.id).length ?? 0;
  }

  isScenarioDisconnected(escenario: CasoEditorEscenario): boolean {
    const escenarios = this.escenarios();
    const isFirst = escenarios[0]?.id === escenario.id;
    const incoming = this.incomingConnections(escenario);
    const outgoing = this.outgoingConnections(escenario);

    if (!isFirst && incoming === 0) {
      return true;
    }

    if (!escenario.isFinal && escenario.pregunta && escenario.pregunta.opciones.length > 0 && outgoing === 0) {
      return true;
    }

    return false;
  }

  getQuestionElementSummary(): string {
    const pregunta = this.escenarioSeleccionado()?.pregunta;
    if (!pregunta) {
      return 'Sin pregunta creada';
    }

    return `${pregunta.opciones.length} opciones configuradas`;
  }

  private assetVisibleType(asset: AiAsset | null): AiAssetVisibleType {
    if (asset?.visibleType) {
      return asset.visibleType;
    }

    switch (asset?.tipo) {
      case 'PERSONAJE':
        return 'character';
      case 'OBJETO':
        return 'object';
      default:
        return 'background';
    }
  }

  private backendAiType(visibleType: AiAssetVisibleType): 'FONDO' | 'PERSONAJE' | 'OBJETO' {
    switch (visibleType) {
      case 'character':
        return 'PERSONAJE';
      case 'object':
      case 'symbol':
        return 'OBJETO';
      default:
        return 'FONDO';
    }
  }

  private buildStarterSceneLayout(
    escenario: Pick<CasoEditorEscenario, 'id' | 'titulo' | 'situacionTexto' | 'fondoCodigo'>,
  ): { version: number; elements: EditorElement[] } {
    return {
      version: 1,
      elements: [
        {
          id: `bg-${escenario.id}`,
          type: 'background',
          position: { x: 50, y: 50 },
          size: { width: 1000, height: 560 },
          rotation: 0,
          zIndex: 0,
          locked: true,
          hidden: false,
          style: {
            backgroundCode: escenario.fondoCodigo,
          },
          content: {
            title: escenario.titulo,
            situacionTexto: escenario.situacionTexto,
          },
          bindings: {},
        },
        {
          id: crypto.randomUUID(),
          type: 'instruction',
          position: { x: 24, y: 20 },
          size: { width: 330, height: 112 },
          rotation: 0,
          zIndex: 1,
          locked: false,
          hidden: false,
          style: {
            backgroundColor: 'rgba(237,247,255,0.96)',
            borderColor: 'rgba(90,145,194,0.26)',
            accentColor: '#4f7fa8',
            textColor: '#21405a',
          },
          content: {
            nombre: 'Foco de observacion',
            texto: 'Explora senales emocionales, contexto y factores de apoyo antes de intervenir.',
          },
          bindings: {},
        },
        {
          id: crypto.randomUUID(),
          type: 'character',
          position: { x: 27, y: 64 },
          size: { width: 196, height: 268 },
          rotation: 0,
          zIndex: 2,
          locked: false,
          hidden: false,
          style: {
            avatarGradient: 'linear-gradient(180deg, #d9efc2 0%, #74a95b 100%)',
            accentColor: '#4f7d3d',
            bubbleColor: 'rgba(246,251,242,0.96)',
          },
          content: {
            nombre: 'Laura',
            rol: 'Orientadora',
            avatar: 'mentor-guide',
            expresion: 'Serena',
            estadoEmocional: 'Contencion',
            dialogo: 'Inicia con una pregunta abierta y una escucha sin juicio.',
          },
          bindings: {},
        },
        {
          id: crypto.randomUUID(),
          type: 'character',
          position: { x: 72, y: 67 },
          size: { width: 196, height: 268 },
          rotation: 0,
          zIndex: 3,
          locked: false,
          hidden: false,
          style: {
            avatarGradient: 'linear-gradient(180deg, #ffd7ba 0%, #e99e75 100%)',
            accentColor: '#bf6d45',
            bubbleColor: 'rgba(255,255,255,0.94)',
          },
          content: {
            nombre: 'Valeria',
            rol: 'Estudiante',
            avatar: 'student-support',
            expresion: 'Reservada',
            estadoEmocional: 'Ansiedad social',
            dialogo: 'Siento que todos me miran cuando tengo que participar.',
          },
          bindings: {},
        },
        {
          id: crypto.randomUUID(),
          type: 'object',
          position: { x: 77, y: 22 },
          size: { width: 264, height: 108 },
          rotation: 0,
          zIndex: 4,
          locked: false,
          hidden: false,
          style: {
            backgroundColor: 'rgba(255,250,240,0.95)',
            borderColor: 'rgba(205,162,91,0.24)',
            accentColor: '#b07a2f',
            textColor: '#59411d',
          },
          content: {
            nombre: 'Registro breve',
            texto: 'Antecedente: evita exposiciones orales y reporta malestar anticipatorio.',
          },
          bindings: {},
        },
        {
          id: crypto.randomUUID(),
          type: 'question',
          position: { x: 50, y: 28 },
          size: { width: 368, height: 162 },
          rotation: 0,
          zIndex: 5,
          locked: false,
          hidden: false,
          style: {
            backgroundColor: 'rgba(255,255,255,0.97)',
            borderColor: 'rgba(86,140,98,0.22)',
            accentColor: '#4f7d57',
            textColor: '#1f3d2e',
          },
          content: {
            enunciado: 'Que primera intervencion ayuda a contener y comprender la situacion?',
            apoyo: 'Conviene priorizar escucha, validacion y lectura del contexto.',
          },
          bindings: {},
        },
      ],
    };
  }

  private ensureLibrarySelection(): void {
    const items = this.library();
    if (!items.length) {
      this.selectedLibraryItemId.set('');
      return;
    }

    const current = items.find((item) => item.id === this.selectedLibraryItemId());
    if (!current) {
      this.selectedLibraryItemId.set(items[0].id);
    }
  }

  private getPreferredSelectedElement(
    escenario: CasoEditorEscenario | null,
  ): EditorElement | null {
    if (!escenario) {
      return null;
    }

    return (
      escenario.layout.elements.find((item) => item.type !== 'background') ??
      escenario.layout.elements[0] ??
      null
    );
  }

  private syncQuestionDraft(): void {
    const pregunta = this.escenarioSeleccionado()?.pregunta;
    this.questionDraft.set(pregunta?.enunciado ?? '');
    this.questionScoreDraft.set(pregunta?.puntajeMaximo ?? 10);
  }

  private syncDecisionSelection(): void {
    const firstOption = this.escenarioSeleccionado()?.pregunta?.opciones[0] ?? null;
    this.selectedDecisionOptionId.set(firstOption?.id ?? null);
    this.syncFeedbackDraft();
  }

  private syncFeedbackDraft(): void {
    const option = this.selectedDecisionOption();
    this.feedbackDraft.set(option?.retroalimentacion?.mensaje ?? '');
    this.feedbackTypeDraft.set(option?.retroalimentacion?.tipo ?? 'pedagogica');
    this.feedbackReferenceDraft.set(option?.retroalimentacion?.referenciaTeorica ?? '');
  }

  private resolveFallbackScenarioId(deletedScenarioId: string): string | null {
    const escenarios = this.escenarios();
    const deletedIndex = escenarios.findIndex((item) => item.id === deletedScenarioId);
    if (deletedIndex === -1) {
      return escenarios[0]?.id ?? null;
    }

    const previous = escenarios[deletedIndex - 1];
    if (previous) {
      return previous.id;
    }

    const next = escenarios[deletedIndex + 1];
    return next?.id ?? null;
  }

  private selectedScenarioElement(elementId: string): EditorElement | null {
    return this.escenarioSeleccionado()?.layout.elements.find((item) => item.id === elementId) ?? null;
  }

  private loadAiAssets(): void {
    this.simulacionService.listarAiAssetsCaso(this.casoId).subscribe({
      next: (assets) => {
        this.aiAssets.set(assets);
        if (!this.selectedAiAssetId() && assets.length > 0) {
          this.selectedAiAssetId.set(assets[0].id);
        }
      },
      error: () => {
        this.aiAssets.set([]);
      },
    });
  }

  private loadDocenteAssets(): void {
    this.simulacionService.listarDocenteAssetsCaso(this.casoId).subscribe({
      next: (assets) => {
        this.docenteAssets.set(assets);
      },
      error: () => {
        this.docenteAssets.set([]);
      },
    });
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this.dragState) {
      return;
    }

    const zoom = this.zoomLevel();
    const deltaX = (event.clientX - this.dragState.startX) / (12 * zoom);
    const deltaY = (event.clientY - this.dragState.startY) / (12 * zoom);

    this.updateElement(
      this.dragState.elementId,
      (element) => {
        element.position.x = this.clamp(this.dragState!.originX + deltaX, -20, 120);
        element.position.y = this.clamp(this.dragState!.originY + deltaY, -20, 120);
      },
      { trackHistory: false },
    );
  }

  private updateElement(
    elementId: string,
    mutator: (element: EditorElement) => void,
    options?: PatchScenarioOptions,
  ): void {
    this.patchScenario((escenario) => {
      const element = escenario.layout.elements.find((item) => item.id === elementId);
      if (element) {
        mutator(element);
      }
    }, options);
  }

  private patchQuestionOption(opcionId: string, mutator: (opcion: CasoEditorOpcion) => void): void {
    this.editor.update((editor) => {
      if (!editor) {
        return editor;
      }

      return {
        ...editor,
        escenarios: editor.escenarios.map((escenario) => {
          if (escenario.id !== this.selectedEscenarioId() || !escenario.pregunta) {
            return escenario;
          }

          return {
            ...escenario,
            pregunta: {
              ...escenario.pregunta,
              opciones: escenario.pregunta.opciones.map((opcion) => {
                if (opcion.id !== opcionId) {
                  return opcion;
                }

                const clone = structuredClone(opcion);
                mutator(clone);
                return clone;
              }),
            },
          };
        }),
      };
    });
  }

  private patchScenario(
    mutator: (escenario: CasoEditorEscenario) => void,
    options: PatchScenarioOptions = {},
  ): void {
    const scenarioId = this.selectedEscenarioId();
    const trackHistory = options.trackHistory ?? true;

    this.editor.update((editor) => {
      if (!editor || !scenarioId) {
        return editor;
      }

      return {
        ...editor,
        escenarios: editor.escenarios.map((escenario) => {
          if (escenario.id !== scenarioId) {
            return escenario;
          }

          const previousLayout = structuredClone(escenario.layout);
          const clone = structuredClone(escenario);
          mutator(clone);
          this.ensureScenarioBackground(clone);
          clone.layout.elements = [...clone.layout.elements].sort((a, b) => a.zIndex - b.zIndex);
          if (trackHistory && !this.layoutsEqual(previousLayout, clone.layout)) {
            this.pushScenarioHistory(scenarioId, previousLayout);
          }
          this.updateDirtyState(scenarioId, clone.layout);
          return clone;
        }),
      };
    });
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  toNumber(value: string): number {
    return Number(value) || 0;
  }

  private ensureScenarioBackground(escenario: CasoEditorEscenario): EditorElement {
    const existing = escenario.layout.elements.find((item) => item.type === 'background');

    if (existing) {
      existing.position = { x: 50, y: 50 };
      existing.size = { width: 1000, height: 560 };
      existing.rotation = 0;
      existing.zIndex = 0;
      existing.locked = true;
      existing.hidden = false;
      existing.style = {
        ...existing.style,
        backgroundCode:
          typeof existing.style['backgroundCode'] === 'string'
            ? existing.style['backgroundCode']
            : escenario.fondoCodigo,
      };
      existing.content = {
        ...existing.content,
        title:
          typeof existing.content['title'] === 'string'
            ? existing.content['title']
            : escenario.titulo,
        situacionTexto:
          typeof existing.content['situacionTexto'] === 'string'
            ? existing.content['situacionTexto']
            : escenario.situacionTexto,
      };
      return existing;
    }

    const background: EditorElement = {
      id: `bg-${escenario.id}`,
      type: 'background',
      position: { x: 50, y: 50 },
      size: { width: 1000, height: 560 },
      rotation: 0,
      zIndex: 0,
      locked: true,
      hidden: false,
      style: {
        backgroundCode: escenario.fondoCodigo,
      },
      content: {
        title: escenario.titulo,
        situacionTexto: escenario.situacionTexto,
      },
      bindings: {},
    };

    escenario.layout.elements.unshift(background);
    return background;
  }

  private resetScenarioBackground(escenario: CasoEditorEscenario): void {
    const background = this.ensureScenarioBackground(escenario);
    const defaultBackgroundCode =
      this.editor()?.catalogos.backgrounds[0] ?? 'oficina_psicologica';

    escenario.fondoCodigo = defaultBackgroundCode;
    escenario.aiBackgroundAssetId = null;
    escenario.aiBackgroundUrl = null;

    background.content = {
      ...background.content,
      backgroundCode: defaultBackgroundCode,
      aiAssetId: null,
      imageUrl: null,
    };
    background.style = {
      ...background.style,
      backgroundCode: defaultBackgroundCode,
      aiAssetId: null,
      imageUrl: null,
    };
  }

  private handleWindowResize(): void {
    if (this.workspace() === 'scene') {
      this.scheduleFitSceneToViewport();
    }
  }

  private handleWindowKeyDown(event: KeyboardEvent): void {
    if (this.workspace() !== 'scene') {
      return;
    }

    if (this.isTypingTarget(event.target)) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        this.redoSceneChange();
      } else {
        this.undoSceneChange();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') {
      event.preventDefault();
      this.redoSceneChange();
      return;
    }

    if (event.key === 'Delete' || event.key === 'Del') {
      if (!this.selectedElement()) {
        return;
      }

      event.preventDefault();
      this.deleteSelectedElement();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') {
      if (!this.selectedElement()) {
        return;
      }

      event.preventDefault();
      this.duplicateSelectedElement();
    }
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName;
    return (
      target.isContentEditable ||
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT'
    );
  }

  private setZoomLevel(value: number): void {
    this.zoomLevel.set(this.clamp(Number(value.toFixed(2)), 0.5, 2));
    this.centerViewport();
  }

  private initializeScenarioHistory(escenarios: CasoEditorEscenario[]): void {
    this.scenarioHistory = new Map(
      escenarios.map((escenario) => [
        escenario.id,
        {
          baseline: structuredClone(escenario.layout),
          past: [],
          future: [],
        },
      ]),
    );
    this.bumpHistoryRevision();
  }

  private pushScenarioHistory(
    scenarioId: string,
    layout: CasoEditorEscenario['layout'],
  ): void {
    const history = this.scenarioHistory.get(scenarioId);
    if (!history) {
      return;
    }

    const snapshot = structuredClone(layout);
    const lastSnapshot = history.past.at(-1);
    if (lastSnapshot && this.layoutsEqual(lastSnapshot, snapshot)) {
      history.future = [];
      this.bumpHistoryRevision();
      return;
    }

    history.past = [...history.past, snapshot].slice(-100);
    history.future = [];
    this.bumpHistoryRevision();
  }

  private applyScenarioLayout(
    scenarioId: string,
    layout: CasoEditorEscenario['layout'],
  ): void {
    this.editor.update((editor) => {
      if (!editor) {
        return editor;
      }

      return {
        ...editor,
        escenarios: editor.escenarios.map((escenario) => {
          if (escenario.id !== scenarioId) {
            return escenario;
          }

          const clone = structuredClone(escenario);
          clone.layout = structuredClone(layout);
          this.ensureScenarioBackground(clone);
          clone.layout.elements = [...clone.layout.elements].sort((a, b) => a.zIndex - b.zIndex);
          return clone;
        }),
      };
    });

    const escenario = this.escenarios().find((item) => item.id === scenarioId) ?? null;
    this.selectedElementId.set(this.resolveSelectedElementIdAfterLayoutChange(escenario));
    if (escenario) {
      this.updateDirtyState(scenarioId, escenario.layout);
    }
  }

  private resolveSelectedElementIdAfterLayoutChange(
    escenario: CasoEditorEscenario | null,
  ): string | null {
    if (!escenario) {
      return null;
    }

    const currentSelection = this.selectedElementId();
    if (currentSelection && escenario.layout.elements.some((item) => item.id === currentSelection)) {
      return currentSelection;
    }

    return this.getPreferredSelectedElement(escenario)?.id ?? null;
  }

  private updateDirtyState(
    scenarioId: string,
    currentLayout: CasoEditorEscenario['layout'],
  ): void {
    const history = this.scenarioHistory.get(scenarioId);
    if (!history) {
      return;
    }

    const isDirty = !this.layoutsEqual(history.baseline, currentLayout);
    const dirtyIds = this.dirtyScenarioIds();

    if (isDirty && !dirtyIds.includes(scenarioId)) {
      this.dirtyScenarioIds.set([...dirtyIds, scenarioId]);
      return;
    }

    if (!isDirty && dirtyIds.includes(scenarioId)) {
      this.dirtyScenarioIds.set(dirtyIds.filter((item) => item !== scenarioId));
    }
  }

  private layoutsEqual(
    first: CasoEditorEscenario['layout'],
    second: CasoEditorEscenario['layout'],
  ): boolean {
    return JSON.stringify(first) === JSON.stringify(second);
  }

  private bumpHistoryRevision(): void {
    this.historyRevision.update((value) => value + 1);
  }

  private centerViewport(): void {
    const viewport = this.sceneViewport?.nativeElement;
    if (!viewport) {
      return;
    }

    requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max((viewport.scrollWidth - viewport.clientWidth) / 2, 0);
      viewport.scrollTop = Math.max((viewport.scrollHeight - viewport.clientHeight) / 2, 0);
    });
  }

  private scheduleFitSceneToViewport(): void {
    if (this.fitSceneTimeoutId) {
      clearTimeout(this.fitSceneTimeoutId);
    }

    this.fitSceneTimeoutId = setTimeout(() => this.fitSceneToViewport(), 0);
  }
}
