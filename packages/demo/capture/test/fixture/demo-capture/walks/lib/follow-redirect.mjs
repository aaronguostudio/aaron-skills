// Shared by the walks that follow a link whose route answers with a redirect. A helper, not a
// walk: it lives in a subfolder, where the loader does not look for walks.
const HOP_TIMEOUT_MS = 10_000
export const UNOBSERVED_REDIRECT_DNS_FAILURE = 'The browser could not resolve the redirected host before exposing its target request.'

// Clicks `link`, and returns once the redirect's hop has ended: loaded, or refused by the browser's
// own DNS rules. The engine's guard has judged the hop by then, because the context hears a
// request when it starts and this waits for it to end. The wait is set up before the click, which
// can return after the hop is over, and it has a timeout, so a hop that never comes fails the step
// instead of hanging it.
export async function clickAndFollowRedirect(page, rec, link) {
  const isHop = (request) => request.redirectedFrom() !== null
  // Chromium sometimes reports a blocked named redirect as a DNS error on the
  // original literal-IP request, without exposing the target Request at all.
  const hiddenDnsFailure = (request) => request.redirectedFrom() === null
    && new URL(request.url()).hostname === '127.0.0.1'
    && new URL(request.url()).pathname.startsWith('/bounce-post')
    && request.failure()?.errorText === 'net::ERR_NAME_NOT_RESOLVED'
  const ended = (event, predicate) => page.waitForEvent(event, { predicate, timeout: HOP_TIMEOUT_MS })
  const hopEnded = Promise.race([
    ended('requestfinished', isHop),
    ended('requestfailed', request => isHop(request) || hiddenDnsFailure(request))
  ])
  // A failed click leaves the wait pending: its later timeout must not be an unhandled rejection.
  hopEnded.catch(() => undefined)
  await rec.click(link)
  const request = await hopEnded
  if (!isHop(request)) throw new Error(UNOBSERVED_REDIRECT_DNS_FAILURE)
}
