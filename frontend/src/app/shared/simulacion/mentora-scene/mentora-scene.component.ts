import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import Phaser from 'phaser';
import { EscenarioActual } from '../../../features/simulacion/models/escenario-actual.model';
import { resolveCanvasHostSize } from './mentora-canvas-layout';
import {
  buildBackgroundFingerprint,
  resolveBackgroundAsset,
} from './mentora-background.mapper';
import {
  MentoraHotspotConfig,
  buildHotspotConfigFingerprint,
  getHotspotConfigsForEscenario,
} from './mentora-hotspot.mapper';

export type AvatarMotion = 'idle' | 'advance' | 'pause' | 'retreat';

export { MENTORA_FALLBACK_HOTSPOT_TOTAL as MENTORA_HOTSPOT_TOTAL } from './mentora-hotspot.mapper';
export {
  getHotspotConfigsForEscenario,
  getHotspotTotalForEscenario,
} from './mentora-hotspot.mapper';
export type { MentoraHotspotConfig } from './mentora-hotspot.mapper';
export {
  MENTORA_BACKGROUND_ASSETS_DIR,
  MENTORA_BACKGROUND_FILE_NAMES,
  resolveBackgroundAsset,
} from './mentora-background.mapper';

export interface MentoraHotspotSelection {
  id: string;
  title: string;
  description: string;
  category: string;
}

type HotspotVisualState = 'pending' | 'hover' | 'explored' | 'important';

const MENTORA_COLORS = {
  deepPurple: 0x2f5d34,
  lavender: 0xcde8b5,
  nightBlue: 0x2f5d34,
  warmWhite: 0xfffcf7,
  accent: 0x7cb342,
  amber: 0xf3c96b,
  amberSoft: 0xffd59a,
  success: 0x7cb342,
};

interface HotspotEntry {
  config: MentoraHotspotConfig;
  container: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Arc;
  core: Phaser.GameObjects.Arc;
  alertAura: Phaser.GameObjects.Arc | null;
  exploredBadge: Phaser.GameObjects.Container;
  pulseTween: Phaser.Tweens.Tween;
  alertTween: Phaser.Tweens.Tween | null;
  explored: boolean;
  visualState: HotspotVisualState;
}

class MentoraSimulationScene extends Phaser.Scene {
  private escenario: EscenarioActual | null = null;
  private avatarMotion: AvatarMotion = 'idle';
  private onHotspotSelected: ((payload: MentoraHotspotSelection) => void) | null = null;

  private avatarContainer!: Phaser.GameObjects.Container;
  private avatarBody!: Phaser.GameObjects.Ellipse;
  private avatarHead!: Phaser.GameObjects.Ellipse;
  private motionIndicator!: Phaser.GameObjects.Arc;
  private idleTween: Phaser.Tweens.Tween | null = null;
  private motionTween: Phaser.Tweens.Tween | null = null;
  private hotspotEntries: HotspotEntry[] = [];
  private hotspotConfigFingerprint = '';
  private backgroundFingerprint = '';
  private backgroundLoadGeneration = 0;
  private backgroundGradient!: Phaser.GameObjects.Graphics;
  private backgroundImage: Phaser.GameObjects.Image | null = null;
  private backgroundScrim!: Phaser.GameObjects.Graphics;
  private titleKickerText!: Phaser.GameObjects.Text;
  private titleText!: Phaser.GameObjects.Text;
  private starSprites: Phaser.GameObjects.Arc[] = [];
  private sceneHotspotScale = 1;
  private sceneAvatarScale = 0.76;

  private readonly baseAvatarX = 0;
  private readonly baseAvatarY = 0;

  constructor() {
    super({ key: 'MentoraSimulationScene' });
  }

  setHotspotSelectedHandler(handler: (payload: MentoraHotspotSelection) => void): void {
    this.onHotspotSelected = handler;
  }

  create(): void {
    this.createBackgroundLayers();
    this.createSceneOverlay();
    this.createAvatar();
    this.applyAvatarMotion(this.avatarMotion, false);
    this.scale.on('resize', this.handleResize, this);
  }

  shutdown(): void {
    this.scale.off('resize', this.handleResize, this);
    this.stopIdleTween();
    this.stopMotionTween();
  }

