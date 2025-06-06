// Browser-Safe MIDI Service - VOLLSTÄNDIG REPARIERT
class MIDIServiceSafe {
  constructor() {
    this.midiAccess = null;
    this.activeInput = null;
    this.activeOutput = null;
    this.midiMappings = new Map();
    this.callbacks = new Map();
    this.lastValues = new Map();
    this.learning = false;
    this.learningCallback = null;
    
    // Umgebungs-Detection
    this.isElectron = typeof window !== 'undefined' && 
                     window.process && 
                     window.process.type === 'renderer';
    
    this.isBrowser = typeof window !== 'undefined' && !this.isElectron;
    
    // Default MIDI Mappings - all keys as strings for consistency
    this.defaultMappings = {
      '1': { type: 'volume', target: 'master', min: 0, max: 127 },
      '2': { type: 'volume', target: 'desktop', min: 0, max: 127 },
      '3': { type: 'volume', target: 'mic', min: 0, max: 127 },
      '4': { type: 'volume', target: 'discord', min: 0, max: 127 },
      '5': { type: 'volume', target: 'browser', min: 0, max: 127 },
      '6': { type: 'volume', target: 'game', min: 0, max: 127 },
      '7': { type: 'volume', target: 'music', min: 0, max: 127 },
      '8': { type: 'volume', target: 'alert', min: 0, max: 127 },
      
      '16': { type: 'hotkey', action: 'moodSwap', target: 'chill' },
      '17': { type: 'hotkey', action: 'moodSwap', target: 'action' },
      '18': { type: 'hotkey', action: 'playPause' },
      '19': { type: 'hotkey', action: 'nextSong' },
      '20': { type: 'hotkey', action: 'prevSong' },
      '21': { type: 'hotkey', action: 'shuffle' },
      '22': { type: 'hotkey', action: 'mute', target: 'master' },
      '23': { type: 'hotkey', action: 'soundEffect', target: 'applause' }
    };

    // Bind methods to maintain 'this' context
    this.handleMIDIMessage = this.handleMIDIMessage.bind(this);
    this.onMIDIStateChange = this.onMIDIStateChange.bind(this);
  }

  async initialize() {
    try {
      if (this.isElectron) {
        // Electron: Verwende IPC statt require()
        return this.initializeElectronMIDI();
      } else if (this.isBrowser) {
        // Browser: Nur Web MIDI API
        return this.initializeWebMIDI();
      } else {
        // Fallback
        return this.initializeMockMIDI();
      }
    } catch (error) {
      console.error('MIDI initialization failed:', error);
      return this.initializeMockMIDI();
    }
  }

  async initializeElectronMIDI() {
    try {
      // Verwende Electron IPC statt direkte require() calls
      if (window.electronAPI && window.electronAPI.midi) {
        // Electron Main Process MIDI
        const devices = await window.electronAPI.midi.getDevices();
        console.log('Electron MIDI devices:', devices);
        
        // Setup IPC listeners
        window.electronAPI.midi.onMessage(this.handleMIDIMessage);
        
        // Lade gespeicherte Mappings
        this.loadMappingsFromStorage();
        
        return devices;
      } else {
        // Fallback zu Web MIDI API auch in Electron
        console.log('Electron MIDI nicht verfügbar, verwende Web MIDI API');
        return this.initializeWebMIDI();
      }
    } catch (error) {
      console.error('Electron MIDI error:', error);
      return this.initializeWebMIDI();
    }
  }

  async initializeWebMIDI() {
    if (!navigator.requestMIDIAccess) {
      console.log('Web MIDI API nicht unterstützt, verwende Mock');
      return this.initializeMockMIDI();
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      console.log('Web MIDI Access gewährt');
      
      // Korrekte Event-Handler-Bindung
      this.midiAccess.onstatechange = this.onMIDIStateChange;

      // Lade gespeicherte Mappings
      this.loadMappingsFromStorage();

      return this.setupMIDIDevices();
    } catch (error) {
      console.error('Web MIDI Fehler:', error);
      return this.initializeMockMIDI();
    }
  }

