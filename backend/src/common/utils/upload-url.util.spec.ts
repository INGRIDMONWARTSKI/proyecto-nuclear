import { normalizeUploadUrl } from './upload-url.util';

describe('normalizeUploadUrl', () => {
  it('conserva rutas relativas de uploads', () => {
    expect(normalizeUploadUrl('/uploads/ai-assets/test.jpg')).toBe(
      '/uploads/ai-assets/test.jpg',
    );
  });

  it('convierte localhost a ruta relativa', () => {
    expect(
      normalizeUploadUrl('http://localhost:8080/uploads/docente-assets/archivo.jpeg'),
    ).toBe('/uploads/docente-assets/archivo.jpeg');
  });

  it('convierte dominio de produccion a ruta relativa', () => {
    expect(
      normalizeUploadUrl(
        'https://proyecto-nuclear-production.up.railway.app/uploads/ai-assets/x.jpg',
      ),
    ).toBe('/uploads/ai-assets/x.jpg');
  });
});