  updateEscenario(escenario: EscenarioActual | null): void {
    this.escenario = escenario;

    const hotspotFingerprint = buildHotspotConfigFingerprint(escenario);
    if (hotspotFingerprint !== this.hotspotConfigFingerprint) {
      this.rebuildHotspots(getHotspotConfigsForEscenario(escenario));
      this.hotspotConfigFingerprint = hotspotFingerprint;
    }

    const nextBackgroundFingerprint = buildBackgroundFingerprint(escenario);
    if (nextBackgroundFingerprint !== this.backgroundFingerprint) {
      this.updateBackgroundFromEscenario(escenario);
      this.backgroundFingerprint = nextBackgroundFingerprint;
    }

    this.updateOverlayTitle();
  }

  private rebuildHotspots(configs: MentoraHotspotConfig[]): void {
    this.destroyHotspots();
    this.createHotspots(configs);
    this.layoutScene();
  }

  private destroyHotspots(): void {
    this.hotspotEntries.forEach((entry) => {
      this.tweens.killTweensOf([
        entry.glow,
        entry.core,
        entry.exploredBadge,
        entry.container,
        entry.alertAura,
      ]);
      entry.pulseTween.stop();
      entry.alertTween?.stop();
      entry.container.destroy(true);
    });
    this.hotspotEntries = [];
  }

  updateAvatarMotion(motion: AvatarMotion): void {
    if (this.avatarMotion === motion) {
      return;
    }
    this.avatarMotion = motion;
    this.applyAvatarMotion(motion, true);
  }

  private handleResize(): void {
    this.redrawGradientBackground();
    this.redrawBackgroundScrim();
    this.layoutScene();
  }

  private getHotspotHitRadius(important: boolean, hotspotScale: number): number {
    const visualRadius = (important ? 30 : 26) * hotspotScale;
    return Math.max(22, visualRadius);
  }

  private getLayoutMetrics() {
    const { width, height } = this.scale;
    const isMobile = width < 520;
    const isTablet = width < 900;
    const hasRealBackground = Boolean(this.backgroundImage);

    return {
      hotspotScale: isMobile ? 0.74 : isTablet ? 0.86 : 0.94,
      avatarScale: isMobile ? 0.58 : isTablet ? 0.68 : 0.76,
      avatarXRatio: isMobile ? 0.86 : 0.8,
      avatarYRatio: isMobile ? 0.9 : 0.87,
      coverScaleFactor: hasRealBackground ? 0.9 : 1,
      coverFocusY: hasRealBackground ? 0.46 : 0.5,
      titleFontKicker: isMobile ? '12px' : '14px',
      titleFontMain: isMobile ? '15px' : '18px',
    };
  }

  private layoutScene(): void {
    const { width, height } = this.scale;
    const metrics = this.getLayoutMetrics();

    this.sceneHotspotScale = metrics.hotspotScale;
    this.sceneAvatarScale = metrics.avatarScale;

    this.hotspotEntries.forEach((entry) => {
      entry.container.setPosition(
        width * entry.config.xRatio,
        height * entry.config.yRatio,
      );
      this.applyHotspotVisual(entry, entry.visualState);
    });

    if (this.avatarContainer) {
      const avatarX = width * metrics.avatarXRatio + this.baseAvatarX;
      const avatarY = height * metrics.avatarYRatio + this.baseAvatarY;
      this.avatarContainer.setPosition(avatarX, avatarY);
      this.avatarContainer.setScale(metrics.avatarScale);
      this.avatarContainer.setAlpha(0.94);
    }

    if (this.backgroundImage) {
      this.fitBackgroundCover(this.backgroundImage);
    }

    this.titleKickerText?.setPosition(width * 0.05, height * 0.05);
    this.titleText?.setPosition(width * 0.05, height * 0.11);
    this.titleText?.setWordWrapWidth(width * (width < 520 ? 0.72 : 0.55));
    this.titleKickerText?.setFontSize(metrics.titleFontKicker);
    this.titleText?.setFontSize(metrics.titleFontMain);

    const starsVisible = !this.backgroundImage;
    this.starSprites.forEach((star) => star.setVisible(starsVisible));
  }

