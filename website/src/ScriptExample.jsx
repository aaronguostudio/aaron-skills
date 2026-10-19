// Authored for public documentation; not a transcript from a recorded project.
const beats = [
  { time: "00–06s", screen: "A collection of design references", voice: "Good references are useful only if you can find them again. Here’s a simple way to keep a project’s inspiration together." },
  { time: "06–17s", screen: "Select two images and save them to a collection", voice: "Choose the images you want, then save them to a collection called Launch. The collection now shows both references in one place." },
  { time: "17–26s", screen: "Reopen Launch and check the saved images", voice: "Open Launch again and check that both images are there. That’s the result we want to show: a small, reusable set of references, ready for the next design conversation." },
];

export function ScriptExample({ language }) {
  const zh = language === "zh";
  return (
    <details className="script-example">
      <summary>{zh ? "看看一份讲解脚本怎么写" : "See how a short script takes shape"}<span aria-hidden="true">+</span></summary>
      <div className="script-example-content">
        <p className="eyebrow">{zh ? "虚构脚本示例 / 英文讲解" : "ILLUSTRATIVE SCRIPT / ENGLISH NARRATION"}</p>
        <h3>{zh ? "先明确结果，再写解说。" : "Start with a result worth showing."}</h3>
        <p>{zh ? "假设我们在演示一个虚构的素材收藏应用，观众是第一次使用它的设计师。下面是一份约 30 秒的 Quick Demo 草稿，用来说明写法；它不是上面视频的逐字稿，也不是可执行的录制配置。" : "Imagine a fictional reference-library app, shown to a designer using it for the first time. This roughly 30-second Quick Demo draft illustrates the approach; it is not a transcript of the videos above or an executable capture configuration."}</p>
        <ol>{beats.map(beat => <li key={beat.time}>
          <div><span>{beat.time}</span><strong lang="en">{beat.screen}</strong></div>
          <p lang="en">“{beat.voice}”</p>
        </li>)}</ol>
        <p>{zh ? "让 Film 根据真实录制起草时，可以这样说：“给第一次使用的人做一个简短演示，讲清保存到收藏夹和重新打开后的结果。只写画面确实展示的内容，不要补不存在的功能。先让我审稿，再生成旁白。”时间和台词应根据实际录制调整。" : "A useful brief for Film: “Make a short demo for a first-time user. Explain saving to a collection and checking the result after reopening it. Describe only what the recording shows. Let me review the draft before generating narration.” Adjust the wording and timing to the actual capture."}</p>
      </div>
    </details>
  );
}
