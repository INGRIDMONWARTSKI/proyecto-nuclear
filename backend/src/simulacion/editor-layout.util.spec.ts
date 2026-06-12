import { buildDefaultLayout, normalizeLayout } from './editor-layout.util';
import type { EscenarioRecord } from './entities/escenario.entity';

describe('editor-layout.util', () => {
  const escenario: EscenarioRecord = {
    id: 'escenario-1',
    caso_id: 'caso-1',
    orden: 1,
    titulo: 'Escena de prueba',
    situacion_texto: 'Situacion inicial del caso.',
    fondo_codigo: 'consultorio',
    is_final: false,
    layout_version: 1,
    layout_data: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('rebuilds the background element when a saved layout does not include one', () => {
    const layout = normalizeLayout(
      {
        version: 1,
        elements: [
          {
            id: 'char-1',
            type: 'character',
            position: { x: 20, y: 40 },
            size: { width: 100, height: 200 },
            rotation: 0,
            zIndex: 3,
            locked: false,
            hidden: false,
            style: {},
            content: { nombre: 'Paciente' },
            bindings: {},
          },
        ],
      },
      escenario,
    );

    expect(layout.elements[0]).toMatchObject({
      id: `bg-${escenario.id}`,
      type: 'background',
      zIndex: 0,
      locked: true,
      hidden: false,
      style: {
        backgroundCode: escenario.fondo_codigo,
      },
    });
    expect(layout.elements.some((item) => item.type === 'character')).toBe(true);
  });

  it('preserves ai background metadata while normalizing the background element', () => {
    const defaultBackground = buildDefaultLayout(escenario).elements[0];
    const layout = normalizeLayout(
      {
        version: 1,
        elements: [
          {
            ...defaultBackground,
            locked: false,
            hidden: true,
            zIndex: 9,
            style: {
              ...defaultBackground.style,
              aiAssetId: 'asset-1',
              imageUrl: 'http://localhost:3000/uploads/ai-assets/test.jpg',
            },
            content: {
              ...defaultBackground.content,
              aiAssetId: 'asset-1',
              imageUrl: 'http://localhost:3000/uploads/ai-assets/test.jpg',
            },
          },
        ],
      },
      escenario,
    );

    expect(layout.elements[0]).toMatchObject({
      type: 'background',
      zIndex: 0,
      locked: true,
      hidden: false,
      style: {
        aiAssetId: 'asset-1',
        imageUrl: 'http://localhost:3000/uploads/ai-assets/test.jpg',
        backgroundCode: escenario.fondo_codigo,
      },
      content: {
        aiAssetId: 'asset-1',
        imageUrl: 'http://localhost:3000/uploads/ai-assets/test.jpg',
        title: escenario.titulo,
        situacionTexto: escenario.situacion_texto,
      },
    });
  });
});
