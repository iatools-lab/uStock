import { useEffect, useId, useRef, useState } from 'react';
import { Maximize2, X } from 'lucide-react';
import '../styles/chart-detail.css';

function Detail({title,children,onClose}){
  const ref=useRef(null),id=useId();
  useEffect(()=>{
    const dialog=ref.current,previous=document.activeElement,overflow=document.body.style.overflow;
    dialog.showModal();document.body.style.overflow='hidden';
    return ()=>{dialog.close();document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus();};
  },[]);
  return <dialog ref={ref} className="chart-detail-dialog" aria-labelledby={id} onCancel={e=>{e.preventDefault();e.stopPropagation();onClose();}} onClick={e=>{if(e.target===ref.current)onClose();}}><header className="chart-detail-heading"><h2 id={id}>{title}</h2><button autoFocus className="secondary-button" aria-label="Fermer le graphique agrandi" onClick={onClose}><X size={18}/> Fermer</button></header><div className="chart-detail-body">{children}</div></dialog>;
}

export default function ChartFrame({title,children}){
  const [expanded,setExpanded]=useState(false);
  return <div className="chart-frame"><button className="secondary-button chart-expand" title="Agrandir le graphique" aria-label={`Agrandir : ${title}`} aria-haspopup="dialog" onClick={()=>setExpanded(true)}><Maximize2 size={15}/></button>{children(false)}{expanded&&<Detail title={title} onClose={()=>setExpanded(false)}>{children(true)}</Detail>}</div>;
}

export const chartColor=index=>['#001a70','#fe5716','#168779','#7552ad','#a16a12','#147dba'][index]||`hsl(${(index*137.508)%360} 62% 38%)`;
