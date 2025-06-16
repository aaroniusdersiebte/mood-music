import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, 
  VolumeX, 
  Settings, 
  Plus,
  Minus,
  RotateCcw,
  Grid,
  List,
  BarChart3,
  Mic,
  Speaker,
  Monitor,
  Music,
  Gamepad2,
  Radio,
  Headphones,
  RefreshCw,
  Move,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Minimize2,
  Palette,
  Layout
} from 'lucide-react';
import globalStateService from '../../services/globalStateService';
import audioDeckService from '../../services/audioDeckService';
import AudioLevelMeter from '../AudioLevelMeter';

const AudioDeckWidget = ({ component, editMode, onUpdate, onRemove, performanceMode }) => {
  const [deck, setDeck] = useState(null);
  const [audioSources, setAudioSources] = useState([]);
  const [audioLevels, setAudioLevels] = useState({});
  const [realTimeAudioLevels, setRealTimeAudioLevels] = useState({});
  const [showSettings, setShowSettings] = useState(false);
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [loadingState, setLoadingState] = useState('loading');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [orientation, setOrientation] = useState(component.orientation || 'vertical');
  const [showMeters, setShowMeters] = useState(component.showMeters !== false);
  const [compactMode, setCompactMode] = useState(component.size?.width < 200);
  const [lastMIDIMessage, setLastMIDIMessage] = useState(null);
  const [learningMidi, setLearningMidi] = useState(null);
  const [sourceMidiMappings, setSourceMidiMappings] = useState({});
  const [draggedSlider, setDraggedSlider] = useState(null);
  const [availableSources, setAvailableSources] = useState([]);
  const [widgetStats, setWidgetStats] = useState({ sourcesInDeck: 0, totalSources: 0 });
  
  const widgetRef = useRef(null);
  const deckId = component.deckId;

  // Source icons mapping
  const sourceIcons = {
    mic: Mic,
    microphone: Mic,
    desktop: Monitor,
    speaker: Speaker,
    system: Speaker,
    music: Music,
    game: Gamepad2,
    discord: Radio,
    browser: Monitor,
    media: Music,
    default: Volume2
  };

  const deckColorOptions = [
    { value: 'blue', label: 'Blue', class: 'text-blue-400' },
    { value: 'green', label: 'Green', class: 'text-green-400' },
    { value: 'purple', label: 'Purple', class: 'text-purple-400' },
    { value: 'red', label: 'Red', class: 'text-red-400' },
    { value: 'yellow', label: 'Yellow', class: 'text-yellow-400' },
    { value: 'pink', label: 'Pink', class: 'text-pink-400' },
    { value: 'cyan', label: 'Cyan', class: 'text-cyan-400' },
    { value: 'orange', label: 'Orange', class: 'text-orange-400' }
  ];

  useEffect(() => {
    console.log('AudioDeckWidget: Initializing for deck:', deckId);
    
    if (deckId) {
      initializeWidget();
      setupEventListeners();
    } else {
      console.error('AudioDeckWidget: No deckId provided');
      setLoadingState('error');
    }
    
    return () => {
      cleanup();
    };
  }, [deckId]);

  useEffect(() => {
    setCompactMode(component.size?.width < 200);
    setOrientation(component.orientation || 'vertical');
    setShowMeters(component.showMeters !== false);
  }, [component.size, component.orientation, component.showMeters]);

  const initializeWidget = async () => {
    try {
      setLoadingState('loading');
      
      // Load deck data
      const deckData = audioDeckService.getDeck(deckId);
      if (!deckData) {
        console.error('AudioDeckWidget: Deck not found:', deckId);
        setLoadingState('error');
        return;
      }
      
      setDeck(deckData);
      
      // Load OBS state
      const obsState = globalStateService.getOBSState();
      const midiState = globalStateService.getMIDIState();
      const audioMappings = globalStateService.getAudioSourceMappings();
      
      setConnectionStatus(obsState.connected ? 'connected' : 'disconnected');
      setLastMIDIMessage(midiState.lastActivity);
      setSourceMidiMappings(audioMappings);
      
      // Load audio sources
      if (obsState.connected && obsState.sources) {
        const audioSources = filterAudioSources(obsState.sources);
        setAvailableSources(audioSources);
        
        // Filter sources for this deck
        const deckSources = audioSources.filter(source => 
          deckData.sources.includes(source.name)
        );
        setAudioSources(deckSources);
        
        updateWidgetStats(deckSources.length, audioSources.length);
      } else {
        // Create virtual/placeholder sources for disconnected state
        createVirtualSources(deckData);
      }
      
      // Load audio levels
      const levels = globalStateService.getAllAudioLevels();
      setAudioLevels(levels);
      setRealTimeAudioLevels(levels);
      
      setLoadingState('success');
      
      console.log('AudioDeckWidget: Initialized successfully for deck:', deckData.name);
      
    } catch (error) {
      console.error('AudioDeckWidget: Failed to initialize:', error);
      setLoadingState('error');
    }
  };

  const setupEventListeners = () => {
    // OBS events
    globalStateService.on('obsStateChanged', handleOBSStateChange);
    globalStateService.on('sourcesDiscovered', handleSourcesDiscovered);
    globalStateService.on('sourceVolumeUpdated', handleVolumeUpdated);
    globalStateService.on('audioLevelsUpdated', handleAudioLevels);
    
    // MIDI events
    globalStateService.on('midiStateChanged', handleMIDIStateChange);
    globalStateService.on('mappingsChanged', handleMappingsChange);
    globalStateService.on('midiLearningCompleted', handleMIDILearningCompleted);
    globalStateService.on('midiLearningStopped', handleMIDILearningStopped);
    
    // Audio deck events
    audioDeckService.on('deckUpdated', handleDeckUpdated);
    audioDeckService.on('sourceAddedToDeck', handleSourceAddedToDeck);
    audioDeckService.on('sourceRemovedFromDeck', handleSourceRemovedFromDeck);
  };

  const cleanup = () => {
    // Remove event listeners
    globalStateService.off('obsStateChanged', handleOBSStateChange);
    globalStateService.off('sourcesDiscovered', handleSourcesDiscovered);
    globalStateService.off('sourceVolumeUpdated', handleVolumeUpdated);
    globalStateService.off('audioLevelsUpdated', handleAudioLevels);
    globalStateService.off('midiStateChanged', handleMIDIStateChange);
    globalStateService.off('mappingsChanged', handleMappingsChange);
    globalStateService.off('midiLearningCompleted', handleMIDILearningCompleted);
    globalStateService.off('midiLearningStopped', handleMIDILearningStopped);
    
    audioDeckService.off('deckUpdated', handleDeckUpdated);
    audioDeckService.off('sourceAddedToDeck', handleSourceAddedToDeck);
    audioDeckService.off('sourceRemovedFromDeck', handleSourceRemovedFromDeck);
  };

  // Event Handlers
  const handleOBSStateChange = useCallback((state) => {
    // Reduced logging - only log significant changes
    if (state.connected !== (connectionStatus === 'connected')) {
      console.log('AudioDeckWidget: OBS connection changed:', state.connected ? 'Connected' : 'Disconnected');
    }
    
    setConnectionStatus(state.connected ? 'connected' : 'disconnected');
    
    if (state.connected && state.sources) {
      const audioSources = filterAudioSources(state.sources);
      setAvailableSources(audioSources);
      
      // Update deck sources
      if (deck) {
        const deckSources = audioSources.filter(source => 
          deck.sources.includes(source.name)
        );
        setAudioSources(deckSources);
        updateWidgetStats(deckSources.length, audioSources.length);
      }
    }
    
    if (state.audioLevels) {
      setAudioLevels(state.audioLevels);
    }
    
    if (state.realTimeAudioLevels) {
      const levelsObj = {};
      if (state.realTimeAudioLevels instanceof Map) {
        state.realTimeAudioLevels.forEach((value, key) => {
          levelsObj[key] = value;
        });
      } else {
        Object.assign(levelsObj, state.realTimeAudioLevels);
      }
      setRealTimeAudioLevels(levelsObj);
    }
  }, [deck, connectionStatus]);

  const handleSourcesDiscovered = useCallback((sources) => {
    // Only log if source count significantly changed
    if (Math.abs(sources.length - availableSources.length) > 2) {
      console.log('AudioDeckWidget: Sources discovered:', sources.length);
    }
    
    const audioSources = filterAudioSources(sources);
    setAvailableSources(audioSources);
    
    if (deck) {
      const deckSources = audioSources.filter(source => 
        deck.sources.includes(source.name)
      );
      setAudioSources(deckSources);
      updateWidgetStats(deckSources.length, audioSources.length);
    }
  }, [deck, availableSources.length]);

  const handleVolumeUpdated = useCallback((data) => {
    if (draggedSlider !== data.sourceName && deck && deck.sources.includes(data.sourceName)) {
      setAudioSources(prev => prev.map(source => 
        source.name === data.sourceName 
          ? { ...source, volumeDb: data.volumeDb, volume: data.volume }
          : source
      ));
    }
  }, [draggedSlider, deck]);

  const handleAudioLevels = useCallback((data) => {
    // Throttle audio level updates - no console logging for performance
    if (!performanceMode || Math.random() < 0.3) {
      if (deck && deck.sources.includes(data.sourceName)) {
        setAudioLevels(prev => ({
          ...prev,
          [data.sourceName]: data.levels
        }));
      }
      
      if (data.allLevels) {
        setRealTimeAudioLevels(data.allLevels);
      }
    }
  }, [performanceMode, deck]);

  const handleMIDIStateChange = useCallback((newState) => {
    setLastMIDIMessage(newState.lastActivity);
  }, []);

  const handleMappingsChange = useCallback((data) => {
    if (data.type === 'audio') {
      setSourceMidiMappings(data.mappings);
    }
  }, []);

  const handleMIDILearningCompleted = useCallback((data) => {
    console.log('AudioDeckWidget: MIDI learning completed:', data);
    if (learningMidi) {
      const { sourceName, type } = learningMidi;
      const midiKey = data.message.note.toString();
      
      console.log(`AudioDeckWidget: Creating ${type} mapping for ${sourceName}: CC${midiKey}`);
      
      // WICHTIG: Stop learning IMMEDIATELY to prevent infinite loop
      setLearningMidi(null);
      globalStateService.stopMIDILearning();
      
      // Update local mappings
      setSourceMidiMappings(prev => ({
        ...prev,
        [sourceName]: {
          ...prev[sourceName],
          [type]: midiKey
        }
      }));
      
      // Save to global state
      globalStateService.setAudioSourceMapping(sourceName, type, midiKey);
      
      if (type === 'volume') {
        const mapping = {
          type: 'volume',
          target: sourceName,
          min: 0,
          max: 127
        };
        globalStateService.setMIDIMapping(midiKey, mapping, `AudioDeckWidget-${deckId}`);
      } else if (type === 'mute') {
        const mapping = {
          type: 'hotkey',
          action: 'mute',
          target: sourceName
        };
        globalStateService.setMIDIMapping(midiKey, mapping, `AudioDeckWidget-${deckId}`);
      }
      
      console.log(`✅ AudioDeckWidget: MIDI learning completed for ${sourceName} ${type}`);
    }
  }, [learningMidi, deckId]);

  const handleMIDILearningStopped = useCallback(() => {
    setLearningMidi(null);
  }, []);

  const handleDeckUpdated = useCallback((data) => {
    if (data.deck.id === deckId) {
      console.log('AudioDeckWidget: Deck updated:', data.deck);
      setDeck(data.deck);
      
      // Update component with new deck data
      if (onUpdate) {
        onUpdate({
          orientation: data.deck.orientation,
          showMeters: data.deck.showMeters,
          deckName: data.deck.name,
          deckColor: data.deck.color
        });
      }
    }
  }, [deckId, onUpdate]);

  const handleSourceAddedToDeck = useCallback((data) => {
    if (data.deckId === deckId) {
      console.log('AudioDeckWidget: Source added to deck:', data.sourceId);
      
      // Find the source in available sources and add to deck sources
      const sourceToAdd = availableSources.find(source => source.name === data.sourceId);
      if (sourceToAdd) {
        setAudioSources(prev => {
          if (!prev.find(s => s.name === data.sourceId)) {
            return [...prev, sourceToAdd];
          }
          return prev;
        });
        
        updateWidgetStats(audioSources.length + 1, availableSources.length);
      }
      
      setDeck(data.deck);
    }
  }, [deckId, availableSources, audioSources.length]);

  const handleSourceRemovedFromDeck = useCallback((data) => {
    if (data.deckId === deckId) {
      console.log('AudioDeckWidget: Source removed from deck:', data.sourceId);
      
      setAudioSources(prev => prev.filter(source => source.name !== data.sourceId));
      updateWidgetStats(audioSources.length - 1, availableSources.length);
      setDeck(data.deck);
    }
  }, [deckId, audioSources.length, availableSources.length]);

  // Utility functions
  const filterAudioSources = (sources) => {
    return sources.filter(source => {
      const kind = source.kind || source.inputKind || '';
      return kind.includes('audio') || 
             kind.includes('wasapi') || 
             kind.includes('pulse') ||
             kind === 'coreaudio_input_capture' ||
             kind === 'coreaudio_output_capture';
    });
  };

  const createVirtualSources = (deckData) => {
    // Create placeholder sources when OBS is not connected
    const virtualSources = deckData.sources.map(sourceName => ({
      name: sourceName,
      volumeDb: -10,
      muted: false,
      type: 'virtual',
      kind: 'virtual_audio'
    }));
    
    setAudioSources(virtualSources);
    updateWidgetStats(virtualSources.length, virtualSources.length);
  };

  const updateWidgetStats = (sourcesInDeck, totalSources) => {
    setWidgetStats({ sourcesInDeck, totalSources });
  };

  const getSourceIcon = (source) => {
    const sourceName = source.name.toLowerCase();
    
    for (const [key, Icon] of Object.entries(sourceIcons)) {
      if (sourceName.includes(key)) {
        return Icon;
      }
    }
    
    const sourceKind = (source.kind || '').toLowerCase();
    if (sourceKind.includes('input')) return Mic;
    if (sourceKind.includes('output')) return Speaker;
    
    return sourceIcons.default;
  };

  const getDeckColorClass = (color) => {
    const colorMap = {
      blue: 'text-blue-400 border-blue-500',
      green: 'text-green-400 border-green-500',
      purple: 'text-purple-400 border-purple-500',
      red: 'text-red-400 border-red-500',
      yellow: 'text-yellow-400 border-yellow-500',
      pink: 'text-pink-400 border-pink-500',
      cyan: 'text-cyan-400 border-cyan-500',
      orange: 'text-orange-400 border-orange-500'
    };
    return colorMap[color] || 'text-blue-400 border-blue-500';
  };

  // Control functions
  const handleVolumeChange = useCallback(async (sourceName, volumeDb) => {
    try {
      // Only log volume changes in debug mode or on errors
      await globalStateService.setVolume(sourceName, volumeDb, `AudioDeckWidget-${deckId}`);
    } catch (error) {
      console.error('AudioDeckWidget: Failed to set volume for', sourceName, ':', error);
    }
  }, [deckId]);

  const handleSliderStart = useCallback((sourceName) => {
    setDraggedSlider(sourceName);
  }, []);
  
  const handleSliderEnd = useCallback(() => {
    setDraggedSlider(null);
  }, []);

  const handleMuteToggle = useCallback(async (sourceName) => {
    try {
      // Only log mute toggles on errors
      await globalStateService.toggleMute(sourceName, `AudioDeckWidget-${deckId}`);
    } catch (error) {
      console.error('AudioDeckWidget: Failed to toggle mute for', sourceName, ':', error);
    }
  }, [deckId]);

  // MIDI Learning Functions
  const startMidiLearning = (sourceName, type) => {
    console.log(`AudioDeckWidget: Starting MIDI learning for ${sourceName} - ${type}`);
    
    // Stop any existing learning first
    if (learningMidi) {
      console.log('AudioDeckWidget: Stopping existing MIDI learning');
      globalStateService.stopMIDILearning();
    }
    
    setLearningMidi({ sourceName, type });
    
    // Add timeout to prevent infinite learning (30 seconds)
    const timeoutId = setTimeout(() => {
      console.log(`AudioDeckWidget: MIDI learning timeout for ${sourceName} ${type}`);
      setLearningMidi(null);
      globalStateService.stopMIDILearning();
    }, 30000);
    
    // Store timeout ID for cleanup
    setLearningMidi({ sourceName, type, timeoutId });
    
    const success = globalStateService.startMIDILearning(`AudioDeckWidget_${deckId}_${sourceName}_${type}`);
    if (!success) {
      console.error('AudioDeckWidget: Failed to start MIDI learning');
      clearTimeout(timeoutId);
      setLearningMidi(null);
    }
  };

  const stopMidiLearning = () => {
    console.log('AudioDeckWidget: Stopping MIDI learning');
    
    if (learningMidi?.timeoutId) {
      clearTimeout(learningMidi.timeoutId);
    }
    
    setLearningMidi(null);
    globalStateService.stopMIDILearning();
  };

  // Source management
  const addSourceToDeck = (sourceName) => {
    console.log('AudioDeckWidget: Adding source to deck:', sourceName, '→', deck?.name);
    audioDeckService.addSourceToDeck(sourceName, deckId);
  };

  const removeSourceFromDeck = (sourceName) => {
    console.log('AudioDeckWidget: Removing source from deck:', sourceName, '←', deck?.name);
    audioDeckService.removeSourceFromDeck(sourceName, deckId);
  };

  // Deck settings
  const updateDeckSettings = (updates) => {
    console.log('AudioDeckWidget: Updating deck settings for', deck?.name, ':', Object.keys(updates).join(', '));
    audioDeckService.updateAudioDeck(deckId, updates);
    
    // Update component settings
    if (onUpdate) {
      onUpdate(updates);
    }
  };

  // Rendering functions
  const renderVolumeSlider = (source) => {
    const volumeDb = source.volumeDb || -60;
    const levels = realTimeAudioLevels[source.name];
    const Icon = getSourceIcon(source);
    const isLearningVolume = learningMidi?.sourceName === source.name && learningMidi?.type === 'volume';
    const isLearningMute = learningMidi?.sourceName === source.name && learningMidi?.type === 'mute';
    const volumeMapping = sourceMidiMappings[source.name]?.volume;
    const muteMapping = sourceMidiMappings[source.name]?.mute;

    const removeMidiMapping = (type) => {
      const mapping = sourceMidiMappings[source.name]?.[type];
      if (mapping) {
        console.log(`AudioDeckWidget: Removing MIDI mapping for ${source.name} ${type}: ${mapping}`);
        globalStateService.removeMIDIMapping(mapping);
        
        setSourceMidiMappings(prev => ({
          ...prev,
          [source.name]: {
            ...prev[source.name],
            [type]: undefined
          }
        }));
      }
    };

    return (
      <div 
        key={source.name}
        className={`${compactMode ? 'p-2' : 'p-3'} bg-gray-700 rounded-lg border border-gray-600 ${
          orientation === 'horizontal' ? 'min-w-[120px]' : ''
        } transition-all hover:border-gray-500`}
      >
        {/* Source Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Icon className={`${compactMode ? 'w-3 h-3' : 'w-4 h-4'} ${getDeckColorClass(deck?.color || 'blue').split(' ')[0]}`} />
            <span className={`${compactMode ? 'text-xs' : 'text-sm'} font-medium text-white truncate`}>
              {source.name}
            </span>
          </div>
          
          {/* Mute Button */}
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
          
          {/* Remove from deck button (edit mode only) */}
          {editMode && (
            <button
              onClick={() => removeSourceFromDeck(source.name)}
              className="p-1 text-red-400 hover:text-red-300 transition-colors"
              title="Remove from deck"
            >
              <Minus className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* MIDI Learning Controls for Mute */}
        {!compactMode && (
          <div className="flex items-center space-x-1 mb-2">
            <button
              onClick={() => isLearningMute ? stopMidiLearning() : startMidiLearning(source.name, 'mute')}
              className={`px-1 py-0.5 text-xs rounded transition-colors ${
                isLearningMute 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : muteMapping
                    ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                    : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
              }`}
              title={isLearningMute ? 'Cancel MIDI learning' : 'Learn MIDI for mute'}
            >
              {isLearningMute ? 'Cancel' : muteMapping ? `CC${muteMapping}` : 'Learn'}
            </button>
            
            {muteMapping && !isLearningMute && (
              <button
                onClick={() => removeMidiMapping('mute')}
                className="px-1 py-0.5 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Remove MIDI mapping"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Volume Slider */}
        <div className="space-y-2">
          {/* MIDI Learning Controls for Volume */}
          {!compactMode && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">{volumeDb.toFixed(1)}dB</span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => isLearningVolume ? stopMidiLearning() : startMidiLearning(source.name, 'volume')}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    isLearningVolume 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : volumeMapping
                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                        : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                  }`}
                  title={isLearningVolume ? 'Cancel MIDI learning' : 'Learn MIDI for volume'}
                >
                  {isLearningVolume ? 'Cancel' : volumeMapping ? `CC${volumeMapping}` : 'Learn Vol'}
                </button>
                
                {volumeMapping && !isLearningVolume && (
                  <button
                    onClick={() => removeMidiMapping('volume')}
                    className="px-1 py-0.5 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    title="Remove MIDI mapping"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}
          
          <input
            type="range"
            min="-60"
            max="0"
            step="0.1"
            value={volumeDb}
            onChange={(e) => {
              const newVolumeDb = parseFloat(e.target.value);
              handleVolumeChange(source.name, newVolumeDb);
            }}
            onMouseDown={() => handleSliderStart(source.name)}
            onMouseUp={handleSliderEnd}
            onTouchStart={() => handleSliderStart(source.name)}
            onTouchEnd={handleSliderEnd}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
          />
          
          {!compactMode && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">{Math.round(((volumeDb + 60) / 60) * 100)}%</span>
            </div>
          )}
        </div>

        {/* Audio Level Meters - FIXED: Always show if enabled and has levels */}
        {showMeters && levels && (connectionStatus === 'connected' || levels.length > 0) && (
          <div className="mt-2">
            <AudioLevelMeter
              inputName={source.name}
              audioLevel={levels}
              isActive={connectionStatus === 'connected'}
              width={compactMode ? 100 : 150}
              height={compactMode ? 16 : 24}
              style="horizontal"
            />
          </div>
        )}

        {/* MIDI Learning Indicator */}
        {(learningMidi?.sourceName === source.name) && (
          <div className="mt-1 px-2 py-1 bg-blue-500 text-white text-xs rounded animate-pulse text-center">
            Learning MIDI...
          </div>
        )}
      </div>
    );
  };

  const renderSourceSelector = () => {
    if (!deck) return null;
    
    const unmappedSources = availableSources.filter(source => 
      !deck.sources.includes(source.name)
    );
    
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white">Available Sources</h4>
          <button
            onClick={() => {
              // Refresh OBS sources
              if (connectionStatus === 'connected') {
                globalStateService.discoverOBSDataWithCaching();
              }
            }}
            className="p-1 text-blue-400 hover:text-blue-300"
            title="Refresh sources"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        {/* Connection Status */}
        <div className="p-2 bg-gray-700 rounded border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">OBS Connection:</span>
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
              }`}></div>
              <span className={`text-xs ${
                connectionStatus === 'connected' ? 'text-green-400' : 'text-red-400'
              }`}>
                {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 mt-1">
            {availableSources.length} total sources • {deck.sources.length} in deck
          </div>
        </div>
        
        {/* Available Sources List */}
        {unmappedSources.length > 0 ? (
          <div>
            <div className="text-xs text-gray-400 mb-2">
              Sources not in deck ({unmappedSources.length})
            </div>
            <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
              {unmappedSources.map(source => {
                const Icon = getSourceIcon(source);
                return (
                  <button
                    key={source.name}
                    onClick={() => {
                      addSourceToDeck(source.name);
                      setShowSourceSelector(false);
                    }}
                    className="p-2 rounded border border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <Icon className="w-3 h-3" />
                      <span className="truncate">{source.name}</span>
                    </div>
                    <Plus className="w-3 h-3 text-green-400" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            {connectionStatus === 'connected' ? 
              'All available sources are in this deck' : 
              'Connect to OBS to see available sources'
            }
          </div>
        )}
      </div>
    );
  };

  const renderDeckSettings = () => {
    if (!deck) return null;
    
    return (
      <div className="space-y-4">
        {/* Deck Info */}
        <div>
          <label className="block text-xs font-medium text-white mb-2">Deck Name</label>
          <input
            type="text"
            value={deck.name}
            onChange={(e) => updateDeckSettings({ name: e.target.value })}
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            placeholder="Deck name"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-white mb-2">Description</label>
          <textarea
            value={deck.description || ''}
            onChange={(e) => updateDeckSettings({ description: e.target.value })}
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm resize-none"
            rows="2"
            placeholder="Deck description"
          />
        </div>
        
        {/* Deck Color */}
        <div>
          <label className="block text-xs font-medium text-white mb-2">Deck Color</label>
          <div className="grid grid-cols-4 gap-2">
            {deckColorOptions.map(colorOption => (
              <button
                key={colorOption.value}
                onClick={() => updateDeckSettings({ color: colorOption.value })}
                className={`p-2 rounded border text-xs transition-colors ${
                  deck.color === colorOption.value
                    ? `border-${colorOption.value}-500 bg-${colorOption.value}-500/20`
                    : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                } ${colorOption.class}`}
              >
                {colorOption.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Layout Options */}
        <div>
          <label className="block text-xs font-medium text-white mb-2">Layout</label>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Orientation</label>
              <select
                value={deck.orientation || 'vertical'}
                onChange={(e) => {
                  const newOrientation = e.target.value;
                  updateDeckSettings({ orientation: newOrientation });
                  setOrientation(newOrientation);
                }}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
              >
                <option value="vertical">Vertical</option>
                <option value="horizontal">Horizontal</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Options */}
        <div className="border-t border-gray-700 pt-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={deck.showMeters !== false}
              onChange={(e) => {
                const newShowMeters = e.target.checked;
                updateDeckSettings({ showMeters: newShowMeters });
                setShowMeters(newShowMeters);
              }}
              className="rounded border-gray-500"
            />
            <span className="text-sm text-white">Show Level Meters</span>
          </label>
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
          className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg p-3 z-50 max-w-sm shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-medium text-white">Audio Deck Settings</h5>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
            
            {/* Deck Settings */}
            {renderDeckSettings()}
            
            {/* Source Management */}
            <div className="border-t border-gray-700 pt-3">
              <div className="flex items-center justify-between mb-2">
                <h6 className="text-xs font-medium text-white">Source Management</h6>
                <button
                  onClick={() => setShowSourceSelector(!showSourceSelector)}
                  className="px-2 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors"
                >
                  {showSourceSelector ? 'Hide' : 'Add Sources'}
                </button>
              </div>
              
              {showSourceSelector && renderSourceSelector()}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (loadingState === 'loading') {
    return (
      <div className="h-full flex items-center justify-center bg-gray-800 border border-gray-700 rounded-lg">
        <div className="text-center text-gray-400">
          <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />
          <div className="text-sm">Loading Audio Deck...</div>
        </div>
      </div>
    );
  }

  if (loadingState === 'error' || !deck) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-800 border border-red-600 rounded-lg">
        <div className="text-center text-red-400">
          <Volume2 className="w-6 h-6 mx-auto mb-2" />
          <div className="text-sm">Audio Deck Error</div>
          <div className="text-xs text-gray-500 mt-1">Deck "{deckId}" not found</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={widgetRef}
      className="h-full flex flex-col bg-gray-800 border border-gray-700 rounded-lg overflow-hidden relative"
    >
      {/* Widget Header */}
      <div className={`flex items-center justify-between p-3 border-b border-gray-700 bg-gray-750 ${getDeckColorClass(deck.color).split(' ')[1]}`}>
        <div className="flex items-center space-x-2">
          <Volume2 className={`w-4 h-4 ${getDeckColorClass(deck.color).split(' ')[0]}`} />
          <h3 className="text-sm font-medium text-white">{deck.name}</h3>
          <span className="text-xs text-gray-400">({widgetStats.sourcesInDeck})</span>
          
          {/* Loading Indicator */}
          {loadingState === 'loading' && (
            <div className="flex items-center space-x-1 text-blue-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span className="text-xs">Loading...</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          {/* Connection Status */}
          <div className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
          }`} title={`OBS ${connectionStatus}`}></div>
          
          <button
            onClick={() => {
              const newShowMeters = !showMeters;
              setShowMeters(newShowMeters);
              updateDeckSettings({ showMeters: newShowMeters });
            }}
            className={`p-1 rounded transition-colors ${
              showMeters ? 'text-green-400' : 'text-gray-400 hover:text-white'
            }`}
            title="Toggle Level Meters"
          >
            <BarChart3 className="w-3 h-3" />
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1 rounded transition-colors ${
              showSettings ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
            title="Settings"
          >
            <Settings className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* MIDI Activity Monitor */}
      {lastMIDIMessage && !compactMode && (
        <div className="mx-3 mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-400 font-medium">MIDI Activity</span>
            <span className="text-xs text-gray-400">
              {new Date(lastMIDIMessage.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-xs text-blue-300 mt-1">
            {lastMIDIMessage.type} - CC/Note: {lastMIDIMessage.note} - Value: {lastMIDIMessage.velocity}
            {lastMIDIMessage.mock && ' (Keyboard Simulation)'}
          </div>
        </div>
      )}

      {/* Widget Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {audioSources.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <div className="text-center">
              <Volume2 className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <div>No audio sources in this deck</div>
              <div className="text-xs mt-1">
                {connectionStatus === 'connected' 
                  ? 'Add sources from settings' 
                  : 'Connect OBS to see sources'
                }
              </div>
              <button
                onClick={() => setShowSettings(true)}
                className="mt-2 px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Sources</span>
              </button>
            </div>
          </div>
        ) : (
          <div className={`${
            orientation === 'horizontal' 
              ? 'flex space-x-2 overflow-x-auto' 
              : 'space-y-2'
          }`}>
            {audioSources.map(source => renderVolumeSlider(source))}
          </div>
        )}
      </div>

      {/* Status Footer */}
      <div className="border-t border-gray-700 px-3 py-2 bg-gray-750">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            OBS: {connectionStatus === 'connected' ? (
              <span className="text-green-400">Connected • {widgetStats.totalSources} sources</span>
            ) : (
              <span className="text-red-400">Disconnected</span>
            )}
          </span>
          <div className="flex items-center space-x-3">
            {performanceMode && <span className="text-yellow-400">⚡ Performance</span>}
            <span className="text-gray-400">{widgetStats.sourcesInDeck} of {widgetStats.totalSources}</span>
            {loadingState === 'error' && <span className="text-red-400">⚠️ Error</span>}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {renderSettings()}

      {/* Custom Styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          border: 2px solid #064e3b;
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          border: 2px solid #064e3b;
        }
      `}</style>
    </div>
  );
};

export default AudioDeckWidget;
