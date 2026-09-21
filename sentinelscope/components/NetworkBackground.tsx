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
}: {
  className?: string;
  /** Nœuds par pixel² (plus haut = plus dense). */
  density?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ACC = "141,124,255"; // #8D7CFF
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

      const count = Math.max(
        30,
        Math.min(170, Math.round(w * h * density))
      );
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.7 + 1,
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
            const o = (1 - d / LINK_DIST) * 0.85;
            ctx.strokeStyle = `rgba(${ACC},${o.toFixed(3)})`;
            ctx.lineWidth = 0.9;
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

      // Nœuds (avec léger halo pour la luminosité)
      ctx.shadowColor = `rgba(${ACC},0.9)`;
      ctx.shadowBlur = 6;
      for (const n of nodes) {
        ctx.fillStyle = `rgba(${ACC},0.95)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Cœur
      ctx.fillStyle = `rgba(${ACC},1)`;
      ctx.shadowColor = `rgba(${ACC},1)`;
      ctx.shadowBlur = 28;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const step = () => {
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
      raf = requestAnimationFrame(step);
    };

    build();
    if (reduce) {
      draw();
    } else {
      raf = requestAnimationFrame(step);
    }

    const onResize = () => {
      cancelAnimationFrame(raf);
      build();
      if (reduce) draw();
      else raf = requestAnimationFrame(step);
    };
    const ro = new ResizeObserver(onResize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    if (!reduce) {
      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("mouseleave", onLeave);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [density]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
    />
  );
}
