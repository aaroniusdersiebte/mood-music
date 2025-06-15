import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Save, 
  Settings,
  Zap,
  Volume2,
  Monitor,
  Music,
  Navigation,
  Square,
  Palette,
  Type,
  Gamepad2,
  Target,
  ArrowRight,
  Home,
  Layers,
  Keyboard,
  Mic,
  Speaker,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  VolumeX,
  RotateCcw
} from 'lucide-react';
import configService from '../../services/configService';
import globalStateService from '../../services/globalStateService';

const DashboardDeckEditor = ({ isOpen, onClose, deckId, buttonKey, onSave }) => {
  const [deck, setDeck] = useState(null);
  const [button, setButton] = useState(null);
  const [buttonType, setButtonType] = useState('empty');
  const [label, setLabel] = useState('');
  const [action, setAction] = useState('');
  const [target, setTarget] = useState('');
  const [color, setColor] = useState('blue');
  const [hotkey, setHotkey] = useState('');
  const [volumeValue, setVolumeValue] = useState(64);
  const [obsScene, setObsScene] = useState('');
  const [obsSource, setObsSource] = useState('');
  const [targetDeck, setTargetDeck] = useState('');
  const [customCommand, setCustomCommand] = useState('');
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);
  const [availableDecks, setAvailableDecks] = useState({});
  const [availableAudioSources, setAvailableAudioSources] = useState([]);
  const [availableOBSScenes, setAvailableOBSScenes] = useState([]);
  const [availableOBSSources, setAvailableOBSSources] = useState([]);
  
  const modalRef = useRef(null);
  const hotkeyInputRef = useRef(null);

  // Button types configuration
  const buttonTypes = {
    empty: { 
      name: 'Empty', 
      icon: Square, 
      color: 'gray',
      description: 'Empty button slot'
    },
    hotkey: { 
      name: 'Hotkey', 
      icon: Zap, 
      color: 'blue',
      description: 'Keyboard shortcuts and system commands'
    },
    volume: { 
      name: 'Volume', 
      icon: Volume2, 
      color: 'green',
      description: 'Audio source volume control'
    },
    obs: { 
      name: 'OBS', 
      icon: Monitor, 
      color: 'orange',
      description: 'OBS scenes and recording controls'
    },
    music: { 
      name: 'Music', 
      icon: Music, 
      color: 'pink',
      description: 'Music playback and mood controls'
    },
    navigation: { 
      name: 'Navigation', 
      icon: Layers, 
      color: 'purple',
      description: 'Navigate between decks'
    }
  };

  // Action options for each button type
  const actionOptions = {
    hotkey: [
      { value: 'playPause', label: 'Play/Pause', icon: Play },
      { value: 'nextSong', label: 'Next Song', icon: SkipForward },
      { value: 'prevSong', label: 'Previous Song', icon: SkipBack },
      { value: 'shuffle', label: 'Shuffle', icon: RotateCcw },
      { value: 'mute', label: 'Toggle Mute', icon: VolumeX },
      { value: 'soundEffect', label: 'Sound Effect', icon: Speaker },
      { value: 'custom', label: 'Custom Command', icon: Target }
    ],
    volume: [
      { value: 'setVolume', label: 'Set Volume', icon: Volume2 },
      { value: 'mute', label: 'Toggle Mute', icon: VolumeX },
      { value: 'volumeUp', label: 'Volume Up (+10%)', icon: Volume2 },
      { value: 'volumeDown', label: 'Volume Down (-10%)', icon: Volume2 }
    ],
    obs: [
      { value: 'sceneSwitch', label: 'Switch Scene', icon: Monitor },
      { value: 'sourceToggle', label: 'Toggle Source', icon: Monitor },
      { value: 'startRecord', label: 'Start Recording', icon: Monitor },
      { value: 'stopRecord', label: 'Stop Recording', icon: Monitor },
      { value: 'startStream', label: 'Start Streaming', icon: Monitor },
      { value: 'stopStream', label: 'Stop Streaming', icon: Monitor }
    ],
    music: [
      { value: 'playPause', label: 'Play/Pause Music', icon: Play },
      { value: 'nextSong', label: 'Next Song', icon: SkipForward },
      { value: 'prevSong', label: 'Previous Song', icon: SkipBack },
      { value: 'moodSwap', label: 'Switch Mood', icon: Palette },
      { value: 'volumeUp', label: 'Volume Up', icon: Volume2 },
      { value: 'volumeDown', label: 'Volume Down', icon: Volume2 }
    ],
    navigation: [
      { value: 'goToSubDeck', label: 'Go to Sub-Deck', icon: ArrowRight },
      { value: 'goBack', label: 'Go Back', icon: ArrowRight },
      { value: 'goHome', label: 'Go to Main Deck', icon: Home }
    ]
  };

  // Color options
  const colorOptions = [
    { value: 'blue', name: 'Blue', class: 'bg-blue-500' },
    { value: 'green', name: 'Green', class: 'bg-green-500' },
    { value: 'purple', name: 'Purple', class: 'bg-purple-500' },
    { value: 'orange', name: 'Orange', class: 'bg-orange-500' },
    { value: 'pink', name: 'Pink', class: 'bg-pink-500' },
    { value: 'red', name: 'Red', class: 'bg-red-500' },
    { value: 'yellow', name: 'Yellow', class: 'bg-yellow-500' },
    { value: 'gray', name: 'Gray', class: 'bg-gray-500' }
  ];

  useEffect(() => {
    if (isOpen && deckId && buttonKey) {
      loadButton();
      loadAvailableOptions();
    }
  }, [isOpen, deckId, buttonKey]);

  useEffect(() => {
    if (isRecordingHotkey && hotkeyInputRef.current) {
      hotkeyInputRef.current.focus();
    }
  }, [isRecordingHotkey]);

  const loadButton = () => {
    const decks = configService.getDecks();
    const currentDeck = decks[deckId];
    
    if (currentDeck) {
      setDeck(currentDeck);
      const currentButton = currentDeck.buttons?.[buttonKey];
      
      if (currentButton) {
        // Load existing button
        setButton(currentButton);
        setButtonType(currentButton.type || 'empty');
        setLabel(currentButton.label || '');
        setAction(currentButton.action || '');
        setTarget(currentButton.target || '');
        setColor(currentButton.color || 'blue');
        setHotkey(currentButton.hotkey || '');
        setVolumeValue(currentButton.volumeValue || 64);
        setObsScene(currentButton.obsScene || '');
        setObsSource(currentButton.obsSource || '');
        setTargetDeck(currentButton.targetDeck || '');
        setCustomCommand(currentButton.customCommand || '');
      } else {
        // New button
        resetForm();
      }
    }
  };

  const loadAvailableOptions = () => {
    // Load available decks
    const decks = configService.getDecks();
    setAvailableDecks(decks);
    
    // Load available audio sources
    const audioSources = globalStateService.getAudioSources();
    setAvailableAudioSources(audioSources);
    
    // Load OBS scenes and sources (if connected)
    if (globalStateService.isOBSConnected()) {
      // TODO: Get OBS scenes and sources from globalStateService
      setAvailableOBSScenes(['Main Scene', 'Gaming Scene', 'Chat Scene']);
      setAvailableOBSSources(['Webcam', 'Game Capture', 'Browser Source']);
    }
  };

  const resetForm = () => {
    setButton(null);
    setButtonType('empty');
    setLabel('');
    setAction('');
    setTarget('');
    setColor('blue');
    setHotkey('');
    setVolumeValue(64);
    setObsScene('');
    setObsSource('');
    setTargetDeck('');
    setCustomCommand('');
  };

  const handleHotkeyRecord = (e) => {
    if (!isRecordingHotkey) return;
    
    e.preventDefault();
    
    const keys = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (e.metaKey) keys.push('Meta');
    
    if (e.key && !['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    }
    
    if (keys.length > 0) {
      setHotkey(keys.join('+'));
      setIsRecordingHotkey(false);
    }
  };

  const handleSave = async () => {
    if (!deck || !buttonKey) return;
    
    const buttonData = {
      type: buttonType,
      label: label || 'Unnamed',
      color: color
    };
    
    // Add type-specific properties
    if (buttonType !== 'empty') {
      buttonData.action = action;
      
      switch (buttonType) {
        case 'hotkey':
          buttonData.hotkey = hotkey;
          buttonData.target = target;
          if (action === 'custom') {
            buttonData.customCommand = customCommand;
          }
          break;
          
        case 'volume':
          buttonData.target = target;
          if (action === 'setVolume') {
            buttonData.volumeValue = volumeValue;
          }
          break;
          
        case 'obs':
          if (action === 'sceneSwitch') {
            buttonData.obsScene = obsScene;
          } else if (action === 'sourceToggle') {
            buttonData.obsSource = obsSource;
          }
          break;
          
        case 'music':
          if (action === 'moodSwap') {
            buttonData.target = target;
          }
          break;
          
        case 'navigation':
          if (action === 'goToSubDeck') {
            buttonData.targetDeck = targetDeck;
          }
          break;
      }
    }
    
    try {
      // Update deck configuration
      const updatedDeck = {
        ...deck,
        buttons: {
          ...deck.buttons,
          [buttonKey]: buttonData
        }
      };
      
      await configService.updateDeck(deckId, { buttons: updatedDeck.buttons });
      
      // Notify parent component
      if (onSave) {
        onSave(deckId, buttonKey, buttonData);
      }
      
      console.log('DashboardDeckEditor: Button saved:', buttonKey, buttonData);
      onClose();
    } catch (error) {
      console.error('DashboardDeckEditor: Failed to save button:', error);
    }
  };

  const handleDelete = async () => {
    if (!deck || !buttonKey) return;
    
    if (confirm('Delete this button?')) {
      try {
        const updatedButtons = { ...deck.buttons };
        delete updatedButtons[buttonKey];
        
        await configService.updateDeck(deckId, { buttons: updatedButtons });
        
        if (onSave) {
          onSave(deckId, buttonKey, null);
        }
        
        console.log('DashboardDeckEditor: Button deleted:', buttonKey);
        onClose();
      } catch (error) {
        console.error('DashboardDeckEditor: Failed to delete button:', error);
      }
    }
  };

  const renderTypeSpecificOptions = () => {
    switch (buttonType) {
      case 'hotkey':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Hotkey</label>
              <div className="flex space-x-2">
                <input
                  ref={hotkeyInputRef}
                  type="text"
                  value={hotkey}
                  onChange={(e) => setHotkey(e.target.value)}
                  onKeyDown={handleHotkeyRecord}
                  placeholder="Press keys or type manually"
                  className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  readOnly={isRecordingHotkey}
                />
                <button
                  onClick={() => setIsRecordingHotkey(!isRecordingHotkey)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isRecordingHotkey 
                      ? 'bg-red-500 text-white' 
                      : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                  }`}
                >
                  {isRecordingHotkey ? 'Recording...' : 'Record'}
                </button>
              </div>
            </div>
            
            {action === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Custom Command</label>
                <input
                  type="text"
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  placeholder="Enter custom command"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            )}
            
            {['mute', 'soundEffect'].includes(action) && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Target</label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Enter target (e.g., 'master', 'mic')"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            )}
          </div>
        );
        
      case 'volume':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Audio Source</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="">Select audio source</option>
                <option value="master">Master Volume</option>
                <option value="mic">Microphone</option>
                <option value="desktop">Desktop Audio</option>
                <option value="game">Game Audio</option>
                {availableAudioSources.map(source => (
                  <option key={source.name} value={source.name}>
                    {source.name}
                  </option>
                ))}
              </select>
            </div>
            
            {action === 'setVolume' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Volume Level: {Math.round((volumeValue / 127) * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="127"
                  value={volumeValue}
                  onChange={(e) => setVolumeValue(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
          </div>
        );
        
      case 'obs':
        return (
          <div className="space-y-4">
            {action === 'sceneSwitch' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">OBS Scene</label>
                <select
                  value={obsScene}
                  onChange={(e) => setObsScene(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Select scene</option>
                  {availableOBSScenes.map(scene => (
                    <option key={scene} value={scene}>{scene}</option>
                  ))}
                </select>
              </div>
            )}
            
            {action === 'sourceToggle' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">OBS Source</label>
                <select
                  value={obsSource}
                  onChange={(e) => setObsSource(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Select source</option>
                  {availableOBSSources.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
        
      case 'music':
        return (
          <div className="space-y-4">
            {action === 'moodSwap' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Target Mood</label>
                <input
                  type="text"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="Enter mood name or ID"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
            )}
          </div>
        );
        
      case 'navigation':
        return (
          <div className="space-y-4">
            {action === 'goToSubDeck' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Target Deck</label>
                <select
                  value={targetDeck}
                  onChange={(e) => setTargetDeck(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="">Select deck</option>
                  {Object.entries(availableDecks).map(([id, deck]) => (
                    <option key={id} value={id}>{deck.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  const currentButtonType = buttonTypes[buttonType];
  const ButtonTypeIcon = currentButtonType?.icon || Square;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          ref={modalRef}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <ButtonTypeIcon className={`w-6 h-6 text-${currentButtonType?.color}-400`} />
              <div>
                <h2 className="text-xl font-bold text-white">
                  Edit Button {buttonKey}
                </h2>
                <p className="text-sm text-gray-400">
                  {deck?.name} - {currentButtonType?.description}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Button Type Selection */}
            <div>
              <label className="block text-sm font-medium text-white mb-3">Button Type</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(buttonTypes).map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => setButtonType(type)}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        buttonType === type
                          ? `border-${config.color}-500 bg-${config.color}-500/20 text-${config.color}-400`
                          : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                      }`}
                    >
                      <Icon className="w-5 h-5 mx-auto mb-1" />
                      <div className="text-xs font-medium">{config.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Basic Properties */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Label</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Button label"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Color</label>
                <div className="flex space-x-2">
                  {colorOptions.map(colorOption => (
                    <button
                      key={colorOption.value}
                      onClick={() => setColor(colorOption.value)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        color === colorOption.value ? 'border-white scale-110' : 'border-gray-600'
                      } ${colorOption.class}`}
                      title={colorOption.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Action Selection */}
            {buttonType !== 'empty' && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">Action</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {actionOptions[buttonType]?.map(actionOption => {
                    const ActionIcon = actionOption.icon;
                    return (
                      <button
                        key={actionOption.value}
                        onClick={() => setAction(actionOption.value)}
                        className={`p-2 border rounded-lg text-left transition-all ${
                          action === actionOption.value
                            ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                            : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <ActionIcon className="w-4 h-4" />
                          <span className="text-sm">{actionOption.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Type-specific Options */}
            {buttonType !== 'empty' && action && renderTypeSpecificOptions()}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-700">
            <div className="flex space-x-2">
              {button && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                >
                  Delete Button
                </button>
              )}
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-gray-300 hover:bg-gray-500 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-500 text-white hover:bg-blue-600 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Button</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DashboardDeckEditor;