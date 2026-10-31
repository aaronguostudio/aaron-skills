// WalkthroughVideo: turns a capture folder (a screen recording plus steps.json) into a captioned
// walkthrough with a drawn cursor and fast-forwarded waits, silent or with one AI-narrated clip per step.
//
// Render with the folder as the public dir, so the composition never sees a path:
//   npx remotion render src/projects/walkthrough-video/index.tsx WalkthroughVideo <run>/walkthrough.mp4 \
//     --public-dir=<run> --codec=h264 --muted
// Prefer ../../../scripts/walkthrough/render-walkthrough.ts, which validates first, writes chapters.txt
// and, with --narrate, makes the voice clips and passes them in as props.
import React from "react";
import {ContextCalloutView} from "./ContextCallout";
import {validateCallouts, validateCalloutTiming, type ContextCallouts} from "./callouts";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Freeze,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  registerRoot,
  staticFile,
  useCurrentFrame,
  type CalculateMetadataFunction,
} from "remotion";
import {
  BRAND_STING_LEAD_MS,
  CAPTION_BAND,
  FPS,
  buildTimeline,
  calibrate,
  cursorAt,
  highlightsAt,
  readingMs,
  stepAtFrame,
  validateCapture,
  type Capture,
  type CursorState,
  type Highlight,
  type Step,
  type Timeline,
} from "./timeline";
import { BrandCard, BrandMark } from "./brand/BrandCard";
import { validateBrand, type Brand } from "./brand/model";
import {PresentationCard, PresentationCaption, PresentationAnnotation, PresentationBackdrop} from './presentation/Presentation';
import {validatePresentation, type Presentation} from './presentation/model';
import {cameraAt, cameraMoves, CAMERA_DEFAULTS} from './presentation/camera';
import {annotationAt, layoutGeometry, resolveLayout} from './presentation/layout';
import {alphaColor, paletteFor} from './presentation/theme';
import {masksAt} from './timeline';

const C = {
  bg: "#11151c",
  band: "#161b24",
  ink: "#f2f4f8",
  muted: "#9aa3b4",
  accent: "#3d7bf0",
  // Outlines and the pointer's halo: a warm amber that stands out on most app palettes.
  mark: "#e3a900",
  sans: "-apple-system, 'Helvetica Neue', Arial, sans-serif",
};

// A voice clip in the capture folder (written by the render CLI): over a step, or over the title
// or end card.
type Clip = { at: number | "intro" | "outro"; file: string; ms: number; text?:string };

// calibrationMs comes from the render CLI, which measured it from the capture's sync flash;
// stepMinMs and narration come from it too when the walkthrough is narrated.
type Props = {
  callouts?: ContextCallouts;
  capture: Capture | null;
  steps: Step[];
  timeline: Timeline | null;
  calibrationMs?: number;
  stepMinMs?: number[];
  titleMs?: number;
  endMs?: number;
  narration?: Clip[];
  // An identity for the opening and closing cards and the caption band's corner. Without one the
  // walkthrough keeps its plain cards.
  branding?: Brand;
  presentation?: Presentation;
  narrationKind?: 'ai' | 'imported';
  narrationNotice?: boolean;
};

const fade = (frame: number, total: number) =>
  interpolate(frame, [0, 10, total - 10, total], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const Card: React.FC<{ total: number; children: React.ReactNode }> = ({ total, children }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: "center", justifyContent: "center", fontFamily: C.sans }}>
      <div style={{ opacity: fade(frame, total), textAlign: "center", maxWidth: "75%" }}>{children}</div>
    </AbsoluteFill>
  );
};

const TitleCard: React.FC<{ capture: Capture; total: number; narrated: boolean; imported?: boolean; showNotice?: boolean }> = ({ capture, total, narrated, imported, showNotice = false }) => (
  <Card total={total}>
    <div style={{ color: C.ink, fontSize: 64, fontWeight: 650, lineHeight: 1.15 }}>{capture.title}</div>
    {capture.subtitle ? <div style={{ color: C.muted, fontSize: 30, marginTop: 22 }}>{capture.subtitle}</div> : null}
    {showNotice ? <div style={{ color: C.muted, fontSize: 20, marginTop: 40, letterSpacing: 1 }}>
      Recorded {capture.startedAt.slice(0, 10)} · {narrated ? imported ? 'Imported narration' : "AI narration" : "no audio"}
    </div> : null}
  </Card>
);

