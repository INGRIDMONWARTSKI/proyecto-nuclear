export type GuideChoice = 'femenina' | 'masculina';
export type VideoType = 'intro' | 'transicion' | 'cierre';

const LS_GUIDE_KEY = 'mentora.guideChoice';

export function getGuideChoice(): GuideChoice {
  return (localStorage.getItem(LS_GUIDE_KEY) as GuideChoice | null) ?? 'femenina';
}

export function setGuideChoice(choice: GuideChoice): void {
  localStorage.setItem(LS_GUIDE_KEY, choice);
}

export function hasGuideChoice(): boolean {
  return !!localStorage.getItem(LS_GUIDE_KEY);
}

export function clearGuideChoice(): void {
  localStorage.removeItem(LS_GUIDE_KEY);
}

export function getVideoSrc(type: VideoType): string {
  const guide = getGuideChoice();
  return `assets/videos/mentora/guia-${guide}/${type}.mp4`;
}

export function isIntroWatched(sesionId: string): boolean {
  return localStorage.getItem(`mentora.introWatched:${sesionId}`) === 'true';
}

export function markIntroWatched(sesionId: string): void {
  localStorage.setItem(`mentora.introWatched:${sesionId}`, 'true');
}

export function isClosingWatched(sesionId: string): boolean {
  return localStorage.getItem(`mentora.closingWatched:${sesionId}`) === 'true';
}

export function markClosingWatched(sesionId: string): void {
  localStorage.setItem(`mentora.closingWatched:${sesionId}`, 'true');
}
