// Public loopback fixture only. Exercises the installed capture -> render -> message chain.
import { createServer } from 'node:http'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { main as capture } from '../packages/demo/capture/scripts/cli.mjs'
import { sessionPaths } from '../packages/demo/capture/scripts/session.mjs'

const bundle = resolve(import.meta.dirname, '..')
const config = JSON.parse(await readFile(join(bundle, 'installed.json'), 'utf8'))
const temporary = await mkdtemp(join(tmpdir(), 'aaron-demo-smoke-'))
const project = join(temporary, 'fixture')
const captureHome = join(temporary, 'capture')
const run = join(captureHome, 'demo-tools-smoke', 'runs', 'tour')
const html = (title, content) => `<!doctype html><html lang="en"><head><title>${title}</title>
<style>body{font:22px system-ui;margin:0;padding:70px;background:#f4f6fa;color:#172033}main{max-width:1050px}
button{font:inherit;padding:14px 24px;background:#1e40af;color:white;border:0;border-radius:10px}section{background:white;padding:28px;border-radius:16px;margin-top:24px}li{margin:16px}</style>
</head><body><main><h1>${title}</h1>${content}</main></body></html>`
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8')
  response.end(request.url === '/details'
    ? html('Demo result', '<section aria-label="Result"><h2>Three example items</h2><ul><li>Camera ready</li><li>Captions ready</li><li>Message ready</li></ul></section>')
    : html('Demo tools check', '<p>This local example verifies your installation.</p><button onclick="location.href=\'/details\'">Open result</button>'))
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const url = `http://127.0.0.1:${server.address().port}`
try {
  await mkdir(join(project, 'demo-capture/walks'), { recursive: true })
  await writeFile(join(project, 'demo-capture/config.mjs'), `export default {
    contract:1,name:'demo-tools-smoke',environments:{local:{url:${JSON.stringify(url)},production:false,hosts:['127.0.0.1']}},
    signInPath:'/',isSignedOut:()=>false,revision:async()=>'local-smoke-1'
  }`)
  await writeFile(join(project, 'demo-capture/walks/tour.mjs'), `
  export default{title:'Demo tools installation check',writes:false,async run({page,rec,checks}){
    await rec.step('overview','A local example is ready','action',async()=>{await rec.focus({heading:page.getByRole('heading',{name:'Demo tools check'})})});
    await rec.step('open','Open the result','action',async()=>{await rec.click(page.getByRole('button',{name:'Open result'}))});
    await rec.step('load','Wait for the result','wait',async()=>{await page.getByRole('heading',{name:'Demo result'}).waitFor()});
    await rec.step('result','Three example items are ready','action',async()=>{await rec.show({items:{at:page.getByRole('listitem'),count:3,target:page.getByRole('region',{name:'Result'})},heading:{at:page.getByRole('heading',{name:'Three example items'}),text:'Three example items'}})});
  }}`)
  // This public fixture has no sign-in. Seed an empty, private state so no sign-in window opens.
  const session = sessionPaths(captureHome, 'demo-tools-smoke', 'local')
  await mkdir(session.dir, { recursive: true, mode: 0o700 })
  await writeFile(session.state, JSON.stringify({ cookies: [], origins: [] }), { mode: 0o600 })
  const code = await capture(['--project', project, '--env', 'local', '--walk', 'tour', '--out', run], { root: captureHome })
  if (code) throw Error(`Local capture failed (${code})`)
} finally {
  await new Promise(done => server.close(done))
}
// All smoke helpers use the installed virtual environment, including Pillow.
// A developer's global packages must never make an incomplete install pass.
const python = join(bundle, '.venv', process.platform === 'win32' ? 'Scripts' : 'bin', process.platform === 'win32' ? 'python.exe' : 'python3')
const cli = join(bundle, 'scripts/cli.py')
execFileSync(python, [cli, 'render', run, '--stills'], { stdio: 'inherit' })
const steps = JSON.parse(await readFile(join(run, 'steps.json'), 'utf8'))
const last = steps.at(-1)
await writeFile(join(run, 'message.md'), `---
title: Demo tools installation check
hint: Copy the text, then paste the screenshot under its step in Teams.
lang: en
video: walkthrough.mp4 | Local installation check
---
Hi,

The demo tools completed a local recording and rendered its walkthrough video.

## What to check

1. The result shows three example items.

![Three example items](${last.shot})

Please check that the screenshot and attached walkthrough are readable.

Thanks.
`)
execFileSync(python, [cli, 'page', join(run, 'message.md'), '--out', join(run, 'message.html')], { stdio: 'inherit' })
const probe = JSON.parse(execFileSync(config.tools.ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', join(run, 'walkthrough.mp4')], { encoding: 'utf8' }))
// ffprobe names full-range 8-bit 4:2:0 as yuvj420p; both formats are compatible H.264 output.
const video = probe.streams.find(stream => stream.codec_name === 'h264' && ['yuv420p', 'yuvj420p'].includes(stream.pix_fmt))
if (!video) throw Error('Expected 8-bit 4:2:0 H.264 video')
if (!(await readFile(join(run, 'message.html'), 'utf8')).includes('data:image/')) throw Error('Screenshot was not embedded')
execFileSync(python, [join(bundle, 'scripts/check-smoke.py'), run], { stdio: 'inherit' })
const manifest = JSON.parse(await readFile(join(bundle, 'bundle-manifest.json'), 'utf8'))
// Explicit masking is optional and reuses this capture. Verify the installed final
// renderer, preview, held-frame exports and embedded Share image, not only metadata.
const masked = join(temporary, 'masked')
const maskPatch = join(temporary, 'mask-patch.json')
const rawCapture = JSON.parse(await readFile(join(run, 'capture.json'), 'utf8'))
const headingBox = steps[0].targets.heading.boxes[0]
const mask = {box:[headingBox.x-6,headingBox.y-6,headingBox.w+12,headingBox.h+12],fromMs:steps[0].startMs,toMs:last.endMs}
await writeFile(maskPatch, JSON.stringify({masks:[mask]}))
execFileSync(python,[cli,'revise',run,maskPatch,'--out',masked],{stdio:'inherit'})
execFileSync(python,[cli,'render',masked,'--preview'],{stdio:'inherit'})
execFileSync(python,[cli,'render',masked,'--stills'],{stdio:'inherit'})
await writeFile(join(masked,'message.md'),`---\ntitle: Masking check\nvideo: walkthrough.mp4 | Masked video\n---\n![Masked result](stills/01-${steps[0].id}.jpg)\n`)
execFileSync(python,[cli,'page',join(masked,'message.md'),'--out',join(masked,'message.html')],{stdio:'inherit'})
execFileSync(python,['-c',`
from pathlib import Path
from PIL import Image
import base64,io,json,re,sys
root=Path(sys.argv[1]); paths=[root/'body-preview.png',*sorted((root/'stills').glob('*.jpg'))]
images=[Image.open(p).convert('RGB') for p in paths]
box=json.loads((root/'capture.json').read_text())['masks'][0]['box']
embedded=re.search(r'data:image/[^;]+;base64,([^"\\s]+)',(root/'message.html').read_text())
assert embedded, 'Masked Share page must embed a rendered still'
images.append(Image.open(io.BytesIO(base64.b64decode(embedded[1]))).convert('RGB'))
for img in images:
 # Include the full glyph area, including the left edge and all four corners.
 for x in range(int(box[0])+2,int(box[0]+box[2])-2,7):
  for y in range(int(box[1])+2,int(box[1]+box[3])-2,7):
   assert max(abs(a-b) for a,b in zip(img.getpixel((x,y)),(17,24,39))) < 10, 'Mask missing in rendered/embedded pixels'
print('MASK PIXELS PASSED: preview, MP4 stills and embedded Share image')
`,masked],{stdio:'inherit'})
if (JSON.parse(await readFile(join(run,'capture.json'),'utf8')).masks !== rawCapture.masks) throw Error('Original capture was modified')
if (!(await readFile(join(run,'video.webm'))).equals(await readFile(join(masked,'video.webm')))) throw Error('Masking changed raw evidence')
await writeFile(join(run, 'smoke-report.json'), JSON.stringify({ passed: true, sourceRevision: manifest.sourceRevision, bundleId: manifest.id, run, steps: steps.length, video: `H.264/${video.pix_fmt}`, page: 'message.html' }, null, 2))
await writeFile(join(masked,'mask-smoke-report.json'),JSON.stringify({passed:true,sourceRevision:manifest.sourceRevision,bundleId:manifest.id,maskCount:1,sourceRetained:true,preview:true,mp4Stills:true,embeddedPage:true},null,2))
console.log(`MASK SMOKE PASSED\nMasked page: ${join(masked,'message.html')}\nMasked video: ${join(masked,'walkthrough.mp4')}`)
console.log(`SMOKE PASSED\nReview page: ${join(run, 'message.html')}\nVideo: ${join(run, 'walkthrough.mp4')}\nReport: ${join(run, 'smoke-report.json')}`)
