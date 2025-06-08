// 🚀 OBS Instant Update Service - Optimiert für sofortige Musikwechsel-Anzeige
class OBSInstantUpdateService {
  constructor() {
    this.obsWebSocket = null;
    this.currentBrowserSources = [];
    this.updateQueue = [];
    this.isProcessingQueue = false;
    this.lastUpdateTime = 0;
    this.refreshMethods = ['url_refresh', 'visibility_toggle', 'scene_switch'];
    this.currentRefreshMethod = 0;
    this.initialized = false;
    
    // Settings
    this.settings = {
      instantUpdate: true,
      refreshDelay: 200, // ms delay zwischen Updates
      useWebSocketRefresh: true,
      useBrowserSourceRefresh: true,
      useSceneItemUpdate: true,
      autoDiscoverSources: true,
      debugMode: true
    };
  }

  async init() {
    // Prevent multiple initialization
    if (this.initialized) {
      return;
    }
    
    console.log('🚀 Initializing OBS Instant Update Service...');
    
    // Warte auf OBS WebSocket Service
    if (window.obsWebSocketService) {
      this.obsWebSocket = window.obsWebSocketService;
      this.setupWebSocketHandlers();
      this.initialized = true;
      console.log('🚀 OBS Instant Update Service aktiv');
      
      // Auto-discover browser sources
      if (this.settings.autoDiscoverSources) {
        setTimeout(() => this.discoverBrowserSources(), 2000);
      }
    } else {
      if (this.settings.debugMode) {
        console.log('⏳ Warte auf OBS WebSocket Service...');
      }
      setTimeout(() => this.init(), 1000);
    }
  }

  setupWebSocketHandlers() {
    // Listen for song changes from the store or service
    if (window.useMoodStore) {
      // Hook into the store's song changes
      let lastSongId = null;
      const checkForSongChange = () => {
        try {
          const state = window.useMoodStore.getState();
          if (state.currentSong && state.currentSong.id !== lastSongId) {
            lastSongId = state.currentSong.id;
            this.handleSongChange(state.currentSong);
          }
        } catch (error) {
          // Store not ready yet
        }
      };
      
      // Check periodically for song changes
      setInterval(checkForSongChange, 500);
    }

    // Listen for OBS WebSocket events
    this.obsWebSocket.onConnected(() => {
      console.log('🔗 OBS connected - starting browser source discovery');
      setTimeout(() => this.discoverBrowserSources(), 1000);
    });
  }

  async discoverBrowserSources() {
    if (!this.obsWebSocket || !this.obsWebSocket.isConnected()) {
      console.log('🔍 OBS nicht verbunden - Browser Source Discovery übersprungen');
      return;
    }

    try {
      console.log('🔍 Suche nach Mood Music Browser Sources...');
      
      // Get all input sources
      const { inputs } = await this.obsWebSocket.obs.call('GetInputList');
      
      let foundSources = [];
      
      for (const input of inputs) {
        try {
          if (input.inputKind === 'browser_source') {
            const settings = await this.obsWebSocket.obs.call('GetInputSettings', {
              inputName: input.inputName
            });
            
            // Check if it's our Mood Music source
            const url = settings.inputSettings.url || '';
            const sourceName = input.inputName.toLowerCase();
            
            if (url.includes('mood-music') || 
                url.includes('obs-display') || 
                url.includes('obs-data.json') ||
                sourceName.includes('mood') ||
                sourceName.includes('music') ||
                sourceName.includes('song')) {
              
              foundSources.push({
                name: input.inputName,
                url: url,
                settings: settings.inputSettings,
                isVisible: true // will be checked later
              });
              
              console.log(`🎯 Mood Music Browser Source gefunden: ${input.inputName}`);
              console.log(`   URL: ${url}`);
            }
          }
        } catch (error) {
          // Skip sources that can't be accessed
        }
      }
      
      this.currentBrowserSources = foundSources;
      
      if (foundSources.length > 0) {
        console.log(`✅ ${foundSources.length} Browser Source(s) für Instant Updates registriert`);
        
        // Test refresh on first source
        if (this.settings.debugMode) {
          setTimeout(() => this.testRefresh(), 2000);
        }
      } else {
        console.log('⚠️ Keine Mood Music Browser Sources gefunden');
        console.log('💡 Tipp: Browser Source sollte "mood", "music" oder "song" im Namen haben oder mood-music URL verwenden');
      }
      
    } catch (error) {
      console.error('❌ Fehler bei Browser Source Discovery:', error);
    }
  }