const EndCard: React.FC<{ capture: Capture; total: number }> = ({ capture, total }) => (
  <Card total={total}>
    <div style={{ color: C.muted, fontSize: 26, letterSpacing: 2, textTransform: "uppercase" }}>End of walkthrough</div>
    <div style={{ color: C.ink, fontSize: 44, marginTop: 18 }}>{capture.title}</div>
  </Card>
);

// A rounded amber outline with a faint fill. Its stroke draws itself on as `draw` goes 0 → 1.
const Highlights: React.FC<{ marks: Highlight[]; w: number; h: number; color?: string; themed?:boolean }> = ({ marks, w, h, color,themed }) =>
  marks.length === 0 ? null : (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
      {marks.map(({ kind, box, draw, opacity }, i) => (
        <g key={i} opacity={opacity}>
          <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={8} fill={themed&&color?alphaColor(color,kind==='click'?.12:.09):kind === "click" ? "rgba(255, 206, 55, 0.12)" : "rgba(255, 214, 77, 0.09)"} />
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            rx={8}
            fill="none"
            stroke={color ?? C.mark}
            strokeWidth={3.5}
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={1 - draw}
            style={{ filter: "drop-shadow(0 0 2px #ffffff)" }}
          />
        </g>
      ))}
    </svg>
  );

const Cursor: React.FC<{ state: CursorState; color?:string }> = ({ state,color }) => {
  if (!state.visible) return null;
  const ring = state.ripple;
  return (
    <>
      {/* A soft halo, so the eye finds the pointer at once. */}
      <div
        style={{
          position: "absolute",
          left: state.x - 25,
          top: state.y - 25,
          width: 50,
          height: 50,
          borderRadius: "50%",
          background: color?alphaColor(color,.22):"rgba(255, 218, 92, 0.22)",
          border: `2px solid ${color?alphaColor(color,.7):'rgba(227, 169, 0, 0.7)'}`,
          boxSizing: "border-box",
        }}
      />
      {ring !== null ? (
        <div
          style={{
            position: "absolute",
            left: state.x,
            top: state.y,
            width: 2 * interpolate(ring, [0, 1], [10, 38]),
            height: 2 * interpolate(ring, [0, 1], [10, 38]),
            marginLeft: -interpolate(ring, [0, 1], [10, 38]),
            marginTop: -interpolate(ring, [0, 1], [10, 38]),
            borderRadius: "50%",
            border: `4px solid ${color??C.accent}`,
            opacity: 1 - ring,
          }}
        />
      ) : null}
      <svg width={28} height={36} viewBox="0 0 28 36" style={{ position: "absolute", left: state.x - 3, top: state.y - 2, filter: "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.55))" }}>
        <path d="M3 2 L3 29 L10 22.5 L14.5 33 L19 31 L14.6 20.8 L24 20.8 Z" fill="#ffffff" stroke="#111111" strokeWidth={2} strokeLinejoin="round" />
      </svg>
    </>
  );
};

const CaptionBand: React.FC<{
  top: number;
  width: number;
  caption: string;
  position: string;
  narrated: boolean;
  brand?: Brand;
}> = ({ top, width, caption, position, narrated, brand }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top,
      width,
      height: CAPTION_BAND,
      background: C.band,
      display: "flex",
      alignItems: "center",
      gap: 24,
      padding: "0 40px",
      boxSizing: "border-box",
      fontFamily: C.sans,
    }}
  >
    <div style={{ color: C.muted, fontSize: 22, minWidth: 64, fontVariantNumeric: "tabular-nums" }}>{position}</div>
    <div style={{ color: C.ink, fontSize: 34, lineHeight: 1.2, flex: 1 }}>{caption}</div>
    {/* Process labels are shown only when explicitly requested. */}
    {brand ? (
      <div style={{ color: C.ink, display: "flex", alignItems: "center", opacity: 0.9 }}>
        <BrandMark brand={brand} size={34} />
      </div>
    ) : narrated ? (
      <div style={{ color: C.muted, fontSize: 18, letterSpacing: 1, whiteSpace: "nowrap" }}>AI narration</div>
    ) : null}
  </div>
);

