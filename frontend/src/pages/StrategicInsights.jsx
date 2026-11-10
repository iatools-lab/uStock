import { useState } from 'react';
import { BarChart, ParetoChart, RiskHeatmap } from '../components/ApexCharts.jsx';
import ExcelTable from '../components/ExcelTable.jsx';
import { agingStock, concentration, redistribution, riskMatrix } from '../domain/strategic-stock.js';
import '../styles/strategic-insights.css';

const meta=analysis=>[['Début',analysis.window.start],['Fin',analysis.window.end],['Règle','Premières ventes validées Upya ; stock en fin de période'],...Object.entries(analysis.filters||{})];

export function StockRisks({analysis}){
  const matrix=riskMatrix(analysis),critical=matrix.positions.filter(r=>r.zone&&r.risk==='critical').length;
  return <div className="strategy-section"><div className="strategy-heading"><h3>Anticiper les ruptures</h3><span>{critical} couples zone / produit sous 15 jours</span></div><RiskHeatmap matrix={matrix} title="Où risque-t-on de manquer de kits ?"/><p className="decision-note">Couverture = stock ÷ ventes moyennes par jour. Chaque référence est séparée ; les jours sont estimés, pas garantis.{matrix.unassigned>0?` ${matrix.unassigned.toLocaleString('fr-FR')} kits en stock sans zone ou en entrepôt sont détaillés dans l’export.`:''}</p></div>;
}

export function Redistribution({analysis}){
  const result=redistribution(analysis);
  return <div className="strategy-section"><div className="strategy-heading"><h3>Rééquilibrer avant de commander</h3><span>{result.transferable.toLocaleString('fr-FR')} kits redistribuables estimés</span></div><BarChart title="Surplus et besoins par zone" rows={result.zones} seriesSpec={[{key:'surplus',label:'Surplus disponible'},{key:'need',label:'Besoin non couvert'}]} unit="kits"/><p className="decision-note">Cible de 30 jours, calculée par référence. Les stocks sans vente observée et les lieux sans zone ne sont pas proposés comme sources. Le transport et les réceptions futures restent à vérifier.</p><ExcelTable title="Propositions de redistribution" headers={['Produit','Référence','Depuis','Vers','Quantité proposée']} rows={result.plans.map(r=>[r.productName,r.product,r.from,r.to,r.quantity])} metadata={meta(analysis)}/>{!result.plans.length&&<p className="decision-note">Aucun transfert entre zones ne peut être proposé avec les informations de cette sélection.</p>}<p className="decision-note">Besoin restant après redistribution estimée : {result.remaining.toLocaleString('fr-FR')} kits, sur les zones renseignées.</p></div>;
}

export function SalesConcentration({analysis}){
  const [dimension,setDimension]=useState('zone'),rows=concentration(analysis,dimension),top=rows.slice(0,3).reduce((n,r)=>n+r.share,0);
  return <div className="strategy-section"><div className="strategy-heading"><h3>Mesurer la dépendance commerciale</h3><div className="strategy-switch" role="group" aria-label="Concentration des ventes"><button aria-pressed={dimension==='zone'} onClick={()=>setDimension('zone')}>Zones</button><button aria-pressed={dimension==='product'} onClick={()=>setDimension('product')}>Produits</button></div></div><p className="decision-note">Les {Math.min(3,rows.length)} premiers {dimension==='zone'?'territoires':'produits'} représentent {top.toFixed(1)} % des ventes de la sélection.</p><ParetoChart title="Sur quoi reposent nos ventes ?" rows={rows}/></div>;
}

export function StockAging({analysis}){
  const aging=agingStock(analysis),stock=Object.values(aging.totals).reduce((n,r)=>n+r,0);
  const rows=[{key:'0',label:'Moins de 30 jours',quantity:aging.totals.ageUnder30},{key:'30',label:'30 à 59 jours',quantity:aging.totals.age30to59},{key:'60',label:'60 à 89 jours',quantity:aging.totals.age60to89},{key:'90',label:'90 jours et plus',quantity:aging.totals.age90plus},{key:'unknown',label:'Ancienneté inconnue',quantity:aging.totals.ageUnknown}];
  return <div className="strategy-section"><div className="strategy-heading"><h3>Repérer le stock qui reste longtemps</h3><span>{aging.totals.age90plus.toLocaleString('fr-FR')} kits à 90 jours ou plus</span></div><BarChart title="Depuis combien de temps le stock reste-t-il chez le détenteur ?" rows={rows} unit="kits"/><p className="decision-note">Durée depuis le dernier changement de détention ou d’état enregistré, à la date de fin choisie. Un transfert remet cette durée à zéro ; ce graphique ne mesure pas l’âge total du kit.</p><ExcelTable title="Ancienneté du stock par zone" headers={['Zone','Moins de 30 j','30–59 j','60–89 j','90 j et plus','Inconnue','Total']} rows={aging.rows.map(r=>[r.label,r.ageUnder30,r.age30to59,r.age60to89,r.age90plus,r.ageUnknown,r.quantity])} totals={['Total',aging.totals.ageUnder30,aging.totals.age30to59,aging.totals.age60to89,aging.totals.age90plus,aging.totals.ageUnknown,stock]} metadata={meta(analysis)}/></div>;
}
