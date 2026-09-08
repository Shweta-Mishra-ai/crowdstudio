import { useEffect, useRef } from "react";
import type * as Tone from "tone";

interface Props {
  getAnalyser: () => Tone.Analyser | null;
  active: boolean;
}

export function AudioVisualizer({ getAnalyser, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    function drawIdleLine() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Ambient Grid Line
      ctx.strokeStyle = "rgba(160, 157, 186, 0.15)";
      ctx.lineWidth = 1 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Subtle Idle Pulse Line
      const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      grad.addColorStop(0, "rgba(0, 242, 254, 0.2)");
      grad.addColorStop(0.5, "rgba(225, 0, 255, 0.5)");
      grad.addColorStop(1, "rgba(255, 159, 67, 0.2)");

      ctx.strokeStyle = grad;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }

    function draw() {
      if (!ctx || !canvas) return;
      const analyser = getAnalyser();
      if (!analyser) {
        drawIdleLine();
        return;
      }

      const values = analyser.getValue() as Float32Array;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Create glowing neon gradient fill & stroke
      const lineGrad = ctx.createLinearGradient(0, 0, canvas.width, 0);
      lineGrad.addColorStop(0, "#00F2FE");
      lineGrad.addColorStop(0.4, "#E100FF");
      lineGrad.addColorStop(0.8, "#FF9F43");
      lineGrad.addColorStop(1, "#00F2FE");

      const fillGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      fillGrad.addColorStop(0, "rgba(0, 242, 254, 0.25)");
      fillGrad.addColorStop(0.5, "rgba(225, 0, 255, 0.15)");
      fillGrad.addColorStop(1, "rgba(14, 12, 21, 0)");

      const sliceWidth = canvas.width / values.length;
      let x = 0;

      // Draw Gradient Fill Area
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        const y = (v * 0.45 + 0.5) * canvas.height;
        if (i === 0) ctx.lineTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fillStyle = fillGrad;
      ctx.fill();

      // Draw Primary Glowing Waveform Stroke
      ctx.beginPath();
      x = 0;
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        const y = (v * 0.45 + 0.5) * canvas.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 3 * dpr;
      ctx.shadowColor = "#00F2FE";
      ctx.shadowBlur = 12 * dpr;
      ctx.stroke();

      // Reset Shadow
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(draw);
    }

    if (active) {
      draw();
    } else {
      drawIdleLine();
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, getAnalyser]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-bg/80 border border-white/10 p-1">
      <canvas
        ref={canvasRef}
        className="h-20 w-full rounded-lg"
        aria-hidden="true"
        role="presentation"
      />
    </div>
  );
}
