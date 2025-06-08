// 🎯 OBS Browser Source Auto-Refresh - FINALE VERSION
// Direkte Integration mit OBS WebSocket für sofortiges Browser Source Refresh

class OBSBrowserRefresh {
  constructor() {
    this.isInitialized = false;
    this.obsWebSocket = null;
    this.browserSources = [];
    this.lastSongId = null;
    this.refreshInterval = null;
    this.debugMode = true;
    
    console.log('🎯 OBS Browser Refresh Service created');
  }

  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Wait for OBS WebSocket
      await this.waitForOBS();
      
      // Discover browser sources
      await this.discoverBrowserSources();
      
      // Start monitoring song changes
      this.startSongMonitoring();
      
      this.isInitialized = true;
      console.log('✅ OBS Browser Refresh Service initialized successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Failed to initialize OBS Browser Refresh:', error);
      return false;
    }
  }

  async waitForOBS() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 30;
      
      const checkOBS = () => {
        attempts++;
        
        if (window.obsWebSocketService && window.obsWebSocketService.isConnected()) {
          this.obsWebSocket = window.obsWebSocketService;
          console.log('🔗 OBS WebSocket found and connected');
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error('OBS WebSocket not available after 30 attempts'));
        } else {
          if (this.debugMode && attempts % 5 === 0) {
            console.log(`⏳ Waiting for OBS WebSocket... (${attempts}/${maxAttempts})`);
          }
          setTimeout(checkOBS, 1000);
        }
      };
      
      checkOBS();
    });
  }

  async discoverBrowserSources() {
    if (!this.obsWebSocket) {
      console.warn('⚠️ OBS WebSocket not available for browser source discovery');
      return;
    }

    try {
      console.log('🔍 Discovering browser sources...');
      
      const { inputs } = await this.obsWebSocket.obs.call('GetInputList');
      this.browserSources = [];
      
      for (const input of inputs) {
        if (input.inputKind === 'browser_source') {
          try {
            const settings = await this.obsWebSocket.obs.call('GetInputSettings', {
              inputName: input.inputName
            });
            
            const url = settings.inputSettings.url || '';
            const name = input.inputName.toLowerCase();
            
            // Check if it's a Mood Music related source
            if (name.includes('mood') || 
                name.includes('music') || 
                name.includes('song') ||
                url.includes('mood-music') ||
                url.includes('obs-display')) {
              
              this.browserSources.push({
                name: input.inputName,
                url: url
              });
              
              console.log(`🎯 Found Mood Music browser source: "${input.inputName}"`);
            }
          } catch (error) {
            // Skip sources we can't access
          }
        }
      }
      
      if (this.browserSources.length > 0) {
        console.log(`✅ Discovered ${this.browserSources.length} Mood Music browser source(s)`);
      } else {
        console.log('⚠️ No Mood Music browser sources found. Make sure your browser source name contains "mood", "music", or "song"');
      }
      
    } catch (error) {
      console.error('❌ Error discovering browser sources:', error);
    }
  }

  startSongMonitoring() {
    // Clear any existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    console.log('🎵 Starting song change monitoring...');
    
    this.refreshInterval = setInterval(() => {
      this.checkForSongChange();
    }, 500); // Check every 500ms
  }

  checkForSongChange() {
    try {
      if (!window.useMoodStore) {
        return;
      }
      
      const state = window.useMoodStore.getState();
      const currentSong = state.currentSong;
      
      if (currentSong && currentSong.id && currentSong.id !== this.lastSongId) {
        this.lastSongId = currentSong.id;
        console.log(`🎵 Song change detected: "${currentSong.title}" by ${currentSong.artist}`);
        
        // Trigger refresh
        this.refreshAllBrowserSources();
      }
    } catch (error) {
      // Store might not be ready yet
    }
  }

  async refreshAllBrowserSources() {
    if (!this.obsWebSocket || this.browserSources.length === 0) {
      if (this.debugMode) {
        console.log('⚠️ No OBS connection or browser sources to refresh');
      }
      return;
    }

    console.log(`🔄 Refreshing ${this.browserSources.length} browser source(s)...`);
    
    for (const source of this.browserSources) {
      try {
        // Method 1: Try the refresh button
        await this.obsWebSocket.obs.call('PressInputPropertiesButton', {
          inputName: source.name,
          propertyName: 'refreshnocache'
        });
        
        console.log(`✅ Refreshed browser source: "${source.name}"`);
        
      } catch (error) {
        try {
          // Method 2: Try restarting the source
          const currentSettings = await this.obsWebSocket.obs.call('GetInputSettings', {
            inputName: source.name
          });
          
          await this.obsWebSocket.obs.call('SetInputSettings', {
            inputName: source.name,
            inputSettings: {
              ...currentSettings.inputSettings,
              restart_when_active: true
            }
          });
          
          console.log(`🔄 Restarted browser source: "${source.name}"`);
          
        } catch (altError) {
          console.warn(`⚠️ Could not refresh "${source.name}":`, error.message);
        }
      }
      
      // Small delay between refreshes
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Manual methods for testing
  async manualRefresh() {
    console.log('🔄 Manual refresh triggered');
    await this.refreshAllBrowserSources();
  }

  async rediscover() {
    console.log('🔍 Manual browser source discovery');
    await this.discoverBrowserSources();
  }

  // Test with current song
  async testWithCurrentSong() {
    try {
      if (!window.useMoodStore) {
        console.log('❌ Store not available');
        return;
      }
      
      const state = window.useMoodStore.getState();
      const currentSong = state.currentSong;
      
      if (currentSong) {
        console.log(`🧪 Testing refresh with current song: "${currentSong.title}"`);
        this.lastSongId = null; // Reset to force refresh
        this.checkForSongChange();
      } else {
        console.log('❌ No current song to test with');
      }
    } catch (error) {
      console.error('❌ Test failed:', error);
    }
  }

  // Status information
  getStatus() {
    return {
      initialized: this.isInitialized,
      obsConnected: this.obsWebSocket?.isConnected() || false,
      browserSourcesCount: this.browserSources.length,
      lastSongId: this.lastSongId,
      monitoring: !!this.refreshInterval
    };
  }

  // Debug information
  debug() {
    console.log('🐛 OBS Browser Refresh Debug Info:');
    console.log('Status:', this.getStatus());
    console.log('Browser Sources:');
    this.browserSources.forEach((source, index) => {
      console.log(`  ${index + 1}. "${source.name}" - ${source.url}`);
    });
    
    if (window.useMoodStore) {
      try {
        const state = window.useMoodStore.getState();
        console.log('Current Song:', state.currentSong?.title || 'None');
        console.log('Store Available:', true);
      } catch (error) {
        console.log('Store Error:', error.message);
      }
    } else {
      console.log('Store Available:', false);
    }
  }

  // Cleanup
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    
    this.isInitialized = false;
    this.browserSources = [];
    this.lastSongId = null;
    
    console.log('🧹 OBS Browser Refresh Service destroyed');
  }
}

// Create and initialize the service
let browserRefreshService = null;

if (typeof window !== 'undefined') {
  if (!window.obsBrowserRefresh) {
    browserRefreshService = new OBSBrowserRefresh();
    window.obsBrowserRefresh = browserRefreshService;
    
    // Auto-initialize after a short delay
    setTimeout(async () => {
      await browserRefreshService.initialize();
    }, 2000);
  } else {
    browserRefreshService = window.obsBrowserRefresh;
  }
} else {
  browserRefreshService = new OBSBrowserRefresh();
}

export default browserRefreshService;