# Aaron Skills

[English](README.md) | [简体中文](README.zh-CN.md) | [官网](https://skills.aaronguo.com/?lang=zh)

**让想法，成为可用的成果。**

与 AI Agent 协作的可复用方法和工具。理清想法，用心实现，检查结果，再让接收者看明白。
根据任务需要选择能力，无需按固定顺序使用整套流程。

## 选择当前任务需要的帮助

| 能力 | 精髓 | 可用状态 |
| --- | --- | --- |
| [Shape](https://skills.aaronguo.com/?lang=zh#skill-shape) | 把意图变具体，让方案可以被查看、纠正和执行。 | 源码预览 · `feature-blueprint` |
| [Build](https://skills.aaronguo.com/?lang=zh#skill-build) | 延续已有理解和项目做法，补齐从做出来到能用的距离。 | 开发中 |
| [Verify](https://skills.aaronguo.com/?lang=zh#skill-verify) | 检查实际承诺的结果；发现问题就修复，再验证。 | 开发中 |
| [Demonstrate](https://skills.aaronguo.com/?lang=zh#skill-demonstrate) | 录制真实流程，针对受众讲清检查过的结果。 | Demo 已发布 · Capture / Film / Share |
| [Deliver](https://skills.aaronguo.com/?lang=zh#skill-deliver) | 让下一步清楚可行，使对方能审阅、使用或接着做。 | Share 已发布 · 更广泛的能力开发中 |

[看看“缺失收据”这个虚构案例](https://skills.aaronguo.com/?lang=zh#skills)：
一份聚焦的方案、可操作的界面示意、验收检查、讲解分镜，以及可复制的交接草稿。
它们用于说明方法，不作为发布或 benchmark 证据。

Shape 的[源码预览](skills/feature-blueprint/SKILL.md)独立于 Demo 安装器。
参见[使用说明](docs/feature-blueprint.md)和[现有调用标识](docs/skill-names.md)。
Build、Verify 和更广泛的 Deliver 能力尚未在这个仓库中作为独立 Skill 发布。

## 当前可用：Demo

将一个已经能运行的 Web 功能，变成有引导的视频、截图和可复制的更新说明。
已发布的能力组合通过一套共享的本地工具串起三个 Skills：

| Skill | 具体作用 |
| --- | --- |
| [Capture](skills/demo-capture/SKILL.md) | 录制真实操作，检查结果，保存证据。 |
| [Film](skills/walkthrough-video/SKILL.md) | 制作讲解视频或品牌封面；调整表达时无需重复业务操作。 |
| [Share](skills/paste-ready-update/SKILL.md) | 准备可审阅的 HTML 更新页面，包含可复制的文字、截图与可选视频。 |

<p align="center">
  <a href="https://skills.aaronguo.com/?lang=zh#examples">
    <img src="https://skills.aaronguo.com/art/optimized/workflow-overview.07ee3e92c535.webp" width="760" alt="已发布的 Demo 能力组合：Capture 录制流程，Film 制作讲解视频，Share 整理清楚的更新" />
  </a>
</p>

[观看八条配音示例](https://skills.aaronguo.com/?lang=zh#examples)。
每个案例复用同一份检查过的录制，针对不同受众和目的组织讲解。

| 虚构产品演示 | 公开内容导览 |
| --- | --- |
| [<img src="https://skills.aaronguo.com/art/optimized/ledgerlane-example.5a31757c6ee6.webp" width="360" alt="Ledgerlane 产品演示封面" />](https://skills.aaronguo.com/?lang=zh#example-ledgerlane) | [<img src="https://skills.aaronguo.com/art/optimized/blog-example.02465ed700ac.webp" width="360" alt="Builder Notes 内容导览封面" />](https://skills.aaronguo.com/?lang=zh#example-blog) |
| 两张发票，一次有依据的决定。 | 一次有内容的 Builder Notes 导览。 |

还可以浏览 [32 种封面风格](https://skills.aaronguo.com/covers?lang=zh)，以及
[6 组视频搭配和 2 种无装饰背景的简洁版](https://skills.aaronguo.com/layouts?lang=zh)。
这些是经过挑选的展示案例，与 benchmark 分开。

## 安装 Demo

运行时目标：**macOS arm64、Ubuntu 24.04 x64 和原生 Windows 11 x64**。
具体实测平台与宿主范围请看[兼容性说明](docs/compatibility.md)。
需要 Git、Python 3.11+、Node 22+（含 npm）和 FFmpeg/ffprobe。
安装器会安装固定版本的浏览器、视频和 Python 依赖；公开示例不需要客户账号或付费 API。

```sh
git clone https://github.com/aaronguostudio/aaron-skills.git
cd aaron-skills
# macOS / Ubuntu；也可把 codex 改成 claude、cursor 或 both：
bash scripts/setup.sh --agent codex --smoke
```

原生 Windows 克隆同一仓库后，在普通 PowerShell 中运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1 --agent codex --smoke
```

Windows 不需要 WSL 或管理员权限；执行策略的 Bypass 只作用于这一次进程。
前置工具需要先安装，Ubuntu 还需要 Chromium 系统依赖。
平台准备、Agent 注册、隔离并存和卸载，请看[安装与恢复](docs/installation.md)。

## 制作第一个 Demo

可以这样告诉本地 Agent：

> 使用 Capture 演示我本地应用中的这个功能。展示起始状态、关键操作和检查过的结果。
> 生成一个简短的静音演示视频和更新页面，供我审阅。修改呈现方式时复用已有录制。
> 不要发送或发布任何内容。

Agent 可以检查应用，编写描述地址、步骤和检查项的小型适配器。
录制前请确认写入操作和生产环境限制；登录由你在可见浏览器中完成，Skill 不代填凭据。
参见[第一次制作 Demo](docs/first-demo.md)和[项目适配器](docs/project-adapters.md)。

```sh
aaron-demo capture --project /path/to/app --env local --walk tour
aaron-demo render /path/to/passed-run --stills
aaron-demo inspect /path/to/passed-run
```

脚本、声音与视觉风格可以独立选择。Film 可以根据简报和录制证据起草脚本。
视频默认静音；也可导入音频、使用自己的云端／公司声音，或按需安装免费的本地配音。
`aaron-demo voice setup` 提供引导配置。详见[旁白](docs/narration.md)、
[封面选择](docs/cover-library.md)、[视频布局](docs/video-layouts.md)和[呈现修改](docs/presentation-revisions.md)。

用 `aaron-demo version` 查看版本。干净的托管安装在后台检查更新，自动安装经过验证的兼容补丁；
较大变化由用户选择。使用 `aaron-demo update`、`aaron-demo rollback`，或
`aaron-demo update policy notify|off` 管理更新。本地修改源码的安装保持手动管理。
参见[版本与更新](docs/updates.md)。

## 隐私与适用范围

录制、会话和生成页面保存在 Git 仓库之外。产物可能包含真实界面，分享前请检查。
可选的[实色区域遮挡](docs/data-masking.md)覆盖导出画面中的指定区域，
不会自动识别个人信息，也不支持模糊或动态追踪；原始录制仍是未脱敏的本地工作材料。
适配器是需要信任的可执行 JavaScript，浏览器防护不能作为恶意适配器的沙箱。
参见[数据与网络行为](docs/data-and-network-behavior.md)。

宿主注册和运行时兼容不等于模型调用已经通过验收。
实测范围请看[兼容性说明](docs/compatibility.md)。

## 开发与扩展

从[贡献指南](CONTRIBUTING.md)、[本地开发](docs/local-development.md)、
[验证记录](docs/verification.md)和[评估方法](docs/evaluation.md)开始。
确定性测试、模型行为和视觉验收分别检查。

## 作者与许可证

由 **[Aaron Guo](https://aaronguo.com)** 创建。中英文 README 覆盖项目定位和入门步骤；
详细技术参考暂时保持英文。命令、路径和 Skill 标识在两个版本中保持一致。

原创代码采用 [MIT 许可证](LICENSE)。依赖保留各自条款；Remotion 的免费使用资格和 Company License 条件适用。
参见[第三方声明](THIRD_PARTY_NOTICES.md)和[安全说明](SECURITY.md)。
