export function databaseFailure(error){
  const code=String(error?.code||'DATABASE_UNAVAILABLE');
  const hints={
    '28P01':'Identifiant ou mot de passe PostgreSQL incorrect.',
    '28000':'Accès refusé par PostgreSQL : vérifier pg_hba.conf, utilisateur et SSL.',
    '3D000':'La base PostgreSQL configurée est introuvable.',
    '42501':'Le compte PostgreSQL ne dispose pas des droits de lecture nécessaires.',
    '42P01':'Une table ou vue BI nécessaire est absente.',
    '42703':'Une colonne BI nécessaire est absente.',
    '57014':'La requête dépasse le délai SQL autorisé.',
    ECONNREFUSED:'Connexion refusée : vérifier hôte, port et écoute PostgreSQL.',
    ECONNRESET:'Connexion interrompue par le serveur distant ou le réseau.',
    ETIMEDOUT:'Délai réseau dépassé : vérifier pare-feu et accès depuis le conteneur.',
    ENOTFOUND:'Nom du serveur PostgreSQL introuvable.',
    EACCES:'Le conteneur ne peut pas lire un fichier de configuration.',
    ENOENT:'Un fichier de configuration ou référentiel est absent.',
    DEPTH_ZERO_SELF_SIGNED_CERT:'Certificat PostgreSQL non reconnu.',
  };
  return {code,hint:hints[code]||'Vérifier la configuration PostgreSQL, SSL et les accès réseau.'};
}
export function reportDatabaseFailure(context,error){
  const failure=databaseFailure(error);
  // Aucun message brut : PostgreSQL peut y inclure des identifiants ou du SQL.
  console.error(JSON.stringify({event:'database_failure',context,...failure}));
  return failure;
}
