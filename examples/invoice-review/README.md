# Invoice review fixture

A fictional accounts-payable workflow for Demo evaluations. Run `node server.mjs` and
open the printed loopback URL (default port 3006). No account, external service,
provider key or dependencies are needed. This is a test application, not accounting software.

Filter invoices, code an invoice in its edit dialog, save with a simulated delay, select
a batch, check its preview and approve it with another simulated delay. View the batch
and its saved coding. All writes stay in server memory; Reset demo or restarting the
server restores the four seeded invoices. The HTTP server binds only to 127.0.0.1.

The evaluation provides no capture adapter: each model authors one from the UI/source.
Do not include generated recordings or session files in this folder.
