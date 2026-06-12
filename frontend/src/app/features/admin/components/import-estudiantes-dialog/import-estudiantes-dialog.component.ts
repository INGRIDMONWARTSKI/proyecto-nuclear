import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import {
  buildPlantillaCsv,
  buildReporteCredencialesCsv,
  downloadTextFile,
  flattenImportResults,
  type ImportarEstudiantesResponse,
  type ImportResultRow,
} from '../../../../core/models/import-estudiantes.model';

@Component({
  selector: 'app-import-estudiantes-dialog',
  standalone: true,
  styleUrl: './import-estudiantes-dialog.component.scss',
  templateUrl: './import-estudiantes-dialog.component.html',
})
export class ImportEstudiantesDialogComponent {
  @Input() open = false;
  @Input() importing = false;
  @Input() errorMessage: string | null = null;
  @Input() result: ImportarEstudiantesResponse | null = null;

  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly importRequested = new EventEmitter<File>();
  @Output() readonly fileSelected = new EventEmitter<File | null>();

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly dragOver = signal(false);

  protected resultRows(): ImportResultRow[] {
    return this.result ? flattenImportResults(this.result) : [];
  }

  protected onBackdropClick(): void {
    if (!this.importing) {
      this.closed.emit();
    }
  }

  protected onCancel(): void {
    if (!this.importing) {
      this.closed.emit();
    }
  }

  protected onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setSelectedFile(file);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    if (this.importing) {
      return;
    }
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.setSelectedFile(file);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.importing) {
      this.dragOver.set(true);
    }
  }

  protected onDragLeave(): void {
    this.dragOver.set(false);
  }

  protected triggerFilePicker(input: HTMLInputElement): void {
    if (!this.importing) {
      input.click();
    }
  }

  protected submitImport(): void {
    const file = this.selectedFile();
    if (!file || this.importing) {
      return;
    }
    this.importRequested.emit(file);
  }

  protected downloadPlantilla(): void {
    downloadTextFile(buildPlantillaCsv(), 'plantilla-estudiantes.csv', 'text/csv;charset=utf-8');
  }

  protected downloadReporte(): void {
    if (!this.result?.reporteCredenciales.length) {
      return;
    }
    downloadTextFile(
      buildReporteCredencialesCsv(this.result),
      'reporte-credenciales-estudiantes.csv',
      'text/csv;charset=utf-8',
    );
  }

  protected estadoLabel(estado: string): string {
    switch (estado) {
      case 'creado':
        return 'Creado';
      case 'existente_asignado':
        return 'Existente asignado';
      case 'duplicado':
        return 'Duplicado';
      default:
        return 'Error';
    }
  }

  private setSelectedFile(file: File | null): void {
    this.selectedFile.set(file);
    this.fileSelected.emit(file);
  }
}
