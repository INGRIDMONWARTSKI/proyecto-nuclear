import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface ParsedEstudianteRow {
  rowNumber: number;
  fullName: string;
  email: string;
}

const FULL_NAME_HEADERS = new Set([
  'fullname',
  'nombre',
  'nombrecompleto',
  'name',
]);

const EMAIL_HEADERS = new Set(['email', 'correo', 'correoinstitucional', 'mail']);

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '');
}

function isFullNameHeader(header: string): boolean {
  const normalized = normalizeHeader(header);
  return FULL_NAME_HEADERS.has(normalized) || normalized.includes('nombre');
}

function isEmailHeader(header: string): boolean {
  const normalized = normalizeHeader(header);
  return (
    EMAIL_HEADERS.has(normalized) ||
    normalized.includes('correo') ||
    normalized.includes('email')
  );
}

function extractRowValues(raw: Record<string, unknown>): {
  fullName: string;
  email: string;
} {
  let fullName = '';
  let email = '';

  for (const [header, value] of Object.entries(raw)) {
    const text = String(value ?? '').trim();
    if (!text) {
      continue;
    }

    if (isFullNameHeader(header)) {
      fullName = text;
    }

    if (isEmailHeader(header)) {
      email = text.toLowerCase();
    }
  }

  return { fullName, email };
}

function readWorkbook(buffer: Buffer, filename: string): XLSX.WorkBook {
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';

  if (extension === 'csv') {
    const text = buffer.toString('utf-8');
    return XLSX.read(text, { type: 'string' });
  }

  if (extension === 'xlsx' || extension === 'xls') {
    return XLSX.read(buffer, { type: 'buffer' });
  }

  throw new BadRequestException(
    'Formato no soportado. Usa un archivo .csv o .xlsx.',
  );
}

export function parseEstudiantesFile(
  buffer: Buffer,
  filename: string,
): ParsedEstudianteRow[] {
  if (!buffer?.length) {
    throw new BadRequestException('El archivo esta vacio.');
  }

  const workbook = readWorkbook(buffer, filename);
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new BadRequestException('El archivo no contiene hojas de datos.');
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });

  if (rows.length === 0) {
    throw new BadRequestException(
      'El archivo no contiene filas de estudiantes para importar.',
    );
  }

  return rows.map((row, index) => {
    const { fullName, email } = extractRowValues(row);
    return {
      rowNumber: index + 2,
      fullName,
      email,
    };
  });
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
