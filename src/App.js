import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMoodStore from './stores/moodStore';
import audioService from './services/audioService';
import obsWebSocketService from './services/obsWebSocketService';
import midiService from './services/midiService';
import globalStateService from './services/globalStateService';
import configService from './services/configService'; // NEW: File-based config
import fileUtils from './utils/fileUtils';

// Components
import Sidebar from './components/Sidebar';
import MoodGrid from './components/MoodGrid';
import Player from './components/Player';
import Settings from './components/Settings';
import LoadingScreen from './components/LoadingScreen';
import AudioMixer from './components/AudioMixer';
import MIDIMapping from './components/MIDIMapping';
import HotkeyDeckManager from './components/HotkeyDeckManager';
import OptimizedHotkeyDeckManager from './components/OptimizedHotkeyDeckManager'; // NEW: MIDI-free version
import ModularDashboard from './components/ModularDashboard'; // NEW: Modular dashboard

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

  const [currentView, setCurrentView] = useState('dashboard'); // NEW: Start with dashboard
  const [isLoading, setIsLoading] = useState(true);

  // Global MIDI Volume Change Handler
  const handleGlobalVolumeChange = async (data) => {
    console.log('App: Handling global MIDI volume change:', data);
    
    const { target, value, mapping } = data;
    
    // Use GlobalStateService for volume control
    const success = await globalStateService.setVolume(target, value, 'MIDI');
    
    if (success) {
      console.log(`App: Global volume control successful: ${target} -> ${value}dB`);
    } else {
      console.error(`App: Global volume control failed for: ${target}`);
    }
  };

  // MIDI Hotkey Handler
  const handleMIDIHotkey = (data) => {
    const { action, target, customCommand } = data;
    
    switch (action) {
      case 'playPause':
        setIsPlaying(!isPlaying);
        break;
      case 'nextSong':
        nextSong();
        break;
      case 'prevSong':
        console.log('Previous song triggered via MIDI');
        break;
      case 'shuffle':
        console.log('Shuffle toggled via MIDI');
        break;
      case 'moodSwap':
        const targetMood = moods.find(m => m.id === target || m.name.toLowerCase() === target?.toLowerCase());
        if (targetMood) {
          setActiveMood(targetMood.id);
          console.log(`Switched to mood: ${targetMood.name}`);
        } else {
          console.log(`Mood not found: ${target}`);
        }
        break;
      case 'mute':
        globalStateService.toggleMute(target, 'MIDI');
        break;
      case 'soundEffect':
        console.log('Sound effect triggered via MIDI:', target);
        break;
      case 'custom':
        console.log('Custom action triggered:', customCommand);
        break;
      default:
        console.log('Unknown MIDI hotkey:', action);
    }
  };
  
  // Music Action Handler
  const handleMusicAction = (data) => {
    const { action, target } = data;
    
    switch (action) {
      case 'playPause':
        setIsPlaying(!isPlaying);
        break;
      case 'nextSong':
        nextSong();
        break;
      case 'volumeUp':
        const newVolumeUp = Math.min(volume + 0.1, 1);
        updateSettings({ volume: newVolumeUp });
        break;
      case 'volumeDown':
        const newVolumeDown = Math.max(volume - 0.1, 0);
        updateSettings({ volume: newVolumeDown });
        break;
      default:
        console.log('Unknown music action:', action);
    }
  };
  
  // OBS Action Handler
  const handleOBSAction = (data) => {
    const { action, target } = data;
    
    if (!globalStateService.isOBSConnected()) {
      console.warn('OBS not connected, cannot execute action:', action);
      return;
    }
    
    switch (action) {
      case 'sceneSwitch':
        console.log('Scene switch requested:', target);
        break;
      case 'sourceToggle':
        console.log('Source toggle requested:', target);
        break;
      case 'startRecord':
        console.log('Start recording requested');
        break;
      case 'stopRecord':
        console.log('Stop recording requested');
        break;
      case 'startStream':
        console.log('Start streaming requested');
        break;
      case 'stopStream':
        console.log('Stop streaming requested');
        break;
      default:
        console.log('Unknown OBS action:', action);
    }
  };

  // Mood Playback Handler
  const handleMoodPlayback = (event) => {
    const { mood } = event.detail;
    console.log('App: Mood playback requested:', mood.name);
    setActiveMood(mood.id);
    
    // Optional: Auto-play first song from mood
    if (mood.songs && mood.songs.length > 0) {
      setCurrentSong(mood.songs[0]);
      setIsPlaying(true);
    }
  };

  // Listen for custom events from components
  useEffect(() => {
    const handleCustomMIDIEvent = (event) => {
      handleMIDIHotkey(event.detail);
    };
    
    const handleHotkeyDeckAction = (event) => {
      const { action, target, type } = event.detail;
      console.log('App: HotkeyDeck action received:', event.detail);
      
      // Route different action types
      if (type === 'hotkey') {
        handleMIDIHotkey({ action, target });
      } else if (type === 'music') {
        handleMusicAction({ action, target });
      } else if (type === 'obs') {
        handleOBSAction({ action, target });
      }
    };
    
    window.addEventListener('midiHotkey', handleCustomMIDIEvent);
    window.addEventListener('hotkeyDeckAction', handleHotkeyDeckAction);
    window.addEventListener('playMood', handleMoodPlayback);
    window.addEventListener('shuffleMood', handleMoodPlayback);
    
    return () => {
      window.removeEventListener('midiHotkey', handleCustomMIDIEvent);
      window.removeEventListener('hotkeyDeckAction', handleHotkeyDeckAction);
      window.removeEventListener('playMood', handleMoodPlayback);
      window.removeEventListener('shuffleMood', handleMoodPlayback);
    };
  }, [isPlaying, moods]);

  // Initialize app with enhanced services
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('App: Starting enhanced initialization...');
        
        // Make services globally available
        window.globalStateService = globalStateService;
        window.configService = configService;
        window.useMoodStore = useMoodStore;
        window.obsWebSocketService = obsWebSocketService;
        
        // Initialize ConfigService first
        await configService.initializeConfig?.();
        console.log('App: ConfigService initialized');
        
        // Ensure data directories exist
        await fileUtils.ensureDataDirectories();
        
        // Load saved mappings
        globalStateService.loadMappings();
        
        // Initialize MIDI globally (optional)
        if (settings.midiEnabled) {
          try {
            console.log('App: Initializing MIDI globally...');
            await midiService.initialize();
            
            globalStateService.registerService('midi', midiService);
            globalStateService.updateMIDIState({
              connected: true,
              devices: midiService.getAvailableDevices()
            });
            
            const existingMappings = midiService.getAllMappings();
            Object.entries(existingMappings).forEach(([key, mapping]) => {
              globalStateService.setMIDIMapping(key, mapping, 'MIDIService');
            });
            
            midiService.onHotkeyAction((data) => {
              handleMIDIHotkey(data);
            });
            
            midiService.onVolumeChange((data) => {
              handleGlobalVolumeChange(data);
            });
            
            midiService.onMIDIMessage((message) => {
              globalStateService.updateMIDIState({
                lastActivity: {
                  ...message,
                  timestamp: Date.now()
                }
              });
            });
            
            console.log('App: MIDI Service initialized');
          } catch (error) {
            console.log('App: MIDI not available:', error.message);
            globalStateService.updateMIDIState({ connected: false });
          }
        }
        
        // Initialize OBS WebSocket
        if (settings.obsWebSocketEnabled) {
          try {
            console.log('App: Initializing OBS WebSocket...');
            
            globalStateService.registerService('obs', obsWebSocketService);
            
            obsWebSocketService.onConnected(() => {
              console.log('App: OBS connected');
              globalStateService.updateOBSState({ connected: true });
              
              setTimeout(() => {
                obsWebSocketService.discoverAudioSources();
              }, 1000);
            });
            
            obsWebSocketService.onDisconnected(() => {
              console.log('App: OBS disconnected');
              globalStateService.updateOBSState({
                connected: false,
                sources: [],
                audioLevels: {}
              });
            });
            
            obsWebSocketService.onSourcesDiscovered((sources) => {
              console.log('App: OBS sources discovered:', sources.length);
              globalStateService.updateOBSState({ sources });
            });
            
            obsWebSocketService.onAudioLevels((data) => {
              if (Math.max(data.levels.left, data.levels.right) > -50) {
                // Audio level processing
              }
              
              const currentLevels = globalStateService.getAudioLevels();
              globalStateService.updateOBSState({
                audioLevels: {
                  ...currentLevels,
                  [data.sourceName]: data.levels
                }
              });
            });
            
            obsWebSocketService.onVolumeChanged((data) => {
              console.log('App: OBS volume changed:', data);
              const currentSources = globalStateService.getAudioSources();
              const updatedSources = currentSources.map(source => 
                source.name === data.sourceName 
                  ? { ...source, volumeDb: data.volumeDb, volume: data.volume }
                  : source
              );
              globalStateService.updateOBSState({ sources: updatedSources });
            });
            
            obsWebSocketService.onMuteChanged((data) => {
              console.log('App: OBS mute changed:', data);
              const currentSources = globalStateService.getAudioSources();
              const updatedSources = currentSources.map(source => 
                source.name === data.sourceName 
                  ? { ...source, muted: data.muted }
                  : source
              );
              globalStateService.updateOBSState({ sources: updatedSources });
            });
            
            await obsWebSocketService.connect(
              settings.obsWebSocketHost,
              settings.obsWebSocketPort,
              settings.obsWebSocketPassword
            );
            
            console.log('App: OBS WebSocket initialized');
          } catch (error) {
            console.log('App: OBS WebSocket not available:', error.message);
            globalStateService.updateOBSState({ connected: false });
          }
        }

        // Setup audio service callbacks
        audioService.onSongEndCallback(() => {
          nextSong();
        });

        audioService.onLoadCallback((song) => {
          console.log('Song loaded:', song.title);
        });

        audioService.onErrorCallback((error) => {
          console.error('Audio error:', error);
          setIsPlaying(false);
        });

        audioService.setVolume(volume);

        setIsLoading(false);
        console.log('App: Enhanced initialization completed');
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setIsLoading(false);
      }
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      audioService.destroy();
      try {
        obsWebSocketService.destroy();
        globalStateService.destroy();
        configService.destroy?.();
      } catch (error) {
        console.log('Error during cleanup:', error.message);
      }
    };
  }, []);

  // Handle song changes
  useEffect(() => {
    if (currentSong) {
      const handleSongChange = async () => {
        try {
          await audioService.loadSong(currentSong);
          
          if (isPlaying) {
            audioService.play();
          }
          
          // Enhanced OBS integration
          const currentMood = moods.find(m => m.id === activeMood);
          if (currentMood && settings.obsWebSocketEnabled) {
            try {
              await obsWebSocketService.updateSongDisplay(currentSong, currentMood, settings);
              console.log('Song display updated + Browser sources refreshed');
            } catch (error) {
              console.log('Failed to update OBS song display:', error.message);
            }
          }
        } catch (error) {
          console.error('Failed to load song:', error);
          setIsPlaying(false);
        }
      };
      
      handleSongChange();
    }
  }, [currentSong]);

  // Handle play/pause
  useEffect(() => {
    if (isPlaying) {
      audioService.play();
    } else {
      audioService.pause();
    }
  }, [isPlaying]);

  // Handle volume changes
  useEffect(() => {
    audioService.setVolume(volume);
  }, [volume]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex h-screen bg-primary text-white overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView}
      />

      {/* Main Content */}
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
            {currentView === 'dashboard' && <ModularDashboard />}
            {currentView === 'moods' && <MoodGrid />}
            {currentView === 'audio' && <AudioMixer />}
            {currentView === 'hotkeys' && <OptimizedHotkeyDeckManager />}
            {currentView === 'midi' && <MIDIMapping />}
            {currentView === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>

        {/* Player */}
        <Player />
      </div>
    </div>
  );
}

export default App;