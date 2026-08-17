"use client";

import { Container, Reveal, SectionLabel } from "./ui";

const ROW_A = ["GitHub", "GitLab", "Jira", "Slack", "Linear"];
const ROW_B = ["Teams", "Vanta", "Drata", "VS Code"];

function Chip({ name }: { name: string }) {
  return (
    <div className="flex h-14 flex-none items-center gap-2.5 rounded-xl border border-line bg-card/60 px-6 backdrop-blur-sm">
      <span className="h-2 w-2 rounded-full bg-acc-cyan/60" />
      <span className="whitespace-nowrap text-sm font-semibold text-ink/85">
        {name}
      </span>
    </div>
  );
}

function Row({ items, reverse = false }: { items: string[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="marquee-fade flex overflow-hidden">
      <div
        className={`flex gap-4 pr-4 ${reverse ? "animate-marquee-reverse" : "animate-marquee"} group-hover:[animation-play-state:paused]`}
      >
        {doubled.map((n, i) => (
          <Chip key={`${n}-${i}`} name={n} />
        ))}
      </div>
    </div>
  );
}

export default function Integrations() {
  return (
    <section id="integrations" className="relative border-y border-line bg-bg2/30 py-20 sm:py-28">
      <Container>
        <Reveal className="mx-auto max-w-2xl text-center">
          <div className="flex justify-center">
            <SectionLabel>Intégrations</SectionLabel>
          </div>
          <h2 className="mt-5 text-3xl font-bold leading-[1.12] tracking-tight sm:text-[2.6rem] lg:text-[3.25rem]">
            Ne cassez pas le flux des développeurs.
          </h2>
          <p className="mt-4 text-lg text-muted">
            Connectez votre flux de sécurité aux outils que votre équipe utilise
            déjà.
          </p>
        </Reveal>
      </Container>

      <div className="group mt-12 space-y-4">
        <Row items={ROW_A} />
        <Row items={ROW_B} reverse />
      </div>
    </section>
  );
}
