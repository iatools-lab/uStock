export function stockPositions(analysis){
  const cells=new Map(),last=analysis.months.at(-1);
  for(const row of analysis.rows){
    if(row.status!=='DEPLOYED'&&!(row.status==='INSTOCK'&&row.month===last))continue;
    const key=JSON.stringify([row.zone||null,row.product]);
    if(!cells.has(key))cells.set(key,{zone:row.zone||null,product:row.product,productName:row.productName,stock:0,sold:0});
    cells.get(key)[row.status==='DEPLOYED'?'sold':'stock']+=row.quantity;
  }
  return [...cells.values()].map(row=>{
    const daily=row.sold/analysis.window.days,coverage=daily?row.stock/daily:null,target=Math.ceil(daily*30);
    return {...row,daily,coverage,target,need:Math.max(0,target-row.stock),surplus:daily?Math.max(0,row.stock-target):0,risk:coverage==null?'unknown':coverage<15?'critical':coverage<30?'warning':'healthy'};
  });
}

export function riskMatrix(analysis){
  const positions=stockPositions(analysis);
  const known=positions.filter(r=>r.zone);
  const zones=[...new Set(known.map(r=>r.zone))].sort((a,b)=>a.localeCompare(b,'fr',{numeric:true}));
  const products=[...new Map(positions.map(r=>[r.product,{key:r.product,label:r.productName}])).values()].sort((a,b)=>a.label.localeCompare(b.label,'fr'));
  const cells=new Map(known.map(r=>[JSON.stringify([r.zone,r.product]),r]));
  return {zones,products,cells,positions,unassigned:positions.filter(r=>!r.zone).reduce((n,r)=>n+r.stock,0)};
}

export function redistribution(analysis){
  const positions=stockPositions(analysis).filter(r=>r.zone),plans=[];
  const products=[...new Set(positions.map(r=>r.product))];
  for(const product of products){
    const supply=positions.filter(r=>r.product===product&&r.surplus>0).map(r=>({...r,remaining:r.surplus})).sort((a,b)=>b.remaining-a.remaining||a.zone.localeCompare(b.zone));
    const demand=positions.filter(r=>r.product===product&&r.need>0).sort((a,b)=>a.coverage-b.coverage||a.zone.localeCompare(b.zone));
    for(const recipient of demand){let need=recipient.need;
      for(const donor of supply){if(donor.zone===recipient.zone||!need||!donor.remaining)continue;const quantity=Math.min(need,donor.remaining);plans.push({product,productName:recipient.productName,from:donor.zone,to:recipient.zone,quantity,donorTarget:donor.target});donor.remaining-=quantity;need-=quantity;}
    }
  }
  const need=positions.reduce((n,r)=>n+r.need,0),transferable=plans.reduce((n,r)=>n+r.quantity,0);
  return {plans,need,transferable,remaining:Math.max(0,need-transferable),zones:[...new Set(positions.map(r=>r.zone))].sort((a,b)=>a.localeCompare(b,'fr',{numeric:true})).map(zone=>({key:zone,label:zone,need:positions.filter(r=>r.zone===zone).reduce((n,r)=>n+r.need,0),surplus:positions.filter(r=>r.zone===zone).reduce((n,r)=>n+r.surplus,0)}))};
}

export function concentration(analysis,dimension){
  const totals=new Map();
  for(const r of analysis.rows)if(r.status==='DEPLOYED'){
    const key=r[dimension]||'__unknown__',label=dimension==='product'?r.productName:r[dimension]||'Zone non renseignée';
    const old=totals.get(key)||{key,label,quantity:0};old.quantity+=r.quantity;totals.set(key,old);
  }
  const rows=[...totals.values()].sort((a,b)=>b.quantity-a.quantity||a.label.localeCompare(b.label,'fr')),total=rows.reduce((n,r)=>n+r.quantity,0);let running=0;
  return rows.map(r=>{running+=r.quantity;return {...r,share:total?r.quantity/total*100:0,cumulative:total?running/total*100:0};});
}

export function agingStock(analysis){
  const keys=['ageUnder30','age30to59','age60to89','age90plus','ageUnknown'],last=analysis.months.at(-1),zones=new Map(),totals=Object.fromEntries(keys.map(k=>[k,0]));
  for(const r of analysis.rows)if(r.status==='INSTOCK'&&r.month===last){
    const key=r.zone||'__unknown__';if(!zones.has(key))zones.set(key,{key,label:r.zone||'Sans zone / entrepôts',...Object.fromEntries(keys.map(k=>[k,0])),quantity:0});
    const row=zones.get(key);row.quantity+=r.quantity;
    const measured=keys.filter(k=>k!=='ageUnknown').reduce((n,k)=>n+Number(r[k]||0),0);
    for(const k of keys){const value=k==='ageUnknown'?Math.max(0,r.quantity-measured):Number(r[k]||0);row[k]+=value;totals[k]+=value;}
  }
  return {totals,rows:[...zones.values()].sort((a,b)=>b.age90plus-a.age90plus||b.quantity-a.quantity)};
}
