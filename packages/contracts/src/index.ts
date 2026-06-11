export * from './types';

import byokKeySchema from '../schema/byok-key.json' with { type: 'json' };
import providerConfigSchema from '../schema/provider-config.json' with { type: 'json' };
import ideaBriefSchema from '../schema/idea-brief.json' with { type: 'json' };
import personaSetSchema from '../schema/persona-set.json' with { type: 'json' };
import researchGraphSchema from '../schema/research-graph.json' with { type: 'json' };
import recommendationSchema from '../schema/recommendation.json' with { type: 'json' };
import chatRequestSchema from '../schema/chat-request.json' with { type: 'json' };

export const schemas = {
  ByokKey: byokKeySchema,
  ProviderConfig: providerConfigSchema,
  IdeaBrief: ideaBriefSchema,
  PersonaSet: personaSetSchema,
  ResearchGraph: researchGraphSchema,
  Recommendation: recommendationSchema,
  ChatRequest: chatRequestSchema,
} as const;

export type SchemaName = keyof typeof schemas;
