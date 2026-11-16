// Une exclusion produit s'applique aussi aux equipements inclus individuellement.
export function inclusionSQL(selection,values,alias='a',key=`coalesce(${alias}.serial_number,'')`){
 const arrays=[selection.rules.filter(r=>r.kind==='asset'&&r.included).map(r=>r.key),selection.rules.filter(r=>r.kind==='asset'&&!r.included).map(r=>r.key),selection.rules.filter(r=>r.kind==='product'&&!r.included).map(r=>r.key)];
 const slots=arrays.map(array=>{values.push(array);return `$${values.length}::text[]`;});
 return `((${key}=ANY(${slots[0]}) OR NOT (${key}=ANY(${slots[1]}))) AND NOT (coalesce(nullif(${alias}.product_reference,''),'__unknown__')=ANY(${slots[2]})))`;
}
