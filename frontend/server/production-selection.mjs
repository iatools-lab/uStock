import { openSelectionStore } from './analysis-selection.mjs';
// Seules les decisions administrateur sont conservees, jamais les donnees CRM.
const productExcluded=["176468178","176943497","177972146","177980311","AMP-Lmp","AMP-Rad","AMP-Tor","Appliance_Dlight_AIR","Appliance_Dlight_S200","Appliance_Dlight_T200","Appliance_Dlight_T200R","BIO-Lmp","BIO-Tor","Dlight-24-E24","Dlight-24-Lmp","Dlight-24-PCBA","Dlight-24-Pan","Dlight-32","Dlight-32-E32","Dlight-32-Lmp","Dlight-32-PCBA","Dlight-32-Pan","Dlight-32-Rad","Dlight-32-Tor","EMobility_ZEM_QS72V3000W","FLH-B-Lmp","FLH-B-Pan","FLH-C-Pan","FLH-Dlight-PCBA","FLH-P-Dlight","FLH-P-Dlight-Lmp","FLH-P-Dlight-PCBA","FLH-P-Dlight-Pan","FLH-P-Dlight-Rad","HOTSPOT","LIO-C-BE","LIO-C-E22","LIO-C-E32","LIO-C-Pan","LIO-D-E24","LIO-D-Pan","LUC-C-Pan","LUC-D-Pan","LUCIOLETEST","Lion-RET23","Lion-Spark-32-Bat","Lion-Spark-40-Bat","Lion-Spark-40-E32","M63J13H","N/A","SolarWorxBU","Sun-Spark-Bat","Sun-Spark-Int","Sun-Spark-Lmp","ZEM-MOT"];
const productIncluded=["178022648","178022668","178903758","DLIGHT","Flash_B","Flash_C_Amped","Flash_DLight","Flash_Plus_DLight","JUAX","LION TEST","Lion UP23","Lion_BIO5000_24","Lion_BIO5000_32","Lion_C_WOW_TV22","Lion_C_WOW_TV24","Lion_C_WOW_TV32","Lion_DLight_X1000","Lion_DLight_X1000E32","Lion_Spark_E32","Lion_Spark_E40","Luciole_BIO620","Luciole_C_WOW_100","OV100","RE_Flash_B","RE_Luciole_C_WOW_100","SOLARWORX","SUNKING3","SolarWorxFK","SolarWorxHK","SolarWorxSHK","SunShine_Spark"];
export function productionSelection(filename=process.env.UKIT_SELECTION_FILE){
 const rules=[...productExcluded.map(key=>({kind:'product',key,included:false})),...productIncluded.map(key=>({kind:'product',key,included:true}))];
 const store=openSelectionStore(filename);
 if(store.read().revision===0){
   try{for(const included of [false,true])store.save({kind:'product',keys:rules.filter(rule=>rule.included===included).map(rule=>rule.key),included});}
   catch(error){store.close();throw error;}
 }
 return store;
}
