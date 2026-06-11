import type {
  Venture,
  VentureArtifact,
  VentureArtifactKind,
  VentureTimelineEvent,
} from '@ventureos/contracts';

import type { ListVenturesQuery, VentureStore } from './types.js';

/**
 * In-memory tenant-isolated VentureStore. All maps are keyed by
 * `${ownerId}/${ventureId}` so a cross-tenant query simply returns nothing.
 */
export class InMemoryVentureStore implements VentureStore {
  private readonly ventures = new Map<string, Venture>();
  private readonly artifacts = new Map<string, VentureArtifact[]>();
  private readonly events = new Map<string, VentureTimelineEvent[]>();

  private key(ownerId: string, ventureId: string): string {
    return `${ownerId}/${ventureId}`;
  }

  async createVenture(v: Venture): Promise<void> {
    this.ventures.set(this.key(v.ownerId, v.ventureId), v);
  }

  async getVenture(ownerId: string, ventureId: string): Promise<Venture | null> {
    return this.ventures.get(this.key(ownerId, ventureId)) ?? null;
  }

  async listVentures(q: ListVenturesQuery): Promise<Venture[]> {
    let out = Array.from(this.ventures.values()).filter((v) => v.ownerId === q.ownerId);
    if (q.status) out = out.filter((v) => v.status === q.status);
    if (q.search) {
      const s = q.search.toLowerCase();
      out = out.filter((v) =>
        v.title.toLowerCase().includes(s) || v.description.toLowerCase().includes(s),
      );
    }
    const sort = q.sort ?? 'updated_desc';
    out.sort((a, b) => {
      if (sort === 'created_desc') return b.createdAt.localeCompare(a.createdAt);
      if (sort === 'title_asc') return a.title.localeCompare(b.title);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return out;
  }

  async replaceVenture(v: Venture): Promise<void> {
    this.ventures.set(this.key(v.ownerId, v.ventureId), v);
  }

  async appendArtifact(a: VentureArtifact): Promise<void> {
    const k = this.key(a.ownerId, a.ventureId);
    const list = this.artifacts.get(k) ?? [];
    list.push(a);
    this.artifacts.set(k, list);
  }

  async listArtifacts(ownerId: string, ventureId: string): Promise<VentureArtifact[]> {
    return [...(this.artifacts.get(this.key(ownerId, ventureId)) ?? [])];
  }

  async latestArtifactByKind(
    ownerId: string,
    ventureId: string,
    kind: VentureArtifactKind,
  ): Promise<VentureArtifact | null> {
    const list = this.artifacts.get(this.key(ownerId, ventureId)) ?? [];
    let latest: VentureArtifact | null = null;
    for (const a of list) {
      if (a.artifactKind !== kind) continue;
      if (!latest || a.version > latest.version) latest = a;
    }
    return latest;
  }

  async appendEvent(e: VentureTimelineEvent): Promise<void> {
    const k = this.key(e.ownerId, e.ventureId);
    const list = this.events.get(k) ?? [];
    list.push(e);
    this.events.set(k, list);
  }

  async listEvents(ownerId: string, ventureId: string): Promise<VentureTimelineEvent[]> {
    return [...(this.events.get(this.key(ownerId, ventureId)) ?? [])];
  }
}
