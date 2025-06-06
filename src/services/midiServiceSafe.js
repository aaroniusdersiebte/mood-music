// Browser-Safe MIDI Service - Build-optimiert für exe
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
    
    // Default MIDI Mappings
    this.defaultMappings = {
      1: { type: 'volume', target: 'master', min: 0, max: 127 },
      2: { type: 'volume', target: 'desktop', min: 0, max: 127 },
      3: { type: 'volume', target: 'mic', min: 0, max: 127 },
      4: { type: 'volume', target: 'discord', min: 0, max: 127 },
      5: { type: 'volume', target: 'browser', min: 0, max: 127 },
      6: { type: 'volume', target: 'game', min: 0, max: 127 },
      7: { type: 'volume', target: 'music', min: 0, max: 127 },
      8: { type: 'volume', target: 'alert', min: 0, max: 127 },
      
      16: { type: 'hotkey', action: 'moodSwap', target: 'chill' },
      17: { type: 'hotkey', action: 'moodSwap', target: 'action' },
      18: { type: 'hotkey', action: 'playPause' },
      19: { type: 'hotkey', action: 'nextSong' },
      20: { type: 'hotkey', action: 'prevSong' },
      21: { type: 'hotkey', action: 'shuffle' },
      22: { type: 'hotkey', action: 'mute', target: 'master' },
      23: { type: 'hotkey', action: 'soundEffect', target: 'applause' }
    };
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
        window.electronAPI.midi.onMessage((message) => {
          this.handleMIDIMessage(message);
        });
        
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
      
      this.midiAccess.onstatechange = (event) => {
        this.onMIDIStateChange(event);
      };

      return this.setupMIDIDevices();
    } catch (error) {
      console.error('Web MIDI Fehler:', error);
      return this.initializeMockMIDI();
    }
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
        
        input.onmidimessage = (message) => {
          this.handleMIDIMessage(message);
        };
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

    const [status, note, velocity] = data;
    const messageType = status >> 4;
    const channel = status & 0x0F;
    
    const midiMessage = {
      type: this.getMIDIMessageType(messageType),
      channel,
      note,
      velocity,
      timestamp: timeStamp,
      raw: data
    };

    console.log('MIDI Message:', midiMessage);

    if (this.learning && this.learningCallback) {
      this.learningCallback(midiMessage);
      return;
    }

    this.processMIDIMapping(midiMessage);
  }

  getMIDIMessageType(messageType) {
    switch (messageType) {
      case 8: return 'noteOff';
      case 9: return 'noteOn';
      case 11: return 'controlChange';
      case 12: return 'programChange';
      case 14: return 'pitchBend';
      default: return 'unknown';
    }
  }

  processMIDIMapping(midiMessage) {
    const { type, note, velocity } = midiMessage;
    
    let mappingKey;
    if (type === 'controlChange') {
      mappingKey = note;
    } else if (type === 'noteOn' && velocity > 0) {
      mappingKey = `note_${note}`;
    } else {
      return;
    }

    const mapping = this.midiMappings.get(mappingKey) || this.defaultMappings[mappingKey];
    if (!mapping) return;

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
      dbValue
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
    console.log('MIDI Learning gestartet');
  }

  stopLearning() {
    this.learning = false;
    this.learningCallback = null;
    console.log('MIDI Learning gestoppt');
  }

  setMapping(key, mapping) {
    this.midiMappings.set(key, mapping);
    console.log(`MIDI mapping gesetzt: ${key}`, mapping);
  }

  removeMapping(key) {
    this.midiMappings.delete(key);
    console.log(`MIDI mapping entfernt: ${key}`);
  }

  getAllMappings() {
    const mappings = {};
    this.midiMappings.forEach((value, key) => {
      mappings[key] = value;
    });
    return { ...this.defaultMappings, ...mappings };
  }

  onVolumeChange(callback) {
    this.addCallback('volumeChange', callback);
  }

  onHotkeyAction(callback) {
    this.addCallback('hotkeyAction', callback);
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

  testMapping(key, value = 64) {
    const mapping = this.midiMappings.get(key) || this.defaultMappings[key];
    if (mapping) {
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
    }
    
    this.callbacks.clear();
    this.midiMappings.clear();
    this.lastValues.clear();
    
    console.log('MIDI Service destroyed');
  }
}

export default new MIDIServiceSafe();
