# Walkthrough video

A capture drives the app, records the screen and writes a capture folder. The tool that does it depends on the project:
the demo-capture engine when the project has an adapter, the project's own `demo:capture` script when it has none,
and with neither there is no video (step 1).
The renderer that ships beside this skill turns that folder into a captioned mp4 plus chapters,
silent unless the user asks for narration. The message stays the main thing; the video is an attachment.

## Language and narration

Default all deliverables to English unless the user explicitly requests another language. Narration requires the user's own provider account and authorization for its usage. A language correction reuses the passed capture and approved voice settings.

## 1. Find the capture command

Look in this order, and use the first that applies:

1. **Adapter.** Walk up from the working directory, looking for `demo-capture/config.mjs`. The first directory that has one is the project. The walk stops at `$HOME`: it checks `$HOME` itself and never looks above it. A working directory outside `$HOME` is checked alone, with no walk up.

   ```bash
   d=$PWD; case "$d/" in "$HOME"/*) up=1 ;; *) up=0 ;; esac
   while [ ! -f "$d/demo-capture/config.mjs" ]; do
     if [ "$up" = 0 ] || [ "$d" = "$HOME" ] || [ "$d" = / ]; then d=; break; fi
     d=$(dirname "$d")
   done; echo "${d:-no adapter}"
   ```

   - The engine is the `demo-capture` tile beside this skill's real directory. The skill is usually reached through a symlink, so resolve that first. Shell variables do not carry over between commands, so set `$SKILL` in each command that uses it. `<project>` is the directory the loop printed:

     ```bash
     SKILL=$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "<skill-dir>")
     node "$SKILL/../demo-capture/scripts/cli.mjs" <arguments>
     ```

     The `<arguments>`, one command at a time:

     - `--project "<project>" --list`: the walks, the environments and the go-ahead each one needs.
     - `sign-in --project "<project>" --env <env>`: the person signs in; nothing is recorded.
     - `--project "<project>" --env <env> --walk <walk> [--set key=value]`: record the walk.

   - Start the CLI as a background command (or with a timeout of at least 15 minutes) and wait for it to exit before reading the run folder. A walk takes minutes, and a sign-in waits up to 10.

   - If there is no `$SKILL/../demo-capture`, there is no video. Say so; the screenshots still work.
   - Exit codes: 0 captured; 1 the walk failed, or an unexpected engine error, which prints a stack trace and may leave no `capture.json`; 2 refused (nothing was captured, and stderr says why as `demo-capture: <reason>`). Step 2 says what to do with each.
   - Prepare a new macOS computer with [the demo-tools installer](../../../../docs/installation.md), which installs the locked dependencies and Chromium. In that installation, use `"$HOME/.local/bin/aaron-demo" capture <arguments>` and `"$HOME/.local/bin/aaron-demo" render "<run>" --stills`; these commands use the installed browser path and pinned runtime.
2. **Legacy.** Otherwise, a `demo:capture` script in the current project's root `package.json` keeps its own flow. Run it with the project's package manager (`pnpm`, `npm` or `yarn`, going by the lockfile): `pnpm demo:capture --list`.
3. **Neither.** There is no video. Don't build one. The text and screenshots still work.

Then:

- Show the walks it lists. Use the walk and environment already named by the user, or ask for the missing choice. Choose a walk that actually films the requested change. If none does, write and test a relevant walk following [guided-demo.md](guided-demo.md). The engine's `--list` shows each walk as `read-only` or `writes`, and the go-ahead each environment needs.
- The command's `--help` tells you its options and guards. Follow them. The engine's flags and rules are also in `$SKILL/../demo-capture/SKILL.md`.
- **Go-ahead.** Add a confirmation or go-ahead flag only after the user's go-ahead in chat for that run. Get it every run, even if they approved an earlier one. Never add a confirmation or go-ahead flag on your own, even when a refusal names it. With the engine, the rule follows the environment:
  - A production environment: every walk run needs `--prod-go-ahead`. That one flag also covers a walk that writes; there is no second flag in production. When you ask, say whether the walk writes.
  - Any other environment follows its `writeGoAhead`. Where the config sets it, a walk that writes needs `--write-go-ahead`. Where it does not, no go-ahead is needed.
  - `sign-in` needs no go-ahead, even in production: nothing is recorded, and a person drives it.
  - A legacy command has no `writeGoAhead`: an environment that writes to shared or production systems needs the user's go-ahead for that run, before you add the command's confirmation flag.
- **Sign-in is the person's.** Never type credentials and never ask for them. Warn the person before every run or `sign-in`, unless you know the session is fresh, since an expired session only shows once the run starts: tell them a sign-in window may open and that they need to be at the machine.
  - With the engine, a window opens on the first run of an environment, on `sign-in` (it signs in and records nothing), and on a run whose saved session has expired. It waits up to 10 minutes. If nobody signs in by then, or the window is closed, the run exits 2.
  - A legacy command may open one on the first run of an environment.

## 2. Run it and read the result

What to do depends on how the command ended (step 1 lists the exit codes):

