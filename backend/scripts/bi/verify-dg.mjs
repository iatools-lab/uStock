import 'reflect-metadata';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DirectorController } from '../../dist/director.controller.js';
import { DashboardService } from '../../dist/dashboard.service.js';
// Régression essentielle : l'API doit fonctionner sans accès source.
process.env.SOURCE_DB_HOST = 'source-volontairement-indisponible.invalid';
const module = await Test.createTestingModule({
  controllers: [DirectorController],
  providers: [DashboardService],
}).compile();
const app = module.createNestApplication();
await app.init();
try {
  const client = request(app.getHttpServer());
  const response = await client.get('/api/dg/overview').expect(200);
  const { data, lastImport, source } = response.body;
  assert.equal(source, 'postgres_local');
  assert.ok(lastImport.finished_at);
  const total = BigInt(data.totals.active);
  for (const list of [data.custody, data.regions, data.products]) {
    assert.equal(
      list.reduce((n, r) => n + BigInt(r.quantity), 0n),
      total,
    );
  }
  assert.equal(data.sales, null);
  const stock = await client.get('/api/dg/stock?level=zone').expect(200);
  assert.equal(
    stock.body.data.rows.reduce((n, r) => n + BigInt(r.active), 0n),
    total,
  );
  const options = await client.get('/api/dg/filters?field=product').expect(200);
  const product = options.body.data.options[0]?.value;
  if (product) {
    const filtered = await client
      .get('/api/dg/overview')
      .query({ product })
      .expect(200);
    assert.ok(filtered.body.data.products.every((p) => p.key === product));
  }
  await client
    .get('/api/dg/stock')
    .query({ level: 'region; DROP TABLE x' })
    .expect(400);
  await client.get('/api/dg/overview?unknown=value').expect(400);
  console.log(
    JSON.stringify({
      status: 'DG HTTP validé sur base locale',
      runId: lastImport.id,
      stock: String(total),
      productOptions: options.body.data.options.length,
      sourceFallback: false,
    }),
  );
} finally {
  await app.close();
}
