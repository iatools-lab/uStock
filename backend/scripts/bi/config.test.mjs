import { test } from 'node:test';
import assert from 'node:assert/strict';
import {parseConfig,connection,assertSeparate,rowKey} from './config.mjs';
test('ancien fichier et variables standard, mots de passe contenant deux-points',()=>{
 const e=parseConfig('server: example\npassword: a:b=c\nTARGET_DB_PASSWORD="x:y=z"');
 assert.equal(e.server,'example');assert.equal(e.password,'a:b=c');assert.equal(e.TARGET_DB_PASSWORD,'x:y=z');
});
test('destination manquante refusée sans reprendre les accès source',()=>{
 assert.throws(()=>connection({server:'source',database:'upya',user:'u',password:'secret'},'target'),/TARGET_DB_HOST/);
});
test('source en lecture seule, base source interdite en destination',()=>{
 const c=connection({server:'source',database:'UPYA',user:'u',password:'secret'},'source');
 assert.match(c.options,/default_transaction_read_only=on/);
 assert.throws(()=>assertSeparate(c,{database:'upya'}),/distincte/);
});
test('clés composites sans collisions et colonnes manquantes refusées',()=>{
 assert.notEqual(rowKey({a:'x|y',b:'z'},['a','b']),rowKey({a:'x',b:'y|z'},['a','b']));
 assert.throws(()=>rowKey({a:1},['a','b']),/absente/);
});