const SpeedBadge: React.FC<{ speed: number; right: number }> = ({ speed, right }) => (
  <div
    style={{
      position: "absolute",
      top: 24,
      right,
      padding: "8px 16px",
      borderRadius: 999,
      background: "rgba(17, 21, 28, 0.82)",
      color: C.ink,
      fontFamily: C.sans,
      fontSize: 24,
      fontWeight: 600,
    }}
  >
    ▶▶ {speed}× faster
  </div>
);

export const WalkthroughVideo: React.FC<Props> = ({ capture, steps, timeline, calibrationMs = 0, narration = [], branding, presentation, narrationKind, narrationNotice = false, callouts }) => {
  const frame = useCurrentFrame();
  if (!capture || !timeline) return <AbsoluteFill style={{ background: C.bg }} />;
  const { w, h } = capture.viewport;
  const geometry=layoutGeometry(capture.viewport,presentation);
  const stage=presentation?.layout?resolveLayout(presentation.layout).stageStyle:undefined;
  // The camera only moves toward geometry the capture asserted; see presentation/camera.ts.
  const camera=cameraAt(cameraMoves(timeline,steps,capture.viewport,{...CAMERA_DEFAULTS,...presentation?.camera}),frame,capture.viewport);
  // Two layers, so the whole frame keeps its place while the picture moves inside
  // it: the window is fixed to the layout's screen region and clips, and the inner
  // capture-space transform carries the video, the stills and every evidence
  // overlay together. A camera move cannot slide an outline off its field.
  const windowStyle:React.CSSProperties={position:'absolute',left:geometry.screen.x,top:geometry.screen.y,width:w*geometry.screen.scale,height:h*geometry.screen.scale,overflow:'hidden'};
  const captureStyle:React.CSSProperties={position:'absolute',left:0,top:0,width:w,height:h,transform:`scale(${geometry.screen.scale*camera.scale}) translate(${-camera.x}px, ${-camera.y}px)`,transformOrigin:'top left'};
  const videoEnd = timeline.titleFrames + timeline.videoFrames;
  const inVideo = frame >= timeline.titleFrames && frame < videoEnd;
  const segment = stepAtFrame(timeline, frame);
  // During a gap between steps, show the step that comes next.
  const stepIndex =
    segment?.step ?? timeline.segments.find((s) => s.fromFrame >= (segment?.fromFrame ?? 0) && s.step !== null)?.step ?? null;
  const step = stepIndex !== null ? steps[stepIndex] : undefined;
  const narrated = narration.length > 0;
  const aiNarrated = narrated && narrationKind !== 'imported';
  const noticeRequested = narrationNotice || branding?.aiNotice === true;
  const aiNotice = aiNarrated && noticeRequested;
  const annotation=annotationAt(timeline,narration,stepIndex,frame,step?.caption??'');

  return (
    <AbsoluteFill style={{ background: presentation?.version===2?paletteFor(presentation,'body').background:C.bg }}>
      {presentation?<PresentationBackdrop p={presentation}/>:null}
      {timeline.titleFrames > 0 ? <Sequence durationInFrames={timeline.titleFrames}>
        {presentation ? <PresentationCard p={presentation} total={timeline.titleFrames} narrated={aiNotice}/> : branding ? (
          <BrandCard brand={branding} total={timeline.titleFrames} narrated={aiNarrated} notice={noticeRequested} />
        ) : (
          <TitleCard capture={capture} total={timeline.titleFrames} narrated={narrated} imported={narrationKind === 'imported'} showNotice={noticeRequested} />
        )}
      </Sequence> : null}
      {timeline.segments.map((s) => (
        <Sequence key={`${s.fromFrame}`} from={s.fromFrame} durationInFrames={s.frames}>
          <div style={{...windowStyle,...(stage?{boxShadow:stage==='paper'?'0 12px 45px #1d29251c':'0 20px 80px #10131f40',outline:'1px solid #ffffff30'}:{})}}><div style={captureStyle}>
            {s.still ? (
              <Img src={staticFile(s.still)} style={{ width: w, height: h }} />
            ) : s.freeze ? (
              // A short step held on its hold frame while its caption is read.
              <Freeze frame={0}>
                <OffthreadVideo
                  src={staticFile("video.webm")}
                  trimBefore={Math.round((s.srcStartMs * FPS) / 1000)}
                  muted
                  style={{ width: w, height: h }}
                />
              </Freeze>
            ) : (
              <OffthreadVideo
                src={staticFile("video.webm")}
                trimBefore={Math.round((s.srcStartMs * FPS) / 1000)}
                playbackRate={s.speed}
                muted
                style={{ width: w, height: h }}
              />
            )}
          </div></div>
        </Sequence>
      ))}
      {narration.map((clip) => {
        // A step's clip starts with its first segment, a card's with the card; each lasts at least
        // as long as its clip.
        const from =
          clip.at === "intro"
            ? // A brand's sting opens the card on its own; the line comes in over its decay.
              branding?.sound || presentation?.intro.sound
              ? Math.round((BRAND_STING_LEAD_MS * FPS) / 1000)
              : 0
            : clip.at === "outro"
              ? videoEnd
              : timeline.segments.find((s) => s.step === clip.at)?.fromFrame;
        return from === undefined ? null : (
          <Sequence key={clip.file} from={from}>
            <Audio src={staticFile(clip.file)} />
          </Sequence>
        );
      })}
      {inVideo ? (
        <>
          <div style={windowStyle}>
          {/* Chrome, not evidence: the badge keeps its corner while the camera moves. */}
          {segment && segment.speed > 1 ? <SpeedBadge speed={segment.speed} right={24} /> : null}
          <div style={captureStyle}>
          <Highlights marks={highlightsAt(timeline, steps, capture.viewport, frame)} w={w} h={h} color={presentation?.body.highlightColor} themed={presentation?.version===2}/>
          <Cursor state={cursorAt(timeline, steps, capture.viewport, frame)} color={presentation?.version===2?paletteFor(presentation,'body').cursor:undefined} />
          {callouts?.callouts.map((c,i)=>{const n=steps.findIndex(s=>s.id===c.step);const first=timeline.segments.find(s=>s.step===n);if(!first || stepIndex!==n)return null;const ms=(frame-first.fromFrame)*1000/FPS;return ms>=c.startMs&&ms<c.endMs?<ContextCalloutView key={i} callout={c} ms={ms}/>:null;})}
          {masksAt(timeline, capture.masks ?? [], frame, calibrationMs).map((b,i) =>
            <div key={i} style={{position:'absolute',left:b.x,top:b.y,width:b.w,height:b.h,background:'#111827',pointerEvents:'none'}} />)}
          </div></div>
          {presentation&&!geometry.legacy?<PresentationAnnotation p={presentation} box={geometry.annotation} caption={step?.caption??''} transcript={annotation.text} position={stepIndex!==null?`${stepIndex+1}/${steps.length}`:''} progress={annotation.progress} narrated={aiNotice}/>:presentation ? <PresentationCaption p={presentation} top={h} width={w} caption={step?.caption ?? ''} position={stepIndex !== null ? `${stepIndex+1}/${steps.length}` : ''} narrated={aiNotice}/> : <CaptionBand
            top={h}
            width={w}
            caption={step?.caption ?? ""}
            position={stepIndex !== null ? `${stepIndex + 1}/${steps.length}` : ""}
            narrated={aiNotice}
            brand={branding}
          />}
        </>
      ) : null}
      {timeline.endFrames > 0 ? <Sequence from={videoEnd} durationInFrames={timeline.endFrames}>
        {presentation ? <PresentationCard p={presentation} closing total={timeline.endFrames}/> : branding ? (
          <BrandCard brand={branding} total={timeline.endFrames} closing />
        ) : (
          <EndCard capture={capture} total={timeline.endFrames} />
        )}
      </Sequence> : null}
    </AbsoluteFill>
  );
};

