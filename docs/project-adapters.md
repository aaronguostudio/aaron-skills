# Demo capture

The engine drives a real browser through one of a project's scripted walks and writes a capture folder (contract 1, `capture-contract.md`). The installed renderer turns a passed capture into a captioned mp4.

Nothing app-specific lives here. A project joins with a `demo-capture/` folder holding `config.mjs` and `walks/*.mjs`, with no `package.json` and no dependencies of its own.

## Run it

The commands below use the installed Demo bundle. Read [installation](installation.md) first.

This skill is usually reached through a symlink, so resolve its real directory first:

```bash
ENGINE=$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "<skill-dir>")
aaron-demo capture --project "<dir>" --list                  # walks, environments, params
aaron-demo capture sign-in --project "<dir>" --env <env>     # a person signs in; nothing is recorded
aaron-demo capture --project "<dir>" --env <env> --walk <walk> [--set key=value] [--out "<dir>"] [--headed]
aaron-demo capture --project "<dir>" --env <env> --walk <walk> --learn-hosts
aaron-demo render "<run folder>" --stills
```

| Flag | Meaning |
|---|---|
| `--project <dir>` | the folder that holds `demo-capture/config.mjs`; default: the current folder |
| `--list` | print the walks (read-only or writes), the environments and the gate each one has, and the params. Needs no `--env` and opens no browser. |
| `--env <env>` | required, no default: an environment the config declares |
| `--walk <walk>` | required to run: a file in `demo-capture/walks/`, without `.mjs`. `sign-in` takes none. |
| `--set key=value` | a param the config declares; repeat it for several. Split at the first `=`; a key given twice, or one the config does not declare, is refused. |
| `--out <dir>` | the run folder, instead of the default below. It must be a folder that is empty or new, may not be inside a git repo, and may not overlap the session folder. Inside `~/.demo-capture` it must be under `~/.demo-capture/<project>/runs/`. |
| `--headed` | show the browser while recording |
| `--learn-hosts` | see Hosts |
| `--prod-go-ahead`, `--write-go-ahead` | see Go-ahead |
| `--help`, `-h` | print the usage |

