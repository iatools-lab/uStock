import assert from 'node:assert/strict';
import pg from 'pg';
import { configuration } from '../server/local-database.mjs';
import { completeKitSQL, stockConditionSQL } from '../server/queries/kit-stock-scope.mjs';
import { queryStock } from '../server/queries/stock-query.mjs';
import { contractSalesCTE } from '../server/queries/contract-sales.mjs';

const c=new pg.Client(configuration());
try{
 await c.connect();
 // Fixtures dans un SELECT uniquement : aucune table distante n'est modifiee.
 const fixtures=`events("asset.serialNumber",type) AS (VALUES ('field_return','OFFLIELD CODE'),('sold_event','DEPLOYED'),('after_sales','AFTER SALES'),('unflagged','FLAGGED'),('unflagged','UNFLAGGED')),
 products("productReference",boq) AS (VALUES ('KIT','[{"quantity":1}]'),('PART','[]'),('NO_DATA',NULL)),
 periods(serial_number,start_at) AS (VALUES ('clean','2026-01-01'::timestamptz),('used','2026-01-01'::timestamptz),('broken','2026-01-01'::timestamptz)),
 lifecycle(serial_number,first_deployed_at,first_returned_at,first_defective_at,first_restored_at) AS (VALUES
 ('used','2026-01-02'::timestamptz,NULL::timestamptz,NULL::timestamptz,NULL::timestamptz),
 ('broken',NULL::timestamptz,NULL::timestamptz,'2026-01-02'::timestamptz,NULL::timestamptz)),
 assets(id,serial_number,product_reference,product_name,crm_holder_name,crm_flag) AS (VALUES
 ('pav','clean','KIT','Kit','Agent','PAV'),('null','clean','KIT','Kit','Agent',NULL),
 ('return','clean','KIT','Kit','Entrepot Retour Terrain','PAV'),
 ('repair','clean','KIT','Kit','Entrepot Reparation','PAV'),
 ('renew','clean','KIT','Kit','Agent','URENEW'),('deployed','used','KIT','Kit','Agent','PAV'),
 ('defect','broken','KIT','Kit','Agent','PAV'),('no_history','unknown','KIT','Kit','Agent','PAV'),
 ('unknown_flag','clean','KIT','Kit','Agent','PPI'),('part','clean','PART','Lampe','Agent','PAV'),
 ('no_catalogue','clean','NO_DATA','Inconnu','Agent','PAV'),('signed_unpaid','clean','KIT','Kit','Agent','PAV'),
 ('field_return','field_return','KIT','Kit','Agent','PAV'),('sold_event','sold_event','KIT','Kit','Agent','PAV'),('after_sales','after_sales','KIT','Kit','Agent','PAV'),
 ('spark_accessory','15107339','KIT','SunShine (Spark)','Agent','PAV'),('unflagged','unflagged','KIT','Kit','Agent','PAV'))`;
 const sql=`WITH ${fixtures} SELECT id,${completeKitSQL('a')} AS kit,${stockConditionSQL('a',{cutoff:"'2026-11-16'::timestamptz",signed:"a.id='signed_unpaid'"})} AS category FROM assets a ORDER BY id`;
 const rows=(await c.query(sql.replaceAll('raw_upowa_schema.crm_products','products').replaceAll('raw_upowa_schema.crm_asset_events','events').replaceAll('bi_schema.fct_asset_lifecycle','lifecycle').replaceAll('bi_schema.fct_asset_holding_periods','periods'))).rows;
 const categories=Object.fromEntries(rows.map(r=>[r.id,r.category]));
 assert.equal(categories.pav,'available');assert.equal(categories.null,'available');
 assert.equal(categories.return,'returned');assert.equal(categories.repair,'repair');assert.equal(categories.renew,'refurbished');assert.equal(categories.deployed,'returned');
 assert.equal(categories.signed_unpaid,'returned');
 for(const id of ['field_return','sold_event','after_sales','unflagged'])assert.equal(categories[id],'returned');
 for(const key of ['defect','no_history','unknown_flag'])assert.equal(categories[key],'control');
 assert.equal(rows.find(r=>r.id==='part').kit,false);assert.equal(rows.find(r=>r.id==='no_catalogue').kit,false);
 assert.equal(rows.find(r=>r.id==='spark_accessory').kit,false,'Le prefixe 15 prime sur la nomenclature et le flag PAV.');
 console.log('Classification verifiee : PAV et NULL, retours, reparations, reconditionnes, historique et accessoires.');
 const params=new URLSearchParams({view:'stock',product:'Flash_B',status:'INSTOCK'});
 const data=await queryStock(c,params);
 assert.equal(data.stockBreakdown.find(r=>r.key==='available').quantity,Number(data.metrics.instock.value));
 for(const row of data.stockBreakdown){
  const p=new URLSearchParams(params);p.set('exportDetails','true');p.set('stockCondition',row.key);
  const result=await queryStock(c,p);
  assert.equal(result.total,row.quantity,`export ${row.key}`);
  assert.equal(new Set(result.rows.map(r=>r.serialNumber)).size,result.total);
  assert.ok(result.rows.every(r=>r.productReference==='Flash_B'&&r.status==='INSTOCK'));
  if(row.key==='available'){
   const signed=(await c.query(`WITH ${contractSalesCTE()} SELECT serial_number FROM stock_signed_assets WHERE serial_number=ANY($1::text[])`,[result.rows.map(r=>r.serialNumber)])).rows;
   assert.equal(signed.length,0,'Aucun kit disponible ne doit avoir de contrat Signed, meme non paye.');
   const unflagged=(await c.query(`SELECT DISTINCT "asset.serialNumber" FROM raw_upowa_schema.crm_asset_events WHERE type='UNFLAGGED' AND "asset.serialNumber"=ANY($1::text[])`,[result.rows.map(r=>r.serialNumber)])).rows;
   assert.equal(unflagged.length,0,'Aucun kit disponible ne doit avoir un evenement UNFLAGGED.');
  }
  console.log(`Export ${row.key} : ${result.total} kits, sans doublon.`);
 }
 console.log('Stock reel Flash B : chaque categorie et son export reconcilient, sans doublon de kit.');
 const regression=await queryStock(c,new URLSearchParams({view:'stock',search:'0526112372A029472'}));
 assert.equal(Number(regression.metrics.instock.value),0);
 assert.equal(regression.stockBreakdown.find(r=>r.key==='returned').quantity,1);
 console.log('Regression 0526112372A029472 : retour terrain, jamais compte comme disponible.');
 const accessories=['15107339','15111564','15105719','15109427','15107626','15112220','15107571','15105771','15107407','15107585','15111606','15111602','15107581','15106303','15104278'];
 const excluded=(await c.query(`SELECT a.serial_number FROM bi_schema.dim_asset a WHERE a.serial_number=ANY($1::text[]) AND ${completeKitSQL('a')}`,[accessories])).rows;
 assert.equal(excluded.length,0,'Les quinze accessoires sont exclus des kits complets.');
 const spark=await queryStock(c,new URLSearchParams({view:'stock',status:'INSTOCK',product:'SunShine_Spark',stockCondition:'available',exportDetails:'true'}));
 assert.ok(spark.rows.every(r=>!r.serialNumber.startsWith('15')));
 console.log(`SunShine : ${spark.total} disponibles exportes ; aucun accessoire de prefixe 15.`);
 for(const serial of ['SHX-12308559','SHX-18388448','00234801']){
  const result=await queryStock(c,new URLSearchParams({view:'stock',search:serial}));
  assert.equal(Number(result.metrics.instock.value),0,`${serial} exclu du neuf apres UNFLAGGED`);
  assert.equal(result.stockBreakdown.find(r=>r.key==='returned').quantity,1);
  console.log(`Regression ${serial} : exclu du neuf apres UNFLAGGED.`);
 }
}finally{await c.end();}
