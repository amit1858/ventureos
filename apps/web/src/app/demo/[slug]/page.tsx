import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getDemoVenture, listDemoVentures } from '../../../lib/demo';
import { buildDemoEvaluation, buildDemoExportFiles } from '../../../lib/demo/render';
import { Walkthrough } from '../../../components/demo/Walkthrough';

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return listDemoVentures().map((d) => ({ slug: d.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const demo = getDemoVenture(params.slug);
  if (!demo) return { title: 'Demo · Foundry' };
  return {
    title: `${demo.venture.title} · Demo · Foundry`,
    description: demo.tagline,
  };
}

export default function DemoVenturePage({ params }: PageProps) {
  const demo = getDemoVenture(params.slug);
  if (!demo) {
    notFound();
  }

  const evaluation = buildDemoEvaluation(demo);
  const exportFiles = buildDemoExportFiles(demo);

  return <Walkthrough demo={demo} evaluation={evaluation} exportFiles={exportFiles} />;
}
