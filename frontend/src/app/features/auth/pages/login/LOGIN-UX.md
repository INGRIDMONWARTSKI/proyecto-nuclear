# PsychoSim Login — Guía de microinteracciones

Ruta: `/login` · Componente: `login.component.*`

## Paleta (Design Kit)

| Token        | Hex       | Uso                          |
|-------------|-----------|------------------------------|
| Forest dark | `#1F3D2E` | Títulos, labels              |
| Leaf green  | `#2E7D32` | Botón principal, acentos     |
| Sage        | `#66BB6A` | Glow, hover, bordes focus    |
| Cream       | `#DBE5D3` | Bordes, fondos secundarios   |
| Surface     | `#F6F8F3` | Fondo página, inputs         |
| Error       | `#E57373` | Validación / alertas         |

## Cómo probar

```powershell
npm run up
# Abrir http://localhost:4200/login
```

### Botón «Entrar al simulador»
- **Idle:** glow pulsante (`btn-idle-glow`).
- **Hover:** elevación + escala 1.03 + glow intenso.
- **Click:** compresión (`btn-enter--pressed` + `:active`).
- **Loading:** spinner + texto «Entrando...».
- **Éxito:** check animado + «¡Bienvenido!» → navega a `/grupos` tras 900 ms.

### Inputs
- **Focus:** borde sage + sombra progresiva + icono verde.
- **Acceso rápido:** flash verde (`field-flash`) al rellenar credenciales demo.
- **Error:** borde rojo + mensaje con fade-in.

### Accesos rápidos (Admin / Profesor / Estudiante)
- **Hover:** lift + anillo luminoso.
- **Click:** pulse (`chip-pulse`) + relleno de formulario.
- Iconos SVG: corona, birrete, persona.

### Hero
- **Tarjetas story:** elevación, rotación 0.6°, borde glow al hover.
- **Silueta + bosque:** flotación suave (`head-float`).
- **Orbitales:** rotación continua 24 s (brotes, corazón, cerebro) + parallax al mover el mouse.
- **Hojas SVG:** drift independiente + parallax por capa (`depth` 5–12 px).

### Fondo
- Partículas (`particle-float`), niebla (`mist-drift`), hojas en 3 variantes de color.

### Accesibilidad
- `prefers-reduced-motion`: desactiva animaciones continuas.
- Labels, `aria-label`, `aria-pressed` en toggle contraseña, `role="alert"` en errores.

## Credenciales demo (seed)

| Rol        | Email                      | Contraseña      |
|-----------|----------------------------|-----------------|
| Admin     | admin@nuclear.local        | Admin123*       |
| Profesor  | profesor@nuclear.local     | Profesor123*    |
| Estudiante| estudiante1@nuclear.local  | Estudiante123*  |

## Assets (inline SVG, sin dependencias)

Todos los assets viven en el template HTML del componente:
- Logo cerebro partido
- Hero silueta + río + bosque
- Hojas flotantes (8 variantes)
- Iconos orbitales
- Iconos de formulario (mail, lock, eye)
- Badges de seguridad y error

## Notas técnicas

- Parallax: `onPageMove` normaliza cursor (−1…1) → `parallaxStyle(depth)`.
- Auth: sin cambios en `AuthService`; misma lógica de login y redirección.
- Fuentes: Poppins + Inter vía Google Fonts en `index.html` (sin npm extra).
