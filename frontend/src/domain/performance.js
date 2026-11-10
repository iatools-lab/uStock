export function performanceRows(analysis,dimension,names=new Map()){
 const groups=new Map(),last=analysis.months.at(-1);
 for(const [rows,previous] of [[analysis.rows,false],[analysis.previous?.rows||[],true]])for(const r of rows){
  if(r.status!=='DEPLOYED'&&!(r.status==='INSTOCK'&&r.month===last&&!previous))continue;
  const key=r[dimension]||'__unknown__';
  if(!groups.has(key))groups.set(key,{key,label:key==='__unknown__'?'Sans rattachement':dimension==='product'?r.productName:names.get(key)||key,current:0,previous:0,stock:0});
  groups.get(key)[r.status==='INSTOCK'?'stock':previous?'previous':'current']+=Number(r.quantity);
 }
 return [...groups.values()].map(r=>({...r,delta:r.current-r.previous,growth:r.previous?(r.current-r.previous)/r.previous*100:null,coverage:r.current?r.stock*analysis.window.days/r.current:null})).sort((a,b)=>b.current-a.current||a.label.localeCompare(b.label,'fr'));
}