  // FEHLENDE METHODE HINZUGEFÜGT
  onMIDIStateChange(event) {
    const port = event.port;
    console.log(`MIDI device ${port.state}: ${port.name} (${port.type})`);
    
    if (port.state === 'connected' && port.type === 'input') {
      port.onmidimessage = this.handleMIDIMessage;
    }
    
    // Trigger callback für UI-Updates
    this.triggerCallback('deviceStateChange', {
      port: port,
      state: port.state,
      type: port.type
    });
  }

  setupMIDIDevices() {
    const inputs = [];
    const outputs = [];

    if (this.midiAccess) {
      this.midiAccess.inputs.forEach((input) => {
        inputs.push({
          id: input.id,
          name: input.name,
          manufacturer: input.manufacturer,
          state: input.state,
          connection: input.connection
        });
        
        // Korrekte Event-Handler-Bindung mit Fehlerbehandlung
        try {
          input.onmidimessage = this.handleMIDIMessage;
          console.log(`Bound MIDI input: ${input.name}`);
        } catch (error) {
          console.error(`Failed to bind MIDI input ${input.name}:`, error);
        }
      });

      this.midiAccess.outputs.forEach((output) => {
        outputs.push({
          id: output.id,
          name: output.name,
          manufacturer: output.manufacturer,
          state: output.state
        });
      });
    }

    console.log('MIDI Inputs:', inputs);
    console.log('MIDI Outputs:', outputs);

    return { inputs, outputs };
  }

  handleMIDIMessage(message) {
    let data, timeStamp;
    
    if (message.data) {
      data = Array.from(message.data);
      timeStamp = message.timeStamp;
    } else {
      data = message.data || message;
      timeStamp = Date.now();
    }

    if (!data || data.length < 2) {
      console.warn('Invalid MIDI message:', message);
      return;
    }

    const [status, note, velocity] = data;
    const messageType = status >> 4;
    const channel = status & 0x0F;
    
    const midiMessage = {
      type: this.getMIDIMessageType(messageType),
      channel,
      note,
      velocity: velocity || 0,
      timestamp: timeStamp,
      raw: data
    };

    console.log('MIDI Message:', midiMessage);

    // Trigger für alle MIDI-Nachrichten (für UI-Feedback)
    this.triggerCallback('midiMessage', midiMessage);

    // Learning Mode - reagiere auf ALLE Message-Types mit Values > 0
    if (this.learning) {
      console.log('MIDI Service: Learning mode active, processing message');
      
      // Accept all message types for learning, not just positive values
      if (midiMessage.type === 'controlChange' || 
          midiMessage.type === 'noteOn' || 
          midiMessage.type === 'noteOff' ||
          midiMessage.type === 'programChange') {
        
        console.log('MIDI Service: Learning triggered for:', midiMessage);
        
        // Trigger callback for all listeners
        this.triggerCallback('midiLearning', midiMessage);
        
        // Call the specific learning callback if it exists
        if (this.learningCallback) {
          try {
            this.learningCallback(midiMessage);
          } catch (error) {
            console.error('MIDI Learning callback error:', error);
          }
        }
        
        return; // Don't process as normal mapping during learning
      } else {
        console.log('MIDI Service: Ignoring message type for learning:', midiMessage.type);
        return;
      }
    }

    // Normal processing
    this.processMIDIMapping(midiMessage);
  }

  getMIDIMessageType(messageType) {
    switch (messageType) {
      case 8: return 'noteOff';
      case 9: return 'noteOn';
      case 10: return 'aftertouch';
      case 11: return 'controlChange';
      case 12: return 'programChange';
      case 13: return 'channelPressure';
      case 14: return 'pitchBend';
      default: return 'unknown';
    }
  }

