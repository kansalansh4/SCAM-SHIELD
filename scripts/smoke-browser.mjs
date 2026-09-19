import { createServer } from 'node:http';
import { readFile,readdir } from 'node:fs/promises';
import { extname,resolve } from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const config=JSON.parse(await readFile('vercel.json','utf8'));
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.wasm':'application/wasm','.gz':'application/gzip','.png':'image/png','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try {
  const path=new URL(req.url,'http://localhost').pathname;
  const file=path==='/fixture.png' ? 'tests/fixtures/screenshots/screenshot-01.png' : 'dist'+(path==='/'?'/index.html':path);
  for(const h of config.headers[0].headers)res.setHeader(h.key,h.value);
  res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');
  res.end(await readFile(file));
 }catch{res.statusCode=404;res.end();}
});
await new Promise(r=>server.listen(5187,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage();const uploads=[];const failures=[];
 page.on('request',r=>{if(r.method()==='POST')uploads.push(r.url());});
 page.on('pageerror',e=>failures.push(e.message));
 await page.goto('http://127.0.0.1:5187');
 const ocr=(await readdir('dist/assets')).find(x=>x.startsWith('ocr-')&&x.endsWith('.js'));
 const text=await page.evaluate(async(name)=>{const {extractLocal}=await import('/assets/'+name);const b=await (await fetch('/fixture.png')).blob();return extractLocal(new File([b],'fixture.png',{type:'image/png'}));},ocr);
 assert.match(text,/urgent/i);assert.equal(uploads.length,0);assert.equal(failures.length,0);
 console.log('Production browser OCR passed under deployed CSP; screenshot recognized and no POST/upload requests made.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
