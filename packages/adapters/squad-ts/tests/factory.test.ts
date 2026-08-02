import { describe, expect, it } from 'vitest';
import {
  createBuildSquadAdapter,
  HandRolledBuildSquadAdapter,
  SquadOssAdapter,
} from '../src/index.js';
import { FeatureDisabledError, MockProvider, ProviderRegistry } from '@foundry/providers-core';

const fakeClient = { chat: async () => ({} as never) };

describe('BuildSquad factory', () => {
  it('returns hand-rolled adapter by default', () => {
    delete process.env.VENTUREOS_USE_SQUAD_OSS;
    expect(createBuildSquadAdapter(fakeClient)).toBeInstanceOf(HandRolledBuildSquadAdapter);
  });

  it('returns SquadOssAdapter when flag is set', () => {
    process.env.VENTUREOS_USE_SQUAD_OSS = 'true';
    expect(createBuildSquadAdapter(fakeClient)).toBeInstanceOf(SquadOssAdapter);
    delete process.env.VENTUREOS_USE_SQUAD_OSS;
  });

  it('throws FeatureDisabledError when SquadOssAdapter is constructed without the flag', () => {
    delete process.env.VENTUREOS_USE_SQUAD_OSS;
    expect(() => new SquadOssAdapter(fakeClient)).toThrow(FeatureDisabledError);
  });

  // Silence unused-import warning; ensures registry export is reachable.
  void new ProviderRegistry();
  void new MockProvider();
});
