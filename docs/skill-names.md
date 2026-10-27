# Aaron Skills names

The series uses **Shape / Build / Verify / Capture / Film / Deliver / Share** as its human-facing names,
under the shared **Aaron Skills** brand. Use the short action in conversation.
These names describe capabilities, not a mandatory sequence; use only the
skills needed for the task.

| Display name | Job | Existing invocation ID |
| --- | --- | --- |
| **Shape** | Clarify and design at the depth the request needs | `feature-blueprint` |
| **Build (local candidate)** | Carry intent into finished, usable deliverables | `build-delivery` |
| **Verify (local candidate)** | Inspect actual deliverables, repair gaps and recheck evidence | `verify-delivery` |
| **Capture** | Record a real application's flow and checked evidence | `demo-capture` |
| **Film** | Customize a presentation cover, or script and render a walkthrough video | `walkthrough-video` |
| **Deliver (local candidate)** | Prepare stakeholder communication, release notes and usable handoffs | `deliver-work` |
| **Share** | Prepare a copyable update for delivery | `paste-ready-update` |

The overall method is **Understand → Build → Verify → Demonstrate → Deliver**.
Shape supports understanding; Build carries intent into finished work; Verify
checks evidence for the intended next use; Capture and Film support demonstration;
Deliver supports the receiver's use and next action. Share is an optional
copyable-update packaging method. Build, Verify and Deliver are local source
candidates, described below, rather than released Demo installer capabilities.

整体方法是 **Understand → Build → Verify → Demonstrate → Deliver**。对应能力为 **Shape（理清需求与设计）、Build（落实为成品）、Verify（检查、修复与复验）、Capture（录制）、Film（讲解视频）、Deliver（面向接收者的沟通与交接）**；**Share（可复制更新页）**是可选的包装方式。Build / Verify / Deliver 当前为本地候选；各能力按需组合，无需整套运行。

## Build candidate

**Build** (`build-delivery`) carries an understood request into a usable website,
application, presentation or document. It can continue from Shape's useful
delivery without repeating discovery, and composes with the user's existing
implementation and authoring methods. It is not part of the released Demo
installer or a required step in the series. Source documentation is in
`docs/build-delivery.md`; it covers local use, scope and evaluation limits.
No `$build` alias is registered.

**Build（落实为可用成品）**目前是本地候选，调用名为 `build-delivery`；按需承接 Shape 或已有需求，沿用用户选择的实现方法，尚未加入已发布的 Demo 安装包。

## Verify candidate

**Verify** (`verify-delivery`) checks the actual deliverable against its intended
use, repairs findings within scope and rechecks the result. It covers relevant
behavior, content/data, rendered layout, repeatability and receiver access using
available specialist tools. Build retains its ongoing checks; a separate Verify
pass is optional. Source documentation is in `docs/verify-delivery.md`. It is not
part of the released Demo installer. No `$verify` alias is registered.

**Verify（检查、修复与复验）**目前是本地候选，调用名为 `verify-delivery`；按成品选择检查维度，区分已验证、发现问题和未检查，默认在授权范围内修复后复验。它不替代 Build 的日常自检，也不代表客户验收或发布批准。

## Deliver candidate

**Deliver** (`deliver-work`) prepares stakeholder messages, release notes and
usable handoffs around the receiver's next action, channel, media, access and
verified status. Existing Share retains its name, invocation ID and runtime;
Deliver can use it for a copyable update page when helpful. It can also prepare
plain chat/email, editable-file handoffs or release notes without that runtime.
Source documentation is in `docs/deliver-work.md`; the composition guide is
`docs/task-delivery-workflow.md`. It is not part of the released Demo installer.
No `$deliver` alias is registered.

**Deliver（面向接收者的沟通与交接）**目前是本地候选，调用名为 `deliver-work`；按需要准备 stakeholder 消息、release notes、文件或发布交接，区分准备、发送、发布与验收。它按需使用 Share，不更名或替代现有更新页运行时。

## Compatibility in this pass

Display names change in the skill UI metadata, entry headings, source READMEs
and website copy. Existing folder names, SKILL.md `name` fields, installation
registrations, bundle IDs, CLI commands and documentation URLs stay the same.
For explicit `$` invocation, use the existing ID in the table, for example
`$feature-blueprint` for Shape. No new `$shape`, `$capture`, `$film` or `$share` invocation alias is installed
in this pass. No duplicate skills or redirect wrappers are added.

A display name helps people remember a capability. Keeping the established
machine IDs preserves existing installations and capture references. A later
ID migration would need an explicit mapping, upgrade/uninstall checks and a
separate compatibility review. Existing benchmark names and results are frozen.
