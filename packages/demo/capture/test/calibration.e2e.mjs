import assert from 'node:assert/strict'
import {test} from 'node:test'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join,basename,dirname} from 'node:path'
import {createServer} from 'node:http'
import {execFileSync} from 'node:child_process'
import {chromium} from 'playwright'
import {calibrateRecording} from '../scripts/calibration.mjs'

test('a cold video contains the actual black-to-white calibration, not only a DOM timestamp', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'calibration-cold-'))
  const server = createServer((req,res) => res.end('<!doctype html><h1>Fictional first-run app</h1>'))
  await new Promise(done => server.listen(0,'127.0.0.1',done))
  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({recordVideo:{dir:directory,size:{width:800,height:600}},viewport:{width:800,height:600}})
    const page = await context.newPage()
    const start = performance.now()
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    const sync = await calibrateRecording(page, () => performance.now()-start)
    assert.ok(sync.tMs>0)
    await page.waitForTimeout(150)
    const video = page.video()
    await context.close()
    const file = await video.path()
    assert.ok((await readFile(file)).length>0)
    const csv = execFileSync('ffprobe',['-v','error','-f','lavfi','-i',`movie='${basename(file).replace(/'/g,"'\\''")}',signalstats`,'-show_entries','frame=pts_time:frame_tags=lavfi.signalstats.YAVG','-of','csv=p=0'],{encoding:'utf8',cwd:dirname(file)})
    const luma = csv.trim().split('\n').map(line=>Number(line.split(',')[1]))
    const black = luma.findIndex(value=>value<40)
    assert.ok(black>=0,'The recorded black marker is missing')
    assert.ok(luma.slice(black+1).some(value=>value>200),'The recorded white transition is missing')
  } finally {
    await browser.close()
    await new Promise(done=>server.close(done))
    await rm(directory,{recursive:true,force:true})
  }
})
