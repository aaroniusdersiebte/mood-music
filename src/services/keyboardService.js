// Keyboard Service - Global Hotkey Management
class KeyboardService {
  constructor() {
    this.registeredHotkeys = new Map();
    this.callbacks = new Map();
    this.isRecording = false;
    this.recordingCallback = null;
    this.recordingKeys = new Set();
    this.recordingTimeout = null;
    
    // Special key mappings
    this.keyCodeMap = {
      8: 'backspace',
      9: 'tab',
      13: 'enter',
      16: 'shift',
      17: 'ctrl',
      18: 'alt',
      19: 'pause',
      20: 'capslock',
      27: 'escape',
      32: 'space',
      33: 'pageup',
      34: 'pagedown',
      35: 'end',
      36: 'home',
      37: 'left',
      38: 'up',
      39: 'right',
      40: 'down',
      45: 'insert',
      46: 'delete',
      91: 'meta',
      92: 'meta',
      93: 'menu',
      112: 'f1',
      113: 'f2',
      114: 'f3',
      115: 'f4',
      116: 'f5',
      117: 'f6',
      118: 'f7',
      119: 'f8',
      120: 'f9',
      121: 'f10',
      122: 'f11',
      123: 'f12'
    };
    
    this.modifierKeys = ['ctrl', 'alt', 'shift', 'meta'];
    
    // Bind methods
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    
    this.initialize();
  }

  initialize() {
    console.log('KeyboardService: Initializing global hotkey support...');
    
    // Add global event listeners
    document.addEventListener('keydown', this.handleKeyDown, true);
    document.addEventListener('keyup', this.handleKeyUp, true);
    
    console.log('KeyboardService: Initialized successfully');
  }

  handleKeyDown(event) {
    // Don't interfere with input fields unless specifically recording
    if (!this.isRecording && this.isInputField(event.target)) {
      return;
    }

    if (this.isRecording) {
      this.handleRecordingKeyDown(event);
      return;
    }

    // Build hotkey string
    const hotkeyString = this.buildHotkeyString(event);
    if (!hotkeyString) return;

    // Check for registered hotkeys
    this.registeredHotkeys.forEach((hotkeyId, registeredHotkey) => {
      if (this.normalizeHotkey(registeredHotkey) === this.normalizeHotkey(hotkeyString)) {
        console.log('KeyboardService: Hotkey triggered:', hotkeyId, 'for hotkey:', hotkeyString);
        event.preventDefault();
        event.stopPropagation();
        
        this.triggerCallback('hotkeyTriggered', hotkeyId);
      }
    });
  }

  handleKeyUp(event) {
    if (this.isRecording) {
      this.handleRecordingKeyUp(event);
    }
  }

