import React, { useRef, useEffect, useCallback, memo, useState } from 'react';

const AudioLevelMeter = memo(({ 
  inputName, 
  audioLevel, 
  isActive = true, 
  width = 200, 
  height = 40,
  style = "horizontal", // "horizontal" or "vertical"
  debug = false // Debug-Modus für Troubleshooting
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const [debugInfo, setDebugInfo] = useState(null);

  // 🎯 GEFIXT: Performance optimized drawing function mit Debug-Unterstützung
  const drawMeter = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width: canvasWidth, height: canvasHeight } = canvas;
    
    // Clear canvas with dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 🎯 WICHTIG: Prüfe Audio-Level-Daten
    if (!audioLevel) {
      drawNoDataIndicator(ctx, canvasWidth, canvasHeight);
      return;
    }

    // Debug-Info sammeln
    if (debug) {
      setDebugInfo({
        hasAudioLevel: !!audioLevel,
        isReal: audioLevel.isReal,
        left: audioLevel.left?.toFixed(1),
        right: audioLevel.right?.toFixed(1),
        timestamp: audioLevel.timestamp,
        timeSinceUpdate: audioLevel.timestamp ? Date.now() - audioLevel.timestamp : 'N/A',
        inputName: inputName
      });
    }

    // Get level data mit Fallbacks
    const { left = -60, right = -60, peak = { left: -60, right: -60 } } = audioLevel;
    
    if (style === "horizontal") {
      drawHorizontalMeter(ctx, canvasWidth, canvasHeight, left, right, peak);
    } else {
      drawVerticalMeter(ctx, canvasWidth, canvasHeight, left, right, peak);
    }
    
    // 🧪 Test-Indikator wenn es Test-Daten sind
    if (audioLevel && !audioLevel.isReal) {
      drawTestIndicator(ctx, canvasWidth, canvasHeight);
    }
  }, [audioLevel, style, debug, inputName]);

  const drawNoDataIndicator = (ctx, width, height) => {
    // Grauer Hintergrund
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(2, 2, width - 4, height - 4);
    
    // Border
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    ctx.strokeRect(1, 1, width - 2, height - 2);
    
    // Text
    ctx.fillStyle = '#666666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No Audio Data', width / 2, height / 2 + 3);
  };

  const drawTestIndicator = (ctx, width, height) => {
    // Test-Indikator in der oberen rechten Ecke
    ctx.fillStyle = '#ff6600';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('TEST', width - 5, 12);
  };

  const drawHorizontalMeter = (ctx, width, height, left, right, peak) => {
    const channels = [
      { level: left, peak: peak.left, y: 0 },
      { level: right, peak: peak.right, y: height / 2 }
    ];

    channels.forEach(({ level, peak: peakLevel, y }) => {
      const barHeight = (height / 2) - 4; // Leave 2px margin on each side
      const barY = y + 2;

      // 🎯 GEFIXT: Korrekte dB-zu-Prozent Konvertierung (OBS-Style)
      const levelPercentage = dbToPercentage(level);
      const peakPercentage = dbToPercentage(peakLevel);
      
      const barWidth = (levelPercentage / 100) * width;
      const peakPosition = (peakPercentage / 100) * width;

      // Draw level bar with professional gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      
      // Professional audio level colors (wie im alten Projekt)
      if (level > -6) {
        // Red zone: -6dB to 0dB (danger - clipping risk)
        gradient.addColorStop(0, '#00ff41');    // Green
        gradient.addColorStop(0.7, '#ffff00');  // Yellow  
        gradient.addColorStop(0.9, '#ff8800');  // Orange
        gradient.addColorStop(1, '#ff1744');    // Red
      } else if (level > -18) {
        // Yellow zone: -18dB to -6dB (caution)
        gradient.addColorStop(0, '#00ff41');    // Green
        gradient.addColorStop(0.8, '#ffff00');  // Yellow
        gradient.addColorStop(1, '#ffaa00');    // Orange
      } else {
        // Green zone: -60dB to -18dB (safe)
        gradient.addColorStop(0, '#004d00');    // Dark green
        gradient.addColorStop(0.5, '#00aa00');  // Medium green
        gradient.addColorStop(1, '#00ff41');    // Bright green
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(0, barY, barWidth, barHeight);

      // Draw peak hold indicator
      if (peakLevel > -60) {
        ctx.fillStyle = peakLevel > -3 ? '#ff1744' : '#ffffff';
        ctx.fillRect(peakPosition - 1, barY, 2, barHeight);
      }

      // Draw scale markings
      drawScale(ctx, width, height, barY, barHeight);
    });
  };

  const drawVerticalMeter = (ctx, width, height, left, right, peak) => {
    const channels = [
      { level: left, peak: peak.left, x: 0 },
      { level: right, peak: peak.right, x: width / 2 }
    ];

    channels.forEach(({ level, peak: peakLevel, x }) => {
      const barWidth = (width / 2) - 4;
      const barX = x + 2;

      const levelPercentage = dbToPercentage(level);
      const peakPercentage = dbToPercentage(peakLevel);
      
      const barHeight = (levelPercentage / 100) * height;
      const peakPosition = height - (peakPercentage / 100) * height;

      // Draw level bar with gradient (bottom to top)
      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      
      gradient.addColorStop(0, '#00ff41');      // Green at bottom
      gradient.addColorStop(0.7, '#ffff00');    // Yellow in middle
      gradient.addColorStop(0.9, '#ff8800');    // Orange near top
      gradient.addColorStop(1, '#ff1744');      // Red at top

      ctx.fillStyle = gradient;
      ctx.fillRect(barX, height - barHeight, barWidth, barHeight);

      // Draw peak hold indicator
      if (peakLevel > -60) {
        ctx.fillStyle = peakLevel > -3 ? '#ff1744' : '#ffffff';
        ctx.fillRect(barX, peakPosition - 1, barWidth, 2);
      }
    });
  };

  // 🎯 OBS-Style dB zu Prozent Konvertierung (wie im alten Projekt)
  const dbToPercentage = (db) => {
    if (db <= -60) return 0;
    if (db >= 0) return 100;
    
    // OBS-Style logarithmische Verteilung
    if (db >= -20) {
      // Oberer Bereich (-20dB bis 0dB): 40% des Meter-Platzes
      return 60 + (db + 20) / 20 * 40;
    } else {
      // Unterer Bereich (-60dB bis -20dB): 60% des Meter-Platzes  
      return (db + 60) / 40 * 60;
    }
  };

  const drawScale = (ctx, width, height, barY, barHeight) => {
    // Draw dB scale markings
    const markings = [-60, -40, -20, -12, -6, -3, 0];
    
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.font = '8px monospace';
    ctx.fillStyle = '#888888';

    markings.forEach(db => {
      const position = (dbToPercentage(db) / 100) * width;
      
      // Draw tick mark
      ctx.beginPath();
      ctx.moveTo(position, barY + barHeight);
      ctx.lineTo(position, barY + barHeight + 4);
      ctx.stroke();

      // Draw label for key markings
      if (db === -60 || db === -20 || db === -6 || db === 0) {
        const label = db === 0 ? '0' : db.toString();
        const textWidth = ctx.measureText(label).width;
        ctx.fillText(label, position - textWidth / 2, barY + barHeight + 14);
      }
    });
  };

  // Animation loop mit throttling
  useEffect(() => {
    if (!isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const animate = (timestamp) => {
      // Throttle zu ~20fps für Performance
      if (timestamp - lastUpdateRef.current >= 50) {
        drawMeter();
        lastUpdateRef.current = timestamp;
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawMeter, isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="audio-meter-container flex flex-col items-center space-y-1">
      <label className="text-xs text-gray-400 font-mono truncate max-w-full" title={inputName}>
        {inputName}
      </label>
      <canvas 
        ref={canvasRef}
        width={width}
        height={height}
        className="audio-level-canvas border border-gray-600 rounded bg-gray-900"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
      
      {/* Audio Level Info */}
      {audioLevel && (
        <div className="text-xs text-gray-500 font-mono">
          L: {audioLevel.left?.toFixed(1) || '-∞'}dB | R: {audioLevel.right?.toFixed(1) || '-∞'}dB
          {audioLevel.isReal === false && <span className="text-orange-400 ml-2">(TEST)</span>}
        </div>
      )}
      
      {/* Debug Info */}
      {debug && debugInfo && (
        <div className="text-xs text-blue-400 font-mono mt-1 p-2 bg-blue-900/20 rounded max-w-full">
          <div className="grid grid-cols-1 gap-1">
            <div>📊 {debugInfo.inputName}</div>
            <div>📡 Data: {debugInfo.hasAudioLevel ? '✅' : '❌'} | Real: {debugInfo.isReal ? '✅' : '🧪'}</div>
            <div>🎵 L/R: {debugInfo.left}/{debugInfo.right} dB</div>
            <div>⏰ Age: {debugInfo.timeSinceUpdate}ms</div>
          </div>
        </div>
      )}
      
      {/* No Data Message */}
      {!audioLevel && (
        <div className="text-xs text-red-400 font-mono">
          No live audio data
        </div>
      )}
    </div>
  );
});

AudioLevelMeter.displayName = 'AudioLevelMeter';

export default AudioLevelMeter;