# Verify · evidence for the next use

Verify is included in Aaron Skills v1.0.0 with invocation ID `verify-delivery`.
It checks actual deliverables against their purpose, repairs issues within scope,
rechecks the result and reports what the evidence supports. Its core is portable
instructions, not an installed automation engine or universal acceptance checker.

## Use

> Use $verify-delivery to check this deliverable against the brief and intended
> use. Fix issues within scope, verify the final result and report the evidence,
> unresolved findings and important untested boundaries.

An explicit findings-only/read-only request preserves the artifact. Otherwise,
verification includes scoped repairs and rechecks. Use the
[skill](../skills/verify-delivery/SKILL.md) and only the applicable references.
It needs neither a fixed brief schema nor a separate verification report.

The available references address application paths and automation, presentation
layout/charts, document/report completeness and evidence, and reusable templates
or workflows. Multiple dimensions can apply to one artifact. Specialist tools
perform the actual tests, rendering and data checks; tool availability limits
which claims can be verified.

For reusable output, verify the intended subsequent-run mode as well as the
figures: current-result replacement, separate issued versions or an explained
collision refusal. A fresh-directory example cannot establish promised in-place
updating, and successful replacement cannot establish promised history retention.
Judge failure recovery against the actual promise rather than a preferred policy.

When the handoff promises that another person can regenerate or recheck the work,
exercise the documented commands from only the delivered files and declared
dependencies. Passing in the authoring checkout does not establish recipient
reuse. A reading-only handoff need not include an unrequested toolchain.

## Relationship to the series

The overall method is **Understand → Build → Verify → Demonstrate → Deliver**.
Shape helps create the understanding and useful expression for the next receiver.
Build carries that intent into actual work and retains its own ongoing checks.
Verify revisits whether evidence from the actual artifact supports the intended
next use; it does not simply repeat a builder's passed label. Capture/Film can
demonstrate applicable checked work. Deliver (`deliver-work`) can prepare the
audience-appropriate communication or handoff with the result and limits; Share
is an optional way to package a copyable screenshot update.
These are capabilities to combine as needed, not a mandatory pipeline.

Verify can start from work produced by any person or method. Neither Shape nor
Build is a dependency. It composes with the project's engineering, design,
analytical and authoring methods. It adds no claim of native integration with a
named framework and no authority to send, merge, publish or deploy.

## Evidence and readiness

A useful conclusion names the artifact/version and intended use, meaningful
checks, findings/repairs and final rechecks, along with important limits. For
example, a template run may complete while the generated deck still clips a
chart; both results belong in the conclusion. An unavailable rendering tool leaves
layout unverified. An important failure or unverified promise prevents an
unqualified ready claim even when other checks pass.

Readiness is for a stated next action: local review, demonstration, release
candidate or another scoped use. Mechanical success, visual/semantic judgment,
real recipient access and customer acceptance remain distinct. A working demo
does not prove all application behavior, and verification is not release approval.

## Portable local use and limits

Copy the complete `skills/verify-delivery` folder into an unused host-supported
skill location and refresh discovery. Preserve existing registrations.
`agents/openai.yaml` supplies optional Codex UI metadata. The
[standalone manifest](../bundles/verify-delivery.json) lists the skill and product
notes. Standard setup registers Verify with the other six skills; standalone
copying remains available without the media runtime.

Structural validation, reference closure and isolated copying test packaging,
not the quality of the agent's judgments. The
[authored evaluation cases](verify-delivery-evaluation.md) describe future trials;
they are not completed runs or measured improvements. Native discovery, real
customer acceptance and third-party framework integration remain unverified.
Release-specific installation and platform evidence is recorded in
[verification](https://github.com/aaronguostudio/aaron-skills/blob/main/docs/verification.md); synthetic trials do not establish customer acceptance.
