export default function Home() {
  return (
    <section>
      <h1>VentureOS</h1>
      <p style={{ color: '#9aa0a6' }}>
        AI-native venture incubation. Personas, research, and a build squad — all on your keys.
      </p>
      <ul style={{ lineHeight: 1.8 }}>
        <li>PersonaLab — simulate buyers and validate ideas (powered by TinyTroupe)</li>
        <li>VentureLab — build a research graph for your market (powered by Graphify)</li>
        <li>BuildSquad — agents that scaffold the first version of your product</li>
      </ul>
      <p style={{ marginTop: '2rem', color: '#9aa0a6' }}>
        Add a provider key under <a href="/settings/byok" style={{ color: '#bcd' }}>BYOK Keys</a> to get started.
      </p>
    </section>
  );
}
