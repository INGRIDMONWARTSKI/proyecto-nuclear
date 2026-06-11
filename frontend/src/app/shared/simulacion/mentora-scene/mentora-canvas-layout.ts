/** Debe coincidir con los aspect-ratio de mentora-scene.component.scss */
export const CANVAS_LAYOUT_BREAKPOINTS = {
  mobileMax: 640,
  tabletMax: 900,
} as const;

export function resolveCanvasHostHeight(width: number): number {
  if (width <= CANVAS_LAYOUT_BREAKPOINTS.mobileMax) {
    return Math.round((width * 3) / 4);
  }

  if (width <= CANVAS_LAYOUT_BREAKPOINTS.tabletMax) {
    return Math.round((width * 11) / 16);
  }

  return Math.round((width * 10) / 16);
}

export function resolveCanvasHostSize(host: HTMLElement): { width: number; height: number } {
  const width = host.clientWidth || 800;
  const height = host.clientHeight > 0 ? host.clientHeight : resolveCanvasHostHeight(width);

  return { width, height };
}
