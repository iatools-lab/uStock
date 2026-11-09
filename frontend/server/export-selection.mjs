import { DatabaseSync, backup } from 'node:sqlite';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const source=process.env.UKIT_SELECTION_FILE||fileURLToPath(new URL('./analysis-selection.sqlite',import.meta.url));
const destination=new URL('../../backend/backups/selection/analysis-selection.sqlite',import.meta.url);
await mkdir(new URL('./',destination),{recursive:true});
const db=new DatabaseSync(source,{readOnly:true});
try{await backup(db,fileURLToPath(destination));console.log('Sélection administrateur sauvegardée pour le premier démarrage du conteneur.');}finally{db.close();}
