import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Mic, Monitor, Headphones, Power, Activity, Eye, EyeOff, Settings, TestTube, Bug } from 'lucide-react';
import globalStateService from '../services/globalStateService';
import useMoodStore from '../stores/moodStore';
import AudioLevelMeter from './AudioLevelMeter';

const AudioMixer = () => {
  const { settings } = useMoodStore();
  
  // Use global state instead of local state
  const [audioSources, setAudioSources] = useState([]);
  const [audioLevels, setAudioLevels] = useState({});
  const [realTimeAudioLevels, setRealTimeAudioLevels] = useState({});
  const [connected, setConnected] = useState(false);
  const [midiConnected, setMidiConnected] = useState(false);
  const [lastMIDIMessage, setLastMIDIMessage] = useState(null);
  const [hiddenSources, setHiddenSources] = useState(new Set());
  const [showHiddenSources, setShowHiddenSources] = useState(false);
  const [learningMidi, setLearningMidi] = useState(null);
  const [sourceMidiMappings, setSourceMidiMappings] = useState({});
  const [draggedSlider, setDraggedSlider] = useState(null);
  
  // 🧪 Debug State
  const [debugMode, setDebugMode] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});
  const debugLogCountRef = useRef(0);

  useEffect(() => {
    console.log('AudioMixer: Initializing with GlobalStateService');
    
    // Load initial state from GlobalStateService
    const obsState = globalStateService.getOBSState();
    const midiState = globalStateService.getMIDIState();
    const audioMappings = globalStateService.getAudioSourceMappings();
    
    setConnected(obsState.connected);
    setAudioSources(obsState.sources);
    setAudioLevels(obsState.audioLevels);
    setMidiConnected(midiState.connected);
    setLastMIDIMessage(midiState.lastActivity);
    setSourceMidiMappings(audioMappings);
    
    console.log('AudioMixer: Initial state loaded:', {
      obsConnected: obsState.connected,
      sourcesCount: obsState.sources.length,
      midiConnected: midiState.connected,
      mappingsCount: Object.keys(audioMappings).length
    });
    
    // Subscribe to global state changes
    const handleOBSStateChange = (newState) => {
      //console.log('AudioMixer: OBS state changed:', newState);
      setConnected(newState.connected);
      setAudioSources(newState.sources);
      setAudioLevels(newState.audioLevels);
      
      // WICHTIG: Update realTimeAudioLevels aus dem OBS State
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
        
        // Debug: Log erste 3 Updates (mit useRef statt this)
        if (debugLogCountRef.current === undefined) debugLogCountRef.current = 0;
        if (debugLogCountRef.current < 3) {
          console.log('🎵 AudioMixer: Updated realTimeAudioLevels:', Object.keys(levelsObj));
          debugLogCountRef.current++;
        }
      }
    };
    
    const handleAudioLevelsUpdate = (data) => {
      // 🎵 Real-time audio level updates für Visualisierung
      if (data.allLevels) {
        setRealTimeAudioLevels(data.allLevels);
        
        // 🧪 Debug Info Update
        if (debugMode) {
          setDebugInfo(prev => ({
            ...prev,
            lastAudioUpdate: Date.now(),
            audioSourcesWithData: Object.keys(data.allLevels).length,
            totalAudioEvents: (prev.totalAudioEvents || 0) + 1
          }));
        }
      }
    };
    
    const handleSourceVolumeUpdate = (data) => {
      console.log('AudioMixer: Source volume updated:', data);
      
      if (draggedSlider !== data.sourceName) {
        setAudioSources(prevSources => 
          prevSources.map(source => 
            source.name === data.sourceName 
              ? { ...source, volumeDb: data.volumeDb, volume: data.volume }
              : source
          )
        );
      }
    };
    
    const handleMIDIStateChange = (newState) => {
      console.log('AudioMixer: MIDI state changed:', newState);
      setMidiConnected(newState.connected);
      setLastMIDIMessage(newState.lastActivity);
    };
    
    const handleMappingsChange = (data) => {
      if (data.type === 'audio') {
        console.log('AudioMixer: Audio mappings changed:', data.mappings);
        setSourceMidiMappings(data.mappings);
      }
    };
    
    const handleMIDILearningCompleted = (data) => {
      console.log('AudioMixer: MIDI learning completed globally:', data);
      if (learningMidi) {
        const { sourceName, type } = learningMidi;
        const midiKey = data.message.note.toString();
        
        console.log(`AudioMixer: Creating ${type} mapping for ${sourceName}: CC${midiKey}`);
        
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
          console.log(`AudioMixer: Setting volume MIDI mapping:`, mapping);
          globalStateService.setMIDIMapping(midiKey, mapping, 'AudioMixer');
        } else if (type === 'mute') {
          const mapping = {
            type: 'hotkey',
            action: 'mute',
            target: sourceName
          };
          console.log(`AudioMixer: Setting mute MIDI mapping:`, mapping);
          globalStateService.setMIDIMapping(midiKey, mapping, 'AudioMixer');
        }
        
        setLearningMidi(null);
      }
    };
    
    const handleMIDILearningStopped = () => {
      console.log('AudioMixer: MIDI learning stopped globally');
      setLearningMidi(null);
    };
    
    // Register callbacks
    globalStateService.on('obsStateChanged', handleOBSStateChange);
    globalStateService.on('midiStateChanged', handleMIDIStateChange);
    globalStateService.on('mappingsChanged', handleMappingsChange);
    globalStateService.on('midiLearningCompleted', handleMIDILearningCompleted);
    globalStateService.on('midiLearningStopped', handleMIDILearningStopped);
    globalStateService.on('audioLevelsUpdated', handleAudioLevelsUpdate);
    globalStateService.on('sourceVolumeUpdated', handleSourceVolumeUpdate);
    
    // Cleanup
    return () => {
      globalStateService.off('obsStateChanged', handleOBSStateChange);
      globalStateService.off('midiStateChanged', handleMIDIStateChange);
      globalStateService.off('mappingsChanged', handleMappingsChange);
      globalStateService.off('midiLearningCompleted', handleMIDILearningCompleted);
      globalStateService.off('midiLearningStopped', handleMIDILearningStopped);
      globalStateService.off('audioLevelsUpdated', handleAudioLevelsUpdate);
      globalStateService.off('sourceVolumeUpdated', handleSourceVolumeUpdate);
    };
  }, [learningMidi, draggedSlider, debugMode]);

  // 🧪 Test Functions
  const testAudioVisualization = () => {
    console.log('🧪 Testing audio visualization...');
    setTestMode(true);
    
    // Force test für OBS Service
    const obsService = globalStateService.services.obs;
    if (obsService && obsService.forceAudioLevelTest) {
      obsService.forceAudioLevelTest();
    }
    
    // Stoppe Test nach 10 Sekunden
    setTimeout(() => {
      setTestMode(false);
      console.log('🧪 Audio visualization test completed');
    }, 10000);
  };

  const testOBSConnection = async () => {
    console.log('🧪 Testing OBS connection...');
    const obsService = globalStateService.services.obs;
    if (obsService) {
      try {
        const version = await obsService.testConnection();
        if (version) {
          console.log('✅ OBS connection test successful:', version);
          await obsService.testEventSubscription();
        }
      } catch (error) {
        console.error('❌ OBS connection test failed:', error);
      }
    }
  };

  const debugOBSEvents = () => {
    console.log('🔧 Debugging OBS events...');
    console.log('=== AUDIO MIXER DEBUG INFO ===');
    console.log('Connected:', connected);
    console.log('Audio Sources (Total):', audioSources.length);
    console.log('Real-time Audio Levels (Keys):', Object.keys(realTimeAudioLevels));
    console.log('Real-time Audio Levels (Count):', Object.keys(realTimeAudioLevels).length);
    
    // Detaillierte Source-Analyse
    console.log('\n--- DETAILED SOURCE ANALYSIS ---');
    audioSources.forEach(source => {
      const hasAudioData = realTimeAudioLevels[source.name];
      const audioInfo = hasAudioData ? 
        `L:${hasAudioData.left?.toFixed(1)}dB R:${hasAudioData.right?.toFixed(1)}dB ${hasAudioData.isReal ? '(REAL)' : '(TEST)'}` : 
        'NO DATA';
      console.log(`🎵 ${source.name}: ${audioInfo}`);
    });
    
    console.log('\n--- GLOBAL STATE SERVICE DATA ---');
    const obsState = globalStateService.getOBSState();
    console.log('OBS State Audio Levels Keys:', Object.keys(obsState.audioLevels || {}));
    console.log('OBS State realTimeAudioLevels size:', obsState.realTimeAudioLevels?.size || 0);
    
    console.log('=== END DEBUG ===');
  };

  // MIDI Learning Functions
  const startMidiLearning = (sourceName, type) => {
    console.log(`AudioMixer: Starting MIDI learning for ${sourceName} - ${type}`);
    setLearningMidi({ sourceName, type });
    
    const success = globalStateService.startMIDILearning(`AudioMixer_${sourceName}_${type}`);
    if (!success) {
      console.error('AudioMixer: Failed to start MIDI learning');
      setLearningMidi(null);
    }
  };

  const stopMidiLearning = () => {
    console.log('AudioMixer: Stopping MIDI learning');
    setLearningMidi(null);
    globalStateService.stopMIDILearning();
  };

  // Source visibility functions
  const toggleSourceVisibility = (sourceName) => {
    setHiddenSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceName)) {
        newSet.delete(sourceName);
        // 🚀 Benachrichtige GlobalStateService
        globalStateService.setSourceHidden(sourceName, false);
      } else {
        newSet.add(sourceName);
        // 🚀 Benachrichtige GlobalStateService  
        globalStateService.setSourceHidden(sourceName, true);
      }
      return newSet;
    });
  };

  const showAllSources = () => {
    // 🚀 Benachrichtige GlobalStateService für alle Sources
    hiddenSources.forEach(sourceName => {
      globalStateService.setSourceHidden(sourceName, false);
    });
    setHiddenSources(new Set());
  };

  const hideAllSources = () => {
    const allSourceNames = audioSources.map(s => s.name);
    // 🚀 Benachrichtige GlobalStateService für alle Sources
    allSourceNames.forEach(sourceName => {
      globalStateService.setSourceHidden(sourceName, true);
    });
    setHiddenSources(new Set(allSourceNames));
  };

  // Volume and Mute Control
  const handleVolumeChange = async (sourceName, volumeDb) => {
    console.log(`AudioMixer: Setting volume for ${sourceName} to ${volumeDb}dB`);
    
    const success = await globalStateService.setVolume(sourceName, volumeDb, 'AudioMixer');
    if (!success) {
      console.error('AudioMixer: Failed to set volume');
    }
  };
  
  const handleSliderStart = useCallback((sourceName) => {
    setDraggedSlider(sourceName);
  }, []);
  
  const handleSliderEnd = useCallback(() => {
    setDraggedSlider(null);
  }, []);

  const handleMuteToggle = async (sourceName) => {
    console.log(`AudioMixer: Toggling mute for ${sourceName}`);
    
    const success = await globalStateService.toggleMute(sourceName, 'AudioMixer');
    if (!success) {
      console.error('AudioMixer: Failed to toggle mute');
    }
  };

  // Connection functions
  const connectToOBS = async () => {
    if (!settings.obsWebSocketEnabled) {
      alert('OBS WebSocket is disabled. Enable it in Settings first.');
      return;
    }
    
    try {
      const obsService = globalStateService.services.obs;
      if (obsService) {
        await obsService.connect(
          settings.obsWebSocketHost,
          settings.obsWebSocketPort,
          settings.obsWebSocketPassword
        );
      }
    } catch (error) {
      console.error('Failed to connect to OBS:', error);
      alert('Failed to connect to OBS. Please check your settings.');
    }
  };

  const refreshSources = async () => {
    if (connected) {
      try {
        const obsService = globalStateService.services.obs;
        if (obsService) {
          await obsService.discoverAudioSources();
        }
      } catch (error) {
        console.error('Failed to refresh sources:', error);
      }
    }
  };

  const getSourceIcon = (sourceKind) => {
    if (sourceKind?.includes('input') || sourceKind?.includes('mic')) {
      return <Mic className="w-4 h-4" />;
    } else if (sourceKind?.includes('output') || sourceKind?.includes('desktop')) {
      return <Monitor className="w-4 h-4" />;
    } else {
      return <Headphones className="w-4 h-4" />;
    }
  };

  const renderVolumeSlider = (source) => {
    const isLearningVolume = learningMidi?.sourceName === source.name && learningMidi?.type === 'volume';
    const isLearningMute = learningMidi?.sourceName === source.name && learningMidi?.type === 'mute';
    const volumeMapping = sourceMidiMappings[source.name]?.volume;
    const muteMapping = sourceMidiMappings[source.name]?.mute;
    
    const removeMidiMapping = (type) => {
      const mapping = sourceMidiMappings[source.name]?.[type];
      if (mapping) {
        console.log(`AudioMixer: Removing MIDI mapping for ${source.name} ${type}: ${mapping}`);
        
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
      <div className="flex items-center space-x-2">
        {/* Mute Button mit MIDI Learning */}
        <div className="flex flex-col items-center space-y-1">
          <button
            onClick={() => handleMuteToggle(source.name)}
            className={`p-2 rounded-lg transition-colors ${
              source.muted 
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {source.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          
          <div className="flex items-center space-x-1">
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
        </div>
        
        {/* Volume Slider mit MIDI Learning */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-gray-400">
              {source.volumeDb?.toFixed(1) || '-60.0'} dB
            </div>
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
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <h3 className="text-lg font-semibold text-white">Audio Mixer</h3>
          <div className="flex space-x-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-400">
              {connected ? 'OBS Connected' : 'OBS Disconnected'}
            </span>
            {midiConnected && (
              <>
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs text-gray-400">MIDI</span>
              </>
            )}
            {testMode && (
              <>
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                <span className="text-xs text-orange-400">TEST MODE</span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex space-x-2">
          {/* 🧪 Debug & Test Buttons */}
          <button
            onClick={() => setDebugMode(!debugMode)}
            className={`p-2 rounded transition-colors ${
              debugMode 
                ? 'bg-blue-500/30 text-blue-300' 
                : 'text-blue-400 hover:text-blue-300'
            }`}
            title="Toggle debug mode"
          >
            <Bug className="w-4 h-4" />
          </button>
          
          <button
            onClick={testAudioVisualization}
            className="p-2 text-orange-400 hover:text-orange-300 transition-colors"
            title="Test audio visualization (10s)"
          >
            <TestTube className="w-4 h-4" />
          </button>
          
          {connected && (
            <>
              <button
                onClick={showAllSources}
                className="p-2 text-green-400 hover:text-green-300 transition-colors"
                title="Show all sources"
              >
                <Eye className="w-4 h-4" />
              </button>
              
              <button
                onClick={hideAllSources}
                className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
                title="Hide all sources"
              >
                <EyeOff className="w-4 h-4" />
              </button>
              
              <button
                onClick={refreshSources}
                className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                title="Refresh audio sources"
              >
                <Activity className="w-4 h-4" />
              </button>
              
              <button
                onClick={testOBSConnection}
                className="p-2 text-purple-400 hover:text-purple-300 transition-colors"
                title="Test OBS connection & events"
              >
                <Settings className="w-4 h-4" />
              </button>
              
              <button
                onClick={debugOBSEvents}
                className="p-2 text-yellow-400 hover:text-yellow-300 transition-colors"
                title="Debug OBS events (check console)"
              >
                <Power className="w-4 h-4" />
              </button>
            </>
          )}
          
          {!connected && (
            <button
              onClick={connectToOBS}
              className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
              title="Connect to OBS"
            >
              <Power className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 🧪 Debug Info Panel */}
      {debugMode && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="text-sm text-blue-400 font-medium mb-2">Debug Information</div>
          <div className="grid grid-cols-2 gap-2 text-xs text-blue-300">
            <div>Audio Sources: {audioSources.length}</div>
            <div>Real-time Levels: {Object.keys(realTimeAudioLevels).length}</div>
            <div>Last Update: {debugInfo.lastAudioUpdate ? new Date(debugInfo.lastAudioUpdate).toLocaleTimeString() : 'Never'}</div>
            <div>Total Events: {debugInfo.totalAudioEvents || 0}</div>
          </div>
        </div>
      )}

      {/* MIDI Activity Monitor */}
      {lastMIDIMessage && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
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

      {/* Audio Sources */}
      {connected ? (
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <div className="space-y-3">
            {audioSources.filter(source => !hiddenSources.has(source.name)).map((source) => (
              <motion.div
                key={source.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 border border-gray-600 rounded-lg p-3"
              >
                <div className="flex items-center space-x-3">
                  {/* Source Icon & Name & Visibility Toggle */}
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    {getSourceIcon(source.kind)}
                    <span className="text-sm font-medium text-white truncate">
                      {source.name}
                    </span>
                    
                    {/* MIDI Learning Indicator */}
                    {(learningMidi?.sourceName === source.name) && (
                      <div className="px-2 py-1 bg-blue-500 text-white text-xs rounded animate-pulse">
                        Learning MIDI...
                      </div>
                    )}
                    
                    {/* Visibility Toggle */}
                    <button
                      onClick={() => toggleSourceVisibility(source.name)}
                      className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                      title="Hide this source"
                    >
                      <EyeOff className="w-3 h-3" />
                    </button>
                  </div>

                  {/* 🎵 Audio Meter - Mit Debug-Modus */}
                  <div className="flex items-center space-x-2">
                    <AudioLevelMeter
                      inputName={source.name}
                      audioLevel={realTimeAudioLevels[source.name]}
                      isActive={connected}
                      width={150}
                      height={32}
                      style="horizontal"
                      debug={debugMode}
                    />
                  </div>

                  {/* Volume Control */}
                  <div className="w-64">
                    {renderVolumeSlider(source)}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {/* Hidden Sources Summary */}
            {hiddenSources.size > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-gray-800/50 border border-gray-600 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <EyeOff className="w-4 h-4" />
                    <span className="text-sm">
                      {hiddenSources.size} source{hiddenSources.size > 1 ? 's' : ''} hidden
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setShowHiddenSources(!showHiddenSources)}
                      className="px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors"
                    >
                      {showHiddenSources ? 'Hide' : 'Show'} Hidden
                    </button>
                    <button
                      onClick={showAllSources}
                      className="px-3 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded text-xs transition-colors"
                    >
                      Show All
                    </button>
                  </div>
                </div>
                
                {/* Hidden Sources List */}
                <AnimatePresence>
                  {showHiddenSources && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-2"
                    >
                      {Array.from(hiddenSources).map(sourceName => {
                        const source = audioSources.find(s => s.name === sourceName);
                        return source ? (
                          <div key={sourceName} className="flex items-center justify-between py-2 px-3 bg-gray-700/50 rounded">
                            <div className="flex items-center space-x-2">
                              {getSourceIcon(source.kind)}
                              <span className="text-sm text-gray-300">{sourceName}</span>
                            </div>
                            <button
                              onClick={() => toggleSourceVisibility(sourceName)}
                              className="p-1 text-green-400 hover:text-green-300 transition-colors"
                              title="Show this source"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          </div>
                        ) : null;
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <Power className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Connect to OBS to control audio</p>
          <p className="text-xs mt-1">
            Configure OBS WebSocket in Settings first (Tools → WebSocket Server Settings in OBS)
          </p>
          {!settings.obsWebSocketEnabled && (
            <p className="text-xs mt-2 text-yellow-400">
              ⚠️ OBS WebSocket is disabled in Settings
            </p>
          )}
        </div>
      )}

      {connected && audioSources.filter(source => !hiddenSources.has(source.name)).length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Headphones className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No audio sources found</p>
          <p className="text-xs mt-1">Make sure OBS has audio sources configured</p>
        </div>
      )}

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

export default AudioMixer;