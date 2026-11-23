# Requests

Read when the receiver has to do something for the sender: review, run, test,
approve, decide, fix, or send back a file, a number or an answer. A message that
reports work and also asks for something is a request. The shape below replaces
the usual order of a message; the rules on wording, status and truthfulness
still apply.

A request is ready when the receiver knows everything they must do after the
first screen, and the check at the end passes.

## First, list the asks

Before writing, list every action the receiver must take for the sender to be
unblocked. Include what they hand back: a commit, a report, a count, a yes or
no. Each ask becomes one item in the message. The rest of the source material
is background, and most of it stays in the linked artifact.

## The message, in this order

1. **Opener, at most 40 words.** Greet the receiver, say what you need in plain
   words, and say why it has to be them or what is blocked. End with the number
   of asks: "Four things:".
2. **The asks: one numbered list, directly under the opener.** One action per
   item, verb first, at most 40 words. Put inside the item whatever that action
   needs:
   - the link, branch, path or file name;
   - each command on its own line, indented under the item, exactly as it is run;
   - the form of the answer you want back (a count, yes or no, a name), and any
     limit on what may be shared;
   - the size of the task, in counts you have (files, lines, documents).

   Give any identifier the receiver may not know (a ticket, build, pipeline or
   function name) a link or a few words saying where it lives, once.
3. **What it is: one or two sentences, at most 45 words.** What a user sees, or
   what now behaves differently.
4. **Pictures: one line per still.** See the next section.
5. **Where to look: up to three bullets.** Only what changes how the receiver
   does the asks: the place that decides, the risky path, what must stay
   unchanged.
6. **Why and limits: last, at most 45 words.** The reason behind an ask, what is
   failing and why, and where the known gaps and the checks not yet run are
   written.

The whole message is at most 200 words; most requests need fewer. If it runs
over, shorten parts 6, 5 and 3, in that order, by removing explanation. The asks
stay complete, and so does the pointer to the known gaps and unrun checks. Do not
close up spacing or abbreviate to pass the count: the check counts `+12 / -3` and
`+12/-3` the same.

After the list, write statements only: anything the receiver should do is an
item in the list.

## Pictures

If the work shows on a screen (a page, a dialog, a message a user reads, a state
they reach), the message carries a still of it, placed under part 3.

1. Look for a still that already exists: screenshots or traces from an
   end-to-end test or walk that reaches the screen, earlier capture output,
   images on the pull request or ticket. Inspect it, then put it in as an image
   line whose caption says what the screen shows.
2. If none exists and the task lets you run the application, its capture
   (Capture, `demo-capture`, when the project has an adapter) or the test that
   reaches the screen, take the still there. A passing test often keeps no
   images, so run it once with its screenshot or trace option on.
3. If you can reach neither, write one placeholder line per still, in its place
   in the message: `[screenshot: which screen, in which state]`. In your reply
   to the sender, list each placeholder, say where it can be taken (the walk,
   the page, the test data), and say that the message is not ready to send until
   each line is replaced by its picture.

If the work has no screen (a backend, schema, configuration or data change),
write no picture line and run the check with `--no-visual`.

## Check before handing over

```bash
python3 "<skill-dir>/scripts/check_request.py" <message file>
```

`<skill-dir>` is the folder holding this skill's `SKILL.md`. The script needs
Python 3, standard library only. It reads the message as the receiver would and fails when:

- the opener runs past 40 words, or there is no numbered list;
- the number in the opener differs from the number of items;
- an item runs past 40 words;
- a second numbered list, or request wording, appears after the list;
- a paragraph or bullet after the list runs past 45 words;
- there is no picture line (unless `--no-visual`);
- the message runs past 200 words.

Fix the message and run the check again until it prints `RESULT: PASS`. In your
reply to the sender, say in one line that it passed; paste its output only when a
check still fails, with the reason. The check does not read meaning, so compare
the list with your asks yourself. Without Python 3, go through the same
conditions by hand and say in your reply that the script was not run.

## Example

An authored fictional example. Replace every fact with the current task's.

```text
Hi Mateo, I need your sign-off on the new late-fee rule and a dry run against the March ledger, which I can't open. Three things:

1. Read the change: https://example.com/billing/changes/412 (2 files, 85 lines).
2. Run the dry run on your machine:
   make late-fees DRY_RUN=1 MONTH=2026-03
3. Reply with two numbers from its summary line: accounts charged and total fees. Numbers only, no account names.

What it does: late fees now start on day 8 instead of day 1 and never exceed 5% of the unpaid amount. Accounts on a payment plan are skipped.

![Invoice showing the new late-fee line and its "capped at 5%" note](shots/invoice-late-fee.png)

Where to look:
- the cap in fees/cap.py: it rounds down, so a fee under one cent becomes zero
- payment-plan accounts: skipped by plan status, not by the old flag

Why: the old rule overcharged 14 accounts in February. The ledger export holds customer names, so only you can run it. Known gaps and the checks I couldn't run are in the change description.
```

When no still can be reached, the picture line becomes
`[screenshot: an overdue invoice with the new late-fee line]`.
