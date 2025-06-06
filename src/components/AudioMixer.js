import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Mic, Monitor, Headphones, Power, Activity, Eye, EyeOff, Settings } from 'lucide-react';
import obsWebSocketService from '../services/obsWebSocketService';
import midiService from '../services/midiService';
import useMoodStore from '../stores/moodStore';

const AudioMixer = () => {
  const { settings } = useMoodStore();
  const [audioSources, setAudioSources] = useState([]);
  const [audioLevels, setAudioLevels] = useState({});
  const [connected, setConnected] = useState(false);
  const [midiConnected, setMidiConnected] = useState(false);
  const [lastMIDIActivity, setLastMIDIActivity] = useState(null);
  const [hiddenSources, setHiddenSources] = useState(new Set());
  const [showHiddenSources, setShowHiddenSources] = useState(false);
  const [learningMidi, setLearningMidi] = useState(null); // { sourceName: string, type: 'volume' | 'mute' }
  const [sourceMidiMappings, setSourceMidiMappings] = useState({}); // sourceName -> { volume: midiKey, mute: midiKey }

  useEffect(() => {
    // Setup OBS WebSocket callbacks
    obsWebSocketService.onConnected(() => {
      setConnected(true);
      console.log('AudioMixer: OBS connected');
      // Auto-refresh sources when connected
      setTimeout(() => {
        refreshSources();
      }, 1000);
    });

    obsWebSocketService.onDisconnected(() => {
      setConnected(false);
      setAudioSources([]);
      setAudioLevels({});
      console.log('AudioMixer: OBS disconnected');
    });

    obsWebSocketService.onSourcesDiscovered((sources) => {
      console.log('AudioMixer: Sources discovered:', sources.length, sources);
      setAudioSources(sources);
    });

    obsWebSocketService.onAudioLevels((data) => {
      // Less verbose logging for audio levels
      if (Math.max(data.levels.left, data.levels.right) > -50) {
        console.log('AudioMixer: Audio levels received for', data.sourceName, ':', data.levels);
      }
      setAudioLevels(prev => ({
        ...prev,
        [data.sourceName]: data.levels
      }));
    });

    obsWebSocketService.onVolumeChanged((data) => {
      console.log('AudioMixer: Volume changed:', data);
      setAudioSources(prev => 
        prev.map(source => 
          source.name === data.sourceName 
            ? { ...source, volumeDb: data.volumeDb, volume: data.volume }
            : source
        )
      );
    });

    obsWebSocketService.onMuteChanged((data) => {
      console.log('AudioMixer: Mute changed:', data);
      setAudioSources(prev => 
        prev.map(source => 
          source.name === data.sourceName 
            ? { ...source, muted: data.muted }
            : source
        )
      );
    });

    // Setup MIDI callbacks
    midiService.onVolumeChange((data) => {
      handleMIDIVolumeChange(data);
    });

    midiService.onHotkeyAction((data) => {
      handleMIDIHotkeyAction(data);
    });

    midiService.onMIDIMessage((message) => {
      setLastMIDIActivity({
        ...message,
        timestamp: Date.now()
      });
    });
  }, []); 

  useEffect(() => {
    // Check initial connection states
    setConnected(obsWebSocketService.isConnected());
    
    // Only initialize MIDI if not already initialized
    if (!midiConnected) {
      initializeMIDI();
    }

    // Load Audio Mixer specific mappings
    loadAudioMixerMappings();

    // Cleanup function
    return () => {
      // Don't destroy services here as they're used by other components
    };
  }, []);

  const initializeMIDI = async () => {
    try {
      // Check if MIDI is already initialized
      if (midiService.midiAccess || midiService.connected) {
        console.log('MIDI already initialized, skipping...');
        setMidiConnected(true);
        return;
      }
      
      await midiService.initialize();
      setMidiConnected(true);
      console.log('AudioMixer: MIDI Service initialized');
    } catch (error) {
      console.error('AudioMixer: MIDI initialization failed:', error);
      setMidiConnected(false);
    }
  };

  // Load Audio Mixer specific mappings from localStorage
  const loadAudioMixerMappings = () => {
    try {
      const stored = localStorage.getItem('audioMixerMappings');
      if (stored) {
        const mappings = JSON.parse(stored);
        console.log('AudioMixer: Loading source mappings:', mappings);
        setSourceMidiMappings(mappings);
      }
    } catch (error) {
      console.error('AudioMixer: Failed to load source mappings:', error);
    }
  };

  // Save Audio Mixer specific mappings to localStorage
  const saveAudioMixerMappings = (mappings) => {
    try {
      localStorage.setItem('audioMixerMappings', JSON.stringify(mappings));
      console.log('AudioMixer: Saved source mappings:', mappings);
    } catch (error) {
      console.error('AudioMixer: Failed to save source mappings:', error);
    }
  };

  const handleMIDIVolumeChange = async (data) => {
    const { target, value, midiValue, dbValue } = data;
    
    console.log('AudioMixer: MIDI Volume Control received:', data);
    
    // Check if we're connected to OBS
    if (!connected) {
      console.log('AudioMixer: Not connected to OBS, skipping volume control');
      return;
    }
    
    // For direct source names (from AudioMixer learning)
    let sourceName = target;
    
    // If it's an application name, map it to OBS source
    if (['master', 'desktop', 'mic', 'discord', 'browser', 'game', 'music', 'alert'].includes(target)) {
      sourceName = obsWebSocketService.mapApplicationToSource(target);
    }
    
    console.log(`AudioMixer: Trying to set volume for source: ${sourceName} to ${value}dB`);
    
    // Try to find the exact source name from our sources list
    const exactSource = audioSources.find(source => 
      source.name === sourceName || 
      source.name.toLowerCase().includes(sourceName.toLowerCase())
    );
    
    if (exactSource) {
      sourceName = exactSource.name;
      console.log(`AudioMixer: Using exact source name: ${sourceName}`);
    }
    
    // Set volume in OBS
    const success = await obsWebSocketService.setVolume(sourceName, value);
    
    if (success) {
      console.log(`AudioMixer: MIDI Volume Control successful: ${sourceName} -> ${value}dB`);
    } else {
      console.error(`AudioMixer: MIDI Volume Control failed for: ${sourceName}`);
    }
  };

  const handleMIDIHotkeyAction = async (data) => {
    const { action, target } = data;
    
    switch (action) {
      case 'mute':
        const sourceName = obsWebSocketService.mapApplicationToSource(target);
        await obsWebSocketService.toggleMute(sourceName);
        break;
      case 'playPause':
        // Trigger in parent component or audio service
        window.dispatchEvent(new CustomEvent('midiHotkey', { 
          detail: { action: 'playPause' } 
        }));
        break;
      case 'nextSong':
        window.dispatchEvent(new CustomEvent('midiHotkey', { 
          detail: { action: 'nextSong' } 
        }));
        break;
      case 'prevSong':
        window.dispatchEvent(new CustomEvent('midiHotkey', { 
          detail: { action: 'prevSong' } 
        }));
        break;
      case 'shuffle':
        window.dispatchEvent(new CustomEvent('midiHotkey', { 
          detail: { action: 'shuffle' } 
        }));
        break;
      case 'moodSwap':
        window.dispatchEvent(new CustomEvent('midiHotkey', { 
          detail: { action: 'moodSwap', target } 
        }));
        break;
      case 'soundEffect':
        window.dispatchEvent(new CustomEvent('midiHotkey', { 
          detail: { action: 'soundEffect', target } 
        }));
        break;
      default:
        console.log('Unknown MIDI hotkey action:', action);
    }
  };

  // MIDI Learning Functions
  const startMidiLearning = (sourceName, type) => {
    console.log(`AudioMixer: Starting MIDI learning for ${sourceName} - ${type}`);
    setLearningMidi({ sourceName, type });
    
    // Start learning mode with proper callback
    midiService.startLearning((midiMessage) => {
      console.log(`AudioMixer: MIDI Learning completed: ${sourceName} ${type} -> CC${midiMessage.note}`);
      
      // Store the mapping locally in AudioMixer
      const newMappings = {
        ...sourceMidiMappings,
        [sourceName]: {
          ...sourceMidiMappings[sourceName],
          [type]: midiMessage.note.toString()
        }
      };
      
      setSourceMidiMappings(newMappings);
      saveAudioMixerMappings(newMappings);
      
      // Create MIDI mapping in service
      const midiKey = midiMessage.note.toString();
      
      if (type === 'volume') {
        const mapping = {
          type: 'volume',
          target: sourceName, // Use actual source name from OBS
          min: 0,
          max: 127
        };
        console.log(`AudioMixer: Creating volume mapping for key ${midiKey}:`, mapping);
        midiService.setMapping(midiKey, mapping);
      } else if (type === 'mute') {
        const mapping = {
          type: 'hotkey',
          action: 'mute',
          target: sourceName // Use actual source name from OBS
        };
        console.log(`AudioMixer: Creating mute mapping for key ${midiKey}:`, mapping);
        midiService.setMapping(midiKey, mapping);
      }
      
      // Stop learning
      setLearningMidi(null);
    });
  };

  const stopMidiLearning = () => {
    console.log('Stopping MIDI learning');
    setLearningMidi(null);
    midiService.stopLearning();
  };

  // Source visibility functions
  const toggleSourceVisibility = (sourceName) => {
    setHiddenSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceName)) {
        newSet.delete(sourceName);
      } else {
        newSet.add(sourceName);
      }
      return newSet;
    });
  };

  const showAllSources = () => {
    setHiddenSources(new Set());
  };

  const hideAllSources = () => {
    setHiddenSources(new Set(audioSources.map(s => s.name)));
  };

  const connectToOBS = async () => {
    // Use settings from central store
    if (!settings.obsWebSocketEnabled) {
      alert('OBS WebSocket is disabled. Enable it in Settings first.');
      return;
    }
    
    try {
      await obsWebSocketService.connect(
        settings.obsWebSocketHost,
        settings.obsWebSocketPort,
        settings.obsWebSocketPassword
      );
    } catch (error) {
      console.error('Failed to connect to OBS:', error);
      alert('Failed to connect to OBS. Please check your settings.');
    }
  };

  const refreshSources = async () => {
    if (connected) {
      try {
        await obsWebSocketService.discoverAudioSources();
      } catch (error) {
        console.error('Failed to refresh sources:', error);
      }
    }
  };

  const handleVolumeChange = async (sourceName, volumeDb) => {
    console.log(`AudioMixer: Setting volume for ${sourceName} to ${volumeDb}dB`);
    
    // Optimistic update für responsiveness
    setAudioSources(prev => 
      prev.map(source => 
        source.name === sourceName 
          ? { ...source, volumeDb: volumeDb }
          : source
      )
    );
    
    // Actual OBS update
    const success = await obsWebSocketService.setVolume(sourceName, volumeDb);
    if (!success) {
      console.error('Failed to set volume in OBS, reverting UI change');
      // Revert on failure (könnte hier die ursprünglichen Werte wiederherstellen)
    }
  };

  const handleMuteToggle = async (sourceName) => {
    console.log(`AudioMixer: Toggling mute for ${sourceName}`);
    
    // Optimistic update
    setAudioSources(prev => 
      prev.map(source => 
        source.name === sourceName 
          ? { ...source, muted: !source.muted }
          : source
      )
    );
    
    // Actual OBS update
    const success = await obsWebSocketService.toggleMute(sourceName);
    if (!success) {
      console.error('Failed to toggle mute in OBS, reverting UI change');
      // Revert on failure
      setAudioSources(prev => 
        prev.map(source => 
          source.name === sourceName 
            ? { ...source, muted: !source.muted }
            : source
        )
      );
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
    
    return (
      <div className="flex items-center space-x-2">
        {/* Mute Button with MIDI Learning */}
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
        </div>
        
        {/* Volume Slider with MIDI Learning */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs text-gray-400">
              {source.volumeDb?.toFixed(1) || '-60.0'} dB
            </div>
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
          </div>
          
          <input
            type="range"
            min="-60"
            max="0"
            step="0.1"
            value={source.volumeDb || -60}
            onChange={(e) => handleVolumeChange(source.name, parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          />
        </div>
      </div>
    );
  };

  const renderAudioMeter = (sourceName, levels) => {
    if (!levels) return null;

    const { left, right } = levels;
    const leftHeight = Math.max(0, (left + 60) / 60 * 100); // -60dB bis 0dB = 0% bis 100%
    const rightHeight = Math.max(0, (right + 60) / 60 * 100);

    return (
      <div className="flex space-x-1 h-16 w-8">
        {/* Left Channel */}
        <div className="relative w-3 bg-gray-800 rounded-sm overflow-hidden">
          <motion.div
            className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 via-yellow-500 to-red-500"
            initial={{ height: 0 }}
            animate={{ height: `${leftHeight}%` }}
            transition={{ type: "tween", duration: 0.1 }}
          />
          {/* Peak Indicator */}
          {levels.peak?.left && (
            <motion.div
              className="absolute w-full h-0.5 bg-white"
              style={{ 
                bottom: `${Math.max(0, (levels.peak.left + 60) / 60 * 100)}%` 
              }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
        </div>
        
        {/* Right Channel */}
        <div className="relative w-3 bg-gray-800 rounded-sm overflow-hidden">
          <motion.div
            className="absolute bottom-0 w-full bg-gradient-to-t from-green-500 via-yellow-500 to-red-500"
            initial={{ height: 0 }}
            animate={{ height: `${rightHeight}%` }}
            transition={{ type: "tween", duration: 0.1 }}
          />
          {/* Peak Indicator */}
          {levels.peak?.right && (
            <motion.div
              className="absolute w-full h-0.5 bg-white"
              style={{ 
                bottom: `${Math.max(0, (levels.peak.right + 60) / 60 * 100)}%` 
              }}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          )}
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
          </div>
        </div>
        
        <div className="flex space-x-2">
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
            </>
          )}
          
          {!connected && (
            <button
              onClick={connectToOBS}
              className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
              title="Connect to OBS (use Settings to configure)"
            >
              <Power className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* MIDI Activity Monitor */}
      {lastMIDIActivity && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-400 font-medium">MIDI Activity</span>
            <span className="text-xs text-gray-400">
              {new Date(lastMIDIActivity.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-xs text-blue-300 mt-1">
            {lastMIDIActivity.type} - CC/Note: {lastMIDIActivity.note} - Value: {lastMIDIActivity.velocity}
            {lastMIDIActivity.mock && ' (Keyboard Simulation)'}
          </div>
        </div>
      )}

      {/* Audio Sources */}
      {connected ? (
        <div className="flex-1 overflow-y-auto max-h-96">
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

                  {/* Audio Meter */}
                  <div className="flex items-center space-x-2">
                    {renderAudioMeter(source.name, audioLevels[source.name])}
                    
                    {/* Current Level Display */}
                    <div className="text-xs text-gray-400 w-12 text-right">
                      {audioLevels[source.name] ? (
                        <>
                          <div>{audioLevels[source.name].left.toFixed(0)}dB</div>
                          <div>{audioLevels[source.name].right.toFixed(0)}dB</div>
                        </>
                      ) : (
                        <div>-∞</div>
                      )}
                    </div>
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
                
                {/* Hidden Sources List (Expandable) */}
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

      {/* MIDI Info */}
      {midiConnected && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center space-x-2 text-blue-400 text-sm">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span>MIDI Controller Connected</span>
          </div>
          <p className="text-xs text-blue-300 mt-1">
            Use MIDI controls 1-8 for volume, 16-23 for hotkeys
          </p>
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
