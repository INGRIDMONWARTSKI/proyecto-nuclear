import {
  normalizeAssetUrl,
  normalizeCasoEditor,
} from './normalize-asset-url.util';

describe('normalizeAssetUrl', () => {
  it('conserva assets estaticos del catalogo', () => {
    expect(normalizeAssetUrl('assets/mentora/editor/fondos/aula.png')).toBe(
      'assets/mentora/editor/fondos/aula.png',
    );
    expect(normalizeAssetUrl('/assets/mentora/editor/personalizadas/escena-1.png')).toBe(
      '/assets/mentora/editor/personalizadas/escena-1.png',
    );
  });

  it('convierte localhost a /uploads', () => {
    expect(
      normalizeAssetUrl('http://localhost:8080/uploads/ai-assets/archivo.jpg'),
    ).toBe('/uploads/ai-assets/archivo.jpg');
  });

  it('normaliza el editor completo al cargar', () => {
    const editor = normalizeCasoEditor({
      id: 'caso-1',
      titulo: 'Caso',
      descripcion: 'Desc',
      objetivoAprendizaje: 'Obj',
      tiempoMaximoMinutos: 30,
      autorDocenteId: 'doc-1',
      estado: 'draft',
      isActive: true,
      publishedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      escenarios: [
        {
          id: 'esc-1',
          orden: 1,
          titulo: 'Escena',
          situacionTexto: 'Situacion',
          fondoCodigo: 'aula',
          isFinal: false,
          aiBackgroundUrl: 'http://localhost:8080/uploads/ai-assets/bg.jpg',
          layout: {
            version: 1,
            elements: [
              {
                id: 'bg-1',
                type: 'background',
                position: { x: 50, y: 50 },
                size: { width: 1000, height: 560 },
                rotation: 0,
                zIndex: 0,
                locked: true,
                hidden: false,
                style: {
                  imageUrl: 'http://localhost:8080/uploads/ai-assets/bg.jpg',
                },
                content: {
                  imageUrl: 'http://localhost:8080/uploads/ai-assets/bg.jpg',
                },
                bindings: {},
              },
            ],
          },
          pregunta: null,
          preguntas: [],
        },
      ],
      conexiones: [],
      catalogos: {
        backgrounds: [],
        elementTypes: [],
      },
      validationErrors: [],
    });

    expect(editor.escenarios[0].aiBackgroundUrl).toBe('/uploads/ai-assets/bg.jpg');
    expect(editor.escenarios[0].layout.elements[0].content['imageUrl']).toBe(
      '/uploads/ai-assets/bg.jpg',
    );
  });
});
