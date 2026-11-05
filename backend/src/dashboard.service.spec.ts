import { afterEach, describe, it, expect, vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';
import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';

describe('API DG : contrat et lecture locale', () => {
  const instances: DashboardService[] = [];
  const create = () => {
    const service = new DashboardService();
    instances.push(service);
    return service;
  };
  afterEach(async () => {
    for (const service of instances.splice(0)) await service.onModuleDestroy();
    vi.restoreAllMocks();
  });
  it('refuse un niveau arbitraire avant toute connexion', async () => {
    await expect(
      create().directorStock({ level: 'zone; DROP TABLE x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('refuse les anciens filtres et valeurs non scalaires', async () => {
    const service = create();
    await expect(
      service.directorOverview({ city: 'Yaoundé' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.directorOverview({ region: ['Centre'] as unknown as string }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
  it('conserve null pour une vente non définie et utilise une photographie cohérente', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM ukit_etl.import_run'))
        return { rows: [{ id: '8', finished_at: '2026-10-06' }] };
      if (sql.includes('equipment_total'))
        return { rows: [{ active: '2', availability_unconfirmed: '2' }] };
      return { rows: [] };
    });
    const release = vi.fn(),
      service = create();
    // Remplace uniquement le pool local pour contrôler la transaction et les paramètres.
    (service as unknown as { pool: unknown }).pool = {
      connect: async () => ({ query, release }),
      end: async () => {},
    };
    const result = await service.directorOverview({
      region: "Centre' OR true--",
    });
    expect(result.source).toBe('postgres_local');
    expect(result.data.sales).toBeNull();
    expect(result.data.availabilityComplete).toBe(false);
    expect(query.mock.calls[0]?.[0]).toContain('REPEATABLE READ READ ONLY');
    expect(query.mock.calls.at(-1)?.[0]).toBe('COMMIT');
    expect(query.mock.calls.some((args) => args[0].includes("Centre'"))).toBe(
      false,
    );
    expect(release).toHaveBeenCalledOnce();
  });
  it('retourne 503 et libère la connexion si aucun import ne réussit', async () => {
    const query = vi.fn(async () => ({ rows: [] })),
      release = vi.fn(),
      service = create();
    (service as unknown as { pool: unknown }).pool = {
      connect: async () => ({ query, release }),
      end: async () => {},
    };
    await expect(service.directorOverview({})).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
    expect(release).toHaveBeenCalledOnce();
  });
});
