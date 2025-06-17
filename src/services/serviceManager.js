// Service Manager - Zentrale Verwaltung aller Services
import globalStateService from './globalStateService';
import obsWebSocketService from './obsWebSocketService';
import midiService from './midiService';
import audioDeckService from './audioDeckService';

class ServiceManager {
  constructor() {
    this.initialized = false;
    this.serviceStates = {
      globalState: false,
      obs: false,
      midi: false,
      audioDeck: false
    };
  }

  async initializeAllServices() {
    console.log('🚀 ServiceManager: Starting service initialization...');
    
    try {
      // 1. Initialize GlobalStateService first
      await this.initializeGlobalStateService();
      
      // 2. Register and initialize OBS Service
      await this.initializeOBSService();
      
      // 3. Register and initialize MIDI Service
      await this.initializeMIDIService();
      
      // 4. Initialize Audio Deck Service
      await this.initializeAudioDeckService();
      
      // 5. Setup inter-service communication
      this.setupServiceCommunication();
      
      this.initialized = true;
      console.log('✅ ServiceManager: All services initialized successfully');
      
      return true;
    } catch (error) {
      console.error('❌ ServiceManager: Failed to initialize services:', error);
      return false;
    }
  }

  async initializeGlobalStateService() {
    try {
      // Load saved mappings
      globalStateService.loadMappings();
      
      this.serviceStates.globalState = true;
      console.log('✅ GlobalStateService initialized');
    } catch (error) {
      console.error('❌ GlobalStateService initialization failed:', error);
      throw error;
    }
  }

  async initializeOBSService() {
    try {
      // Register OBS service with GlobalStateService
      globalStateService.registerService('obs', obsWebSocketService);
      
      // Setup OBS event handlers
      obsWebSocketService.onConnected(() => {
        console.log('🔗 OBS connected - updating global state');
        globalStateService.updateOBSState({ connected: true });
      });
      
      obsWebSocketService.onDisconnected(() => {
        console.log('❌ OBS disconnected - updating global state');
        globalStateService.updateOBSState({ 
          connected: false, 
          sources: [], 
          audioLevels: {} 
        });
      });
      
      obsWebSocketService.onSourcesDiscovered((sources) => {
        console.log('🎵 OBS sources discovered:', sources.length);
        globalStateService.updateOBSState({ sources });
        globalStateService.triggerCallbacks('sourcesDiscovered', sources);
      });
      
      obsWebSocketService.onAudioLevels((data) => {
        globalStateService.updateAudioLevels(data.sourceName, data.levels);
      });
      
      obsWebSocketService.onVolumeChanged((data) => {
        globalStateService.updateSourceVolume(data.sourceName, data.volumeDb);
      });
      
      this.serviceStates.obs = true;
      console.log('✅ OBS Service registered and initialized');
    } catch (error) {
      console.error('❌ OBS Service initialization failed:', error);
      throw error;
    }
  }

  async initializeMIDIService() {
    try {
      // Initialize MIDI service first
      await midiService.initialize();
      
      // Register MIDI service with GlobalStateService
      globalStateService.registerService('midi', midiService);
      
      // Setup MIDI event handlers
      midiService.onVolumeChange((data) => {
        console.log('🎚️ MIDI Volume change:', data);
        // Forward to OBS
        if (globalStateService.isOBSConnected()) {
          globalStateService.setVolume(data.target, data.value, 'MIDIService');
        }
      });
      
      midiService.onHotkeyAction((data) => {
        console.log('🎹 MIDI Hotkey:', data);
        // Handle hotkey actions
        this.handleMIDIHotkey(data);
      });
      
      midiService.onDeviceStateChange((data) => {
        globalStateService.updateMIDIState({
          connected: data.state === 'connected',
          lastActivity: { 
            type: 'deviceChange', 
            device: data.port.name, 
            timestamp: Date.now() 
          }
        });
      });
      
      // Setup MIDI learning integration
      this.setupMIDILearning();
      
      this.serviceStates.midi = true;
      console.log('✅ MIDI Service registered and initialized');
    } catch (error) {
      console.error('❌ MIDI Service initialization failed:', error);
      // Don't throw error for MIDI - it's optional
    }
  }

