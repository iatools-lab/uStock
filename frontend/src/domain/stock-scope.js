const fields={product:['Produit','products'],region:['Région','regions'],zone:['Zone','zones'],department:['Département','departments'],arrondissement:['Arrondissement','arrondissements'],amId:['Area manager','ams'],shopId:['Boutique','shops'],holderId:['Détenteur',null],holderKind:['Détention',null],status:['État',null],search:['Recherche',null]};
export function stockScope(filters={},options={}){
 const selected=Object.entries(fields).filter(([key])=>Boolean(filters[key]));
 const detail=selected.map(([key,[label,list]])=>{
  const value=filters[key],name=value==='__unknown__'?'Sans rattachement':value==='__central__'||value==='central'?'Entrepôts':({INSTOCK:'En stock',DEPLOYED:'Vendus',DEFECTIVE:'Défectueux'}[value]||options[list]?.find(r=>r.value===value)?.label||value);
  return `${label} : ${name}`;
 }).join(' · ');
 return {national:selected.length===0,title:selected.length?'Stock ciblé':'Stock national',detail};
}
