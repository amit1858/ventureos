/**
 * @foundry/adapter-graphify — Sprint 1F.
 *
 * Architectural notes:
 *   * The Python `graphify` package is gated to `packages/adapters/graphify-py/`
 *     by the import-boundaries check. This TS adapter intentionally does NOT
 *     depend on it; it implements a pure-TS deterministic graph builder so the
 *     web app can run end-to-end without a Python sidecar.
 *   * One LLM call only (extractGraph). The LLM may ONLY return nodes/edges
 *     with evidence + provenance — it never produces god-nodes, centrality,
 *     contradictions, paths, or query rankings. Those are all deterministic.
 *   * No provider SDKs imported here. Callers pass a `ChatFn` that has the
 *     BYOK secret bound in a closure (see apps/web/src/lib/graphify.ts).
 */
export * from './types';
export * from './prompts';
export * from './extractor';
export * from './graph';
export * from './query';
export * from './evaluation';
export * from './adapter';