  processMIDIMapping(midiMessage) {
    const { type, note, velocity } = midiMessage;
    
    let mappingKey;
    if (type === 'controlChange') {
      mappingKey = note.toString(); // Convert to string for consistency
    } else if (type === 'noteOn' && velocity > 0) {
      mappingKey = `note_${note}`;
    } else if (type === 'noteOff') {
      mappingKey = `note_${note}`;
    } else if (type === 'programChange') {
      mappingKey = `program_${note}`;
    } else {
      return;
    }

    // Look for custom mapping first, then default
    const mapping = this.midiMappings.get(mappingKey) || this.defaultMappings[mappingKey];
    if (!mapping) {
      console.log(`No mapping found for key: ${mappingKey}`);
      return;
    }

    console.log(`Executing MIDI mapping for key: ${mappingKey}`, mapping);
    this.executeMIDIMapping(mapping, velocity, midiMessage);
  }

  executeMIDIMapping(mapping, value, midiMessage) {
    switch (mapping.type) {
      case 'volume':
        this.handleVolumeControl(mapping, value);
        break;
      case 'hotkey':
        this.handleHotkeyAction(mapping, value);
        break;
    }

    const callbacks = this.callbacks.get(mapping.type) || [];
    callbacks.forEach(callback => {
      try {
        callback(mapping, value, midiMessage);
      } catch (error) {
        console.error('MIDI callback error:', error);
      }
    });
  }

  handleVolumeControl(mapping, midiValue) {
    const dbValue = this.midiToDecibel(midiValue, mapping.min, mapping.max);
    const smoothedValue = this.smoothValue(`volume_${mapping.target}`, dbValue);
    
    console.log(`Volume Control: ${mapping.target} = ${smoothedValue}dB (MIDI: ${midiValue})`);
    
    this.triggerCallback('volumeChange', {
      target: mapping.target,
      value: smoothedValue,
      midiValue,
      dbValue,
      mapping // Include mapping info for better handling
    });
  }

  handleHotkeyAction(mapping, velocity) {
    if (velocity === 0) return;
    
    console.log(`Hotkey Action: ${mapping.action}`, mapping.target);
    
    this.triggerCallback('hotkeyAction', {
      action: mapping.action,
      target: mapping.target,
      velocity
    });
  }

  midiToDecibel(midiValue, min = 0, max = 127) {
    const normalized = Math.max(0, Math.min(1, (midiValue - min) / (max - min)));
    if (normalized === 0) return -60;
    return (normalized * 60) - 60;
  }

  smoothValue(key, newValue, smoothing = 0.1) {
    const lastValue = this.lastValues.get(key) || newValue;
    const smoothedValue = lastValue + (newValue - lastValue) * smoothing;
    this.lastValues.set(key, smoothedValue);
    return Math.round(smoothedValue * 100) / 100;
  }

  startLearning(callback) {
    this.learning = true;
    this.learningCallback = callback;
    console.log('MIDI Learning gestartet - bewege ein MIDI-Control...');
    
    // Trigger callback to notify UI
    this.triggerCallback('learningStateChanged', {
      learning: true,
      message: 'MIDI Learning gestartet - bewege ein MIDI-Control...'
    });
    
    // Auto-stop learning after 30 seconds
    this.learningTimeout = setTimeout(() => {
      console.log('MIDI Learning timeout - stopping learning');
      this.stopLearning();
    }, 30000);
    
    return true; // Indicate learning started successfully
  }

  stopLearning() {
    this.learning = false;
    this.learningCallback = null;
    
    // Clear timeout if it exists
    if (this.learningTimeout) {
      clearTimeout(this.learningTimeout);
      this.learningTimeout = null;
    }
    
    console.log('MIDI Learning gestoppt');
    
    // Trigger callback to notify UI
    this.triggerCallback('learningStateChanged', {
      learning: false,
      message: 'MIDI Learning gestoppt'
    });
  }

