// Enhanced Global State Service - Optimized for Dashboard Integration
class EnhancedGlobalStateService {
  constructor() {
    this.states = {
      obs: {
        connected: false,
        sources: [],
        audioLevels: {},
        realTimeAudioLevels: new Map(),
        scenes: [],
        lastSourceDiscovery: 0,
        lastSceneDiscovery: 0
      },
      midi: {
        connected: false,
        devices: { inputs: [], outputs: [] },
        lastActivity: null,
        learning: false,
        learningTarget: null
      },
      mappings: {
        midi: new Map(),
        audio: {},
        hotkeys: new Map() // Dashboard-spezifische Hotkeys
      },
      dashboard: {
        widgets: new Map(),
        activeContextMenu: null,
        editMode: false
      }
    };
    
    this.callbacks = new Map();
    this.services = {};
    this.hiddenSources = new Set();
    this.cacheTTL = 30000; // 30 Sekunden Cache für OBS-Daten
    this.audioLevelThrottle = new Map(); // Performance-Optimierung für Audio-Levels
    
    console.log('Enhanced GlobalStateService: Initialized with dashboard support');
  }

  // ===== SERVICE REGISTRATION =====
  registerService(name, service) {
    this.services[name] = service;
    console.log(`Enhanced GlobalStateService: Registered service: ${name}`);
    
    if (name === 'midi' && service) {
      this.syncMIDIMappingsToService();
    }
    
    if (name === 'obs' && service) {
      this.setupOBSIntegration(service);
    }
  }

  setupOBSIntegration(obsService) {
    // Verbesserte OBS-Integration mit Caching
    obsService.onConnected(() => {
      console.log('Enhanced GlobalStateService: OBS connected, starting discovery...');
      this.discoverOBSDataWithCaching();
    });

    obsService.onSourcesDiscovered((sources) => {
      console.log('Enhanced GlobalStateService: OBS sources discovered:', sources.length);
      this.updateOBSState({ 
        sources: sources, 
        lastSourceDiscovery: Date.now() 
      });
      this.triggerCallbacks('sourcesDiscovered', sources);
    });

    obsService.onAudioLevels((data) => {
      this.handleThrottledAudioLevels(data);
    });
  }

