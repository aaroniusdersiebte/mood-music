// Global State Service - Zentrale Verwaltung aller Services und States
class GlobalStateService {
  constructor() {
    this.states = {
      obs: {
        connected: false,
        sources: [],
        audioLevels: {},
        realTimeAudioLevels: new Map() // For real-time audio visualization
      },
      midi: {
        connected: false,
        devices: { inputs: [], outputs: [] },
        lastActivity: null,
        learning: false,
        learningTarget: null
      },
      mappings: {
        midi: new Map(), // Zentrale MIDI Mappings
        audio: {} // Audio Mixer spezifische Zuweisungen
      }
    };
    
    this.callbacks = new Map();
    this.services = {
      obs: null,
      midi: null
    };
    this.hiddenSources = new Set(); // Für Performance-Optimierung
    
    console.log('GlobalStateService: Initialized');
  }

  // Service Registration
  registerService(name, service) {
    this.services[name] = service;
    console.log(`GlobalStateService: Registered service: ${name}`);
    
    // Special handling for MIDI service registration
    if (name === 'midi' && service) {
      this.syncMIDIMappingsToService();
    }
  }

  // Sync MIDI mappings to the MIDI service
  syncMIDIMappingsToService() {
    if (!this.services.midi) return;
    
    console.log('GlobalStateService: Syncing MIDI mappings to service');
    
    // Apply all current mappings to the MIDI service
    this.states.mappings.midi.forEach((mapping, key) => {
      try {
        // Remove the 'source' property before passing to MIDI service
        const { source, ...cleanMapping } = mapping;
        this.services.midi.setMapping(key, cleanMapping);
        console.log(`GlobalStateService: Synced mapping ${key} to MIDI service`);
      } catch (error) {
        console.error(`GlobalStateService: Failed to sync mapping ${key}:`, error);
      }
    });
  }

  // State Updates
  updateOBSState(updates) {
    this.states.obs = { ...this.states.obs, ...updates };
    //console.log('GlobalStateService: OBS state updated:', updates);
    this.triggerCallbacks('obsStateChanged', this.states.obs);
  }

  // Audio Level Updates (Real-time) - GEFIXT für bessere Visualisierung
  updateAudioLevels(inputName, levels) {
    // Store in both new Map and old object for compatibility
    this.states.obs.realTimeAudioLevels.set(inputName, levels);
    this.states.obs.audioLevels[inputName] = levels;
    
    // Debug-Log für erste 5 Updates pro Source
    if (!this.audioDebugCounters) this.audioDebugCounters = {};
    if (!this.audioDebugCounters[inputName]) this.audioDebugCounters[inputName] = 0;
    if (this.audioDebugCounters[inputName] < 5) {
      console.log(`🎵 GlobalStateService: Audio levels for ${inputName}:`, levels);
      this.audioDebugCounters[inputName]++;
    }
    
    // Get all current levels for the callback
    const allLevels = this.getAllAudioLevels();
    
    // WICHTIG: Trigger OBS state update für AudioMixer
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
      
      console.log(`GlobalStateService: Volume synchronized for ${sourceName}: ${volumeDb}dB`);
      
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
    console.log('GlobalStateService: MIDI state updated:', updates);
    this.triggerCallbacks('midiStateChanged', this.states.midi);
  }

  updateMappings(type, mappings) {
    this.states.mappings[type] = mappings;
    console.log(`GlobalStateService: ${type} mappings updated:`, mappings);
    this.triggerCallbacks('mappingsChanged', { type, mappings });
    this.saveMappings();
  }

