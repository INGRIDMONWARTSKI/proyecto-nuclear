import { Injectable } from '@nestjs/common';
import {
  AI_ASSET_STYLES,
  type AiAssetStyle,
} from './dto/generate-ai-asset.dto';
import type { AiAssetType } from './entities/ai-asset.entity';

const STYLE_HINTS: Record<AiAssetStyle, string> = {
  editorial_sereno:
    'editorial digital illustration, soft lighting, balanced composition, polished academic look',
  acuarela_suave:
    'soft watercolor illustration, delicate brush texture, calm atmosphere, gentle edges',
  minimal_calido:
    'minimal warm digital illustration, clean shapes, reduced clutter, cozy professional ambiance',
};

@Injectable()
export class PromptBuilderService {
  build(params: {
    tipo: AiAssetType;
    descripcion: string;
    estilo: AiAssetStyle;
    escenarioTitulo: string;
    situacionTexto: string;
  }): string {
    const estilo = AI_ASSET_STYLES.includes(params.estilo) ? params.estilo : AI_ASSET_STYLES[0];
    const rules = [
      'educational psychology simulator asset',
      'MENTORA SIEP visual identity',
      'soft green and cream color palette',
      'clean digital illustration',
      'calm and respectful tone',
      'no text',
      'no watermark',
      'no logos',
      STYLE_HINTS[estilo],
      this.typeRules(params.tipo),
      `scene title reference: ${params.escenarioTitulo}`,
      `pedagogical context: ${params.situacionTexto}`,
      `teacher request: ${params.descripcion.trim()}`,
    ];

    return rules.join(', ');
  }

  private typeRules(tipo: AiAssetType): string {
    switch (tipo) {
      case 'FONDO':
        return 'wide background scene, 16:9, no characters in foreground, environment-focused composition';
      case 'PERSONAJE':
        return 'single character, full body, neutral background, expressive but respectful';
      case 'OBJETO':
        return 'single object, centered, simple background';
      default:
        return 'complete educational scene, cohesive composition, respectful body language';
    }
  }
}
