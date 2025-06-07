// 🎵 GEFIXT: OBS WebSocket Client mit funktionierender Audio-Visualisierung
// Das Problem war: EventSubscription wurde nicht korrekt aus obs-websocket-js importiert!
import OBSWebSocket, { EventSubscription } from 'obs-websocket-js';

class OBSWebSocketService {
  constructor() {
    this.obs = new OBSWebSocket();
    this.connected = false;
    this.reconnectInterval = null;
    this.reconnectDelay = 5000;
    this.audioSources = new Map();
    this.audioLevels = new Map();
    this.callbacks = new Map();
    this.lastConnectionParams = null;

    // Setup event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.obs.on('ConnectionOpened', () => {
      console.log('🔗 OBS WebSocket connected');
      this.connected = true;
      this.triggerCallback('connected');
      
      setTimeout(() => {
        this.discoverAudioSources();
      }, 1000);
    });

    this.obs.on('ConnectionClosed', () => {
      console.log('❌ OBS WebSocket disconnected');
      this.connected = false;
      this.triggerCallback('disconnected');
      this.startReconnect();
    });

    this.obs.on('ConnectionError', (error) => {
      console.error('❌ OBS WebSocket connection error:', error);
      this.triggerCallback('error', error);
      this.startReconnect();
    });

    // 🎵 KRITISCH: Audio Level Monitoring - InputVolumeMeters Event Handler
    this.obs.on('InputVolumeMeters', (data) => {
      console.log('🎵 Audio level event received:', data); // Debug-Log
      this.handleAudioLevels(data);
    });

    // Audio Source Changes
    this.obs.on('InputVolumeChanged', (data) => {
      console.log('🔊 Volume changed:', data);
      this.handleVolumeChange(data);
    });

    this.obs.on('InputMuteStateChanged', (data) => {
      console.log('🔇 Mute changed:', data);
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
      if (this.connected) {
        await this.disconnect();
      }

      this.lastConnectionParams = { host, port, password };

      // 🎯 LÖSUNG: Korrekte Event-Subscription mit echten EventSubscription-Konstanten!
      const connectionOptions = {
        eventSubscriptions: (
          EventSubscription.General |
          EventSubscription.Inputs |
          EventSubscription.Scenes |
          EventSubscription.InputVolumeMeters |        // 🎵 DAS IST DER SCHLÜSSEL!
          EventSubscription.InputActiveStateChanged
        ),
        rpcVersion: 1
      };
      
      console.log('🔗 Connecting with event subscriptions:', connectionOptions.eventSubscriptions);
      console.log('🎵 InputVolumeMeters subscription value:', EventSubscription.InputVolumeMeters);
      
      await this.obs.connect(`ws://${host}:${port}`, password || undefined, connectionOptions);

      console.log('✅ Connected to OBS WebSocket with audio level events enabled:', `${host}:${port}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to OBS:', error);
      
      // Fallback ohne Passwort
      if (password) {
        try {
          console.log('🔄 Retrying without password...');
          await this.obs.connect(`ws://${host}:${port}`, undefined, {
            eventSubscriptions: (
              EventSubscription.General |
              EventSubscription.Inputs |
              EventSubscription.Scenes |
              EventSubscription.InputVolumeMeters |
              EventSubscription.InputActiveStateChanged
            ),
            rpcVersion: 1
          });
          console.log('✅ Connected to OBS WebSocket (no auth) with audio events:', `${host}:${port}`);
          return true;
        } catch (fallbackError) {
          console.error('❌ Fallback connection failed:', fallbackError);
        }
      }
      throw error;
    }
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
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!this.connected) {
        console.log('Not connected to OBS, skipping source discovery');
        return;
      }

      const { inputs } = await this.obs.call('GetInputList');
      
      this.audioSources.clear();
      
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
        if (audioKinds.includes(input.inputKind)) {
          const sourceInfo = await this.getAudioSourceInfo(input.inputName);
          if (sourceInfo) {
            this.audioSources.set(input.inputName, sourceInfo);
          }
        }
      }

      console.log('🎵 Discovered audio sources:', Array.from(this.audioSources.keys()));
      this.triggerCallback('sourcesDiscovered', Array.from(this.audioSources.values()));
      
    } catch (error) {
      console.error('Failed to discover audio sources:', error);
    }
  }

  async getAudioSourceInfo(sourceName) {
    try {
      const volumeData = await this.obs.call('GetInputVolume', { 
        inputName: sourceName 
      });
      
      const muteData = await this.obs.call('GetInputMute', { 
        inputName: sourceName 
      });

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

  // 🎵 GEFIXT: Audio Level Handling - Jetzt mit echten Events!
  handleAudioLevels(data) {
    // Reduziere Spam-Logs - nur bei ersten 5 Events loggen
    if (!this.audioEventCount) this.audioEventCount = 0;
    if (this.audioEventCount < 5) {
      console.log('🎵 Processing audio levels:', data.inputs ? `${data.inputs.length} inputs` : 'legacy format');
      this.audioEventCount++;
    }
    
    if (data.inputs && Array.isArray(data.inputs)) {
      data.inputs.forEach(inputData => {
        this.processInputLevels(inputData);
      });
    } else {
      this.processInputLevels(data);
    }
  }

  processInputLevels(inputData) {
    const { inputName, inputLevelsMul } = inputData;
    
    if (!inputLevelsMul || inputLevelsMul.length === 0) {
      return;
    }
    
    // 🎯 GEFIXT: inputLevelsMul enthält Arrays, nicht direkte Werte!
    // inputLevelsMul[0] = [current, peak, hold] für linken Kanal
    // inputLevelsMul[1] = [current, peak, hold] für rechten Kanal
    const leftArray = inputLevelsMul[0] || [0];
    const rightArray = inputLevelsMul[1] || inputLevelsMul[0] || [0];
    
    // Nimm den ersten Wert (current level) aus jedem Array
    const leftMultiplier = Array.isArray(leftArray) ? leftArray[0] : leftArray;
    const rightMultiplier = Array.isArray(rightArray) ? rightArray[0] : rightArray;
    
    // Extrahiere auch Peak-Werte (vermutlich der zweite Wert in den Arrays)
    const leftPeakMultiplier = Array.isArray(leftArray) && leftArray.length > 1 ? leftArray[1] : leftMultiplier;
    const rightPeakMultiplier = Array.isArray(rightArray) && rightArray.length > 1 ? rightArray[1] : rightMultiplier;
    
    const levels = {
      left: this.multiplierToDecibel(leftMultiplier),
      right: this.multiplierToDecibel(rightMultiplier),
      timestamp: Date.now(),
      isReal: true, // 🎯 WICHTIG: Markierung für echte Audio-Daten
      peak: {
        left: this.multiplierToDecibel(leftPeakMultiplier),
        right: this.multiplierToDecibel(rightPeakMultiplier)
      }
    };

    // Debug-Log für erste 3 Events pro Source mit mehr Details
    if (!this.debugCounters) this.debugCounters = {};
    if (!this.debugCounters[inputName]) this.debugCounters[inputName] = 0;
    if (this.debugCounters[inputName] < 3) {
      console.log(`🎵 ${inputName}: L=${levels.left.toFixed(1)}dB R=${levels.right.toFixed(1)}dB | Peak: L=${levels.peak.left.toFixed(1)}dB R=${levels.peak.right.toFixed(1)}dB (Event #${this.debugCounters[inputName] + 1})`);
      this.debugCounters[inputName]++;
      
      // Zusätzliche Info bei erstem Event
      if (this.debugCounters[inputName] === 1) {
        console.log(`📊 ${inputName} - Audio source initialized with real data`);
        console.log(`🔍 ${inputName} - Raw data structure:`, { leftArray, rightArray });
      }
    }

    // Update audio source mit neuen Levels
    const source = this.audioSources.get(inputName);
    if (source) {
      source.levels = levels;
      source.peak = levels.peak;
      source.lastUpdate = Date.now();
      this.audioSources.set(inputName, source);
    }

    this.audioLevels.set(inputName, levels);
    
    // 🎯 Forward to GlobalStateService
    try {
      if (window.globalStateService) {
        window.globalStateService.updateAudioLevels(inputName, levels);
      }
    } catch (error) {
      console.error('Failed to forward audio levels to GlobalStateService:', error);
    }
    
    // Trigger callback for UI
    this.triggerCallback('audioLevels', { sourceName: inputName, levels });
  }

  // Mathematische Konvertierung (wie im alten Projekt)
  multiplierToDecibel(multiplier) {
    if (multiplier <= 0) return -60;
    return Math.max(-60, 20 * Math.log10(multiplier));
  }

  decibelToMultiplier(db) {
    if (db <= -60) return 0;
    return Math.pow(10, db / 20);
  }

  // Volume Control
  async setVolume(sourceName, volumeDb) {
    try {
      const clampedDb = Math.max(-60, Math.min(0, volumeDb));
      
      await this.obs.call('SetInputVolume', {
        inputName: sourceName,
        inputVolumeDb: clampedDb
      });

      console.log(`🔊 Set volume: ${sourceName} = ${clampedDb}dB`);
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

      console.log(`🔇 Set mute: ${sourceName} = ${muted}`);
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

  // Event Handlers für Synchronisation
  handleVolumeChange(data) {
    const { inputName, inputVolume, inputVolumeDb } = data;
    
    const source = this.audioSources.get(inputName);
    if (source) {
      source.volume = inputVolume;
      source.volumeDb = inputVolumeDb;
      this.audioSources.set(inputName, source);
    }

    try {
      if (window.globalStateService) {
        window.globalStateService.updateSourceVolume(inputName, inputVolumeDb);
      }
    } catch (error) {
      console.error('Failed to forward volume change to GlobalStateService:', error);
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
    this.discoverAudioSources();
  }

  handleSourceRemoved(data) {
    console.log('Audio source removed:', data.inputName);
    this.audioSources.delete(data.inputName);
    this.audioLevels.delete(data.inputName);
    this.triggerCallback('sourceRemoved', data.inputName);
  }

  // 🧪 Test & Debug Functions
  async testConnection() {
    try {
      const version = await this.obs.call('GetVersion');
      console.log('🔗 OBS WebSocket version:', version);
      return version;
    } catch (error) {
      console.error('❌ OBS connection test failed:', error);
      return null;
    }
  }

  async testEventSubscription() {
    if (!this.connected) {
      console.log('❌ Not connected to OBS');
      return false;
    }
    
    console.log('✅ Connected to OBS. Testing event subscription...');
    console.log('🎵 Event subscriptions active. Audio should be playing in OBS to see InputVolumeMeters events.');
    
    // Test: Audio-Sources anzeigen
    const sources = this.getAudioSources();
    console.log(`📊 Found ${sources.length} audio sources:`, sources.map(s => s.name));
    
    // Test: Event-Subscription-Details
    console.log('🔧 Event subscription details:');
    console.log('- EventSubscription.InputVolumeMeters:', EventSubscription.InputVolumeMeters);
    console.log('- Total subscription mask:', (
      EventSubscription.General |
      EventSubscription.Inputs |
      EventSubscription.Scenes |
      EventSubscription.InputVolumeMeters |
      EventSubscription.InputActiveStateChanged
    ));
    
    return true;
  }

  // Force audio level test
  forceAudioLevelTest() {
    console.log('🧪 Force testing audio levels...');
    
    // Simuliere Test-Audio-Level für erste Source
    const firstSource = Array.from(this.audioSources.keys())[0];
    if (firstSource) {
      const testLevels = {
        left: -20 + Math.sin(Date.now() / 1000) * 10,
        right: -25 + Math.cos(Date.now() / 1000) * 10,
        timestamp: Date.now(),
        isReal: false, // Test-Daten
        peak: { left: -15, right: -15 }
      };
      
      console.log(`🧪 Test levels for ${firstSource}:`, testLevels);
      
      if (window.globalStateService) {
        window.globalStateService.updateAudioLevels(firstSource, testLevels);
      }
    }
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