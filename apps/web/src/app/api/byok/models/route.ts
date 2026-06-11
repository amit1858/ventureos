/**
 * GET /api/byok/models?provider={id}
 *
 * Returns the static known-good model catalog for a provider. No secrets, no auth needed.
 * The catalog is sourced from each provider package's `KNOWN_MODELS` constant.
 */
import { NextResponse } from 'next/server';
import type { ProviderId } from '@ventureos/contracts';
import { OPENAI_KNOWN_MODELS } from '@ventureos/providers-openai';
import { ANTHROPIC_KNOWN_MODELS } from '@ventureos/providers-anthropic';
import { GEMINI_KNOWN_MODELS } from '@ventureos/providers-gemini';
import { AZURE_OPENAI_KNOWN_MODELS } from '@ventureos/providers-azure-openai';

export const runtime = 'nodejs';

const CATALOG: Record<ProviderId, ReadonlyArray<string>> = {
  openai: OPENAI_KNOWN_MODELS,
  anthropic: ANTHROPIC_KNOWN_MODELS,
  gemini: GEMINI_KNOWN_MODELS,
  azure_openai: AZURE_OPENAI_KNOWN_MODELS,
  github_models: [],
  ollama: [],
  azure_ai_foundry: [],
  github: [],
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') as ProviderId | null;
  if (!provider || !(provider in CATALOG)) {
    return NextResponse.json({ models: [] }, { status: 400 });
  }
  return NextResponse.json({ models: CATALOG[provider] });
}
