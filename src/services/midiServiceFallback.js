// Browser-only MIDI Service Fallback
// Verwendet nur Web MIDI API für maximale Kompatibilität
class MIDIServiceFallback {
  constructor() {
    this.midiAccess = null;
    this.activeInput = null;
    this.activeOutput = null;
    this.midiMappings = new Map();
    this.callbacks = new Map();
    this.lastValues = new Map();
    this.learning = false;
    this.learningCallback = null;
    
    // Standard MIDI CC Mappings
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
    if (!navigator.requestMIDIAccess) {
      throw new Error('Web MIDI API not supported in this browser');
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      console.log('Web MIDI Access granted (fallback mode)');
      
      this.midiAccess.onstatechange = (event) => {
        this.onMIDIStateChange(event);
      };

      return this.setupMIDIDevices();
    } catch (error) {
      console.error('Failed to get MIDI access:', error);
      throw error;
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

    console.log('MIDI Devices (fallback):', { inputs, outputs });
    return { inputs, outputs };
  }

  handleMIDIMessage(message) {
    const data = Array.from(message.data);
    const [status, note, velocity] = data;
    
    const messageType = status >> 4;
    const channel = status & 0x0F;
    
    const midiMessage = {
      type: this.getMIDIMessageType(messageType),
      channel,
      note,
      velocity,
      timestamp: message.timeStamp,
      raw: data
    };

    console.log('MIDI Message (fallback):', midiMessage);

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
    
    console.log(`Volume Control (fallback): ${mapping.target} = ${smoothedValue}dB`);
    
    this.triggerCallback('volumeChange', {
      target: mapping.target,
      value: smoothedValue,
      midiValue,
      dbValue
    });
  }

  handleHotkeyAction(mapping, velocity) {
    if (velocity === 0) return;
    
    console.log(`Hotkey Action (fallback): ${mapping.action}`, mapping.target);
    
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

  // Learning Mode
  startLearning(callback) {
    this.learning = true;
    this.learningCallback = callback;
    console.log('MIDI Learning started (fallback)');
  }

  stopLearning() {
    this.learning = false;
    this.learningCallback = null;
    console.log('MIDI Learning stopped (fallback)');
  }

  // Mapping Management
  setMapping(key, mapping) {
    this.midiMappings.set(key, mapping);
    console.log(`MIDI mapping set (fallback): ${key}`, mapping);
  }

  removeMapping(key) {
    this.midiMappings.delete(key);
    console.log(`MIDI mapping removed (fallback): ${key}`);
  }

  getAllMappings() {
    const mappings = {};
    this.midiMappings.forEach((value, key) => {
      mappings[key] = value;
    });
    return { ...this.defaultMappings, ...mappings };
  }

  // Callbacks
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

  // Device Management
  getAvailableDevices() {
    if (this.midiAccess) {
      return this.setupMIDIDevices();
    }
    return { inputs: [], outputs: [] };
  }

  selectInputDevice(deviceId) {
    if (this.midiAccess) {
      this.activeInput = this.midiAccess.inputs.get(deviceId);
      console.log('Selected MIDI input (fallback):', this.activeInput?.name);
    }
  }

  selectOutputDevice(deviceId) {
    if (this.midiAccess) {
      this.activeOutput = this.midiAccess.outputs.get(deviceId);
      console.log('Selected MIDI output (fallback):', this.activeOutput?.name);
    }
  }

  // LED Feedback
  sendLEDFeedback(note, velocity = 127, channel = 0) {
    if (this.activeOutput) {
      const message = [0x90 | channel, note, velocity];
      this.activeOutput.send(message);
    }
  }

  // Testing
  testMapping(key, value = 64) {
    const mapping = this.midiMappings.get(key) || this.defaultMappings[key];
    if (mapping) {
      this.executeMIDIMapping(mapping, value, { 
        type: 'test', 
        note: key, 
        velocity: value 
      });
    } else {
      console.warn('No mapping found for key (fallback):', key);
    }
  }

  onMIDIStateChange(event) {
    const port = event.port;
    console.log(`MIDI device ${port.state} (fallback): ${port.name} (${port.type})`);
    
    if (port.state === 'connected' && port.type === 'input') {
      port.onmidimessage = (message) => {
        this.handleMIDIMessage(message);
      };
    }
  }

  // Cleanup
  destroy() {
    if (this.midiAccess) {
      this.midiAccess.inputs.forEach(input => {
        input.onmidimessage = null;
      });
    }
    
    this.callbacks.clear();
    this.midiMappings.clear();
    this.lastValues.clear();
    
    console.log('MIDI Service (fallback) destroyed');
  }
}

// Export fallback version if native MIDI fails
export default MIDIServiceFallback;