  async handleSongChange(song) {
    if (!song || !this.settings.instantUpdate) return;
    
    const updateData = {
      type: 'song_change',
      song: song,
      timestamp: Date.now()
    };
    
    console.log(`🎵 Song Change detected: ${song.title} - ${song.artist}`);
    
    // Add to queue for processing
    this.addToUpdateQueue(updateData);
    
    // Process queue immediately
    this.processUpdateQueue();
  }

  async handleMoodChange(mood) {
    if (!mood || !this.settings.instantUpdate) return;
    
    const updateData = {
      type: 'mood_change',
      mood: mood,
      timestamp: Date.now()
    };
    
    console.log(`🌈 Mood Change detected: ${mood.name}`);
    
    // Add to queue for processing
    this.addToUpdateQueue(updateData);
    
    // Process queue immediately
    this.processUpdateQueue();
  }

  addToUpdateQueue(updateData) {
    // Remove old updates of same type to prevent spam
    this.updateQueue = this.updateQueue.filter(item => item.type !== updateData.type);
    
    // Add new update
    this.updateQueue.push(updateData);
    
    if (this.settings.debugMode) {
      console.log(`📝 Update queued: ${updateData.type}, Queue length: ${this.updateQueue.length}`);
    }
  }

  async processUpdateQueue() {
    if (this.isProcessingQueue || this.updateQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift();
        await this.executeUpdate(update);
        
        // Small delay between updates to prevent spam
        if (this.updateQueue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.settings.refreshDelay));
        }
      }
    } catch (error) {
      console.error('❌ Error processing update queue:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async executeUpdate(updateData) {
    const now = Date.now();
    
    // Prevent too frequent updates
    if (now - this.lastUpdateTime < this.settings.refreshDelay) {
      await new Promise(resolve => setTimeout(resolve, this.settings.refreshDelay));
    }
    
    try {
      // Method 1: Refresh Browser Sources
      if (this.settings.useBrowserSourceRefresh) {
        await this.refreshBrowserSources();
      }
      
      // Method 2: Update data immediately through existing channels
      await this.updateDataChannels(updateData);
      
      this.lastUpdateTime = Date.now();
      
      if (this.settings.debugMode) {
        console.log(`✅ Update executed: ${updateData.type}`);
      }
      
    } catch (error) {
      console.error(`❌ Failed to execute update for ${updateData.type}:`, error);
    }
  }

  async refreshBrowserSources() {
    if (!this.obsWebSocket || !this.obsWebSocket.isConnected()) {
      return;
    }
    
    for (const source of this.currentBrowserSources) {
      try {
        // Method: Refresh the browser source
        await this.obsWebSocket.obs.call('PressInputPropertiesButton', {
          inputName: source.name,
          propertyName: 'refreshnocache'
        });
        
        if (this.settings.debugMode) {
          console.log(`🔄 Browser source refreshed: ${source.name}`);
        }
        
      } catch (error) {
        // Try alternative refresh method
        try {
          // Alternative: Restart the browser source
          const settings = await this.obsWebSocket.obs.call('GetInputSettings', {
            inputName: source.name
          });
          
          await this.obsWebSocket.obs.call('SetInputSettings', {
            inputName: source.name,
            inputSettings: {
              ...settings.inputSettings,
              restart_when_active: true
            }
          });
          
          if (this.settings.debugMode) {
            console.log(`🔄 Browser source restarted: ${source.name}`);
          }
          
        } catch (altError) {
          console.warn(`⚠️ Could not refresh browser source ${source.name}:`, error.message);
        }
      }
    }
  }

  async updateDataChannels(updateData) {
    // Update through existing HTTP server / data writer
    if (window.obsWebSocketService && updateData.type === 'song_change') {
      try {
        // Get current mood from store
        let currentMood = null;
        let settings = {};
        
        if (window.useMoodStore) {
          const state = window.useMoodStore.getState();
          const moods = state.moods || [];
          currentMood = moods.find(m => m.id === state.activeMood);
          settings = state.settings || {};
        }
        
        if (currentMood) {
          await window.obsWebSocketService.updateSongDisplay(
            updateData.song,
            currentMood,
            settings
          );
          
          if (this.settings.debugMode) {
            console.log('📡 Data channels updated via obsWebSocketService');
          }
        }
      } catch (error) {
        console.error('❌ Failed to update data channels:', error);
      }
    }
  }

  // Manual refresh trigger
  async forceRefresh() {
    console.log('🔄 Manual refresh triggered...');
    
    try {
      await this.refreshBrowserSources();
      
      // Also trigger data update
      let currentSong = null;
      let currentMood = null;
      
      if (window.useMoodStore) {
        const state = window.useMoodStore.getState();
        currentSong = state.currentSong;
        const moods = state.moods || [];
        currentMood = moods.find(m => m.id === state.activeMood);
      }
      
      if (currentSong && currentMood) {
        await this.updateDataChannels({
          type: 'manual_refresh',
          song: currentSong,
          mood: currentMood,
          timestamp: Date.now()
        });
      }
      
      console.log('✅ Manual refresh completed');
      return true;
      
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      return false;
    }
  }

  // Test refresh functionality
  async testRefresh() {
    console.log('🧪 Testing refresh functionality...');
    
    const success = await this.forceRefresh();
    
    if (success) {
      console.log('✅ Refresh test passed');
    } else {
      console.log('❌ Refresh test failed');
    }
    
    return success;
  }

  // Add browser source manually
  addBrowserSource(sourceName, url = '') {
    const existingSource = this.currentBrowserSources.find(s => s.name === sourceName);
    
    if (!existingSource) {
      this.currentBrowserSources.push({
        name: sourceName,
        url: url,
        settings: { url: url },
        isVisible: true
      });
      
      console.log(`✅ Browser source manually added: ${sourceName}`);
    }
  }

  // Remove browser source
  removeBrowserSource(sourceName) {
    this.currentBrowserSources = this.currentBrowserSources.filter(s => s.name !== sourceName);
    console.log(`🗑️ Browser source removed: ${sourceName}`);
  }

  // Get status
  getStatus() {
    return {
      connected: this.obsWebSocket?.isConnected() || false,
      browserSources: this.currentBrowserSources.length,
      queueLength: this.updateQueue.length,
      isProcessing: this.isProcessingQueue,
      lastUpdate: this.lastUpdateTime,
      settings: this.settings
    };
  }

  // Update settings
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('⚙️ Settings updated:', this.settings);
  }

  // Debug methods
  listBrowserSources() {
    console.log('📋 Current Browser Sources:');
    this.currentBrowserSources.forEach((source, index) => {
      console.log(`  ${index + 1}. ${source.name}`);
      console.log(`     URL: ${source.url}`);
    });
  }

  async debug() {
    console.log('🐛 OBS Instant Update Service Debug Info:');
    console.log('Status:', this.getStatus());
    
    console.log('\n📋 Browser Sources:');
    this.listBrowserSources();
    
    console.log('\n🧪 Running refresh test...');
    await this.testRefresh();
    
    console.log('\n📊 Store connection:');
    console.log('Available:', !!window.useMoodStore);
    if (window.useMoodStore) {
      try {
        const state = window.useMoodStore.getState();
        console.log('Current song:', state.currentSong?.title || 'None');
        console.log('Active mood:', state.activeMood || 'None');
        console.log('Moods available:', state.moods?.length || 0);
      } catch (error) {
        console.log('Store error:', error.message);
      }
    }
  }

  // Cleanup
  destroy() {
    this.updateQueue = [];
    this.currentBrowserSources = [];
    this.isProcessingQueue = false;
    this.initialized = false;
    
    console.log('🧹 OBS Instant Update Service destroyed');
  }
}

// Create singleton instance
let obsInstantUpdateService = null;

// Ensure only one instance exists
if (typeof window !== 'undefined') {
  if (!window.obsInstantUpdateService) {
    obsInstantUpdateService = new OBSInstantUpdateService();
    window.obsInstantUpdateService = obsInstantUpdateService;
    
    // Auto-initialize when ready
    setTimeout(() => {
      obsInstantUpdateService.init();
    }, 100);
  } else {
    obsInstantUpdateService = window.obsInstantUpdateService;
  }
} else {
  obsInstantUpdateService = new OBSInstantUpdateService();
}

export default obsInstantUpdateService;