  async discoverOBSDataWithCaching() {
    const now = Date.now();
    const cacheValid = (now - this.states.obs.lastSourceDiscovery) < this.cacheTTL;
    
    if (cacheValid && this.states.obs.sources.length > 0) {
      console.log('Enhanced GlobalStateService: Using cached OBS data');
      return;
    }

    try {
      if (this.services.obs && this.services.obs.isConnected()) {
        console.log('Enhanced GlobalStateService: Discovering fresh OBS data...');
        
        // 🔧 VERBESSERT: Sequentielle Ausführung statt parallel für bessere Stabilität
        try {
          await this.services.obs.discoverAudioSources();
          console.log('Enhanced GlobalStateService: Audio sources updated');
        } catch (sourcesError) {
          if (!sourcesError.message?.includes('Socket not identified')) {
            console.error('Enhanced GlobalStateService: Audio sources discovery failed:', sourcesError);
          } else {
            console.log('Enhanced GlobalStateService: Audio sources discovery delayed (socket not ready)');
          }
        }
        
        // Warte kurz zwischen den Operationen
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          await this.discoverOBSScenes();
          console.log('Enhanced GlobalStateService: Scenes updated');
        } catch (scenesError) {
          if (!scenesError.message?.includes('Socket not identified')) {
            console.error('Enhanced GlobalStateService: Scenes discovery failed:', scenesError);
          } else {
            console.log('Enhanced GlobalStateService: Scenes discovery delayed (socket not ready)');
          }
        }
        
      } else {
        console.log('Enhanced GlobalStateService: OBS not connected, skipping discovery');
      }
    } catch (error) {
      console.error('Enhanced GlobalStateService: Failed to discover OBS data:', error);
    }
  }

  async discoverOBSScenes() {
    try {
      if (this.services.obs && this.services.obs.obs && this.services.obs.connected) {
        // Extra safety check: Wait for proper connection
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const scenesResponse = await this.services.obs.obs.call('GetSceneList');
        const scenes = scenesResponse.scenes || [];
        
        this.updateOBSState({ 
          scenes: scenes, 
          lastSceneDiscovery: Date.now() 
        });
        
        console.log('Enhanced GlobalStateService: Discovered', scenes.length, 'OBS scenes');
        this.triggerCallbacks('scenesDiscovered', scenes);
        
        return scenes;
      } else {
        console.log('Enhanced GlobalStateService: OBS not ready for scene discovery');
        return [];
      }
    } catch (error) {
      // Only log error if it's not the typical "Socket not identified" error
      if (!error.message?.includes('Socket not identified')) {
        console.error('Enhanced GlobalStateService: Failed to discover scenes:', error);
      } else {
        console.log('Enhanced GlobalStateService: OBS socket not yet identified, skipping scene discovery');
      }
      return [];
    }
  }

  // ===== AUDIO LEVEL HANDLING WITH PERFORMANCE OPTIMIZATION =====
  handleThrottledAudioLevels(data) {
    const { sourceName, levels } = data;
    const now = Date.now();
    
    // Throttle audio level updates für bessere Performance
    const lastUpdate = this.audioLevelThrottle.get(sourceName) || 0;
    if (now - lastUpdate < 50) { // Max 20 FPS für Audio-Levels
      return;
    }
    
    this.audioLevelThrottle.set(sourceName, now);
    this.updateAudioLevels(sourceName, levels);
  }

  updateAudioLevels(inputName, levels) {
    // Optimierte Audio-Level-Updates
    this.states.obs.realTimeAudioLevels.set(inputName, levels);
    this.states.obs.audioLevels[inputName] = levels;
    
    // Performance-optimierte Callbacks
    const allLevels = this.getAllAudioLevels();
    
    this.states.obs = { 
      ...this.states.obs, 
      audioLevels: this.states.obs.audioLevels,
      realTimeAudioLevels: this.states.obs.realTimeAudioLevels
    };

    // Batch-Update für bessere Performance
    this.triggerCallbacks('obsStateChanged', this.states.obs);
    this.triggerCallbacks('audioLevelsUpdated', {
      sourceName: inputName,
      levels: levels,
      allLevels: allLevels
    });
  }

  // ===== DASHBOARD-SPECIFIC METHODS =====
  
  // Widget Registration für bessere Kontrolle
  registerDashboardWidget(widgetId, widgetType, config = {}) {
    this.states.dashboard.widgets.set(widgetId, {
      id: widgetId,
      type: widgetType,
      config: config,
      registered: Date.now()
    });
    
    console.log(`Enhanced GlobalStateService: Registered dashboard widget: ${widgetId} (${widgetType})`);
    this.triggerCallbacks('widgetRegistered', { widgetId, widgetType, config });
  }

  unregisterDashboardWidget(widgetId) {
    this.states.dashboard.widgets.delete(widgetId);
    console.log(`Enhanced GlobalStateService: Unregistered dashboard widget: ${widgetId}`);
    this.triggerCallbacks('widgetUnregistered', { widgetId });
  }

  // Context Menu Management für Dashboard
  setActiveContextMenu(menuId, menuData = null) {
    this.states.dashboard.activeContextMenu = { id: menuId, data: menuData, timestamp: Date.now() };
    this.triggerCallbacks('contextMenuChanged', this.states.dashboard.activeContextMenu);
  }

  clearActiveContextMenu() {
    this.states.dashboard.activeContextMenu = null;
    this.triggerCallbacks('contextMenuChanged', null);
  }

  getActiveContextMenu() {
    return this.states.dashboard.activeContextMenu;
  }

  // Dashboard Edit Mode
  setDashboardEditMode(enabled) {
    this.states.dashboard.editMode = enabled;
    console.log('Enhanced GlobalStateService: Dashboard edit mode:', enabled);
    this.triggerCallbacks('dashboardEditModeChanged', enabled);
  }

  isDashboardEditMode() {
    return this.states.dashboard.editMode;
  }

  // ===== HOTKEY MANAGEMENT =====
  
  setHotkeyMapping(hotkeyId, mapping) {
    this.states.mappings.hotkeys.set(hotkeyId, {
      ...mapping,
      created: Date.now()
    });
    
    console.log(`Enhanced GlobalStateService: Hotkey mapping set: ${hotkeyId}`, mapping);
    this.triggerCallbacks('hotkeyMappingChanged', { hotkeyId, mapping });
    this.saveHotkeyMappings();
  }

  removeHotkeyMapping(hotkeyId) {
    this.states.mappings.hotkeys.delete(hotkeyId);
    console.log(`Enhanced GlobalStateService: Hotkey mapping removed: ${hotkeyId}`);
    this.triggerCallbacks('hotkeyMappingRemoved', { hotkeyId });
    this.saveHotkeyMappings();
  }

  getAllHotkeyMappings() {
    const mappings = {};
    this.states.mappings.hotkeys.forEach((value, key) => {
      mappings[key] = value;
    });
    return mappings;
  }

  saveHotkeyMappings() {
    try {
      const data = this.getAllHotkeyMappings();
      localStorage.setItem('dashboardHotkeyMappings', JSON.stringify(data));
      console.log('Enhanced GlobalStateService: Hotkey mappings saved');
    } catch (error) {
      console.error('Enhanced GlobalStateService: Failed to save hotkey mappings:', error);
    }
  }

  loadHotkeyMappings() {
    try {
      const stored = localStorage.getItem('dashboardHotkeyMappings');
      if (stored) {
        const data = JSON.parse(stored);
        this.states.mappings.hotkeys.clear();
        
        Object.entries(data).forEach(([key, value]) => {
          this.states.mappings.hotkeys.set(key, value);
        });
        
        console.log('Enhanced GlobalStateService: Hotkey mappings loaded:', this.states.mappings.hotkeys.size);
        return true;
      }
    } catch (error) {
      console.error('Enhanced GlobalStateService: Failed to load hotkey mappings:', error);
    }
    return false;
  }

  // ===== AUDIO SOURCE MANAGEMENT WITH CACHING =====
  
  getAudioSources() {
    // Verbesserte Audio-Source-Bereitstellung mit Caching
    const sources = this.states.obs.sources;
    
    if (sources.length === 0 && this.services.obs && this.services.obs.isConnected()) {
      // Trigger discovery wenn keine Sources vorhanden aber OBS verbunden
      console.log('Enhanced GlobalStateService: No audio sources cached, triggering discovery...');
      this.discoverOBSDataWithCaching();
    }
    
    return sources;
  }

  getAudioSourcesForMixer() {
    // Spezielle Methode für AudioMixer Widget
    const sources = this.getAudioSources();
    
    // Filtere nur echte Audio-Sources
    const audioSources = sources.filter(source => {
      const kind = source.kind || source.inputKind || '';
      return kind.includes('audio') || 
             kind.includes('wasapi') || 
             kind.includes('pulse') ||
             kind === 'coreaudio_input_capture' ||
             kind === 'coreaudio_output_capture';
    });
    
    console.log('Enhanced GlobalStateService: Audio sources for mixer:', audioSources.length);
    return audioSources;
  }

  getOBSScenes() {
    const scenes = this.states.obs.scenes;
    
    if (scenes.length === 0 && this.services.obs && this.services.obs.isConnected()) {
      console.log('Enhanced GlobalStateService: No scenes cached, triggering discovery...');
      this.discoverOBSScenes();
    }
    
    return scenes;
  }

  // ===== VOLUME AND MUTE CONTROL =====
  
  async setVolume(sourceName, volumeDb, source = 'unknown') {
    console.log(`Enhanced GlobalStateService: Setting volume for ${sourceName} to ${volumeDb}dB (from: ${source})`);
    
    if (!this.states.obs.connected) {
      console.error('Enhanced GlobalStateService: OBS not connected, cannot set volume');
      return false;
    }

    const targetSourceName = this.findExactSourceName(sourceName);
    
    if (this.services.obs) {
      const success = await this.services.obs.setVolume(targetSourceName, volumeDb);
      if (success) {
        console.log(`Enhanced GlobalStateService: Volume set successfully: ${targetSourceName} = ${volumeDb}dB`);
        
        // Update local state immediately für bessere UX
        this.updateSourceVolume(targetSourceName, volumeDb);
      }
      return success;
    }
    
    return false;
  }

  async toggleMute(sourceName, source = 'unknown') {
    console.log(`Enhanced GlobalStateService: Toggling mute for ${sourceName} (from: ${source})`);
    
    if (!this.states.obs.connected) {
      console.error('Enhanced GlobalStateService: OBS not connected, cannot toggle mute');
      return false;
    }

    const targetSourceName = this.findExactSourceName(sourceName);
    
    if (this.services.obs) {
      const success = await this.services.obs.toggleMute(targetSourceName);
      if (success) {
        console.log(`Enhanced GlobalStateService: Mute toggled successfully: ${targetSourceName}`);
      }
      return success;
    }
    
    return false;
  }

  findExactSourceName(sourceName) {
    const availableSources = this.states.obs.sources;
    
    // Exact match first
    const exactSource = availableSources.find(source => source.name === sourceName);
    if (exactSource) {
      return exactSource.name;
    }
    
    // Partial match
    const partialSource = availableSources.find(source => 
      source.name.toLowerCase().includes(sourceName.toLowerCase()) ||
      sourceName.toLowerCase().includes(source.name.toLowerCase())
    );
    
    if (partialSource) {
      console.log(`Enhanced GlobalStateService: Found partial match: ${sourceName} -> ${partialSource.name}`);
      return partialSource.name;
    }
    
    console.warn(`Enhanced GlobalStateService: No matching source found for: ${sourceName}`);
    return sourceName; // Fallback to original name
  }

  // ===== STATE UPDATES =====
  
  updateOBSState(updates) {
    this.states.obs = { ...this.states.obs, ...updates };
    this.triggerCallbacks('obsStateChanged', this.states.obs);
  }

  updateMIDIState(updates) {
    this.states.midi = { ...this.states.midi, ...updates };
    this.triggerCallbacks('midiStateChanged', this.states.midi);
  }

  updateSourceVolume(sourceName, volumeDb) {
    const sourceIndex = this.states.obs.sources.findIndex(s => s.name === sourceName);
    if (sourceIndex !== -1) {
      this.states.obs.sources[sourceIndex].volumeDb = volumeDb;
      this.states.obs.sources[sourceIndex].volume = this.dbToMultiplier(volumeDb);
      
      this.triggerCallbacks('sourceVolumeUpdated', {
        sourceName,
        volumeDb,
        volume: this.dbToMultiplier(volumeDb)
      });
    }
  }

  // ===== MIDI INTEGRATION =====
  
  syncMIDIMappingsToService() {
    if (!this.services.midi) return;
    
    console.log('Enhanced GlobalStateService: Syncing MIDI mappings to service');
    
    this.states.mappings.midi.forEach((mapping, key) => {
      try {
        const { source, ...cleanMapping } = mapping;
        this.services.midi.setMapping(key, cleanMapping);
        console.log(`Enhanced GlobalStateService: Synced mapping ${key} to MIDI service`);
      } catch (error) {
        console.error(`Enhanced GlobalStateService: Failed to sync mapping ${key}:`, error);
      }
    });
  }

  setMIDIMapping(key, mapping, source = 'global') {
    const stringKey = key.toString();
    this.states.mappings.midi.set(stringKey, { ...mapping, source });
    
    console.log(`Enhanced GlobalStateService: MIDI mapping set: ${stringKey}`, mapping, `(source: ${source})`);
    
    if (this.services.midi && source !== 'MIDIService') {
      try {
        const { source: _, ...cleanMapping } = { ...mapping, source };
        this.services.midi.setMapping(stringKey, cleanMapping);
      } catch (error) {
        console.error(`Enhanced GlobalStateService: Failed to sync mapping ${stringKey} to MIDI service:`, error);
      }
    }
    
    this.triggerCallbacks('midiMappingChanged', { key: stringKey, mapping: { ...mapping, source }, source });
    this.saveMappings();
  }

  // ===== UTILITY METHODS =====
  
  dbToMultiplier(db) {
    if (db <= -60) return 0;
    return Math.pow(10, db / 20);
  }

  multiplierToDb(multiplier) {
    if (multiplier <= 0) return -60;
    return Math.max(-60, 20 * Math.log10(multiplier));
  }

  getAllAudioLevels() {
    const levels = {};
    this.states.obs.realTimeAudioLevels.forEach((level, sourceName) => {
      levels[sourceName] = level;
    });
    return levels;
  }

  getAudioLevel(sourceName) {
    return this.states.obs.realTimeAudioLevels.get(sourceName);
  }

  // ===== GETTERS =====
  
  getOBSState() {
    return this.states.obs;
  }

  getMIDIState() {
    return this.states.midi;
  }

  getDashboardState() {
    return this.states.dashboard;
  }

  isOBSConnected() {
    return this.states.obs.connected;
  }

  isMIDIConnected() {
    return this.states.midi.connected;
  }

  // ===== PERSISTENCE =====
  
  saveMappings() {
    try {
      const data = {
        midi: {},
        audio: this.states.mappings.audio,
        hotkeys: {}
      };
      
      this.states.mappings.midi.forEach((value, key) => {
        data.midi[key] = value;
      });
      
      this.states.mappings.hotkeys.forEach((value, key) => {
        data.hotkeys[key] = value;
      });
      
      localStorage.setItem('enhancedGlobalMappings', JSON.stringify(data));
      console.log('Enhanced GlobalStateService: All mappings saved to localStorage');
    } catch (error) {
      console.error('Enhanced GlobalStateService: Failed to save mappings:', error);
    }
  }

  loadMappings() {
    try {
      const stored = localStorage.getItem('enhancedGlobalMappings');
      if (stored) {
        const data = JSON.parse(stored);
        console.log('Enhanced GlobalStateService: Loading mappings from localStorage:', data);
        
        // Load MIDI mappings
        if (data.midi) {
          this.states.mappings.midi.clear();
          Object.entries(data.midi).forEach(([key, value]) => {
            this.states.mappings.midi.set(key, value);
          });
        }
        
        // Load Audio mappings
        if (data.audio) {
          this.states.mappings.audio = data.audio;
        }
        
        // Load Hotkey mappings
        if (data.hotkeys) {
          this.states.mappings.hotkeys.clear();
          Object.entries(data.hotkeys).forEach(([key, value]) => {
            this.states.mappings.hotkeys.set(key, value);
          });
        }
        
        console.log('Enhanced GlobalStateService: All mappings loaded successfully');
        return true;
      }
    } catch (error) {
      console.error('Enhanced GlobalStateService: Failed to load mappings:', error);
    }
    
    return false;
  }

  // ===== EVENT SYSTEM =====
  
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
    console.log(`Enhanced GlobalStateService: Callback registered for: ${event}`);
  }

  off(event, callback) {
    const callbacks = this.callbacks.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
      console.log(`Enhanced GlobalStateService: Callback removed for: ${event}`);
    }
  }

  triggerCallbacks(event, data = null) {
    const callbacks = this.callbacks.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Enhanced GlobalStateService: Callback error (${event}):`, error);
      }
    });
  }

  // ===== PERFORMANCE METHODS =====
  
  setSourceHidden(sourceName, hidden = true) {
    if (hidden) {
      this.hiddenSources.add(sourceName);
    } else {
      this.hiddenSources.delete(sourceName);
    }
    console.log(`Enhanced GlobalStateService: Source ${sourceName} ${hidden ? 'hidden' : 'shown'} - Performance optimized`);
  }

  isSourceHidden(sourceName) {
    return this.hiddenSources.has(sourceName);
  }

  getHiddenSources() {
    return Array.from(this.hiddenSources);
  }

  // ===== CLEANUP =====
  
  destroy() {
    this.callbacks.clear();
    this.states = {
      obs: { 
        connected: false, 
        sources: [], 
        audioLevels: {},
        realTimeAudioLevels: new Map(),
        scenes: [],
        lastSourceDiscovery: 0,
        lastSceneDiscovery: 0
      },
      midi: { connected: false, devices: { inputs: [], outputs: [] }, lastActivity: null, learning: false, learningTarget: null },
      mappings: { midi: new Map(), audio: {}, hotkeys: new Map() },
      dashboard: { widgets: new Map(), activeContextMenu: null, editMode: false }
    };
    this.audioLevelThrottle.clear();
    console.log('Enhanced GlobalStateService: Destroyed');
  }
}

export default new EnhancedGlobalStateService();
