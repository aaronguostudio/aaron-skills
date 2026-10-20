# Aaron Skills names

The series uses **Shape / Capture / Film / Share** as its human-facing names,
under the shared **Aaron Skills** brand. Use the short action in conversation.
These names describe capabilities, not a mandatory sequence; use only the
skills needed for the task.

| Display name | Job | Existing invocation ID |
| --- | --- | --- |
| **Shape** | Clarify and design at the depth the request needs | `feature-blueprint` |
| **Capture** | Record a real application's flow and checked evidence | `demo-capture` |
| **Film** | Customize a presentation cover, or script and render a walkthrough video | `walkthrough-video` |
| **Share** | Prepare a copyable update for delivery | `paste-ready-update` |

Under Aaron Skills, the short names form **Shape → Capture → Film → Share**. Shape bridges
Understand and Build; Capture and Film support Demonstrate; Share supports
Deliver. This naming does not imply a new general Build or Verify skill exists.

展示名统一为 **Shape（理清需求与设计）→ Capture（录制）→ Film（讲解视频）→ Share（交付更新）**。各能力按需使用，无需整套运行。

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
