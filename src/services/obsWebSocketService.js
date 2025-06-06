// OBS WebSocket Client für Audio-Level-Steuerung
// Basiert auf OBS WebSocket v5.5.2 API
import OBSWebSocket from 'obs-websocket-js';

class OBSWebSocketService {
  constructor() {
    this.obs = new OBSWebSocket();
    this.connected = false;
    this.reconnectInterval = null;
    this.reconnectDelay = 5000;
    this.audioSources = new Map();
    this.audioLevels = new Map();
    this.callbacks = new Map();
    this.lastConnectionParams = null; // Für Reconnect
    this.subscriptions = {
      general: 1,
      config: 2,
      sources: 4,
      scenes: 8,
      inputs: 16,
      transitions: 32,
      filters: 64,
      outputs: 128,
      sceneItems: 256,
      mediaInputs: 512,
      vendors: 1024,
      ui: 2048,
      inputVolumeMeters: 4096, // Wichtig für Audio-Level-Monitoring
      inputActiveStateChanged: 8192,
      inputShowStateChanged: 16384,
      sceneItemTransformChanged: 32768
    };

    // Setup event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.obs.on('ConnectionOpened', () => {
      console.log('OBS WebSocket connected');
      this.connected = true;
      this.triggerCallback('connected');
      this.discoverAudioSources();
    });

    this.obs.on('ConnectionClosed', () => {
      console.log('OBS WebSocket disconnected');
      this.connected = false;
      this.triggerCallback('disconnected');
      this.startReconnect();
    });

    this.obs.on('ConnectionError', (error) => {
      console.error('OBS WebSocket connection error:', error);
      this.triggerCallback('error', error);
      this.startReconnect();
    });

    // Audio Level Monitoring
    this.obs.on('InputVolumeMeters', (data) => {
      console.log('OBS Event: InputVolumeMeters received:', data);
      this.handleAudioLevels(data);
    });

    // Audio Source Changes
    this.obs.on('InputVolumeChanged', (data) => {
      this.handleVolumeChange(data);
    });

    this.obs.on('InputMuteStateChanged', (data) => {
      this.handleMuteChange(data);
    });

    // Source Discovery
    this.obs.on('InputCreated', (data) => {
      this.handleSourceCreated(data);
    });

    this.obs.on('InputRemoved', (data) => {
      this.handleSourceRemoved(data);
    });
  }

  async connect(host = 'localhost', port = 4455, password = '') {
    try {
      // Disconnect existing connection first
      if (this.connected) {
        await this.disconnect();
      }

      // Speichere Verbindungsparameter für Reconnect
      this.lastConnectionParams = { host, port, password };

      const connectionInfo = {
        address: `ws://${host}:${port}`,
        password: password || undefined,
        eventSubscriptions: this.calculateSubscriptions()
      };

      // Use the correct connection method for obs-websocket-js v5
      await this.obs.connect(connectionInfo.address, connectionInfo.password, {
        eventSubscriptions: connectionInfo.eventSubscriptions,
        rpcVersion: 1 // Add RPC version for compatibility
      });

      console.log('Connected to OBS WebSocket:', `${host}:${port}`);
      console.log('Event subscriptions:', connectionInfo.eventSubscriptions);
      return true;
    } catch (error) {
      console.error('Failed to connect to OBS:', error);
      // Try fallback connection without auth
      if (password) {
        try {
          console.log('Retrying without password...');
          await this.obs.connect(`ws://${host}:${port}`, undefined, {
            eventSubscriptions: this.calculateSubscriptions(),
            rpcVersion: 1
          });
          console.log('Connected to OBS WebSocket (no auth):', `${host}:${port}`);
          return true;
        } catch (fallbackError) {
          console.error('Fallback connection failed:', fallbackError);
        }
      }
      throw error;
    }
  }

  calculateSubscriptions() {
    // Manually define EventSubscription bit values for InputVolumeMeters
    const EventSubscription = {
      General: 1,
      Config: 2,
      Scenes: 4,
      Inputs: 16,
      Transitions: 32,
      Filters: 64,
      Outputs: 128,
      SceneItems: 256,
      MediaInputs: 512,
      Vendors: 1024,
      Ui: 2048,
      InputVolumeMeters: 4096,
      InputActiveStateChanged: 8192,
      InputShowStateChanged: 16384,
      SceneItemTransformChanged: 32768,
      All: 511 // General through Ui
    };
    
    // Berechne Subscription-Flags für Audio-Monitoring und andere Events
    const subscriptions = (
      EventSubscription.General |
      EventSubscription.Inputs |
      EventSubscription.InputVolumeMeters |
      EventSubscription.InputActiveStateChanged |
      EventSubscription.Scenes
    );
    
    console.log('OBS WebSocket: Calculated subscriptions:', {
      subscriptions,
      binary: subscriptions.toString(2),
      includes: {
        General: !!(subscriptions & EventSubscription.General),
        Inputs: !!(subscriptions & EventSubscription.Inputs),
        InputVolumeMeters: !!(subscriptions & EventSubscription.InputVolumeMeters),
        InputActiveStateChanged: !!(subscriptions & EventSubscription.InputActiveStateChanged),
        Scenes: !!(subscriptions & EventSubscription.Scenes)
      }
    });
    
    return subscriptions;
  }

  async disconnect() {
    this.stopReconnect();
    if (this.connected) {
      try {
        await this.obs.disconnect();
      } catch (error) {
        console.error('Error during disconnect:', error);
      }
      this.connected = false;
    }
  }

  startReconnect() {
    if (!this.reconnectInterval) {
      console.log(`Attempting to reconnect in ${this.reconnectDelay / 1000}s...`);
      this.reconnectInterval = setInterval(async () => {
        try {
          if (!this.connected && this.lastConnectionParams) {
            console.log('Attempting to reconnect to OBS...');
            await this.connect(
              this.lastConnectionParams.host,
              this.lastConnectionParams.port,
              this.lastConnectionParams.password
            );
          }
        } catch (error) {
          console.log('Reconnection attempt failed:', error.message);
        }
      }, this.reconnectDelay);
    }
  }

  stopReconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  // Audio Source Discovery
  async discoverAudioSources() {
    try {
      // Add a small delay to ensure connection is fully established
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!this.connected) {
        console.log('Not connected to OBS, skipping source discovery');
        return;
      }

      const { inputs } = await this.obs.call('GetInputList');
      
      this.audioSources.clear();
      
      // Get audio input kinds once
      const kindData = await this.obs.call('GetInputKindList');
      const audioKinds = kindData.inputKinds.filter(kind => 
        kind.includes('audio') || 
        kind.includes('wasapi') || 
        kind.includes('pulse') ||
        kind === 'coreaudio_input_capture' ||
        kind === 'coreaudio_output_capture' ||
        kind === 'dshow_input' ||
        kind === 'alsa_input_capture'
      );

      for (const input of inputs) {
        // Check if it's an audio source
        if (audioKinds.includes(input.inputKind)) {
          const sourceInfo = await this.getAudioSourceInfo(input.inputName);
          if (sourceInfo) {
            this.audioSources.set(input.inputName, sourceInfo);
          }
        }
      }

      console.log('Discovered audio sources:', Array.from(this.audioSources.keys()));
      this.triggerCallback('sourcesDiscovered', Array.from(this.audioSources.values()));
      
    } catch (error) {
      console.error('Failed to discover audio sources:', error);
      // Don't throw error, just log it
    }
  }

  async getAudioSourceInfo(sourceName) {
    try {
      // Hole Audio-Eigenschaften
      const volumeData = await this.obs.call('GetInputVolume', { 
        inputName: sourceName 
      });
      
      const muteData = await this.obs.call('GetInputMute', { 
        inputName: sourceName 
      });

      // Hole Quelle-Details
      const settingsData = await this.obs.call('GetInputSettings', { 
        inputName: sourceName 
      });

      const sourceInfo = {
        name: sourceName,
        volume: volumeData.inputVolume,
        volumeDb: volumeData.inputVolumeDb,
        muted: muteData.inputMuted,
        kind: settingsData.inputKind,
        settings: settingsData.inputSettings,
        levels: { left: 0, right: 0 },
        peak: { left: 0, right: 0 },
        lastUpdate: Date.now()
      };

      return sourceInfo;
    } catch (error) {
      console.error(`Failed to get info for source ${sourceName}:`, error);
      return null;
    }
  }

  // Audio Level Handling
  handleAudioLevels(data) {
    const { inputName, inputLevelsMul } = data;
    
    if (!inputLevelsMul || inputLevelsMul.length === 0) {
      return;
    }
    
    // OBS sendet Audio-Level als Multiplier (0.0-1.0)
    // Konvertiere zu dB für bessere Darstellung
    const levels = {
      left: this.multiplierToDecibel(inputLevelsMul[0] || 0),
      right: this.multiplierToDecibel(inputLevelsMul[1] || inputLevelsMul[0] || 0),
      timestamp: Date.now()
    };

    // Peak Detection mit besserer Logik
    const source = this.audioSources.get(inputName);
    if (source) {
      const prevPeak = source.peak || { left: -60, right: -60 };
      
      // Peak wird gehalten und fällt langsam ab
      const peakDecay = 0.98; // Slower decay for better visibility
      levels.peak = {
        left: Math.max(levels.left, prevPeak.left * peakDecay),
        right: Math.max(levels.right, prevPeak.right * peakDecay)
      };
      
      // Update source info
      source.levels = levels;
      source.peak = levels.peak;
      source.lastUpdate = Date.now();
      
      // Store updated source
      this.audioSources.set(inputName, source);
    }

    this.audioLevels.set(inputName, levels);
    
    // Enhanced logging for debugging
    if (Math.max(levels.left, levels.right) > -50) { // Only log when there's meaningful audio
      console.log(`OBS Audio Levels: ${inputName} - L: ${levels.left.toFixed(1)}dB R: ${levels.right.toFixed(1)}dB`);
    }
    
    // Trigger callback for UI
    this.triggerCallback('audioLevels', { sourceName: inputName, levels });
  }

  // Mathematische Konvertierung Multiplier zu dB
  multiplierToDecibel(multiplier) {
    if (multiplier <= 0) return -60; // Minimum dB
    return Math.max(-60, 20 * Math.log10(multiplier));
  }

  // Konvertierung dB zu Multiplier
  decibelToMultiplier(db) {
    if (db <= -60) return 0;
    return Math.pow(10, db / 20);
  }

  // Volume Control
  async setVolume(sourceName, volumeDb) {
    try {
      // Stelle sicher, dass der Wert im OBS-Bereich liegt (-60 bis 0 dB)
      const clampedDb = Math.max(-60, Math.min(0, volumeDb));
      
      await this.obs.call('SetInputVolume', {
        inputName: sourceName,
        inputVolumeDb: clampedDb
      });

      console.log(`Set volume: ${sourceName} = ${clampedDb}dB`);
      return true;
    } catch (error) {
      console.error(`Failed to set volume for ${sourceName}:`, error);
      return false;
    }
  }

  async setMute(sourceName, muted) {
    try {
      await this.obs.call('SetInputMute', {
        inputName: sourceName,
        inputMuted: muted
      });

      console.log(`Set mute: ${sourceName} = ${muted}`);
      return true;
    } catch (error) {
      console.error(`Failed to set mute for ${sourceName}:`, error);
      return false;
    }
  }

  async toggleMute(sourceName) {
    try {
      const { inputMuted } = await this.obs.call('GetInputMute', { 
        inputName: sourceName 
      });
      
      return await this.setMute(sourceName, !inputMuted);
    } catch (error) {
      console.error(`Failed to toggle mute for ${sourceName}:`, error);
      return false;
    }
  }

  // Batch Operations
  async setMultipleVolumes(volumeSettings) {
    const results = {};
    
    for (const [sourceName, volumeDb] of Object.entries(volumeSettings)) {
      results[sourceName] = await this.setVolume(sourceName, volumeDb);
    }
    
    return results;
  }

  // Source Mapping für verschiedene Anwendungen
  mapApplicationToSource(appName) {
    // Mapping verschiedener Anwendungsnamen zu OBS-Quellennamen
    const mappings = {
      'desktop': 'Desktop Audio',
      'desktop_audio': 'Desktop Audio',
      'mic': 'Mic/Aux',
      'microphone': 'Mic/Aux',
      'discord': 'Discord',
      'browser': 'Browser',
      'chrome': 'Browser',
      'firefox': 'Browser',
      'game': 'Game Audio',
      'music': 'Music',
      'spotify': 'Music',
      'alert': 'Alert Audio',
      'obs': 'OBS Audio'
    };

    return mappings[appName.toLowerCase()] || appName;
  }

  // Event Handlers
  handleVolumeChange(data) {
    const { inputName, inputVolume, inputVolumeDb } = data;
    
    const source = this.audioSources.get(inputName);
    if (source) {
      source.volume = inputVolume;
      source.volumeDb = inputVolumeDb;
    }

    this.triggerCallback('volumeChanged', {
      sourceName: inputName,
      volume: inputVolume,
      volumeDb: inputVolumeDb
    });
  }

  handleMuteChange(data) {
    const { inputName, inputMuted } = data;
    
    const source = this.audioSources.get(inputName);
    if (source) {
      source.muted = inputMuted;
    }

    this.triggerCallback('muteChanged', {
      sourceName: inputName,
      muted: inputMuted
    });
  }

  handleSourceCreated(data) {
    console.log('New audio source created:', data.inputName);
    this.discoverAudioSources(); // Re-discover sources
  }

  handleSourceRemoved(data) {
    console.log('Audio source removed:', data.inputName);
    this.audioSources.delete(data.inputName);
    this.audioLevels.delete(data.inputName);
    this.triggerCallback('sourceRemoved', data.inputName);
  }

  // Getters
  getAudioSources() {
    return Array.from(this.audioSources.values());
  }

  getAudioSource(sourceName) {
    return this.audioSources.get(sourceName);
  }

  getAudioLevels(sourceName) {
    return this.audioLevels.get(sourceName);
  }

  getAllAudioLevels() {
    const levels = {};
    this.audioLevels.forEach((level, sourceName) => {
      levels[sourceName] = level;
    });
    return levels;
  }

  isConnected() {
    return this.connected;
  }

  // Scene & Source Management
  async getCurrentScene() {
    try {
      const { currentProgramSceneName } = await this.obs.call('GetCurrentProgramScene');
      return currentProgramSceneName;
    } catch (error) {
      console.error('Failed to get current scene:', error);
      return null;
    }
  }

  async setCurrentScene(sceneName) {
    try {
      await this.obs.call('SetCurrentProgramScene', { 
        sceneName 
      });
      return true;
    } catch (error) {
      console.error('Failed to set scene:', error);
      return false;
    }
  }

  // Song Display Functions for OBS Text Sources
  async updateSongDisplay(songInfo, moodInfo, settings = {}) {
    try {
      if (!this.connected) {
        console.log('Not connected to OBS, skipping song display update');
        return false;
      }

      const textSourceName = settings.obsSongTextSource || 'Current Song';
      const displayDuration = settings.obsDisplayDuration || 5000;
      const alwaysShow = settings.obsAlwaysShow || false;
      
      // Format song text
      const songText = this.formatSongText(songInfo, moodInfo, settings);
      
      // Update text source
      const success = await this.updateTextSource(textSourceName, songText);
      
      if (success) {
        console.log('Song display updated in OBS:', songInfo.title);
        
        // Auto-hide after duration (if not always showing)
        if (!alwaysShow && displayDuration > 0) {
          setTimeout(async () => {
            await this.hideTextSource(textSourceName);
          }, displayDuration);
        }
        
        this.triggerCallback('songDisplayUpdated', { song: songInfo, mood: moodInfo });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to update song display:', error);
      return false;
    }
  }

  formatSongText(songInfo, moodInfo, settings = {}) {
    const template = settings.obsSongTemplate || 'Now Playing: {title}\nArtist: {artist}\nMood: {mood}';
    
    return template
      .replace('{title}', songInfo.title || 'Unknown Title')
      .replace('{artist}', songInfo.artist || 'Unknown Artist')
      .replace('{album}', songInfo.album || '')
      .replace('{mood}', moodInfo.name || 'Unknown Mood')
      .replace('{genre}', songInfo.genre || '')
      .replace('{year}', songInfo.year || '')
      .replace('\\n', '\n'); // Convert \\n to actual newlines
  }

  async updateTextSource(sourceName, text) {
    try {
      // Try to update existing text source
      await this.obs.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings: {
          text: text
        }
      });
      
      // Make source visible
      await this.setSourceVisibility(sourceName, true);
      
      return true;
    } catch (error) {
      console.error(`Failed to update text source '${sourceName}':`, error);
      
      // Try to create the source if it doesn't exist
      try {
        await this.createTextSource(sourceName, text);
        return true;
      } catch (createError) {
        console.error(`Failed to create text source '${sourceName}':`, createError);
        return false;
      }
    }
  }

  async createTextSource(sourceName, text) {
    try {
      // Create a new text source
      await this.obs.call('CreateInput', {
        sceneName: await this.getCurrentScene(),
        inputName: sourceName,
        inputKind: 'text_gdiplus_v2', // Windows
        inputSettings: {
          text: text,
          font: {
            face: 'Arial',
            size: 32,
            flags: 0
          },
          color: 0xFFFFFF, // White
          align: 'left',
          valign: 'top',
          outline: true,
          outline_size: 2,
          outline_color: 0x000000 // Black outline
        }
      });
      
      console.log(`Created text source: ${sourceName}`);
      return true;
    } catch (error) {
      // Try alternative text source for other platforms
      try {
        await this.obs.call('CreateInput', {
          sceneName: await this.getCurrentScene(),
          inputName: sourceName,
          inputKind: 'text_ft2_source_v2', // Linux/macOS
          inputSettings: {
            text: text,
            font_size: 32,
            color1: 0xFFFFFF,
            color2: 0xFFFFFF
          }
        });
        
        console.log(`Created text source (FreeType): ${sourceName}`);
        return true;
      } catch (ftError) {
        console.error('Failed to create text source with both methods:', error, ftError);
        throw ftError;
      }
    }
  }

  async hideTextSource(sourceName) {
    try {
      await this.setSourceVisibility(sourceName, false);
      return true;
    } catch (error) {
      console.error(`Failed to hide text source '${sourceName}':`, error);
      return false;
    }
  }

  async setSourceVisibility(sourceName, visible) {
    try {
      const currentScene = await this.getCurrentScene();
      if (!currentScene) {
        throw new Error('No current scene found');
      }
      
      await this.obs.call('SetSceneItemEnabled', {
        sceneName: currentScene,
        sceneItemId: await this.getSceneItemId(currentScene, sourceName),
        sceneItemEnabled: visible
      });
      
      return true;
    } catch (error) {
      console.error(`Failed to set visibility for '${sourceName}':`, error);
      return false;
    }
  }

  async getSceneItemId(sceneName, sourceName) {
    try {
      const { sceneItems } = await this.obs.call('GetSceneItemList', {
        sceneName: sceneName
      });
      
      const item = sceneItems.find(item => item.sourceName === sourceName);
      if (!item) {
        throw new Error(`Scene item not found: ${sourceName}`);
      }
      
      return item.sceneItemId;
    } catch (error) {
      console.error(`Failed to get scene item ID for '${sourceName}':`, error);
      throw error;
    }
  }

  // Callback System
  onConnected(callback) {
    this.addCallback('connected', callback);
  }

  onDisconnected(callback) {
    this.addCallback('disconnected', callback);
  }

  onError(callback) {
    this.addCallback('error', callback);
  }

  onAudioLevels(callback) {
    this.addCallback('audioLevels', callback);
  }

  onVolumeChanged(callback) {
    this.addCallback('volumeChanged', callback);
  }

  onMuteChanged(callback) {
    this.addCallback('muteChanged', callback);
  }

  onSourcesDiscovered(callback) {
    this.addCallback('sourcesDiscovered', callback);
  }

  addCallback(type, callback) {
    if (!this.callbacks.has(type)) {
      this.callbacks.set(type, []);
    }
    this.callbacks.get(type).push(callback);
  }

  removeCallback(type, callback) {
    const callbacks = this.callbacks.get(type) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  triggerCallback(type, data = null) {
    const callbacks = this.callbacks.get(type) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`OBS callback error (${type}):`, error);
      }
    });
  }

  // Testing & Debugging
  async testConnection() {
    try {
      const version = await this.obs.call('GetVersion');
      console.log('OBS WebSocket version:', version);
      return version;
    } catch (error) {
      console.error('OBS connection test failed:', error);
      return null;
    }
  }

  async getStats() {
    try {
      const stats = await this.obs.call('GetStats');
      return stats;
    } catch (error) {
      console.error('Failed to get OBS stats:', error);
      return null;
    }
  }

  // Cleanup
  destroy() {
    this.disconnect();
    this.callbacks.clear();
    this.audioSources.clear();
    this.audioLevels.clear();
    console.log('OBS WebSocket Service destroyed');
  }
}

export default new OBSWebSocketService();
