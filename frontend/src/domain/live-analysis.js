export const STATE_LABELS={INSTOCK:'En stock',DEPLOYED:'Vendus',DEFECTIVE:'Défectueux'};
export const PALETTE=['#001a70','#fe5716','#168779','#7297dc','#b377bf','#bd851e','#8894a9'];
const name=(row,dimension,names)=>dimension==='product'?row.productName:dimension==='amId'?names.get(row.amId)||'AM non renseigné':row[dimension]||'Lieu non renseigné';

export function monthlySeries(analysis,dimension,status,names=new Map()){
  const totals=new Map();
  for(const r of analysis.rows)if(r.status===status){const key=r[dimension]||'__unknown__';const old=totals.get(key)||{key,label:name(r,dimension,names),quantity:0};old.quantity+=r.quantity;totals.set(key,old);}
  const ordered=[...totals.values()].sort((a,b)=>b.quantity-a.quantity||a.label.localeCompare(b.label));
  const series=ordered.map((r,i)=>({key:`s${i}`,label:r.label,id:r.key}));
  const byKey=new Map(series.map(s=>[s.id,s]));
  const data=analysis.months.map(month=>({month,...Object.fromEntries(series.map(s=>[s.key,0]))}));
  const byMonth=new Map(data.map(r=>[r.month,r]));
  for(const r of analysis.rows)if(r.status===status){const key=r[dimension]||'__unknown__';const s=byKey.get(key);if(s&&byMonth.has(r.month))byMonth.get(r.month)[s.key]+=r.quantity;}
  return {data,series,ranking:ordered};
}

export function forecastNeeds(analysis,dimension,horizon,buffer,names=new Map()){
  const cells=new Map(),last=analysis.months.at(-1);
  for(const r of analysis.rows){
    if(r.status!=='DEPLOYED'&&!(r.status==='INSTOCK'&&r.month===last))continue;
    const id=r[dimension]||'__unknown__',key=JSON.stringify([r.zone||null,r.region||null,r.amId||null,r.product]);
    if(!cells.has(key))cells.set(key,{id,product:r.product,productName:r.productName,label:name(r,dimension,names),sold:0,stock:0});
    cells.get(key)[r.status==='DEPLOYED'?'sold':'stock']+=r.quantity;
  }
  const calculated=[...cells.values()].map(r=>{const daily=r.sold/analysis.window.days,target=Math.ceil(daily*(horizon+buffer));return {...r,daily,target,need:Math.max(0,target-r.stock)};});
  const details=new Map();
  for(const r of calculated){const key=JSON.stringify([r.id,r.product]);if(!details.has(key))details.set(key,{...r,sold:0,stock:0,daily:0,target:0,need:0});const cell=details.get(key);for(const k of ['sold','stock','daily','target','need'])cell[k]+=r[k];}
  const detail=[...details.values()].map(r=>({...r,coverage:r.daily?r.stock/r.daily:null}));
  const groups=new Map();
  for(const r of detail){if(!groups.has(r.id))groups.set(r.id,{id:r.id,label:r.label,sold:0,stock:0,target:0,need:0,daily:0});const g=groups.get(r.id);for(const k of ['sold','stock','target','need','daily'])g[k]+=r[k];}
  const rows=[...groups.values()].sort((a,b)=>b.need-a.need||b.sold-a.sold||a.label.localeCompare(b.label));
  return {rows,detail:detail.sort((a,b)=>b.need-a.need),totals:rows.reduce((t,r)=>{for(const k of ['sold','stock','target','need','daily'])t[k]+=r[k];return t;},{sold:0,stock:0,target:0,need:0,daily:0})};
}

export function productType(reference,label){
  const value=`${reference} ${label}`.replace(/[_-]/g,' ').toUpperCase();
  for(const [pattern,type] of [[/\bJUA/,'Jua'],[/\bSUNSHINE\b/,'Sunshine'],[/\bFLASH\b/,'Flash'],[/\bLION\b/,'Lion'],[/\bLUCIOLE\b/,'Luciole']])if(pattern.test(value))return type;
  return label||reference;
}
export function needsMatrix(forecast){
  const products=[...new Set(forecast.detail.map(r=>productType(r.product,r.productName)))].sort((a,b)=>a.localeCompare(b,'fr'));
  const byPlace=new Map(forecast.rows.map(r=>[r.id,{label:r.label,values:new Map()}]));
  for(const r of forecast.detail){const place=byPlace.get(r.id),key=productType(r.product,r.productName);place.values.set(key,(place.values.get(key)||0)+r.need);}
  const rows=[...byPlace.values()].map(r=>{const values=products.map(p=>r.values.get(p)||0);return [r.label,...values,values.reduce((n,v)=>n+v,0)];});
  return {products,rows,totals:['Total',...products.map((_,i)=>rows.reduce((n,r)=>n+r[i+1],0)),forecast.totals.need]};
}

export function stateEvolution(analysis,status){
  const totals=new Map(analysis.months.map(month=>[month,0]));
  for(const r of analysis.rows)if(r.status===status&&totals.has(r.month))totals.set(r.month,totals.get(r.month)+r.quantity);
  return {data:[...totals].map(([month,value])=>({month,value})),series:[{key:'value',label:STATE_LABELS[status]}]};
}
