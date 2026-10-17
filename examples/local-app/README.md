# Public local example

Run `node examples/local-app/server.mjs` and keep it running. Then use `aaron-demo capture --project examples/local-app --list` and `aaron-demo capture --project examples/local-app --env local --walk tour`. The first run may open a sign-in window even though this public app has no account; it completes once the app is visible. Outputs stay outside Git.

The automated `aaron-demo smoke` check uses an isolated loopback fixture and an empty session so no sign-in window is needed.
