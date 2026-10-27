import { useEffect, useState } from "react";
import { useMotionPreference } from "./useMotionPreference";
import * as m from "motion/react-m";

const content = {
  en: {
    eyebrow: "FIVE CAPABILITIES · USE WHAT YOU NEED",
    title: "Good work, all the way through.",
    intro: "Start where your task needs help. Carry the understanding forward.",
    example: "ONE SMALL EXAMPLE",
    caseTitle: "The missing receipt.",
    caseIntro: "A fictional expense app. Someone submits an expense without a receipt. Help them finish it, and help the reviewer understand what changed.",
    source: "v1.0.0 includes all seven skills. Use only the capabilities your task needs.",
    tabs: "Explore the capabilities", readSkill: "Read the skill", install: "Install all seven skills",
    output: "WHAT IT LOOKS LIKE",
    stages: [
      { name: "Shape", essence: "Make the intent concrete.", summary: "Turn a vague request into a proposal someone can inspect, correct and act on.", reason: "Keep the purpose, the important choices and their reasons together. Use a design, flow or short reply at the depth the task needs.", status: "Included · feature-blueprint", artifact: "A focused proposal", prompt: "“Can we make missing receipts less painful?”", result: "A direction you can review, with the remaining decision visible." },
      { name: "Build", essence: "Close the gap to usable.", summary: "Carry the intent into finished work, using the project's existing methods and design.", reason: "Connect the screens, states and recovery paths. Check the result while building, and carry discoveries back into the design.", status: "Included", artifact: "A working interaction", prompt: "“Build the agreed receipt flow in our app.”", result: "Try the browser-only sketch. Leaving this tab or reloading resets it." },
      { name: "Verify", essence: "Check the actual promise.", summary: "Exercise the result as its recipient would. Repair problems, then check again.", reason: "Choose evidence that supports the claim: a working button, a saved record and an accessible handoff need different checks.", status: "Included", artifact: "Checks tied to the user's task", prompt: "“Can the submitter finish this without losing the expense?”", result: "Illustrative acceptance checks, with their evidence boundaries." },
      { name: "Demonstrate", essence: "Make the result easy to follow.", summary: "Record the real flow. Explain the checked result for the people who need to understand it.", reason: "Capture once, then refine the script, voice, layout or selected masks without repeating the business actions.", status: "Demo released", artifact: "An explanation with a purpose", prompt: "“Show a reviewer what changed and why it helps.”", result: "An example storyboard. Play actual finished videos further below." },
      { name: "Deliver", essence: "Make the next step clear.", summary: "Put the result in the right form so the next person can review it, use it or continue the work.", reason: "Carry the useful context, checks and remaining decisions into the handoff. Prepare the message for its audience.", status: "Included · deliver-work", artifact: "A ready-to-review update", prompt: "“Prepare a short update for the team.”", result: "A fictional handoff draft. Copy it and adapt it to your own work." },
    ],
    proposal: { title: "Finish the expense. Keep the context.", goal: "Goal", goalText: "Let the submitter add a missing receipt to the existing expense.", choice: "Proposed flow", steps: ["Reviewer requests receipt", "Submitter adds it to the same expense", "Reviewer resumes review"], why: "Why keep the same expense?", whyText: "It preserves the original details and review history.", open: "Still to decide", openText: "Should reminders be manual or automatic?" },
    build: { label: "INTERFACE SKETCH · BROWSER ONLY", item: "Travel expense", amount: "$84.00", initial: "Receipt missing", requested: "Receipt requested", attached: "Ready for review", request: "Request receipt", attach: "Add sample receipt", receipt: "sample-receipt.pdf · fictional", reset: "Reset example", note: "The original amount and expense stay together.", awaiting: "The submitter can add the receipt to this expense." },
    checks: [["Receipt requested", "The submitter can see what is missing.", "Check both roles"], ["Receipt added", "The file belongs to the original expense.", "Check saved record"], ["Reload and return", "The receipt and history remain available.", "Check persistence"], ["Upload fails", "The expense stays intact and retry is possible.", "Check recovery"]],
    checkHead: ["Scenario", "Expected result", "Evidence needed"],
    film: { frames: [["01", "The problem", "A missing receipt pauses review."], ["02", "The action", "Add it to the existing expense."], ["03", "The result", "The reviewer continues with the context intact."]], quote: "“Add what's missing. Keep the expense and its history together.”", watch: "Watch finished Demo examples", explore: "Explore" },
    handoff: "Receipt-flow proposal ready for review.\n\nThe submitter adds the receipt to the original expense, keeping its details and review history together.\n\nBefore release, verify saved attachments, return after reload and upload recovery.\n\nDecision needed: manual or automatic reminders?",
    copy: "Copy example update", copied: "Copied", copyFailed: "Select and copy the text above.", share: "See how Share prepares the update",
  },
  zh: {
    eyebrow: "五项能力 · 按需使用", title: "把工作，一步步做到位。", intro: "从当前任务需要的地方开始，把已有的理解带到下一步。", example: "一个小例子", caseTitle: "那张缺失的收据。", caseIntro: "一个虚构的报销应用：有人提交了报销，却漏了收据。帮他补齐，也让审核人看懂改动。", source: "v1.0.0 包含七个 Skills，根据任务需要选择使用。", tabs: "探索各项能力", readSkill: "阅读 Skill", install: "安装七个 Skills", output: "看看具体产物",
    stages: [
      { name: "Shape", essence: "把意图变具体。", summary: "把模糊的需求，变成别人可以查看、纠正和执行的方案。", reason: "把目的、关键选择和背后的原因留在一起。根据任务需要，用设计、流程或一段简短回复来表达。", status: "已包含 · feature-blueprint", artifact: "一份聚焦的方案", prompt: "“漏交收据这件事，能不能处理得轻松一点？”", result: "让方向可以确认，也让尚未决定的选择清楚可见。" },
      { name: "Build", essence: "补齐从做出来到能用的距离。", summary: "延续已有理解和项目做法，把成果做到能用。", reason: "连起界面、状态和异常恢复；边做边检查，把实现中的发现带回设计。", status: "已包含", artifact: "一个可以操作的界面", prompt: "“按确认的方案，在现有应用里做出补件流程。”", result: "试试这个浏览器内的界面示意。切换能力或刷新后会重置。" },
      { name: "Verify", essence: "检查实际承诺的结果。", summary: "从接收者的任务出发，检查实际成果；发现问题就修复，再验证。", reason: "让证据对应承诺：按钮能点、记录已保存、交接材料能打开，需要不同的检查。", status: "已包含", artifact: "对应用户任务的检查", prompt: "“提交人能补齐收据，同时不丢掉原来的报销吗？”", result: "下面是验收检查示例，以及每项需要的证据。" },
      { name: "Demonstrate", essence: "让结果容易看懂。", summary: "录制真实流程，针对需要理解它的人，讲清检查过的结果。", reason: "录一次，再调整脚本、声音、版式或选定区域的遮罩，不必重复业务操作。", status: "Demo 已发布", artifact: "有明确目的的讲解", prompt: "“给审核人看看改了什么，为什么有帮助。”", result: "这里展示分镜示例；下方可以播放实际完成的视频。" },
      { name: "Deliver", essence: "让下一步清楚可行。", summary: "把成果整理成适合接收者的形式，让对方能审阅、使用或接着做。", reason: "把有用的背景、检查和未决选择带进交接，根据受众准备消息。", status: "已包含 · deliver-work", artifact: "可供审阅的更新说明", prompt: "“给团队准备一段简短的更新。”", result: "这是一份虚构的交接草稿，可以复制后改成自己的内容。" },
    ],
    proposal: { title: "补齐收据，保留上下文。", goal: "目的", goalText: "让提交人在原来的报销记录里补交收据。", choice: "建议的流程", steps: ["审核人请求补件", "提交人在同一笔报销里添加收据", "审核人继续审核"], why: "为什么保留同一笔报销？", whyText: "保留原始信息和审核历史，避免重新拼凑。", open: "尚待决定", openText: "提醒由人工发送，还是自动触发？" },
    build: { label: "界面示意 · 仅在浏览器运行", item: "差旅报销", amount: "$84.00", initial: "缺少收据", requested: "已请求补件", attached: "可以继续审核", request: "请求补交收据", attach: "添加示例收据", receipt: "sample-receipt.pdf · 虚构文件", reset: "重置示例", note: "原来的金额和报销记录始终保留在一起。", awaiting: "提交人可以在这笔报销里添加收据。" },
    checks: [["请求补件", "提交人能看到缺少什么。", "检查双方角色"], ["补交收据", "文件关联到原来的报销。", "检查保存的记录"], ["刷新后返回", "收据和历史仍然可见。", "检查持久化"], ["上传失败", "报销保留，可以重试。", "检查异常恢复"]], checkHead: ["场景", "预期结果", "需要的证据"],
    film: { frames: [["01", "遇到的问题", "缺失的收据让审核停住。"], ["02", "具体操作", "在原来的报销里补交。"], ["03", "最终结果", "审核人带着完整上下文继续。"]], quote: "“补上缺失的收据，保留报销和审核历史。”", watch: "观看已完成的 Demo 实例", explore: "了解" },
    handoff: "补交收据的方案已准备好，可供审阅。\n\n提交人在原来的报销里添加收据，保留原始信息和审核历史。\n\n发布前，需要验证附件保存、刷新后返回，以及上传失败后的恢复。\n\n待决定：人工提醒，还是自动提醒？", copy: "复制示例更新", copied: "已复制", copyFailed: "请选中上面的文字复制。", share: "看看 Share 如何准备更新",
  },
};

