import { createSnapshotCache } from './snapshot-cache.mjs';

// Cache partage des SELECT entre les vues ; jamais utilise pour les exports.
export function createReadQueryCache(options={}){
 const cache=createSnapshotCache(options);
 return {
  clear:()=>cache.clear(),
  reader(client,namespace){
   let version;
   return {async query(sql,values){
    if(sql.includes('current_database()')){
     const result=await client.query(sql,values);
     const identity=result.rows[0];
     version=JSON.stringify([identity.loaded,identity.today]);
     return result;
    }
    if(!version)return client.query(sql,values);
    const key=JSON.stringify([namespace,version,sql,values||[]]);
    return cache.get(key,async()=>({rows:(await client.query(sql,values)).rows}));
   }};
  }
 };
}
