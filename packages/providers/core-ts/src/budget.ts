import type { BudgetGuard } from './types';
import { BudgetExceeded } from './errors';

/**
 * In-memory budget guard for Sprint 0.
 * Replace with Postgres-backed implementation in Sprint 1.
 */
export class InMemoryBudgetGuard implements BudgetGuard {
  private tenantSpend = new Map<string, number>();
  private ventureSpend = new Map<string, number>();

  constructor(
    private readonly limits: {
      tenantMonthlyUsd: number;
      ventureUsd: number;
    },
  ) {}

  async check(estimateUsd: number, ctx: { tenantId: string; ventureId?: string }): Promise<void> {
    const tenantNow = this.tenantSpend.get(ctx.tenantId) ?? 0;
    if (tenantNow + estimateUsd > this.limits.tenantMonthlyUsd) {
      throw new BudgetExceeded(
        `Tenant ${ctx.tenantId} would exceed monthly budget ($${this.limits.tenantMonthlyUsd}).`,
        'tenant',
      );
    }
    if (ctx.ventureId) {
      const ventureNow = this.ventureSpend.get(ctx.ventureId) ?? 0;
      if (ventureNow + estimateUsd > this.limits.ventureUsd) {
        throw new BudgetExceeded(
          `Venture ${ctx.ventureId} would exceed budget ($${this.limits.ventureUsd}).`,
          'venture',
        );
      }
    }
  }

  async record(actualUsd: number, ctx: { tenantId: string; ventureId?: string }): Promise<void> {
    this.tenantSpend.set(ctx.tenantId, (this.tenantSpend.get(ctx.tenantId) ?? 0) + actualUsd);
    if (ctx.ventureId) {
      this.ventureSpend.set(ctx.ventureId, (this.ventureSpend.get(ctx.ventureId) ?? 0) + actualUsd);
    }
  }

  /** Test helper. */
  snapshot(): { tenant: Record<string, number>; venture: Record<string, number> } {
    return {
      tenant: Object.fromEntries(this.tenantSpend),
      venture: Object.fromEntries(this.ventureSpend),
    };
  }
}