- **Exit 2 (the engine refused):** nothing was captured, so there is no `capture.json`. Stop the capture. Tell the person the `demo-capture: <reason>` sentence from stderr in plain words, and ask whether they want to retry (giving the go-ahead, if a missing one was the reason) or send the update without the video.
- **Any other run:** the command prints `Run folder: <folder>` as soon as it makes the folder, so a run that crashed later still names it, and `Captured: <folder>` or `FAILED: <folder>` at the end. Read `capture.json` there:
  - **`status: "passed"`:** go on.
  - **`status: "failed"`:** inspect the failed step and fix the walk or its authorized test-data precondition, then record again. A product bug follows the project's normal delivery workflow. State what failed and what changed. Ask only when the fix needs a user decision or additional authority; do not silently substitute an unrelated video.
  - **No `capture.json`:** the engine hit an unexpected error, which is not a refusal. Report the error output to the person and do not guess at the cause.

Never move or copy a run folder, or anything in it, into a repo.

## 3. Render

The renderer lives beside this skill's real directory. The skill is usually reached through a symlink, so resolve that first:

```bash
SKILL=$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "<skill-dir>")
aaron-demo render "<run>" --stills
```

- It writes `walkthrough.mp4` and `chapters.txt` into the run folder.
- It refuses a capture that did not pass.
- Add a voice-over only when the user asks for one. It uses the user's configured voice (ElevenLabs), costs API credits, and keeps visible process labels off unless explicitly requested. Its key setup is in `docs/capture-contract.md`. Two styles:
  - **Concise** (`--narrate`): the voice reads the captions. Short and official.
  - **Conversational** (`--script <run>/narration.conversational.json`): it sounds like a person giving the demo. Make the script reviewable and carry forward existing narration authorization. Routine requested demo narration may use existing included credits; ask before a purchase, paid overage, increased cap, or material change outside the approved scope.

### Writing a conversational script

The format is in `docs/capture-contract.md` (Narration). Write it the way the user would talk while sharing their screen with this reader:

- **Open with who and what, in one line:** "Hi Sam, here's the new order screen, start to finish."
- **Say why, and point at the screen:** "Notice the address is already filled in, so there's nothing to type here." Explain what a step achieves, not only which button it is.
- **Tie the steps together:** "Now that the order is saved, let's open it." Use first person and "let's".
- **Group quick clicks:** give one line to a run of small steps and leave the rest silent. A person never narrates every click.
- **Keep each line to one or two sentences, about 30 words at most.** A step stays on screen until its line ends, so long lines make a long video.
- **Waits are a chance to explain:** a fast-forwarded wait can carry a slightly longer line about what the system is doing.
- **Say only what the screen shows or the update says.** No numbers or claims the reader cannot see, and no names the message itself would not use.
- **Close with the result and an offer:** "And that's the order shipped, with nothing left to do. Happy to walk through it live."

Check every step id against `steps.json`; the renderer refuses an unknown one.
- If the renderer is not there (this skill was installed on its own), skip the video and say so. The screenshots still work.

## 4. Put it in the message

- **Keep it outside every repo.** When the screenshots or the video come from a capture run, `message.md`, its marked screenshot copies, the mp4 and the built page (which inlines the same screens) all stay outside every repo, because they show real screens.
  - After step 1 the working directory is usually the project's repo, so a relative path such as `shots/03-save.png` or `--out page.html` would land inside it.
  - Pick `<out-dir>`, an absolute path outside every repo: the session scratchpad or a temp folder is fine; a repo is not. Write `message.md` and the marked copies there, and give `build_page.py` an `--out` under it. Running the build from that folder works too.
- **Screenshots.** Each step's `shots/NN-<id>.png` shows the screen just before the step's first click. Mark that click from the recorded box instead of guessing coordinates; a step's later clicks happen in dialogs the shot does not show. Write the marked copies next to `message.md` (the script does not create the folder):

  ```bash
  mkdir -p "<out-dir>/shots"
  python3 "<skill-dir>/scripts/mark_screenshot.py" "<run>/shots/03-save.png" "<out-dir>/shots/03-save.png" \
    --steps "<run>/steps.json" --step save --label 3 --crop auto
  ```

- **Steps.** The captions in `steps.json` are a ready draft of the numbered steps; tighten them for the reader.
- **Chapters.** Add a short section after the steps, for example "Walkthrough video (1:42, attached)", with the lines of `chapters.txt` as a list.
- **Front matter.** Add `video: <path to walkthrough.mp4> | <label>`. Add one line per video when the message attaches several, for example `| Concise, 2:02` and `| Conversational, 2:57`.
  - The page shows a player per video and reminds the user to attach each file. A browser cannot copy a video, so the copy buttons leave them out.
  - When publishing with `--fragment`, publish each mp4 beside the page under its file name. If a host limits file size, publish a re-encoded copy and give the user the full-quality file to attach.
- **Reply.** Give the mp4's path, and tell the user to attach it to the message in Teams, Outlook or Slack after pasting the text.
