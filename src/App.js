import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMoodStore from './stores/moodStore';
import audioService from './services/audioService';
import obsService from './services/obsService';
import obsWebSocketService from './services/obsWebSocketService';
import midiService from './services/midiService';
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

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Ensure data directories exist
        await fileUtils.ensureDataDirectories();
        
        // Initialize MIDI first (globally)
        if (settings.midiEnabled) {
          try {
            console.log('App: Initializing MIDI globally...');
            await midiService.initialize();
            
            // Setup MIDI hotkey handlers
            midiService.onHotkeyAction((data) => {
              handleMIDIHotkey(data);
            });
            
            console.log('App: MIDI Service initialized globally');
          } catch (error) {
            console.log('App: MIDI not available:', error.message);
          }
        }
        
        // Start OBS service if configured
        if (settings.obsPort) {
          try {
            await obsService.startServer(settings.obsPort);
          } catch (error) {
            console.log('OBS service not available:', error.message);
          }
        }

        // Initialize OBS WebSocket if enabled
        if (settings.obsWebSocketEnabled) {
          try {
            await obsWebSocketService.connect(
              settings.obsWebSocketHost,
              settings.obsWebSocketPort,
              settings.obsWebSocketPassword
            );
          } catch (error) {
            console.log('OBS WebSocket not available:', error.message);
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

        // Set initial volume
        audioService.setVolume(volume);

        setIsLoading(false);
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
        obsService.stopServer();
        obsWebSocketService.destroy();
        // Don't destroy MIDI service as it's used globally
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
          
          // Update OBS display via WebSocket
          const currentMood = moods.find(m => m.id === activeMood);
          if (currentMood && settings.obsWebSocketEnabled) {
            try {
              await obsWebSocketService.updateSongDisplay(currentSong, currentMood, settings);
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