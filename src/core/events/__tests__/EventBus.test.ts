import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../EventBus.js';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // ── on / emit basics ───────────────────────────────────────────────────────

  it('calls handler with correct payload', async () => {
    const handler = vi.fn();
    bus.on('client:created', handler);

    await bus.emit('client:created', {
      clientId: 'c1', email: 'test@test.fr', nom: 'Dupont', prenom: 'Jean',
    });

    expect(handler).toHaveBeenCalledOnce();
    const event = handler.mock.calls[0][0];
    expect(event.type).toBe('client:created');
    expect(event.payload.clientId).toBe('c1');
    expect(event.emittedAt).toBeInstanceOf(Date);
  });

  it('calls multiple handlers for the same event', async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('devis:uploaded', h1);
    bus.on('devis:uploaded', h2);

    await bus.emit('devis:uploaded', {
      devisId: 'd1', projectId: 'p1', clientId: 'c1',
      fileUrl: 'http://x.com/f.pdf', fileName: 'f.pdf',
    });

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('does not call handler after unsubscribe', async () => {
    const handler = vi.fn();
    const unsub = bus.on('system:health_ok', handler);
    unsub();

    await bus.emit('system:health_ok', { checked_at: new Date().toISOString() });
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not call handlers for other event types', async () => {
    const handler = vi.fn();
    bus.on('client:enriched', handler);

    await bus.emit('client:enrichment_failed', { clientId: 'c1', error: 'oops' });
    expect(handler).not.toHaveBeenCalled();
  });

  // ── Error isolation ────────────────────────────────────────────────────────

  it('continues calling subsequent handlers when one throws', async () => {
    const throwing = vi.fn().mockRejectedValue(new Error('handler error'));
    const safe = vi.fn();

    bus.on('insurance:uploaded', throwing);
    bus.on('insurance:uploaded', safe);

    // Should not throw
    await expect(
      bus.emit('insurance:uploaded', { clientId: 'c1', fileUrl: 'u', fileName: 'f.pdf' })
    ).resolves.not.toThrow();

    expect(throwing).toHaveBeenCalledOnce();
    expect(safe).toHaveBeenCalledOnce();
  });

  // ── off / clear ───────────────────────────────────────────────────────────

  it('off() removes all handlers for an event', async () => {
    const handler = vi.fn();
    bus.on('project:created', handler);
    bus.off('project:created');

    await bus.emit('project:created', { projectId: 'p1', clientId: 'c1', type: 'toiture', adresse: '1 rue de Paris' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('clear() removes all handlers for all events', async () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('client:created', h1);
    bus.on('devis:uploaded', h2);
    bus.clear();

    await bus.emit('client:created', { clientId: 'c1', email: 'e@e.fr', nom: 'A', prenom: 'B' });
    await bus.emit('devis:uploaded', { devisId: 'd1', projectId: 'p1', clientId: 'c1', fileUrl: 'u', fileName: 'f.pdf' });

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });

  // ── handlerCount ──────────────────────────────────────────────────────────

  it('handlerCount returns correct count per event', () => {
    bus.on('client:created', vi.fn());
    bus.on('client:created', vi.fn());
    bus.on('devis:uploaded', vi.fn());

    expect(bus.handlerCount('client:created')).toBe(2);
    expect(bus.handlerCount('devis:uploaded')).toBe(1);
    expect(bus.handlerCount()).toBe(3);
  });

  // ── Async handlers ────────────────────────────────────────────────────────

  it('awaits async handlers in sequence', async () => {
    const order: number[] = [];

    bus.on('system:pipeline_error', async () => {
      await new Promise(r => setTimeout(r, 10));
      order.push(1);
    });
    bus.on('system:pipeline_error', async () => {
      order.push(2);
    });

    await bus.emit('system:pipeline_error', { failed_jobs_count: 1 });
    expect(order).toEqual([1, 2]);
  });

  // ── devis:analyzed payload ────────────────────────────────────────────────

  it('emits devis:analyzed with correct shape', async () => {
    const handler = vi.fn();
    bus.on('devis:analyzed', handler);

    await bus.emit('devis:analyzed', {
      devisId: 'd1',
      quality_score: 85,
      certification_score: 78,
      benchmark_position: 65,
      insurance_covered: true,
    });

    const payload = handler.mock.calls[0][0].payload;
    expect(payload.quality_score).toBe(85);
    expect(payload.insurance_covered).toBe(true);
  });

  // ── insurance events ──────────────────────────────────────────────────────

  it('emits insurance:validated with activities and alerts', async () => {
    const handler = vi.fn();
    bus.on('insurance:validated', handler);

    await bus.emit('insurance:validated', {
      clientId: 'c1',
      covered_activities: ['electricite', 'isolation'],
      expiration_date: '2027-01-01',
      alerts: [],
    });

    const payload = handler.mock.calls[0][0].payload;
    expect(payload.covered_activities).toContain('electricite');
  });
});
