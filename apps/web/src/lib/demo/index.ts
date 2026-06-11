/**
 * Demo Mode registry.
 *
 * Real Mode is the default product path; Demo Mode is a separate, key-free
 * surface for evaluation and onboarding. Add new seeded ventures here.
 */
import { facelessCrmDemo } from './faceless-crm';
import type { DemoVenture } from './types';

export type { DemoVenture, DemoExport } from './types';
export { facelessCrmDemo } from './faceless-crm';

export const DEMO_VENTURES: DemoVenture[] = [facelessCrmDemo];

export function listDemoVentures(): DemoVenture[] {
  return DEMO_VENTURES;
}

export function getDemoVenture(slug: string): DemoVenture | undefined {
  return DEMO_VENTURES.find((d) => d.slug === slug);
}
