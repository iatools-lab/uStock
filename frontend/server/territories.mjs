import readXlsxFile from 'read-excel-file/node';
import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/&/g, ' ET ').replace(/[^A-Z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const clean = value => ['NULL', 'N A', 'NONE', ''].includes(normalize(value)) ? null : String(value).trim();
const unique = (rows, field) => { const values = [...new Set(rows.map(row => row[field]).filter(Boolean))]; return values.length === 1 ? values[0] : null; };
const aliases = { 'AFANLOUM':'AFAMLOUM', 'TOUBOUROU':'TOUBORO', 'AKOM2':'AKOM II', 'AKOM 2':'AKOM II', 'NGAMBE TIKAR':'NGAMBE TIKAR' };
let cached;
export async function loadTerritories() {
  const file = new URL('./Entities_Mapping.xlsx', import.meta.url);
  const info = await stat(file);
  if (cached?.mtime === info.mtimeMs) return cached.rows;
  const workbook = await readXlsxFile(fileURLToPath(file));
  const data = workbook[0]?.data || workbook;
  if (normalize(data[0]?.[3]) !== 'ARRONDISSEMENT') throw new Error('INVALID_MAPPING');
  const rows = data.slice(1).filter(row => row[1] && row[2] && row[3] && row[4]).map(([country, region, department, arrondissement, zone]) => ({country,region,department,arrondissement,zone}));
  cached = { mtime:info.mtimeMs, rows }; return rows;
}
export function locateAgent(agent, rows) {
  const role = normalize(agent.role), placeAccount = ['ADMINISTRATOR','POINT RELAIS','SAV'].includes(role);
  let candidates = [], method = 'unmapped';
  const matchPlace = value => {
    const key = aliases[normalize(value)] || normalize(value);
    if (!key) return [];
    const exact = rows.filter(row => {
      const full = normalize(row.arrondissement), base = normalize(row.arrondissement.replace(/\([^)]*\)/g,''));
      return full === key || base === key || normalize(row.arrondissement.match(/\(([^)]+)\)/)?.[1]) === key;
    });
    if (exact.length) return exact;
    // Un nom de ville peut désigner plusieurs arrondissements : seuls les parents communs sont retenus.
    return rows.filter(row => normalize(row.arrondissement.replace(/\([^)]*\)/g,'')).replace(/\s+(?:I|II|III|IV|V|VI|VII|VIII|IX|X|\d+)$/, '') === key);
  };
  for (const [value, evidence] of [[clean(agent.location_arrondissement),'arrondissement'],[clean(agent.location_commune),'commune'],[clean(agent.location_zone),'locality'],[clean(agent.location_village),'village']]) {
    candidates = matchPlace(value);
    if(!candidates.length&&value){
      const parts=String(value).split(/[\n+;,]+/).map(part=>part.trim()).filter(Boolean);
      if(parts.length>1){const matches=parts.map(matchPlace);if(matches.every(list=>list.length))candidates=[...new Set(matches.flat())];}
    }
    if (candidates.length) { method = evidence; break; }
  }
  if (!candidates.length && placeAccount) {
    let name = clean(agent.agent_name);
    if (name) {
      name = normalize(name).replace(/^(?:BOUTIQUE\s+)?(?:POINT\s+)?(?:RELAIS?|ENTREPOT|SOUS ENTREPOT)\s+/, '').replace(/^BOUTIQUE\s+/, '').replace(/\s+RELAIS?$/, '');
      candidates = matchPlace(name);
      // Ville explicite dans le nom d'un compte de lieu, sans attribuer un arrondissement arbitraire.
      if (!candidates.length) for (const city of ['DOUALA','YAOUNDE','BAFOUSSAM','BERTOUA','GAROUA','NGAOUNDERE','MAROUA']) {
        if (new RegExp(`(?:^| )${city}(?: |$)`).test(name)) { candidates = matchPlace(city); if(candidates.length) break; }
      }
      if (candidates.length) method = 'place_name';
    }
  }
  const district = normalize(clean(agent.location_district)).replace(/\s+\d+$/, '');
  if (!candidates.length && district) {
    candidates = rows.filter(row => normalize(row.department) === district);
    if (candidates.length) method = 'department';
  }
  const rawRegion = normalize(clean(agent.location_region)).replace(/\s+\d+$/, '');
  if (!candidates.length && rawRegion) { candidates=rows.filter(row=>normalize(row.region)===rawRegion); if(candidates.length) method='region'; }
  const declaredZone = rows.some(row=>normalize(row.zone)===normalize(agent.entity_name)) ? rows.find(row=>normalize(row.zone)===normalize(agent.entity_name)).zone : null;
  const mappedZone = unique(candidates,'zone');
  // Une zone déclarée ne sert pas à choisir entre plusieurs arrondissements homonymes.
  const zone = mappedZone || (candidates.length === 0 || candidates.some(row=>row.zone===declaredZone) ? declaredZone : null);
  const zoneRows = candidates.length ? candidates : zone ? rows.filter(row=>row.zone===zone) : [];
  return {region:unique(zoneRows,'region'),department:unique(candidates,'department'),arrondissement:unique(candidates,'arrondissement'),zone,method:method==='unmapped'&&zone?'entity_zone':method,conflict:Boolean(declaredZone&&candidates.length&&!candidates.some(row=>row.zone===declaredZone)),holderKind:role==='ADMINISTRATOR'?'central':role==='AREA MANAGER'?'am':role==='POINT RELAIS'?'shop':['BA+','BA','MBA','FACO'].includes(role)?'agent':role==='SAV'?'sav':'unknown'};
}
const mappingCache = new WeakMap();
export function mapAgents(agents, rows) {
  let cache=mappingCache.get(rows);if(!cache){cache=new Map();mappingCache.set(rows,cache);}
  const mapped=agents.map(agent=>{
    const key=JSON.stringify([agent.role,agent.location_arrondissement,agent.location_commune,agent.location_village,agent.location_zone,agent.location_district,agent.location_region,agent.entity_name,['ADMINISTRATOR','POINT RELAIS','SAV'].includes(normalize(agent.role))?agent.agent_name:null]);
    let location=cache.get(key);if(!location){location=locateAgent(agent,rows);cache.set(key,location);}
    return {...agent,...location};
  });
  const byId=new Map(mapped.map(agent=>[agent.agent_number,agent]));
  const shopLinks=new Map();
  for(const shop of mapped.filter(agent=>agent.holderKind==='shop')){
    let members=[];try{members=JSON.parse(shop.team||'[]');}catch{}
    if(!Array.isArray(members))continue;
    for(const member of members){const id=String(member?.agent_number??member?.name??'');if(byId.has(id)){const links=shopLinks.get(id)||[];links.push(shop);shopLinks.set(id,links);}}
  }
  for(const agent of mapped){
    const linked=shopLinks.get(agent.agent_number)||[];
    if(!linked.length)continue;
    for(const field of ['region','department','arrondissement','zone'])if(!agent[field])agent[field]=unique(linked,field);
    if(linked.length===1)agent.linkedShopId=linked[0].agent_number;
    if(agent.method==='unmapped')agent.method='crm_team';
  }
  const managers=new Map();
  for(const agent of mapped.filter(a=>a.holderKind==='am'&&a.zone&&a.is_active!==false)){const list=managers.get(agent.zone)||[];list.push(agent);managers.set(agent.zone,list);}
  for(const agent of mapped){
    agent.amId=agent.holderKind==='am'?agent.agent_number:managers.get(agent.zone)?.length===1?managers.get(agent.zone)[0].agent_number:null;
    agent.shopId=agent.holderKind==='shop'?agent.agent_number:agent.linkedShopId||null;
  }
  return mapped;
}
