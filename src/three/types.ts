/* Type-only contract between React and the lazily loaded WebGL scene (keeps three.js out of the main chunk). */

export type AnchorId = 'lesion' | 'fid-a' | 'fid-b' | 'fid-c'

export interface SceneLabel {
  id: AnchorId
  el: HTMLElement
}

export interface BrainSceneOptions {
  quality: 'high' | 'low'
  reducedMotion: boolean
  labels: SceneLabel[]
  onReady?: () => void
  onFail?: () => void
}

export interface BrainSceneHandle {
  /** 0 — hero fully visible, 1 — hero scrolled away */
  setScroll(progress: number): void
  dispose(): void
}
