"use client";

import { useEffect, useRef, useState } from "react";
import { Code2, Users, FileCode2, Sparkles } from "lucide-react";

const features = [
  {
    number: "01",
    title: "Write Code",
    description: "High-performance Monaco Editor with syntax highlighting, workspace file tree, and multi-language execution in Python, Java, C++, and JS/TS.",
    stats: { value: "4+", label: "Runtimes Supported" },
    icon: Code2,
  },
  {
    number: "02",
    title: "Live Collab",
    description: "Real-time multi-user collaborative editing. Code together with peers, share session rooms, and sync workspace changes instantly.",
    stats: { value: "Real-time", label: "Workspace Sync" },
    icon: Users,
  },
  {
    number: "03",
    title: "DSA Sheet & Practice",
    description: "Curated Data Structures & Algorithms sheets and problem sets. Practice problem-solving with automated test case evaluation.",
    stats: { value: "1,000+", label: "Curated Problems" },
    icon: FileCode2,
  },
  {
    number: "04",
    title: "AI Code Review",
    description: "Instant line-by-line AI code reviews, time & space complexity analysis, edge-case detection, and automated optimization hints.",
    stats: { value: "Instant", label: "AI Feedback" },
    icon: Sparkles,
  },
];

// Floating dot particles visualization
function ParticleVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };
    canvas.addEventListener("mousemove", handleMouseMove);

    const COUNT = 60;
    const particles = Array.from({ length: COUNT }, (_, i) => {
      const seed = i * 1.618;
      return {
        bx: ((seed * 127.1) % 1),
        by: ((seed * 311.7) % 1),
        phase: seed * Math.PI * 2,
        speed: 0.4 + (seed % 0.4),
        radius: 1.2 + (seed % 2.2),
      };
    });

    let time = 0;
    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      particles.forEach((p) => {
        const flowX = Math.sin(time * p.speed * 0.4 + p.phase) * 38;
        const flowY = Math.cos(time * p.speed * 0.3 + p.phase * 0.7) * 24;

        const bx = p.bx * w;
        const by = p.by * h;
        const dx = p.bx - mx;
        const dy = p.by - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist * 2.8);

        const x = bx + flowX + influence * Math.cos(time + p.phase) * 36;
        const y = by + flowY + influence * Math.sin(time + p.phase) * 36;

        const pulse = Math.sin(time * p.speed + p.phase) * 0.5 + 0.5;
        const alpha = 0.08 + pulse * 0.18 + influence * 0.3;

        ctx.beginPath();
        ctx.arc(x, y, p.radius + pulse * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      });

      time += 0.016;
      frameRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-auto"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const Icon0 = features[0].icon;
  const Icon1 = features[1].icon;
  const Icon2 = features[2].icon;
  const Icon3 = features[3].icon;

  return (
    <section
      id="features"
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header - Full width */}
        <div className="relative mb-20">
          <div className="grid lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
                <span className="w-12 h-px bg-foreground/30" />
                Core Capabilities
              </span>
              <h2
                className={`text-6xl md:text-7xl lg:text-[110px] font-display tracking-tight leading-[0.9] transition-all duration-1000 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              >
                Write. Collab.
                <br />
                <span className="text-muted-foreground">Practice.</span>
              </h2>
            </div>
            <div className="lg:col-span-5 lg:pb-4">
              <p className={`text-xl text-muted-foreground leading-relaxed transition-all duration-1000 delay-200 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}>
                Everything you need in a modern cloud IDE — multi-language code editor, real-time live collaboration, DSA practice sheets, and instant AI code reviews.
              </p>
            </div>
          </div>
        </div>

        {/* Bento Grid Layout - 4 Capability Cards */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Card 01: Write Code (Large) */}
          <div 
            className={`lg:col-span-7 relative bg-black border border-foreground/10 min-h-[420px] p-8 lg:p-12 overflow-hidden group transition-all duration-700 flex flex-col justify-between ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <ParticleVisualization />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-sm text-muted-foreground">{features[0].number}</span>
                <Icon0 className="w-6 h-6 text-[#eca8d6]" />
              </div>
              <h3 className="text-3xl lg:text-4xl font-display mb-4 group-hover:translate-x-2 transition-transform duration-500">
                {features[0].title}
              </h3>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
                {features[0].description}
              </p>
            </div>
            <div className="relative z-10 mt-8 pt-6 border-t border-foreground/10 flex items-baseline gap-4">
              <span className="text-4xl lg:text-5xl font-display">{features[0].stats.value}</span>
              <span className="text-sm text-muted-foreground font-mono">{features[0].stats.label}</span>
            </div>
          </div>

          {/* Card 02: Live Collab */}
          <div 
            className={`lg:col-span-5 relative bg-foreground/[0.02] border border-foreground/10 min-h-[420px] p-8 lg:p-12 overflow-hidden group transition-all duration-700 flex flex-col justify-between ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "100ms" }}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-sm text-muted-foreground">{features[1].number}</span>
                <Icon1 className="w-6 h-6 text-[#eca8d6]" />
              </div>
              <h3 className="text-3xl lg:text-4xl font-display mb-4 group-hover:translate-x-2 transition-transform duration-500">
                {features[1].title}
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                {features[1].description}
              </p>
            </div>
            <div className="relative z-10 mt-8 pt-6 border-t border-foreground/10 flex items-baseline gap-4">
              <span className="text-3xl lg:text-4xl font-display">{features[1].stats.value}</span>
              <span className="text-sm text-muted-foreground font-mono">{features[1].stats.label}</span>
            </div>
          </div>

          {/* Card 03: DSA Sheet & Practice */}
          <div 
            className={`lg:col-span-6 relative bg-foreground/[0.02] border border-foreground/10 min-h-[380px] p-8 lg:p-10 overflow-hidden group transition-all duration-700 flex flex-col justify-between ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-sm text-muted-foreground">{features[2].number}</span>
                <Icon2 className="w-6 h-6 text-[#eca8d6]" />
              </div>
              <h3 className="text-3xl lg:text-4xl font-display mb-4 group-hover:translate-x-2 transition-transform duration-500">
                {features[2].title}
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                {features[2].description}
              </p>
            </div>
            <div className="relative z-10 mt-8 pt-6 border-t border-foreground/10 flex items-baseline gap-4">
              <span className="text-3xl lg:text-4xl font-display">{features[2].stats.value}</span>
              <span className="text-sm text-muted-foreground font-mono">{features[2].stats.label}</span>
            </div>
          </div>

          {/* Card 04: AI Code Review */}
          <div 
            className={`lg:col-span-6 relative bg-foreground/[0.02] border border-foreground/10 min-h-[380px] p-8 lg:p-10 overflow-hidden group transition-all duration-700 flex flex-col justify-between ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
            style={{ transitionDelay: "300ms" }}
          >
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <span className="font-mono text-sm text-muted-foreground">{features[3].number}</span>
                <Icon3 className="w-6 h-6 text-[#eca8d6]" />
              </div>
              <h3 className="text-3xl lg:text-4xl font-display mb-4 group-hover:translate-x-2 transition-transform duration-500">
                {features[3].title}
              </h3>
              <p className="text-base text-muted-foreground leading-relaxed">
                {features[3].description}
              </p>
            </div>
            <div className="relative z-10 mt-8 pt-6 border-t border-foreground/10 flex items-baseline gap-4">
              <span className="text-3xl lg:text-4xl font-display">{features[3].stats.value}</span>
              <span className="text-sm text-muted-foreground font-mono">{features[3].stats.label}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
