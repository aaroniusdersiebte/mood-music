import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Volume2, 
  VolumeX, 
  Mic, 
  Monitor, 
  Headphones, 
  Speaker,
  Settings,
  Eye,
  EyeOff,
  RefreshCw
} from 'lucide-react';
import globalStateService from '../../services/globalStateService';
import audioDeckService from '../../services/audioDeckService';
import AudioLevelMeter from '../AudioLevelMeter';

const AudioDeckWidget = ({ component, editMode, onUpdate, onRemove }) => {
  const [audioSources, setAudioSources] = useState([]);
  const [realTimeAudioLevels, setRealTimeAudioLevels] = useState({});
  const [connected, setConnected] = useState(false);
  const [deck, setDeck] = useState(null);
  const [draggedSlider, setDraggedSlider] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const deckId = component.deckId;
  const deckName = component.deckName || 'Audio Deck';
  const deckColor = component.deckColor || 'blue';
  const orientation = component.orientation || 'vertical';
  const showMeters = component.showMeters !== false;

  useEffect(() => {
    console.log('AudioDeckWidget: Initializing for deck:', deckId);
    
    if (!deckId) {
      console.error('AudioDeckWidget: No deckId provided');
      return;
    }

    // Load deck data first
    loadDeckData();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial OBS state after deck data is loaded
    // Use setTimeout to ensure deck data is loaded first
    setTimeout(() => {
      loadInitialState();
    }, 100);

    return () => {
      cleanup();
    };
  }, [deckId]);
  
  // Watch for deck changes and reload state
  useEffect(() => {
    if (deck) {
      console.log('AudioDeckWidget: Deck data updated, reloading initial state...');
      loadInitialState();
    }
  }, [deck]);

  const loadDeckData = () => {
    try {
      const deckData = audioDeckService.getDeck(deckId);
      if (deckData) {
        setDeck(deckData);
        console.log('✅ AudioDeckWidget: Deck data loaded:', deckData.name);
      } else {
        console.warn('⚠️ AudioDeckWidget: Deck not found:', deckId);
      }
    } catch (error) {
      console.error('❌ AudioDeckWidget: Failed to load deck data:', error);
    }
  };

  const loadInitialState = () => {
    try {
      const obsState = globalStateService.getOBSState();
      setConnected(obsState.connected);
      
      console.log('AudioDeckWidget: Loading initial state for deck:', deckId, {
        obsConnected: obsState.connected,
        totalSources: obsState.sources?.length || 0,
        deckSources: deck?.sources?.length || 0
      });
      
      if (obsState.sources && deck && deck.sources.length > 0) {
        // Filter sources that belong to this deck
        const deckSources = obsState.sources.filter(source => {
          const isInDeck = deck.sources.includes(source.name);
          console.log('AudioDeckWidget: Source check:', source.name, 'in deck:', isInDeck);
          return isInDeck;
        });
        
        setAudioSources(deckSources);
        console.log('AudioDeckWidget: Loaded', deckSources.length, 'sources for deck:', deckName);
      } else {
        console.log('AudioDeckWidget: No sources found. OBS sources:', obsState.sources?.length, 'Deck sources:', deck?.sources?.length);
        
        // If OBS is connected but no sources found, trigger discovery
        if (obsState.connected && (!obsState.sources || obsState.sources.length === 0)) {
          console.log('AudioDeckWidget: Triggering OBS source discovery...');
          setTimeout(() => {
            if (globalStateService.services?.obs) {
              globalStateService.services.obs.discoverAudioSources();
            }
          }, 1000);
        }
      }

      // Load real-time audio levels
      if (obsState.realTimeAudioLevels) {
        const levelsObj = {};
        if (obsState.realTimeAudioLevels instanceof Map) {
          obsState.realTimeAudioLevels.forEach((value, key) => {
            levelsObj[key] = value;
          });
        } else {
          Object.assign(levelsObj, obsState.realTimeAudioLevels);
        }
        setRealTimeAudioLevels(levelsObj);
      }
    } catch (error) {
      console.error('AudioDeckWidget: Failed to load initial state:', error);
    }
  };

  const setupEventListeners = () => {
    globalStateService.on('obsStateChanged', handleOBSStateChange);
    globalStateService.on('audioLevelsUpdated', handleAudioLevelsUpdate);
    globalStateService.on('sourceVolumeUpdated', handleSourceVolumeUpdate);
    
    audioDeckService.on('deckUpdated', handleDeckUpdated);
    audioDeckService.on('sourceAddedToDeck', handleSourceAddedToDeck);
    audioDeckService.on('sourceRemovedFromDeck', handleSourceRemovedFromDeck);
  };

  const cleanup = () => {
    globalStateService.off('obsStateChanged', handleOBSStateChange);
    globalStateService.off('audioLevelsUpdated', handleAudioLevelsUpdate);
    globalStateService.off('sourceVolumeUpdated', handleSourceVolumeUpdate);
    
    audioDeckService.off('deckUpdated', handleDeckUpdated);
    audioDeckService.off('sourceAddedToDeck', handleSourceAddedToDeck);
    audioDeckService.off('sourceRemovedFromDeck', handleSourceRemovedFromDeck);
  };

  // Event Handlers
  const handleOBSStateChange = useCallback((newState) => {
    setConnected(newState.connected);
    
    if (newState.sources && deck) {
      const deckSources = newState.sources.filter(source => 
        deck.sources.includes(source.name)
      );
      setAudioSources(deckSources);
    }

    if (newState.realTimeAudioLevels) {
      const levelsObj = {};
      if (newState.realTimeAudioLevels instanceof Map) {
        newState.realTimeAudioLevels.forEach((value, key) => {
          levelsObj[key] = value;
        });
      } else {
        Object.assign(levelsObj, newState.realTimeAudioLevels);
      }
      setRealTimeAudioLevels(levelsObj);
    }
  }, [deck]);

  const handleAudioLevelsUpdate = useCallback((data) => {
    if (deck && deck.sources.includes(data.sourceName)) {
      setRealTimeAudioLevels(prev => ({
        ...prev,
        [data.sourceName]: data.levels
      }));
    }
  }, [deck]);

  const handleSourceVolumeUpdate = useCallback((data) => {
    if (draggedSlider !== data.sourceName && deck && deck.sources.includes(data.sourceName)) {
      setAudioSources(prevSources => 
        prevSources.map(source => 
          source.name === data.sourceName 
            ? { ...source, volumeDb: data.volumeDb, volume: data.volume }
            : source
        )
      );
    }
  }, [draggedSlider, deck]);

  const handleDeckUpdated = useCallback((data) => {
    if (data.deck.id === deckId) {
      setDeck(data.deck);
      loadInitialState(); // Reload sources
    }
  }, [deckId]);

  const handleSourceAddedToDeck = useCallback((data) => {
    if (data.deckId === deckId) {
      loadDeckData();
      loadInitialState();
    }
  }, [deckId]);

  const handleSourceRemovedFromDeck = useCallback((data) => {
    if (data.deckId === deckId) {
      loadDeckData();
      loadInitialState();
    }
  }, [deckId]);

  // Audio Controls
  const handleVolumeChange = async (sourceName, volumeDb) => {
    try {
      const success = await globalStateService.setVolume(sourceName, volumeDb, 'AudioDeckWidget');
      if (!success) {
        console.warn('AudioDeckWidget: Volume change was not applied for', sourceName);
      }
    } catch (error) {
      console.error('AudioDeckWidget: Failed to set volume for', sourceName, ':', error);
    }
  };

  const handleSliderStart = useCallback((sourceName) => {
    setDraggedSlider(sourceName);
  }, []);

  const handleSliderEnd = useCallback(() => {
    setDraggedSlider(null);
  }, []);

  const handleMuteToggle = async (sourceName) => {
    try {
      const success = await globalStateService.toggleMute(sourceName, 'AudioDeckWidget');
      if (!success) {
        console.warn('AudioDeckWidget: Mute toggle was not applied for', sourceName);
      }
    } catch (error) {
      console.error('AudioDeckWidget: Failed to toggle mute for', sourceName, ':', error);
    }
  };

  // Utility functions
  const getSourceIcon = (sourceKind) => {
    if (sourceKind?.includes('input') || sourceKind?.includes('mic')) {
      return <Mic className="w-4 h-4" />;
    } else if (sourceKind?.includes('output') || sourceKind?.includes('desktop')) {
      return <Monitor className="w-4 h-4" />;
    } else {
      return <Headphones className="w-4 h-4" />;
    }
  };

  const getDeckColorClass = (color) => {
    const colorMap = {
      blue: 'border-blue-500 bg-blue-500/10',
      green: 'border-green-500 bg-green-500/10',
      purple: 'border-purple-500 bg-purple-500/10',
      red: 'border-red-500 bg-red-500/10',
      yellow: 'border-yellow-500 bg-yellow-500/10',
      pink: 'border-pink-500 bg-pink-500/10',
      cyan: 'border-cyan-500 bg-cyan-500/10',
      orange: 'border-orange-500 bg-orange-500/10'
    };
    return colorMap[color] || 'border-blue-500 bg-blue-500/10';
  };

  const renderSourceSlider = (source) => {
    const levels = realTimeAudioLevels[source.name];
    const Icon = getSourceIcon(source.kind);

    return (
      <div key={source.name} className="p-3 bg-gray-700 rounded-lg border border-gray-600">
        {/* Source Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            {Icon}
            <span className="text-sm font-medium text-white truncate">
              {source.name}
            </span>
          </div>
          
          <button
            onClick={() => handleMuteToggle(source.name)}
            className={`p-1.5 rounded transition-colors ${
              source.muted 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {source.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Volume Control */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">
              {source.volumeDb?.toFixed(1) || '-60.0'} dB
            </span>
            <span className="text-gray-400">
              {Math.round(((source.volumeDb || -60) + 60) / 60 * 100)}%
            </span>
          </div>
          
          <input
            type="range"
            min="-60"
            max="0"
            step="0.1"
            value={source.volumeDb || -60}
            onChange={(e) => handleVolumeChange(source.name, parseFloat(e.target.value))}
            onMouseDown={() => handleSliderStart(source.name)}
            onMouseUp={handleSliderEnd}
            onTouchStart={() => handleSliderStart(source.name)}
            onTouchEnd={handleSliderEnd}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>

        {/* Audio Level Meter */}
        {showMeters && levels && (
          <div className="mt-2">
            <AudioLevelMeter
              inputName={source.name}
              audioLevel={levels}
              isActive={connected}
              width={component.size?.width > 200 ? 150 : 100}
              height={20}
              style="horizontal"
            />
          </div>
        )}
      </div>
    );
  };

  if (!deck) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-800 border border-gray-700 rounded-lg">
        <div className="text-center text-gray-400">
          <Speaker className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="text-sm">Loading Audio Deck...</div>
          <div className="text-xs mt-1">Deck ID: {deckId}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full flex flex-col bg-gray-800 border rounded-lg overflow-hidden ${getDeckColorClass(deckColor)}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Speaker className="w-4 h-4 text-current" />
          <h3 className="text-sm font-medium text-white">{deckName}</h3>
          <span className="text-xs text-gray-400">({audioSources.length})</span>
        </div>
        
        <div className="flex items-center space-x-1">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          
          {editMode && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <Settings className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {connected ? (
          audioSources.length > 0 ? (
            <div className={`${
              orientation === 'horizontal' 
                ? 'flex space-x-2 overflow-x-auto' 
                : 'space-y-2'
            }`}>
              {audioSources.map(source => renderSourceSlider(source))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <div className="text-center">
                <Volume2 className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <div>No sources in this deck</div>
                <div className="text-xs mt-1">Add sources in Audio Mixer</div>
              </div>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <div className="text-center">
              <Monitor className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <div>OBS not connected</div>
              <div className="text-xs mt-1">Connect in Audio Mixer</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {deck.description && (
        <div className="border-t border-gray-700 px-3 py-2 bg-gray-750">
          <div className="text-xs text-gray-400 truncate">{deck.description}</div>
        </div>
      )}

      {/* Custom Styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
          border: 2px solid #1f2937;
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
          border: 2px solid #1f2937;
        }
      `}</style>
    </div>
  );
};

export default AudioDeckWidget;
