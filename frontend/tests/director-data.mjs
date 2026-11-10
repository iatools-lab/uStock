// Donnees de test uniquement : deux produits sans rattachement certain.
export const client={query:async(sql,values=[])=>{
 const rows=[{holder_id:null,product_reference:'P1',product_name:'Kit Alpha',status:'INSTOCK',in_crm:true,quantity:7},{holder_id:null,product_reference:'P2',product_name:'Kit Beta',status:'DEPLOYED',in_crm:true,quantity:2},{holder_id:null,product_reference:'P1',product_name:'Kit Alpha',status:'DEFECTIVE',in_crm:true,quantity:1}];
 if(sql.includes('current_database()'))return {rows:[{at:new Date('2026-11-10T10:00:00Z'),loaded:new Date('2026-11-10T10:00:00Z'),today:'2026-11-10'}]};
 if(sql.includes('GROUP BY holder_id,routing_shop_id,product_reference,status,in_crm'))return {rows};
 if(sql.includes('GROUP BY month,product_reference,status,holder_id,routing_shop_id'))return {rows:rows.map(r=>({...r,month:String(values[1]).slice(0,values[0]==='2026-10-01'?10:7),age90plus:r.status==='INSTOCK'?r.quantity:0}))};
 return {rows:[]};
}};
