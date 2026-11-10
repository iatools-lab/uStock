import { useEffect, useId, useRef, useState } from 'react';
import { Maximize2, X, Info } from 'lucide-react';
import { chartHelp } from '../domain/chart-help.js';
import '../styles/chart-detail.css';
import '../styles/chart-info.css';

export function ChartInfo({title,explanation,floating=false,align='right'}){
  const [open,setOpen]=useState(false),id=useId(),ref=useRef(null);
  useEffect(()=>{if(!open)return;const outside=e=>{if(!ref.current?.contains(e.target))setOpen(false);};const escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);ref.current?.querySelector('button')?.focus();}};document.addEventListener('pointerdown',outside);ref.current?.addEventListener('keydown',escape);const node=ref.current;return()=>{document.removeEventListener('pointerdown',outside);node?.removeEventListener('keydown',escape);};},[open]);
  return <div ref={ref} className={`chart-info ${floating?'chart-info--floating':''} ${align==='left'?'chart-info--left':''}`}><button type="button" className="secondary-button chart-info-button" aria-label={`Comprendre : ${title}`} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(v=>!v)}><Info size={17}/></button>{open&&<div id={id} role="note" className="chart-info-content"><strong>Comment lire ce graphique ?</strong><p>{explanation||chartHelp(title)}</p><button className="link-button" onClick={()=>{setOpen(false);ref.current?.querySelector('button')?.focus();}}>Fermer l’explication</button></div>}</div>;
}
function Detail({title,explanation,children,onClose}){
  const ref=useRef(null),id=useId();
  useEffect(()=>{
    const dialog=ref.current,previous=document.activeElement,overflow=document.body.style.overflow;
    dialog.showModal();document.body.style.overflow='hidden';
    return ()=>{dialog.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
  },[]);
  return <dialog ref={ref} className="chart-detail-dialog" aria-labelledby={id} onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}><header className="chart-detail-heading"><h2 id={id}>{title}</h2><ChartInfo title={title} explanation={explanation}/><button autoFocus className="secondary-button" aria-label="Fermer le graphique agrandi" onClick={onClose}><X size={18}/> Fermer</button></header><div className="chart-detail-body">{children}</div></dialog>;
}

export default function ChartFrame({title,explanation,children}){
  const [expanded,setExpanded]=useState(false);
  return <div className="chart-frame"><ChartInfo title={title} explanation={explanation} floating/><button className="secondary-button chart-expand" title="Agrandir le graphique" aria-label={`Agrandir : ${title}`} aria-haspopup="dialog" onClick={()=>setExpanded(true)}><Maximize2 size={15}/></button>{children(false)}{expanded&&<Detail title={title} explanation={explanation} onClose={()=>setExpanded(false)}>{children(true)}</Detail>}</div>;
}

export const chartColor=index=>['#001a70','#fe5716','#168779','#7552ad','#a16a12','#147dba'][index]||`hsl(${(index*137.508)%360} 62% 38%)`;
