# Aaron Skills

[English](README.md) | [简体中文](README.zh-CN.md) | [官网](https://skills.aaronguo.com/?lang=zh)

把资深工程师解决软件问题的工作方法，沉淀成可复用的 Agent Skills 和可执行工具：从理解一个陌生项目，到交付经过验证、别人看得见也用得上的成果。

Aaron Skills 将工作流与执行工作流所需的工具放在同一个集合里。目标是让你更容易接手一个项目、理解问题、完成有明确范围的改动、验证实际行为，再把结果讲清楚。每个 Skill 承载其中一段可重复的方法；相关的 Skills 通过共享工具和明确的产物格式协作。

<p align="center">
  <a href="https://skills.aaronguo.com/?lang=zh">
    <img src="https://skills.aaronguo.com/art/optimized/readme-overview-1024.034b816d9e5b.webp" width="900" alt="Aaron Skills 官网：从陌生项目到清楚交付的悬浮工作室" />
  </a>
</p>

## 整体方向

我们希望逐步串起这样的工作流：

```text
理解项目与问题
  → 规划并实现有明确范围的改动
  → 验证实际行为
  → 演示结果
  → 交付清楚的更新或交接说明
```

这个集合会围绕工作流中的实际问题逐步扩展。一个 Skill 应该帮助 Agent 判断该做什么、调用合适的工具执行，并留下别人可以检查的证据。新增能力需要解决真实、可重复的问题，也需要有明确的说明和验证方式。

**目前第一个可用的能力组合是 Demo**，覆盖演示与沟通。项目接手、实现改动、更广泛的工程验证，是这个集合后续发展的方向；当前仓库还没有单独发布这些环节的 Skills。

**Feature Blueprint v0 已提供源码预览。** 它通过证据整理、需求澄清、流程图、数据模型、交互原型和开发交接，连接 Understand 与 Build。设备借用申请案例的需求、会议记录和回答完全虚构。在完整仓库中，请从 `docs/feature-blueprint.md` 和 `examples/feature-blueprint/README.md` 开始。它使用独立的便携导出包；下面的 Demo 安装流程仍只安装 Demo。结构检查和完整示例不等于已通过独立 Agent 评估或生产验收。

## 当前可用：Demo

将一个已经能运行的 Web 功能，变成有引导的视频、截图和可复制的更新说明。Demo 通过一套共享的本地工具，串起三个 Skills：

| [Demo Capture](skills/demo-capture/SKILL.md) | [Walkthrough Video](skills/walkthrough-video/SKILL.md) | [Paste Ready Update](skills/paste-ready-update/SKILL.md) |
| :---: | :---: | :---: |
| <img src="https://skills.aaronguo.com/art/optimized/demo-capture-384.f4d6e043ee50.webp" width="180" alt="相机与截图工作台" /> | <img src="https://skills.aaronguo.com/art/optimized/walkthrough-video-384.46860ec7a03c.webp" width="180" alt="胶片与演示视频工作台" /> | <img src="https://skills.aaronguo.com/art/optimized/paste-ready-update-384.c3bf816ed3ae.webp" width="180" alt="文档与更新说明工作台" /> |
| **录制真实流程。** 保存截图与经过检查的结果证据。 | **让结果容易看懂。** 将通过检查的录制制作成带引导的 MP4。 | **把工作带进对话。** 整理文字、截图与可选视频，供你审阅和分享。 |

例如，你接手一个项目并完成某个功能改动后，可以让 Agent 展示起始状态、操作变化后的流程、检查界面结果，再准备给客户或团队的更新说明。Demo 提供的就是这一段能力。下面的安装步骤针对 Demo；未来其他能力组合可以有各自的依赖和安装路径。

## 安装

当前代码支持 **macOS arm64、Ubuntu 24.04 x64 和原生 Windows 11 x64**。
已有的 v0.1.0 标签仍然只有 macOS 支持；具体实测环境和宿主限制请看[兼容性说明](docs/compatibility.md)。

需要 Git、Python 3.11+、Node 22+（含 npm）和 FFmpeg/ffprobe。安装器会安装固定版本的浏览器、视频和 Python 依赖。运行示例不需要客户账号或付费 API。

```sh
git clone https://github.com/aaronguostudio/aaron-skills.git
cd aaron-skills
# macOS / Ubuntu；也可以把 codex 改成 claude 或 both：
bash scripts/setup.sh --agent codex --smoke
```

原生 Windows 克隆同一仓库后，在普通 PowerShell 中运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1 --agent codex --smoke
```

Windows 不需要 WSL 或管理员权限；执行策略的 Bypass 只作用于这一次 PowerShell 进程。
前置工具需要先安装，Ubuntu 还需要 Chromium 系统依赖。macOS 可以加 `--install-prerequisites`，通过已有的 Homebrew 安装缺少的工具。各平台准备、隔离安装、升级、修复和卸载，请看[安装与恢复](docs/installation.md)。

也可以在仓库目录中给本地 Agent 这段提示词：

> 阅读 README.zh-CN.md 和 docs/installation.md，检查当前平台的前置工具，再为我正在使用的 Agent 安装 Demo。保留其他 Skills 和配置。运行 doctor 和公开示例的 smoke 检查，打开生成的更新页面并检查视频帧，报告仍需手动完成的设置。此次安装不要使用客户应用、凭据或付费旁白。

Codex Skills 注册在用户目录的 `.agents/skills`，Claude Code 在 `.claude/skills`。
Windows 使用受管理的副本，macOS/Ubuntu 使用链接；安装保留无关条目，遇到名称冲突会停止。
如果需要，请将安装输出的命令目录加入 PATH，并开启新的 Agent 会话以刷新发现结果。
Smoke 检查会输出 MP4、供审阅的静帧和本地 HTML 更新页面。

## 制作一个 Demo

可以这样告诉 Agent：

> 使用 Demo Capture 演示我本地应用中的这个功能。展示起始状态、关键操作和经过验证的结果。生成一个简短的静音演示视频和更新页面，供我审阅。字幕或高亮需要修改时，复用已有录制。不要发送或发布任何内容。

接入一个应用需要小型项目适配器，描述应用地址和界面操作步骤。Agent 可以在检查应用后编写它。录制前需要确认写入操作和生产环境限制。登录由你在可见浏览器中完成，Skill 不代填凭据。请看[第一次制作 Demo](docs/first-demo.md)和[适配器参考](docs/project-adapters.md)。

```sh
aaron-demo capture --project /path/to/app --list
aaron-demo capture --project /path/to/app --env local --walk tour
aaron-demo render /path/to/passed-run --stills
aaron-demo inspect /path/to/passed-run
aaron-demo revise /path/to/passed-run /path/to/patch.json --out /path/to/revision
aaron-demo page /path/to/message.md --out /path/to/message.html
```

结果字段通过精确断言检查，并保存命名高亮区域的位置。仅调整呈现方式时，保留原始录制，避免重复执行业务写入。默认生成静音视频；可选旁白使用你自己的 ElevenLabs 账号。`render --dry-run` 只生成计划，不创建文件或调用服务。详见[呈现修改](docs/presentation-revisions.md)和[旁白](docs/narration.md)。

## 隐私与适用范围

会话、录制和生成页面保存在 Git 仓库之外。产物可能包含真实界面，分享前请检查；工具不会自动对个人信息脱敏。适配器是需要信任的可执行 JavaScript，浏览器网络防护不能作为恶意适配器的沙箱。详见[数据与网络行为](docs/data-and-network-behavior.md)。

共享 CLI 独立于模型。[兼容性说明](docs/compatibility.md)区分格式兼容、宿主发现和实际工作流验证。DeepSeek、GLM、MiniMax 及更多宿主组合仍未验证。Windows/Linux 的运行时验收不等于已经验证本地 LLM 宿主的原生调用。仅有标准 `SKILL.md`，不能证明浏览器和渲染器已在某个宿主上运行通过。

## 开发与扩展

- `skills/`：职责明确的 Agent Skills 入口。
- `packages/demo/`：录制、数据契约、渲染和更新页面的实现。
- `bundles/`：明确列出的运行时与公开源码清单。
- `examples/` 和 `evals/`：公开示例，以及按需运行的行为评估。

请阅读[贡献指南](CONTRIBUTING.md)、[验证记录](docs/verification.md)和[评估方法](docs/evaluation.md)。确定性测试、Agent 行为和视觉验收分别检查。新能力可以在这个仓库里增加自己的 package 和 bundle，无需额外建立一个总仓库来协调。

## 作者、文档与许可证

由 **[Aaron Guo](https://aaronguo.com)** 创建。Aaron 是一名产品构建者和工程师，持续探索实用的 AI 工作流。这个仓库分享解决软件问题、验证结果和清楚沟通所需的可复用工具。

中英文 README 覆盖项目定位和入门步骤；详细技术参考暂时保持英文。命令、路径和 Skill 标识在两个版本中保持一致。

原创项目代码采用 [MIT 许可证](LICENSE)。依赖保留各自条款；Remotion 对免费使用有资格限制，不符合条件的组织需要 Company License。组织内推广使用前，请阅读[第三方声明](THIRD_PARTY_NOTICES.md)。安全问题请按 [SECURITY.md](SECURITY.md) 中的方式报告。
