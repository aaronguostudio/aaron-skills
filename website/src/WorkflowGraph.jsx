import { useId, useRef, useState } from "react";
import { useInView } from "motion/react";
import { useMotionPreference } from "./useMotionPreference";
import * as m from "motion/react-m";

const steps = [
  { name: "Shape", en: "Make the intent concrete", zh: "让意图变具体", y: 20 },
  { name: "Build", en: "Make it usable", zh: "把成果做到能用", y: 116 },
  { name: "Verify", en: "Check the actual result", zh: "检查实际结果", y: 212 },
  { name: "Demonstrate", en: "Make the work clear", zh: "把成果讲明白", y: 308 },
  { name: "Deliver", en: "Make the next step useful", zh: "让下一步清楚可行", y: 404 },
];

function StageIcon({ index }) {
  const props = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  if (index === 0) return <g {...props}><path d="M-9-8H4L9-3V9H-9Z M3-8V-2H9 M-5 2H4 M-5 6H1" /></g>;
  if (index === 1) return <g {...props}><rect x="-10" y="-8" width="20" height="16" rx="2" /><path d="M-10-2H10 M-3-2V8" /></g>;
  if (index === 2) return <g {...props}><circle r="10" /><path d="M-5 0L-1 4L6-4" /></g>;
  if (index === 3) return <g {...props}><rect x="-11" y="-8" width="22" height="16" rx="3" /><path d="M-3-4L4 0L-3 4Z" /></g>;
  return <g {...props}><path d="M-10-9H3L8-4V10H-10Z M2-9V-3H8 M-5 2H2 M-5 6H-1 M7 3H14 M11 0L14 3L11 6" /></g>;
}

