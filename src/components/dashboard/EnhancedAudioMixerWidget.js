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
  MoreVertical,
  Layout,
  RefreshCw,
  Plus,
  Minus,
  Trash2
} from 'lucide-react';
import enhancedGlobalStateService from '../../services/enhancedGlobalStateService';
import configService from '../../services/configService';

const EnhancedAudioMixerWidget = ({ component, editMode, onUpdate, onRemove, performanceMode }) => {
  const [audioSources, setAudioSources] = useState([]);
  const [audioLevels, setAudioLevels] = useState({});
  const [visibleSources, setVisibleSources] = useState(component.sources || ['master', 'mic', 'desktop']);
  const [compactMode, setCompactMode] = useState(component.size?.width < 200);
  const [showMeters, setShowMeters] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [orientation, setOrientation] = useState(component.orientation || 'vertical');
  const [sliderSize, setSliderSize] = useState(component.sliderSize || 'medium');
  const [showContextMenu, setShowContextMenu] = useState(null);
  const [loadingState, setLoadingState] = useState('idle'); // idle, loading, error, success
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [forceUpdate, setForceUpdate] = useState(0); // 🚨 FORCE UPDATE STATE
  
  const updateTimeout = useRef(null);
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

  // Verfügbare Source-Types für Selection
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

  // 🚨 EMERGENCY: Force State Update
  const triggerForceUpdate = () => {
    console.log('🚨 FORCE UPDATE triggered');
    setForceUpdate(prev => prev + 1);
  };

  // 🚨 EMERGENCY: Save state to localStorage
  const saveVisibleSourcesToLocalStorage = (sources) => {
    try {
      localStorage.setItem('audioMixerVisibleSources', JSON.stringify(sources));
      console.log('💾 Saved visible sources to localStorage:', sources);
    } catch (error) {
      console.error('❌ Failed to save to localStorage:', error);
    }
  };

  // 🚨 EMERGENCY: Load state from localStorage
  const loadVisibleSourcesFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem('audioMixerVisibleSources');
      if (stored) {
        const sources = JSON.parse(stored);
        console.log('📂 Loaded visible sources from localStorage:', sources);
        return sources;
      }
    } catch (error) {
      console.error('❌ Failed to load from localStorage:', error);
    }
    return ['master', 'mic', 'desktop'];
  };

  useEffect(() => {
    console.log('Enhanced AudioMixerWidget: Initializing...');
    
    // 🚨 Load from localStorage first
    const savedSources = loadVisibleSourcesFromLocalStorage();
    setVisibleSources(savedSources);
    
    // Widget registration
    enhancedGlobalStateService.registerDashboardWidget(
      `audio-mixer-${component.id}`, 
      'audio-mixer', 
      { sources: savedSources, orientation, showMeters }
    );
    
    initializeAudioSources();
    setupEventListeners();
    
    // Auto-refresh interval für OBS-Connection
    if (!performanceMode) {
      refreshInterval.current = setInterval(() => {
        refreshAudioSources();
      }, 10000); // Alle 10 Sekunden
    }

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    setCompactMode(component.size?.width < 200);
  }, [component.size]);

  // 🚨 Watch for forceUpdate changes
  useEffect(() => {
    if (forceUpdate > 0) {
      console.log('🔄 Force update triggered, refreshing sources...');
      refreshAudioSources();
    }
  }, [forceUpdate]);

  const cleanup = () => {
    enhancedGlobalStateService.unregisterDashboardWidget(`audio-mixer-${component.id}`);
    
    if (refreshInterval.current) {
      clearInterval(refreshInterval.current);
    }
    
    if (updateTimeout.current) {
      clearTimeout(updateTimeout.current);
    }
    
    // Remove event listeners
    enhancedGlobalStateService.off('audioLevelsUpdated', handleAudioLevels);
    enhancedGlobalStateService.off('sourcesDiscovered', handleSourcesUpdated);
    enhancedGlobalStateService.off('obsStateChanged', handleOBSStateChange);
    enhancedGlobalStateService.off('sourceVolumeUpdated', handleVolumeUpdated);
  };

  const setupEventListeners = () => {
    console.log('Enhanced AudioMixerWidget: Setting up event listeners...');
    
    enhancedGlobalStateService.on('audioLevelsUpdated', handleAudioLevels);
    enhancedGlobalStateService.on('sourcesDiscovered', handleSourcesUpdated);
    enhancedGlobalStateService.on('obsStateChanged', handleOBSStateChange);
    enhancedGlobalStateService.on('sourceVolumeUpdated', handleVolumeUpdated);
  };

  const initializeAudioSources = async () => {
    setLoadingState('loading');
    
    try {
      console.log('Enhanced AudioMixerWidget: Loading initial audio sources...');
      
      // 🚨 AGGRESSIVE CONNECTION CHECK
      const obsState = enhancedGlobalStateService.getOBSState();
      const obsConnected = obsState.connected;
      
      console.log('🚨 FIXING AudioMixer: OBS State Check:', { connected: obsConnected, sourcesCount: obsState.sources?.length });
      
      setConnectionStatus(obsConnected ? 'connected' : 'disconnected');
      
      if (obsConnected) {
        // Get audio sources from enhanced service
        const sources = enhancedGlobalStateService.getAudioSourcesForMixer();
        console.log('🚨 FIXING AudioMixer: Loaded', sources.length, 'audio sources from GlobalStateService');
        
        if (sources.length > 0) {
          setAudioSources(sources);
          setLoadingState('success');
          triggerForceUpdate();
        } else {
          // Trigger discovery if no sources found
          console.log('🚨 FIXING AudioMixer: No sources found, triggering discovery...');
          await enhancedGlobalStateService.discoverOBSDataWithCaching();
          
          // 🚨 WAIT and CHECK AGAIN after discovery
          setTimeout(() => {
            const newSources = enhancedGlobalStateService.getAudioSourcesForMixer();
            console.log('🚨 FIXING AudioMixer: After discovery:', newSources.length, 'sources');
            if (newSources.length > 0) {
              setAudioSources(newSources);
              setLoadingState('success');
              triggerForceUpdate();
            } else {
              setLoadingState('idle');
            }
          }, 2000);
        }
      } else {
        console.log('🚨 FIXING AudioMixer: OBS not connected, using default sources');
        createDefaultAudioSources();
        setLoadingState('idle');
      }
      
      // Load initial audio levels
      const levels = enhancedGlobalStateService.getAllAudioLevels();
      setAudioLevels(levels);
      
    } catch (error) {
      console.error('Enhanced AudioMixerWidget: Failed to initialize audio sources:', error);
      setLoadingState('error');
      createDefaultAudioSources();
    }
  };

  const createDefaultAudioSources = () => {
    console.log('Enhanced AudioMixerWidget: Creating default sources...');
    
    const defaultSources = [
      { name: 'master', volumeDb: -10, muted: false, type: 'master', kind: 'audio_output' },
      { name: 'mic', volumeDb: -15, muted: false, type: 'input', kind: 'audio_input' },
      { name: 'desktop', volumeDb: -12, muted: false, type: 'output', kind: 'audio_output' }
    ];
    
    setAudioSources(defaultSources);
    setLoadingState('success');
  };

  const refreshAudioSources = async () => {
    console.log('Enhanced AudioMixerWidget: Refreshing audio sources...');
    setLoadingState('loading');
    setLastRefresh(Date.now());
    
    try {
      if (enhancedGlobalStateService.isOBSConnected()) {
        // Force discovery refresh
        await enhancedGlobalStateService.discoverOBSDataWithCaching();
        
        // Get fresh sources
        const sources = enhancedGlobalStateService.getAudioSourcesForMixer();
        setAudioSources(sources);
        setConnectionStatus('connected');
        setLoadingState('success');
        
        console.log('Enhanced AudioMixerWidget: Refreshed', sources.length, 'audio sources');
      } else {
        setConnectionStatus('disconnected');
        setLoadingState('idle');
      }
    } catch (error) {
      console.error('Enhanced AudioMixerWidget: Failed to refresh sources:', error);
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
    }
  }, [performanceMode]);

  const handleSourcesUpdated = useCallback((sources) => {
    console.log('Enhanced AudioMixerWidget: Sources updated:', sources.length);
    
    // Filter für Audio-Sources
    const audioSources = sources.filter(source => {
      const kind = source.kind || source.inputKind || '';
      return kind.includes('audio') || 
             kind.includes('wasapi') || 
             kind.includes('pulse') ||
             kind === 'coreaudio_input_capture' ||
             kind === 'coreaudio_output_capture';
    });
    
    console.log('🚨 FIXING AudioMixer: Setting', audioSources.length, 'audio sources and connected state');
    
    setAudioSources(audioSources);
    setConnectionStatus('connected');
    setLoadingState('success');
    
    // 🚨 FORCE UPDATE to ensure UI updates
    triggerForceUpdate();
  }, []);

  const handleOBSStateChange = useCallback((state) => {
    console.log('🚨 FIXING AudioMixer: OBS State Change:', { connected: state.connected, sourcesCount: state.sources?.length });
    
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
      
      console.log('🚨 FIXING AudioMixer: Filtered', audioSources.length, 'audio sources from OBS state');
      setAudioSources(audioSources);
      
      if (audioSources.length > 0) {
        setLoadingState('success');
      }
    }
    
    if (state.audioLevels) {
      setAudioLevels(state.audioLevels);
    }
    
    // 🚨 FORCE UPDATE when state changes
    triggerForceUpdate();
  }, []);

  const handleVolumeUpdated = useCallback((data) => {
    console.log('Enhanced AudioMixerWidget: Volume updated:', data.sourceName, data.volumeDb);
    
    // Update local source data
    setAudioSources(prev => prev.map(source => 
      source.name === data.sourceName 
        ? { ...source, volumeDb: data.volumeDb, volume: data.volume }
        : source
    ));
  }, []);

  // Volume Control Methods
  const handleVolumeChange = useCallback(async (sourceName, volumeDb) => {
    try {
      console.log('Enhanced AudioMixerWidget: Setting volume for', sourceName, 'to', volumeDb, 'dB');
      await enhancedGlobalStateService.setVolume(sourceName, volumeDb, 'EnhancedAudioMixerWidget');
    } catch (error) {
      console.error('Enhanced AudioMixerWidget: Failed to set volume:', error);
    }
  }, []);

  const handleMuteToggle = useCallback(async (sourceName) => {
    try {
      console.log('Enhanced AudioMixerWidget: Toggling mute for', sourceName);
      await enhancedGlobalStateService.toggleMute(sourceName, 'EnhancedAudioMixerWidget');
    } catch (error) {
      console.error('Enhanced AudioMixerWidget: Failed to toggle mute:', error);
    }
  }, []);

  // Utility Methods
  const getVolumeFromDb = (volumeDb) => {
    if (volumeDb <= -60) return 0;
    return Math.round(((volumeDb + 60) / 60) * 100);
  };

  const getDbFromVolume = (volume) => {
    if (volume <= 0) return -60;
    return (volume / 100) * 60 - 60;
  };

  const getVisibleAudioSources = () => {
    return audioSources.filter(source => visibleSources.includes(source.name));
  };

  // 🚨 EMERGENCY: Super Aggressive Source Toggle
  const toggleSourceVisibility = (sourceName) => {
    console.log('🚨 EMERGENCY toggleSourceVisibility called for:', sourceName);
    
    const newVisible = visibleSources.includes(sourceName)
      ? visibleSources.filter(s => s !== sourceName)
      : [...visibleSources, sourceName];
    
    console.log('🔄 Visibility change:', { sourceName, wasVisible: visibleSources.includes(sourceName), newVisible });
    
    // 🚨 MULTIPLE STATE UPDATES
    setVisibleSources(newVisible);
    
    // 🚨 SAVE TO LOCALSTORAGE IMMEDIATELY
    saveVisibleSourcesToLocalStorage(newVisible);
    
    // 🚨 CALL PARENT UPDATE
    if (onUpdate) {
      onUpdate({ sources: newVisible });
    }
    
    // 🚨 FORCE WIDGET UPDATE
    triggerForceUpdate();
    
    console.log('✅ Enhanced AudioMixerWidget: Source visibility toggled:', sourceName, 'visible:', !visibleSources.includes(sourceName));
  };

  // 🚨 EMERGENCY: Super Aggressive Add Custom Source
  const addCustomSource = (sourceType) => {
    console.log('🚨 EMERGENCY addCustomSource called for:', sourceType);
    
    if (!visibleSources.includes(sourceType)) {
      const newVisible = [...visibleSources, sourceType];
      
      console.log('🔄 Adding custom source:', { sourceType, newVisible });
      
      // 🚨 MULTIPLE STATE UPDATES
      setVisibleSources(newVisible);
      
      // 🚨 SAVE TO LOCALSTORAGE IMMEDIATELY
      saveVisibleSourcesToLocalStorage(newVisible);
      
      // 🚨 CALL PARENT UPDATE
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
      
      // 🚨 FORCE WIDGET UPDATE
      triggerForceUpdate();
      
      console.log('✅ Enhanced AudioMixerWidget: Added custom source:', sourceType);
    } else {
      console.log('⚠️ Source already visible:', sourceType);
    }
  };

  // Context Menu Handling
  const handleContextMenu = (e, source = null) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any existing dashboard context menu
    enhancedGlobalStateService.clearActiveContextMenu();
    
    const menuData = {
      x: e.clientX,
      y: e.clientY,
      source: source,
      timestamp: Date.now()
    };
    
    setShowContextMenu(menuData);
    
    if (source) {
      console.log('Enhanced AudioMixerWidget: Source context menu:', source.name);
      enhancedGlobalStateService.setActiveContextMenu('audioMixerSource', menuData);
    } else {
      console.log('Enhanced AudioMixerWidget: Widget context menu');
      enhancedGlobalStateService.setActiveContextMenu('audioMixerWidget', menuData);
    }
  };

  // Click Outside Handler
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) {
        setShowSettings(false);
        setShowContextMenu(null);
        enhancedGlobalStateService.clearActiveContextMenu();
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
    const levels = audioLevels[source.name];
    const Icon = sourceIcons[source.name] || Volume2;

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
        {showMeters && levels && levels.isReal && !performanceMode && (
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
        
        {/* 🚨 EMERGENCY CONTROLS */}
        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded">
          <div className="text-xs font-medium text-red-400 mb-2">🚨 Emergency Controls</div>
          <div className="space-y-1">
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🚨 Emergency: Force refresh sources');
                refreshAudioSources();
                triggerForceUpdate();
              }}
              className="w-full px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs"
            >
              Force Refresh Sources
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('🚨 Emergency: Reset visible sources');
                const defaultSources = ['master', 'mic', 'desktop'];
                setVisibleSources(defaultSources);
                saveVisibleSourcesToLocalStorage(defaultSources);
                triggerForceUpdate();
              }}
              className="w-full px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs"
            >
              Reset to Defaults
            </button>
          </div>
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🚨 EMERGENCY: MouseDown on source:', source.name);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🚨 EMERGENCY: Click on source:', source.name);
                      toggleSourceVisibility(source.name);
                    }}
                    onDoubleClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🚨 EMERGENCY: Double-click on source:', source.name);
                      toggleSourceVisibility(source.name);
                    }}
                    className={`p-2 rounded border text-xs flex items-center justify-between transition-colors cursor-pointer ${
                      isVisible
                        ? 'border-green-500 bg-green-500/20 text-green-400'
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    style={{ userSelect: 'none' }}
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
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🚨 EMERGENCY: MouseDown on virtual source:', sourceType.key);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🚨 EMERGENCY: Click on virtual source:', sourceType.key);
                    addCustomSource(sourceType.key);
                  }}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🚨 EMERGENCY: Double-click on virtual source:', sourceType.key);
                    addCustomSource(sourceType.key);
                  }}
                  className={`p-2 rounded border text-xs flex items-center space-x-2 transition-colors cursor-pointer ${
                    isVisible
                      ? 'border-green-500 bg-green-500/20 text-green-400'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  style={{ userSelect: 'none' }}
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
            enhancedGlobalStateService.clearActiveContextMenu();
          }}
        >
          {showContextMenu.source ? (
            // Source context menu
            <>
              <button
                onClick={() => {
                  toggleSourceVisibility(showContextMenu.source.name);
                  setShowContextMenu(null);
                  enhancedGlobalStateService.clearActiveContextMenu();
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
                  enhancedGlobalStateService.clearActiveContextMenu();
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
                  enhancedGlobalStateService.clearActiveContextMenu();
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
                  enhancedGlobalStateService.clearActiveContextMenu();
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
                  enhancedGlobalStateService.clearActiveContextMenu();
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
                  enhancedGlobalStateService.clearActiveContextMenu();
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
                  enhancedGlobalStateService.clearActiveContextMenu();
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
          
          {/* 🚨 EMERGENCY INDICATOR */}
          {forceUpdate > 0 && (
            <div className="flex items-center space-x-1 text-red-400">
              <span className="text-xs">🚨 v{forceUpdate}</span>
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
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🚨 EMERGENCY: Opening settings for audio sources');
                  setShowSettings(true);
                }}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🚨 EMERGENCY: Double-click opening settings for audio sources');
                  setShowSettings(true);
                }}
                className="mt-2 px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                style={{ userSelect: 'none' }}
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
            <span className="text-gray-400">{visibleAudioSources.length} active</span>
            {loadingState === 'error' && <span className="text-red-400">⚠️ Error</span>}
            {/* 🚨 EMERGENCY DEBUG INFO */}
            <span className="text-red-400 text-xs">🚨 v{forceUpdate}</span>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {renderSettings()}
      
      {/* Context Menu */}
      {renderContextMenu()}
    </div>
  );
};

export default EnhancedAudioMixerWidget;