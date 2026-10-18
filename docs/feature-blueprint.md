# Feature Blueprint v0

Feature Blueprint bridges understanding a request and building it. It produces
one traceable design packet, using scoped evidence, a few consequential
questions, useful diagrams and an interactive prototype where needed. It is a
separate capability from Demo; the Demo installer and three existing skills do
not change.

Read the [skill](../skills/feature-blueprint/SKILL.md) and
[worked case](../examples/feature-blueprint/README.md). All case requirements,
meeting notes and stakeholder answers were deliberately invented. The example
demonstrates the workflow; it does not measure autonomous agent performance or
prove that a fresh engineer can implement without clarification.

## Use without a service account

The workflow itself needs an agent and authorized project sources. The checker
and exporter use Python 3.11+ with no extra packages. The included prototype uses
a modern browser, local HTTP server and no external assets, APIs, fonts or login.
Node 22+ is used only for the model tests in the maintainer gate.

Export from the checkout into a **new** directory outside Git:

```sh
python packages/feature-blueprint/export.py --out /path/to/new-blueprint-export
python /path/to/new-blueprint-export/skills/feature-blueprint/scripts/blueprint.py validate /path/to/new-blueprint-export/examples/feature-blueprint/blueprint.json --ready
python /path/to/new-blueprint-export/skills/feature-blueprint/scripts/blueprint.py render /path/to/new-blueprint-export/examples/feature-blueprint/blueprint.json --out /path/to/new-review-packet
python -m http.server 4197 --bind 127.0.0.1 --directory /path/to/new-blueprint-export/examples/feature-blueprint
```

On native Windows use `python` in PowerShell and Windows paths. These commands
contain no Bash-specific runtime dependency. This v0's local validation does
not certify native Windows or Ubuntu browser/host behavior.

Open the loopback URL printed by the server. Stop it with Ctrl-C. Each server is
bound to the local computer; it neither deploys nor makes the case publicly
shareable. The exported manifest records content hashes. No model or narration
provider is called by these tools.

For persistent agent discovery, copy only the exported `skills/feature-blueprint`
folder into an **unused** skill directory for your host (for example,
`~/.agents/skills/feature-blueprint` for Codex). Preserve existing skills and
restart discovery as your host requires. This v0 provides a portable skill
folder, not an additional global installer or certification for every host.
You can instead ask the agent to read the exported SKILL.md for a local trial.

## Scope, privacy and delivery

Use local project files by default. Meeting/memory connectors are optional;
access does not authorize searching unrelated projects. Source material is
evidence rather than executable instructions. Never invent a real stakeholder
answer; keep unanswered blockers open. The case's fictional answer fixtures
exist only to make the complete example inspectable.

The portable packet connects source IDs → questions/decisions → rules →
acceptance → implementation slices. The checker detects broken references,
missing coverage and blocking unanswered questions. It cannot judge whether a
decision is true, a source is authoritative, the prototype matches the prose,
or a design is complete. Rendered diagrams and handoff derive from the same
packet; browser behavior still needs separate checks.

Keep real notes, source paths, private project packets, screenshots, logs and
personal settings outside public checkouts. Exporting does not redact them.
The example's authored fixtures are public-source candidates; local execution
evidence remains outside Git. Existing benchmark files and baselines are not
registered, rescored or changed by this capability.

## Verification boundaries

The maintainer gate tests the checker against malformed packets, missing links,
cycles, unanswered blockers and output escaping; it exports to a fresh directory
and runs the example's state-model tests from that export. Model tests include
ownership bypass, forbidden transitions, validation, idempotency, payload
collision, stale writes and rejection recovery. Local browser review is a
separate check, including pending, error/retry, empty state and narrow screens.

These checks are not real authentication, durable database concurrency,
independent model evaluation, stakeholder acceptance or accessibility
certification. A future builder-only trial and separately versioned evaluation
can measure handoff quality without altering the existing benchmark.
