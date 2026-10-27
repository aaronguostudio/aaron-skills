# Aaron Skills names

Aaron Skills v1.0.0 installs seven skills for the five capabilities
**Understand → Build → Verify → Demonstrate → Deliver**. Use what the task needs;
no fixed sequence or invocation alias is required.

| Display name | Job | Invocation ID |
| --- | --- | --- |
| Shape | Clarify and design at the depth the request needs | `feature-blueprint` |
| Build | Carry intent into usable deliverables with the project’s existing methods | `build-delivery` |
| Verify | Inspect actual deliverables, repair scoped issues and recheck evidence | `verify-delivery` |
| Capture | Record a real application’s flow and checked evidence | `demo-capture` |
| Film | Customize a cover or explain a checked recording | `walkthrough-video` |
| Deliver | Prepare recipient communication, release notes and usable handoffs | `deliver-work` |
| Share | Package a copyable screenshot/video update | `paste-ready-update` |

Shape supports understanding; Capture and Film support demonstration. Deliver
can use Share for media packaging. Build retains its own checks; Verify can
independently reassess readiness for the next use. No skill is a prerequisite
for another. The instruction skills add no service dependency; Demo media work
retains the existing local runtime and `aaron-demo` CLI.

整体方法是 **Understand → Build → Verify → Demonstrate → Deliver**。
v1.0.0 的标准安装包含 **Shape（理清需求与设计）、Build（落实为成品）、
Verify（检查、修复与复验）、Capture（录制）、Film（讲解视频）、
Deliver（面向接收者的沟通与交接）、Share（可复制更新页）**。
各能力按需使用；展示名和上表的调用标识保持分开，不强制完整流水线。

## Use and compatibility

Invoke the existing IDs, such as `$feature-blueprint`, `$verify-delivery` and
`$deliver-work`. No `$shape`, `$build`, `$verify` or `$deliver` alias is installed.
Existing registrations, runtime paths, capture references and CLI commands keep
their established identities. This major release requires explicit update review.

See [Shape](https://github.com/aaronguostudio/aaron-skills/blob/main/docs/feature-blueprint.md), [Build](https://github.com/aaronguostudio/aaron-skills/blob/main/docs/build-delivery.md),
[Verify](https://github.com/aaronguostudio/aaron-skills/blob/main/docs/verify-delivery.md), [Deliver](https://github.com/aaronguostudio/aaron-skills/blob/main/docs/deliver-work.md) and the
[composition guide](https://github.com/aaronguostudio/aaron-skills/blob/main/docs/task-delivery-workflow.md). Standard setup is described in
[installation](https://github.com/aaronguostudio/aaron-skills/blob/main/docs/installation.md). Copying a complete instruction-skill folder
also supports standalone use without the media runtime; preserve existing skills.

Skill availability, deterministic packaging checks, model behavior, platform
acceptance and recipient/customer acceptance remain distinct. Existing benchmark
results retain their original versions and limitations.