  private createBackgroundLayers(): void {
    this.backgroundGradient = this.add.graphics().setDepth(0);
    this.backgroundScrim = this.add.graphics().setDepth(2);
    this.redrawGradientBackground();
    this.redrawBackgroundScrim();
  }

  private redrawGradientBackground(): void {
    const { width, height } = this.scale;

    this.backgroundGradient.clear();
    this.backgroundGradient.fillGradientStyle(
      MENTORA_COLORS.nightBlue,
      MENTORA_COLORS.nightBlue,
      MENTORA_COLORS.deepPurple,
      MENTORA_COLORS.deepPurple,
      1,
    );
    this.backgroundGradient.fillRect(0, 0, width, height);

    this.backgroundGradient.fillStyle(MENTORA_COLORS.deepPurple, 0.55);
    this.backgroundGradient.fillEllipse(width * 0.5, height * 0.78, width * 1.1, height * 0.42);

    this.backgroundGradient.fillStyle(MENTORA_COLORS.lavender, 0.18);
    this.backgroundGradient.beginPath();
    this.backgroundGradient.moveTo(width * 0.08, height * 0.92);
    this.backgroundGradient.lineTo(width * 0.92, height * 0.92);
    this.backgroundGradient.lineTo(width * 0.72, height * 0.62);
    this.backgroundGradient.lineTo(width * 0.28, height * 0.62);
    this.backgroundGradient.closePath();
    this.backgroundGradient.fillPath();
  }

  private redrawBackgroundScrim(): void {
    if (!this.backgroundScrim) {
      return;
    }

    const { width, height } = this.scale;
    const hasImage = Boolean(this.backgroundImage?.visible);

    this.backgroundScrim.clear();

    if (hasImage) {
      this.backgroundScrim.fillGradientStyle(
        0x2f5d34,
        0x2f5d34,
        0x2f5d34,
        0x2f5d34,
        0.5,
      );
      this.backgroundScrim.fillRect(0, 0, width, height * 0.3);

      this.backgroundScrim.fillGradientStyle(
        0x2f5d34,
        0x2f5d34,
        0x2f5d34,
        0x2f5d34,
        0.14,
      );
      this.backgroundScrim.fillRect(0, height * 0.3, width, height * 0.34);

      this.backgroundScrim.fillGradientStyle(
        0x2f5d34,
        0x2f5d34,
        0x2f5d34,
        0x2f5d34,
        0.46,
      );
      this.backgroundScrim.fillRect(0, height * 0.64, width, height * 0.36);

      this.backgroundScrim.fillStyle(0x2f5d34, 0.18);
      this.backgroundScrim.fillRect(0, 0, width * 0.12, height);
      this.backgroundScrim.fillRect(width * 0.88, 0, width * 0.12, height);
    } else {
      this.backgroundScrim.fillGradientStyle(
        0x2f5d34,
        0x2f5d34,
        0x2f5d34,
        0x2f5d34,
        0.12,
      );
      this.backgroundScrim.fillRect(0, 0, width, height);
    }
  }

  private createSceneOverlay(): void {
    const { width, height } = this.scale;
    const title = this.escenario?.titulo ?? 'Simulación MENTORA';

    this.titleKickerText = this.add
      .text(width * 0.05, height * 0.05, 'MENTORA · Escena académica', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '14px',
        color: '#faf7f2',
        fontStyle: '600',
        stroke: '#2F5D34',
        strokeThickness: 3,
      })
      .setAlpha(0.9)
      .setDepth(20);

    this.titleText = this.add
      .text(width * 0.05, height * 0.11, title, {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '18px',
        color: '#F1F8E9',
        wordWrap: { width: width * 0.55 },
        stroke: '#2F5D34',
        strokeThickness: 4,
      })
      .setAlpha(0.98)
      .setDepth(20);

