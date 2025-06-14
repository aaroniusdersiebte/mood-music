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
  Activity,
  Eye
} from 'lucide-react';
import globalStateService from '../services/globalStateService';

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
  const [audioMappings, setAudioMappings] = useState({});
  
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
    console.log('MIDIMapping: Initializing as MIDI Master with GlobalStateService');
    
    // Load initial state from GlobalStateService
    const midiState = globalStateService.getMIDIState();
    const allMIDIMappings = globalStateService.getAllMIDIMappings();
    const audioSourceMappings = globalStateService.getAudioSourceMappings();
    
    setAvailableDevices(midiState.devices);
    setLastMIDIMessage(midiState.lastActivity);
    setMappings(allMIDIMappings);
    setAudioMappings(audioSourceMappings);
    
    console.log('MIDIMapping: Initial state loaded:', {
      midiConnected: midiState.connected,
      midiMappingsCount: Object.keys(allMIDIMappings).length,
      audioMappingsCount: Object.keys(audioSourceMappings).length,
      devicesCount: midiState.devices.inputs.length
    });
    
    // Subscribe to global state changes
    const handleMIDIStateChange = (newState) => {
      console.log('MIDIMapping: MIDI state changed:', newState);
      setAvailableDevices(newState.devices);
      setLastMIDIMessage(newState.lastActivity);
    };
    
    const handleMappingsChange = (data) => {
      console.log('MIDIMapping: Mappings changed:', data);
      if (data.type === 'midi') {
        setMappings(data.mappings);
      } else if (data.type === 'audio') {
        setAudioMappings(data.mappings);
      }
    };
    
    const handleMIDILearningCompleted = (data) => {
      console.log('MIDIMapping: MIDI learning completed:', data);
      if (learningMode && learningTarget) {
        const midiKey = data.message.note.toString();
        handleLearnComplete(midiKey, data.message);
      }
    };
    
    const handleMIDILearningStopped = () => {
      console.log('MIDIMapping: MIDI learning stopped');
      setLearningMode(false);
      setLearningTarget(null);
    };
    
    // Register callbacks
    globalStateService.on('midiStateChanged', handleMIDIStateChange);
    globalStateService.on('mappingsChanged', handleMappingsChange);
    globalStateService.on('midiLearningCompleted', handleMIDILearningCompleted);
    globalStateService.on('midiLearningStopped', handleMIDILearningStopped);
    
    // Auto-select devices if available
    if (midiState.devices.inputs.length > 0 && !selectedInput) {
      const firstInput = midiState.devices.inputs[0];
      setSelectedInput(firstInput.id);
      selectInputDevice(firstInput.id);
    }
    
    if (midiState.devices.outputs.length > 0 && !selectedOutput) {
      const firstOutput = midiState.devices.outputs[0];
      setSelectedOutput(firstOutput.id);
      selectOutputDevice(firstOutput.id);
    }
    
    // Cleanup
    return () => {
      globalStateService.off('midiStateChanged', handleMIDIStateChange);
      globalStateService.off('mappingsChanged', handleMappingsChange);
      globalStateService.off('midiLearningCompleted', handleMIDILearningCompleted);
      globalStateService.off('midiLearningStopped', handleMIDILearningStopped);
    };
  }, [learningMode, learningTarget, selectedInput, selectedOutput]);

  const selectInputDevice = (deviceId) => {
    setSelectedInput(deviceId);
    const midiService = globalStateService.services.midi;
    if (midiService) {
      midiService.selectInputDevice(deviceId);
      console.log('MIDIMapping: Selected input device:', deviceId);
    }
  };

  const selectOutputDevice = (deviceId) => {
    setSelectedOutput(deviceId);
    const midiService = globalStateService.services.midi;
    if (midiService) {
      midiService.selectOutputDevice(deviceId);
      console.log('MIDIMapping: Selected output device:', deviceId);
    }
  };

  const startLearning = (target) => {
    console.log('MIDIMapping: Starting learning for target:', target);
    setLearningMode(true);
    setLearningTarget(target);
    
    const success = globalStateService.startMIDILearning(`MIDIMapping_${target}`);
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
    globalStateService.stopMIDILearning();
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

    // Use GlobalStateService to save mapping
    globalStateService.setMIDIMapping(mappingData.key, mapping, 'MIDIMapping');
    
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
      globalStateService.removeMIDIMapping(key);
    }
  };

  const testMapping = (key) => {
    const midiService = globalStateService.services.midi;
    if (midiService) {
      midiService.testMapping(key, 64);
    }
  };

  const resetToDefaults = () => {
    if (confirm('Reset all mappings to default values?')) {
      // Clear all custom mappings through GlobalStateService
      Object.keys(mappings).forEach(key => {
        globalStateService.removeMIDIMapping(key);
      });
    }
  };

  const getMappingTypeInfo = (type) => {
    return mappingTypes.find(t => t.value === type) || mappingTypes[0];
  };

  const getMappingSource = (mapping) => {
    return mapping.source || 'Unknown';
  };

  const renderMappingCard = (key, mapping) => {
    const typeInfo = getMappingTypeInfo(mapping.type);
    const Icon = typeInfo.icon;
    const isEditing = editingMapping?.originalKey === key;
    const source = getMappingSource(mapping);

    return (
      <motion.div
        key={key}
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`bg-gray-800 border-2 rounded-lg p-4 ${
          isEditing ? 'border-blue-500' : 
          source === 'AudioMixer' ? 'border-purple-500/50' :
          'border-gray-600'
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
                {source === 'AudioMixer' && (
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                    Audio Mixer
                  </span>
                )}
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
              <div className="text-gray-500 mt-1">
                Source: {source}
              </div>
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
          <h3 className="text-lg font-semibold text-white">MIDI Mapping (Master Control)</h3>
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
        <h4 className="text-sm font-medium text-white mb-3">MIDI Devices (Global)</h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Input Device</label>
            <select
              value={selectedInput || ''}
              onChange={(e) => selectInputDevice(e.target.value)}
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
              onChange={(e) => selectOutputDevice(e.target.value)}
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

      {/* Audio Mixer Mappings Overview */}
      {Object.keys(audioMappings).length > 0 && (
        <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <h4 className="text-sm font-medium text-white mb-3">Audio Mixer Mappings</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(audioMappings).map(([sourceName, mappings]) => (
              <div key={sourceName} className="flex items-center justify-between p-2 bg-gray-800/50 rounded">
                <span className="text-gray-300 truncate">{sourceName}</span>
                <div className="flex space-x-2">
                  {mappings.volume && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                      Vol: CC{mappings.volume}
                    </span>
                  )}
                  {mappings.mute && (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                      Mute: CC{mappings.mute}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <h4 className="text-sm font-medium text-white">All MIDI Mappings</h4>
        
        <AnimatePresence>
          {Object.entries(mappings).map(([key, mapping]) => 
            renderMappingCard(key, mapping)
          )}
        </AnimatePresence>
        
        {Object.keys(mappings).length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Gamepad2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No MIDI mappings configured</p>
            <p className="text-xs mt-1">Click "+" to add your first mapping or use Audio Mixer to learn controls</p>
          </div>
        )}
      </div>

      {/* MIDI Activity Monitor */}
      {lastMIDIMessage && (
        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-green-400 font-medium">Last MIDI Message (Global)</span>
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
