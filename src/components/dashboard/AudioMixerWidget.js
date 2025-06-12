import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, 
  VolumeX, 
  Settings, 
  Eye, 
  EyeOff, 
  BarChart3,
  Mic,
  Speaker,
  Headphones,
  Monitor,
  Gamepad2,
  Music,
  Bell,
  MoreVertical
} from 'lucide-react';
import globalStateService from '../../services/globalStateService';
import configService from '../../services/configService';

const AudioMixerWidget = ({ component, editMode, onUpdate, onRemove, performanceMode }) => {
  const [audioSources, setAudioSources] = useState([]);
  const [audioLevels, setAudioLevels] = useState({});
  const [visibleSources, setVisibleSources] = useState(component.sources || ['master', 'mic', 'desktop']);
  const [compactMode, setCompactMode] = useState(component.size?.width < 200);
  const [showMeters, setShowMeters] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const updateTimeout = useRef(null);

  // Source icons mapping
  const sourceIcons = {
    master: Speaker,
    mic: Mic,
    desktop: Monitor,
    game: Gamepad2,
    music: Music,
    discord: Volume2,
    browser: Monitor,
    alert: Bell
  };

  // Source display names
  const sourceNames = {
    master: 'Master',
    mic: 'Microphone',
    desktop: 'Desktop',
    game: 'Game Audio',
    music: 'Music',
    discord: 'Discord',
    browser: 'Browser',
    alert: 'Alerts'
  };

  useEffect(() => {
    loadAudioSources();
    
    // Listen for audio level updates
    const handleAudioLevels = (data) => {
      if (!performanceMode || Math.random() < 0.3) { // Reduce updates in performance mode
        setAudioLevels(prev => ({
          ...prev,
          [data.sourceName]: data.levels
        }));
      }
    };

    const handleSourcesUpdated = (sources) => {
      setAudioSources(sources);
    };

    globalStateService.on('audioLevelsUpdated', handleAudioLevels);
    globalStateService.on('sourcesDiscovered', handleSourcesUpdated);

    return () => {
      globalStateService.off('audioLevelsUpdated', handleAudioLevels);
      globalStateService.off('sourcesDiscovered', handleSourcesUpdated);
      if (updateTimeout.current) {
        clearTimeout(updateTimeout.current);
      }
    };
  }, [performanceMode]);

  useEffect(() => {
    // Update compact mode based on widget size
    setCompactMode(component.size?.width < 200);
  }, [component.size]);

  const loadAudioSources = () => {
    const sources = globalStateService.getAudioSources();
    setAudioSources(sources);
    
    // Load initial audio levels
    const levels = globalStateService.getAllAudioLevels();
    setAudioLevels(levels);
  };

  const handleVolumeChange = useCallback(async (sourceName, volumeDb) => {
    try {
      await globalStateService.setVolume(sourceName, volumeDb, 'AudioMixerWidget');
    } catch (error) {
      console.error('Failed to set volume:', error);
    }
  }, []);

  const handleMuteToggle = useCallback(async (sourceName) => {
    try {
      await globalStateService.toggleMute(sourceName, 'AudioMixerWidget');
    } catch (error) {
      console.error('Failed to toggle mute:', error);
    }
  }, []);

  const getVolumeFromDb = (volumeDb) => {
    if (volumeDb <= -60) return 0;
    return Math.round(((volumeDb + 60) / 60) * 100);
  };

  const getDbFromVolume = (volume) => {
    if (volume <= 0) return -60;
    return (volume / 100) * 60 - 60;
  };

  const renderVolumeSlider = (source) => {
    const volumeDb = source.volumeDb || -60;
    const volume = getVolumeFromDb(volumeDb);
    const levels = audioLevels[source.name];
    const Icon = sourceIcons[source.name] || Volume2;

    return (
      <div 
        key={source.name}
        className={`${compactMode ? 'p-2' : 'p-3'} bg-gray-700 rounded-lg border border-gray-600`}
      >
        {/* Source Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Icon className={`${compactMode ? 'w-3 h-3' : 'w-4 h-4'} text-green-400`} />
            <span className={`${compactMode ? 'text-xs' : 'text-sm'} font-medium text-white truncate`}>
              {sourceNames[source.name] || source.name}
            </span>
          </div>
          
          <button
            onClick={() => handleMuteToggle(source.name)}
            className={`${compactMode ? 'p-1' : 'p-1.5'} rounded transition-colors ${
              source.muted 
                ? 'bg-red-500/20 text-red-400' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            {source.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
        </div>

        {/* Volume Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => {
              const newVolume = parseInt(e.target.value);
              const newVolumeDb = getDbFromVolume(newVolume);
              handleVolumeChange(source.name, newVolumeDb);
            }}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #10b981 0%, #10b981 ${volume}%, #4b5563 ${volume}%, #4b5563 100%)`
            }}
          />
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">{volumeDb.toFixed(0)}dB</span>
            <span className="text-gray-400">{volume}%</span>
          </div>
        </div>

        {/* Audio Level Meters */}
        {showMeters && levels && !performanceMode && (
          <div className="mt-2 space-y-1">
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500 w-4">L</span>
              <div className="flex-1 h-1 bg-gray-600 rounded overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 transition-all duration-100"
                  style={{ 
                    width: `${Math.max(0, Math.min(100, ((levels.left + 60) / 60) * 100))}%` 
                  }}
                />
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-xs text-gray-500 w-4">R</span>
              <div className="flex-1 h-1 bg-gray-600 rounded overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400 transition-all duration-100"
                  style={{ 
                    width: `${Math.max(0, Math.min(100, ((levels.right + 60) / 60) * 100))}%` 
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Peak Indicators */}
        {levels && levels.left > -3 && (
          <div className="mt-1 text-xs text-red-400 animate-pulse">
            PEAK
          </div>
        )}
      </div>
    );
  };

  const renderSourceSelector = () => {
    const allSources = ['master', 'mic', 'desktop', 'game', 'music', 'discord', 'browser', 'alert'];
    const availableSources = audioSources.map(s => s.name);

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white">Visible Sources</h4>
        <div className="grid grid-cols-2 gap-2">
          {allSources.map(sourceName => {
            const isAvailable = availableSources.includes(sourceName);
            const isVisible = visibleSources.includes(sourceName);
            const Icon = sourceIcons[sourceName];

            return (
              <button
                key={sourceName}
                onClick={() => {
                  if (isAvailable) {
                    const newVisible = isVisible
                      ? visibleSources.filter(s => s !== sourceName)
                      : [...visibleSources, sourceName];
                    setVisibleSources(newVisible);
                    onUpdate({ sources: newVisible });
                  }
                }}
                disabled={!isAvailable}
                className={`p-2 rounded border text-xs flex items-center space-x-2 transition-colors ${
                  !isAvailable 
                    ? 'border-gray-700 bg-gray-800 text-gray-600 cursor-not-allowed'
                    : isVisible
                    ? 'border-green-500 bg-green-500/20 text-green-400'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <Icon className="w-3 h-3" />
                <span>{sourceNames[sourceName]}</span>
                {!isAvailable && <span className="text-gray-600">×</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <AnimatePresence>
      {showSettings && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg p-3 z-50"
        >
          <div className="space-y-3">
            {renderSourceSelector()}
            
            <div className="border-t border-gray-700 pt-3">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={showMeters}
                  onChange={(e) => setShowMeters(e.target.checked)}
                  className="rounded border-gray-500"
                />
                <span className="text-sm text-white">Show Level Meters</span>
              </label>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const getVisibleAudioSources = () => {
    return audioSources.filter(source => visibleSources.includes(source.name));
  };

  const visibleAudioSources = getVisibleAudioSources();

  return (
    <div className="h-full flex flex-col bg-gray-800 border border-gray-700 rounded-lg overflow-hidden relative">
      {/* Widget Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-750">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-medium text-white">Audio Mixer</h3>
          <span className="text-xs text-gray-400">({visibleAudioSources.length})</span>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setShowMeters(!showMeters)}
            className={`p-1 rounded transition-colors ${
              showMeters ? 'text-green-400' : 'text-gray-400 hover:text-white'
            }`}
            title="Toggle Level Meters"
          >
            <BarChart3 className="w-3 h-3" />
          </button>
          
          {editMode && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 text-gray-400 hover:text-white"
            >
              <Settings className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Widget Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {visibleAudioSources.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <div className="text-center">
              <Volume2 className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <div>No audio sources</div>
              <div className="text-xs mt-1">Configure in settings</div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAudioSources.map(source => renderVolumeSlider(source))}
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className="border-t border-gray-700 px-3 py-2 bg-gray-750">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            OBS: {globalStateService.isOBSConnected() ? (
              <span className="text-green-400">Connected</span>
            ) : (
              <span className="text-red-400">Disconnected</span>
            )}
          </span>
          <span className="text-gray-400">
            {performanceMode && '⚡'} {visibleAudioSources.length} sources
          </span>
        </div>
      </div>

      {/* Settings Panel */}
      {renderSettings()}
    </div>
  );
};

export default AudioMixerWidget;