    for (let i = 0; i < 14; i += 1) {
      const star = this.add.circle(
        Phaser.Math.Between(12, width - 12),
        Phaser.Math.Between(12, height * 0.45),
        Phaser.Math.Between(1, 2),
        MENTORA_COLORS.warmWhite,
        Phaser.Math.FloatBetween(0.15, 0.55),
      );
      star.setDepth(5);
      this.starSprites.push(star);
      this.tweens.add({
        targets: star,
        alpha: { from: star.alpha, to: star.alpha * 0.35 },
        duration: Phaser.Math.Between(1200, 2600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private updateOverlayTitle(): void {
    if (!this.titleText) {
      return;
    }

    this.titleText.setText(this.escenario?.titulo ?? 'Simulación MENTORA');
  }

  private updateBackgroundFromEscenario(escenario: EscenarioActual | null): void {
    const asset = resolveBackgroundAsset(escenario);
    const loadGeneration = ++this.backgroundLoadGeneration;

    this.removeBackgroundImage(false);

    if (!asset.assetUrl) {
      return;
    }

    const applyTexture = () => {
      if (loadGeneration !== this.backgroundLoadGeneration) {
        return;
      }

      if (!this.textures.exists(asset.textureKey)) {
        return;
      }

      this.showBackgroundImage(asset.textureKey);
    };

    if (this.textures.exists(asset.textureKey)) {
      applyTexture();
      return;
    }

    this.load.once(`filecomplete-image-${asset.textureKey}`, applyTexture);
    this.load.once('loaderror', (file: Phaser.Loader.File) => {
      if (file.key !== asset.textureKey || loadGeneration !== this.backgroundLoadGeneration) {
        return;
      }

      this.removeBackgroundImage();
    });

    this.load.image(asset.textureKey, asset.assetUrl);
    this.load.start();
  }

  private showBackgroundImage(textureKey: string): void {
    const { width, height } = this.scale;

    this.removeBackgroundImage(false);

    this.backgroundImage = this.add
      .image(width / 2, height / 2, textureKey)
      .setDepth(1);
    this.fitBackgroundCover(this.backgroundImage);
    this.redrawBackgroundScrim();
    this.layoutScene();
  }

  private removeBackgroundImage(invalidatePendingLoads = true): void {
    if (invalidatePendingLoads) {
      this.backgroundLoadGeneration += 1;
    }

    if (this.backgroundImage) {
      this.backgroundImage.destroy();
      this.backgroundImage = null;
    }

    this.redrawBackgroundScrim();
  }

  private fitBackgroundCover(image: Phaser.GameObjects.Image): void {
    const { width, height } = this.scale;
    const metrics = this.getLayoutMetrics();
    const frame = image.frame;

    if (!frame.width || !frame.height) {
      return;
    }

    const coverScale = Math.max(width / frame.width, height / frame.height);
    image.setScale(coverScale * metrics.coverScaleFactor);
    image.setPosition(width / 2, height * metrics.coverFocusY);
  }

  private createAvatar(): void {
    const { width, height } = this.scale;

    const metrics = this.getLayoutMetrics();
    this.avatarContainer = this.add.container(
      width * metrics.avatarXRatio,
      height * metrics.avatarYRatio,
    );

    const shadow = this.add.ellipse(0, 28, 44, 11, 0x000000, 0.24);
    this.avatarBody = this.add.ellipse(0, 6, 28, 36, MENTORA_COLORS.accent, 0.9);
    this.avatarHead = this.add.ellipse(0, -20, 19, 19, MENTORA_COLORS.lavender, 0.96);
    const badge = this.add.circle(0, -2, 6, MENTORA_COLORS.warmWhite, 0.82);

    this.motionIndicator = this.add.circle(0, -58, 16, MENTORA_COLORS.warmWhite, 0);
    this.motionIndicator.setStrokeStyle(2, MENTORA_COLORS.lavender, 0);

    const label = this.add
      .text(0, 34, 'Practicante', {
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        fontSize: '10px',
        color: '#faf7f2',
        stroke: '#2F5D34',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 0);

    this.avatarContainer.add([
      shadow,
      this.avatarBody,
      this.avatarHead,
      badge,
      this.motionIndicator,
      label,
    ]);
    this.avatarContainer.setDepth(14);
    this.avatarContainer.setScale(metrics.avatarScale);
    this.avatarContainer.setAlpha(0.94);
  }

  private createHotspots(configs: MentoraHotspotConfig[]): void {
    const { width, height } = this.scale;

    const metrics = this.getLayoutMetrics();
    const hotspotScale = metrics.hotspotScale;
    const glowRadius = (config: MentoraHotspotConfig) =>
      (config.important ? 36 : 30) * hotspotScale;
    const coreRadius = (config: MentoraHotspotConfig) =>
      (config.important ? 21 : 18) * hotspotScale;

    configs.forEach((config) => {
      const container = this.add
        .container(width * config.xRatio, height * config.yRatio)
        .setDepth(12);
      const glow = this.add.circle(
        0,
        0,
        glowRadius(config),
        config.color,
        config.important ? 0.36 : 0.28,
      );
      const core = this.add.circle(0, 0, coreRadius(config), config.color, 0.94);
      core.setStrokeStyle(
        config.important ? 3 : 2,
        MENTORA_COLORS.warmWhite,
        config.important ? 0.88 : 0.72,
      );

      let alertAura: Phaser.GameObjects.Arc | null = null;
      let alertTween: Phaser.Tweens.Tween | null = null;

      if (config.important) {
        alertAura = this.add.circle(0, 0, 42 * hotspotScale, MENTORA_COLORS.amberSoft, 0);
        alertAura.setStrokeStyle(2, MENTORA_COLORS.amberSoft, 0.62);
        alertTween = this.tweens.add({
          targets: alertAura,
          scale: { from: 0.92, to: 1.22 },
          alpha: { from: 0.15, to: 0.42 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }

      const icon = this.add
        .text(0, -2, config.title.split(' ')[0].slice(0, 1), {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: config.important ? '15px' : '14px',
          color: '#102A1D',
          fontStyle: '700',
        })
        .setOrigin(0.5);

      const caption = this.add
        .text(0, 30 * hotspotScale, config.title, {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: width < 520 ? '9px' : '10px',
          color: '#faf7f2',
          align: 'center',
          wordWrap: { width: 104 * hotspotScale },
          stroke: '#2F5D34',
          strokeThickness: 2,
        })
        .setOrigin(0.5, 0);

      const exploredBadge = this.add.container(18, -18);
      const badgeBg = this.add.circle(0, 0, 9, MENTORA_COLORS.success, 0.95);
      const badgeMark = this.add
        .text(0, 0, '✓', {
          fontFamily: 'Segoe UI, system-ui, sans-serif',
          fontSize: '11px',
          color: '#102A1D',
          fontStyle: '700',
        })
        .setOrigin(0.5);
      exploredBadge.add([badgeBg, badgeMark]);
      exploredBadge.setVisible(false);
      exploredBadge.setScale(0.6);

      const layers = alertAura
        ? [alertAura, glow, core, icon, caption, exploredBadge]
        : [glow, core, icon, caption, exploredBadge];
      container.add(layers);
      container.setSize(76 * hotspotScale, 76 * hotspotScale);
      container.setInteractive(
        new Phaser.Geom.Circle(0, 0, this.getHotspotHitRadius(config.important ?? false, hotspotScale)),
        Phaser.Geom.Circle.Contains,
      );

      const pulseTween = this.tweens.add({
        targets: glow,
        scale: { from: 1, to: config.important ? 1.2 : 1.12 },
        alpha: { from: config.important ? 0.3 : 0.22, to: config.important ? 0.52 : 0.38 },
        duration: config.important ? 760 : 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const entry: HotspotEntry = {
        config,
        container,
        glow,
        core,
        alertAura,
        exploredBadge,
        pulseTween,
        alertTween,
        explored: false,
        visualState: config.important ? 'important' : 'pending',
      };

      container.on('pointerover', () => {
        if (!entry.explored) {
          this.applyHotspotVisual(entry, 'hover');
        } else {
          this.applyHotspotVisual(entry, 'hover');
        }
        this.input.setDefaultCursor('pointer');
      });

      container.on('pointerout', () => {
        const restoreState: HotspotVisualState = entry.explored
          ? 'explored'
          : entry.config.important
            ? 'important'
            : 'pending';
        this.applyHotspotVisual(entry, restoreState);
        this.input.setDefaultCursor('default');
      });

      container.on('pointerdown', () => {
        this.tweens.add({
          targets: container,
          scale: this.sceneHotspotScale * 0.94,
          duration: 80,
          yoyo: true,
          ease: 'Quad.easeOut',
        });

        entry.explored = true;
        this.applyHotspotVisual(entry, 'explored');

        this.onHotspotSelected?.({
          id: config.id,
          title: config.title,
          description: config.description,
          category: config.category,
        });
      });

      this.hotspotEntries.push(entry);
      this.applyHotspotVisual(entry, entry.visualState);
    });
  }

  private applyHotspotVisual(entry: HotspotEntry, state: HotspotVisualState): void {
    entry.visualState = state;
    const { config, glow, core, exploredBadge, alertAura, pulseTween, alertTween } = entry;
    const baseScale = this.sceneHotspotScale;

    this.tweens.killTweensOf([glow, core, exploredBadge, entry.container]);
    pulseTween.pause();
    alertTween?.pause();
    core.setAlpha(0.94);

    switch (state) {
      case 'pending':
        entry.container.setScale(baseScale);
        glow.setScale(1);
        core.setScale(1);
        glow.setAlpha(config.important ? 0.36 : 0.28);
        core.setStrokeStyle(2, MENTORA_COLORS.warmWhite, 0.72);
        exploredBadge.setVisible(false);
        alertAura?.setAlpha(0);
        pulseTween.resume();
        break;

      case 'important':
        entry.container.setScale(baseScale * 1.05);
        glow.setScale(1.05);
        core.setScale(1.03);
        glow.setAlpha(0.4);
        core.setStrokeStyle(3, MENTORA_COLORS.amberSoft, 0.88);
        exploredBadge.setVisible(false);
        alertAura?.setAlpha(0.32);
        pulseTween.resume();
        alertTween?.resume();
        break;

      case 'hover':
        this.tweens.add({
          targets: [core, glow],
          scale: config.important ? 1.18 : 1.14,
          duration: 180,
          ease: 'Back.easeOut',
        });
        glow.setAlpha(config.important ? 0.58 : 0.5);
        core.setStrokeStyle(3, MENTORA_COLORS.warmWhite, 0.95);
        if (entry.explored) {
          exploredBadge.setVisible(true);
        }
        if (config.important) {
          alertAura?.setAlpha(0.5);
        }
        break;

      case 'explored':
        entry.container.setScale(baseScale);
        glow.setScale(1);
        core.setScale(1);
        glow.setAlpha(0.18);
        core.setAlpha(0.82);
        core.setStrokeStyle(3, MENTORA_COLORS.success, 0.9);
        exploredBadge.setVisible(true);
        exploredBadge.setScale(1);
        alertAura?.setAlpha(0.12);

        this.tweens.add({
          targets: exploredBadge,
          scale: { from: 0.7, to: 1 },
          duration: 220,
          ease: 'Back.easeOut',
        });

        this.tweens.add({
          targets: glow,
          alpha: { from: 0.18, to: 0.28 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;

      default:
        break;
    }
  }

  private applyAvatarMotion(motion: AvatarMotion, animate: boolean): void {
    this.stopIdleTween();
    this.stopMotionTween();
    this.motionIndicator.setAlpha(0);
    this.motionIndicator.setStrokeStyle(2, MENTORA_COLORS.lavender, 0);

    const { width } = this.scale;
    const metrics = this.getLayoutMetrics();
    const offsetMap: Record<AvatarMotion, number> = {
      idle: 0,
      advance: width * 0.04,
      pause: 0,
      retreat: -width * 0.04,
    };

    const targetX = width * metrics.avatarXRatio + offsetMap[motion];

    if (animate) {
      this.motionTween = this.tweens.add({
        targets: this.avatarContainer,
        x: targetX,
        duration: 520,
        ease: motion === 'retreat' ? 'Back.easeIn' : 'Back.easeOut',
      });
    } else {
      this.avatarContainer.setX(targetX);
    }

    switch (motion) {
      case 'idle':
        this.startIdleTween();
        break;
      case 'advance':
        this.playAdvanceFeedback();
        break;
      case 'pause':
        this.playPauseFeedback();
        break;
      case 'retreat':
        this.playRetreatFeedback();
        break;
      default:
        break;
    }
  }

  private startIdleTween(): void {
    this.idleTween = this.tweens.add({
      targets: this.avatarContainer,
      y: this.avatarContainer.y - 4,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private playAdvanceFeedback(): void {
    this.tweens.add({
      targets: [this.avatarHead, this.avatarBody],
      scaleX: { from: 1, to: 1.06 },
      scaleY: { from: 1, to: 1.06 },
      duration: 240,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    const sparkle = this.add.star(
      this.avatarContainer.x + 20,
      this.avatarContainer.y - 40,
      5,
      4,
      8,
      MENTORA_COLORS.warmWhite,
      0.95,
    );
    this.tweens.add({
      targets: sparkle,
      y: sparkle.y - 18,
      alpha: 0,
      angle: 45,
      duration: 700,
      ease: 'Cubic.easeOut',
      onComplete: () => sparkle.destroy(),
    });
  }

  private playPauseFeedback(): void {
    this.motionIndicator.setAlpha(0.9);
    this.motionIndicator.setStrokeStyle(2, MENTORA_COLORS.lavender, 0.95);
    this.tweens.add({
      targets: this.motionIndicator,
      scale: { from: 0.85, to: 1.1 },
      alpha: { from: 0.9, to: 0.35 },
      duration: 900,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: this.avatarContainer,
      angle: { from: -2, to: 2 },
      duration: 700,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.easeInOut',
      onComplete: () => this.avatarContainer.setAngle(0),
    });
  }

  private playRetreatFeedback(): void {
    this.tweens.add({
      targets: this.avatarContainer,
      angle: { from: 0, to: -4 },
      duration: 180,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.avatarContainer.setAngle(0),
    });

    const alertRing = this.add.circle(
      this.avatarContainer.x,
      this.avatarContainer.y - 30,
      18,
      MENTORA_COLORS.amber,
      0,
    );
    alertRing.setStrokeStyle(2, MENTORA_COLORS.amber, 0.9);
    this.tweens.add({
      targets: alertRing,
      scale: { from: 0.7, to: 1.5 },
      alpha: { from: 0.9, to: 0 },
      duration: 650,
      ease: 'Cubic.easeOut',
      onComplete: () => alertRing.destroy(),
    });
  }

  private stopIdleTween(): void {
    if (this.idleTween) {
      this.idleTween.stop();
      this.idleTween = null;
    }
  }

  private stopMotionTween(): void {
    if (this.motionTween) {
      this.motionTween.stop();
      this.motionTween = null;
    }
  }
}

@Component({
  selector: 'app-mentora-scene',
  standalone: true,
  templateUrl: './mentora-scene.component.html',
  styleUrl: './mentora-scene.component.scss',
})
export class MentoraSceneComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly ngZone = inject(NgZone);

  @ViewChild('gameHost', { static: true })
  private gameHost!: ElementRef<HTMLDivElement>;

  @Input() escenario: EscenarioActual | null = null;
  @Input() avatarMotion: AvatarMotion = 'idle';

  @Output() readonly hotspotSelected = new EventEmitter<MentoraHotspotSelection>();

  private game: Phaser.Game | null = null;
  private phaserScene: MentoraSimulationScene | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private gameBootstrapped = false;

  ngAfterViewInit(): void {
    if (this.gameBootstrapped || this.game) {
      return;
    }

    this.gameBootstrapped = true;
    const host = this.gameHost.nativeElement;
    const { width, height } = resolveCanvasHostSize(host);
    const phaserScene = new MentoraSimulationScene();
    phaserScene.setHotspotSelectedHandler((payload: MentoraHotspotSelection) => {
      this.ngZone.run(() => this.hotspotSelected.emit(payload));
    });
    this.phaserScene = phaserScene;

    this.ngZone.runOutsideAngular(() => {
      this.game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: host,
        width,
        height,
        backgroundColor: '#2F5D34',
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        audio: {
          noAudio: true,
        },
        scene: [phaserScene],
      });
    });

    phaserScene.events.once(Phaser.Scenes.Events.CREATE, () => this.syncSceneState());

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.game) {
        return;
      }
      const { width: nextWidth, height: nextHeight } = resolveCanvasHostSize(host);
      this.game.scale.resize(nextWidth, nextHeight);
    });
    this.resizeObserver.observe(host);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.game) {
      return;
    }

    if (changes['escenario'] || changes['avatarMotion']) {
      this.syncSceneState();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }

    this.phaserScene = null;

    this.gameBootstrapped = false;
  }

  private syncSceneState(): void {
    if (!this.phaserScene) {
      return;
    }

    this.phaserScene.updateEscenario(this.escenario);
    this.phaserScene.updateAvatarMotion(this.avatarMotion);
  }
}
