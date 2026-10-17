// Shared by the walks that follow a link whose route answers with a redirect. A helper, not a
// walk: it lives in a subfolder, where the loader does not look for walks.
const HOP_TIMEOUT_MS = 10_000

// Clicks `link`, and returns once the redirect's hop has ended: loaded, or refused by the browser's
// own DNS rules. The engine's guard has judged the hop by then, because the context hears a
// request when it starts and this waits for it to end. The wait is set up before the click, which
// can return after the hop is over, and it has a timeout, so a hop that never comes fails the step
// instead of hanging it.
export async function clickAndFollowRedirect(page, rec, link) {
  const isHop = (request) => request.redirectedFrom() !== null
  const ended = (event) => page.waitForEvent(event, { predicate: isHop, timeout: HOP_TIMEOUT_MS })
  const hopEnded = Promise.race([ended('requestfinished'), ended('requestfailed')])
  // A failed click leaves the wait pending: its later timeout must not be an unhandled rejection.
  hopEnded.catch(() => undefined)
  await rec.click(link)
  await hopEnded
}
