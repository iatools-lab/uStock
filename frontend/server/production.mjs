import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
import { createLocalDatabase, registerDatabaseRoutes } from './local-database.mjs';
import { settings } from '../../backend/scripts/bi/config.mjs';
import { productionSelection } from './production-selection.mjs';

const compress=promisify(gzip);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json','.woff2':'font/woff2','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
export function createProductionServer({database=createLocalDatabase({selectionStore:productionSelection()}),dist=fileURLToPath(new URL('../dist/',import.meta.url))}={}){
  const root=resolve(dist),routes=[];
  registerDatabaseRoutes({middlewares:{use:(path,handler)=>routes.push({path,handler})}},database);
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/healthz'||url.pathname==='/readyz'){
        res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
        if(url.pathname==='/readyz'){try{await database.health();}catch{res.statusCode=503;res.end('{"status":"unavailable"}');return;}}
        res.end('{"status":"ok"}');return;
      }
      const route=routes.find(r=>url.pathname===r.path);
      if(route){
        if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');res.setHeader('Content-Type','application/json');res.end('{"error":"Production en lecture seule."}');return;}
        if(/\bgzip\b/.test(req.headers['accept-encoding']||'')){
          const end=res.end.bind(res);
          res.end=body=>{
            if(body&&Buffer.byteLength(body)>1024){res.setHeader('Vary','Accept-Encoding');res.setHeader('Content-Encoding','gzip');compress(body).then(content=>end(content),()=>res.destroy());}
            else end(body);
          };
        }
        req.url=url.search||'/';await route.handler(req,res);return;
      }
      if(url.pathname.startsWith('/api/')){res.statusCode=404;res.end();return;}
      if(!['GET','HEAD'].includes(req.method)){res.statusCode=405;res.end();return;}
      const path=decodeURIComponent(url.pathname);
      if(path.includes('\0')||path.split(/[\\/]/).some(part=>part.startsWith('.'))){res.statusCode=404;res.end();return;}
      let file=resolve(root,'.'+path);
      if(file!==root&&!file.startsWith(root+sep)){res.statusCode=404;res.end();return;}
      try{if(!(await stat(file)).isFile())throw new Error('NOT_FILE');}catch{
        if(extname(path)||!String(req.headers.accept||'').includes('text/html')){res.statusCode=404;res.end();return;}
        file=resolve(root,'index.html');
      }
      let content=await readFile(file);
      res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');
      res.setHeader('Cache-Control',file.startsWith(resolve(root,'assets')+sep)?'public, max-age=31536000, immutable':'no-cache');
      res.setHeader('Vary','Accept-Encoding');
      if(/\bgzip\b/.test(req.headers['accept-encoding']||'')&&content.length>1024){content=await compress(content);res.setHeader('Content-Encoding','gzip');}
      res.setHeader('Content-Length',content.length);res.end(req.method==='HEAD'?undefined:content);
    }catch{if(!res.headersSent){res.statusCode=500;res.end('Service indisponible');}else res.destroy();}
  });
  server.requestTimeout=60000;server.headersTimeout=65000;
  return {server,close:async()=>{await new Promise((done,reject)=>{server.close(error=>error?reject(error):done());server.closeIdleConnections();});await database.close();}};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const env=settings();
  const port=Number(env.PORT||3000);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('INVALID_PORT');
  const app=createProductionServer();
  app.server.listen(port,env.HOST||'127.0.0.1',()=>console.log(`Serveur ukit prêt sur le port ${port}`));
  let stopping=false;
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(stopping)return;stopping=true;const timer=setTimeout(()=>process.exit(1),30000);timer.unref();app.close().then(()=>{clearTimeout(timer);process.exitCode=0;},()=>process.exit(1));});
}
