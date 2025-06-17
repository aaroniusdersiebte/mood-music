// Unified Global State Service - Central management for all services and states
class GlobalStateService {
  constructor() {
    this.states = {
      obs: {
        connected: false,
        sources: [],
        audioLevels: {},
        realTimeAudioLevels: new Map(), // For real-time audio visualization
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
        midi: new Map(), // Central MIDI Mappings
        audio: {}, // Audio Mixer specific assignments
        hotkeys: new Map() // Dashboard-specific Hotkeys
      },
      dashboard: {
        widgets: new Map(),
        activeContextMenu: null,
        editMode: false
      }
    };
    
    this.callbacks = new Map();
    this.services = {
      obs: null,
      midi: null
    };
    this.hiddenSources = new Set(); // For performance optimization
    this.cacheTTL = 30000; // 30 seconds cache for OBS data
    this.audioLevelThrottle = new Map(); // Performance optimization for audio levels
    
    console.log('Unified GlobalStateService: Initialized with dashboard support');
  }

  // ===== SERVICE REGISTRATION =====
  registerService(name, service) {
    this.services[name] = service;
    console.log(`Unified GlobalStateService: Registered service: ${name}`);
    
    // Special handling for MIDI service registration
    if (name === 'midi' && service) {
      this.syncMIDIMappingsToService();
    }
    
    // Special handling for OBS service registration
    if (name === 'obs' && service) {
      this.setupOBSIntegration(service);
    }
  }

