import React from 'react';

const releases = [
  {version:'1.0.1', date:'2026-10-27', en:{title:'More dependable reviews', text:'Verify now connects checks to the work being reviewed, compares interface changes with their intended design, and makes remaining uncertainty clearer.'}, zh:{title:'更可靠的检查', text:'Verify 将检查结果与正在审阅的成果对应起来，对照既定设计检查界面变化，并更清楚地说明尚未确认的部分。'}},
  {version:'1.0.0', date:'2026-10-26', en:{title:'A complete workflow, in your hands', text:'Shape, Build, Verify, Capture, Film, Deliver and Share are now included in the standard setup. Choose the skills that fit your work; there is no required sequence.'}, zh:{title:'完整工作流程，按需使用', text:'标准安装现已包含 Shape、Build、Verify、Capture、Film、Deliver 和 Share。根据工作需要选择使用，无须遵循固定顺序。'}},
  {version:'0.6.1', date:'2026-10-26', en:{title:'Hide selected details in a video', text:'Add or revise solid masks on a recorded walkthrough without recording the application again. Masks also appear in rendered review stills and previews.'}, zh:{title:'遮盖视频中的指定内容', text:'可以在已有录制上添加或调整实色遮盖，无须重新操作应用。遮盖也会出现在视频预览和审阅静帧中。'}},
  {version:'0.5.1', date:'2026-10-24', en:{title:'A smoother first recording', text:'Improvements to recording startup and cover text make the first walkthrough more reliable and easier to prepare.'}, zh:{title:'更顺畅的首次录制', text:'改进录制启动和封面文字排版，让第一次制作演示更加可靠、顺手。'}},
  {version:'0.4.0', date:'2026-10-21', en:{title:'More ways to add a voice', text:'Choose an existing audio recording, configure a voice provider, try the optional local voice, or keep your video silent.'}, zh:{title:'更多配音方式', text:'可以导入已有音频、配置配音服务、尝试可选的本地声音，也可以制作静音视频。'}},
  {version:'0.3.0', date:'2026-10-20', en:{title:'A look for the whole video', text:'Explore six coordinated cover and video treatments, plus two simple layouts that keep the application front and center.'}, zh:{title:'为整支视频选择风格', text:'探索六组封面和视频画面搭配，以及两种让应用内容成为主角的简洁版式。'}},
];

export default function ReleaseNotes({language}) {
  const zh=language==='zh';
  return <section className="release-page wrap" aria-labelledby="release-title">
    <div className="release-intro"><p className="release-kicker">Aaron Skills</p><h1 id="release-title">{zh?'更新记录':'Release notes'}</h1><p>{zh?'了解能帮助你更好地完成工作的新增功能和重要改进。':'New capabilities and thoughtful improvements for the work you do.'}</p></div>
    <div className="release-list">{releases.map((release,index)=><article className="release-entry" key={release.version}>
      <div className="release-meta"><span className="release-version">v{release.version}</span>{index===0&&<span className="release-latest">{zh?'最新':'Latest'}</span>}<time dateTime={release.date}>{release.date}</time></div>
      <div className="release-content"><h2>{release[language].title}</h2><p>{release[language].text}</p><a href={`https://github.com/aaronguostudio/aaron-skills/releases/tag/v${release.version}`} target="_blank" rel="noopener noreferrer">{zh?'查看完整版本说明':'View full release'} <span aria-hidden="true">↗</span></a></div>
    </article>)}</div>
    <p className="release-more"><a href="https://github.com/aaronguostudio/aaron-skills/releases" target="_blank" rel="noopener noreferrer">{zh?'在 GitHub 查看所有版本':'See all releases on GitHub'} ↗</a></p>
  </section>;
}
