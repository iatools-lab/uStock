const day=86400000;
const iso=d=>d.toISOString().slice(0,10);
const addDays=(s,n)=>iso(new Date(Date.parse(s)+n*day));
const monthStart=(s,n)=>iso(new Date(Date.UTC(Number(s.slice(0,4)),Number(s.slice(5,7))-1+n,1)));
const previousYear=s=>{const y=Number(s.slice(0,4))-1,m=Number(s.slice(5,7)),d=Number(s.slice(8));return iso(new Date(Date.UTC(y,m-1,Math.min(d,new Date(Date.UTC(y,m,0)).getUTCDate()))));};
export function comparisonPeriod(window,mode='previous',today=window.end){
 if(!['previous','year'].includes(mode))throw new Error('INVALID_COMPARISON');
 const {start,end,days}=window;
 if(mode==='year')return {start:previousYear(start),end:previousYear(end),mode};
 const next=addDays(end,1);
 if(start.endsWith('-01')&&next.endsWith('-01')){
  const months=(Number(next.slice(0,4))-Number(start.slice(0,4)))*12+Number(next.slice(5,7))-Number(start.slice(5,7));
  return {start:monthStart(start,-months),end:addDays(start,-1),mode};
 }
 // Une periode calendaire en cours se compare au debut du bloc precedent.
 if(end===today&&start.endsWith('-01')&&start.slice(0,4)===end.slice(0,4)){
  const first=Number(start.slice(5,7)),last=Number(end.slice(5,7));
  const span=first===last?1:first===Math.floor((last-1)/3)*3+1?3:first===Math.floor((last-1)/6)*6+1?6:first===1?12:0;
  if(span){const previousStart=monthStart(start,-span),limit=addDays(start,-1);return {start:previousStart,end:[addDays(previousStart,days-1),limit].sort()[0],mode};}
 }
 return {start:addDays(start,-days),end:addDays(start,-1),mode};
}
