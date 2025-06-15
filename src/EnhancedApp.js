import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMoodStore from './stores/moodStore';
import audioService from './services/audioService';
import obsWebSocketService from './services/obsWebSocketService';
import midiService from './services/midiService';
import enhancedGlobalStateService from './services/enhancedGlobalStateService'; // Enhanced Service
import configService from './services/configService';
import fileUtils from './utils/fileUtils';

// Components
import Sidebar from './components/Sidebar';
import MoodGrid from './components/MoodGrid';
import Player from './components/Player';
import Settings from './components/Settings';
import LoadingScreen from './components/LoadingScreen';
import AudioMixer from './components/AudioMixer';

import OptimizedHotkeyDeckManager from './components/OptimizedHotkeyDeckManager';
import EnhancedModularDashboard from './components/EnhancedModularDashboard'; // Enhanced Dashboard

// Styles
import './App.css';

function App() {
  const {
    moods,
    activeMood,
    currentSong,
    isPlaying,
    volume,
    settings,
    setIsPlaying,
    setCurrentSong,
    setActiveMood,
    nextSong,
    updateSettings
  } = useMoodStore();

  const [currentView, setCurrentView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState({ obs: false, midi: false });
  const [initializationProgress, setInitializationProgress] = useState({
    step: 'Starting...',
    progress: 0
  });

  // Enhanced Global Event Handlers
  const handleGlobalVolumeChange = async (data) => {
    console.log('Enhanced App: Handling global volume change:', data);
    
    const { target, value, mapping } = data;
    
    try {
      const success = await enhancedGlobalStateService.setVolume(target, value, 'MIDI');
      
      if (success) {
        console.log(`Enhanced App: Volume control successful: ${target} -> ${value}dB`);
      } else {
        console.error(`Enhanced App: Volume control failed for: ${target}`);
      }
    } catch (error) {
      console.error('Enhanced App: Volume change error:', error);
    }
  };

  const handleMIDIHotkey = (data) => {
    const { action, target, customCommand } = data;
    
    console.log('Enhanced App: MIDI hotkey received:', { action, target, customCommand });
    
    switch (action) {
      case 'playPause':
        setIsPlaying(!isPlaying);
        break;
      case 'nextSong':
        nextSong();
        break;
      case 'prevSong':
        // Implement previous song functionality
        console.log('Previous song triggered via MIDI');
        break;
      case 'shuffle':
        // Implement shuffle functionality
        console.log('Shuffle toggled via MIDI');
        break;
      case 'moodSwap':
        const targetMood = moods.find(m => 
          m.id === target || 
          m.name.toLowerCase() === target?.toLowerCase()
        );
        if (targetMood) {
          setActiveMood(targetMood.id);
          console.log(`Enhanced App: Switched to mood: ${targetMood.name}`);
        } else {
          console.log(`Enhanced App: Mood not found: ${target}`);
        }
        break;
      case 'mute':
        enhancedGlobalStateService.toggleMute(target, 'MIDI');
        break;
      case 'soundEffect':
        console.log('Enhanced App: Sound effect triggered via MIDI:', target);
        break;
      case 'custom':
        console.log('Enhanced App: Custom action triggered:', customCommand);
        break;
      default:
        console.log('Enhanced App: Unknown MIDI hotkey:', action);
    }
  };
  
  const handleMusicAction = (data) => {
    const { action, target } = data;
    
    console.log('Enhanced App: Music action received:', { action, target });
    
    switch (action) {
      case 'playPause':
        setIsPlaying(!isPlaying);
        break;
      case 'nextSong':
        nextSong();
        break;
      case 'prevSong':
        // Implement previous song
        console.log('Enhanced App: Previous song requested');
        break;
      case 'volumeUp':
        const newVolumeUp = Math.min(volume + 0.1, 1);
        updateSettings({ volume: newVolumeUp });
        console.log('Enhanced App: Volume up:', newVolumeUp);
        break;
      case 'volumeDown':
        const newVolumeDown = Math.max(volume - 0.1, 0);
        updateSettings({ volume: newVolumeDown });
        console.log('Enhanced App: Volume down:', newVolumeDown);
        break;
      case 'shuffle':
        // Implement shuffle
        console.log('Enhanced App: Shuffle toggled');
        break;
      default:
        console.log('Enhanced App: Unknown music action:', action);
    }
  };
  
  const handleOBSAction = async (data) => {
    const { action, target } = data;
    
    console.log('Enhanced App: OBS action received:', { action, target });
    
    if (!enhancedGlobalStateService.isOBSConnected()) {
      console.warn('Enhanced App: OBS not connected, cannot execute action:', action);
      return;
    }
    
    try {
      const obsService = enhancedGlobalStateService.services.obs;
      if (!obsService || !obsService.obs) {
        console.error('Enhanced App: OBS service not available');
        return;
      }

      switch (action) {
        case 'sceneSwitch':
          if (target) {
            await obsService.obs.call('SetCurrentProgramScene', { sceneName: target });
            console.log('Enhanced App: Scene switched to:', target);
          }
          break;
        case 'sourceToggle':
          if (target) {
            const currentState = await obsService.obs.call('GetSourceActive', { sourceName: target });
            await obsService.obs.call('SetSourceFilterEnabled', {
              sourceName: target,
              filterName: 'Toggle',
              filterEnabled: !currentState.videoActive
            });
            console.log('Enhanced App: Source toggled:', target);
          }
          break;
        case 'startRecord':
          await obsService.obs.call('StartRecord');
          console.log('Enhanced App: Recording started');
          break;
        case 'stopRecord':
          await obsService.obs.call('StopRecord');
          console.log('Enhanced App: Recording stopped');
          break;
        case 'startStream':
          await obsService.obs.call('StartStream');
          console.log('Enhanced App: Streaming started');
          break;
        case 'stopStream':
          await obsService.obs.call('StopStream');
          console.log('Enhanced App: Streaming stopped');
          break;
        default:
          console.log('Enhanced App: Unknown OBS action:', action);
      }
    } catch (error) {
      console.error('Enhanced App: OBS action failed:', error);
    }
  };

  const handleHotkeyAction = (data) => {
    const { action, target, customCommand } = data;
    
    console.log('Enhanced App: Hotkey action received:', { action, target, customCommand });
    
    // Execute keyboard shortcut or custom command
    if (customCommand) {
      // Handle custom commands
      console.log('Enhanced App: Executing custom command:', customCommand);
    } else {
      // Handle standard hotkey actions
      handleMIDIHotkey({ action, target });
    }
  };

  const handleMoodPlayback = (event) => {
    const { mood } = event.detail;
    console.log('Enhanced App: Mood playback requested:', mood.name);
    
    setActiveMood(mood.id);
    
    // Auto-play first song from mood if available
    if (mood.songs && mood.songs.length > 0) {
      setCurrentSong(mood.songs[0]);
      setIsPlaying(true);
    }
  };

  // Enhanced Event Listeners Setup
  useEffect(() => {
    console.log('Enhanced App: Setting up event listeners...');
    
    const handleHotkeyDeckAction = (event) => {
      const { action, target, type, customCommand } = event.detail;
      console.log('Enhanced App: HotkeyDeck action received:', event.detail);
      
      // Route different action types to appropriate handlers
      switch (type) {
        case 'hotkey':
          handleHotkeyAction({ action, target, customCommand });
          break;
        case 'music':
          handleMusicAction({ action, target });
          break;
        case 'obs':
          handleOBSAction({ action, target });
          break;
        case 'volume':
          handleGlobalVolumeChange({ target, value: target });
          break;
        default:
          console.log('Enhanced App: Unknown action type:', type);
      }
    };
    
    const handleMIDIEvent = (event) => {
      handleMIDIHotkey(event.detail);
    };
    
    const handleSimulateKeyboard = (event) => {
      const { keys, modifier } = event.detail;
      console.log('Enhanced App: Simulating keyboard shortcut:', { keys, modifier });
      
      // Simulate keyboard events
      // This would integrate with a keyboard simulation library
    };
    
    // Register event listeners
    window.addEventListener('hotkeyDeckAction', handleHotkeyDeckAction);
    window.addEventListener('midiHotkey', handleMIDIEvent);
    window.addEventListener('simulateKeyboard', handleSimulateKeyboard);
    window.addEventListener('playMood', handleMoodPlayback);
    window.addEventListener('shuffleMood', handleMoodPlayback);
    
    return () => {
      window.removeEventListener('hotkeyDeckAction', handleHotkeyDeckAction);
      window.removeEventListener('midiHotkey', handleMIDIEvent);
      window.removeEventListener('simulateKeyboard', handleSimulateKeyboard);
      window.removeEventListener('playMood', handleMoodPlayback);
      window.removeEventListener('shuffleMood', handleMoodPlayback);
    };
  }, [isPlaying, moods, volume]);

  // Enhanced App Initialization
  useEffect(() => {
    const initializeEnhancedApp = async () => {
      try {
        console.log('Enhanced App: Starting enhanced initialization...');
        setInitializationProgress({ step: 'Initializing core services...', progress: 10 });
        
        // Make enhanced services globally available
        window.enhancedGlobalStateService = enhancedGlobalStateService;
        window.configService = configService;
        window.useMoodStore = useMoodStore;
        window.obsWebSocketService = obsWebSocketService;
        
        // Initialize ConfigService
        setInitializationProgress({ step: 'Loading configuration...', progress: 20 });
        await configService.initializeConfig?.();
        console.log('Enhanced App: ConfigService initialized');
        
        // Ensure data directories exist
        setInitializationProgress({ step: 'Setting up data directories...', progress: 30 });
        await fileUtils.ensureDataDirectories();
        
        // Load saved mappings
        setInitializationProgress({ step: 'Loading saved mappings...', progress: 40 });
        enhancedGlobalStateService.loadMappings();
        
        // Initialize MIDI if enabled
        if (settings.midiEnabled) {
          try {
            setInitializationProgress({ step: 'Initializing MIDI...', progress: 50 });
            console.log('Enhanced App: Initializing MIDI globally...');
            
            await midiService.initialize();
            
            enhancedGlobalStateService.registerService('midi', midiService);
            enhancedGlobalStateService.updateMIDIState({
              connected: true,
              devices: midiService.getAvailableDevices()
            });
            
            // Sync existing MIDI mappings
            const existingMappings = midiService.getAllMappings();
            Object.entries(existingMappings).forEach(([key, mapping]) => {
              enhancedGlobalStateService.setMIDIMapping(key, mapping, 'MIDIService');
            });
            
            // Set up MIDI event handlers
            midiService.onHotkeyAction(handleMIDIHotkey);
            midiService.onVolumeChange(handleGlobalVolumeChange);
            midiService.onMIDIMessage((message) => {
              enhancedGlobalStateService.updateMIDIState({
                lastActivity: {
                  ...message,
                  timestamp: Date.now()
                }
              });
            });
            
            setConnectionStatus(prev => ({ ...prev, midi: true }));
            console.log('Enhanced App: MIDI Service initialized successfully');
          } catch (error) {
            console.log('Enhanced App: MIDI not available:', error.message);
            enhancedGlobalStateService.updateMIDIState({ connected: false });
            setConnectionStatus(prev => ({ ...prev, midi: false }));
          }
        }
        
        // Initialize OBS WebSocket
        if (settings.obsWebSocketEnabled) {
          try {
            setInitializationProgress({ step: 'Connecting to OBS...', progress: 60 });
            console.log('Enhanced App: Initializing OBS WebSocket...');
            
            enhancedGlobalStateService.registerService('obs', obsWebSocketService);
            
            // Set up OBS event handlers
            obsWebSocketService.onConnected(() => {
              console.log('Enhanced App: OBS connected successfully');
              enhancedGlobalStateService.updateOBSState({ connected: true });
              setConnectionStatus(prev => ({ ...prev, obs: true }));
              
              // Trigger initial discovery
              setTimeout(() => {
                enhancedGlobalStateService.discoverOBSDataWithCaching();
              }, 1000);
            });
            
            obsWebSocketService.onDisconnected(() => {
              console.log('Enhanced App: OBS disconnected');
              enhancedGlobalStateService.updateOBSState({
                connected: false,
                sources: [],
                audioLevels: {},
                scenes: []
              });
              setConnectionStatus(prev => ({ ...prev, obs: false }));
            });
            
            obsWebSocketService.onSourcesDiscovered((sources) => {
              console.log('Enhanced App: OBS sources discovered:', sources.length);
              enhancedGlobalStateService.updateOBSState({ 
                sources, 
                lastSourceDiscovery: Date.now() 
              });
            });
            
            obsWebSocketService.onAudioLevels((data) => {
              // Forward to enhanced global state service with throttling
              enhancedGlobalStateService.updateAudioLevels(data.sourceName, data.levels);
            });
            
            obsWebSocketService.onVolumeChanged((data) => {
              console.log('Enhanced App: OBS volume changed:', data);
              enhancedGlobalStateService.updateSourceVolume(data.sourceName, data.volumeDb);
            });
            
            obsWebSocketService.onMuteChanged((data) => {
              console.log('Enhanced App: OBS mute changed:', data);
              // Update source mute state
              const currentSources = enhancedGlobalStateService.getAudioSources();
              const updatedSources = currentSources.map(source => 
                source.name === data.sourceName 
                  ? { ...source, muted: data.muted }
                  : source
              );
              enhancedGlobalStateService.updateOBSState({ sources: updatedSources });
            });
            
            // Connect to OBS
            await obsWebSocketService.connect(
              settings.obsWebSocketHost || 'localhost',
              settings.obsWebSocketPort || 4455,
              settings.obsWebSocketPassword || ''
            );
            
            console.log('Enhanced App: OBS WebSocket initialized successfully');
          } catch (error) {
            console.log('Enhanced App: OBS WebSocket not available:', error.message);
            enhancedGlobalStateService.updateOBSState({ connected: false });
            setConnectionStatus(prev => ({ ...prev, obs: false }));
          }
        }

        // Initialize Audio Service
        setInitializationProgress({ step: 'Setting up audio service...', progress: 80 });
        
        audioService.onSongEndCallback(() => {
          nextSong();
        });

        audioService.onLoadCallback((song) => {
          console.log('Enhanced App: Song loaded:', song.title);
        });

        audioService.onErrorCallback((error) => {
          console.error('Enhanced App: Audio error:', error);
          setIsPlaying(false);
        });

        audioService.setVolume(volume);

        setInitializationProgress({ step: 'Initialization complete!', progress: 100 });
        
        // Complete initialization
        setTimeout(() => {
          setIsLoading(false);
          console.log('Enhanced App: Enhanced initialization completed successfully');
        }, 500);
        
      } catch (error) {
        console.error('Enhanced App: Failed to initialize:', error);
        setInitializationProgress({ step: 'Initialization failed', progress: 100 });
        setTimeout(() => setIsLoading(false), 1000);
      }
    };

    initializeEnhancedApp();

    // Enhanced cleanup on unmount
    return () => {
      console.log('Enhanced App: Starting cleanup...');
      
      try {
        audioService.destroy();
        obsWebSocketService.destroy();
        enhancedGlobalStateService.destroy();
        configService.destroy?.();
        
        console.log('Enhanced App: Cleanup completed');
      } catch (error) {
        console.log('Enhanced App: Error during cleanup:', error.message);
      }
    };
  }, []);

  // Enhanced Song Change Handler
  useEffect(() => {
    if (currentSong) {
      const handleEnhancedSongChange = async () => {
        try {
          console.log('Enhanced App: Handling song change:', currentSong.title);
          
          await audioService.loadSong(currentSong);
          
          if (isPlaying) {
            audioService.play();
          }
          
          // Enhanced OBS integration with better error handling
          const currentMood = moods.find(m => m.id === activeMood);
          if (currentMood && settings.obsWebSocketEnabled && enhancedGlobalStateService.isOBSConnected()) {
            try {
              await obsWebSocketService.updateSongDisplay(currentSong, currentMood, settings);
              console.log('Enhanced App: Song display updated with browser source refresh');
            } catch (error) {
              console.log('Enhanced App: Failed to update OBS song display:', error.message);
            }
          }
        } catch (error) {
          console.error('Enhanced App: Failed to load song:', error);
          setIsPlaying(false);
        }
      };
      
      handleEnhancedSongChange();
    }
  }, [currentSong, activeMood, moods, settings.obsWebSocketEnabled]);

  // Enhanced Playback Control
  useEffect(() => {
    if (isPlaying) {
      audioService.play();
    } else {
      audioService.pause();
    }
  }, [isPlaying]);

  // Enhanced Volume Control
  useEffect(() => {
    audioService.setVolume(volume);
  }, [volume]);

  // Enhanced Loading Screen
  if (isLoading) {
    return (
      <LoadingScreen 
        progress={initializationProgress.progress}
        message={initializationProgress.step}
        enhanced={true}
      />
    );
  }

  return (
    <div className="flex h-screen bg-primary text-white overflow-hidden">
      {/* Enhanced Sidebar with Connection Status */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView}
        connectionStatus={connectionStatus}
        enhancedMode={true}
      />

      {/* Enhanced Main Content */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex-1 overflow-hidden"
          >
            {currentView === 'dashboard' && <EnhancedModularDashboard />}
            {currentView === 'moods' && <MoodGrid />}
            {currentView === 'audio' && <AudioMixer />}
            {currentView === 'hotkeys' && <OptimizedHotkeyDeckManager />}
            {currentView === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>

        {/* Enhanced Player with Connection Status */}
        <Player 
          connectionStatus={connectionStatus}
          enhancedMode={true}
        />
      </div>
    </div>
  );
}

export default App;
