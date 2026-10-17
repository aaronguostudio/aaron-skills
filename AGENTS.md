# Contributor instructions

Keep all work local unless the user explicitly authorizes publishing. Do not add a remote or push as part of tests.

Keep skill entry points concise and host-neutral. Document runtime prerequisites explicitly. Platform-specific integrations are optional adapters and must not become a hidden requirement of the capture contract.

Use the explicit Demo bundle manifest when adding runtime files. Tests must load and render from an exported installation to catch missing transitive imports. Run output and user configuration stay outside source control.

Run the deterministic tests appropriate to a change, then the isolated installed smoke check when packaging or runtime changes. Treat model routing evaluations, mocked provider tests, browser tests, and visual acceptance as separate evidence. Never label an untested platform or host as supported.
