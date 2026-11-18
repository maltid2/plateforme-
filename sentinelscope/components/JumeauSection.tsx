"use client";

import { Boxes, MapPinned, Route, UserCog } from "lucide-react";
import { Container, Reveal, SectionLabel } from "./ui";
import Jumeau from "./jumeau/Jumeau";

// Le jumeau n'est pas un service en libre-service : un technicien se déplace,
// relève l'infrastructure et livre la maquette. La section doit donc poser
// l'attente avant de montrer la démonstration, sinon le visiteur cherche un
// bouton « lancer l'analyse » qui n'existe pas.
const POINTS = [
  {
    icon: UserCog,
    titre: "Un technicien se déplace",
    corps:
      "Le relevé se fait sur place : baies ouvertes, étiquettes lues, numéros de série relevés. Rien à installer sur votre réseau.",
  },
  {
    icon: MapPinned,
    titre: "Votre site, étage par étage",
    corps:
      "Locaux techniques, baies, serveurs, postes et imprimantes. On navigue entre les étages et on ouvre chaque baie.",
  },
  {
    icon: Route,
    titre: "Le câblage tel qu'il est",
    corps:
      "Chaque îlot est rattaché à la baie qui le dessert. Une liaison en défaut se voit sur le plan, pas dans un tableur.",
  },
  {
    icon: Boxes,
    titre: "Les constats sur l'équipement",
    corps:
      "Version de firmware, fin de support, protocole d'administration en clair : le point relevé est posé sur la machine concernée.",
  },
];

export default function JumeauSection() {
  return (
    <section id="jumeau" className="relative border-y border-line bg-bg2/30 py-14 sm:py-20">
      <Container>
        <Reveal className="max-w-2xl">
          <SectionLabel>Jumeau 3D</SectionLabel>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            Votre infrastructure, en volume
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
            Un plan d&apos;inventaire qu&apos;on lit au lieu de le déchiffrer. Un technicien
            relève votre site, et vous repartez avec une maquette navigable où chaque
            équipement porte ses constats.
          </p>
        </Reveal>

        <Reveal delay={0.1} className="mt-8 sm:mt-10">
          <Jumeau />
        </Reveal>

        <div className="mt-8 grid gap-6 sm:mt-10 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((p, i) => (
            <Reveal key={p.titre} delay={0.15 + i * 0.07}>
              <p.icon className="h-5 w-5 text-acc-violet" aria-hidden="true" />
              <h3 className="mt-3 text-sm font-semibold">{p.titre}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.corps}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4} className="mt-8">
          <p className="text-xs text-muted">
            La maquette ci-dessus est une démonstration : le site, les adresses et la
            plupart des constats sont fictifs. Les deux CVE citées, elles, sont réelles
            et inscrites au catalogue CISA des failles activement exploitées.
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
