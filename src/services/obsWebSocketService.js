// 🎵 SIMPLIFIED: OBS WebSocket Client mit Browser Source Refresh
// Nur das Nötige: WebSocket + obsDataWriter + Browser Source Refresh
import OBSWebSocket, { EventSubscription } from 'obs-websocket-js';
import obsDataWriter from './obsDataWriter';
// import obsHttpServer from './obsHttpServer'; // ❌ ENTFERNT

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

    // 🎯 SIMPLIFIED: Nur Browser Source Refresh Variables
    this.currentDisplayData = null;
    this.displayTimeout = null;

    // Setup event handlers
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.obs.on('ConnectionOpened', () => {
      console.log('🔗 OBS WebSocket connected');
      this.connected = true;
      
      // 🚨 KRITISCHER FIX: Update Unified Global State Service SOFORT!
      if (window.globalStateService) {
        console.log('🚨 FIXING: Updating Unified Global State Service with OBS connection');
        window.globalStateService.updateOBSState({ connected: true });
      }
      
      this.triggerCallback('connected');
      
      // 🎯 GEFIXT: Warte bis WebSocket richtig identifiziert ist
      // Das "Socket not identified" Problem tritt auf wenn discovery zu früh läuft
      setTimeout(() => {
        if (this.connected) {
          console.log('🔍 Starting source discovery after identification...');
          this.discoverAudioSources();
          this.discoverBrowserSources();
        }
      }, 3000); // Noch längere Verzögerung für sichere Identifikation
    });

    this.obs.on('ConnectionClosed', () => {
      console.log('❌ OBS WebSocket disconnected');
      this.connected = false;
      
      // 🚨 KRITISCHER FIX: Update Unified Global State Service beim Disconnect!
      if (window.globalStateService) {
        console.log('🚨 FIXING: Updating Unified Global State Service with OBS disconnect');
        window.globalStateService.updateOBSState({ 
          connected: false,
          sources: [],
          audioLevels: {},
          scenes: []
        });
      }
      
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
      // Kein Debug-Log mehr - Audio-Events funktionieren
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
      
      // 🚨 KRITISCHER FIX: Update Unified Global State Service mit entdeckten Sources!
      const sourcesArray = Array.from(this.audioSources.values());
      if (window.globalStateService) {
        console.log('🚨 FIXING: Sending', sourcesArray.length, 'audio sources to Unified Global State Service');
        window.globalStateService.updateOBSState({ 
          sources: sourcesArray,
          lastSourceDiscovery: Date.now()
        });
        
        // Trigger der sourcesDiscovered callback im GlobalStateService
        window.globalStateService.triggerCallbacks('sourcesDiscovered', sourcesArray);
      }
      
      this.triggerCallback('sourcesDiscovered', sourcesArray);
      
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
    // Reduzierte Logs - nur bei ersten 2 Events insgesamt
    if (!this.totalAudioEventCount) this.totalAudioEventCount = 0;
    if (this.totalAudioEventCount < 2) {
      console.log('🎵 Processing audio levels:', data.inputs ? `${data.inputs.length} inputs` : 'legacy format');
      this.totalAudioEventCount++;
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
    
    // 🚀 OPTIMIERUNG: Ignoriere ausgeblendete Sources
    if (window.globalStateService && window.globalStateService.isSourceHidden && window.globalStateService.isSourceHidden(inputName)) {
      return; // Skip processing für bessere Performance
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

    // Debug-Log nur für erste Source und nur erste 2 Events
    if (!this.debugCounters) this.debugCounters = {};
    if (!this.debugCounters[inputName]) this.debugCounters[inputName] = 0;
    if (this.debugCounters[inputName] < 2 && Object.keys(this.debugCounters).length === 1) {
      console.log(`🎵 ${inputName}: L=${levels.left.toFixed(1)}dB R=${levels.right.toFixed(1)}dB | Peak: L=${levels.peak.left.toFixed(1)}dB R=${levels.peak.right.toFixed(1)}dB`);
      this.debugCounters[inputName]++;
      
      // Info nur bei erstem Event der ersten Source
      if (this.debugCounters[inputName] === 1) {
        console.log(`📊 Audio processing active - logs reduced to prevent spam`);
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
    
    // 🚨 KRITISCHER FIX: Forward to UNIFIED GlobalStateService
    try {
      if (window.globalStateService) {
        window.globalStateService.updateAudioLevels(inputName, levels);
      }
    } catch (error) {
      console.error('Failed to forward audio levels to Unified GlobalStateService:', error);
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
      console.error('Failed to forward volume change to Unified GlobalStateService:', error);
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

  // 🎯 OBS Browser Source Test Functions
  async testBrowserSourceRefresh() {
    console.log('🧪 Browser Source Refresh Test gestartet...');
    
    // Entdecke Browser Sources
    await this.discoverBrowserSources();
    
    // Zeige gefundene Sources
    const moodMusicSources = Array.from(this.browserSources.values()).filter(s => s.isMoodMusic);
    console.log(`🔍 Gefundene Mood Music Browser Sources: ${moodMusicSources.length}`);
    moodMusicSources.forEach(source => {
      console.log(`  - "${source.name}" (${source.url})`);
    });
    
    if (moodMusicSources.length === 0) {
      console.log('⚠️ Keine Mood Music Browser Sources gefunden!');
      console.log('💡 Erstelle eine Browser Source in OBS mit "mood", "music" oder "song" im Namen');
      return false;
    }
    
    // Test Refresh
    console.log('🔄 Teste Browser Source Refresh...');
    const success = await this.refreshBrowserSources(true);
    
    if (success) {
      console.log('✅ Browser Source Refresh Test erfolgreich!');
    } else {
      console.log('❌ Browser Source Refresh Test fehlgeschlagen!');
    }
    
    return success;
  }

  async manualRefreshAllBrowserSources() {
    console.log('🔄 Manueller Refresh aller Browser Sources...');
    return await this.refreshBrowserSources(false); // Alle Sources, nicht nur Mood Music
  }

  async manualRefreshMoodMusicSources() {
    console.log('🎵 Manueller Refresh nur für Mood Music Browser Sources...');
    return await this.refreshBrowserSources(true); // Nur Mood Music Sources
  }

  getBrowserSourcesStatus() {
    const allSources = Array.from(this.browserSources.values());
    const moodMusicSources = allSources.filter(s => s.isMoodMusic);
    
    return {
      total: allSources.length,
      moodMusic: moodMusicSources.length,
      sources: allSources,
      lastRefreshedSongId: this.lastRefreshedSongId
    };
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

  // 🎯 OBS BROWSER SOURCE REFRESH - Raw Command Ansatz
  browserSources = new Map();
  lastRefreshedSongId = null;

  async discoverBrowserSources() {
    if (!this.connected) {
      console.warn('⚠️ OBS nicht verbunden für Browser Source Discovery');
      return;
    }

    try {
      console.log('🔍 Suche Browser Sources...');
      
      // 🎯 ROBUSTE DISCOVERY: Mit Retry-Logik
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          const { inputs } = await this.obs.call('GetInputList');
          this.browserSources.clear();

          for (const input of inputs) {
            if (input.inputKind === 'browser_source') {
              try {
                const settings = await this.obs.call('GetInputSettings', {
                  inputName: input.inputName
                });
                
                const url = settings.inputSettings.url || '';
                const name = input.inputName.toLowerCase();
                
                // Finde alle Browser Sources (nicht nur Mood Music spezifische)
                this.browserSources.set(input.inputName, {
                  name: input.inputName,
                  url: url,
                  isMoodMusic: name.includes('mood') || name.includes('music') || name.includes('song') || url.includes('obs-display')
                });
                
                console.log(`🔗 Browser Source gefunden: "${input.inputName}" ${this.browserSources.get(input.inputName).isMoodMusic ? '(Mood Music)' : ''}`);
              } catch (sourceError) {
                // Skip sources we can't access
                console.warn(`⚠️ Kann Source "${input.inputName}" nicht laden:`, sourceError.message);
              }
            }
          }
          
          console.log(`✅ ${this.browserSources.size} Browser Source(s) gefunden`);
          return; // Erfolg, exit retry loop
          
        } catch (error) {
          retryCount++;
          if (error.message?.includes('Socket not identified') && retryCount < maxRetries) {
            console.log(`🔄 Socket noch nicht identifiziert, Retry ${retryCount}/${maxRetries} in 1s...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw error; // Re-throw if not a retry-able error
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Fehler beim Finden der Browser Sources:', error.message);
    }
  }

  async refreshBrowserSources(onlyMoodMusic = true) {
    if (!this.connected || this.browserSources.size === 0) {
      console.log('⚠️ Keine OBS Verbindung oder Browser Sources für Refresh');
      return false;
    }

    const sourcesToRefresh = Array.from(this.browserSources.values())
      .filter(source => !onlyMoodMusic || source.isMoodMusic);
    
    if (sourcesToRefresh.length === 0) {
      console.log('⚠️ Keine Mood Music Browser Sources zum Refreshen gefunden');
      console.log('💡 Tipp: Benenne deine Browser Source mit "mood", "music" oder "song" im Namen');
      return false;
    }

    console.log(`🔄 Refreshe ${sourcesToRefresh.length} Browser Source(s)...`);
    
    let successCount = 0;
    for (const source of sourcesToRefresh) {
      try {
        // 🎯 DER MAGISCHE OBS RAW COMMAND!
        await this.obs.call('PressInputPropertiesButton', {
          inputName: source.name,
          propertyName: 'refreshnocache'  // Das ist der "Refresh Cache" Button!
        });
        
        console.log(`✅ Browser Source refreshed: "${source.name}"`);
        successCount++;
        
        // Kleine Pause zwischen Refreshes
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`⚠️ Konnte "${source.name}" nicht refreshen:`, error.message);
      }
    }
    
    console.log(`🎉 ${successCount}/${sourcesToRefresh.length} Browser Sources erfolgreich refreshed!`);
    return successCount > 0;
  }

  // Song Display Methods
  async updateSongDisplay(song, mood, settings = {}) {
    try {
      // 🎯 SINGLE UPDATE: Verhindere doppelte Updates
      const songId = song?.id;
      if (!songId) {
        console.warn('⚠️ Song has no ID, skipping update');
        return;
      }

      const displayData = {
        song,
        mood,
        settings,
        timestamp: Date.now(),
        showDisplay: true
      };
      
      this.currentDisplayData = displayData;
      
      // 💾 SINGLE DATA WRITE: Nur einmal schreiben
      await this.writeDisplayDataToFile(displayData);
      
      console.log('🎵 OBS song display updated:', song?.title);
      
      // 🔄 BROWSER SOURCE REFRESH: Nur bei neuen Songs
      const isNewSong = !this.lastRefreshedSongId || this.lastRefreshedSongId !== songId;
      
      if (isNewSong) {
        this.lastRefreshedSongId = songId;
        
        // Entdecke Browser Sources falls noch nicht gemacht
        if (this.browserSources.size === 0) {
          await this.discoverBrowserSources();
        }
        
        // Refreshe Browser Sources mit Raw Command!
        setTimeout(async () => {
          const refreshed = await this.refreshBrowserSources(true);
          if (refreshed) {
            console.log(`🎵 Browser Sources refreshed für neuen Song: "${song.title}"`);
          }
        }, 500); // Kurze Verzögerung damit die Daten geschrieben sind
      } else {
        console.log('🔄 Song bereits bekannt, überspringe Browser Source Refresh');
      }
      
      // Handle display timing
      if (!settings.obsAlwaysShow) {
        this.handleDisplayTiming(settings);
      }
      
      // Trigger display update callback
      this.triggerCallback('songDisplayUpdated', displayData);
      
    } catch (error) {
      console.error('Failed to update song display:', error);
    }
  }

  // ❌ DEAKTIVIERT: async startOBSHttpServer() - using obsDataWriter only
  // async startOBSHttpServer() {
  //   if (this.httpServerStarted) return;
  //   
  //   try {
  //     await obsHttpServer.start(3003);
  //     this.httpServerStarted = true;
  //     console.log('🌐 OBS HTTP Server started for data delivery');
  //   } catch (error) {
  //     console.error('Failed to start OBS HTTP Server:', error);
  //   }
  // }

  async writeDisplayDataToFile(data) {
    try {
      // 🎯 SINGLE DATA WRITER: Nur obsDataWriter
      await obsDataWriter.writeOBSData(data);
      
      // Entferne redundante Logs - obsDataWriter macht eigene Logs
    } catch (error) {
      console.error('❌ Error writing OBS display data:', error);
    }
  }

  handleDisplayTiming(settings) {
    const {
      obsDisplayDuration = 8000,
      obsPreDisplayDuration = 2000
    } = settings;

    // Clear any existing timeout
    if (this.displayTimeout) {
      clearTimeout(this.displayTimeout);
    }

    // Auto-hide after duration
    this.displayTimeout = setTimeout(async () => {
      try {
        const hideData = {
          ...this.currentDisplayData,
          showDisplay: false,
          timestamp: Date.now()
        };
        
        await this.writeDisplayDataToFile(hideData);
        console.log('Auto-hiding OBS display');
      } catch (error) {
        console.error('Error hiding display:', error);
      }
    }, obsDisplayDuration);
  }

  async hideSongDisplay() {
    try {
      const hideData = {
        ...this.currentDisplayData,
        showDisplay: false,
        timestamp: Date.now()
      };
      
      await this.writeDisplayDataToFile(hideData);
      console.log('Manually hiding OBS display');
    } catch (error) {
      console.error('Error hiding song display:', error);
    }
  }

  getDisplayURL() {
    // 🎯 SIMPLIFIED: Verwende obsDataWriter System
    return './obs-display.html'; // Lokale HTML-Datei mit obsDataWriter
  }

  getOBSHttpServerURL() {
    // ❌ DEAKTIVIERT: return obsHttpServer.getServerURL();
    return null; // Kein HTTP Server mehr
  }

  downloadAnimatedOBSFile(settings = {}) {
    // 🎯 SIMPLIFIED: Generiere HTML direkt hier ohne obsHttpServer
    const html = this.generateAnimatedOBSHTML(settings);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mood-music-obs-display.html';
    a.click();
    
    URL.revokeObjectURL(url);
    
    console.log('📥 Downloaded OBS HTML file with HTTP server connection');
  }

  downloadOBSData() {
    obsDataWriter.downloadOBSData();
  }

  downloadOBSPackage(htmlContent) {
    obsDataWriter.downloadOBSPackage(htmlContent);
  }

  generateAnimatedOBSHTML(settings = {}) {
    const {
      obsDisplayDuration = 8000,
      obsPreDisplayDuration = 2000,
      obsAlwaysShow = false,
      obsShowCover = true,
      obsAnimationStyle = 'slide',
      obsMoodTransitionDuration = 1500
    } = settings;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mood Music - OBS Display</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
            background: transparent;
            overflow: hidden;
            width: 800px;
            height: 200px;
            position: relative;
        }

        .song-display {
            position: relative;
            width: 100%;
            height: 100%;
            border-radius: 16px;
            overflow: hidden;
            opacity: 0;
            transform: ${obsAnimationStyle === 'slide' ? 'translateY(40px)' : obsAnimationStyle === 'scale' ? 'scale(0.8)' : 'translateY(0px)'};
            transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .song-display.visible {
            opacity: 1;
            transform: ${obsAnimationStyle === 'slide' ? 'translateY(0)' : obsAnimationStyle === 'scale' ? 'scale(1)' : 'translateY(0px)'};
        }

        .background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            filter: blur(25px) brightness(0.4) saturate(1.2);
            transform: scale(1.2);
            transition: all ${obsMoodTransitionDuration}ms ease;
        }

        .mood-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.7;
            background: linear-gradient(135deg, #4ade8040, #3b82f640);
            transition: all ${obsMoodTransitionDuration}ms ease;
            mix-blend-mode: overlay;
        }

        .content {
            position: relative;
            z-index: 10;
            display: flex;
            align-items: center;
            height: 100%;
            padding: 24px;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        ${obsShowCover ? `
        .cover {
            width: 140px;
            height: 140px;
            border-radius: 12px;
            overflow: hidden;
            flex-shrink: 0;
            background: linear-gradient(135deg, #333, #555);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            transition: all 0.4s ease;
        }

        .cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: all 0.6s ease;
        }

        .cover-placeholder {
            color: #888;
            font-size: 32px;
            opacity: 0.6;
        }
        ` : ''}

        .info {
            margin-left: ${obsShowCover ? '32px' : '0px'};
            color: white;
            flex: 1;
            overflow: hidden;
        }

        .title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            line-height: 1.2;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            animation: fadeInUp 0.8s ease 0.2s both;
        }

        .artist {
            font-size: 18px;
            opacity: 0.9;
            margin-bottom: 12px;
            font-weight: 500;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
            animation: fadeInUp 0.8s ease 0.4s both;
        }

        .album {
            font-size: 14px;
            opacity: 0.7;
            font-style: italic;
            animation: fadeInUp 0.8s ease 0.6s both;
        }

        .mood-indicator {
            position: absolute;
            top: 20px;
            right: 20px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            color: white;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            animation: fadeInDown 0.8s ease 0.8s both;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        .wave-animation {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 8px;
            background: linear-gradient(90deg, transparent, currentColor, transparent);
            opacity: 0.6;
            animation: wave 2s ease-in-out infinite;
        }

        .now-playing {
            position: absolute;
            top: -30px;
            left: 24px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
            animation: fadeInDown 0.8s ease both;
        }

        .connection-status {
            position: absolute;
            bottom: 8px;
            right: 8px;
            font-size: 10px;
            color: rgba(255, 255, 255, 0.5);
            background: rgba(0, 0, 0, 0.3);
            padding: 2px 6px;
            border-radius: 4px;
        }

        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes wave {
            0%, 100% { transform: translateX(-100%); }
            50% { transform: translateX(100%); }
        }

        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.02); opacity: 0.9; }
        }

        @keyframes pulse-fast {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.04); opacity: 1; }
        }

        .pulse-slow { animation: pulse 3s ease-in-out infinite; }
        .pulse-normal { animation: pulse 2s ease-in-out infinite; }
        .pulse-fast { animation: pulse-fast 1s ease-in-out infinite; }

        .mood-energetic .mood-overlay { animation: pulse-fast 1.5s ease-in-out infinite; }
        .mood-calm .mood-overlay { animation: pulse 4s ease-in-out infinite; }
        .mood-dark .mood-overlay { animation: pulse 5s ease-in-out infinite; }
    </style>
</head>
<body>
    <div id="songDisplay" class="song-display">
        <div class="now-playing">♪ Now Playing</div>
        <div id="background" class="background"></div>
        <div id="moodOverlay" class="mood-overlay"></div>
        <div class="content">
            ${obsShowCover ? `
            <div class="cover">
                <img id="coverImage" src="" alt="Album Cover" style="display: none;">
                <div id="coverPlaceholder" class="cover-placeholder">♪</div>
            </div>
            ` : ''}
            <div class="info">
                <div id="songTitle" class="title">Mood Music</div>
                <div id="artistName" class="artist">Waiting for data...</div>
                <div id="albumName" class="album" style="display: none;"></div>
            </div>
        </div>
        <div id="moodIndicator" class="mood-indicator" style="display: none;"></div>
        <div id="waveAnimation" class="wave-animation" style="display: none;"></div>
        <div id="connectionStatus" class="connection-status">Ready</div>
    </div>

    <script>
        const SETTINGS = {
            displayDuration: ${obsDisplayDuration},
            preDisplayDuration: ${obsPreDisplayDuration},
            alwaysShow: ${obsAlwaysShow},
            showCover: ${obsShowCover},
            animationStyle: '${obsAnimationStyle}',
            moodTransitionDuration: ${obsMoodTransitionDuration}
        };

        let currentSong = null;
        let currentMood = null;
        let lastDataTimestamp = 0;
        let isVisible = false;
        let connectionAttempts = 0;

        function updateConnectionStatus(status) {
            const statusEl = document.getElementById('connectionStatus');
            if (statusEl) {
                statusEl.textContent = status;
            }
        }

        async function loadDisplayData() {
            try {
                connectionAttempts++;
                
                // Try to load JSON file from same directory
                const response = await fetch('./obs-data.json?t=' + Date.now());
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.timestamp > lastDataTimestamp) {
                        lastDataTimestamp = data.timestamp;
                        updateDisplay(data);
                        updateConnectionStatus('Connected');
                        connectionAttempts = 0;
                        return true;
                    }
                }
                
                // If we get here, the JSON file wasn't found
                if (connectionAttempts === 1) {
                    updateConnectionStatus('Looking for obs-data.json...');
                    document.getElementById('artistName').textContent = 'Put obs-data.json in same folder!';
                } else if (connectionAttempts > 10) {
                    updateConnectionStatus('obs-data.json not found');
                    document.getElementById('artistName').textContent = 'Missing obs-data.json file';
                }

            } catch (error) {
                updateConnectionStatus('Error loading data');
            }
            return false;
        }

        function updateDisplay(data) {
            const { song, mood, settings, showDisplay } = data;
            
            console.log('🎵 Display update:', { 
                song: song?.title, 
                mood: mood?.name, 
                showDisplay,
                timestamp: data.timestamp 
            });
            
            const isNewSong = !currentSong || 
                currentSong.id !== song?.id || 
                currentSong.title !== song?.title;

            currentSong = song;
            currentMood = mood;

            if (song && mood && showDisplay) {
                updateContent(song, mood);
                updateMoodStyling(mood);
                
                if (isNewSong || !isVisible) {
                    showDisplayInternal();
                }
            } else if (!showDisplay && !SETTINGS.alwaysShow) {
                hideDisplayInternal();
            }
        }

        function updateContent(song, mood) {
            document.getElementById('songTitle').textContent = song.title || 'Unknown Title';
            document.getElementById('artistName').textContent = song.artist || 'Unknown Artist';
            
            const albumElement = document.getElementById('albumName');
            if (song.album) {
                albumElement.textContent = song.album;
                albumElement.style.display = 'block';
            } else {
                albumElement.style.display = 'none';
            }
            
            if (SETTINGS.showCover) {
                updateCover(song, mood);
            }
            
            const moodIndicator = document.getElementById('moodIndicator');
            moodIndicator.textContent = mood.name;
            moodIndicator.style.display = 'block';
        }

        function updateCover(song, mood) {
            const coverImg = document.getElementById('coverImage');
            const coverPlaceholder = document.getElementById('coverPlaceholder');
            const background = document.getElementById('background');
            
            let imageUsed = false;
            
            // Try song cover first
            if (song.cover && song.cover !== 'null' && song.cover !== '' && !song.cover.startsWith('blob:')) {
                coverImg.src = song.cover;
                coverImg.style.display = 'block';
                coverPlaceholder.style.display = 'none';
                background.style.backgroundImage = \`url(\${song.cover})\`;
                imageUsed = true;
            } 
            // Try mood background as fallback
            else if (song.moodBackground && song.moodBackground !== 'null' && song.moodBackground !== '') {
                coverImg.src = song.moodBackground;
                coverImg.style.display = 'block';
                coverPlaceholder.style.display = 'none';
                background.style.backgroundImage = \`url(\${song.moodBackground})\`;
                imageUsed = true;
            }
            // Try mood background directly
            else if (mood.background && mood.background !== 'null' && mood.background !== '') {
                coverImg.src = mood.background;
                coverImg.style.display = 'block';
                coverPlaceholder.style.display = 'none';
                background.style.backgroundImage = \`url(\${mood.background})\`;
                imageUsed = true;
            }
            
            if (!imageUsed) {
                coverImg.style.display = 'none';
                coverPlaceholder.style.display = 'flex';
                background.style.backgroundImage = 'none';
            }
        }

        function updateMoodStyling(mood) {
            const moodOverlay = document.getElementById('moodOverlay');
            const moodIndicator = document.getElementById('moodIndicator');
            const waveAnimation = document.getElementById('waveAnimation');
            const songDisplay = document.getElementById('songDisplay');
            
            songDisplay.classList.remove('mood-energetic', 'mood-calm', 'mood-dark');
            moodOverlay.classList.remove('pulse-slow', 'pulse-normal', 'pulse-fast');
            
            if (mood.color) {
                const moodColor = mood.color;
                moodOverlay.style.background = \`linear-gradient(135deg, \${moodColor}40, \${moodColor}20)\`;
                moodIndicator.style.background = \`\${moodColor}60\`;
                moodIndicator.style.borderColor = \`\${moodColor}80\`;
                waveAnimation.style.color = moodColor;
            }
            
            if (mood.pulseSpeed) {
                if (mood.pulseSpeed < 1.5) {
                    moodOverlay.classList.add('pulse-fast');
                    songDisplay.classList.add('mood-energetic');
                } else if (mood.pulseSpeed > 2.5) {
                    moodOverlay.classList.add('pulse-slow');
                    songDisplay.classList.add('mood-calm');
                } else {
                    moodOverlay.classList.add('pulse-normal');
                }
            }
            
            if (mood.intensity === 'extreme') {
                waveAnimation.style.display = 'block';
                songDisplay.classList.add('mood-energetic');
            } else if (mood.intensity === 'subtle') {
                songDisplay.classList.add('mood-calm');
            }
        }

        function showDisplayInternal() {
            const display = document.getElementById('songDisplay');
            display.classList.add('visible');
            isVisible = true;
        }

        function hideDisplayInternal() {
            if (SETTINGS.alwaysShow) return;
            const display = document.getElementById('songDisplay');
            display.classList.remove('visible');
            isVisible = false;
        }

        // Initialize
        if (SETTINGS.alwaysShow) {
            showDisplayInternal();
        }
        
        loadDisplayData();
        setInterval(loadDisplayData, 1000);
        
        console.log('🎵 Mood Music OBS Display ready - Looking for obs-data.json...');
    </script>
</body>
</html>`;
  }

  generateAnimatedOBSHTML(settings = {}) {
    const {
      obsDisplayDuration = 8000,
      obsPreDisplayDuration = 2000,
      obsAlwaysShow = false,
      obsShowCover = true,
      obsAnimationStyle = 'slide',
      obsMoodTransitionDuration = 1500
    } = settings;

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mood Music - Animated OBS Display</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
            background: transparent;
            overflow: hidden;
            width: 800px;
            height: 200px;
            position: relative;
        }

        .song-display {
            position: relative;
            width: 100%;
            height: 100%;
            border-radius: 16px;
            overflow: hidden;
            opacity: 0;
            transform: ${obsAnimationStyle === 'slide' ? 'translateY(40px)' : obsAnimationStyle === 'scale' ? 'scale(0.8)' : 'translateY(0px)'};
            transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }

        .song-display.visible {
            opacity: 1;
            transform: ${obsAnimationStyle === 'slide' ? 'translateY(0)' : obsAnimationStyle === 'scale' ? 'scale(1)' : 'translateY(0px)'};
        }

        .background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-size: cover;
            background-position: center;
            filter: blur(25px) brightness(0.4) saturate(1.2);
            transform: scale(1.2);
            transition: all ${obsMoodTransitionDuration}ms ease;
        }

        .mood-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            opacity: 0.7;
            background: linear-gradient(135deg, #4ade8040, #3b82f640);
            transition: all ${obsMoodTransitionDuration}ms ease;
            mix-blend-mode: overlay;
        }

        .content {
            position: relative;
            z-index: 10;
            display: flex;
            align-items: center;
            height: 100%;
            padding: 24px;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(15px);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .cover {
            width: 140px;
            height: 140px;
            border-radius: 12px;
            overflow: hidden;
            flex-shrink: 0;
            background: linear-gradient(135deg, #333, #555);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
            transition: all 0.4s ease;
        }

        .cover:hover {
            transform: scale(1.05);
        }

        .cover img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: all 0.6s ease;
        }

        .cover-placeholder {
            color: #888;
            font-size: 32px;
            opacity: 0.6;
        }

        .info {
            margin-left: 32px;
            color: white;
            flex: 1;
            overflow: hidden;
        }

        .title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
            line-height: 1.2;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            animation: fadeInUp 0.8s ease 0.2s both;
        }

        .artist {
            font-size: 18px;
            opacity: 0.9;
            margin-bottom: 12px;
            font-weight: 500;
            text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
            animation: fadeInUp 0.8s ease 0.4s both;
        }

        .album {
            font-size: 14px;
            opacity: 0.7;
            font-style: italic;
            animation: fadeInUp 0.8s ease 0.6s both;
        }

        .mood-indicator {
            position: absolute;
            top: 20px;
            right: 20px;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 600;
            color: white;
            background: rgba(255, 255, 255, 0.15);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            animation: fadeInDown 0.8s ease 0.8s both;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        .wave-animation {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 8px;
            background: linear-gradient(90deg, transparent, currentColor, transparent);
            opacity: 0.6;
            animation: wave 2s ease-in-out infinite;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes wave {
            0%, 100% {
                transform: translateX(-100%);
            }
            50% {
                transform: translateX(100%);
            }
        }

        @keyframes pulse {
            0%, 100% {
                transform: scale(1);
                opacity: 0.7;
            }
            50% {
                transform: scale(1.02);
                opacity: 0.9;
            }
        }

        @keyframes pulse-fast {
            0%, 100% {
                transform: scale(1);
                opacity: 0.8;
            }
            50% {
                transform: scale(1.04);
                opacity: 1;
            }
        }

        @keyframes glow {
            0%, 100% {
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 20px rgba(255, 255, 255, 0.1);
            }
            50% {
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.4), 0 0 30px rgba(255, 255, 255, 0.2);
            }
        }

        .pulse-slow {
            animation: pulse 3s ease-in-out infinite;
        }
        
        .pulse-normal {
            animation: pulse 2s ease-in-out infinite;
        }
        
        .pulse-fast {
            animation: pulse-fast 1s ease-in-out infinite;
        }

        .glow-effect {
            animation: glow 3s ease-in-out infinite;
        }

        .mood-energetic .mood-overlay {
            animation: pulse-fast 1.5s ease-in-out infinite;
        }

        .mood-calm .mood-overlay {
            animation: pulse 4s ease-in-out infinite;
        }

        .mood-dark .mood-overlay {
            animation: glow 5s ease-in-out infinite;
        }

        .now-playing {
            position: absolute;
            top: -30px;
            left: 24px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
            animation: fadeInDown 0.8s ease both;
        }

        ${obsAnimationStyle === 'glow' ? `
        .song-display.visible {
            animation: glow 2s ease-in-out infinite;
        }
        ` : ''}

        @media (max-width: 600px) {
            .cover {
                width: 100px;
                height: 100px;
            }
            .info {
                margin-left: 20px;
            }
            .title {
                font-size: 22px;
            }
            .artist {
                font-size: 16px;
            }
        }
    </style>
</head>
<body>
    <div id="songDisplay" class="song-display">
        <div class="now-playing">♪ Now Playing</div>
        <div id="background" class="background"></div>
        <div id="moodOverlay" class="mood-overlay"></div>
        <div class="content">
            ${obsShowCover ? `
            <div class="cover">
                <img id="coverImage" src="" alt="Album Cover" style="display: none;">
                <div id="coverPlaceholder" class="cover-placeholder">♪</div>
            </div>
            ` : ''}
            <div class="info">
                <div id="songTitle" class="title">Mood Music</div>
                <div id="artistName" class="artist">Waiting for next song...</div>
                <div id="albumName" class="album" style="display: none;"></div>
            </div>
        </div>
        <div id="moodIndicator" class="mood-indicator" style="display: none;"></div>
        <div id="waveAnimation" class="wave-animation" style="display: none;"></div>
    </div>

    <script>
        const SETTINGS = {
            displayDuration: ${obsDisplayDuration},
            preDisplayDuration: ${obsPreDisplayDuration},
            alwaysShow: ${obsAlwaysShow},
            showCover: ${obsShowCover},
            animationStyle: '${obsAnimationStyle}',
            moodTransitionDuration: ${obsMoodTransitionDuration}
        };

        let currentSong = null;
        let currentMood = null;
        let displayTimeout = null;
        let isVisible = false;

        function loadFromStorage() {
            try {
                let data;
                try {
                    data = sessionStorage.getItem('obs-song-display');
                } catch {
                    data = localStorage.getItem('obs-song-display');
                }
                
                if (data) {
                    const parsed = JSON.parse(data);
                    if (parsed.song || parsed.mood) {
                        updateDisplay(parsed);
                        return true;
                    }
                }
            } catch (error) {
                console.log('Error loading from storage:', error);
            }
            return false;
        }

        function updateDisplay(data) {
            const { song, mood, settings } = data;
            
            // Check if this is a new song
            const isNewSong = !currentSong || 
                currentSong.id !== song?.id || 
                currentSong.title !== song?.title;

            currentSong = song;
            currentMood = mood;

            if (song && mood) {
                updateContent(song, mood);
                updateMoodStyling(mood);
                
                if (isNewSong) {
                    handleSongChange();
                }
            } else if (!SETTINGS.alwaysShow) {
                hideDisplay();
            }
        }

        function updateContent(song, mood) {
            document.getElementById('songTitle').textContent = song.title || 'Unknown Title';
            document.getElementById('artistName').textContent = song.artist || 'Unknown Artist';
            
            const albumElement = document.getElementById('albumName');
            if (song.album) {
                albumElement.textContent = song.album;
                albumElement.style.display = 'block';
            } else {
                albumElement.style.display = 'none';
            }
            
            if (SETTINGS.showCover) {
                updateCover(song);
            }
            
            const moodIndicator = document.getElementById('moodIndicator');
            moodIndicator.textContent = mood.name;
            moodIndicator.style.display = 'block';
        }

        function updateCover(song) {
            const coverImg = document.getElementById('coverImage');
            const coverPlaceholder = document.getElementById('coverPlaceholder');
            const background = document.getElementById('background');
            
            if (song.cover && song.cover !== 'null' && song.cover !== '') {
                coverImg.src = song.cover;
                coverImg.style.display = 'block';
                coverPlaceholder.style.display = 'none';
                background.style.backgroundImage = \`url(\${song.cover})\`;
            } else {
                coverImg.style.display = 'none';
                coverPlaceholder.style.display = 'flex';
                background.style.backgroundImage = 'none';
            }
        }

        function updateMoodStyling(mood) {
            const moodOverlay = document.getElementById('moodOverlay');
            const moodIndicator = document.getElementById('moodIndicator');
            const waveAnimation = document.getElementById('waveAnimation');
            const songDisplay = document.getElementById('songDisplay');
            
            // Remove existing mood classes
            songDisplay.classList.remove('mood-energetic', 'mood-calm', 'mood-dark');
            moodOverlay.classList.remove('pulse-slow', 'pulse-normal', 'pulse-fast');
            
            if (mood.color) {
                const moodColor = mood.color;
                moodOverlay.style.background = \`linear-gradient(135deg, \${moodColor}40, \${moodColor}20)\`;
                moodIndicator.style.background = \`\${moodColor}60\`;
                moodIndicator.style.borderColor = \`\${moodColor}80\`;
                waveAnimation.style.color = moodColor;
            }
            
            // Apply mood-based animations
            if (mood.pulseSpeed) {
                if (mood.pulseSpeed < 1.5) {
                    moodOverlay.classList.add('pulse-fast');
                    songDisplay.classList.add('mood-energetic');
                } else if (mood.pulseSpeed > 2.5) {
                    moodOverlay.classList.add('pulse-slow');
                    songDisplay.classList.add('mood-calm');
                } else {
                    moodOverlay.classList.add('pulse-normal');
                }
            }
            
            // Apply mood intensity effects
            if (mood.intensity === 'high') {
                waveAnimation.style.display = 'block';
                songDisplay.classList.add('mood-energetic');
            } else if (mood.intensity === 'low') {
                songDisplay.classList.add('mood-calm');
            } else if (mood.intensity === 'dark') {
                songDisplay.classList.add('mood-dark');
            }
        }

        function handleSongChange() {
            if (SETTINGS.alwaysShow) {
                showDisplay();
                return;
            }

            // Clear any existing timeout
            if (displayTimeout) {
                clearTimeout(displayTimeout);
            }

            // Show immediately
            showDisplay();

            // Auto-hide after duration
            displayTimeout = setTimeout(() => {
                hideDisplay();
            }, SETTINGS.displayDuration);
        }

        function showDisplay() {
            const display = document.getElementById('songDisplay');
            display.classList.add('visible');
            isVisible = true;
        }

        function hideDisplay() {
            if (SETTINGS.alwaysShow) return;
            
            const display = document.getElementById('songDisplay');
            display.classList.remove('visible');
            isVisible = false;
        }

        // Initialize
        if (SETTINGS.alwaysShow) {
            showDisplay();
        }
        
        loadFromStorage();
        
        // Listen for storage changes
        window.addEventListener('storage', function(e) {
            if (e.key === 'obs-song-display') {
                loadFromStorage();
            }
        });
        
        // Check for updates every second
        setInterval(loadFromStorage, 1000);
        
        // Also check on focus/visibility changes
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden) {
                loadFromStorage();
            }
        });
        
        console.log('🎵 Mood Music Animated OBS Display loaded with settings:', SETTINGS);
    </script>
</body>
</html>`;
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