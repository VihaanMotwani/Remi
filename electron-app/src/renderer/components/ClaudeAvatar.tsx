import React, { useEffect, useRef } from 'react';
// import './VoiceAgentBlob.css';

interface Point {
  angle: number;
  radius: number;
  velocity: number;
  targetRadius: number;
  baseRadius: number;
}

interface Layer {
  points: Point[];
  opacity: number;
  color: string;
  phaseOffset: number;
}

type BlobState = 'idle' | 'listening' | 'speaking';

interface VoiceAgentBlobProps {
  state: BlobState;
  title?: string;
  subtitle?: string;
  body?: string;
}

const VoiceAgentBlob: React.FC<VoiceAgentBlobProps> = ({ 
  state, 
  title, 
  subtitle, 
  body 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Configuration
    const config = {
      idleBreathingSpeed: 0.6,
      idleBreathingAmplitude: 2,
      listeningWave1Speed: 1.5,
      listeningWave1Amplitude: 6,
      listeningWave2Speed: 1.2,
      listeningWave2Amplitude: 4,
      listeningWave3Speed: 0.8,
      listeningWave3Amplitude: 3,
      speakingWave1Speed: 2.5,
      speakingWave1Amplitude: 18,
      speakingWave2Speed: 3.2,
      speakingWave2Amplitude: 12,
      speakingWave3Speed: 1.8,
      speakingWave3Amplitude: 15,
      speakingWave4Speed: 4.1,
      speakingWave4Amplitude: 8,
      speakingWave5Speed: 2.3,
      speakingWave5Amplitude: 10,
      speakingFlowSpeed: 0.9,
      speakingFlowAmplitude: 5,
      springStrength: 0.008,
      damping: 0.92,
      cohesion: 0.05,
      baseRadius: 60,
      layerSpacing: 20,
      numLayers: 4,
      numPoints: 64
    };
    
    let time = 0;
    let layers: Layer[] = [];
    let animationId: number;
    
    const initLayers = (): void => {
      layers = [];
      for (let layer = 0; layer < config.numLayers; layer++) {
        const points: Point[] = [];
        const baseRadius = config.baseRadius + layer * config.layerSpacing;
        
        for (let i = 0; i < config.numPoints; i++) {
          const angle = (i / config.numPoints) * Math.PI * 2;
          points.push({
            angle: angle,
            radius: baseRadius,
            velocity: 0,
            targetRadius: baseRadius,
            baseRadius: baseRadius
          });
        }
        
        layers.push({
          points: points,
          opacity: 0.15 + (layer * 0.15),
          color: ['#5a9fd4', '#6aafff', '#7ab5ff', '#8ac5ff'][layer] || '#8ac5ff',
          phaseOffset: layer * 0.5
        });
      }
    };
    
    const updateLayers = (): void => {
      layers.forEach((layer) => {
        layer.points.forEach((point, i) => {
          const angle = point.angle;
          const phase = time + layer.phaseOffset;
          
          if (state === 'idle') {
            const breathing = Math.sin(phase * config.idleBreathingSpeed) * config.idleBreathingAmplitude;
            point.targetRadius = point.baseRadius + breathing;
            
          } else if (state === 'listening') {
            const wave1 = Math.sin(phase * config.listeningWave1Speed + angle * 2) * config.listeningWave1Amplitude;
            const wave2 = Math.sin(phase * config.listeningWave2Speed - angle * 3) * config.listeningWave2Amplitude;
            const wave3 = Math.sin(phase * config.listeningWave3Speed + angle * 4) * config.listeningWave3Amplitude;
            point.targetRadius = point.baseRadius + wave1 + wave2 + wave3;
            
          } else if (state === 'speaking') {
            const w1 = Math.sin(angle * 3 + phase * config.speakingWave1Speed) * config.speakingWave1Amplitude;
            const w2 = Math.sin(angle * 5 - phase * config.speakingWave2Speed) * config.speakingWave2Amplitude;
            const w3 = Math.sin(angle * 2 + phase * config.speakingWave3Speed) * config.speakingWave3Amplitude;
            const w4 = Math.sin(angle * 7 + phase * config.speakingWave4Speed) * config.speakingWave4Amplitude;
            const w5 = Math.sin(angle * 4 - phase * config.speakingWave5Speed) * config.speakingWave5Amplitude;
            const flow = Math.sin(phase * config.speakingFlowSpeed + angle) * config.speakingFlowAmplitude;
            
            const total = w1 + w2 + w3 + w4 + w5 + flow;
            const minRadius = point.baseRadius * 0.4;
            point.targetRadius = Math.max(minRadius, point.baseRadius + total);
          }
          
          const displacement = point.targetRadius - point.radius;
          point.velocity += displacement * config.springStrength;
          point.velocity *= config.damping;
          point.radius += point.velocity;
          
          const prev = layer.points[(i - 1 + config.numPoints) % config.numPoints];
          const next = layer.points[(i + 1) % config.numPoints];
          const avgNeighbor = (prev.radius + next.radius) / 2;
          const cohesionForce = (avgNeighbor - point.radius) * config.cohesion;
          point.radius += cohesionForce;
        });
      });
    };
    
    const drawLayers = (): void => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      layers.forEach((layer, layerIndex) => {
        const points = layer.points;
        
        const gradient = ctx.createRadialGradient(
          centerX, centerY, 0,
          centerX, centerY, points[0].baseRadius + 50
        );
        gradient.addColorStop(0, layer.color + Math.floor(layer.opacity * 255).toString(16).padStart(2, '0'));
        gradient.addColorStop(1, layer.color + '00');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        
        for (let i = 0; i <= config.numPoints; i++) {
          const current = points[i % config.numPoints];
          const next = points[(i + 1) % config.numPoints];
          
          const x = centerX + Math.cos(current.angle) * current.radius;
          const y = centerY + Math.sin(current.angle) * current.radius;
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            const nextX = centerX + Math.cos(next.angle) * next.radius;
            const nextY = centerY + Math.sin(next.angle) * next.radius;
            
            const cp1x = x + (nextX - x) * 0.5;
            const cp1y = y + (nextY - y) * 0.5;
            const cp2x = nextX - (nextX - x) * 0.5;
            const cp2y = nextY - (nextY - y) * 0.5;
            
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, nextX, nextY);
          }
        }
        
        ctx.closePath();
        ctx.fill();
        
        if (state === 'speaking') {
          ctx.shadowBlur = 20 + layerIndex * 10;
          ctx.shadowColor = layer.color + '40';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });
    };
    
    const animate = (): void => {
      time += 0.015;
      updateLayers();
      drawLayers();
      animationId = requestAnimationFrame(animate);
    };
    
    initLayers();
    animate();
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [state]);

  return (
    <div>
      <canvas 
        ref={canvasRef} 
        width="500" 
        height="500"
        style={{ filter: 'blur(0.5px)' }}
        className="voice-agent-canvas"
      />
    </div>
  );
};

export default VoiceAgentBlob;