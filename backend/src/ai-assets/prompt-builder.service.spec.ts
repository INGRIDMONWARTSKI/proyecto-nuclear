import { PromptBuilderService } from './prompt-builder.service';

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  beforeEach(() => {
    service = new PromptBuilderService();
  });

  it('builds a fondo prompt with MENTORA rules', () => {
    const prompt = service.build({
      tipo: 'FONDO',
      descripcion: 'Consultorio universitario de orientacion psicologica con luz natural.',
      estilo: 'editorial_sereno',
      escenarioTitulo: 'Primera entrevista',
      situacionTexto: 'El estudiante escucha a una paciente con ansiedad leve.',
    });

    expect(prompt).toContain('educational psychology simulator asset');
    expect(prompt).toContain('soft green and cream color palette');
    expect(prompt).toContain('wide background scene');
    expect(prompt).toContain('16:9');
    expect(prompt).toContain('no watermark');
  });
});
