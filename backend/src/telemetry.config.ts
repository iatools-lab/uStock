import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
export function resolveTelemetry(env:Record<string,string|undefined>) {
  if(env.OBSERVE_ENABLED !== 'true') return undefined;
  const appKey=env.OBSERVE_APP_KEY?.trim(), appSecret=env.OBSERVE_APP_SECRET?.trim();
  if(!appKey||!appSecret||appKey==='YOUR_APP_KEY'||appSecret==='YOUR_APP_SECRET'){
    throw new Error('Observe activé sans identifiants valides. Renseigner OBSERVE_APP_KEY et OBSERVE_APP_SECRET ou définir OBSERVE_ENABLED=false.');
  }
  return {appKey,appSecret,serviceId:'backend'};
}
export function loadTelemetryConfig(){
  let file:Record<string,string|undefined>={};
  try {file=parseEnv(readFileSync(resolve(process.cwd(),'.env'),'utf8'));}
  catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  return resolveTelemetry({...file,...process.env});
}
