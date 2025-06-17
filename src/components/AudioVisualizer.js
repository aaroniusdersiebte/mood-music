import React, { useRef, useEffect, useState } from 'react';

const AudioVisualizer = ({ 
  audioLevel, 
  width = 150, 
  height = 24, 
  style = 'horizontal',
  isActive = false,
  sourceType = 'output' // 'input' for mic, 'output' for speakers
}) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const [levels, setLevels] = useState([]);
  
  // Convert audioLevel to usable format
  useEffect(() => {
    if (audioLevel && Array.isArray(audioLevel) && audioLevel.length > 0) {
      // OBS provides levels in dB, convert to 0-1 range
      const processedLevels = audioLevel.map(level => {
        // Level comes as dB value (typically -60 to 0)
        const normalizedLevel = Math.max(0, Math.min(1, (level + 60) / 60));
        return normalizedLevel;
      });
      setLevels(processedLevels);
      // Temporary debug logging
      if (Math.random() < 0.01) { // Only log 1% of the time to avoid spam
        console.log('AudioVisualizer: Processed levels:', processedLevels, 'from raw:', audioLevel);
      }
    } else {
      setLevels([0, 0]); // Stereo silence
    }
  }, [audioLevel]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set actual size in memory (scaled to account for extra pixel density)
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    
    // Scale the drawing context so everything will work at the higher DPI
    ctx.scale(dpr, dpr);

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      if (!isActive || levels.length === 0) {
        // Draw inactive state - subtle outline
        ctx.strokeStyle = '#374151'; // gray-700
        ctx.lineWidth = 1;
        ctx.strokeRect(1, 1, width - 2, height - 2);
        
        // Add small center line to show it's ready
        ctx.strokeStyle = '#4B5563'; // gray-600
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(width * 0.5, height * 0.4);
        ctx.lineTo(width * 0.5, height * 0.6);
        ctx.stroke();
      } else {
        // Draw active visualizer
        drawVisualizer(ctx);
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [width, height, levels, isActive, sourceType]);

  const drawVisualizer = (ctx) => {
    const barCount = levels.length || 2; // Usually stereo (L/R channels)
    const barWidth = (width - 4) / barCount; // Leave 2px padding on each side
    const maxBarHeight = height - 4; // Leave 2px padding top/bottom
    
    // Color scheme based on source type
    const colors = {
      input: {
        low: '#10B981',    // green-500 (safe)
        mid: '#F59E0B',    // amber-500 (warning)
        high: '#EF4444'    // red-500 (danger)
      },
      output: {
        low: '#3B82F6',    // blue-500 (safe)
        mid: '#8B5CF6',    // violet-500 (mid)
        high: '#EF4444'    // red-500 (danger)
      }
    };
    
    const colorScheme = colors[sourceType] || colors.output;
    
    levels.forEach((level, index) => {
      const x = 2 + (index * barWidth);
      const barHeight = Math.max(2, level * maxBarHeight);
      const y = height - 2 - barHeight;
      
      // Determine color based on level
      let color;
      if (level < 0.6) {
        color = colorScheme.low;
      } else if (level < 0.85) {
        color = colorScheme.mid;
      } else {
        color = colorScheme.high;
      }
      
      // Add subtle glow effect for active levels
      if (level > 0.1) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 3;
      } else {
        ctx.shadowBlur = 0;
      }
      
      // Draw the level bar
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
      
      // Add peak indicator for high levels
      if (level > 0.8) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y - 1, barWidth - 1, 1);
      }
      
      // Reset shadow
      ctx.shadowBlur = 0;
    });
    
    // Draw border
    ctx.strokeStyle = '#374151'; // gray-700
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  };

  return (
    <div className="audio-visualizer" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          borderRadius: '3px',
          background: 'transparent'
        }}
        className="block"
      />
    </div>
  );
};

export default AudioVisualizer;
