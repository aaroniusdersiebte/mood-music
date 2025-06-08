import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMoodStore from './stores/moodStore';
import audioService from './services/audioService';
// import obsService from './services/obsService'; // ❌ ENTFERNT
import obsWebSocketService from './services/obsWebSocketService';
// import obsBrowserRefresh from './services/obsBrowserRefresh'; // ❌ ENTFERNT
import midiService from './services/midiService';
import globalStateService from './services/globalStateService';
// import integratedHTTPServer from './services/integratedHTTPServer'; // ❌ ENTFERNT
// import httpServerIntegrationService from './services/httpServerIntegrationService'; // ❌ ENTFERNT - Lokale Dateien only
import fileUtils from './utils/fileUtils';

// Components
import Sidebar from './components/Sidebar';
import MoodGrid from './components/MoodGrid';
import Player from './components/Player';
import Settings from './components/Settings';
import LoadingScreen from './components/LoadingScreen';
import AudioMixer from './components/AudioMixer';
import MIDIMapping from './components/MIDIMapping';

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

  const [currentView, setCurrentView] = useState('moods');
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
    const { action, target } = data;
    
    switch (action) {
      case 'playPause':
        setIsPlaying(!isPlaying);
        break;
      case 'nextSong':
        nextSong();
        break;
      case 'prevSong':
        // Add prevSong to store if needed
        console.log('Previous song triggered via MIDI');
        break;
      case 'shuffle':
        // Add shuffle toggle to store if needed
        console.log('Shuffle toggled via MIDI');
        // Could implement shuffle toggle here if needed
        break;
      case 'moodSwap':
        // Switch to specific mood
        const targetMood = moods.find(m => m.id === target || m.name.toLowerCase() === target?.toLowerCase());
        if (targetMood) {
          setActiveMood(targetMood.id);
          console.log(`Switched to mood: ${targetMood.name}`);
        } else {
          console.log(`Mood not found: ${target}`);
        }
        break;
      case 'mute':
        // Global mute handling
        globalStateService.toggleMute(target, 'MIDI');
        break;
      case 'soundEffect':
        console.log('Sound effect triggered via MIDI:', target);
        // Add sound effect logic if needed
        break;
      default:
        console.log('Unknown MIDI hotkey:', action);
    }
  };

  // Listen for custom MIDI events from components
  useEffect(() => {
    const handleCustomMIDIEvent = (event) => {
      handleMIDIHotkey(event.detail);
    };
    
    window.addEventListener('midiHotkey', handleCustomMIDIEvent);
    
    return () => {
      window.removeEventListener('midiHotkey', handleCustomMIDIEvent);
    };
  }, [isPlaying, moods]);

  // Initialize app with GlobalStateService
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('App: Starting global initialization...');
        
        // Make GlobalStateService available globally for services
        window.globalStateService = globalStateService;
        
        // Make useMoodStore globally available
        window.useMoodStore = useMoodStore;
        
        // Make OBS services globally available
        window.obsWebSocketService = obsWebSocketService;
        // window.obsBrowserRefresh = obsBrowserRefresh; // ❌ ENTFERNT
        
        // ❌ HTTP Server komplett entfernt - verwende nur lokale Datei-Updates
        
        // Ensure data directories exist
        await fileUtils.ensureDataDirectories();
        
        // Load saved mappings first
        globalStateService.loadMappings();
        
        // Initialize MIDI globally
        if (settings.midiEnabled) {
          try {
            console.log('App: Initializing MIDI globally...');
            await midiService.initialize();
            
            // Register MIDI service with global state
            globalStateService.registerService('midi', midiService);
            
            // Update MIDI state
            globalStateService.updateMIDIState({
              connected: true,
              devices: midiService.getAvailableDevices()
            });
            
            // Sync any existing mappings from MIDI service to GlobalStateService
            const existingMappings = midiService.getAllMappings();
            Object.entries(existingMappings).forEach(([key, mapping]) => {
              globalStateService.setMIDIMapping(key, mapping, 'MIDIService');
            });
            
            // Setup global MIDI callbacks
            midiService.onHotkeyAction((data) => {
              console.log('App: Global MIDI hotkey received:', data);
              handleMIDIHotkey(data);
            });
            
            midiService.onVolumeChange((data) => {
              console.log('App: Global MIDI volume change:', data);
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
            
            console.log('App: MIDI Service initialized and registered globally');
          } catch (error) {
            console.log('App: MIDI not available:', error.message);
            globalStateService.updateMIDIState({ connected: false });
          }
        }
        
        // Initialize OBS WebSocket
        if (settings.obsWebSocketEnabled) {
          try {
            console.log('App: Initializing OBS WebSocket globally...');
            
            // Register OBS service with global state
            globalStateService.registerService('obs', obsWebSocketService);
            
            // Setup global OBS callbacks
            obsWebSocketService.onConnected(() => {
              console.log('App: OBS connected globally');
              globalStateService.updateOBSState({ connected: true });
              
              // Auto-discover sources
              setTimeout(() => {
                obsWebSocketService.discoverAudioSources();
              }, 1000);
            });
            
            obsWebSocketService.onDisconnected(() => {
              console.log('App: OBS disconnected globally');
              globalStateService.updateOBSState({
                connected: false,
                sources: [],
                audioLevels: {}
              });
            });
            
            obsWebSocketService.onSourcesDiscovered((sources) => {
              console.log('App: OBS sources discovered globally:', sources.length);
              globalStateService.updateOBSState({ sources });
            });
            
            obsWebSocketService.onAudioLevels((data) => {
              // Only log when there's meaningful audio
              if (Math.max(data.levels.left, data.levels.right) > -50) {
                //console.log('App: Audio levels received globally:', data.sourceName, data.levels);
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
              console.log('App: OBS volume changed globally:', data);
              const currentSources = globalStateService.getAudioSources();
              const updatedSources = currentSources.map(source => 
                source.name === data.sourceName 
                  ? { ...source, volumeDb: data.volumeDb, volume: data.volume }
                  : source
              );
              globalStateService.updateOBSState({ sources: updatedSources });
            });
            
            obsWebSocketService.onMuteChanged((data) => {
              console.log('App: OBS mute changed globally:', data);
              const currentSources = globalStateService.getAudioSources();
              const updatedSources = currentSources.map(source => 
                source.name === data.sourceName 
                  ? { ...source, muted: data.muted }
                  : source
              );
              globalStateService.updateOBSState({ sources: updatedSources });
            });
            
            // Connect to OBS
            await obsWebSocketService.connect(
              settings.obsWebSocketHost,
              settings.obsWebSocketPort,
              settings.obsWebSocketPassword
            );
            
            console.log('App: OBS WebSocket initialized and registered globally');
            
            // 🎯 Browser Source Refresh ist jetzt direkt in obsWebSocketService integriert!
            console.log('🎯 OBS Browser Source Refresh ist jetzt verfügbar!');
            console.log('🧪 Test mit: window.obsWebSocketService.testBrowserSourceRefresh()');
          } catch (error) {
            console.log('App: OBS WebSocket not available:', error.message);
            globalStateService.updateOBSState({ connected: false });
          }
        }
        
        // ❌ OBS Service entfernt - verwende nur obsWebSocketService

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

        // Set initial volume
        audioService.setVolume(volume);

        setIsLoading(false);
        console.log('App: Global initialization completed');
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
        // obsService.stopServer(); // ❌ ENTFERNT
        obsWebSocketService.destroy();
        // obsBrowserRefresh.destroy(); // ❌ ENTFERNT
        globalStateService.destroy();
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
          
          // 🎯 SINGLE UPDATE: OBS Display + Browser Source Refresh
          const currentMood = moods.find(m => m.id === activeMood);
          if (currentMood && settings.obsWebSocketEnabled) {
            try {
              // Einziger Update-Aufruf - obsWebSocketService macht alles:
              // 1. Schreibt OBS Data (LocalStorage)
              // 2. Refreshed Browser Sources automatisch
              await obsWebSocketService.updateSongDisplay(currentSong, currentMood, settings);
              
              console.log('🎵 Song display updated + Browser sources refreshed automatically');
            } catch (error) {
              console.log('Failed to update OBS song display:', error.message);
            }
          } else if (currentMood) {
            // Fallback für wenn OBS WebSocket nicht aktiviert ist
            console.log('⚠️ OBS WebSocket nicht aktiviert - aktiviere es in Settings für Browser Source Refresh');
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
            {currentView === 'moods' && <MoodGrid />}
            {currentView === 'audio' && <AudioMixer />}
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