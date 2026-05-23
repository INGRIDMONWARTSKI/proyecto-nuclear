# Flujo de Git

## Reglas

1. Nadie trabaja directamente sobre `main`.
2. Cada persona trabaja en su propia rama.
3. Antes de empezar:
   `git checkout main`
   `git pull`
4. Crear o entrar a la rama:
   `git checkout -b feature/nombre-modulo`
5. Guardar cambios:
   `git add .`
   `git commit -m "Descripcion clara del cambio"`
   `git push origin feature/nombre-modulo`
6. Para unir cambios se debe hacer Pull Request.
7. No modificar archivos globales sin avisar al grupo.

## Ramas del equipo

- Persona 1: `feature/auth-usuarios`
- Persona 2: `feature/grupos-clases`
- Persona 3: `feature/casos-simulacion`
- Persona 4: `feature/frontend-ui`
