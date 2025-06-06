import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  RotateCcw,
  Volume2,
  Zap,
  Gamepad2,
  Activity
} from 'lucide-react';
import midiService from '../services/midiService';

const MIDIMapping = () => {
  const [mappings, setMappings] = useState({});
  const [availableDevices, setAvailableDevices] = useState({ inputs: [], outputs: [] });
  const [selectedInput, setSelectedInput] = useState(null);
  const [selectedOutput, setSelectedOutput] = useState(null);
  const [learningMode, setLearningMode] = useState(false);
  const [learningTarget, setLearningTarget] = useState(null);
  const [editingMapping, setEditingMapping] = useState(null);
  const [showAddMapping, setShowAddMapping] = useState(false);
  const [lastMIDIMessage, setLastMIDIMessage] = useState(null);
  
  const [newMapping, setNewMapping] = useState({
    key: '',
    type: 'volume',
    target: 'master',
    action: 'playPause',
    min: 0,
    max: 127
  });

  const mappingTypes = [
    { value: 'volume', label: 'Volume Control', icon: Volume2, color: 'blue' },
    { value: 'hotkey', label: 'Hotkey Action', icon: Zap, color: 'green' }
  ];

  const volumeTargets = [
    'master', 'desktop', 'mic', 'discord', 'browser', 'game', 'music', 'alert'
  ];

  const hotkeyActions = [
    { value: 'playPause', label: 'Play/Pause' },
    { value: 'nextSong', label: 'Next Song' },
    { value: 'prevSong', label: 'Previous Song' },
    { value: 'shuffle', label: 'Toggle Shuffle' },
    { value: 'mute', label: 'Toggle Mute' },
    { value: 'moodSwap', label: 'Mood Swap' },
    { value: 'soundEffect', label: 'Sound Effect' }
  ];

  useEffect(() => {
    initializeMIDI();
    loadMappings();
    loadDevices();

    // Setup MIDI learning callbacks
    midiService.addCallback('midiMessage', handleMIDIMessage);
    midiService.addCallback('midiLearning', handleMIDILearning);

    return () => {
      midiService.removeCallback('midiMessage', handleMIDIMessage);
      midiService.removeCallback('midiLearning', handleMIDILearning);
    };
  }, []);

  const initializeMIDI = async () => {
    try {
      // Check if MIDI is already initialized globally
      if (midiService.midiAccess || midiService.connected) {
        console.log('MIDIMapping: MIDI already initialized globally, reusing connection');
        return;
      }
      
      console.log('MIDIMapping: MIDI not initialized, starting local initialization...');
      await midiService.initialize();
      console.log('MIDIMapping: MIDI Service initialized locally');
    } catch (error) {
      console.error('MIDIMapping: MIDI initialization failed:', error);
    }
  };

  const loadDevices = () => {
    try {
      const devices = midiService.getAvailableDevices();
      setAvailableDevices(devices);
      console.log('MIDIMapping: Available devices loaded:', devices);
      
      // Auto-select first available devices if none selected
      if (!selectedInput && devices.inputs.length > 0) {
        setSelectedInput(devices.inputs[0].id);
        midiService.selectInputDevice(devices.inputs[0].id);
      }
      if (!selectedOutput && devices.outputs.length > 0) {
        setSelectedOutput(devices.outputs[0].id);
        midiService.selectOutputDevice(devices.outputs[0].id);
      }
    } catch (error) {
      console.error('MIDIMapping: Failed to load devices:', error);
    }
  };

  const loadMappings = () => {
    const allMappings = midiService.getAllMappings();
    setMappings(allMappings);
    console.log('MIDIMapping: Mappings loaded:', Object.keys(allMappings).length, 'mappings');
  };

  const handleMIDIMessage = (message) => {
    setLastMIDIMessage(message);
    console.log('MIDIMapping: Received MIDI message:', message);
  };

  const handleMIDILearning = (message) => {
    console.log('MIDIMapping: Received MIDI learning message:', message);
    
    if (learningMode && learningTarget) {
      console.log('MIDIMapping: Learning mode active, processing message...');
      
      // Erweiterte Message-Type-Unterstützung für Learning
      let key = null;
      
      if (message.type === 'controlChange') {
        key = message.note.toString();
      } else if (message.type === 'noteOn') {
        key = `note_${message.note}`;
      } else if (message.type === 'noteOff') {
        key = `note_${message.note}`;
      } else if (message.type === 'programChange') {
        key = `program_${message.note}`;
      } else if (message.type === 'pitchBend') {
        key = `pitch_${message.channel}`;
      }
      
      if (key) {
        console.log('MIDIMapping: Generated key:', key, 'from message type:', message.type);
        handleLearnComplete(key, message);
      } else {
        console.log('MIDIMapping: Unsupported message type for learning:', message.type);
      }
    }
  };

  const startLearning = (target) => {
    console.log('MIDIMapping: Starting learning for target:', target);
    setLearningMode(true);
    setLearningTarget(target);
    
    // Starte den Service-Learning-Modus
    const success = midiService.startLearning((message) => {
      console.log('MIDIMapping: Service learning callback triggered:', message);
      
      // Generate key from message
      let key = null;
      if (message.type === 'controlChange') {
        key = message.note.toString();
      } else if (message.type === 'noteOn') {
        key = `note_${message.note}`;
      } else if (message.type === 'noteOff') {
        key = `note_${message.note}`;
      } else if (message.type === 'programChange') {
        key = `program_${message.note}`;
      }
      
      if (key) {
        handleLearnComplete(key, message);
      }
    });
    
    if (!success) {
      console.error('MIDIMapping: Failed to start learning');
      setLearningMode(false);
      setLearningTarget(null);
    }
  };

  const stopLearning = () => {
    console.log('MIDIMapping: Stopping learning mode');
    setLearningMode(false);
    setLearningTarget(null);
    midiService.stopLearning();
  };

  const handleLearnComplete = (key, message) => {
    console.log('MIDIMapping: Learning complete for key:', key, 'from message:', message);
    
    if (learningTarget === 'new') {
      console.log('MIDIMapping: Setting new mapping key:', key);
      setNewMapping(prev => ({
        ...prev,
        key: key
      }));
    } else if (editingMapping) {
      console.log('MIDIMapping: Setting editing mapping key:', key);
      setEditingMapping(prev => ({
        ...prev,
        key: key
      }));
    }
    
    // Stop learning
    stopLearning();
  };

  const saveMapping = (mappingData = newMapping) => {
    if (!mappingData.key) {
      alert('Please assign a MIDI control first');
      return;
    }

    const mapping = {
      type: mappingData.type,
      target: mappingData.target,
      action: mappingData.action,
      min: parseInt(mappingData.min),
      max: parseInt(mappingData.max)
    };

    midiService.setMapping(mappingData.key, mapping);
    loadMappings();
    
    if (editingMapping) {
      setEditingMapping(null);
    } else {
      setNewMapping({
        key: '',
        type: 'volume',
        target: 'master',
        action: 'playPause',
        min: 0,
        max: 127
      });
      setShowAddMapping(false);
    }
  };

  const deleteMapping = (key) => {
    if (confirm('Delete this MIDI mapping?')) {
      midiService.removeMapping(key);
      loadMappings();
    }
  };

  const testMapping = (key) => {
    midiService.testMapping(key, 64); // Test mit Mittelwert
  };

  const resetToDefaults = () => {
    if (confirm('Reset all mappings to default values?')) {
      // Clear all custom mappings
      Object.keys(mappings).forEach(key => {
        midiService.removeMapping(key);
      });
      loadMappings();
    }
  };

  const getMappingTypeInfo = (type) => {
    return mappingTypes.find(t => t.value === type) || mappingTypes[0];
  };

  const renderMappingCard = (key, mapping) => {
    const typeInfo = getMappingTypeInfo(mapping.type);
    const Icon = typeInfo.icon;
    const isEditing = editingMapping?.originalKey === key;

    return (
      <motion.div
        key={key}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`bg-gray-800 border-2 rounded-lg p-4 ${
          isEditing ? 'border-blue-500' : 'border-gray-600'
        }`}
      >
        {isEditing ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white">Edit Mapping</h4>
              <div className="flex space-x-2">
                <button
                  onClick={() => saveMapping(editingMapping)}
                  className="p-1 text-green-400 hover:text-green-300"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingMapping(null)}
                  className="p-1 text-gray-400 hover:text-gray-300"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {renderMappingForm(editingMapping, setEditingMapping)}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Icon className={`w-4 h-4 text-${typeInfo.color}-400`} />
                <span className="text-sm font-medium text-white">
                  {key.startsWith('note_') ? `Note ${key.split('_')[1]}` : `CC ${key}`}
                </span>
              </div>
              
              <div className="flex space-x-1">
                <button
                  onClick={() => testMapping(key)}
                  className="p-1 text-blue-400 hover:text-blue-300"
                  title="Test mapping"
                >
                  <Activity className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setEditingMapping({ ...mapping, originalKey: key, key })}
                  className="p-1 text-gray-400 hover:text-gray-300"
                  title="Edit mapping"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => deleteMapping(key)}
                  className="p-1 text-red-400 hover:text-red-300"
                  title="Delete mapping"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            
            <div className="text-xs text-gray-400">
              <div className="flex justify-between">
                <span>{typeInfo.label}</span>
                <span>
                  {mapping.type === 'volume' 
                    ? mapping.target 
                    : mapping.action
                  }
                </span>
              </div>
              {mapping.type === 'volume' && (
                <div className="text-gray-500 mt-1">
                  Range: {mapping.min}-{mapping.max}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderMappingForm = (mapping, setMapping) => (
    <div className="space-y-3">
      {/* MIDI Control Assignment */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">MIDI Control</label>
        <div className="flex space-x-2">
          <input
            type="text"
            value={mapping.key}
            readOnly
            placeholder="Not assigned"
            className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
          />
          <button
            onClick={() => {
              if (learningMode) {
                stopLearning();
              } else {
                startLearning(mapping === newMapping ? 'new' : 'edit');
              }
            }}
            className={`px-3 py-1 rounded text-xs font-medium ${
              learningMode && learningTarget === (mapping === newMapping ? 'new' : 'edit')
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
            }`}
          >
            {learningMode && learningTarget === (mapping === newMapping ? 'new' : 'edit') ? 'Cancel' : 'Learn'}
          </button>
        </div>
        {learningMode && learningTarget === (mapping === newMapping ? 'new' : 'edit') && (
          <p className="text-xs text-blue-400 mt-1 animate-pulse">
            🎩 Move a control on your MIDI device... (or press Cancel to stop)
          </p>
        )}
      </div>

      {/* Mapping Type */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Type</label>
        <select
          value={mapping.type}
          onChange={(e) => setMapping(prev => ({ ...prev, type: e.target.value }))}
          className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
        >
          {mappingTypes.map(type => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Target/Action */}
      {mapping.type === 'volume' ? (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Audio Target</label>
          <select
            value={mapping.target}
            onChange={(e) => setMapping(prev => ({ ...prev, target: e.target.value }))}
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
          >
            {volumeTargets.map(target => (
              <option key={target} value={target}>
                {target.charAt(0).toUpperCase() + target.slice(1)}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-xs text-gray-400 mb-1">Action</label>
          <select
            value={mapping.action}
            onChange={(e) => setMapping(prev => ({ ...prev, action: e.target.value }))}
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
          >
            {hotkeyActions.map(action => (
              <option key={action.value} value={action.value}>
                {action.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Range (only for volume) */}
      {mapping.type === 'volume' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Min Value</label>
            <input
              type="number"
              min="0"
              max="127"
              value={mapping.min}
              onChange={(e) => setMapping(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Max Value</label>
            <input
              type="number"
              min="0"
              max="127"
              value={mapping.max}
              onChange={(e) => setMapping(prev => ({ ...prev, max: parseInt(e.target.value) || 127 }))}
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Gamepad2 className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">MIDI Mapping</h3>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setShowAddMapping(!showAddMapping)}
            className="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          
          <button
            onClick={resetToDefaults}
            className="p-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg transition-colors"
            title="Reset to defaults"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Device Selection */}
      <div className="mb-4 p-3 bg-gray-800 border border-gray-600 rounded-lg">
        <h4 className="text-sm font-medium text-white mb-3">MIDI Devices</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Input Device</label>
            <select
              value={selectedInput || ''}
              onChange={(e) => {
                setSelectedInput(e.target.value);
                midiService.selectInputDevice(e.target.value);
              }}
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            >
              <option value="">No device selected</option>
              {availableDevices.inputs.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs text-gray-400 mb-1">Output Device</label>
            <select
              value={selectedOutput || ''}
              onChange={(e) => {
                setSelectedOutput(e.target.value);
                midiService.selectOutputDevice(e.target.value);
              }}
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
            >
              <option value="">No device selected</option>
              {availableDevices.outputs.map(device => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Add New Mapping */}
      <AnimatePresence>
        {showAddMapping && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-3 bg-gray-800 border border-gray-600 rounded-lg"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-white">Add New Mapping</h4>
              <button
                onClick={() => saveMapping()}
                className="px-3 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded text-xs font-medium transition-colors"
              >
                Save Mapping
              </button>
            </div>
            
            {renderMappingForm(newMapping, setNewMapping)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Mappings */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white">Current Mappings</h4>
        
        <AnimatePresence>
          {Object.entries(mappings).map(([key, mapping]) => 
            renderMappingCard(key, mapping)
          )}
        </AnimatePresence>
        
        {Object.keys(mappings).length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Gamepad2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No MIDI mappings configured</p>
            <p className="text-xs mt-1">Click "+" to add your first mapping</p>
          </div>
        )}
      </div>

      {/* MIDI Activity Monitor */}
      {lastMIDIMessage && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-400 font-medium">Last MIDI Message</span>
            <span className="text-xs text-gray-400">
              {new Date(lastMIDIMessage.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-xs text-green-300 mt-1">
            {lastMIDIMessage.type} - Channel: {lastMIDIMessage.channel} - 
            Note: {lastMIDIMessage.note} - Velocity: {lastMIDIMessage.velocity}
          </div>
        </div>
      )}
    </div>
  );
};

export default MIDIMapping;