  setMapping(key, mapping) {
    // Ensure key is always a string for consistency
    const stringKey = key.toString();
    this.midiMappings.set(stringKey, mapping);
    console.log(`MIDI mapping gesetzt: ${stringKey}`, mapping);
    
    // Persistiere Mappings in LocalStorage
    this.saveMappingsToStorage();
  }

  removeMapping(key) {
    this.midiMappings.delete(key);
    console.log(`MIDI mapping entfernt: ${key}`);
    
    // Aktualisiere LocalStorage
    this.saveMappingsToStorage();
  }

  getAllMappings() {
    const mappings = {};
    
    // If custom mappings exist, use only those
    if (this.midiMappings.size > 0) {
      this.midiMappings.forEach((value, key) => {
        mappings[key] = value;
      });
      return mappings;
    }
    
    // Otherwise return default mappings
    return { ...this.defaultMappings };
  }

  // NEUE PERSISTENZ-METHODEN
  saveMappingsToStorage() {
    try {
      const mappingsObj = {};
      this.midiMappings.forEach((value, key) => {
        mappingsObj[key] = value;
      });
      localStorage.setItem('midiMappings', JSON.stringify(mappingsObj));
      console.log('MIDI mappings gespeichert');
    } catch (error) {
      console.error('Fehler beim Speichern der MIDI-Mappings:', error);
    }
  }

  loadMappingsFromStorage() {
    try {
      const stored = localStorage.getItem('midiMappings');
      if (stored) {
        const mappingsObj = JSON.parse(stored);
        console.log('Loading MIDI mappings from storage:', mappingsObj);
        
        // Clear existing mappings first
        this.midiMappings.clear();
        
        // Load stored mappings
        Object.entries(mappingsObj).forEach(([key, value]) => {
          this.midiMappings.set(key, value);
          console.log(`Loaded mapping: ${key} ->`, value);
        });
        
        console.log('MIDI mappings geladen:', this.midiMappings.size, 'mappings');
      } else {
        console.log('No stored MIDI mappings found, using defaults');
      }
    } catch (error) {
      console.error('Fehler beim Laden der MIDI-Mappings:', error);
    }
  }

  onVolumeChange(callback) {
    this.addCallback('volumeChange', callback);
  }

  onHotkeyAction(callback) {
    this.addCallback('hotkeyAction', callback);
  }

  onDeviceStateChange(callback) {
    this.addCallback('deviceStateChange', callback);
  }