  setupOBSIntegration(obsService) {
    // Enhanced OBS integration with caching
    obsService.onConnected(() => {
      console.log('Unified GlobalStateService: OBS connected, starting discovery...');
      this.discoverOBSDataWithCaching();
    });

    obsService.onSourcesDiscovered((sources) => {
      console.log('Unified GlobalStateService: OBS sources discovered:', sources.length);
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
      console.log('Unified GlobalStateService: Using cached OBS data');
      return;
    }

    try {
      if (this.services.obs && this.services.obs.isConnected()) {
        console.log('Unified GlobalStateService: Discovering fresh OBS data...');
        
        // Sequential execution for better stability
        try {
          await this.services.obs.discoverAudioSources();
          console.log('Unified GlobalStateService: Audio sources updated');
        } catch (sourcesError) {
          if (!sourcesError.message?.includes('Socket not identified')) {
            console.error('Unified GlobalStateService: Audio sources discovery failed:', sourcesError);
          }
        }
        
        // Wait briefly between operations
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
          await this.discoverOBSScenes();
          console.log('Unified GlobalStateService: Scenes updated');
        } catch (scenesError) {
          if (!scenesError.message?.includes('Socket not identified')) {
            console.error('Unified GlobalStateService: Scenes discovery failed:', scenesError);
          }
        }
        
      } else {
        console.log('Unified GlobalStateService: OBS not connected, skipping discovery');
      }
    } catch (error) {
      console.error('Unified GlobalStateService: Failed to discover OBS data:', error);
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
        
        console.log('Unified GlobalStateService: Discovered', scenes.length, 'OBS scenes');
        this.triggerCallbacks('scenesDiscovered', scenes);
        
        return scenes;
      } else {
        console.log('Unified GlobalStateService: OBS not ready for scene discovery');
        return [];
      }
    } catch (error) {
      if (!error.message?.includes('Socket not identified')) {
        console.error('Unified GlobalStateService: Failed to discover scenes:', error);
      }
      return [];
    }
  }

  // ===== DASHBOARD-SPECIFIC METHODS =====
  
  // Widget Registration for better control
  registerDashboardWidget(widgetId, widgetType, config = {}) {
    this.states.dashboard.widgets.set(widgetId, {
      id: widgetId,
      type: widgetType,
      config: config,
      registered: Date.now()
    });
    
    console.log(`Unified GlobalStateService: Registered dashboard widget: ${widgetId} (${widgetType})`);
    this.triggerCallbacks('widgetRegistered', { widgetId, widgetType, config });
  }

  unregisterDashboardWidget(widgetId) {
    this.states.dashboard.widgets.delete(widgetId);
    console.log(`Unified GlobalStateService: Unregistered dashboard widget: ${widgetId}`);
    this.triggerCallbacks('widgetUnregistered', { widgetId });
  }

  // Context Menu Management for Dashboard
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
    console.log('Unified GlobalStateService: Dashboard edit mode:', enabled);
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
    
    console.log(`Unified GlobalStateService: Hotkey mapping set: ${hotkeyId}`, mapping);
    this.triggerCallbacks('hotkeyMappingChanged', { hotkeyId, mapping });
    this.saveHotkeyMappings();
  }

  removeHotkeyMapping(hotkeyId) {
    this.states.mappings.hotkeys.delete(hotkeyId);
    console.log(`Unified GlobalStateService: Hotkey mapping removed: ${hotkeyId}`);
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
      console.log('Unified GlobalStateService: Hotkey mappings saved');
    } catch (error) {
      console.error('Unified GlobalStateService: Failed to save hotkey mappings:', error);
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
        
        console.log('Unified GlobalStateService: Hotkey mappings loaded:', this.states.mappings.hotkeys.size);
        return true;
      }
    } catch (error) {
      console.error('Unified GlobalStateService: Failed to load hotkey mappings:', error);
    }
    return false;
  }

  // ===== AUDIO LEVEL HANDLING WITH PERFORMANCE OPTIMIZATION =====
  handleThrottledAudioLevels(data) {
    const { sourceName, levels } = data;
    const now = Date.now();
    
    // Throttle audio level updates for better performance
    const lastUpdate = this.audioLevelThrottle.get(sourceName) || 0;
    if (now - lastUpdate < 50) { // Max 20 FPS for audio levels
      return;
    }
    
    this.audioLevelThrottle.set(sourceName, now);
    this.updateAudioLevels(sourceName, levels);
  }

  // State Updates
  updateOBSState(updates) {
    this.states.obs = { ...this.states.obs, ...updates };
    //console.log('Unified GlobalStateService: OBS state updated:', updates);
    this.triggerCallbacks('obsStateChanged', this.states.obs);
  }

  // Audio Level Updates (Real-time) - Enhanced for better visualization
  updateAudioLevels(inputName, levels) {
    // Store in both new Map and old object for compatibility
    this.states.obs.realTimeAudioLevels.set(inputName, levels);
    this.states.obs.audioLevels[inputName] = levels;
    
    // Debug log for first 5 updates per source
    if (!this.audioDebugCounters) this.audioDebugCounters = {};
    if (!this.audioDebugCounters[inputName]) this.audioDebugCounters[inputName] = 0;
    if (this.audioDebugCounters[inputName] < 5) {
      console.log(`🎵 Unified GlobalStateService: Audio levels for ${inputName}:`, levels);
      this.audioDebugCounters[inputName]++;
    }
    
    // Get all current levels for the callback
    const allLevels = this.getAllAudioLevels();
    
    // IMPORTANT: Trigger OBS state update for AudioMixer
    this.states.obs = { 
      ...this.states.obs, 
      audioLevels: this.states.obs.audioLevels,
      realTimeAudioLevels: this.states.obs.realTimeAudioLevels
    };
    this.triggerCallbacks('obsStateChanged', this.states.obs);
    
    // Trigger real-time callback for audio visualization
    this.triggerCallbacks('audioLevelsUpdated', {
      sourceName: inputName,
      levels: levels,
      allLevels: allLevels
    });
  }

  // Volume Synchronization (from OBS events)
  updateSourceVolume(sourceName, volumeDb) {
    // Find and update the source in our state
    const sourceIndex = this.states.obs.sources.findIndex(s => s.name === sourceName);
    if (sourceIndex !== -1) {
      this.states.obs.sources[sourceIndex].volumeDb = volumeDb;
      this.states.obs.sources[sourceIndex].volume = this.dbToMultiplier(volumeDb);
      
      console.log(`Unified GlobalStateService: Volume synchronized for ${sourceName}: ${volumeDb}dB`);
      
      // Trigger callback for UI synchronization
      this.triggerCallbacks('sourceVolumeUpdated', {
        sourceName,
        volumeDb,
        volume: this.dbToMultiplier(volumeDb)
      });
    }
  }

  // Helper function: dB to Multiplier conversion
  dbToMultiplier(db) {
    if (db <= -60) return 0;
    return Math.pow(10, db / 20);
  }

  // Helper function: Multiplier to dB conversion
  multiplierToDb(multiplier) {
    if (multiplier <= 0) return -60;
    return Math.max(-60, 20 * Math.log10(multiplier));
  }

  updateMIDIState(updates) {
    this.states.midi = { ...this.states.midi, ...updates };
    console.log('Unified GlobalStateService: MIDI state updated:', updates);
    this.triggerCallbacks('midiStateChanged', this.states.midi);
  }

  updateMappings(type, mappings) {
    this.states.mappings[type] = mappings;
    console.log(`Unified GlobalStateService: ${type} mappings updated:`, mappings);
    this.triggerCallbacks('mappingsChanged', { type, mappings });
    this.saveMappings();
  }

  // MIDI Mapping Management (Central)
  setMIDIMapping(key, mapping, source = 'global') {
    const stringKey = key.toString();
    this.states.mappings.midi.set(stringKey, { ...mapping, source });
    
    console.log(`🎹 Unified GlobalStateService: MIDI mapping set: ${stringKey}`, mapping, `(source: ${source})`);
    
    // 🔥 CRITICAL: Always sync to MIDI service, regardless of source
    if (this.services.midi) {
      try {
        // Remove the 'source' property before passing to MIDI service
        const { source: _, ...cleanMapping } = { ...mapping, source };
        this.services.midi.setMapping(stringKey, cleanMapping);
        console.log(`✅ Unified GlobalStateService: Synced mapping ${stringKey} to MIDI service successfully`);
        
        // 💾 Save mappings to storage immediately
        this.services.midi.saveMappingsToStorage();
        console.log(`💾 Unified GlobalStateService: MIDI mappings saved to storage`);
        
      } catch (error) {
        console.error(`❌ Unified GlobalStateService: Failed to sync mapping ${stringKey} to MIDI service:`, error);
      }
    } else {
      console.warn(`⚠️ Unified GlobalStateService: MIDI service not available, mapping saved to global state only`);
    }
    
    this.triggerCallbacks('midiMappingChanged', { key: stringKey, mapping: { ...mapping, source }, source });
    this.saveMappings();
  }

  removeMIDIMapping(key) {
    const stringKey = key.toString();
    this.states.mappings.midi.delete(stringKey);
    
    if (this.services.midi) {
      this.services.midi.removeMapping(stringKey);
    }
    
    this.triggerCallbacks('midiMappingRemoved', { key: stringKey });
    this.saveMappings();
  }

  getAllMIDIMappings() {
    const mappings = {};
    this.states.mappings.midi.forEach((value, key) => {
      mappings[key] = value;
    });
    return mappings;
  }

  // Audio Source Management
  setAudioSourceMapping(sourceName, type, midiKey) {
    if (!this.states.mappings.audio[sourceName]) {
      this.states.mappings.audio[sourceName] = {};
    }
    
    this.states.mappings.audio[sourceName][type] = midiKey;
    
    console.log(`Unified GlobalStateService: Audio source mapping: ${sourceName} ${type} -> ${midiKey}`);
    
    this.triggerCallbacks('audioMappingChanged', { sourceName, type, midiKey });
    this.saveMappings();
  }

  getAudioSourceMappings() {
    return this.states.mappings.audio;
  }

  // ===== AUDIO SOURCE MANAGEMENT WITH CACHING =====
  
  getAudioSources() {
    // Enhanced audio source provision with caching
    const sources = this.states.obs.sources;
    
    if (sources.length === 0 && this.services.obs && this.services.obs.isConnected()) {
      // Trigger discovery if no sources available but OBS connected
      console.log('Unified GlobalStateService: No audio sources cached, triggering discovery...');
      this.discoverOBSDataWithCaching();
    }
    
    return sources;
  }

  getAudioSourcesForMixer() {
    // Special method for AudioMixer Widget
    const sources = this.getAudioSources();
    
    // Filter only real audio sources
    const audioSources = sources.filter(source => {
      const kind = source.kind || source.inputKind || '';
      return kind.includes('audio') || 
             kind.includes('wasapi') || 
             kind.includes('pulse') ||
             kind === 'coreaudio_input_capture' ||
             kind === 'coreaudio_output_capture';
    });
    
    console.log('Unified GlobalStateService: Audio sources for mixer:', audioSources.length);
    return audioSources;
  }

  getOBSScenes() {
    const scenes = this.states.obs.scenes;
    
    if (scenes.length === 0 && this.services.obs && this.services.obs.isConnected()) {
      console.log('Unified GlobalStateService: No scenes cached, triggering discovery...');
      this.discoverOBSScenes();
    }
    
    return scenes;
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
      console.log(`Unified GlobalStateService: Found partial match: ${sourceName} -> ${partialSource.name}`);
      return partialSource.name;
    }
    
    console.warn(`Unified GlobalStateService: No matching source found for: ${sourceName}`);
    return sourceName; // Fallback to original name
  }

  // MIDI Learning Management (Central)
  startMIDILearning(target, callback) {
    console.log(`Unified GlobalStateService: Starting MIDI learning for: ${target}`);
    
    this.updateMIDIState({
      learning: true,
      learningTarget: target
    });

    if (this.services.midi) {
      return this.services.midi.startLearning((message) => {
        console.log('Unified GlobalStateService: MIDI learning completed:', message);
        
        this.updateMIDIState({
          learning: false,
          learningTarget: null
        });
        
        if (callback) {
          callback(message);
        }
        
        this.triggerCallbacks('midiLearningCompleted', { target, message });
      });
    }
    
    return false;
  }

  stopMIDILearning() {
    console.log('Unified GlobalStateService: Stopping MIDI learning');
    
    this.updateMIDIState({
      learning: false,
      learningTarget: null
    });

    if (this.services.midi) {
      this.services.midi.stopLearning();
    }
    
    this.triggerCallbacks('midiLearningStopped');
  }

  // Volume Control (Central)
  async setVolume(sourceName, volumeDb, source = 'unknown') {
    console.log(`Unified GlobalStateService: Setting volume for ${sourceName} to ${volumeDb}dB (from: ${source})`);
    
    if (!this.states.obs.connected) {
      console.error('Unified GlobalStateService: OBS not connected, cannot set volume');
      return false;
    }

    const targetSourceName = this.findExactSourceName(sourceName);

    if (this.services.obs) {
      const success = await this.services.obs.setVolume(targetSourceName, volumeDb);
      if (success) {
        console.log(`Unified GlobalStateService: Volume set successfully: ${targetSourceName} = ${volumeDb}dB`);
        // Update local state immediately for better UX
        this.updateSourceVolume(targetSourceName, volumeDb);
      } else {
        console.error(`Unified GlobalStateService: Failed to set volume: ${targetSourceName}`);
      }
      return success;
    }
    
    return false;
  }

  // Mute Control (Central)
  async toggleMute(sourceName, source = 'unknown') {
    console.log(`Unified GlobalStateService: Toggling mute for ${sourceName} (from: ${source})`);
    
    if (!this.states.obs.connected) {
      console.error('Unified GlobalStateService: OBS not connected, cannot toggle mute');
      return false;
    }

    const targetSourceName = this.findExactSourceName(sourceName);

    if (this.services.obs) {
      const success = await this.services.obs.toggleMute(targetSourceName);
      if (success) {
        console.log(`Unified GlobalStateService: Mute toggled successfully: ${targetSourceName}`);
      }
      return success;
    }
    
    return false;
  }

  // Sync MIDI mappings to the MIDI service
  syncMIDIMappingsToService() {
    if (!this.services.midi) return;
    
    console.log('Unified GlobalStateService: Syncing MIDI mappings to service');
    
    // Apply all current mappings to the MIDI service
    this.states.mappings.midi.forEach((mapping, key) => {
      try {
        // Remove the 'source' property before passing to MIDI service
        const { source, ...cleanMapping } = mapping;
        this.services.midi.setMapping(key, cleanMapping);
        console.log(`Unified GlobalStateService: Synced mapping ${key} to MIDI service`);
      } catch (error) {
        console.error(`Unified GlobalStateService: Failed to sync mapping ${key}:`, error);
      }
    });
  }

  // Persistence
  saveMappings() {
    try {
      const data = {
        midi: {},
        audio: this.states.mappings.audio,
        hotkeys: {}
      };
      
      // Convert Map to Object for saving
      this.states.mappings.midi.forEach((value, key) => {
        data.midi[key] = value;
      });
      
      this.states.mappings.hotkeys.forEach((value, key) => {
        data.hotkeys[key] = value;
      });
      
      localStorage.setItem('unifiedGlobalMappings', JSON.stringify(data));
      console.log('Unified GlobalStateService: All mappings saved to localStorage');
    } catch (error) {
      console.error('Unified GlobalStateService: Failed to save mappings:', error);
    }
  }

  loadMappings() {
    try {
      const stored = localStorage.getItem('unifiedGlobalMappings');
      if (stored) {
        const data = JSON.parse(stored);
        console.log('Unified GlobalStateService: Loading mappings from localStorage:', data);
        
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
        
        console.log('Unified GlobalStateService: All mappings loaded successfully');
        return true;
      }
    } catch (error) {
      console.error('Unified GlobalStateService: Failed to load mappings:', error);
    }
    
    return false;
  }

  // Getters
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

  getAudioLevels() {
    return this.states.obs.audioLevels;
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

  // 🚀 Source Visibility Management (for performance)
  setSourceHidden(sourceName, hidden = true) {
    if (hidden) {
      this.hiddenSources.add(sourceName);
    } else {
      this.hiddenSources.delete(sourceName);
    }
    console.log(`Unified GlobalStateService: Source ${sourceName} ${hidden ? 'hidden' : 'shown'} - Performance optimized`);
  }

  isSourceHidden(sourceName) {
    return this.hiddenSources.has(sourceName);
  }

  getHiddenSources() {
    return Array.from(this.hiddenSources);
  }

  // Event System
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
    console.log(`Unified GlobalStateService: Callback registered for: ${event}`);
  }

  off(event, callback) {
    const callbacks = this.callbacks.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
      console.log(`Unified GlobalStateService: Callback removed for: ${event}`);
    }
  }

  triggerCallbacks(event, data = null) {
    const callbacks = this.callbacks.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Unified GlobalStateService: Callback error (${event}):`, error);
      }
    });
  }

  // Cleanup
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
    console.log('Unified GlobalStateService: Destroyed');
  }
}

export default new GlobalStateService();