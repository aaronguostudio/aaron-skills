# Authenticated video showcase fixture

An entirely fictional Ledgerlane invoice-review app for public Aaron Skills videos.
It is a separate example; existing benchmark fixtures and results are unchanged.

```sh
node examples/showcase-review/server.mjs
```

Open the printed loopback URL. A cookie-gated demo session is required for the app
and its API. Select **Continue as demo reviewer** on the local access page; no
password, real identity provider or customer account is used. Sessions expire after
30 minutes. The server binds only to 127.0.0.1, and all invoices, approvals and audit
entries are temporary server memory. Restarting restores the fictional seed.
This is neither production authentication nor accounting/payment software.

With the Demo bundle installed, choose a private session directory outside Git
using `DEMO_CAPTURE_HOME`, then run:

```sh
aaron-demo sign-in --project examples/showcase-review --env local
```

Select the demo reviewer in the browser window. The normal Capture sign-in flow
saves its session outside the recording. Then record the included `review-batch`
walk with `--write-go-ahead` and an external `--out` directory. Keep the server
running. Each recording resets only this fixture's fictional data before starting.

```sh
aaron-demo capture --project examples/showcase-review --env local \
  --walk review-batch --write-go-ahead --out <external-workspace>/capture
aaron-demo render <external-workspace>/capture --template minimal \
  --cover --stills --out <external-workspace>/delivery/walkthrough.mp4
```

The short scenario codes INV-2041, selects it with INV-2042, checks two invoices
and $2,000.00, approves the simulated batch and verifies the saved result after
reload. A real customer sign-in remains a human action through Capture's normal
visible sign-in flow; the synthetic bootstrap helper must never be adapted to
enter a person's credentials.

Recordings, sessions, narration, voice profiles and review logs stay outside Git.
Only deliberately reviewed final showcase exports may be published to the website's
media store; the capture directories and session files are never uploaded.
