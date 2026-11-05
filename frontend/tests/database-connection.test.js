import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration } from '../server/local-database.mjs';

test('le dashboard utilise la source distante et ignore la destination locale',()=>{
  const c=configuration({UKIT_DATABASE_URL:'',SOURCE_DATABASE_URL:'',SOURCE_DB_HOST:'remote.example',SOURCE_DB_DATABASE:'CRM',SOURCE_DB_USER:'reader',SOURCE_DB_PASSWORD:'test',SOURCE_DB_SSLMODE:'require',TARGET_DB_HOST:'localhost',TARGET_DB_DATABASE:'ukit'});
  assert.equal(c.host,'remote.example');assert.equal(c.database,'CRM');
  assert.ok(c.ssl);assert.ok(c.options.includes('default_transaction_read_only=on'));
});

test('les accès historiques du fichier env sont acceptés pour la source distante',()=>{
  const c=configuration({UKIT_DATABASE_URL:'',SOURCE_DATABASE_URL:'',SOURCE_DB_HOST:undefined,SOURCE_DB_DATABASE:undefined,SOURCE_DB_USER:undefined,SOURCE_DB_PASSWORD:undefined,server:'legacy.example',database:'CRM',user:'reader',password:'test'});
  assert.equal(c.host,'legacy.example');assert.equal(c.database,'CRM');
});

test('une URL distante explicite configure la connexion et les URL invalides sont refusées',()=>{
  const c=configuration({UKIT_DATABASE_URL:'postgresql://reader:test@remote.example:5433/CRM?sslmode=require'});
  assert.equal(c.host,'remote.example');assert.equal(c.port,5433);assert.equal(c.database,'CRM');assert.ok(c.ssl);
  assert.throws(()=>configuration({UKIT_DATABASE_URL:'https://remote.example/CRM'}));
});
