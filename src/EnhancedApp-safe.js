import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Import stores and services (with error handling)
let useMoodStore, audioService, globalStateService, configService, audioDeckService, fileUtils, serviceManager;

try {
  useMoodStore = require('./stores/moodStore').default;
  audioService = require('./services/audioService').default;
  globalStateService = require('./services/globalStateService').default;
  configService = require('./services/configService').default;
  audioDeckService = require('./services/audioDeckService').default;
  fileUtils = require('./utils/fileUtils').default;
  serviceManager = require('./services/serviceManager').default;
} catch (error) {
  console.error('EnhancedApp: Import error:', error);
}

// Import components (with error handling)
let Sidebar, MoodGrid, Player, Settings, LoadingScreen, EnhancedAudioMixer, OptimizedHotkeyDeckManager, EnhancedModularDashboard;

try {
  Sidebar = require('./components/Sidebar').default;
  MoodGrid = require('./components/MoodGrid').default;
  Player = require('./components/Player').default;
  Settings = require('./components/Settings').default;
  LoadingScreen = require('./components/LoadingScreen').default;
  EnhancedAudioMixer = require('./components/EnhancedAudioMixer').default;
  OptimizedHotkeyDeckManager = require('./components/OptimizedHotkeyDeckManager').default;
  EnhancedModularDashboard = require('./components/EnhancedModularDashboard').default;
} catch (error) {
  console.error('EnhancedApp: Component import error:', error);
}

// Import styles
import './App.css';

// Load diagnostic script as a module
try {
  import('./utils/diagnosticScript').then((diagnostic) => {
    window.diagnosticScript = diagnostic.default || diagnostic;
    console.log('🔧 Audio Mixer Diagnostic Tool loaded!');
    console.log('🚀 Usage: diagnosticScript.runFullDiagnosis()');
  });
} catch (error) {
  console.log('Diagnostic script not available');
}

