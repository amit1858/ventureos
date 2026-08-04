/**
 * Venture context loader — the single client-side source of truth that binds a
 * workflow lab (personas / research / validation / build plan) to the ACTIVE
 * venture it was opened for.
 *
 * Canonical data contract
 * ────────────────────────
 *  • The `Venture` record (owner-scoped, server store) is the ONLY source of a
 *    venture's brief. `ventureBriefFrom` maps it into the `PersonaLabBrief`
 *    every generator consumes. No lab may fabricate a brief or fall back to
 *    demo/sample content — the guided demo ("Faceless CRM") is a separate
 *    static seed and must never leak into a real venture's workflow.
 *  • Prior workflow outputs are persisted as versioned artifacts keyed by
 *    (ownerId, ventureId, artifactKind). Downstream steps AUTO-CONSUME the
 *    latest of each kind via `/api/ventures/[id]/artifacts?kind=<k>&latest=1`
 *    instead of asking the user to paste JSON.
 *  • Every generation persists back through the JobOrchestrator (scoped by
 *    ownerId + ventureId), so refreshing, re-opening, or returning to the
 *    venture workspace always shows the same data.
 *
 * This module is import-safe in client components: it performs only `fetch`
 * calls against the authenticated venture APIs (which enforce ownership) and
 * never touches secrets.
 */
import type {
  BuyingCommitteeTranscript,
  PersonaLabBrief,
  PersonaLabPersona,
  ResearchGraph,
  Venture,
  VentureArtifact,
  VentureArtifactKind,
  VentureRecommendation,
  VentureSummary,
} from '@foundry/contracts';

export interface VentureContext {
  summary: VentureSummary;
  venture: Venture;
  /** Derived from the venture — never a demo/sample brief. */
  brief: PersonaLabBrief;
  /** Latest persisted artifacts (null when the step hasn't run yet). */
  personas: PersonaLabPersona[] | null;
  committee: BuyingCommitteeTranscript | null;
  researchGraph: ResearchGraph | null;
  recommendation: VentureRecommendation | null;
}

export type LoadVentureContextResult =
  | { ok: true; context: VentureContext }
  | { ok: false; status: number; reason: string };

/**
 * Deterministic Venture → PersonaLabBrief mapping. This is the ONLY way a lab
 * obtains a brief for a real venture. Kept pure + side-effect-free so it can be
 * unit-tested and reused server-side if ever needed.
 */
export function ventureBriefFrom(v: Venture): PersonaLabBrief {
  const title = (v.title ?? '').trim();
  const description = (v.description ?? '').trim();
  const problem = (v.problemStatement ?? '').trim();

  const businessIdea = description ? `${title} — ${description}` : title;
  const additionalContext = [problem, description]
    .filter((s) => s.length > 0)
    // Avoid duplicating description when it's already folded into businessIdea.
    .filter((s, i, arr) => arr.indexOf(s) === i)
    .join('\n\n');

  return {
    businessIdea,
    targetMarket: (v.targetMarket ?? '').trim(),
    customerType: (v.customerType ?? '').trim(),
    region: (v.region ?? '').trim(),
    businessSize: (v.businessSize ?? '').trim(),
    additionalContext,
  };
}

/**
 * Derive research notes from the venture brief and (when available) persisted
 * personas. Research must be able to proceed from the brief alone — personas
 * are an enhancement, never a precondition. Returns a de-duplicated list of
 * signal strings suitable for the Graphify adapter's `notes` input.
 */
export function researchNotesFrom(
  brief: PersonaLabBrief,
  personas: PersonaLabPersona[] | null,
): string[] {
  const notes: string[] = [];
  if (brief.businessIdea) notes.push(`Business idea: ${brief.businessIdea}`);
  if (brief.targetMarket) notes.push(`Target market: ${brief.targetMarket}`);
  if (brief.customerType) notes.push(`Customer type: ${brief.customerType}`);
  if (brief.additionalContext) notes.push(brief.additionalContext);

  for (const p of personas ?? []) {
    const pains = (p.painPoints ?? []).filter((s) => s && s.trim().length > 0);
    const goals = (p.goals ?? []).filter((s) => s && s.trim().length > 0);
    const objections = (p.objections ?? []).filter((s) => s && s.trim().length > 0);
    const parts: string[] = [];
    if (pains.length > 0) parts.push(`Pain points: ${pains.join('; ')}`);
    if (goals.length > 0) parts.push(`Goals: ${goals.join('; ')}`);
    if (objections.length > 0) parts.push(`Objections: ${objections.join('; ')}`);
    if (parts.length > 0) notes.push(`${p.name} (${p.role}) — ${parts.join(' | ')}`);
  }

  // De-duplicate while preserving order.
  return notes.filter((s, i, arr) => arr.indexOf(s) === i);
}

/** Read the active venture id from the current URL (?ventureId=...). */
export function ventureIdFromLocation(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('ventureId');
  const trimmed = (raw ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function fetchLatestArtifact<T>(
  ventureId: string,
  kind: VentureArtifactKind,
): Promise<T | null> {
  try {
    const r = await fetch(
      `/api/ventures/${encodeURIComponent(ventureId)}/artifacts?kind=${kind}&latest=1`,
      { cache: 'no-store' },
    );
    if (!r.ok) return null;
    const body = (await r.json()) as { ok?: boolean; artifact?: VentureArtifact | null };
    if (!body.ok || !body.artifact) return null;
    return body.artifact.payload as T;
  } catch {
    return null;
  }
}

/**
 * Load the full context for a venture: its brief plus the latest persisted
 * artifacts a downstream step may auto-consume. All requests hit the
 * authenticated, owner-scoped venture APIs, so a caller can only ever load a
 * venture they own (401/404 otherwise).
 */
export async function loadVentureContext(ventureId: string): Promise<LoadVentureContextResult> {
  let summaryRes: Response;
  try {
    summaryRes = await fetch(`/api/ventures/${encodeURIComponent(ventureId)}`, { cache: 'no-store' });
  } catch (e) {
    return { ok: false, status: 0, reason: e instanceof Error ? e.message : 'Network error.' };
  }

  if (summaryRes.status === 401) {
    return { ok: false, status: 401, reason: 'Sign in to open this venture.' };
  }
  if (summaryRes.status === 404) {
    return { ok: false, status: 404, reason: 'This venture no longer exists or is not accessible.' };
  }
  if (!summaryRes.ok) {
    return { ok: false, status: summaryRes.status, reason: 'Failed to load the venture.' };
  }

  const body = (await summaryRes.json()) as { ok?: boolean; summary?: VentureSummary };
  if (!body.ok || !body.summary) {
    return { ok: false, status: 404, reason: 'Venture not found.' };
  }
  const summary = body.summary;

  const [personas, committee, researchGraph, recommendation] = await Promise.all([
    fetchLatestArtifact<PersonaLabPersona[]>(ventureId, 'persona_set'),
    fetchLatestArtifact<BuyingCommitteeTranscript>(ventureId, 'buying_committee'),
    fetchLatestArtifact<ResearchGraph>(ventureId, 'research_graph'),
    fetchLatestArtifact<VentureRecommendation>(ventureId, 'venture_recommendation'),
  ]);

  return {
    ok: true,
    context: {
      summary,
      venture: summary.venture,
      brief: ventureBriefFrom(summary.venture),
      personas,
      committee,
      researchGraph,
      recommendation,
    },
  };
}
