// A fixed sleep can expire before a cold recorder delivers its first frame.
// Observe the same screencast stream as recordVideo, and advance only after the
// black and white frames were actually delivered. No extra video or screenshot
// is saved, and no application state or network policy is changed.
export async function calibrateRecording(page, clock, { timeoutMs = 10000 } = {}) {
  let pending
  const expectFrame = (white) => {
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending = undefined
        reject(new Error('Recording calibration timed out waiting for a recorded frame. Preserve this capture; no timing offset was assumed.'))
      }, timeoutMs)
      pending = { white, resolve: () => { clearTimeout(timer); pending = undefined; resolve() }, reject: (error) => { clearTimeout(timer); pending = undefined; reject(error) } }
    })
    return promise
  }
  await page.screencast.start({ onFrame: async ({ data }) => {
    const waiting = pending
    if (!waiting) return
    try {
      const brightness = await page.evaluate(async (bytes) => {
        const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }))
        try {
          const context = new OffscreenCanvas(1, 1).getContext('2d')
          context.drawImage(image, 0, 0, 1, 1)
          const [r, g, b] = context.getImageData(0, 0, 1, 1).data
          return (r + g + b) / 3
        } finally { image.close() }
      }, [...data])
      if (pending === waiting && (waiting.white ? brightness > 250 : brightness < 5)) waiting.resolve()
    } catch (error) { if (pending === waiting) waiting.reject(error) }
  } })
  try {
    await Promise.all([expectFrame(false), page.evaluate(() => {
      const marker = document.createElement('div')
      marker.id = '__aaron_demo_sync__'
      marker.setAttribute('aria-hidden', 'true')
      marker.style.cssText = 'all:initial;display:block!important;position:fixed!important;inset:0!important;background:#000!important;z-index:2147483647!important;pointer-events:none!important'
      document.documentElement.appendChild(marker)
    })])
    await page.waitForTimeout(120) // retain several encoded frames at 25 fps
    const before = clock()
    // Keep command-clock semantics for existing captures/renderers. The receipt
    // gate proves the color reached the recording before the marker is removed.
    const white = expectFrame(true)
    white.catch(() => {}) // a navigation error can precede the awaiting line
    await page.evaluate(() => {
      const marker = document.getElementById('__aaron_demo_sync__')
      if (!marker) throw new Error('The application navigated during recording calibration')
      marker.style.setProperty('background', '#fff', 'important')
    })
    const tMs = Math.round((before + clock()) / 2)
    await white
    await page.waitForTimeout(120)
    return { tMs }
  } finally {
    if (pending) pending.reject(new Error('Recording calibration was interrupted'))
    await page.screencast.stop().catch(() => undefined)
    await page.evaluate(() => document.getElementById('__aaron_demo_sync__')?.remove()).catch(() => undefined)
  }
}