function App() {
  // Basic state management
  const [currentView, setCurrentView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState({ obs: false, midi: false });
  const [initializationProgress, setInitializationProgress] = useState({
    step: 'Starting...',
    progress: 0
  });

  // Use mood store with error handling
  let moodState = {
    moods: [],
    activeMood: null,
    currentSong: null,
    isPlaying: false,
    volume: 0.8,
    settings: {},
    setIsPlaying: () => {},
    setCurrentSong: () => {},
    setActiveMood: () => {},
    nextSong: () => {},
    updateSettings: () => {}
  };

  try {
    if (useMoodStore) {
      const storeState = useMoodStore();
      moodState = { ...moodState, ...storeState };
    }
  } catch (error) {
    console.error('EnhancedApp: MoodStore error:', error);
  }

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
  } = moodState;

  // Initialization
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('EnhancedApp: Starting initialization...');
        setInitializationProgress({ step: 'Initializing services...', progress: 10 });
        
        // Initialize ServiceManager first - this will setup all services properly
        if (serviceManager) {
          console.log('🚀 Initializing ServiceManager...');
          const serviceInitSuccess = await serviceManager.initializeAllServices();
          if (!serviceInitSuccess) {
            console.warn('⚠️ Some services failed to initialize, continuing anyway...');
          }
        }
        
        // Make services globally available
        if (globalStateService) window.globalStateService = globalStateService;
        if (configService) window.configService = configService;
        if (audioDeckService) window.audioDeckService = audioDeckService;
        if (useMoodStore) window.useMoodStore = useMoodStore;
        if (serviceManager) window.serviceManager = serviceManager;
        
        // Load diagnostic script
        try {
          const diagnosticScript = require('./utils/diagnosticScript').default;
          window.diagnosticScript = diagnosticScript;
          console.log('🔧 Diagnostic script loaded - use diagnosticScript.runFullDiagnosis() in console');
        } catch (error) {
          console.warn('Diagnostic script not available:', error.message);
        }
        
        // Load emergency repair tool
        try {
          const emergencyRepair = require('./utils/emergencyRepair').default;
          window.emergencyRepair = emergencyRepair;
          console.log('🚑 Emergency repair tool loaded - use emergencyRepair.fixEverything() in console');
        } catch (error) {
          console.warn('Emergency repair tool not available:', error.message);
        }
        
        setInitializationProgress({ step: 'Loading configuration...', progress: 30 });
        
        // Initialize services safely
        if (configService && configService.initializeConfig) {
          await configService.initializeConfig();
        }
        
        if (audioDeckService && audioDeckService.initializeService) {
          await audioDeckService.initializeService();
        }
        
        setInitializationProgress({ step: 'Connecting services...', progress: 50 });
        
        // Setup connection status monitoring
        if (globalStateService) {
          globalStateService.on('obsStateChanged', (state) => {
            setConnectionStatus(prev => ({ ...prev, obs: state.connected }));
          });
          
          globalStateService.on('midiStateChanged', (state) => {
            setConnectionStatus(prev => ({ ...prev, midi: state.connected }));
          });
        }
        
        setInitializationProgress({ step: 'Setting up directories...', progress: 60 });
        
        if (fileUtils && fileUtils.ensureDataDirectories) {
          await fileUtils.ensureDataDirectories();
        }
        
        setInitializationProgress({ step: 'Loading mappings...', progress: 80 });
        
        if (globalStateService && globalStateService.loadMappings) {
          globalStateService.loadMappings();
        }
        
        setInitializationProgress({ step: 'Completing setup...', progress: 95 });
        
        // Basic audio service setup
        if (audioService) {
          audioService.onSongEndCallback(() => {
            nextSong();
          });
          audioService.setVolume(volume);
        }
        
        setInitializationProgress({ step: 'Initialization complete!', progress: 100 });
        
        setTimeout(() => {
          setIsLoading(false);
          console.log('EnhancedApp: Initialization completed successfully');
        }, 500);
        
      } catch (error) {
        console.error('EnhancedApp: Failed to initialize:', error);
        setInitializationProgress({ step: 'Initialization failed', progress: 100 });
        setTimeout(() => setIsLoading(false), 1000);
      }
    };

    initializeApp();

    // Cleanup on unmount
    return () => {
      console.log('EnhancedApp: Starting cleanup...');
      
      try {
        if (audioService && audioService.destroy) {
          audioService.destroy();
        }
      } catch (error) {
        console.log('EnhancedApp: Cleanup error:', error.message);
      }
    };
  }, []);

  // Song change handler
  useEffect(() => {
    if (currentSong && audioService) {
      const handleSongChange = async () => {
        try {
          console.log('EnhancedApp: Handling song change:', currentSong.title);
          
          await audioService.loadSong(currentSong);
          
          if (isPlaying) {
            audioService.play();
          }
        } catch (error) {
          console.error('EnhancedApp: Failed to load song:', error);
          setIsPlaying(false);
        }
      };
      
      handleSongChange();
    }
  }, [currentSong, activeMood, moods]);

  // Playback control
  useEffect(() => {
    if (audioService) {
      if (isPlaying) {
        audioService.play();
      } else {
        audioService.pause();
      }
    }
  }, [isPlaying]);

  // Volume control
  useEffect(() => {
    if (audioService) {
      audioService.setVolume(volume);
    }
  }, [volume]);

  // Loading screen
  if (isLoading) {
    return LoadingScreen ? (
      <LoadingScreen 
        progress={initializationProgress.progress}
        message={initializationProgress.step}
        enhanced={true}
      />
    ) : (
      <div className="h-screen bg-primary text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-4">Loading...</div>
          <div className="text-gray-400">{initializationProgress.step}</div>
          <div className="w-64 bg-gray-700 rounded-full h-2 mt-4">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${initializationProgress.progress}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-primary text-white overflow-hidden">
      {/* Sidebar */}
      {Sidebar && (
        <Sidebar 
          currentView={currentView} 
          onViewChange={setCurrentView}
          connectionStatus={connectionStatus}
          enhancedMode={true}
        />
      )}

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
            {currentView === 'dashboard' && EnhancedModularDashboard && <EnhancedModularDashboard />}
            {currentView === 'moods' && MoodGrid && <MoodGrid />}
            {currentView === 'audio' && EnhancedAudioMixer && <EnhancedAudioMixer />}
            {currentView === 'hotkeys' && OptimizedHotkeyDeckManager && <OptimizedHotkeyDeckManager />}
            {currentView === 'settings' && Settings && <Settings />}
            
            {/* Fallback for missing components */}
            {!EnhancedModularDashboard && currentView === 'dashboard' && (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="text-xl mb-2">Dashboard Component Missing</div>
                  <div className="text-sm">Please check component imports</div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Player */}
        {Player && (
          <Player 
            connectionStatus={connectionStatus}
            enhancedMode={true}
          />
        )}
      </div>
    </div>
  );
}

export default App;
