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
  RefreshCw,
  Plus,
  Layout
} from 'lucide-react';
import globalStateService from '../../services/globalStateService';
import AudioLevelMeter from '../AudioLevelMeter';

const UnifiedAudioMixerWidget = ({ component, editMode, onUpdate, onRemove, performanceMode }) => {
  const [audioSources, setAudioSources] = useState([]);
  const [audioLevels, setAudioLevels] = useState({});
  const [realTimeAudioLevels, setRealTimeAudioLevels] = useState({});
  const [visibleSources, setVisibleSources] = useState(component.sources || []);
  const [compactMode, setCompactMode] = useState(component.size?.width < 200);
  const [showMeters, setShowMeters] = useState(component.showMeters !== false);
  const [showSettings, setShowSettings] = useState(false);
  const [orientation, setOrientation] = useState(component.orientation || 'vertical');
  const [sliderSize, setSliderSize] = useState(component.sliderSize || 'medium');
  const [showContextMenu, setShowContextMenu] = useState(null);
  const [loadingState, setLoadingState] = useState('idle');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastMIDIMessage, setLastMIDIMessage] = useState(null);
  const [learningMidi, setLearningMidi] = useState(null);
  const [sourceMidiMappings, setSourceMidiMappings] = useState({});
  const [draggedSlider, setDraggedSlider] = useState(null);
  
  const widgetRef = useRef(null);
  const refreshInterval = useRef(null);

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

  // Available source types for selection
  const availableSourceTypes = [
    { key: 'master', name: 'Master Volume', icon: Speaker },
    { key: 'mic', name: 'Microphone', icon: Mic },
    { key: 'desktop', name: 'Desktop Audio', icon: Monitor },
    { key: 'game', name: 'Game Audio', icon: Gamepad2 },
    { key: 'music', name: 'Music Player', icon: Music },
    { key: 'discord', name: 'Discord', icon: Volume2 },
    { key: 'browser', name: 'Browser', icon: Monitor },
    { key: 'alert', name: 'Alerts', icon: Bell }
  ];

  // Save visible sources to localStorage
  const saveVisibleSourcesToLocalStorage = (sources) => {
    try {
      localStorage.setItem('unifiedAudioMixerVisibleSources', JSON.stringify(sources));
      console.log('UnifiedAudioMixerWidget: Saved visible sources to localStorage:', sources);
    } catch (error) {
      console.error('UnifiedAudioMixerWidget: Failed to save to localStorage:', error);
    }
  };

  // Load visible sources from localStorage
  const loadVisibleSourcesFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem('unifiedAudioMixerVisibleSources');
      if (stored) {
        const sources = JSON.parse(stored);
        console.log('UnifiedAudioMixerWidget: Loaded visible sources from localStorage:', sources);
        return sources;
      }
    } catch (error) {
      console.error('UnifiedAudioMixerWidget: Failed to load from localStorage:', error);
    }
    return [];
  };

  useEffect(() => {
    console.log('UnifiedAudioMixerWidget: Initializing...');
    
    // Load from localStorage first
    const savedSources = loadVisibleSourcesFromLocalStorage();
    if (savedSources.length > 0) {
      setVisibleSources(savedSources);
    }
    
    // Widget registration
    globalStateService.registerDashboardWidget(
      `audio-mixer-${component.id}`, 
      'audio-mixer', 
      { sources: savedSources, orientation, showMeters }
    );
    
    initializeAudioSources();
    setupEventListeners();
    
    // Auto-refresh interval for OBS connection (if not in performance mode)
    if (!performanceMode) {
      refreshInterval.current = setInterval(() => {
        refreshAudioSources();
      }, 10000); // Every 10 seconds
    }

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    setCompactMode(component.size?.width < 200);
  }, [component.size]);

  const cleanup = () => {
    globalStateService.unregisterDashboardWidget(`audio-mixer-${component.id}`);
    
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }
    
    // Remove event listeners
    globalStateService.off('audioLevelsUpdated', handleAudioLevels);
    globalStateService.off('sourcesDiscovered', handleSourcesUpdated);
    globalStateService.off('obsStateChanged', handleOBSStateChange);
    globalStateService.off('sourceVolumeUpdated', handleVolumeUpdated);
    globalStateService.off('midiStateChanged', handleMIDIStateChange);
    globalStateService.off('mappingsChanged', handleMappingsChange);
    globalStateService.off('midiLearningCompleted', handleMIDILearningCompleted);
    globalStateService.off('midiLearningStopped', handleMIDILearningStopped);
  };

  const setupEventListeners = () => {
    console.log('UnifiedAudioMixerWidget: Setting up event listeners...');
    
    globalStateService.on('audioLevelsUpdated', handleAudioLevels);
    globalStateService.on('sourcesDiscovered', handleSourcesUpdated);
    globalStateService.on('obsStateChanged', handleOBSStateChange);
    globalStateService.on('sourceVolumeUpdated', handleVolumeUpdated);
    globalStateService.on('midiStateChanged', handleMIDIStateChange);
    globalStateService.on('mappingsChanged', handleMappingsChange);
    globalStateService.on('midiLearningCompleted', handleMIDILearningCompleted);
    globalStateService.on('midiLearningStopped', handleMIDILearningStopped);
  };

  const initializeAudioSources = async () => {
    setLoadingState('loading');
    
    try {
      console.log('UnifiedAudioMixerWidget: Loading initial state...');
      
      // Load initial state from GlobalStateService
      const obsState = globalStateService.getOBSState();
      const midiState = globalStateService.getMIDIState();
      const audioMappings = globalStateService.getAudioSourceMappings();
      
      setConnectionStatus(obsState.connected ? 'connected' : 'disconnected');
      setLastMIDIMessage(midiState.lastActivity);
      setSourceMidiMappings(audioMappings);
      
      console.log('UnifiedAudioMixerWidget: Initial state loaded:', {
        obsConnected: obsState.connected,
        sourcesCount: obsState.sources.length,
        midiConnected: midiState.connected,
        mappingsCount: Object.keys(audioMappings).length
      });
      
      if (obsState.connected) {
        // Get audio sources from service
        const sources = globalStateService.getAudioSourcesForMixer();
        console.log('UnifiedAudioMixerWidget: Loaded', sources.length, 'audio sources');
        
        if (sources.length > 0) {
          setAudioSources(sources);
          setLoadingState('success');
          
          // Auto-initialize visible sources if none are set
          if (visibleSources.length === 0) {
            console.log('UnifiedAudioMixerWidget: Auto-initializing visible sources');
            const allSourceNames = sources.map(s => s.name);
            setVisibleSources(allSourceNames);
            saveVisibleSourcesToLocalStorage(allSourceNames);
          }
        } else {
          // Trigger discovery if no sources found
          console.log('UnifiedAudioMixerWidget: No sources found, triggering discovery...');
          await globalStateService.discoverOBSDataWithCaching();
          
          setTimeout(() => {
            const newSources = globalStateService.getAudioSourcesForMixer();
            console.log('UnifiedAudioMixerWidget: After discovery:', newSources.length, 'sources');
            
            if (newSources.length > 0) {
              setAudioSources(newSources);
              setLoadingState('success');
              
              // Auto-mapping of OBS source names
              const autoMappedSources = autoMapOBSSourceNames(newSources);
              if (autoMappedSources.length > 0) {
                console.log('UnifiedAudioMixerWidget: Auto-mapped sources:', autoMappedSources);
                setVisibleSources(autoMappedSources);
                saveVisibleSourcesToLocalStorage(autoMappedSources);
              }
            } else {
              setLoadingState('idle');
            }
          }, 2000);
        }
      } else {
        console.log('UnifiedAudioMixerWidget: OBS not connected, using default sources');
        createDefaultAudioSources();
        setLoadingState('idle');
      }
      
      // Load initial audio levels
      const levels = globalStateService.getAllAudioLevels();
      setAudioLevels(levels);
      setRealTimeAudioLevels(levels);
      
    } catch (error) {
      console.error('UnifiedAudioMixerWidget: Failed to initialize audio sources:', error);
      setLoadingState('error');
      createDefaultAudioSources();
    }
  };

  const createDefaultAudioSources = () => {
    console.log('UnifiedAudioMixerWidget: Creating default sources...');
    
    const defaultSources = [
      { name: 'master', volumeDb: -10, muted: false, type: 'master', kind: 'audio_output' },
      { name: 'mic', volumeDb: -15, muted: false, type: 'input', kind: 'audio_input' },
      { name: 'desktop', volumeDb: -12, muted: false, type: 'output', kind: 'audio_output' }
    ];
    
    setAudioSources(defaultSources);
    setLoadingState('success');
  };

  const refreshAudioSources = async () => {
    console.log('UnifiedAudioMixerWidget: Refreshing audio sources...');
    setLoadingState('loading');
    
    try {
      if (globalStateService.isOBSConnected()) {
        // Force discovery refresh
        await globalStateService.discoverOBSDataWithCaching();
        
        // Get fresh sources
        const sources = globalStateService.getAudioSourcesForMixer();
        setAudioSources(sources);
        setConnectionStatus('connected');
        setLoadingState('success');
        
        console.log('UnifiedAudioMixerWidget: Refreshed', sources.length, 'audio sources');
      } else {
        setConnectionStatus('disconnected');
        setLoadingState('idle');
      }
    } catch (error) {
      console.error('UnifiedAudioMixerWidget: Failed to refresh sources:', error);
      setLoadingState('error');
    }
  };

  // Event Handlers
  const handleAudioLevels = useCallback((data) => {
    if (!performanceMode || Math.random() < 0.3) {
      setAudioLevels(prev => ({
        ...prev,
        [data.sourceName]: data.levels
      }));
      
      if (data.allLevels) {
        setRealTimeAudioLevels(data.allLevels);
      }
    }
  }, [performanceMode]);

  const handleSourcesUpdated = useCallback((sources) => {
    console.log('UnifiedAudioMixerWidget: Sources updated:', sources.length);
    
    // Filter for audio sources
    const audioSources = sources.filter(source => {
      const kind = source.kind || source.inputKind || '';
      return kind.includes('audio') || 
             kind.includes('wasapi') || 
             kind.includes('pulse') ||
             kind === 'coreaudio_input_capture' ||
             kind === 'coreaudio_output_capture';
    });
    
    console.log('UnifiedAudioMixerWidget: Setting', audioSources.length, 'audio sources');
    
    setAudioSources(audioSources);
    setConnectionStatus('connected');
    setLoadingState('success');
  }, []);

  const handleOBSStateChange = useCallback((state) => {
    console.log('UnifiedAudioMixerWidget: OBS State Change:', { connected: state.connected, sourcesCount: state.sources?.length });
    
    setConnectionStatus(state.connected ? 'connected' : 'disconnected');
    
    if (state.sources) {
      const audioSources = state.sources.filter(source => {
        const kind = source.kind || source.inputKind || '';
        return kind.includes('audio') ||
               kind.includes('wasapi') ||
               kind.includes('pulse') ||
               kind === 'coreaudio_input_capture' ||
               kind === 'coreaudio_output_capture';
      });
      
      console.log('UnifiedAudioMixerWidget: Filtered', audioSources.length, 'audio sources from OBS state');
      setAudioSources(audioSources);
      
      if (audioSources.length > 0) {
        setLoadingState('success');
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
  }, []);

  const handleVolumeUpdated = useCallback((data) => {
    console.log('UnifiedAudioMixerWidget: Volume updated:', data.sourceName, data.volumeDb);
    
    if (draggedSlider !== data.sourceName) {
      // Update local source data
      setAudioSources(prev => prev.map(source => 
        source.name === data.sourceName 
          ? { ...source, volumeDb: data.volumeDb, volume: data.volume }
          : source
      ));
    }
  }, [draggedSlider]);

  const handleMIDIStateChange = useCallback((newState) => {
    console.log('UnifiedAudioMixerWidget: MIDI state changed:', newState);
    setLastMIDIMessage(newState.lastActivity);
  }, []);

  const handleMappingsChange = useCallback((data) => {
    if (data.type === 'audio') {
      console.log('UnifiedAudioMixerWidget: Audio mappings changed:', data.mappings);
      setSourceMidiMappings(data.mappings);
    }
  }, []);

  const handleMIDILearningCompleted = useCallback((data) => {
    console.log('UnifiedAudioMixerWidget: MIDI learning completed:', data);
    if (learningMidi) {
      const { sourceName, type } = learningMidi;
      const midiKey = data.message.note.toString();
      
      console.log(`UnifiedAudioMixerWidget: Creating ${type} mapping for ${sourceName}: CC${midiKey}`);
      
      setSourceMidiMappings(prev => ({
        ...prev,
        [sourceName]: {
          ...prev[sourceName],
          [type]: midiKey
        }
      }));
      
      globalStateService.setAudioSourceMapping(sourceName, type, midiKey);
      
      if (type === 'volume') {
        const mapping = {
          type: 'volume',
          target: sourceName,
          min: 0,
          max: 127
        };
        globalStateService.setMIDIMapping(midiKey, mapping, 'UnifiedAudioMixerWidget');
      } else if (type === 'mute') {
        const mapping = {
          type: 'hotkey',
          action: 'mute',
          target: sourceName
        };
        globalStateService.setMIDIMapping(midiKey, mapping, 'UnifiedAudioMixerWidget');
      }
      
      setLearningMidi(null);
    }
  }, [learningMidi]);

  const handleMIDILearningStopped = useCallback(() => {
    console.log('UnifiedAudioMixerWidget: MIDI learning stopped');
    setLearningMidi(null);
  }, []);

  // MIDI Learning Functions
  const startMidiLearning = (sourceName, type) => {
    console.log(`UnifiedAudioMixerWidget: Starting MIDI learning for ${sourceName} - ${type}`);
    setLearningMidi({ sourceName, type });
    
    const success = globalStateService.startMIDILearning(`UnifiedAudioMixerWidget_${sourceName}_${type}`);
    if (!success) {
      console.error('UnifiedAudioMixerWidget: Failed to start MIDI learning');
      setLearningMidi(null);
    }
  };

  const stopMidiLearning = () => {
    console.log('UnifiedAudioMixerWidget: Stopping MIDI learning');
    setLearningMidi(null);
    globalStateService.stopMIDILearning();
  };

  // Volume Control Methods
  const handleVolumeChange = useCallback(async (sourceName, volumeDb) => {
    try {
      console.log('UnifiedAudioMixerWidget: Setting volume for', sourceName, 'to', volumeDb, 'dB');
      await globalStateService.setVolume(sourceName, volumeDb, 'UnifiedAudioMixerWidget');
    } catch (error) {
      console.error('UnifiedAudioMixerWidget: Failed to set volume:', error);
    }
  }, []);

  const handleSliderStart = useCallback((sourceName) => {
    setDraggedSlider(sourceName);
  }, []);
  
  const handleSliderEnd = useCallback(() => {
    setDraggedSlider(null);
  }, []);

  const handleMuteToggle = useCallback(async (sourceName) => {
    try {
      console.log('UnifiedAudioMixerWidget: Toggling mute for', sourceName);
      await globalStateService.toggleMute(sourceName, 'UnifiedAudioMixerWidget');
    } catch (error) {
      console.error('UnifiedAudioMixerWidget: Failed to toggle mute:', error);
    }
  }, []);

  // Source visibility functions
  const toggleSourceVisibility = (sourceName) => {
    console.log('UnifiedAudioMixerWidget: Toggling source visibility:', sourceName);
    
    const newVisible = visibleSources.includes(sourceName)
      ? visibleSources.filter(s => s !== sourceName)
      : [...visibleSources, sourceName];
    
    console.log('UnifiedAudioMixerWidget: Visibility change:', { sourceName, wasVisible: visibleSources.includes(sourceName), newVisible });
    
    setVisibleSources(newVisible);
    saveVisibleSourcesToLocalStorage(newVisible);
    
    if (onUpdate) {
      onUpdate({ sources: newVisible });
    }
    
    console.log('UnifiedAudioMixerWidget: Source visibility toggled:', sourceName, 'visible:', !visibleSources.includes(sourceName));
  };

  const addCustomSource = (sourceType) => {
    console.log('UnifiedAudioMixerWidget: Adding custom source:', sourceType);
    
    if (!visibleSources.includes(sourceType)) {
      const newVisible = [...visibleSources, sourceType];
      
      setVisibleSources(newVisible);
      saveVisibleSourcesToLocalStorage(newVisible);
      
      if (onUpdate) {
        onUpdate({ sources: newVisible });
      }
      
      // Add to audio sources if not from OBS
      const existsInOBS = audioSources.some(s => s.name === sourceType);
      if (!existsInOBS) {
        const newSource = {
          name: sourceType,
          volumeDb: -10,
          muted: false,
          type: sourceType === 'mic' ? 'input' : 'output',
          kind: 'virtual_audio'
        };
        setAudioSources(prev => [...prev, newSource]);
      }
      
      console.log('UnifiedAudioMixerWidget: Added custom source:', sourceType);
    }
  };

  // Intelligent OBS source name mapping
  const autoMapOBSSourceNames = (obsSourcesArray) => {
    console.log('UnifiedAudioMixerWidget: Starting intelligent source name mapping...');
    
    const mappings = [];
    
    obsSourcesArray.forEach(source => {
      const sourceName = source.name.toLowerCase();
      const sourceKind = source.kind || '';
      
      console.log('UnifiedAudioMixerWidget: Analyzing source:', source.name, 'kind:', sourceKind);
      
      // Desktop Audio detection
      if (sourceName.includes('desktop') || 
          sourceName.includes('speaker') || 
          sourceName.includes('system') ||
          sourceName.includes('computer') ||
          sourceKind.includes('wasapi_output') ||
          sourceKind.includes('coreaudio_output')) {
        mappings.push(source.name);
        console.log('UnifiedAudioMixerWidget: Auto-mapped Desktop Audio ->', source.name);
      }
      // Microphone detection
      else if (sourceName.includes('mic') || 
               sourceName.includes('microphone') ||
               sourceKind.includes('wasapi_input') ||
               sourceKind.includes('coreaudio_input') ||
               sourceKind.includes('dshow_input')) {
        mappings.push(source.name);
        console.log('UnifiedAudioMixerWidget: Auto-mapped Microphone ->', source.name);
      }
      // Everything else (we want to see all sources)
      else {
        mappings.push(source.name);
        console.log('UnifiedAudioMixerWidget: Auto-mapped Other Audio ->', source.name);
      }
    });
    
    console.log('UnifiedAudioMixerWidget: Auto-mapping complete:', mappings.length, 'sources mapped');
    return mappings;
  };

  // Utility methods
  const getVolumeFromDb = (volumeDb) => {
    if (volumeDb <= -60) return 0;
    return Math.round(((volumeDb + 60) / 60) * 100);
  };

  const getDbFromVolume = (volume) => {
    if (volume <= 0) return -60;
    return (volume / 100) * 60 - 60;
  };

  const getVisibleAudioSources = () => {
    const filtered = audioSources.filter(source => {
      return visibleSources.includes(source.name);
    });
    
    console.log('UnifiedAudioMixerWidget: Visible audio sources:', filtered.length, 'of', audioSources.length);
    return filtered;
  };

  const getSourceIcon = (source) => {
    // Try to get icon from sourceIcons mapping first
    if (sourceIcons[source.name]) {
      return sourceIcons[source.name];
    }
    
    // Fallback to kind-based detection
    const sourceKind = source.kind || source.inputKind || '';
    if (sourceKind.includes('input') || sourceKind.includes('mic')) {
      return Mic;
    } else if (sourceKind.includes('output') || sourceKind.includes('desktop')) {
      return Monitor;
    } else {
      return Volume2;
    }
  };

  // Context Menu Handling
  const handleContextMenu = (e, source = null) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any existing dashboard context menu
    globalStateService.clearActiveContextMenu();
    
    const menuData = {
      x: e.clientX,
      y: e.clientY,
      source: source,
      timestamp: Date.now()
    };
    
    setShowContextMenu(menuData);
    
    if (source) {
      console.log('UnifiedAudioMixerWidget: Source context menu:', source.name);
      globalStateService.setActiveContextMenu('audioMixerSource', menuData);
    } else {
      console.log('UnifiedAudioMixerWidget: Widget context menu');
      globalStateService.setActiveContextMenu('audioMixerWidget', menuData);
    }
  };

  // Click Outside Handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) {
        setShowSettings(false);
        setShowContextMenu(null);
        globalStateService.clearActiveContextMenu();
      }
    };

    if (showSettings || showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSettings, showContextMenu]);

  // Render Methods
  const renderVolumeSlider = (source) => {
    const volumeDb = source.volumeDb || -60;
    const volume = getVolumeFromDb(volumeDb);
    const levels = realTimeAudioLevels[source.name];
    const Icon = getSourceIcon(source);
    const isLearningVolume = learningMidi?.sourceName === source.name && learningMidi?.type === 'volume';
    const isLearningMute = learningMidi?.sourceName === source.name && learningMidi?.type === 'mute';
    const volumeMapping = sourceMidiMappings[source.name]?.volume;
    const muteMapping = sourceMidiMappings[source.name]?.mute;

    const removeMidiMapping = (type) => {
      const mapping = sourceMidiMappings[source.name]?.[type];
      if (mapping) {
        console.log(`UnifiedAudioMixerWidget: Removing MIDI mapping for ${source.name} ${type}: ${mapping}`);
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
        className={`${compactMode ? 'p-2' : 'p-3'} bg-gray-700 rounded-lg border border-gray-600 ${orientation === 'horizontal' ? 'min-w-[120px]' : ''} transition-all hover:border-gray-500`}
        onContextMenu={(e) => handleContextMenu(e, source)}
      >
        {/* Source Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Icon className={`${compactMode ? 'w-3 h-3' : 'w-4 h-4'} text-green-400`} />
            <span className={`${compactMode ? 'text-xs' : 'text-sm'} font-medium text-white truncate`}>
              {sourceNames[source.name] || source.name}
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
              <span className="text-gray-400">{volume}%</span>
            </div>
          )}
        </div>

        {/* Audio Level Meters */}
        {showMeters && levels && !performanceMode && (
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
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-white">Audio Sources</h4>
          <button
            onClick={refreshAudioSources}
            disabled={loadingState === 'loading'}
            className="p-1 text-blue-400 hover:text-blue-300 disabled:opacity-50"
            title="Refresh OBS sources"
          >
            <RefreshCw className={`w-4 h-4 ${loadingState === 'loading' ? 'animate-spin' : ''}`} />
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
          
          {loadingState === 'loading' && (
            <div className="text-xs text-blue-400 mt-1">
              Discovering audio sources...
            </div>
          )}
          
          {loadingState === 'error' && (
            <div className="text-xs text-red-400 mt-1">
              Failed to load sources
            </div>
          )}
          
          {connectionStatus === 'disconnected' && (
            <p className="text-xs text-gray-500 mt-1">
              Connect to OBS to see real audio sources
            </p>
          )}
        </div>
        
        {/* OBS Sources */}
        {audioSources.length > 0 && (
          <div>
            <div className="text-xs text-gray-400 mb-2">
              OBS Audio Sources ({audioSources.length})
            </div>
            <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
              {audioSources.map(source => {
                const isVisible = visibleSources.includes(source.name);
                return (
                  <button
                    key={source.name}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSourceVisibility(source.name);
                    }}
                    className={`p-2 rounded border text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isVisible
                        ? 'border-green-500 bg-green-500/20 text-green-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <span className="truncate">{source.name}</span>
                    {isVisible && <span className="text-green-400 ml-2">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Virtual Sources */}
        <div>
          <div className="text-xs text-gray-400 mb-2">
            Virtual Audio Sources
          </div>
          <div className="grid grid-cols-2 gap-2">
            {availableSourceTypes.map(sourceType => {
              const isVisible = visibleSources.includes(sourceType.key);
              const Icon = sourceType.icon;

              return (
                <button
                  key={sourceType.key}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addCustomSource(sourceType.key);
                  }}
                  className={`p-2 rounded border text-xs flex items-center space-x-2 transition-colors cursor-pointer ${
                    isVisible
                      ? 'border-green-500 bg-green-500/20 text-green-400'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span className="flex-1 truncate">{sourceType.name}</span>
                  {isVisible && <span className="text-green-400">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Close Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowSettings(false);
          }}
          className="w-full px-3 py-2 bg-gray-600 text-gray-300 hover:bg-gray-500 rounded text-xs transition-colors"
        >
          Done
        </button>
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
              <h5 className="text-sm font-medium text-white">Audio Mixer Settings</h5>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSettings(false);
                }}
                className="text-gray-400 hover:text-white text-lg leading-none"
              >
                ×
              </button>
            </div>
            
            {/* Layout Options */}
            <div>
              <h6 className="text-xs font-medium text-white mb-2">Layout</h6>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Orientation</label>
                  <select
                    value={orientation}
                    onChange={(e) => {
                      setOrientation(e.target.value);
                      onUpdate({ orientation: e.target.value });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  >
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Slider Size</label>
                  <select
                    value={sliderSize}
                    onChange={(e) => {
                      setSliderSize(e.target.value);
                      onUpdate({ sliderSize: e.target.value });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Source Management */}
            {renderSourceSelector()}
            
            {/* Options */}
            <div className="border-t border-gray-700 pt-3">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showMeters}
                  onChange={(e) => {
                    setShowMeters(e.target.checked);
                    onUpdate({ showMeters: e.target.checked });
                  }}
                  onClick={(e) => e.stopPropagation()}
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

  const renderContextMenu = () => (
    <AnimatePresence>
      {showContextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-2 min-w-[150px]"
          style={{ left: showContextMenu.x, top: showContextMenu.y }}
          onMouseLeave={() => {
            setShowContextMenu(null);
            globalStateService.clearActiveContextMenu();
          }}
        >
          {showContextMenu.source ? (
            // Source context menu
            <>
              <button
                onClick={() => {
                  toggleSourceVisibility(showContextMenu.source.name);
                  setShowContextMenu(null);
                  globalStateService.clearActiveContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
              >
                <EyeOff className="w-4 h-4" />
                <span>Hide Source</span>
              </button>
              
              <button
                onClick={() => {
                  handleMuteToggle(showContextMenu.source.name);
                  setShowContextMenu(null);
                  globalStateService.clearActiveContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
              >
                {showContextMenu.source.muted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{showContextMenu.source.muted ? 'Unmute' : 'Mute'}</span>
              </button>
              
              <div className="border-t border-gray-600 my-1"></div>
              
              <button
                onClick={() => {
                  handleVolumeChange(showContextMenu.source.name, 0);
                  setShowContextMenu(null);
                  globalStateService.clearActiveContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>Reset Volume</span>
              </button>
            </>
          ) : (
            // Widget context menu
            <>
              <button
                onClick={() => {
                  setShowSettings(true);
                  setShowContextMenu(null);
                  globalStateService.clearActiveContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
              >
                <Settings className="w-4 h-4" />
                <span>Widget Settings</span>
              </button>
              
              <button
                onClick={() => {
                  setShowMeters(!showMeters);
                  onUpdate({ showMeters: !showMeters });
                  setShowContextMenu(null);
                  globalStateService.clearActiveContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
              >
                <BarChart3 className="w-4 h-4" />
                <span>{showMeters ? 'Hide' : 'Show'} Level Meters</span>
              </button>
              
              <div className="border-t border-gray-600 my-1"></div>
              
              <button
                onClick={() => {
                  refreshAudioSources();
                  setShowContextMenu(null);
                  globalStateService.clearActiveContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Sources</span>
              </button>
              
              <button
                onClick={() => {
                  setOrientation(orientation === 'vertical' ? 'horizontal' : 'vertical');
                  onUpdate({ orientation: orientation === 'vertical' ? 'horizontal' : 'vertical' });
                  setShowContextMenu(null);
                  globalStateService.clearActiveContextMenu();
                }}
                className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
              >
                <Layout className="w-4 h-4" />
                <span>Switch to {orientation === 'vertical' ? 'Horizontal' : 'Vertical'}</span>
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const visibleAudioSources = getVisibleAudioSources();

  return (
    <div 
      ref={widgetRef}
      className="h-full flex flex-col bg-gray-800 border border-gray-700 rounded-lg overflow-hidden relative"
      onContextMenu={(e) => {
        if (editMode) {
          e.preventDefault();
          e.stopPropagation();
          handleContextMenu(e, null);
        }
      }}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-750">
        <div className="flex items-center space-x-2">
          <Volume2 className="w-4 h-4 text-green-400" />
          <h3 className="text-sm font-medium text-white">Audio Mixer</h3>
          <span className="text-xs text-gray-400">({visibleAudioSources.length})</span>
          
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMeters(!showMeters);
              onUpdate({ showMeters: !showMeters });
            }}
            className={`p-1 rounded transition-colors ${
              showMeters ? 'text-green-400' : 'text-gray-400 hover:text-white'
            }`}
            title="Toggle Level Meters"
          >
            <BarChart3 className="w-3 h-3" />
          </button>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowSettings(!showSettings);
            }}
            className={`p-1 rounded transition-colors ${
              showSettings ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
            title="Settings & Source Manager"
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
        {visibleAudioSources.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            <div className="text-center">
              <Volume2 className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <div>No audio sources</div>
              <div className="text-xs mt-1">
                {connectionStatus === 'connected' 
                  ? 'Configure in settings' 
                  : 'Connect OBS or add virtual sources'
                }
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSettings(true);
                }}
                className="mt-2 px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Audio Sources</span>
              </button>
            </div>
          </div>
        ) : (
          <div className={`${
            orientation === 'horizontal' 
              ? 'flex space-x-2 overflow-x-auto' 
              : 'space-y-2'
          }`}>
            {visibleAudioSources.map(source => renderVolumeSlider(source))}
          </div>
        )}
      </div>

      {/* Connection Status Footer */}
      <div className="border-t border-gray-700 px-3 py-2 bg-gray-750">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">
            OBS: {connectionStatus === 'connected' ? (
              <span className="text-green-400">Connected • {audioSources.length} sources</span>
            ) : (
              <span className="text-red-400">Disconnected</span>
            )}
          </span>
          <div className="flex items-center space-x-3">
            {performanceMode && <span className="text-yellow-400">⚡ Performance</span>}
            <span className="text-gray-400">{visibleAudioSources.length} visible</span>
            {loadingState === 'error' && <span className="text-red-400">⚠️ Error</span>}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {renderSettings()}
      
      {/* Context Menu */}
      {renderContextMenu()}

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

export default UnifiedAudioMixerWidget;