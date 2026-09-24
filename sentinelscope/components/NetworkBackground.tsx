"use client";

import { useEffect, useRef } from "react";

/**
 * Fond « réseau d'intelligence » : constellation de nœuds reliés par des
 * lignes, avec un cœur lumineux. Rendu en canvas (performant), palette violette
 * SentinelScope. Purement décoratif — aucune donnée, aucun texte.
 *
 * - S'adapte à la taille du conteneur (ResizeObserver).
 * - Respecte prefers-reduced-motion (rendu statique, sans animation).
 * - pointer-events: none — n'interfère jamais avec l'UI.
 */
export default function NetworkBackground({
  className = "",
  density = 0.00013,
  staticRender = false,
}: {
  className?: string;
  /** Nœuds par pixel² (plus haut = plus dense). */
  density?: number;
  /** Rendu figé (aucune boucle d'animation) — pour zéro coût CPU. */
  staticRender?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mm =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia.bind(window)
        : null;
    const reduce = !!mm && mm("(prefers-reduced-motion: reduce)").matches;
    const fine = !!mm && mm("(pointer: fine)").matches;
    // On n'anime que sur desktop (pointeur fin) et hors reduced-motion.
    // Sur mobile / tactile ou si staticRender : rendu statique (aucune boucle)
    // = zéro latence au scroll et pendant la génération de l'audit.
    const animate = !reduce && fine && !staticRender;

    const ACC = "141,124,255"; // #8D7CFF — violet dominant (lignes + cœur)
    // Palette des nœuds, calquée sur la maquette : violet majoritaire, avec
    // quelques accents ambre / rose / turquoise / bleu.
    const NODE_COLORS = [
      "141,124,255", // violet
      "141,124,255", // violet
      "141,124,255", // violet
      "141,124,255", // violet
      "245,169,59", // ambre
      "232,121,201", // rose
      "79,209,197", // turquoise
      "120,150,255", // bleu
    ];
    const LINK_DIST = 150;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let nodes: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      c: string;
      tw: number;
      ts: number;
    }[] = [];
    let mouse = { x: -9999, y: -9999 };
    let raf = 0;

    const build = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect?.width || canvas.clientWidth || 1));
      h = Math.max(1, Math.floor(rect?.height || canvas.clientHeight || 1));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Plafond bas : le calcul des liens est en O(n²), on limite fort pour
      // garantir zéro latence (scroll, génération d'audit) même sur mobile.
      const count = Math.max(
        22,
        Math.min(72, Math.round(w * h * density))
      );
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.7 + 1,
        c: NODE_COLORS[(Math.random() * NODE_COLORS.length) | 0],
        tw: Math.random() * Math.PI * 2, // phase de scintillement
        ts: 0.6 + Math.random() * 1.8, // vitesse de scintillement
      }));
    };

    // Cœur lumineux, décalé vers le haut-droite comme dans la maquette.
    const core = () => ({ x: w * 0.62, y: h * 0.34 });

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      const c = core();
      // Halo du cœur
      const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 300);
      glow.addColorStop(0, `rgba(${ACC},0.30)`);
      glow.addColorStop(1, `rgba(${ACC},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // Liens entre nœuds proches
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK_DIST) {
            const o = (1 - d / LINK_DIST) * 0.55;
            ctx.strokeStyle = `rgba(${ACC},${o.toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        // Lien vers le cœur pour les nœuds proches
        const cd = Math.hypot(a.x - c.x, a.y - c.y);
        if (cd < 260) {
          const o = (1 - cd / 260) * 0.5;
          ctx.strokeStyle = `rgba(${ACC},${o.toFixed(3)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        }
      }

      // Nœuds — scintillement via opacité + taille (pas de shadowBlur par
      // nœud : trop coûteux). Le halo n'est appliqué qu'au cœur (1 seul).
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      for (const n of nodes) {
        const a = 0.5 + 0.45 * Math.sin(now * 0.001 * n.ts + n.tw); // 0.05..0.95
        ctx.fillStyle = `rgba(${n.c},${(0.3 + a * 0.6).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (0.8 + a * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      // Cœur
      ctx.fillStyle = `rgba(${ACC},1)`;
      ctx.shadowColor = `rgba(${ACC},1)`;
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    let running = false;
    let onScreen = true;
    let lastDraw = 0;
    const FRAME_MS = 1000 / 30; // ~30 fps suffit pour ce fond

    const step = (t: number) => {
      if (t - lastDraw >= FRAME_MS) {
        lastDraw = t;
        for (const n of nodes) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < 0 || n.x > w) n.vx *= -1;
          if (n.y < 0 || n.y > h) n.vy *= -1;
          // Légère réaction à la souris (effet « vivant »)
          const dx = n.x - mouse.x;
          const dy = n.y - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < 90 && d > 0.01) {
            n.x += (dx / d) * 0.5;
            n.y += (dy / d) * 0.5;
          }
        }
        draw();
      }
      raf = requestAnimationFrame(step);
    };

    let scrolling = false;
    const start = () => {
      if (running || !animate || !onScreen || scrolling || document.hidden)
        return;
      running = true;
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    build();
    if (!animate) draw();
    else start();

    const onResize = () => {
      build();
      if (!animate) draw();
    };
    const ro = new ResizeObserver(onResize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // N'anime que si le fond est visible à l'écran ET l'onglet actif (perf).
    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        if (onScreen) start();
        else stop();
      },
      { threshold: 0 }
    );
    if (canvas.parentElement) io.observe(canvas.parentElement);

    const onVis = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVis);

    // Pause pendant le scroll actif → zéro concurrence avec le défilement.
    // L'animation reprend 220 ms après l'arrêt du scroll.
    let scrollTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (!animate) return;
      scrolling = true;
      stop();
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        scrolling = false;
        start();
      }, 220);
    };
    if (animate)
      window.addEventListener("scroll", onScroll, { passive: true });

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    if (animate) {
      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("mouseleave", onLeave);
    }

    return () => {
      stop();
      if (scrollTimer) clearTimeout(scrollTimer);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [density, staticRender]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
    />
  );
}