const readJson = async <T,>(name: string): Promise<T> => {
  const response = await fetch(staticFile(name));
  if (!response.ok) throw new Error(`The capture folder has no ${name}`);
  return (await response.json()) as T;
};

// Everything comes from the capture folder at render time, and a capture that is not valid
// (for example a failed walk) never renders.
const calculateMetadata: CalculateMetadataFunction<Props> = async ({ props }) => {
  const capture = await readJson<Capture>("capture.json");
  const raw = await readJson<Step[]>("steps.json");
  if (props.branding) validateBrand(props.branding);
  if (props.presentation) validatePresentation(props.presentation);
  const problems = validateCapture(capture, raw);
  if (problems.length) throw new Error(`Capture refused:\n- ${problems.join("\n- ")}`);
  const steps = calibrate(raw, props.calibrationMs ?? capture.calibrationMs ?? 0);
  const timeline = buildTimeline(steps, {
    minStepMs: (step, i) => props.stepMinMs?.[i] ?? readingMs(step.caption),
    titleMs: props.titleMs,
    endMs: props.endMs,
    ...(props.presentation ? {titleBaseMs:props.presentation.intro.enabled?props.presentation.intro.durationMs:0, endBaseMs:props.presentation.outro.enabled?props.presentation.outro.durationMs:0} : {}),
  });
  if(props.callouts){validateCallouts(props.callouts,steps,capture.viewport);validateCalloutTiming(props.callouts,steps,timeline);}
  const geometry=layoutGeometry(capture.viewport,props.presentation);
  return {
    durationInFrames: timeline.durationInFrames,
    fps: FPS,
    width: geometry.width,
    height: geometry.height,
    props: { callouts:props.callouts, capture, steps, timeline, calibrationMs:props.calibrationMs ?? capture.calibrationMs ?? 0, narration: props.narration ?? [], branding: props.branding, presentation:props.presentation, narrationKind:props.narrationKind, narrationNotice:props.narrationNotice },
  };
};