  setupMIDILearning() {
    // Connect MIDI learning with GlobalStateService
    midiService.addCallback('midiLearning', (midiMessage) => {
      console.log('🎯 MIDI Learning message received in ServiceManager:', midiMessage);
      
      // Get the current learning target from global state
      const learningTarget = globalStateService.getMIDIState().learningTarget;
      
      if (learningTarget) {
        console.log('🎯 MIDI Learning completed for target:', learningTarget);
        
        // Trigger the global state callback
        globalStateService.triggerCallbacks('midiLearningCompleted', {
          target: learningTarget,
          message: midiMessage
        });
        
        // Update MIDI state to stop learning
        globalStateService.updateMIDIState({
          learning: false,
          learningTarget: null,
          lastActivity: { ...midiMessage, timestamp: Date.now() }
        });
        
        console.log('✅ MIDI Learning process completed in ServiceManager');
      } else {
        console.warn('⚠️ MIDI Learning completed but no target found');
      }
    });
    
    console.log('🎯 MIDI Learning integration setup completed');
  }

  async initializeAudioDeckService() {
    try {
      // Wait for audioDeckService to be ready
      let attempts = 0;
      while (!audioDeckService.initialized && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!audioDeckService.initialized) {
        console.warn('⚠️ AudioDeckService not initialized in time');
      }
      
      this.serviceStates.audioDeck = true;
      console.log('✅ Audio Deck Service initialized');
    } catch (error) {
      console.error('❌ Audio Deck Service initialization failed:', error);
      throw error;
    }
  }

  setupServiceCommunication() {
    // 🎹 Enhanced MIDI Learning Integration
    globalStateService.startMIDILearning = (target) => {
      console.log('🎹 GlobalStateService.startMIDILearning called for:', target);
      
      if (midiService && this.serviceStates.midi) {
        // Update state first
        globalStateService.updateMIDIState({
          learning: true,
          learningTarget: target
        });
        
        // Start MIDI learning - let ServiceManager handle the callback
        const success = midiService.startLearning();
        
        if (success) {
          console.log('✅ MIDI Learning started successfully for:', target);
        } else {
          console.error('❌ Failed to start MIDI Learning for:', target);
          globalStateService.updateMIDIState({
            learning: false,
            learningTarget: null
          });
        }
        
        return success;
      } else {
        console.error('❌ MIDI Service not available for learning');
        return false;
      }
    };
    
    globalStateService.stopMIDILearning = () => {
      console.log('🛑 GlobalStateService.stopMIDILearning called');
      
      if (midiService && this.serviceStates.midi) {
        midiService.stopLearning();
      }
      
      globalStateService.updateMIDIState({
        learning: false,
        learningTarget: null
      });
      
      globalStateService.triggerCallbacks('midiLearningStopped');
    };
    
    console.log('🔗 Enhanced Service communication setup completed');
  }

  handleMIDIHotkey(data) {
    const { action, target } = data;
    
    switch (action) {
      case 'mute':
        if (globalStateService.isOBSConnected()) {
          globalStateService.toggleMute(target, 'MIDIService');
        }
        break;
      case 'playPause':
        // Trigger play/pause in audio system
        window.dispatchEvent(new CustomEvent('midiPlayPause'));
        break;
      case 'nextSong':
        window.dispatchEvent(new CustomEvent('midiNextSong'));
        break;
      case 'moodSwap':
        window.dispatchEvent(new CustomEvent('midiMoodSwap', { detail: { mood: target } }));
        break;
      default:
        console.log('🎹 Unhandled MIDI hotkey:', action);
    }
  }

  // Connection methods
  async connectToOBS(host = 'localhost', port = 4455, password = '') {
    if (!this.serviceStates.obs) {
      console.error('OBS Service not initialized');
      return false;
    }
    
    try {
      const result = await obsWebSocketService.connect(host, port, password);
      if (result) {
        console.log('🔗 OBS connection successful');
        // Trigger immediate source discovery
        setTimeout(() => {
          obsWebSocketService.discoverAudioSources();
        }, 2000);
      }
      return result;
    } catch (error) {
      console.error('❌ OBS connection failed:', error);
      return false;
    }
  }

  // Status methods
  getServiceStatus() {
    return {
      initialized: this.initialized,
      services: { ...this.serviceStates },
      connections: {
        obs: globalStateService.isOBSConnected(),
        midi: globalStateService.isMIDIConnected()
      }
    };
  }

  // Cleanup
  destroy() {
    if (obsWebSocketService) {
      obsWebSocketService.destroy();
    }
    if (midiService) {
      midiService.destroy();
    }
    if (globalStateService) {
      globalStateService.destroy();
    }
    console.log('🧹 ServiceManager destroyed');
  }
}

// Singleton instance
const serviceManager = new ServiceManager();

// Make globally available for debugging
if (typeof window !== 'undefined') {
  window.serviceManager = serviceManager;
}

export default serviceManager;