function ReceiptSketch({ text }) {
  const [step, setStep] = useState(0);
  return <div className="receipt-sketch">
    <p className="artifact-eyebrow">{text.label}</p>
    <div className="expense-heading"><div><span className="expense-id">EXP–024</span><h4>{text.item}</h4></div><strong>{text.amount}</strong></div>
    <span className={`receipt-status receipt-status-${step}`} role="status">{[text.initial, text.requested, text.attached][step]}</span>
    <div className="receipt-slot">{step === 2 ? <><span aria-hidden="true">▤</span> {text.receipt}</> : <><span aria-hidden="true">＋</span> {step === 1 ? text.awaiting : text.initial}</>}</div>
    {step < 2 && <button className="example-button" onClick={() => setStep(step + 1)}>{step === 0 ? text.request : text.attach}<span aria-hidden="true">→</span></button>}
    <p className="artifact-note">{text.note}</p>
    {step > 0 && <button className="example-reset" onClick={() => setStep(0)}>{text.reset}</button>}
  </div>;
}

function ExampleArtifact({ selected, text, onExploreDemo }) {
  const [copyStatus, setCopyStatus] = useState("");
  if (selected === 0) return <div className="proposal-sketch"><p className="artifact-eyebrow">SHAPE / 01</p><h4>{text.proposal.title}</h4><dl><div><dt>{text.proposal.goal}</dt><dd>{text.proposal.goalText}</dd></div><div><dt>{text.proposal.choice}</dt><dd><ol className="proposal-flow">{text.proposal.steps.map(step => <li key={step}>{step}</li>)}</ol></dd></div><div><dt>{text.proposal.why}</dt><dd>{text.proposal.whyText}</dd></div></dl><aside><strong>{text.proposal.open}</strong><p>{text.proposal.openText}</p></aside></div>;
  if (selected === 1) return <ReceiptSketch text={text.build} />;
  if (selected === 2) return <div className="verify-sketch"><table><caption className="artifact-eyebrow">VERIFY / 03</caption><thead><tr>{text.checkHead.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{text.checks.map(row => <tr key={row[0]}>{row.map((cell, i) => i === 0 ? <th scope="row" key={cell}>{cell}</th> : <td key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>;
  if (selected === 3) return <div className="storyboard-sketch"><p className="artifact-eyebrow">CAPTURE → FILM → SHARE</p><div className="storyboard-frames">{text.film.frames.map(([number, title, body]) => <div key={number}><span>{number}</span><h4>{title}</h4><p>{body}</p></div>)}</div><blockquote>{text.film.quote}</blockquote><a className="example-link" href="#examples">{text.film.watch} ↗</a><div className="demo-skill-links">{["Capture", "Film", "Share"].map((name, i) => <button key={name} onClick={() => onExploreDemo(i)}>{text.film.explore} {name} ↗</button>)}</div></div>;
  return <div className="handoff-sketch"><p className="artifact-eyebrow">DELIVER / 05</p><p className="handoff-message">{text.handoff}</p><div className="handoff-actions"><button className="example-button" onClick={async () => { try { await navigator.clipboard.writeText(text.handoff); setCopyStatus("copied"); } catch { setCopyStatus("copyFailed"); } }}>{text.copy}<span aria-hidden="true">↗</span></button><span role="status">{copyStatus && text[copyStatus]}</span></div><button className="example-link" onClick={() => onExploreDemo(2)}>{text.share} ↗</button></div>;
}

export function SkillEssentials({ language, onExploreDemo }) {
  const text = content[language];
  const reducedMotion = useMotionPreference();
  const [selected, setSelected] = useState(() => Math.max(0, text.stages.findIndex(stage => window.location.hash === `#skill-${stage.name.toLowerCase()}`)));
  useEffect(() => {
    function syncHash() {
      const index = content.en.stages.findIndex(stage => window.location.hash === `#skill-${stage.name.toLowerCase()}`);
      if (index >= 0) setSelected(index);
    }
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  const stage = text.stages[selected];
  const invocationIds = ["feature-blueprint", "build-delivery", "verify-delivery", "demo-capture", "deliver-work"];
  function selectStage(index) { setSelected(index); window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#skill-${text.stages[index].name.toLowerCase()}`); }
  function onTabKey(event, index) {
    const next = ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % 5 : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + 4) % 5 : event.key === "Home" ? 0 : event.key === "End" ? 4 : null;
    if (next === null) return;
    event.preventDefault(); selectStage(next); document.getElementById(`skill-${text.stages[next].name.toLowerCase()}`)?.focus();
  }
  return <section className="essentials wrap" id="skills" aria-labelledby="skills-title">
    <div className="essentials-heading"><p className="eyebrow">{text.eyebrow}</p><h2 id="skills-title">{text.title}</h2><p>{text.intro}</p></div>
    <div className="capability-tabs" role="tablist" aria-label={text.tabs}>{text.stages.map((item, index) => <button key={item.name} id={`skill-${item.name.toLowerCase()}`} role="tab" aria-selected={selected === index} aria-controls="capability-panel" tabIndex={selected === index ? 0 : -1} onClick={() => selectStage(index)} onKeyDown={event => onTabKey(event, index)}><span className="capability-index">0{index + 1}</span><strong>{item.name}</strong><span className="capability-essence">{item.essence}</span></button>)}</div>
    <div className="case-heading" id="workflow"><div><p className="eyebrow">{text.example}</p><h3>{text.caseTitle}</h3></div><p>{text.caseIntro}</p></div>
    <div className="capability-panel" id="capability-panel" role="tabpanel" aria-labelledby={`skill-${stage.name.toLowerCase()}`} tabIndex={0}>
      <div className="capability-explanation"><span className="capability-status released">{stage.status}</span><h3>{stage.summary}</h3><p>{stage.reason}</p><p><a className="example-link" href={`https://github.com/aaronguostudio/aaron-skills/blob/main/skills/${invocationIds[selected]}/SKILL.md`}>{text.readSkill} · {invocationIds[selected]} ↗</a></p><blockquote>{stage.prompt}</blockquote><div className="artifact-description"><p className="eyebrow">{text.output}</p><h4>{stage.artifact}</h4><p>{stage.result}</p></div></div>
      <m.div key={selected} className="capability-artifact" initial={reducedMotion ? false : { opacity: 0.6, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2, ease: "easeOut" }}><ExampleArtifact selected={selected} text={text} onExploreDemo={onExploreDemo} /></m.div>
    </div>
    <p className="capability-availability">{text.source} <a href="https://github.com/aaronguostudio/aaron-skills/blob/main/docs/installation.md">{text.install} ↗</a></p>
  </section>;
}
