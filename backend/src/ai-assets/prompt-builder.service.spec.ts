import { PromptBuilderService } from './prompt-builder.service';

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  beforeEach(() => {
    service = new PromptBuilderService();
  });

  it('builds a fondo prompt with MENTORA rules', () => {
    const prompt = service.build({
      tipo: 'FONDO',
      visibleType: 'background',
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

  it('builds a character prompt with simple background guidance', () => {
    const prompt = service.build({
      tipo: 'PERSONAJE',
      visibleType: 'character',
      descripcion: 'Docente orientador con postura empatica.',
      estilo: 'editorial_sereno',
      escenarioTitulo: 'Acompanamiento escolar',
      situacionTexto: 'Se acompana a un estudiante con ansiedad.',
    });

    expect(prompt).toContain('single character for an educational psychology simulator');
    expect(prompt).toContain('simple background');
  });

  it('builds an object prompt for isolated items', () => {
    const prompt = service.build({
      tipo: 'OBJETO',
      visibleType: 'object',
      descripcion: 'Mochila azul en el piso.',
      estilo: 'minimal_calido',
      escenarioTitulo: 'Salon',
      situacionTexto: 'Escena en aula.',
    });

    expect(prompt).toContain('single isolated object');
    expect(prompt).toContain('centered composition');
  });

  it('builds a symbol prompt when visible type is symbol', () => {
    const prompt = service.build({
      tipo: 'OBJETO',
      visibleType: 'symbol',
      descripcion: 'Burbuja de dialogo vacia.',
      estilo: 'acuarela_suave',
      escenarioTitulo: 'Dialogo interno',
      situacionTexto: 'Escena simbolica.',
    });

    expect(prompt).toContain('simple emotional symbolic visual element');
    expect(prompt).toContain('clean educational icon style');
  });
});