const Cover: React.FC<Props> = ({presentation}) => presentation ? <PresentationCard p={presentation} cover/> : <AbsoluteFill style={{background:C.bg}}/>;
const calculateCoverMetadata:CalculateMetadataFunction<Props>=async args=>{
  const metadata=await calculateMetadata(args);
  return args.props.presentation?.cover?{...metadata,width:1600,height:900}:metadata;
};
const standaloneCoverMetadata:CalculateMetadataFunction<Props>=async({props})=>{
  if(!props.presentation?.cover) throw Error('A standalone cover needs a library preset');
  validatePresentation(props.presentation);
  return {props,width:1600,height:900,durationInFrames:1};
};

const Root: React.FC = () => (<>
  <Composition
    id="WalkthroughVideo"
    component={WalkthroughVideo}
    durationInFrames={FPS}
    fps={FPS}
    width={1440}
    height={900 + CAPTION_BAND}
    defaultProps={{ capture: null, steps: [], timeline: null, narration: [] } as Props}
    calculateMetadata={calculateMetadata}
  />
  <Composition id="WalkthroughCover" component={Cover} durationInFrames={FPS} fps={FPS} width={1440} height={996}
    defaultProps={{capture:null,steps:[],timeline:null,narration:[]} as Props} calculateMetadata={calculateCoverMetadata}/>
  <Composition id="StandaloneCover" component={Cover} durationInFrames={1} fps={FPS} width={1600} height={900}
    defaultProps={{capture:null,steps:[],timeline:null,narration:[]} as Props} calculateMetadata={standaloneCoverMetadata}/>
  </>
);

registerRoot(Root);
