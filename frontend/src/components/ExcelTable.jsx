import { useState } from 'react';
import { Download } from 'lucide-react';

export function ExcelButton({title,headers,rows,metadata=[]}){
  const [busy,setBusy]=useState(false),[error,setError]=useState(false);
  async function download(){
    setBusy(true);setError(false);
    try{
      const {default:writeExcel}=await import('write-excel-file/browser');
      const header=headers.map(value=>({value,fontWeight:'bold',backgroundColor:'#001a70',textColor:'#ffffff'}));
      const sheets=[{sheet:'Donnees',data:[header,...rows],columns:headers.map((_,i)=>({width:i?22:38}))}];
      if(metadata.length)sheets.push({sheet:'Perimetre',data:[['Tableau',title],...metadata],columns:[{width:28},{width:60}]});
      const file=title.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'-').replace(/-$/,'');
      await writeExcel(sheets).toFile(`${file}.xlsx`);
    }catch{setError(true);}finally{setBusy(false);}
  }
  return <div><button className="secondary-button excel-download" disabled={busy} onClick={download} aria-label={`Télécharger Excel : ${title}`}><Download size={15}/>{busy?'Export…':'Excel'}</button>{error&&<small role="alert">Export indisponible. Réessayez.</small>}</div>;
}

export default function ExcelTable({title,headers,rows,totals,metadata=[]}){
  const text=value=>typeof value==='number'?value.toLocaleString('fr-FR'):value;
  return <section className="panel table-panel"><div className="panel__head"><h2>{title}</h2><ExcelButton title={title} headers={headers} rows={totals?[...rows,totals]:rows} metadata={metadata}/></div><div className="table-scroll"><table><thead><tr>{headers.map((h,i)=><th key={i}>{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{row.map((v,j)=><td key={j}>{text(v)}</td>)}</tr>)}</tbody>{totals&&<tfoot><tr>{totals.map((v,j)=><th key={j}>{text(v)}</th>)}</tr></tfoot>}</table></div></section>;
}
