import type { Metadata } from 'next';
import Link from 'next/link';

import { listDemoVentures } from '../../lib/demo';
import { ReadinessRing } from '../../components/demo/ReadinessRing';
import styles from '../../components/demo/demo.module.css';

export const metadata: Metadata = {
  title: 'Demo Mode',
  description: 'Explore a fully-seeded Foundry venture end-to-end — no API keys required.',
};

export default function DemoIndexPage() {
  const demos = listDemoVentures();

  return (
    <div className={styles.page}>
      <div className={styles.banner}>
        <span className={styles.bannerDot} />
        <span className={styles.bannerText}>
          <strong>Demo Mode</strong> — explore Foundry end-to-end with seeded data. No OpenAI, Anthropic,
          Supabase or GitHub keys required.
        </span>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionKicker}>Demo Mode</span>
          <h1 className={styles.sectionTitle}>See a venture taken from idea to build-ready</h1>
          <p className={styles.sectionDesc}>
            Each demo is a real Foundry venture that has already been driven end to end —
            persona research, the buying committee, the research graph, validation, build
            planning, the evaluation report and a simulated GitHub export. Open one to walk the entire
            pipeline. When you&apos;re ready, Real Mode runs the same flow on your own idea with your BYOK keys.
          </p>
        </div>

        <div className={styles.grid2}>
          {demos.map((d) => (
            <Link key={d.slug} href={`/demo/${d.slug}`} className={styles.demoCard}>
              <div className={styles.personaTop}>
                <div>
                  <h2 className={styles.demoCardTitle}>{d.venture.title}</h2>
                  <span className={styles.personaRole}>{d.brief.targetMarket}</span>
                </div>
                <ReadinessRing value={d.summary.readiness.overall} size={64} caption="" unit="" />
              </div>
              <p className={styles.sectionDesc}>{d.tagline}</p>
              <div className={styles.chipRow}>
                <span className={`${styles.badge} ${d.recommendation.decision === 'PROCEED' ? styles.proceed : d.recommendation.decision === 'PIVOT' ? styles.pivot : styles.kill}`}>
                  {d.recommendation.decision}
                </span>
                <span className={styles.chip}>{d.personas.length} personas</span>
                <span className={styles.chip}>{d.research.stats.nodes} research nodes</span>
                <span className={styles.chip}>{d.summary.artifactCount} artifacts</span>
              </div>
              <span className={styles.bannerLink}>Open walkthrough →</span>
            </Link>
          ))}
        </div>

        <div className={styles.ctaCard}>
          <p className={styles.cardTitle} style={{ margin: 0 }}>Real Mode uses BYOK</p>
          <p className={styles.sectionDesc}>
            Demo Mode is read-only and key-free. To run the pipeline on your own idea, create a venture and
            connect your own provider keys — they stay encrypted, server-side, and are never exposed to the browser.
          </p>
          <div className={styles.ctaRow}>
            <Link href="/ventures/new" className={`${styles.btn} ${styles.btnPrimary}`}>Create a real venture →</Link>
            <Link href="/settings/byok" className={styles.btn}>Configure BYOK</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
