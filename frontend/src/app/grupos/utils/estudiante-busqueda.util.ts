import { Usuario } from '../../core/models/usuario.model';

export function filtrarEstudiantesPorBusqueda(
  estudiantes: Usuario[],
  query: string,
): Usuario[] {
  const termino = query.trim().toLowerCase();
  if (!termino) {
    return estudiantes;
  }

  return estudiantes.filter(
    (estudiante) =>
      estudiante.fullName.toLowerCase().includes(termino) ||
      estudiante.email.toLowerCase().includes(termino),
  );
}
