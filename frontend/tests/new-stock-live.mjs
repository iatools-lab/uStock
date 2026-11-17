import assert from 'node:assert/strict';
import pg from 'pg';
import { configuration,createLocalDatabase } from '../server/local-database.mjs';
import { newStockSQL,eligibleSQL } from '../server/queries/status-scope.mjs';
import { contractSalesCTE } from '../server/queries/contract-sales.mjs';
import { inclusionSQL } from '../server/queries/selection-rules.mjs';
import { productionSelection } from '../server/production-selection.mjs';
const c=new pg.Client(configuration()),store=productionSelection(':memory:');
const database=createLocalDatabase({selectionStore:store});
try{
 await c.connect();
 const cases=`(SELECT b.serial_number,b.product_reference,b.product_name,b.crm_holder_name,fixture.* FROM (SELECT a.* FROM bi_schema.dim_asset a LEFT JOIN stock_signed_assets signed_stock ON signed_stock.serial_number=a.serial_number WHERE ${newStockSQL('a','a.crm_status',{signed:'signed_stock.serial_number IS NOT NULL'})} LIMIT 1) b CROSS JOIN (VALUES ('neuf','PAV','INSTOCK'),('defectueux','PAV','DEFECTIVE'),('sans_flag',NULL,'INSTOCK'),('autre_flag','AUTRE','INSTOCK'),('vendu','PAV','DEPLOYED')) fixture(id,crm_flag,crm_status)) AS a`;
 assert.deepEqual((await c.query(`WITH ${contractSalesCTE()} SELECT id FROM ${cases} WHERE ${newStockSQL('a')}`)).rows.map(r=>r.id),['neuf','sans_flag']);
 const data=await database.snapshot(new URLSearchParams({role:'dg',view:'stock',status:'INSTOCK'}));
 const values=[],included=inclusionSQL(store.read(),values);
 const direct=(await c.query(`WITH ${contractSalesCTE()} SELECT count(*)::int n FROM bi_schema.dim_asset a LEFT JOIN stock_signed_assets signed_stock ON signed_stock.serial_number=a.serial_number WHERE ${eligibleSQL('a')} AND ${newStockSQL('a','a.crm_status',{signed:'signed_stock.serial_number IS NOT NULL'})} AND ${included}
 AND a.serial_number NOT IN(SELECT serial_number FROM contract_first_sales WHERE sold_at IS NULL OR sold_at<(((now() AT TIME ZONE 'Africa/Douala')::date+1)::timestamp AT TIME ZONE 'Africa/Douala'))`,values)).rows[0].n;
 assert.equal(Number(data.metrics.instock.value),direct);assert.equal(Number(data.metrics.defective.value),0);
 assert.ok(data.statuses.every(r=>r.key==='INSTOCK'));
 const admin=await database.administration(new URLSearchParams({status:'INSTOCK',scope:'included'}));assert.ok(admin.total>=direct);
 assert.ok(admin.rows.every(r=>r.crmStatus==='INSTOCK'));
 const overview=await database.snapshot(new URLSearchParams({role:'dg',view:'overview'}));
 assert.equal(overview.stockCustody.reduce((n,r)=>n+Number(r.quantity),0),Number(overview.metrics.instock.value));
 assert.ok(overview.stockCustody.every(r=>r.key!=='client'));
 const defectValues=[],defectIncluded=inclusionSQL(store.read(),defectValues);
 const defective=(await c.query(`WITH ${contractSalesCTE()} SELECT count(*)::int n FROM bi_schema.dim_asset a WHERE ${eligibleSQL('a')} AND a.crm_status='DEFECTIVE' AND ${defectIncluded}
 AND a.serial_number NOT IN(SELECT serial_number FROM contract_first_sales WHERE sold_at IS NULL OR sold_at<(((now() AT TIME ZONE 'Africa/Douala')::date+1)::timestamp AT TIME ZONE 'Africa/Douala'))`,defectValues)).rows[0].n;
 assert.equal(Number(overview.metrics.defective.value),defective);assert.ok(defective>0);
 const defectAdmin=await database.administration(new URLSearchParams({status:'DEFECTIVE',scope:'included'}));assert.equal(defectAdmin.total,defective);
 console.log(`Defectueux visibles separement : ${defective}. Localisation = kits disponibles, sans clients ni ventes.`);
 console.log(`Kits disponibles : ${direct} kits ; KPI et requete directe concordent ; administration couvre aussi les stocks non disponibles. Les defectueux sont exclus uniquement du stock neuf et restent visibles separement.`);
}finally{await c.end();await database.close();}
