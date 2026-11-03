// Aaron Skills owns this boundary. Providers receive an already checked scene
// and write one artifact; capture, presentation and narration stay upstream.
import type {Props} from './src/projects/walkthrough-video';

export type FrameConfig = {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

export type RenderRequest = {
  run: string;
  props: Partial<Props>;
  out: string;
  mode: 'video' | 'preview' | 'cover';
  frame?: number;
};

export type PreparedComposition = {props: Props; config: FrameConfig};
export type RendererInfo = Readonly<{id: string; version: string; contract: 1}>;
export type RenderResult = FrameConfig & {renderer: RendererInfo};

export interface RenderBackend {
  readonly info: RendererInfo;
  render(request: RenderRequest, scene: PreparedComposition): Promise<void>;
}
