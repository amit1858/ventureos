"""
Foundry ↔ Graphify adapter (interface only).

Architectural rules:
  * `graphify` / `graphifyy` may ONLY be imported inside this package.
  * Provider SDKs may NEVER be imported here. All LLM calls go through ProviderClient.

Method signatures mirror docs/dependency-analysis-graphify.md §8.
"""

from __future__ import annotations

from typing import Any, Protocol

from foundry_contracts import IdeaBrief, ResearchGraph
from foundry_providers import ProviderClient
from foundry_providers.errors import NotImplementedError as _NotImplemented


class GraphifyAdapter(Protocol):
    async def build_research_graph(
        self,
        brief: IdeaBrief,
        *,
        seed_sources: list[str] | None = None,
        max_depth: int = 2,
    ) -> ResearchGraph: ...

    async def add_source(self, graph_id: str, uri: str) -> dict[str, Any]: ...

    async def query(self, graph_id: str, cypher: str) -> list[dict[str, Any]]: ...

    async def shortest_path(self, graph_id: str, src: str, dst: str) -> list[str]: ...

    async def god_nodes(
        self, graph_id: str, *, top_k: int = 10
    ) -> list[dict[str, Any]]: ...

    async def export_neo4j(self, graph_id: str, *, target_uri: str) -> dict[str, Any]: ...


class GraphifyAdapterStub:
    def __init__(self, provider: ProviderClient) -> None:
        self._provider = provider

    async def build_research_graph(
        self,
        brief: IdeaBrief,
        *,
        seed_sources: list[str] | None = None,
        max_depth: int = 2,
    ) -> ResearchGraph:
        raise _NotImplemented("GraphifyAdapterStub.build_research_graph — wire in M1.")

    async def add_source(self, graph_id: str, uri: str) -> dict[str, Any]:
        raise _NotImplemented("GraphifyAdapterStub.add_source — wire in M1.")

    async def query(self, graph_id: str, cypher: str) -> list[dict[str, Any]]:
        raise _NotImplemented("GraphifyAdapterStub.query — wire in M1.")

    async def shortest_path(self, graph_id: str, src: str, dst: str) -> list[str]:
        raise _NotImplemented("GraphifyAdapterStub.shortest_path — wire in M1.")

    async def god_nodes(
        self, graph_id: str, *, top_k: int = 10
    ) -> list[dict[str, Any]]:
        raise _NotImplemented("GraphifyAdapterStub.god_nodes — wire in M1.")

    async def export_neo4j(self, graph_id: str, *, target_uri: str) -> dict[str, Any]:
        raise _NotImplemented("GraphifyAdapterStub.export_neo4j — wire in M1.")
