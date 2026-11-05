import { describe,it,expect } from 'vitest';
import { resolveTelemetry } from './telemetry.config.js';
describe('Télémétrie facultative',()=>{
 it('désactivée par défaut, même avec des identifiants',()=>{
  expect(resolveTelemetry({})).toBeUndefined();
  expect(resolveTelemetry({OBSERVE_APP_KEY:'key',OBSERVE_APP_SECRET:'secret'})).toBeUndefined();
  expect(resolveTelemetry({OBSERVE_ENABLED:'false'})).toBeUndefined();
 });
 it('refuse les valeurs de démonstration avant tout worker',()=>{
  expect(()=>resolveTelemetry({OBSERVE_ENABLED:'true'})).toThrow('identifiants');
  expect(()=>resolveTelemetry({OBSERVE_ENABLED:'true',OBSERVE_APP_KEY:'YOUR_APP_KEY',OBSERVE_APP_SECRET:'YOUR_APP_SECRET'})).toThrow('identifiants');
 });
 it('active uniquement une configuration explicite',()=>{
  expect(resolveTelemetry({OBSERVE_ENABLED:'true',OBSERVE_APP_KEY:'key',OBSERVE_APP_SECRET:'secret'})).toEqual({appKey:'key',appSecret:'secret',serviceId:'backend'});
 });
});
