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

  protected casoId = '';
  protected readonly sceneBaseWidth = 1280;
  protected readonly sceneBaseHeight = 720;

  private dragState: DragState | null = null;
  private pendingAiInsertedElementId: string | null = null;
  private fitSceneTimeoutId: ReturnType<typeof setTimeout> | null = null;
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
    { id: 'layout', label: 'Posicion y tamano' },
    { id: 'content', label: 'Contenido' },
    { id: 'advanced', label: 'Avanzado' },
  ] as const;

  protected readonly aiStyleOptions = [
    {
      id: 'editorial_sereno',
      label: 'Editorial sereno',
      description: 'Ilustracion limpia, academica y equilibrada.',
    },
    {
      id: 'acuarela_suave',
      label: 'Acuarela suave',
      description: 'Textura ligera y atmosfera calmada.',
    },
    {
      id: 'minimal_calido',
      label: 'Minimal calido',
      description: 'Composicion simple, profesional y acogedora.',
    },
  ] as const;

  protected readonly aiVisibleTypeOptions = [
    { id: 'background', label: 'Fondo' },
    { id: 'character', label: 'Personaje' },
    { id: 'object', label: 'Objeto' },
    { id: 'symbol', label: 'Simbolo/emocion' },
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

  protected readonly validationErrors = computed(() => this.editor()?.validationErrors ?? []);
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
      descripcion: 'Contexto escolar para convivencia y observacion.',
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
      descripcion: 'Personaje editable para el caso clinico.',
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
      nombre: 'Psicologo',
      tipo: 'character',
      categoria: 'Personaje',
      categoriaClave: 'characters',
      icono: '◕',
      descripcion: 'Profesional que conduce la intervencion.',
      tag: 'Guia',
      content: {
        nombre: 'Profesional',
        rol: 'Psicologo',
        avatar: 'therapist-default',
        expresion: 'Empatica',
        estadoEmocional: 'Regulacion',
        dialogo: 'Explora con cuidado la situacion antes de decidir.',
      },
      size: { width: 180, height: 250 },
    },
    {
      id: 'texto-dialogo',
      nombre: 'Dialogo',
      tipo: 'text',
      categoria: 'Texto',
      categoriaClave: 'texts',
      icono: 'T',
      descripcion: 'Texto libre para notas, pensamientos o pistas.',
      tag: 'Rapido',
      content: { texto: 'Escribe aqui un dialogo o una nota de escena.' },
      size: { width: 240, height: 90 },
    },
    {
      id: 'texto-instruccion',
      nombre: 'Instruccion',
      tipo: 'instruction',
      categoria: 'Texto',
      categoriaClave: 'texts',
      icono: 'i',
      descripcion: 'Guia breve para el estudiante dentro del escenario.',
      tag: 'Pedagogico',
      content: { texto: 'Analiza la situacion antes de responder.' },
      size: { width: 260, height: 90 },
    },
    {
      id: 'objeto-nota',
      nombre: 'Nota clinica',
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
      content: { enunciado: 'Formula aqui la decision principal del escenario.' },
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
      content: { mensaje: 'El feedback aparece segun la opcion elegida.' },
      size: { width: 280, height: 110 },
    },
  ]);

  protected readonly library = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const category = this.selectedLibraryCategory();

    return this.allLibraryItems().filter((item) => {
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
        this.editor.set(editor);
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
        situacionTexto: 'Describe aqui el momento narrativo, el contexto y la tension pedagogica.',
        fondoCodigo: editor.catalogos.backgrounds[0] ?? 'oficina_psicologica',
        isFinal: false,
      })
      .subscribe({
        next: (escenario) => {
          this.saving.set(false);
          this.selectedEscenarioId.set(escenario.id);
          this.loadEditor();
        },
        error: (error) => {
          this.saving.set(false);
          this.errorMessage.set(getErrorMessage(error, 'No fue posible crear el escenario.'));
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
      this.errorMessage.set('Describe el recurso con al menos 12 caracteres.');
      return;
    }

    this.aiGenerating.set(true);
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
          this.errorMessage.set(
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
          this.errorMessage.set(
            getErrorMessage(error, 'No fue posible insertar el recurso IA en la escena.'),
          );
        },
      });
  }

  startDrag(event: PointerEvent, elementId: string): void {
    const element = this.selectedScenarioElement(elementId);
    if (!element || element.locked) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.selectedElementId.set(elementId);
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
    this.dragState = null;
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
      this.errorMessage.set('La opcion no puede quedar vacia.');
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
        this.successMessage.set(opcion ? 'Opcion actualizada.' : 'Opcion creada.');
        this.loadEditor();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible guardar la opcion.'));
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
      this.errorMessage.set('La retroalimentacion no puede quedar vacia.');
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
        this.successMessage.set('Retroalimentacion guardada.');
        this.loadEditor();
      },
      error: (error) => {
        this.saving.set(false);
        this.errorMessage.set(getErrorMessage(error, 'No fue posible guardar la retroalimentacion.'));
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
    return {
      left: `${element.position.x}%`,
      top: `${element.position.y}%`,
      width: `${element.size.width}px`,
      height: `${element.size.height}px`,
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
        return 'Destino explicito';
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
      return 'Sin conexion';
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
    if (status === 'Sin conexion') {
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

  private onPointerMove(event: PointerEvent): void {
    if (!this.dragState) {
      return;
    }

    const zoom = this.zoomLevel();
    const deltaX = (event.clientX - this.dragState.startX) / (12 * zoom);
    const deltaY = (event.clientY - this.dragState.startY) / (12 * zoom);

    this.updateElement(this.dragState.elementId, (element) => {
      element.position.x = this.clamp(this.dragState!.originX + deltaX, -20, 120);
      element.position.y = this.clamp(this.dragState!.originY + deltaY, -20, 120);
    });
  }

  private updateElement(elementId: string, mutator: (element: EditorElement) => void): void {
    this.patchScenario((escenario) => {
      const element = escenario.layout.elements.find((item) => item.id === elementId);
      if (element) {
        mutator(element);
      }
    });
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

  private patchScenario(mutator: (escenario: CasoEditorEscenario) => void): void {
    const scenarioId = this.selectedEscenarioId();

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

          const clone = structuredClone(escenario);
          mutator(clone);
          this.ensureScenarioBackground(clone);
          clone.layout.elements = [...clone.layout.elements].sort((a, b) => a.zIndex - b.zIndex);
          return clone;
        }),
      };
    });

    if (scenarioId && !this.dirtyScenarioIds().includes(scenarioId)) {
      this.dirtyScenarioIds.set([...this.dirtyScenarioIds(), scenarioId]);
    }
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
