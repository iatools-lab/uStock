export function createSnapshotCache({ttl=60000,maxEntries=80,maxBytes=64*1024*1024,now=Date.now}={}){
  const entries=new Map(),pending=new Map();let bytes=0,generation=0;
  const remove=key=>{const entry=entries.get(key);if(entry){bytes-=entry.bytes;entries.delete(key);}};
  return {
    clear(){generation++;entries.clear();pending.clear();bytes=0;},
    async get(key,loader){
      const cached=entries.get(key);
      if(cached&&cached.expires>now()){entries.delete(key);entries.set(key,cached);return structuredClone(cached.value);}
      remove(key);
      if(pending.has(key))return structuredClone(await pending.get(key));
      const version=generation;
      const promise=Promise.resolve().then(loader).then(value=>{
        const size=Buffer.byteLength(JSON.stringify(value));
        if(version===generation&&ttl>0&&size<=maxBytes){
          for(const [k,e] of entries)if(e.expires<=now())remove(k);
          remove(key);
          while(entries.size&&(entries.size>=maxEntries||bytes+size>maxBytes))remove(entries.keys().next().value);
          entries.set(key,{value:structuredClone(value),bytes:size,expires:now()+ttl});bytes+=size;
        }
        return value;
      }).finally(()=>{if(pending.get(key)===promise)pending.delete(key);});
      pending.set(key,promise);return structuredClone(await promise);
    }
  };
}

export function snapshotKey(params,{revision,reference,date}){
  const sorted=[...params].sort(([ak,av],[bk,bv])=>ak.localeCompare(bk)||av.localeCompare(bv));
  return JSON.stringify([revision,reference,date,sorted]);
}
