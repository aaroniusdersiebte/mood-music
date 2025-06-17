import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Save, 
  Target, 
  Keyboard, 
  Music, 
  Volume2, 
  Monitor, 
  Zap, 
  Layers,
  Square,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Settings,
  Home,
  ArrowRight,
  Gamepad2,
  Palette
} from 'lucide-react';
import globalStateService from '../../services/globalStateService';

const HotkeyDeckEditor = ({ editingButton, onSave, onCancel, keyboardService, recordingHotkey }) => {
  const [formData, setFormData] = useState({
    type: 'hotkey',
    label: '',
    icon: 'zap',
    color: 'blue',
    action: 'playPause',
    target: '',
    keyboardTrigger: '',
    midiTrigger: null,
    volumeValue: 64,
    customCommand: '',
    targetDeck: '',
    obsScene: '',
    obsSource: ''
  });

  const [obsScenes, setOBSScenes] = useState([]);
  const [obsSources, setOBSSources] = useState([]);
  const [obsConnected, setOBSConnected] = useState(false);
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);

  useEffect(() => {
    initializeFormData();
    
    // 🔥 PERFORMANCE FIX: Only load OBS data if this is an OBS button type
    if (editingButton?.data?.type === 'obs' || !editingButton?.data?.type) {
      loadOBSData();
    }
    
    // Listen for OBS state changes
    const handleOBSStateChange = (state) => {
      setObsConnected(state.connected);
      // Only reload OBS data if this component is showing OBS controls
      if (state.connected && (formData.type === 'obs')) {
        loadOBSData();
      }
    };
    
    globalStateService.on('obsStateChanged', handleOBSStateChange);
    
    return () => {
      globalStateService.off('obsStateChanged', handleOBSStateChange);
    };
  }, [editingButton]);

  const initializeFormData = () => {
    if (editingButton?.data) {
      setFormData({
        type: editingButton.data.type || 'hotkey',
        label: editingButton.data.label || '',
        icon: editingButton.data.icon || 'zap',
        color: editingButton.data.color || 'blue',
        action: editingButton.data.action || 'playPause',
        target: editingButton.data.target || '',
        keyboardTrigger: editingButton.data.keyboardTrigger || '',
        midiTrigger: editingButton.data.midiTrigger || null,
        volumeValue: editingButton.data.volumeValue || 64,
        customCommand: editingButton.data.customCommand || '',
        targetDeck: editingButton.data.targetDeck || '',
        obsScene: editingButton.data.obsScene || '',
        obsSource: editingButton.data.obsSource || ''
      });
    }
  };

  const loadOBSData = async () => {
    const obsState = globalStateService.getOBSState();
    setObsConnected(obsState.connected);
    
    if (obsState.connected) {
      // Load scenes
      const scenes = globalStateService.getOBSScenes();
      setOBSScenes(scenes);
      
      // Load sources (audio sources only)
      const sources = globalStateService.getAudioSourcesForMixer();
      setOBSSources(sources);
      
      console.log('HotkeyDeckEditor: OBS Data loaded for button editor:', {
        scenes: scenes.length,
        sources: sources.length
      });
    } else {
      console.log('HotkeyDeckEditor: OBS not connected, skipping data load');
    }
  };
  
  // 🔥 PERFORMANCE FIX: Load OBS data when button type changes to 'obs'
  useEffect(() => {
    if (formData.type === 'obs' && obsConnected) {
      console.log('HotkeyDeckEditor: Button type changed to OBS, loading data...');
      loadOBSData();
    }
  }, [formData.type, obsConnected]);

  const buttonTypes = [
    { value: 'hotkey', label: 'Hotkey Action', icon: Zap, color: 'blue', description: 'Keyboard shortcuts & custom actions' },
    { value: 'volume', label: 'Volume Control', icon: Volume2, color: 'green', description: 'Audio level controls' },
    { value: 'obs', label: 'OBS Control', icon: Monitor, color: 'orange', description: 'Scene switching & recording' },
    { value: 'music', label: 'Music Control', icon: Music, color: 'pink', description: 'Music player functions' },
    { value: 'navigation', label: 'Deck Navigation', icon: Layers, color: 'purple', description: 'Switch between decks' },
    { value: 'empty', label: 'Empty', icon: Square, color: 'gray', description: 'Clear this button' }
  ];

  const buttonIcons = [
    { value: 'zap', label: 'Zap', icon: Zap },
    { value: 'play', label: 'Play', icon: Play },
    { value: 'pause', label: 'Pause', icon: Pause },
    { value: 'skip-forward', label: 'Next', icon: SkipForward },
    { value: 'skip-back', label: 'Previous', icon: SkipBack },
    { value: 'volume-2', label: 'Volume', icon: Volume2 },
    { value: 'mic', label: 'Microphone', icon: Monitor },
    { value: 'monitor', label: 'Monitor', icon: Monitor },
    { value: 'music', label: 'Music', icon: Music },
    { value: 'settings', label: 'Settings', icon: Settings },
    { value: 'layers', label: 'Layers', icon: Layers },
    { value: 'home', label: 'Home', icon: Home },
    { value: 'arrow-right', label: 'Arrow', icon: ArrowRight },
    { value: 'target', label: 'Target', icon: Target },
    { value: 'gamepad', label: 'Gamepad', icon: Gamepad2 },
    { value: 'keyboard', label: 'Keyboard', icon: Keyboard }
  ];

  const hotkeyActions = [
    { value: 'playPause', label: 'Play/Pause', icon: '⏯️' },
    { value: 'nextSong', label: 'Next Song', icon: '⏭️' },
    { value: 'prevSong', label: 'Previous Song', icon: '⏮️' },
    { value: 'shuffle', label: 'Toggle Shuffle', icon: '🔀' },
    { value: 'moodSwap', label: 'Mood Swap', icon: '🎭' },
    { value: 'soundEffect', label: 'Sound Effect', icon: '🔊' },
    { value: 'custom', label: 'Custom Action', icon: '⚙️' }
  ];

  const volumeTargets = [
    { value: 'master', label: 'Master Volume', icon: '🔊' },
    { value: 'desktop', label: 'Desktop Audio', icon: '🖥️' },
    { value: 'mic', label: 'Microphone', icon: '🎤' },
    { value: 'discord', label: 'Discord', icon: '💬' },
    { value: 'browser', label: 'Browser', icon: '🌐' },
    { value: 'game', label: 'Game Audio', icon: '🎮' },
    { value: 'music', label: 'Music Player', icon: '🎵' },
    { value: 'alert', label: 'Alerts/Notifications', icon: '🔔' }
  ];

  const obsActions = [
    { value: 'sceneSwitch', label: 'Switch Scene', icon: '🎬' },
    { value: 'sourceToggle', label: 'Toggle Source', icon: '👁️' },
    { value: 'startRecord', label: 'Start Recording', icon: '⏺️' },
    { value: 'stopRecord', label: 'Stop Recording', icon: '⏹️' },
    { value: 'startStream', label: 'Start Stream', icon: '📡' },
    { value: 'stopStream', label: 'Stop Stream', icon: '📡' }
  ];

  const musicActions = [
    { value: 'playPause', label: 'Play/Pause', icon: '⏯️' },
    { value: 'nextSong', label: 'Next Song', icon: '⏭️' },
    { value: 'prevSong', label: 'Previous Song', icon: '⏮️' },
    { value: 'volumeUp', label: 'Volume Up', icon: '🔊' },
    { value: 'volumeDown', label: 'Volume Down', icon: '🔉' },
    { value: 'shuffle', label: 'Toggle Shuffle', icon: '🔀' }
  ];

  const handleSave = () => {
    if (formData.type === 'empty') {
      onSave({ type: 'empty' });
      return;
    }
    
    if (!formData.label.trim()) {
      alert('Please enter a label for the button!');
      return;
    }
    
    // Validate OBS-specific fields
    if (formData.type === 'obs' && formData.action === 'sceneSwitch' && !formData.obsScene) {
      alert('Please select an OBS scene!');
      return;
    }
    
    onSave(formData);
  };

  const handleRecordHotkey = () => {
    setIsRecordingHotkey(true);
    keyboardService.startRecording((hotkey) => {
      setFormData(prev => ({ ...prev, keyboardTrigger: hotkey }));
      setIsRecordingHotkey(false);
    });
  };

  const getSelectedIcon = () => {
    const iconData = buttonIcons.find(icon => icon.value === formData.icon);
    return iconData ? iconData.icon : Zap;
  };

  if (!editingButton) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Target className="w-5 h-5 text-purple-400" />
            <span>Edit Button ({editingButton.buttonKey})</span>
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Basic Settings */}
          <div className="space-y-4">
            {/* Button Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3">Button Type</label>
              <div className="grid grid-cols-2 gap-2">
                {buttonTypes.map(type => (
                  <button
                    key={type.value}
                    onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                    className={`p-3 rounded-lg border transition-all ${
                      formData.type === type.value
                        ? `border-${type.color}-500 bg-${type.color}-500/20 text-${type.color}-400`
                        : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <type.icon className="w-5 h-5 mb-1 mx-auto" />
                    <div className="text-xs font-medium">{type.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Basic Info */}
            {formData.type !== 'empty' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Label *</label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                    placeholder="Button label"
                  />
                </div>

                {/* Icon Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Icon</label>
                  <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                    {buttonIcons.map(iconData => {
                      const IconComponent = iconData.icon;
                      return (
                        <button
                          key={iconData.value}
                          onClick={() => setFormData(prev => ({ ...prev, icon: iconData.value }))}
                          className={`p-2 rounded border transition-colors ${
                            formData.icon === iconData.value
                              ? 'border-purple-500 bg-purple-500/20 text-purple-400'
                              : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                          title={iconData.label}
                        >
                          <IconComponent className="w-4 h-4 mx-auto" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Color Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Color</label>
                  <div className="grid grid-cols-4 gap-2">
                    {['blue', 'green', 'purple', 'red', 'yellow', 'pink', 'cyan', 'orange'].map(color => (
                      <button
                        key={color}
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                        className={`p-2 rounded border text-xs transition-colors ${
                          formData.color === color
                            ? `border-${color}-500 bg-${color}-500/20 text-${color}-400`
                            : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-${color}-500 mx-auto mb-1`}></div>
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Keyboard Hotkey */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Keyboard Hotkey (Optional)</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.keyboardTrigger}
                      onChange={(e) => setFormData(prev => ({ ...prev, keyboardTrigger: e.target.value }))}
                      className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                      placeholder="e.g., ctrl+1, alt+space"
                      readOnly={isRecordingHotkey || recordingHotkey}
                    />
                    <button
                      onClick={handleRecordHotkey}
                      disabled={isRecordingHotkey || recordingHotkey}
                      className="px-3 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 rounded transition-colors disabled:opacity-50"
                    >
                      {isRecordingHotkey || recordingHotkey ? 'Recording...' : 'Record'}
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Record a hotkey or type manually. This hotkey will execute this button directly.
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right Column - Action-Specific Settings */}
          <div className="space-y-4">
            {/* Type-specific configurations */}
            {formData.type === 'hotkey' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Hotkey Action</label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                  >
                    {hotkeyActions.map(action => (
                      <option key={action.value} value={action.value}>
                        {action.icon} {action.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {formData.action === 'custom' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Custom Command</label>
                    <input
                      type="text"
                      value={formData.customCommand}
                      onChange={(e) => setFormData(prev => ({ ...prev, customCommand: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                      placeholder="Enter custom command"
                    />
                  </div>
                )}
                
                {(formData.action === 'moodSwap' || formData.action === 'soundEffect') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Target</label>
                    <input
                      type="text"
                      value={formData.target}
                      onChange={(e) => setFormData(prev => ({ ...prev, target: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                      placeholder="Enter target (e.g., mood name, sound file)"
                    />
                  </div>
                )}
              </div>
            )}
            
            {formData.type === 'volume' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Volume Target</label>
                  <select
                    value={formData.target}
                    onChange={(e) => setFormData(prev => ({ ...prev, target: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                  >
                    {volumeTargets.map(target => (
                      <option key={target.value} value={target.value}>
                        {target.icon} {target.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Volume Value (0-127)</label>
                  <input
                    type="range"
                    min="0"
                    max="127"
                    value={formData.volumeValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, volumeValue: parseInt(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="text-center text-sm text-gray-300 mt-1">{formData.volumeValue}</div>
                </div>
              </div>
            )}
            
            {formData.type === 'obs' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">OBS Action</label>
                  <select
                    value={formData.action}
                    onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                  >
                    {obsActions.map(action => (
                      <option key={action.value} value={action.value}>
                        {action.icon} {action.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                {formData.action === 'sceneSwitch' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      OBS Scene {obsConnected ? `(${obsScenes.length} available)` : '(OBS not connected)'}
                    </label>
                    {obsConnected && obsScenes.length > 0 ? (
                      <select
                        value={formData.obsScene}
                        onChange={(e) => setFormData(prev => ({ ...prev, obsScene: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                      >
                        <option value="">Select scene...</option>
                        {obsScenes.map(scene => (
                          <option key={scene.sceneName} value={scene.sceneName}>
                            {scene.sceneName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.obsScene}
                        onChange={(e) => setFormData(prev => ({ ...prev, obsScene: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                        placeholder="Enter scene name manually"
                      />
                    )}
                  </div>
                )}
                
                {formData.action === 'sourceToggle' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      OBS Source {obsConnected ? `(${obsSources.length} available)` : '(OBS not connected)'}
                    </label>
                    {obsConnected && obsSources.length > 0 ? (
                      <select
                        value={formData.obsSource}
                        onChange={(e) => setFormData(prev => ({ ...prev, obsSource: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                      >
                        <option value="">Select source...</option>
                        {obsSources.map(source => (
                          <option key={source.name} value={source.name}>
                            {source.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.obsSource}
                        onChange={(e) => setFormData(prev => ({ ...prev, obsSource: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                        placeholder="Enter source name manually"
                      />
                    )}
                  </div>
                )}
                
                {!obsConnected && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded">
                    <div className="text-xs text-orange-400">
                      ⚠️ OBS is not connected. Scenes and sources cannot be loaded automatically.
                    </div>
                  </div>
                )}
              </div>
            )}

            {formData.type === 'music' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Music Action</label>
                <select
                  value={formData.action}
                  onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                >
                  {musicActions.map(action => (
                    <option key={action.value} value={action.value}>
                      {action.icon} {action.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.type === 'navigation' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Target Deck</label>
                <input
                  type="text"
                  value={formData.targetDeck}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetDeck: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                  placeholder="Enter deck ID to switch to"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Enter the ID of the deck you want to switch to when this button is pressed.
                </div>
              </div>
            )}

            {/* Preview */}
            {formData.type !== 'empty' && (
              <div className="p-4 bg-gray-700 rounded border border-gray-600">
                <div className="text-sm text-gray-400 mb-3 font-medium">Preview:</div>
                <div className="flex items-center justify-center">
                  <div className={`
                    aspect-square w-20 h-20 border-2 rounded-lg cursor-pointer
                    transition-all duration-200 flex flex-col items-center justify-center p-2
                    border-${formData.color}-500/50 bg-${formData.color}-500/10 text-${formData.color}-400
                  `}>
                    {React.createElement(getSelectedIcon(), { className: 'w-6 h-6' })}
                    <div className="text-center mt-1">
                      <div className="text-xs font-medium text-white truncate max-w-full">
                        {formData.label || 'Label'}
                      </div>
                    </div>
                    
                    {formData.keyboardTrigger && (
                      <div className="absolute -top-2 -right-2">
                        <div className="px-1 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded border border-purple-500/30">
                          <Keyboard className="w-2 h-2 inline mr-0.5" />
                          ⌨️
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 mt-6 pt-4 border-t border-gray-600">
          <button
            onClick={handleSave}
            disabled={formData.type !== 'empty' && !formData.label.trim()}
            className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center space-x-2"
          >
            <Save className="w-4 h-4" />
            <span>{formData.type === 'empty' ? 'Clear Button' : 'Save Button'}</span>
          </button>
          
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 rounded font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default HotkeyDeckEditor;