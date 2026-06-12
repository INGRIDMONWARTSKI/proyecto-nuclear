import { Injectable } from '@nestjs/common';
import {
  AI_ASSET_STYLES,
  type AiAssetStyle,
} from './dto/generate-ai-asset.dto';
import type { AiAssetType, AiAssetVisibleType } from './entities/ai-asset.entity';

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
    visibleType?: AiAssetVisibleType;
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
      this.typeRules(params.tipo, params.visibleType),
      `scene title reference: ${params.escenarioTitulo}`,
      `pedagogical context: ${params.situacionTexto}`,
      `teacher request: ${params.descripcion.trim()}`,
    ];

    return rules.join(', ');
  }

  private typeRules(tipo: AiAssetType, visibleType?: AiAssetVisibleType): string {
    switch (tipo) {
      case 'FONDO':
        return 'wide background scene, 16:9, horizontal composition, no main characters, environment-focused composition, suitable as a visual novel background';
      case 'PERSONAJE':
        return 'single character for an educational psychology simulator, full body or medium shot, centered composition, simple background, expressive but respectful';
      case 'OBJETO':
        return visibleType === 'symbol'
          ? 'simple emotional symbolic visual element, clean educational icon style, centered composition, simple background'
          : 'single isolated object for an educational visual editor, centered composition, simple background';
      default:
        return 'complete educational scene, cohesive composition, respectful body language';
    }
  }
}
