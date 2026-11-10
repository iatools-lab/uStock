// Modele historique conserve uniquement pour les tests des anciennes vues.
export function salesRanking(analysis,dimension,names=new Map()){
 const groups=new Map();
 for(const [rows,field] of [[analysis.rows,'sold'],[analysis.previous?.rows||[],'previous']])for(const row of rows){
  if(row.status!=='DEPLOYED')continue;
  const key=row[dimension]||'__unknown__';
  if(!groups.has(key))groups.set(key,{key,label:key==='__unknown__'?'Non renseigné':dimension==='product'?row.productName:dimension==='holderId'?(row.holderName||key):(names.get(key)||key),sold:0,previous:0});
  groups.get(key)[field]+=Number(row.quantity);
 }
 const total=[...groups.values()].reduce((n,r)=>n+r.sold,0);
 return [...groups.values()].map(r=>({...r,delta:r.sold-r.previous,growth:r.previous?(r.sold-r.previous)/r.previous*100:null,share:total?r.sold/total*100:0})).sort((a,b)=>b.sold-a.sold||a.label.localeCompare(b.label,'fr'));
}
