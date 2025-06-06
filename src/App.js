import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMoodStore from './stores/moodStore';
import audioService from './services/audioService';
import obsService from './services/obsService';
import fileUtils from './utils/fileUtils';

// Components
import Sidebar from './components/Sidebar';
import MoodGrid from './components/MoodGrid';
import Player from './components/Player';
import Settings from './components/Settings';
import LoadingScreen from './components/LoadingScreen';

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
    nextSong,
    updateSettings
  } = useMoodStore();

  const [currentView, setCurrentView] = useState('moods');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Ensure data directories exist
        await fileUtils.ensureDataDirectories();
        
        // Start OBS service if configured
        if (settings.obsPort) {
          try {
            await obsService.startServer(settings.obsPort);
          } catch (error) {
            console.log('OBS service not available:', error.message);
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
      } catch (error) {
        console.log('Error stopping OBS service:', error.message);
      }
    };
  }, []);

  // Handle song changes
  useEffect(() => {
    if (currentSong) {
      audioService.loadSong(currentSong)
        .then(() => {
          if (isPlaying) {
            audioService.play();
          }
          
          // Update OBS display
          const currentMood = moods.find(m => m.id === activeMood);
          if (currentMood) {
            try {
              obsService.updateCurrentSong(currentSong, currentMood, settings);
            } catch (error) {
              console.log('Failed to update OBS:', error.message);
            }
          }
        })
        .catch(error => {
          console.error('Failed to load song:', error);
          setIsPlaying(false);
        });
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