  handleRecordingKeyDown(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const key = this.getKeyName(event);
    if (key) {
      this.recordingKeys.add(key);
      
      // Reset timeout
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
      }
      
      // Auto-finish recording after 500ms of no new keys
      this.recordingTimeout = setTimeout(() => {
        this.finishRecording();
      }, 500);
    }
  }

  handleRecordingKeyUp(event) {
    // Don't remove modifier keys immediately
    const key = this.getKeyName(event);
    if (key && !this.modifierKeys.includes(key)) {
      // For non-modifiers, trigger completion
      setTimeout(() => {
        if (this.isRecording && this.recordingKeys.size > 0) {
          this.finishRecording();
        }
      }, 100);
    }
  }

  finishRecording() {
    if (!this.isRecording || this.recordingKeys.size === 0) return;
    
    const hotkeyString = this.buildHotkeyFromKeys(this.recordingKeys);
    console.log('KeyboardService: Recorded hotkey:', hotkeyString);
    
    this.stopRecording();
    
    if (this.recordingCallback) {
      this.recordingCallback(hotkeyString);
    }
    
    this.triggerCallback('hotkeyRecorded', hotkeyString);
  }

  buildHotkeyFromKeys(keys) {
    const keyArray = Array.from(keys);
    const modifiers = [];
    const nonModifiers = [];
    
    keyArray.forEach(key => {
      if (this.modifierKeys.includes(key)) {
        modifiers.push(key);
      } else {
        nonModifiers.push(key);
      }
    });
    
    // Sort modifiers in standard order
    const sortedModifiers = modifiers.sort((a, b) => {
      const order = ['ctrl', 'alt', 'shift', 'meta'];
      return order.indexOf(a) - order.indexOf(b);
    });
    
    // Combine modifiers with main key
    const result = [...sortedModifiers, ...nonModifiers].join('+');
    return result;
  }

  buildHotkeyString(event) {
    const key = this.getKeyName(event);
    if (!key) return null;
    
    // Don't trigger on lone modifier keys
    if (this.modifierKeys.includes(key)) return null;
    
    const parts = [];
    
    if (event.ctrlKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');
    if (event.metaKey) parts.push('meta');
    
    parts.push(key);
    
    return parts.join('+');
  }

  getKeyName(event) {
    // Use keyCode map for special keys
    if (this.keyCodeMap[event.keyCode]) {
      return this.keyCodeMap[event.keyCode];
    }
    
    // Use event.key for regular keys, convert to lowercase
    if (event.key && event.key.length === 1) {
      return event.key.toLowerCase();
    }
    
    // Fallback to event.code processing
    if (event.code) {
      if (event.code.startsWith('Key')) {
        return event.code.slice(3).toLowerCase();
      }
      if (event.code.startsWith('Digit')) {
        return event.code.slice(5);
      }
      if (event.code.startsWith('Numpad')) {
        return 'numpad' + event.code.slice(6);
      }
    }
    
    return null;
  }

  normalizeHotkey(hotkey) {
    // Normalize hotkey string for comparison
    return hotkey.toLowerCase().split('+').sort().join('+');
  }

  isInputField(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const inputTypes = ['input', 'textarea', 'select'];
    
    if (inputTypes.includes(tagName)) return true;
    if (element.contentEditable === 'true') return true;
    if (element.isContentEditable) return true;
    
    return false;
  }

  // Public API
  registerHotkey(id, hotkeyString) {
    if (!hotkeyString || hotkeyString.trim() === '') {
      console.warn('KeyboardService: Invalid hotkey string for ID:', id);
      return false;
    }
    
    const normalizedHotkey = hotkeyString.toLowerCase().trim();
    
    // Check for conflicts
    let hasConflict = false;
    this.registeredHotkeys.forEach((existingId, existingHotkey) => {
      if (this.normalizeHotkey(existingHotkey) === this.normalizeHotkey(normalizedHotkey) && existingId !== id) {
        console.warn('KeyboardService: Hotkey conflict detected:', normalizedHotkey, 'already registered for:', existingId);
        hasConflict = true;
      }
    });
    
    if (hasConflict) {
      return false;
    }
    
    this.registeredHotkeys.set(normalizedHotkey, id);
    console.log('KeyboardService: Registered hotkey:', normalizedHotkey, 'for ID:', id);
    return true;
  }

  unregisterHotkey(id) {
    let removed = false;
    this.registeredHotkeys.forEach((registeredId, hotkey) => {
      if (registeredId === id) {
        this.registeredHotkeys.delete(hotkey);
        console.log('KeyboardService: Unregistered hotkey:', hotkey, 'for ID:', id);
        removed = true;
      }
    });
    return removed;
  }

  unregisterHotkeyByString(hotkeyString) {
    const normalizedHotkey = hotkeyString.toLowerCase().trim();
    const removed = this.registeredHotkeys.delete(normalizedHotkey);
    if (removed) {
      console.log('KeyboardService: Unregistered hotkey by string:', normalizedHotkey);
    }
    return removed;
  }

  startRecording(callback) {
    if (this.isRecording) {
      console.warn('KeyboardService: Already recording hotkey');
      return false;
    }
    
    console.log('KeyboardService: Starting hotkey recording...');
    this.isRecording = true;
    this.recordingCallback = callback;
    this.recordingKeys.clear();
    
    this.triggerCallback('recordingStarted');
    
    // Auto-stop recording after 10 seconds
    setTimeout(() => {
      if (this.isRecording) {
        console.log('KeyboardService: Recording timeout, stopping...');
        this.stopRecording();
      }
    }, 10000);
    
    return true;
  }

  stopRecording() {
    if (!this.isRecording) return;
    
    console.log('KeyboardService: Stopping hotkey recording');
    this.isRecording = false;
    this.recordingCallback = null;
    this.recordingKeys.clear();
    
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
    
    this.triggerCallback('recordingStopped');
  }

  getAllRegisteredHotkeys() {
    const hotkeys = {};
    this.registeredHotkeys.forEach((id, hotkey) => {
      hotkeys[hotkey] = id;
    });
    return hotkeys;
  }

  // Event System
  on(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
    console.log('KeyboardService: Callback registered for:', event);
  }

  off(event, callback) {
    const callbacks = this.callbacks.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
      console.log('KeyboardService: Callback removed for:', event);
    }
  }

  triggerCallback(event, data = null) {
    const callbacks = this.callbacks.get(event) || [];
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('KeyboardService: Callback error:', error);
      }
    });
  }

  // Testing
  testHotkey(hotkeyString) {
    console.log('KeyboardService: Testing hotkey:', hotkeyString);
    const id = this.registeredHotkeys.get(hotkeyString.toLowerCase());
    if (id) {
      this.triggerCallback('hotkeyTriggered', id);
      return true;
    }
    return false;
  }

  // Debug
  getDebugInfo() {
    return {
      registeredHotkeys: Array.from(this.registeredHotkeys.entries()),
      isRecording: this.isRecording,
      recordingKeys: Array.from(this.recordingKeys),
      callbackEvents: Array.from(this.callbacks.keys())
    };
  }

  // Cleanup
  destroy() {
    console.log('KeyboardService: Destroying...');
    
    document.removeEventListener('keydown', this.handleKeyDown, true);
    document.removeEventListener('keyup', this.handleKeyUp, true);
    
    this.registeredHotkeys.clear();
    this.callbacks.clear();
    this.recordingKeys.clear();
    
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
    }
    
    console.log('KeyboardService: Destroyed');
  }
}

export default KeyboardService;