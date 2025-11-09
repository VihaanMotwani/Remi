import React, { useEffect, useRef } from "react";

export function BlobAvatar() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    // Resize canvas to fill screen with proper device pixel ratio
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayedWidth = 400;
      const displayedHeight = 400;

      canvas.width = displayedWidth * dpr;
      canvas.height = displayedHeight * dpr;

      canvas.style.width = `${displayedWidth}px`;
      canvas.style.height = `${displayedHeight}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset transform before scaling
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      source.connect(analyserRef.current);
    });

    const numPoints = 20; // more points = smoother blob
    const baseRadius = 130;

    // For smooth wobble: phase offsets per point, updated over time
    const phaseOffsets = Array.from({ length: numPoints }, () => Math.random() * Math.PI * 2);

    // Smooth wobble using combined sine waves with different frequencies
    const getWobble = (index: number, t: number, intensity: number) => {
      const wobble =
        Math.sin(t * 2 + phaseOffsets[index]) * 5 +
        Math.sin(t * 3 + phaseOffsets[index] * 1.5) * 3 +
        Math.sin(t * 1.5 + phaseOffsets[index] * 0.7) * 2;

      const minWobble = -10; // roughly min of combined sine sum, adjust if needed
      const wobblePositive = wobble - minWobble; // shift upward by absolute min value
      return wobblePositive * intensity;
    };

    const drawBlob = (ctx: CanvasRenderingContext2D, audioLevel: number, t: number) => {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Setup radial gradient for 3D lighting effect
      const gradient = ctx.createRadialGradient(
        centerX - 10,
        centerY - 20,
        baseRadius * 0.5,
        centerX,
        centerY,
        baseRadius * 1.6
      );
      // gradient.addColorStop(0, "rgba(107, 30, 179, 0.9)");
      gradient.addColorStop(0.2, "rgba(100, 50, 180, 0.7)");
      // gradient.addColorStop(1, "rgba(40, 0, 80, 0.3)");

      ctx.fillStyle = gradient;

      // Drop multiple shadows for glowing effect
      ctx.shadowColor = "rgba(180, 100, 255, 0.44)";
      ctx.shadowBlur = 60;

      // Collect points first
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;

        let wobble = 0;
        if (audioLevel > 0.05) {
          wobble = getWobble(i % numPoints, t, audioLevel) * (6 + audioLevel * 18);
        }

        const r = baseRadius + wobble;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        points.push({ x, y });
      }

      // Begin path and move to first point
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      // Slight smoothing using quadraticCurveTo between midpoints
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const midX = (prev.x + curr.x) / 2;
        const midY = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }

      ctx.closePath();

      ctx.fill();
    };

    let smoothedAudioLevel = 0;

    const animate = (t: number) => {
      requestAnimationFrame(animate);

      let audioLevel = 0;
      if (analyserRef.current && dataArrayRef.current) {
        analyserRef.current.getByteFrequencyData(dataArrayRef.current as unknown as Uint8Array<ArrayBuffer>);
        const avg = dataArrayRef.current.reduce((sum, v) => sum + v, 0) / dataArrayRef.current.length;
        audioLevel = avg / 255;
      }

      if (audioLevel > smoothedAudioLevel) {
        smoothedAudioLevel = audioLevel; // respond immediately to rises
      } else {
        // smooth only on falling edge
        const smoothingFactor = 0.1;
        smoothedAudioLevel += (audioLevel - smoothedAudioLevel) * smoothingFactor;
      }

      drawBlob(ctx, smoothedAudioLevel, t / 1000);
    };

    animate(0);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

return (
  <canvas
    ref={canvasRef}
    style={{
      position: "fixed",
      top: "50%",
      left: "50%",
      width: 400,
      height: 400,
      transform: "translate(-50%, -50%)",
      zIndex: 2,
      background: "radial-gradient(ellipse at center)",
      // borderRadius: 12,
    }}
  />
);
}
