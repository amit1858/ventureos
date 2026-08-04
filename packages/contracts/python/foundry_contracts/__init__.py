"""Hand-mirrored Pydantic models for Foundry schemas. Keep in lockstep with src/types.ts."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

ProviderId = Literal[
    "openai",
    "azure_openai",
    "anthropic",
    "gemini",
    "github_models",
    "ollama",
    "azure_ai_foundry",
]
KeyStatus = Literal["pending_validation", "active", "revoked", "invalid"]
LogicalModel = Literal["flagship", "standard", "fast", "embed", "vision"]
Confidence = Literal["EXTRACTED", "INFERRED", "AMBIGUOUS"]
RecommendationDecision = Literal["PROCEED", "PROCEED_WITH_PIVOT_NOTES", "PIVOT", "KILL"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ByokKey(StrictModel):
    id: str
    tenant_id: str = Field(alias="tenantId")
    user_id: str | None = Field(default=None, alias="userId")
    provider: ProviderId
    alias: str
    masked_secret: str = Field(alias="maskedSecret")
    scope: list[str] = Field(default_factory=list)
    monthly_budget_usd: float | None = Field(default=None, alias="monthlyBudgetUsd")
    regions: list[str] = Field(default_factory=list)
    metadata: dict[str, str] = Field(default_factory=dict)
    status: KeyStatus
    last_validated_at: datetime | None = Field(default=None, alias="lastValidatedAt")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime | None = Field(default=None, alias="updatedAt")


class DecryptedKey(BaseModel):
    """Plaintext secret holder. Never persist, never log, never serialise."""

    model_config = ConfigDict(extra="forbid")
    id: str
    provider: ProviderId
    secret: str

    def __repr__(self) -> str:  # pragma: no cover - guardrail
        return f"DecryptedKey(id={self.id!r}, provider={self.provider!r}, secret=<redacted>)"


class IdeaBrief(StrictModel):
    kind: Literal["IdeaBrief"]
    title: str
    summary: str
    target_market: str | None = Field(default=None, alias="targetMarket")
    wedge: str | None = None
    business_model_hypothesis: str | None = Field(default=None, alias="businessModelHypothesis")
    founder_assumptions: list[str] = Field(default_factory=list, alias="founderAssumptions")
    tags: list[str] = Field(default_factory=list)


class Persona(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    id: str
    name: str
    role: str | None = None
    demographics: dict[str, Any] | None = None
    tools_today: list[str] | None = Field(default=None, alias="toolsToday")
    pain: str | None = None
    buying_power: str | None = Field(default=None, alias="buyingPower")
    ai_trust: str | None = Field(default=None, alias="aiTrust")
    validator_score: float | None = Field(default=None, alias="validatorScore")


class BuyingCommitteeSlot(StrictModel):
    role: str
    personas: list[str]


class PersonaSet(StrictModel):
    kind: Literal["PersonaSet"]
    personas: list[Persona]
    buying_committee_composition: list[BuyingCommitteeSlot] | None = Field(
        default=None, alias="buyingCommitteeComposition"
    )


class ConfidenceBreakdown(StrictModel):
    EXTRACTED: float
    INFERRED: float
    AMBIGUOUS: float


class ResearchGraphStats(StrictModel):
    nodes: int
    edges: int
    communities: int
    confidence: ConfidenceBreakdown


class GodNode(StrictModel):
    label: str
    degree: int
    community: int


class ResearchGraph(StrictModel):
    kind: Literal["ResearchGraph"]
    venture_id: str | None = Field(default=None, alias="ventureId")
    stats: ResearchGraphStats
    god_nodes: list[GodNode] = Field(alias="godNodes")
    surprising_connections: list[str] = Field(default_factory=list, alias="surprisingConnections")
    evidence_uri: str | None = Field(default=None, alias="evidenceUri")


class AssumptionAuditItem(StrictModel):
    assumption: str
    status: Literal["SUPPORTED", "WEAK", "CONTRADICTED"]
    evidence: list[str] = Field(default_factory=list)


class RiskItem(StrictModel):
    risk: str
    severity: Literal["low", "medium", "high"]
    likelihood: Literal["low", "medium", "high"]
    mitigation: str | None = None


class Recommendation(StrictModel):
    kind: Literal["Recommendation"]
    decision: RecommendationDecision
    confidence: float
    rationale: list[str]
    assumption_audit: list[AssumptionAuditItem] = Field(
        default_factory=list, alias="assumptionAudit"
    )
    risk_register: list[RiskItem] = Field(default_factory=list, alias="riskRegister")
    pivot_notes: list[str] = Field(default_factory=list, alias="pivotNotes")
    go_conditions: list[str] = Field(default_factory=list, alias="goConditions")
    evidence_refs: list[str] = Field(default_factory=list, alias="evidenceRefs")
    quality_score: float | None = Field(default=None, alias="qualityScore")
