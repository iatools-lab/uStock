import cron from 'node-cron';
import {settings} from './config.mjs';
import {run} from './import.mjs';
const env=settings();
const expression=env.ETL_CRON||'0 2 * * *';
const timezone=env.ETL_TIMEZONE||'Africa/Douala';
if(!cron.validate(expression))throw new Error('ETL_CRON invalide');
let current=null;
export async function tick(){
 if(current){console.log('ETL ignoré : exécution précédente encore en cours');return;}
 current=run('sync').catch(()=>{console.error('ETL échoué : dernier état local conservé. Vérifier les accès et le journal import_run.');});
 try{await current;}finally{current=null;}
}
const task=cron.schedule(expression,tick,{timezone,noOverlap:true});
console.log('ETL planifié : '+expression+' ('+timezone+'). Aucun déclenchement par les requêtes HTTP.');
if(env.ETL_RUN_ON_START==='true')await tick();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{
 await task.stop();if(current)await current;await task.destroy();process.exit(0);
});