function Reveal({ children, delay, reduced, visible, className }) {
  return <m.g
    className={className}
    initial={reduced ? false : { opacity: 0.2, y: 6 }}
    animate={{ opacity: visible || reduced ? 1 : 0.2, y: visible || reduced ? 0 : 6 }}
    transition={{ duration: reduced ? 0 : 0.28, delay: reduced ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    whileHover={reduced ? undefined : { y: -2, transition: { duration: 0.18, delay: 0 } }}
  >{children}</m.g>;
}

function Connector({ d, delay, reduced, visible, marker }) {
  return <>
    <path className="graph-route-track" d={d} />
    <m.path
      className="graph-route"
      d={d}
      markerEnd={`url(#${marker})`}
      initial={reduced ? false : { pathLength: 0, opacity: 0 }}
      animate={{ pathLength: visible || reduced ? 1 : 0, opacity: visible || reduced ? 1 : 0 }}
      transition={{ duration: reduced ? 0 : 0.32, delay: reduced ? 0 : delay, ease: "easeOut" }}
    />
  </>;
}

export function WorkflowGraph({ language }) {
  const reduced = useMotionPreference();
  const figure = useRef(null);
  const inView = useInView(figure, { once: true, amount: 0.25 });
  const [replay, setReplay] = useState(0);
  const marker = `workflow-arrow-${useId()}`;
  const zh = language === "zh";
  return <figure ref={figure} className="hero-art workflow-graph" data-reduced-motion={reduced}>
    <svg key={replay} viewBox="0 0 660 524" role="img" aria-labelledby={`${marker}-title ${marker}-description`}>
      <title id={`${marker}-title`}>{zh ? "从想法到可用成果：Aaron Skills 能力图" : "From intent to usable work: Aaron Skills"}</title>
      <desc id={`${marker}-description`}>{zh
        ? "项目想法连接到 Shape、Build、Verify、Demonstrate 和 Deliver。每项能力按需使用；Demonstrate 生成讲解视频，Deliver 准备交接材料。"
        : "A project idea connects to Shape, Build, Verify, Demonstrate and Deliver. Use the capabilities you need. Demonstrate creates an explanation; Deliver prepares a useful handoff."}</desc>
      <defs><marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M2 1L8 5L2 9" fill="none" stroke="#0755ff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
      <g aria-hidden="true">
        <Connector d="M112 257H128Q144 257 144 241V74Q144 58 160 58H177" delay={0.05} reduced={reduced} visible={inView} marker={marker} />
        {[96, 192, 288, 384].map((y, index) => <Connector key={y} d={`M288 ${y}V${y + 18}`} delay={0.3 + index * 0.26} reduced={reduced} visible={inView} marker={marker} />)}
        <Connector d="M400 346H419Q435 346 435 330V158Q435 142 451 142H468" delay={1.18} reduced={reduced} visible={inView} marker={marker} />
        <Connector d="M400 442H419Q435 442 435 426V400Q435 384 451 384H468" delay={1.48} reduced={reduced} visible={inView} marker={marker} />
        <Reveal reduced={reduced} visible={inView} delay={0}>
          <text x="12" y="171" className="graph-label">{zh ? "你的想法" : "YOUR IDEA"}</text>
          <path d="M12 192H84L112 220V322H12Z" className="graph-paper" />
          <path d="M84 192V220H112" className="graph-paper-fold" />
          <path d="M29 239H81" className="graph-paper-title" />
          <path d="M29 257H91 M29 271H76 M29 285H86 M29 299H65" className="graph-paper-lines" />
          <circle cx="112" cy="257" r="5" fill="#0755ff" />
          <path d="M12 345V395" stroke="#8fa5c5" strokeWidth="2" />
          <text x="25" y="357" className="graph-input-note">{zh ? "背景" : "Context"}</text>
          <text x="25" y="377" className="graph-input-note">{zh ? "目标" : "Intent"}</text>
          <text x="25" y="397" className="graph-input-note">{zh ? "已有工作" : "Existing work"}</text>
        </Reveal>
        {steps.map((step, index) => <g key={step.name} transform={`translate(178 ${step.y})`}>
          <Reveal className="workflow-node" reduced={reduced} visible={inView} delay={0.16 + index * 0.26}>
            <rect className="graph-node-bg" width="222" height="76" rx="15" />
            <circle cx="31" cy="38" r="19" fill="#0755ff" />
            <g transform="translate(31 38)" color="white"><StageIcon index={index} /></g>
            <text x="62" y="33" className="graph-node-name">{step.name}</text>
            <text x="62" y="54" className="graph-node-note">{step[language]}</text>
          </Reveal>
        </g>)}
        <Reveal reduced={reduced} visible={inView} delay={1.36}>
          <text x="478" y="58" className="graph-label">{zh ? "讲清成果" : "A CLEAR EXPLANATION"}</text>
          <rect x="470" y="78" width="176" height="136" rx="9" className="graph-video" />
          <rect x="482" y="91" width="29" height="89" rx="3" fill="#edf1f7" />
          <path d="M489 104H503 M489 116H502 M489 128H499 M489 140H502" className="graph-tiny-lines" />
          <rect x="519" y="91" width="115" height="89" rx="3" fill="#dbeaff" />
          <path d="M519 167L544 139L567 154L595 120L634 152V180H519Z" fill="#b8d2ff" />
          <circle cx="577" cy="135" r="20" fill="#0755ff" />
          <path d="M572 125L586 135L572 145Z" fill="white" />
          <path d="M484 198H631" stroke="#bac6d8" strokeWidth="4" strokeLinecap="round" />
          <path d="M484 198H570" stroke="#0755ff" strokeWidth="4" strokeLinecap="round" />
          <circle cx="570" cy="198" r="4" fill="#0755ff" />
          <text x="478" y="240" className="graph-output-note">Capture · Film · Share</text>
        </Reveal>
        <Reveal reduced={reduced} visible={inView} delay={1.66}>
          <text x="478" y="305" className="graph-label">{zh ? "清楚交接" : "A USEFUL HANDOFF"}</text>
          <path d="M470 326H598L630 358V494H470Z" className="graph-paper" />
          <path d="M598 326V358H630" className="graph-paper-fold" />
          <path d="M488 354H552" stroke="#0755ff" strokeWidth="5" strokeLinecap="round" />
          <path d="M488 373H599 M488 385H576" className="graph-tiny-lines" />
          <rect x="487" y="405" width="125" height="32" rx="4" fill="#e5efff" />
          <circle cx="499" cy="417" r="3" fill="#0755ff" />
          <path d="M510 417H598 M497 427H566" className="graph-tiny-lines" />
          <rect x="487" y="447" width="125" height="32" rx="4" fill="#eef4ff" />
          <path d="M498 458H596 M498 469H575" className="graph-tiny-lines" />
        </Reveal>
      </g>
    </svg>
    <figcaption>
      <span>{zh ? "能力按需使用，让理解延续到交付。" : "Use what you need. Carry the understanding through."}</span>
      {!reduced && <button className="graph-replay" onClick={() => setReplay(value => value + 1)}><span aria-hidden="true">↻</span>{zh ? "重播动画" : "Replay motion"}</button>}
    </figcaption>
  </figure>;
}
