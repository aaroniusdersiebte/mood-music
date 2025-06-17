import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Grid, 
  Plus, 
  Settings, 
  Edit3, 
  Save, 
  Play,
  Square,
  Volume2,
  Zap,
  Layers,
  Monitor,
  Music,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Home,
  Target,
  Check,
  X,
  Copy,
  Sparkles,
  Trash2,
  Keyboard,
  Mouse,
  Gamepad2
} from 'lucide-react';
import configService from '../../services/configService';
import globalStateService from '../../services/globalStateService';
import HotkeyDeckRenderer from './HotkeyDeckRenderer';
import HotkeyDeckEditor from './HotkeyDeckEditor';
import HotkeyDeckSidebar from './HotkeyDeckSidebar';
import KeyboardService from '../../services/keyboardService';

const HotkeyDeckManager = () => {
  const [decks, setDecks] = useState({});
  const [activeDeck, setActiveDeck] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editingButton, setEditingButton] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedDeckCategory, setSelectedDeckCategory] = useState('all');
  const [contextMenu, setContextMenu] = useState(null);
  const [saveIndicator, setSaveIndicator] = useState(false);
  
  // Enhanced deck creation
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  const [deckFormData, setDeckFormData] = useState({
    name: '',
    description: '',
    rows: 2,
    cols: 4,
    color: 'blue',
    triggerType: 'none', // 'none', 'keyboard', 'midi', 'both'
    keyboardTrigger: '',
    midiTrigger: null,
    category: 'general'
  });

  // Keyboard Service Integration
  const [keyboardService] = useState(() => new KeyboardService());
  const [recordingHotkey, setRecordingHotkey] = useState(false);

  useEffect(() => {
    initializeComponent();
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeComponent = async () => {
    await loadDecks();
    setupKeyboardService();
    setupEventListeners();
  };

  const setupKeyboardService = () => {
    keyboardService.on('hotkeyTriggered', handleHotkeyTriggered);
    keyboardService.on('recordingStarted', () => setRecordingHotkey(true));
    keyboardService.on('recordingStopped', () => setRecordingHotkey(false));
    keyboardService.on('hotkeyRecorded', handleHotkeyRecorded);
  };

  const setupEventListeners = () => {
    // Listen for external deck requests
    const handleOpenDeckEditor = (event) => {
      const { deckId, buttonKey } = event.detail;
      if (deckId && decks[deckId]) {
        setActiveDeck(deckId);
        if (buttonKey) {
          openButtonEditor(deckId, buttonKey);
        }
      }
    };

    window.addEventListener('openDeckEditor', handleOpenDeckEditor);
    
    return () => {
      window.removeEventListener('openDeckEditor', handleOpenDeckEditor);
    };
  };

  const cleanup = () => {
    keyboardService.destroy();
    if (Object.keys(decks).length > 0) {
      configService.setDecks(decks);
    }
  };

  // Enhanced deck loading
  const loadDecks = async () => {
    try {
      const loadedDecks = configService.getDecks();
      console.log('HotkeyDeckManager: Loading decks:', Object.keys(loadedDecks).length);
      
      if (loadedDecks && Object.keys(loadedDecks).length > 0) {
        const validatedDecks = {};
        Object.entries(loadedDecks).forEach(([deckId, deck]) => {
          if (deck && deck.name && deck.rows && deck.cols) {
            validatedDecks[deckId] = {
              ...deck,
              buttons: deck.buttons || {},
              id: deckId,
              triggerType: deck.triggerType || 'none',
              keyboardTrigger: deck.keyboardTrigger || '',
              midiTrigger: deck.midiTrigger || null,
              category: deck.category || 'general',
              updated: deck.updated || Date.now()
            };
          }
        });
        
        if (Object.keys(validatedDecks).length > 0) {
          setDecks(validatedDecks);
          
          // Set first deck as active if none selected
          if (!activeDeck) {
            const firstDeckId = Object.keys(validatedDecks)[0];
            setActiveDeck(firstDeckId);
          }
          
          // Register keyboard triggers
          Object.values(validatedDecks).forEach(deck => {
            if (deck.keyboardTrigger && (deck.triggerType === 'keyboard' || deck.triggerType === 'both')) {
              keyboardService.registerHotkey(`deck_${deck.id}`, deck.keyboardTrigger);
            }
          });
          
          console.log('HotkeyDeckManager: Loaded and validated', Object.keys(validatedDecks).length, 'decks');
          return;
        }
      }
      
      console.log('HotkeyDeckManager: No valid decks found, creating default deck');
      await createDefaultDeck();
      
    } catch (error) {
      console.error('HotkeyDeckManager: Failed to load decks:', error);
      await createDefaultDeck();
    }
  };

  const createDefaultDeck = async () => {
    const defaultDeck = {
      id: 'default',
      name: 'Default Deck',
      description: 'Default hotkey deck with basic controls',
      rows: 2,
      cols: 4,
      color: 'blue',
      triggerType: 'keyboard',
      keyboardTrigger: 'ctrl+shift+d',
      midiTrigger: null,
      category: 'general',
      buttons: {
        '0-0': {
          type: 'hotkey',
          action: 'playPause',
          label: 'Play/Pause',
          icon: 'play',
          color: 'green',
          keyboardTrigger: 'space'
        },
        '0-1': {
          type: 'hotkey',
          action: 'nextSong',
          label: 'Next',
          icon: 'skip-forward',
          color: 'blue',
          keyboardTrigger: 'ctrl+right'
        },
        '0-2': {
          type: 'hotkey',
          action: 'prevSong',
          label: 'Previous',
          icon: 'skip-back',
          color: 'blue',
          keyboardTrigger: 'ctrl+left'
        },
        '0-3': {
          type: 'volume',
          target: 'master',
          label: 'Master',
          icon: 'volume-2',
          color: 'purple'
        },
        '1-0': {
          type: 'navigation',
          action: 'switchDeck',
          targetDeck: 'settings',
          label: 'Settings',
          icon: 'settings',
          color: 'gray'
        },
        '1-1': {
          type: 'volume',
          target: 'mic',
          label: 'Mic',
          icon: 'mic',
          color: 'red'
        }
      },
      created: Date.now(),
      updated: Date.now()
    };
    
    const initialDecks = { default: defaultDeck };
    setDecks(initialDecks);
    setActiveDeck('default');
    
    // Register keyboard trigger
    keyboardService.registerHotkey('deck_default', defaultDeck.keyboardTrigger);
    
    await saveDecks(true, initialDecks);
  };

  const saveDecks = async (showIndicator = true, decksToSave = decks) => {
    try {
      console.log('HotkeyDeckManager: Saving decks:', Object.keys(decksToSave).length);
      await configService.setDecks(decksToSave);
      
      if (showIndicator) {
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 1000);
      }
      
    } catch (error) {
      console.error('HotkeyDeckManager: Failed to save decks:', error);
      alert('Fehler beim Speichern der Hotkey-Konfiguration!');
    }
  };

  // Keyboard Hotkey Handlers
  const handleHotkeyTriggered = (hotkeyId) => {
    console.log('HotkeyDeckManager: Hotkey triggered:', hotkeyId);
    
    if (hotkeyId.startsWith('deck_')) {
      const deckId = hotkeyId.replace('deck_', '');
      if (decks[deckId]) {
        switchToDeck(deckId);
      }
    } else if (hotkeyId.startsWith('button_')) {
      const [_, deckId, buttonKey] = hotkeyId.split('_');
      if (decks[deckId]?.buttons[buttonKey]) {
        executeButtonAction(decks[deckId].buttons[buttonKey], deckId, buttonKey);
      }
    }
  };

  const handleHotkeyRecorded = (hotkey) => {
    console.log('HotkeyDeckManager: Hotkey recorded:', hotkey);
    if (editingButton?.isRecordingHotkey) {
      // Update button hotkey
      const updatedButton = {
        ...editingButton.data,
        keyboardTrigger: hotkey
      };
      saveButtonEdit(updatedButton);
      setEditingButton({ ...editingButton, isRecordingHotkey: false });
    } else if (showCreateDeck) {
      // Update deck hotkey
      setDeckFormData(prev => ({ ...prev, keyboardTrigger: hotkey }));
    }
  };

  // Deck Management
  const createDeck = async () => {
    if (!deckFormData.name.trim()) {
      alert('Bitte geben Sie einen Deck-Namen ein!');
      return;
    }

    const deckId = deckFormData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    if (decks[deckId]) {
      alert('Ein Deck mit diesem Namen existiert bereits!');
      return;
    }
    
    console.log('HotkeyDeckManager: Creating new deck:', deckId, deckFormData);
    
    const deckData = {
      id: deckId,
      name: deckFormData.name,
      description: deckFormData.description,
      rows: deckFormData.rows,
      cols: deckFormData.cols,
      color: deckFormData.color,
      triggerType: deckFormData.triggerType,
      keyboardTrigger: deckFormData.keyboardTrigger,
      midiTrigger: deckFormData.midiTrigger,
      category: deckFormData.category,
      buttons: {},
      created: Date.now(),
      updated: Date.now()
    };

    const updatedDecks = { ...decks, [deckId]: deckData };
    setDecks(updatedDecks);
    setActiveDeck(deckId);
    
    // Register keyboard trigger
    if (deckData.keyboardTrigger && (deckData.triggerType === 'keyboard' || deckData.triggerType === 'both')) {
      keyboardService.registerHotkey(`deck_${deckId}`, deckData.keyboardTrigger);
    }
    
    await saveDecks(true, updatedDecks);
    
    // Reset form
    setDeckFormData({
      name: '',
      description: '',
      rows: 2,
      cols: 4,
      color: 'blue',
      triggerType: 'none',
      keyboardTrigger: '',
      midiTrigger: null,
      category: 'general'
    });
    setShowCreateDeck(false);
    
    console.log('HotkeyDeckManager: Deck created successfully:', deckData.name);
  };

  const deleteDeck = async (deckId) => {
    const deck = decks[deckId];
    if (!deck) return;
    
    if (confirm(`Möchten Sie das Deck "${deck.name}" wirklich löschen?\nAlle Buttons gehen verloren!`)) {
      console.log('HotkeyDeckManager: Deleting deck:', deckId);
      
      // Unregister hotkeys
      if (deck.keyboardTrigger) {
        keyboardService.unregisterHotkey(`deck_${deckId}`);
      }
      
      Object.keys(deck.buttons).forEach(buttonKey => {
        const button = deck.buttons[buttonKey];
        if (button.keyboardTrigger) {
          keyboardService.unregisterHotkey(`button_${deckId}_${buttonKey}`);
        }
      });
      
      const updatedDecks = { ...decks };
      delete updatedDecks[deckId];
      
      // Switch to another deck if this was active
      if (activeDeck === deckId) {
        const remainingDeckIds = Object.keys(updatedDecks);
        if (remainingDeckIds.length > 0) {
          setActiveDeck(remainingDeckIds[0]);
        } else {
          setActiveDeck(null);
        }
      }
      
      setDecks(updatedDecks);
      await saveDecks(true, updatedDecks);
      
      console.log('HotkeyDeckManager: Deck deleted successfully');
    }
  };

  const switchToDeck = (deckId) => {
    if (decks[deckId]) {
      setActiveDeck(deckId);
      console.log('HotkeyDeckManager: Switched to deck:', deckId);
    }
  };

  // Button Management
  const openButtonEditor = (deckId, buttonKey) => {
    const button = decks[deckId]?.buttons[buttonKey] || {};
    setEditingButton({
      deckId,
      buttonKey,
      data: button,
      isNew: !decks[deckId]?.buttons[buttonKey],
      isRecordingHotkey: false
    });
    setEditMode(true);
  };

  const saveButtonEdit = async (buttonData) => {
    if (!editingButton) return;
    
    const { deckId, buttonKey } = editingButton;
    
    console.log('HotkeyDeckManager: Saving button:', deckId, buttonKey, buttonData);
    
    const updatedDecks = { ...decks };
    if (!updatedDecks[deckId].buttons) {
      updatedDecks[deckId].buttons = {};
    }
    
    // Unregister old hotkey if exists
    const oldButton = updatedDecks[deckId].buttons[buttonKey];
    if (oldButton?.keyboardTrigger) {
      keyboardService.unregisterHotkey(`button_${deckId}_${buttonKey}`);
    }
    
    if (buttonData.type === 'empty' || !buttonData.type) {
      delete updatedDecks[deckId].buttons[buttonKey];
    } else {
      updatedDecks[deckId].buttons[buttonKey] = {
        ...buttonData,
        updated: Date.now()
      };
      
      // Register new hotkey if exists
      if (buttonData.keyboardTrigger) {
        keyboardService.registerHotkey(`button_${deckId}_${buttonKey}`, buttonData.keyboardTrigger);
      }
    }
    
    setDecks(updatedDecks);
    await saveDecks(false, updatedDecks);
    
    setEditingButton(null);
    setEditMode(false);
  };

  const executeButtonAction = (button, deckId, buttonKey) => {
    console.log('HotkeyDeckManager: Executing button action:', button.type, button.action);

    switch (button.type) {
      case 'hotkey':
        executeHotkeyAction(button);
        break;
      case 'volume':
        executeVolumeAction(button);
        break;
      case 'navigation':
        executeNavigationAction(button);
        break;
      case 'obs':
        executeOBSAction(button);
        break;
      case 'music':
        executeMusicAction(button);
        break;
    }
  };

  const executeHotkeyAction = (button) => {
    const event = new CustomEvent('hotkeyDeckAction', {
      detail: {
        type: 'hotkey',
        action: button.action,
        target: button.target,
        customCommand: button.customCommand
      }
    });
    window.dispatchEvent(event);
    
    globalStateService.triggerCallbacks('hotkeyAction', {
      action: button.action,
      target: button.target,
      customCommand: button.customCommand
    });
  };

  const executeVolumeAction = (button) => {
    const volume = button.volumeValue || 64;
    const dbValue = ((volume / 127) * 60) - 60;
    
    globalStateService.setVolume(button.target, dbValue, 'HotkeyDeck');
  };

  const executeNavigationAction = (button) => {
    if (button.action === 'switchDeck' && button.targetDeck) {
      switchToDeck(button.targetDeck);
    }
  };

  const executeOBSAction = async (button) => {
    const event = new CustomEvent('hotkeyDeckAction', {
      detail: {
        type: 'obs',
        action: button.action,
        target: button.obsScene || button.obsSource || button.target
      }
    });
    window.dispatchEvent(event);
    
    globalStateService.triggerCallbacks('obsAction', {
      action: button.action,
      target: button.obsScene || button.obsSource || button.target
    });
  };

  const executeMusicAction = (button) => {
    const event = new CustomEvent('hotkeyDeckAction', {
      detail: {
        type: 'music',
        action: button.action,
        target: button.target
      }
    });
    window.dispatchEvent(event);
    
    globalStateService.triggerCallbacks('musicAction', {
      action: button.action,
      target: button.target
    });
  };

  // Get filtered decks by category
  const getFilteredDecks = () => {
    if (selectedDeckCategory === 'all') {
      return Object.values(decks);
    }
    return Object.values(decks).filter(deck => deck.category === selectedDeckCategory);
  };

  // Get deck categories
  const getDeckCategories = () => {
    const categories = new Set(['all']);
    Object.values(decks).forEach(deck => {
      categories.add(deck.category || 'general');
    });
    return Array.from(categories);
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden h-full flex">
      {/* Main Deck Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center space-x-3">
            <Grid className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Enhanced Hotkey Decks</h3>
            
            {/* Save Indicator */}
            <AnimatePresence>
              {saveIndicator && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center space-x-1 text-green-400 text-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Saved</span>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Active Deck Info */}
            {activeDeck && decks[activeDeck] && (
              <div className="flex items-center space-x-2 ml-4">
                <span className="text-sm text-gray-400">Active:</span>
                <span className="text-sm font-medium text-purple-300">
                  {decks[activeDeck].name}
                </span>
                {decks[activeDeck].keyboardTrigger && (
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
                    <Keyboard className="w-3 h-3 inline mr-1" />
                    {decks[activeDeck].keyboardTrigger}
                  </span>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            {recordingHotkey && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/30 rounded animate-pulse">
                <Target className="w-4 h-4" />
                <span className="text-sm">Recording Hotkey...</span>
              </div>
            )}
            
            <button
              onClick={() => setEditMode(!editMode)}
              className={`p-2 rounded-lg transition-colors ${
                editMode 
                  ? 'bg-yellow-500/20 text-yellow-400' 
                  : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
              }`}
              title="Toggle edit mode"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="p-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg transition-colors"
              title="Toggle deck sidebar"
            >
              <Layers className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => setShowCreateDeck(true)}
              className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
              title="Create new deck"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Deck Renderer */}
        {activeDeck && decks[activeDeck] ? (
          <HotkeyDeckRenderer
            deck={decks[activeDeck]}
            editMode={editMode}
            onButtonClick={openButtonEditor}
            onButtonExecute={executeButtonAction}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Grid className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No Deck Selected</p>
              <p className="text-sm">Create a new deck or select one from the sidebar</p>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {showSidebar && (
          <HotkeyDeckSidebar
            decks={getFilteredDecks()}
            categories={getDeckCategories()}
            selectedCategory={selectedDeckCategory}
            onCategoryChange={setSelectedDeckCategory}
            activeDeck={activeDeck}
            onDeckSelect={switchToDeck}
            onDeckDelete={deleteDeck}
            onCreateDeck={() => setShowCreateDeck(true)}
            onCloseSidebar={() => setShowSidebar(false)}
          />
        )}
      </AnimatePresence>

      {/* Create Deck Modal */}
      <AnimatePresence>
        {showCreateDeck && (
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
              className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <span>Create New Hotkey Deck</span>
                </h3>
                <button
                  onClick={() => setShowCreateDeck(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Settings */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Deck Name *</label>
                    <input
                      type="text"
                      value={deckFormData.name}
                      onChange={(e) => setDeckFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                      placeholder="Enter deck name"
                      autoFocus
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                    <textarea
                      value={deckFormData.description}
                      onChange={(e) => setDeckFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none resize-none"
                      placeholder="Enter description"
                      rows="2"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Rows</label>
                      <input
                        type="number"
                        min="1"
                        max="8"
                        value={deckFormData.rows}
                        onChange={(e) => setDeckFormData(prev => ({ ...prev, rows: parseInt(e.target.value) || 1 }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Columns</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={deckFormData.cols}
                        onChange={(e) => setDeckFormData(prev => ({ ...prev, cols: parseInt(e.target.value) || 1 }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Color</label>
                    <div className="grid grid-cols-4 gap-2">
                      {['blue', 'green', 'purple', 'red', 'yellow', 'pink', 'cyan', 'orange'].map(color => (
                        <button
                          key={color}
                          onClick={() => setDeckFormData(prev => ({ ...prev, color }))}
                          className={`p-2 rounded border text-xs transition-colors ${
                            deckFormData.color === color
                              ? `border-${color}-500 bg-${color}-500/20 text-${color}-400`
                              : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                    <select
                      value={deckFormData.category}
                      onChange={(e) => setDeckFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                    >
                      <option value="general">General</option>
                      <option value="music">Music</option>
                      <option value="streaming">Streaming</option>
                      <option value="games">Games</option>
                      <option value="productivity">Productivity</option>
                    </select>
                  </div>
                </div>

                {/* Trigger Settings */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Trigger Type</label>
                    <div className="space-y-2">
                      {[
                        { value: 'none', label: 'No Trigger', icon: X },
                        { value: 'keyboard', label: 'Keyboard Only', icon: Keyboard },
                        { value: 'midi', label: 'MIDI Only', icon: Music },
                        { value: 'both', label: 'Both', icon: Gamepad2 }
                      ].map(({ value, label, icon: Icon }) => (
                        <label key={value} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            value={value}
                            checked={deckFormData.triggerType === value}
                            onChange={(e) => setDeckFormData(prev => ({ ...prev, triggerType: e.target.value }))}
                            className="text-purple-500"
                          />
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-300">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {(deckFormData.triggerType === 'keyboard' || deckFormData.triggerType === 'both') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">Keyboard Trigger</label>
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={deckFormData.keyboardTrigger}
                          onChange={(e) => setDeckFormData(prev => ({ ...prev, keyboardTrigger: e.target.value }))}
                          className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-purple-500 focus:outline-none"
                          placeholder="e.g., ctrl+shift+1"
                          readOnly={recordingHotkey}
                        />
                        <button
                          onClick={() => keyboardService.startRecording()}
                          disabled={recordingHotkey}
                          className="px-3 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30 rounded transition-colors disabled:opacity-50"
                        >
                          {recordingHotkey ? 'Recording...' : 'Record'}
                        </button>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Record a hotkey or type manually (e.g., ctrl+shift+1, alt+f1)
                      </div>
                    </div>
                  )}
                  
                  {/* Preview */}
                  <div className="p-4 bg-gray-700 rounded border border-gray-600">
                    <div className="text-sm text-gray-400 mb-2 font-medium">Preview:</div>
                    <div className="text-sm text-white space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">Name:</span>
                        <span className="font-medium">{deckFormData.name || 'Unnamed Deck'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">Size:</span>
                        <span>{deckFormData.rows} × {deckFormData.cols} = <strong className="text-purple-400">{deckFormData.rows * deckFormData.cols} buttons</strong></span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">Trigger:</span>
                        <span className={`${deckFormData.triggerType !== 'none' ? 'text-green-400' : 'text-gray-400'}`}>
                          {deckFormData.triggerType === 'none' && '❌ No Trigger'}
                          {deckFormData.triggerType === 'keyboard' && `⌨️ ${deckFormData.keyboardTrigger || 'Not set'}`}
                          {deckFormData.triggerType === 'midi' && '🎹 MIDI Trigger'}
                          {deckFormData.triggerType === 'both' && `⌨️🎹 ${deckFormData.keyboardTrigger || 'Keyboard not set'}`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={createDeck}
                  disabled={!deckFormData.name.trim()}
                  className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create Deck</span>
                </button>
                
                <button
                  onClick={() => setShowCreateDeck(false)}
                  className="px-4 py-2 bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Button Editor Modal */}
      <AnimatePresence>
        {editingButton && (
          <HotkeyDeckEditor
            editingButton={editingButton}
            onSave={saveButtonEdit}
            onCancel={() => {
              setEditingButton(null);
              setEditMode(false);
            }}
            keyboardService={keyboardService}
            recordingHotkey={recordingHotkey}
          />
        )}
      </AnimatePresence>

      {/* Instructions */}
      <div className="absolute bottom-4 right-4 p-3 bg-gray-800/90 border border-gray-600 rounded-lg text-xs text-gray-400 max-w-sm">
        <div className="space-y-1">
          <div><strong>⌨️ Keyboard:</strong> Global hotkeys to switch decks</div>
          <div><strong>🖱️ Mouse:</strong> Click to execute, right-click to edit</div>
          <div><strong>✏️ Edit Mode:</strong> Click buttons to configure</div>
          <div><strong>🎯 Triggers:</strong> Each deck and button can have keyboard shortcuts</div>
        </div>
      </div>
    </div>
  );
};

export default HotkeyDeckManager;