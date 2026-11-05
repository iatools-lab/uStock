import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTerritories, locateAgent, mapAgents } from '../server/territories.mjs';
import { liveView } from '../src/domain/live-routing.js';
import { MENUS } from '../src/navigation/menus.js';
import { territoryPlace } from '../server/stock-query.mjs';

const rows=await loadTerritories();

test('un agent sans lieu ne devient pas une zone ou une région',()=>{
  const actor={holderKind:'agent',holderId:'AGENT-1',holderName:'Vendeur'};
  for(const level of ['zone','region','department','arrondissement','amId','shopId'])assert.equal(territoryPlace(actor,level,new Map()),null);
  assert.deepEqual(territoryPlace(actor,'holderId',new Map()),{key:'AGENT-1',label:'Vendeur'});
});
test('les onglets regroupent uniquement leur niveau et les entrepôts',()=>{
  const actors=new Map([['AM-1',{agent_name:'Responsable'}],['SHOP-1',{agent_name:'Boutique'}]]);
  const actor={holderKind:'agent',zone:'Zone 1',region:'CENTRE',amId:'AM-1',shopId:'SHOP-1'};
  assert.equal(territoryPlace(actor,'zone',actors).label,'Zone 1');
  assert.equal(territoryPlace(actor,'region',actors).label,'CENTRE');
  assert.equal(territoryPlace(actor,'amId',actors).label,'Responsable');
  assert.equal(territoryPlace(actor,'shopId',actors).label,'Boutique');
  for(const level of ['zone','region','department','arrondissement','amId','shopId'])assert.deepEqual(territoryPlace({holderKind:'central'},level,actors),{key:'__central__',label:'Entrepôts'});
});
test('les menus DG ont chacun une vue distincte et les autres profils gardent leurs menus',()=>{
  assert.deepEqual(MENUS.dg.map(m=>liveView('dg',m.path)),['overview','stock','map','performance']);
  for(const [role,menus] of Object.entries(MENUS))for(const menu of menus)assert.ok(liveView(role,menu.path),`${role}/${menu.path}`);
  assert.equal(liveView('dg','inventaires'),null);
  assert.equal(liveView('dc','stock-national'),null);
  assert.equal(liveView('it','journal'),'technical');
  assert.equal(liveView('supply','journal'),'assets');
});
test('le fichier couvre huit zones mais une région ne détermine pas une zone',()=>{
  assert.equal(rows.length,298);
  assert.equal(new Set(rows.map(r=>r.zone)).size,8);
  const region=locateAgent({location_region:'Centre 2'},rows);
  assert.equal(region.region,'CENTRE');assert.equal(region.zone,null);assert.equal(region.arrondissement,null);
});
test('un arrondissement corrige les anciennes régions commerciales et garde la preuve du conflit',()=>{
  const result=locateAgent({location_region:'CENTRE 2',location_zone:'Yoko',entity_name:'Zone 1'},rows);
  assert.equal(result.region,'CENTRE');assert.equal(result.department,'MBAM-ET-KIM');assert.equal(result.zone,'Zone 5');assert.equal(result.conflict,true);
});
test('un compte de lieu explicite ne reçoit pas un arrondissement arbitraire',()=>{
  const result=locateAgent({role:'Administrator',agent_name:'Entrepot BAFOUSSAM'},rows);
  assert.equal(result.region,'OUEST');assert.equal(result.department,'MIFI');assert.equal(result.zone,'Zone 2');assert.equal(result.arrondissement,null);
  assert.equal(locateAgent({role:'BA',agent_name:'Jean Bafoussam'},rows).region,null);
  assert.equal(locateAgent({role:'Administrator',agent_name:'Entrepot Central'},rows).region,null);
});
test('les correspondances tolèrent les accents et distinguent affectation AM et boutique',()=>{
  const list=mapAgents([{agent_number:'am1',role:'AREA MANAGER',entity_name:'Zone 5',is_active:true},{agent_number:'shop1',role:'POINT RELAIS',agent_name:'Boutique Relais Ngaoundéré'},{agent_number:'agent1',role:'BA',location_arrondissement:'NGAOUNDERE I'}],rows);
  assert.equal(list[1].region,'ADAMAOUA');assert.equal(list[1].amId,'am1');assert.equal(list[2].amId,'am1');assert.equal(list[2].shopId,null);
  const ambiguous=mapAgents([{agent_number:'am1',role:'AREA MANAGER',entity_name:'Zone 5'},{agent_number:'am2',role:'AREA MANAGER',entity_name:'Zone 5'},{agent_number:'agent1',role:'BA',entity_name:'Zone 5'}],rows);
  assert.equal(ambiguous[2].amId,null);
});
test('les membres explicitement référencés par une boutique héritent de ses lieux manquants',()=>{
  const agents=mapAgents([{agent_number:'shop',agent_name:'Boutique Relais Ngaoundéré',role:'POINT RELAIS',team:'[{"name":"member"}]'},{agent_number:'member',agent_name:'Agent sans adresse',role:'BA',team:'[]'}],rows);
  assert.equal(agents[1].shopId,'shop');assert.equal(agents[1].region,'ADAMAOUA');assert.equal(agents[1].zone,'Zone 5');assert.equal(agents[1].method,'crm_team');
});
test('une équipe ne remplace pas les coordonnées administratives déjà connues',()=>{
  const agents=mapAgents([{agent_number:'shop',agent_name:'Boutique Relais Ngaoundéré',role:'POINT RELAIS',team:'[{"name":"member"}]'},{agent_number:'member',role:'BA',location_arrondissement:'NTUI'}],rows);
  assert.equal(agents[1].region,'CENTRE');assert.equal(agents[1].zone,'Zone 1');
});