- Start the CLI as a background command (or with a timeout of at least 15 minutes) and wait for it to exit before reading the run folder. A walk takes minutes, and a sign-in waits up to 10.
- A first run of an environment, `sign-in`, and a run whose saved session has expired open a sign-in window. An expired session only shows once the run starts, so warn the person before every run or `sign-in`, unless you know the session is fresh (see Sign-in is always the person's).
- A run prints `Run folder: <folder>` as soon as it makes the folder, so even a run that crashes later says where it is. The folder is `~/.demo-capture/<project>/runs/<yyyymmdd-hhmmss>-<walk>/` unless `--out` set another (`<project>` is the config's `name`). A refused run removes the folder again if it is empty. At the end the run prints `Captured: <folder>` when it passed, or `FAILED: <folder>` with the step and the reason when it did not. Read `capture.json` there:
  - `status: "passed"`: render it. The renderer writes `<run folder>/walkthrough.mp4` and `<run folder>/chapters.txt` (`chapters.txt` goes beside the mp4, so beside a `--out` file of the renderer's too). The video is silent unless `--narrate` is passed (`--script` narrates too). Narrate only when the person whose voice it is asked for it; narration is described in `capture-contract.md`.
  - `status: "failed"`: the renderer refuses any capture that is not passed, so there is no video to send, though the folder may still hold a raw `video.webm`. Say which step failed (`failedStep`, null when it failed before the first step) and why (`failure`), in plain words.
  - No `capture.json`: an unexpected engine error, which is not a refusal (see Exit codes). Report the error output and do not guess at the cause.
- Exit codes:
  - 0: captured. A `--learn-hosts` run that reached the end of its walk also exits 0, even though its `capture.json` says `failed`.
  - 1: the walk failed. A `--learn-hosts` run that stopped early also exits 1, and its lists may be incomplete. An unexpected engine error, which is not a refusal, also exits 1, with a stack trace on stderr and possibly no `capture.json`.
  - 2: refused. Nothing was captured, and stderr says why as `demo-capture: <reason>`. It is usually one plain sentence: a missing go-ahead, a held run lock, a browser that will not start, a sign-in page that did not load or a sign-in that did not finish, a saved session that cannot be read. Arguments the CLI cannot parse add the usage text, and an invalid config or walk prints a bulleted list of its problems.
- For a new computer on a verified platform, use [the demo-tools installer](installation.md). It installs locked dependencies and this Playwright version's Chromium, including the headed browser for sign-in. Once installation is authorized, routine dependency preparation needs no separate confirmation. Use the installed `aaron-demo capture` command to retain the configured browser path. A missing browser is an installation problem, not a reason to change the project's environment or guards.

## Rules

- **Sign-in is always the person's.** The first run of an environment, `sign-in`, and a run that finds the saved session signed out each open a visible browser at the app's sign-in page, and the person signs in there. Never type credentials and never ask for them. Warn the person before every run or `sign-in`, unless you know the session is fresh, since an expired session only shows once the run starts: tell them that a sign-in window may open and that they need to be at the machine. It waits up to 10 minutes, and if nobody signs in in that time, or the window is closed, the run exits 2. Signed in means the page is back on the app's own origin and `isSignedOut` has been false for 3 seconds. While recording, the start page and the page after `setup` count as signed out when they are off the app's origin or `isSignedOut` says so; before each step only `isSignedOut` is asked. After a signed-out run the engine deletes the old session, empties the run folder, and records the walk again from the start. The session is kept in `~/.demo-capture/<project>/<env>/state.json` (folder 0700, file 0600), outside every repo. Never print, copy or upload it.
- **Go-ahead.** Add a go-ahead flag only after the person's go-ahead in chat for that run, every run, even if they approved an earlier one.
  - A production environment needs `--prod-go-ahead` on every walk run. That one flag also covers a walk that writes: there is no second flag in production. When you ask for it, say whether the walk writes (`--list` shows it).
  - In another environment whose config sets `writeGoAhead: true`, a walk that writes needs `--write-go-ahead`.
  - `sign-in` needs no go-ahead, even in production: nothing is recorded, and a person drives it.
  - `--learn-hosts` is refused on a production environment and for a walk that writes.
- **Hosts.** Every request must go to a host in the environment's `hosts`; any other request fails the run.
  - Outside learning runs, the browser's resolver refuses every name that is not in `hosts`. That includes IP literals such as `127.0.0.1` and `localhost`. The list must hold every host the app uses, exactly as it appears in URLs: the app's own, its API, its asset and font hosts, its identity provider. Propose a missing host to the person, and add it to the config only after they approve it.
  - In contract 1, `hosts` entries can name a host or a host and port. A bare name matches any port. An explicit host:port entry restricts matching to that port.
  - A redirect to an unlisted identity-provider host fails the run as a host-lock violation, and the failure names the host (`<host> is not in this environment's hosts`). Propose the provider's host to the person, and add it only after they approve it. `--learn-hosts` also finds it when the walk passes through the provider during the recording. If the provider only shows up because the saved session expired, the session is signed in again before the walk is recorded, and the learning run then never visits the provider, so it cannot list it. The sign-in window itself is not host-locked, so a sign-in that works does not show that the provider is listed.
  - `--learn-hosts` runs a read-only walk with the lock lifted for reads. It lists the hosts the walk used that are not in `hosts`, and the requests it refused because the walk is read-only. Its `capture.json` says `failed` ("Learning run, no video."), so there is nothing to render. For its exit code, see Exit codes.
  - Add a host to the config only after the person approves it.
- **Read-only walks** (`writes: false`, the default) may only read: GET, HEAD and OPTIONS. Any other method fails the run, unless the project lists the request in `readOnlyAllowed`. A read the project lists in `readOnlyForbidden` fails the run too, and that wins over `readOnlyAllowed`.
  - The engine judges every HTTP request the pages send, from `setup` and `beforeStep` as much as from the walk, and from a page's dedicated workers, `sendBeacon` and `keepalive` fetches. Service workers are blocked, and so are shared workers, whose requests the engine could not see: a page that starts one fails the run.
  - Read-only judges HTTP requests, not WebSocket messages. A socket is judged once, when it opens, as a GET to its URL; nothing it sends after that is judged.
  - It judges what the browser sends for the page, nothing else. Walks, `setup` and `beforeStep` act through the page only: they never use `page.route`, `context.route`, `routeFromHAR`, `unroute*`, `page.request`, `context.request`, Node `fetch`, or a new context or browser. A walk's own route runs before the engine's and can send a request the engine never judged; the others send from Node, where neither the guard nor the browser's resolver applies. The engine fails a run in which a request it never judged finishes ("A request went out without the guard: the walk handled it with its own route"), but by then that request has gone out.
  - `revision` runs in Node, outside the guard: it stays a GET to a host in `hosts`.
  - `readOnlyAllowed` never lifts the Hosts rule: an allowed request to an unlisted host still fails. It has no effect on a walk that writes.
  - Add a `readOnlyAllowed` entry to the config only after the person approves it, as with hosts. Show them the exact rule text: their approval covers that text, not a description of it. Say which request it would allow and why it changes no data.
  - Keep a rule as narrow as the request allows: one endpoint per rule, its full URL with the query written as a pattern, and a `body` pattern when the same URL also takes a request that does change data. A rule's `url` and `body` must each match the whole URL or body, so a pattern for a part of the URL allows nothing.
  - Allow only a request the server never redirects. A 307 or 308 makes the browser send the same method and body on to the new URL before the engine can stop it: the engine sees that hop only after it is sent, can only fail the run, and says the request "was sent by a redirect the guard cannot stop". Outside `--learn-hosts` the browser still refuses a host that is not in `hosts`. A `--learn-hosts` run lets every name resolve, so there an allowed request that gets such a redirect can reach any host.
  - `--learn-hosts` lists the non-reads it refused, which is where to find the request an entry would allow. Each is shown as `POST https://app.example.com/hub/negotiate?negotiateVersion=… (no body)`: the scheme, host, port and path, the names of the query parameters with their values left out, and whether it has a body, never the body itself. A redirect hop the browser sent is never listed there, because it was not refused: its host goes in the list of hosts the walk used, and a non-read hop ends the run with the sentence above.
  - When a `readOnlyAllowed` rule of the same method comes close to a refused request, the refusal names it by its index: `(readOnlyAllowed[2] matches part of this URL but not all of it)`, `(readOnlyAllowed[2] matches this URL but not its body)`, or `(readOnlyAllowed[2] has a body pattern, and this request has no readable body)`. It never shows the query or the body.
- **One run at a time** per project and environment; `sign-in` takes the same lock. A second run is refused (exit 2) and told which lock file to delete if no run is going: `~/.demo-capture/<project>/<env>/lock`. Wait for the other run, or check that none is going and then delete that file. A lock left by a run that died is cleared by the next run.
- **Run folders stay outside every repo.** They show real screens: never move or copy a run folder, or anything in it (video, screenshots), into a repo.

## Finished videos: one quality bar

Every agent produces videos the same way, so that two runs, or two agents, give the same result.

- **Render only with the walkthrough renderer** (`render-walkthrough.ts`). Never composite, frame, re-caption or re-time a capture yourself.
  - The renderer's title card, caption band, step counter, spotlight and fast-forwarded waits are the house style.
  - Narration is `--narrate`, the concise style, in the default voice profile. Add a voice only when the person whose voice it is asked for one. Use `--script` only when asked.
- **One video per walk, one topic per walk.** Match the real feature's scope; a simple interaction can take 15–30 seconds. Do not pad a video to reach a target length.
  - When one file is wanted, render each walk first, then join the rendered mp4s with ffmpeg's concat demuxer (`-c copy`, same size and codecs). Do not re-render them into a new layout.
- **A held frame shows a finished screen.**
  - A step must not hold on a skeleton, a spinner, an "Empty" placeholder that is really a page still loading, or an error toast.
  - Wait in a `'wait'` step, which the renderer fast-forwards. A walk that cannot reach a finished screen fails, rather than recording a broken one.
- **Captions** are the step's point in a few plain words, under about 8. There are no extra labels such as EXPLAIN, ACTION or RESULT.
- **Before delivering:**
  - Watch the whole video, or check a frame from every step.
  - Remove any step that shows a loading state, an error or another customer's data, then record again.

## Add a project

`<project>/demo-capture/config.mjs`. A field this table does not name is refused.

| Field | Required | Meaning |
|---|---|---|
| `contract` | yes | `1` |
| `name` | yes | `[a-z0-9-]+`; names the session and run folders |
| `environments.<env>` | yes | `{ url, production, hosts, writeGoAhead? }`. `<env>` is `[a-z0-9-]+` and not `runs`. `url` is http(s) with no credentials, query or fragment, and its origin is the one the app ends up on once signed in: while recording, a start page off that origin counts as signed out. `production` is `true` or `false`, with no default. `hosts` follows the Hosts rule, its own host included. `writeGoAhead: true` makes a write walk there need `--write-go-ahead`. |
| `signInPath` | yes | where the person signs in, starting with `/` and not `//`, for example `/login` |
| `isSignedOut(url)` | yes | true when the page URL means signed out |
| `params` | no | `{ <name>: { default, describe } }`, both strings, set per run with `--set <name>=<value>` |
| `readOnlyForbidden` | no | `[{ method, url: RegExp }]`: reads that write. `method` is GET, HEAD, OPTIONS, POST, PUT, PATCH or DELETE; `url` is searched for in the full request URL. A pattern with the `y` flag is refused. |
| `readOnlyAllowed` | no | `[{ method, url: RegExp, body?: RegExp }]`: non-reads that change no data, which a read-only walk may still send, such as a token refresh, a socket negotiate or a telemetry beacon. `method` is POST, PUT, PATCH or DELETE: a read needs no rule, and an allowed rule never lifts a `readOnlyForbidden` one, so GET, HEAD and OPTIONS are refused here. Unlike `readOnlyForbidden`, whose `url` is searched for in the URL, `url` and `body` here must each match the whole URL or body, not a part of it: give the full URL with its scheme, host, path and query as a pattern, for example `/https:\/\/app\.example\.com\/session\/token/`. The `y` flag is refused; `g` and `m` have no effect, because `^` and `$` always mean the start and end of the whole text. `.` does not match a newline, so a multi-line body (a Sentry envelope is newline-separated JSON) needs the `s` flag or `[\s\S]`. One endpoint per rule. A rule with `body` never matches a request that has no readable body, so a bodiless POST needs a rule without `body`. Every entry needs the person's approval before it is added. |
| `sameTabLinks` | no | `true`: links that would open a new tab open in this one while recording. Without it, a second tab fails the run. |
| `setup({ page, params, baseUrl })` | no | runs after the start page loads, before the first step; not in the rendered video. The engine does not wait again after `setup`, so a `setup` that reloads or navigates must return only once the page has settled, on the app's origin. |
| `beforeStep({ page, params, stepId })` | no | runs before every step; throw to stop the run |
| `revision({ baseUrl })` | no | the app's build, stored as `appRevision`; `unknown` when it is missing, throws, or takes over 10 seconds. It runs in Node, outside the guard, so it stays a GET to a host in `hosts`. |

`<project>/demo-capture/walks/<name>.mjs`:

```js
export default {
  title: 'Short title for the title card',
  description: 'Optional subtitle; --list shows it',
  writes: false,
  startPath: '/path',
  async run({ page, rec, checks, params, baseUrl }) {
    await rec.step('open', 'Caption shown in the video', 'action', async () => {
      await rec.click(page.getByRole('button', { name: 'Open' }))
    })
  },
}
```

- `title` and `run` are required. `writes` defaults to `false` and `startPath` to `/`. A field not shown above is refused.
- `rec.step(id, caption, 'action' | 'wait', fn)` defines a step. Ids are unique within a walk and use letters, digits, `-` and `_` only (they name the screenshot files). Steps do not nest. A `wait` step is fast-forwarded in the video.
- `rec.click(locator)` and `rec.type(locator, text)` log the click for the drawn cursor and work only inside a step. `rec.type` refuses a password field, also one its click puts the focus on (a label's field, or one inside a component).
- The engine accepts leave-this-page prompts and dismisses other dialogs, unless the walk handles `page.on('dialog')` itself.
- Walks, `setup` and `beforeStep` act through the page only. They never use `page.route`, `context.route`, `routeFromHAR`, `unroute*`, `page.request`, `context.request`, Node `fetch`, or a new context or browser: what those send skips the engine's guard (see Read-only walks). `revision` runs in Node and stays a GET to a host in `hosts`. Read-only judges HTTP requests, not WebSocket messages.
- Find elements by their visible labels (`getByRole`, `getByText`). Set data up through the app's own UI, inside steps.
- Every top-level `walks/*.mjs` is a walk, named in lowercase letters, digits and dashes, and `--list` loads them all, so a helper left there breaks `--list` too. Put shared helpers in a subfolder such as `walks/lib/`, or outside `walks/`.

## Checked evidence and reusable focus

Use a separate settled result step with `rec.show`. Declare every field supporting its claim
once; the shared helper verifies all values and highlights their entire target group. `at`
is the exact text/numeric field; optional `target` is a containing metric card or list.
It must contain every checked element. A multi-match target covers all matches. Hidden,
missing, offscreen or unrelated targets fail rather than silently dropping a card.

```js
const cards = page.getByRole('region', { name: 'Batch summary' }).locator('.metric')
await rec.step('batch-summary', 'Two invoices approved, $2,000.00', 'action', async () => {
  await rec.show({
    count: { at: cards.nth(0).locator('strong'), integer: 2, target: cards.nth(0) },
    total: { at: cards.nth(1).locator('strong'), dollarMinor: 200000, target: cards.nth(1) },
    status: { at: cards.nth(2).locator('strong'), text: 'Approved', target: cards.nth(2) },
  })
})
```

The example is a pattern, not a universal app selector: use your app's labels/fields.
An evidence entry has `at`, exactly one of `text`, `integer`, `dollarMinor`, `count`, and
optional `target`. Assertions retry as described below and are checked again after the hold.
The default hold is 900 ms (`{holdMs: 1200}` overrides it, range 1–10000). The retained screenshot
is refreshed after the initial assertions. Do not combine clicks and a show/focus group in
one step; this keeps the checked result distinct from its triggering action.

For display-only targets use `await rec.focus({heading: locator, cards: multiMatchLocator})`.
It shares the same grouping and geometry logic, without inventing business assertions.
Both methods store named `targets` in `steps.json`. `show` additionally stores the declared
exact-check receipts under `evidence`; these are local workflow metadata, not attestations.
Use the entire group of actual cards, not a full-width container including blank space.

After **the first passed capture**, presentation fixes already use `aaron-demo inspect` +
`revise` + `render`. Named geometry eliminates a new UI probe just to measure those targets.
See [presentation revisions](presentation-revisions.md). A new recording is appropriate when
UI evidence, action order or business correctness must change.

## Develop

In `packages/demo/capture`: `npm ci` and `node node_modules/playwright/cli.js install chromium`, then `npm run test:unit`, `npm run test:e2e` (needs ffprobe and npx) or `npm test` for both, and `npm run mutation-check`. `DEMO_CAPTURE_HOME` replaces `~/.demo-capture`; the tests use it.

## Exact assertions for business evidence

The runtime supplies `checks` to `run({ page, rec, checks, ... })`; adapters need no extra package or import. Use scoped, visible UI fields, never `text.includes('2')` to assert a count. A surrounding amount or count such as `12` can otherwise satisfy that predicate.

```js
await checks.count(page.locator('tbody tr'), 2) // number of matching DOM elements
await checks.integer(page.getByTestId('selected-count'), 2) // entire numeric field
await checks.dollarMinor(page.getByTestId('selected-total'), 200000) // exactly $2,000.00
await checks.text(page.getByTestId('selection-summary'), '2 invoices selected $2,000.00')
```

The selectors above illustrate scoping; use fields that actually exist. `text` compares the entire string after whitespace normalization. `integer` accepts only a nonnegative integer field. `dollarMinor` accepts only a dollar display such as `$2,000.00` or `$2000.00` and compares safe integer minor units, rejecting malformed grouping and one-cent differences. Other locales/currencies use exact `text`; do not guess a locale. Field checks require exactly one visible match; `count` counts the whole selector (filter it to visible rows if necessary). A DOM count of a partial numeric-text selector is refused: for example,
`checks.count(banner.filter({hasText: '2 invoices approved'}), 1)` only proves one banner
contains that substring and could accept **12**. Use `checks.text(banner, fullExpectedText)`
or separate typed fields instead. Collection membership by ID can use an exact text/role
selector (including a row's exact-ID cell). The diagnostic guard covers common Playwright
partial text forms in the pinned version; it cannot analyze arbitrary JavaScript predicates
or infer undeclared business claims. Exact checks and correct scoping remain necessary.

Checks retry for up to 5 seconds; an optional final `{ timeoutMs: 10000 }` sets the bound. Check final results in a wait/result step, and verify saved business state after reload when the claim concerns persistence. These helpers do not replace choosing the correct scope or checking the actual target IDs.