  // MIDI Mapping Management (Central)
  setMIDIMapping(key, mapping, source = 'global') {
    const stringKey = key.toString();
    this.states.mappings.midi.set(stringKey, { ...mapping, source });
    
    console.log(`GlobalStateService: MIDI mapping set: ${stringKey}`, mapping, `(source: ${source})`);
    
    // Only update the MIDI service if this didn't come from the MIDI service
    if (this.services.midi && source !== 'MIDIService') {
      try {
        // Remove the 'source' property before passing to MIDI service
        const { source: _, ...cleanMapping } = { ...mapping, source };
        this.services.midi.setMapping(stringKey, cleanMapping);
        console.log(`GlobalStateService: Synced new mapping ${stringKey} to MIDI service`);
      } catch (error) {
        console.error(`GlobalStateService: Failed to sync mapping ${stringKey} to MIDI service:`, error);
      }
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
    
    console.log(`GlobalStateService: Audio source mapping: ${sourceName} ${type} -> ${midiKey}`);
    
    this.triggerCallbacks('audioMappingChanged', { sourceName, type, midiKey });
    this.saveMappings();
  }

  getAudioSourceMappings() {
    return this.states.mappings.audio;
  }

  // MIDI Learning Management (Central)
  startMIDILearning(target, callback) {
    console.log(`GlobalStateService: Starting MIDI learning for: ${target}`);
    
    this.updateMIDIState({
      learning: true,
      learningTarget: target
    });

    if (this.services.midi) {
      return this.services.midi.startLearning((message) => {
        console.log('GlobalStateService: MIDI learning completed:', message);
        
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
    console.log('GlobalStateService: Stopping MIDI learning');
    
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
    console.log(`GlobalStateService: Setting volume for ${sourceName} to ${volumeDb}dB (from: ${source})`);
    
    if (!this.states.obs.connected) {
      console.error('GlobalStateService: OBS not connected, cannot set volume');
      return false;
    }

    // Try to find exact source name in available sources
    let targetSourceName = sourceName;
    const availableSources = this.states.obs.sources;
    
    // If source name is not exact, try to find it
    const exactSource = availableSources.find(source => 
      source.name === sourceName || 
      source.name.toLowerCase().includes(sourceName.toLowerCase()) ||
      sourceName.toLowerCase().includes(source.name.toLowerCase())
    );
    
    if (exactSource) {
      targetSourceName = exactSource.name;
      console.log(`GlobalStateService: Found exact source: ${targetSourceName}`);
    } else {
      // Try OBS source mapping
      if (this.services.obs && this.services.obs.mapApplicationToSource) {
        const mappedName = this.services.obs.mapApplicationToSource(sourceName);
        const mappedSource = availableSources.find(source => source.name === mappedName);
        if (mappedSource) {
          targetSourceName = mappedSource.name;
          console.log(`GlobalStateService: Mapped to source: ${targetSourceName}`);
        }
      }
    }

    if (this.services.obs) {
      const success = await this.services.obs.setVolume(targetSourceName, volumeDb);
      if (success) {
        console.log(`GlobalStateService: Volume set successfully: ${targetSourceName} = ${volumeDb}dB`);
      } else {
        console.error(`GlobalStateService: Failed to set volume: ${targetSourceName}`);
      }
      return success;
    }
    
    return false;
  }

  // Mute Control (Central)
  async toggleMute(sourceName, source = 'unknown') {
    console.log(`GlobalStateService: Toggling mute for ${sourceName} (from: ${source})`);
    
    if (!this.states.obs.connected) {
      console.error('GlobalStateService: OBS not connected, cannot toggle mute');
      return false;
    }

    // Try to find exact source name in available sources
    let targetSourceName = sourceName;
    const availableSources = this.states.obs.sources;
    
    // If source name is not exact, try to find it
    const exactSource = availableSources.find(source => 
      source.name === sourceName || 
      source.name.toLowerCase().includes(sourceName.toLowerCase()) ||
      sourceName.toLowerCase().includes(source.name.toLowerCase())
    );
    
    if (exactSource) {
      targetSourceName = exactSource.name;
      console.log(`GlobalStateService: Found exact source for mute: ${targetSourceName}`);
    } else {
      // Try OBS source mapping
      if (this.services.obs && this.services.obs.mapApplicationToSource) {
        const mappedName = this.services.obs.mapApplicationToSource(sourceName);
        const mappedSource = availableSources.find(source => source.name === mappedName);
        if (mappedSource) {
          targetSourceName = mappedSource.name;
          console.log(`GlobalStateService: Mapped to source for mute: ${targetSourceName}`);
        }
      }
    }

    if (this.services.obs) {
      return await this.services.obs.toggleMute(targetSourceName);
    }
    
    return false;
  }

  // Persistence
  saveMappings() {
    try {
      const data = {
        midi: {},
        audio: this.states.mappings.audio
      };
      
      // Convert Map to Object for saving
      this.states.mappings.midi.forEach((value, key) => {
        data.midi[key] = value;
      });
      
      localStorage.setItem('globalMappings', JSON.stringify(data));
      console.log('GlobalStateService: Mappings saved to localStorage');
    } catch (error) {
      console.error('GlobalStateService: Failed to save mappings:', error);
    }
  }

  loadMappings() {
    try {
      const stored = localStorage.getItem('globalMappings');
      if (stored) {
        const data = JSON.parse(stored);
        console.log('GlobalStateService: Loading mappings from localStorage:', data);
        
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
        
        console.log('GlobalStateService: Mappings loaded successfully');
        return true;
      }
    } catch (error) {
      console.error('GlobalStateService: Failed to load mappings:', error);
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

  isOBSConnected() {
    return this.states.obs.connected;
  }

  isMIDIConnected() {
    return this.states.midi.connected;
  }

  getAudioSources() {
    return this.states.obs.sources;
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

  // 🚀 Source Visibility Management (für Performance)
  setSourceHidden(sourceName, hidden = true) {
    if (hidden) {
      this.hiddenSources.add(sourceName);
    } else {
      this.hiddenSources.delete(sourceName);
    }
    console.log(`GlobalStateService: Source ${sourceName} ${hidden ? 'hidden' : 'shown'} - Performance optimized`);
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
    console.log(`GlobalStateService: Callback registered for: ${event}`);
  }

  off(event, callback) {
    const callbacks = this.callbacks.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
      console.log(`GlobalStateService: Callback removed for: ${event}`);
    }
  }

  triggerCallbacks(event, data = null) {
    const callbacks = this.callbacks.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`GlobalStateService: Callback error (${event}):`, error);
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
        realTimeAudioLevels: new Map()
      },
      midi: { connected: false, devices: { inputs: [], outputs: [] }, lastActivity: null },
      mappings: { midi: new Map(), audio: {} }
    };
    console.log('GlobalStateService: Destroyed');
  }
}

export default new GlobalStateService();