  onMIDIMessage(callback) {
    this.addCallback('midiMessage', callback);
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

  triggerCallback(type, data) {
    const callbacks = this.callbacks.get(type) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`MIDI callback error (${type}):`, error);
      }
    });
  }

  getAvailableDevices() {
    if (this.midiAccess) {
      return this.setupMIDIDevices();
    }
    
    return { inputs: [], outputs: [] };
  }

  initializeMockMIDI() {
    console.log('Mock MIDI initialisiert - Keyboard-Simulation aktiviert');
    
    // Lade gespeicherte Mappings
    this.loadMappingsFromStorage();
    
    const mockDevices = {
      inputs: [
        {
          id: 'mock-input',
          name: 'Mock MIDI Input (Keyboard Simulation)',
          manufacturer: 'Mock',
          state: 'connected'
        }
      ],
      outputs: [
        {
          id: 'mock-output',
          name: 'Mock MIDI Output',
          manufacturer: 'Mock',
          state: 'connected'
        }
      ]
    };
    
    this.setupKeyboardMIDISimulation();
    return mockDevices;
  }

  setupKeyboardMIDISimulation() {
    const keyMap = {
      'KeyQ': { type: 'cc', cc: 1, name: 'Master Volume' },
      'KeyW': { type: 'cc', cc: 2, name: 'Desktop Audio' },
      'KeyE': { type: 'cc', cc: 3, name: 'Microphone' },
      'KeyR': { type: 'cc', cc: 4, name: 'Discord' },
      'KeyT': { type: 'cc', cc: 5, name: 'Browser' },
      'KeyY': { type: 'cc', cc: 6, name: 'Game' },
      'KeyU': { type: 'cc', cc: 7, name: 'Music' },
      'KeyI': { type: 'cc', cc: 8, name: 'Alert' },
      
      'KeyA': { type: 'cc', cc: 16, name: 'Mood: Chill' },
      'KeyS': { type: 'cc', cc: 17, name: 'Mood: Action' },
      'KeyD': { type: 'cc', cc: 18, name: 'Play/Pause' },
      'KeyF': { type: 'cc', cc: 19, name: 'Next Song' },
      'KeyG': { type: 'cc', cc: 20, name: 'Previous Song' },
      'KeyH': { type: 'cc', cc: 21, name: 'Shuffle' },
      'KeyJ': { type: 'cc', cc: 22, name: 'Mute Master' },
      'KeyK': { type: 'cc', cc: 23, name: 'Sound Effect' }
    };
    
    let pressedKeys = new Set();
    
    const handleKeyEvent = (event, velocity) => {
      const mapping = keyMap[event.code];
      if (!mapping) return;
      
      if (velocity > 0 && pressedKeys.has(event.code)) return;
      
      if (velocity > 0) {
        pressedKeys.add(event.code);
      } else {
        pressedKeys.delete(event.code);
      }
      
      if (mapping.cc >= 16 && velocity === 0) return;
      
      const midiMessage = {
        type: 'controlChange',
        channel: 0,
        note: mapping.cc,
        velocity: velocity,
        timestamp: Date.now(),
        mock: true,
        keyName: mapping.name
      };
      
      console.log(`Mock MIDI (Keyboard): ${mapping.name} (CC${mapping.cc}) = ${velocity}`);
      this.handleMIDIMessage(midiMessage);
      
      event.preventDefault();
    };
    
    if (!this.isElectron) {
      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        handleKeyEvent(e, 127);
      });
      
      window.addEventListener('keyup', (e) => {
        if (e.ctrlKey || e.altKey || e.metaKey) return;
        handleKeyEvent(e, 0);
      });
      
      console.log('Keyboard MIDI simulation enabled:');
      console.log('Q-I: Volume controls (CC 1-8)');
      console.log('A-K: Hotkeys (CC 16-23)');
    }
  }

  selectInputDevice(deviceId) {
    if (this.midiAccess) {
      this.activeInput = this.midiAccess.inputs.get(deviceId);
      console.log('Selected MIDI input:', this.activeInput?.name);
    }
  }

  selectOutputDevice(deviceId) {
    if (this.midiAccess) {
      this.activeOutput = this.midiAccess.outputs.get(deviceId);
      console.log('Selected MIDI output:', this.activeOutput?.name);
    }
  }

  sendLEDFeedback(note, velocity = 127, channel = 0) {
    if (this.activeOutput) {
      const message = [0x90 | channel, note, velocity]; // Note On
      this.activeOutput.send(message);
    }
  }

  testMapping(key, value = 64) {
    const mapping = this.midiMappings.get(key) || this.defaultMappings[key];
    if (mapping) {
      console.log(`Testing mapping for key ${key}:`, mapping);
      this.executeMIDIMapping(mapping, value, { 
        type: 'test', 
        note: key, 
        velocity: value 
      });
    } else {
      console.warn('No mapping found for key:', key);
    }
  }

  destroy() {
    if (this.midiAccess) {
      this.midiAccess.inputs.forEach(input => {
        input.onmidimessage = null;
      });
      this.midiAccess.onstatechange = null;
    }
    
    this.callbacks.clear();
    this.midiMappings.clear();
    this.lastValues.clear();
    
    console.log('MIDI Service destroyed');
  }
}

export default new MIDIServiceSafe();
