import {createServer} from 'node:http'
const server=createServer((req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8')
  const content=req.url==='/details'?'<h1>Demo result</h1><section aria-label="Result"><ul><li>Camera ready</li><li>Captions ready</li><li>Message ready</li></ul></section>':'<h1>Demo App</h1><p>A public example with no account.</p><button onclick="location.href=\'/details\'">Open result</button>'
  res.end(`<!doctype html><html lang="en"><head><title>Demo App</title><style>body{font:24px system-ui;margin:80px;background:#f4f6fa;color:#172033}button{font:inherit;padding:12px}li{margin:16px}section{background:white;padding:24px;border-radius:12px}</style></head><body>${content}</body></html>`)
})
server.listen(Number(process.env.PORT||3005),'127.0.0.1',()=>console.log(`Example: http://127.0.0.1:${server.address().port}`))
