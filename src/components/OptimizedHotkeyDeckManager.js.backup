import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Grid, 
  Plus, 
  Settings, 
  ArrowLeft, 
  ArrowRight, 
  Trash2, 
  Edit3, 
  Save, 
  RotateCcw,
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
  FileText
} from 'lucide-react';
import configService from '../services/configService';
import globalStateService from '../services/globalStateService';
import obsWebSocketService from '../services/obsWebSocketService';

const OptimizedHotkeyDeckManager = () => {
  const [decks, setDecks] = useState({});
  const [activeDeck, setActiveDeck] = useState('main');
  const [deckStack, setDeckStack] = useState(['main']);
  const [editMode, setEditMode] = useState(false);
  const [editingButton, setEditingButton] = useState(null);
  const [showDeckSettings, setShowDeckSettings] = useState(false);
  const [showDeckManager, setShowDeckManager] = useState(false);
  const [deckToEdit, setDeckToEdit] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [obsScenes, setOBSScenes] = useState([]);
  const [obsSources, setOBSSources] = useState([]);
  const [obsConnected, setObsConnected] = useState(false);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  
  // Enhanced deck creation/edit settings
  const [deckFormData, setDeckFormData] = useState({
    name: '',
    rows: 2,
    cols: 7,
    isMainDeck: false
  });

  // Enhanced button types (removed MIDI-related features)
  const buttonTypes = [
    { value: 'hotkey', label: 'Hotkey Action', icon: Zap, color: 'blue', description: 'Music controls & custom actions' },
    { value: 'volume', label: 'Volume Control', icon: Volume2, color: 'green', description: 'Audio level controls' },
    { value: 'obs', label: 'OBS Control', icon: Monitor, color: 'orange', description: 'Scene switching & recording' },
    { value: 'music', label: 'Music Control', icon: Music, color: 'pink', description: 'Advanced music functions' },
    { value: 'navigation', label: 'Deck Navigation', icon: Layers, color: 'purple', description: 'Navigate between decks' },
    { value: 'empty', label: 'Empty', icon: Square, color: 'gray', description: 'Clear this button' }
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

  // Load OBS data and configuration on component mount
  useEffect(() => {
    initializeComponent();
    
    // Load performance settings
    const appSettings = configService.getAppSettings();
    setPerformanceMode(appSettings.performance?.memoryOptimization || false);
    
    // Listen for OBS connection changes
    const handleOBSStateChange = (state) => {
      setObsConnected(state.connected);
      if (state.connected) {
        loadOBSData();
      }
    };
    
    globalStateService.on('obsStateChanged', handleOBSStateChange);
    
    // Auto-save interval for better UX
    const autoSaveInterval = setInterval(() => {
      if (Object.keys(decks).length > 0) {
        saveDecks(false); // Silent save
      }
    }, appSettings.autoSaveInterval || 5000);

    return () => {
      globalStateService.off('obsStateChanged', handleOBSStateChange);
      clearInterval(autoSaveInterval);
      // Force save on unmount
      if (Object.keys(decks).length > 0) {
        configService.setDecks(decks);
      }
    };
  }, []);

  const initializeComponent = async () => {
    await loadDecks();
    await loadOBSData();
    
    // Listen for external deck editor requests
    const handleOpenDeckEditor = (event) => {
      const { deckId, buttonKey } = event.detail;
      if (deckId && decks[deckId]) {
        setActiveDeck(deckId);
        if (buttonKey) {
          const [row, col] = buttonKey.split('-').map(Number);
          const button = decks[deckId].buttons?.[buttonKey];
          setEditingButton({ row, col, button });
          setEditMode(true);
        }
      }
    };

    window.addEventListener('openDeckEditor', handleOpenDeckEditor);
    return () => window.removeEventListener('openDeckEditor', handleOpenDeckEditor);
  };

  const loadOBSData = async () => {
    try {
      if (obsWebSocketService.isConnected()) {
        // Load scenes
        const scenesResponse = await obsWebSocketService.obs.call('GetSceneList');
        setOBSScenes(scenesResponse.scenes || []);
        
        // Load sources  
        const sourcesResponse = await obsWebSocketService.obs.call('GetInputList');
        setOBSSources(sourcesResponse.inputs || []);
        
        console.log('OBS Data loaded:', {
          scenes: scenesResponse.scenes?.length || 0,
          sources: sourcesResponse.inputs?.length || 0
        });
      }
    } catch (error) {
      console.error('Failed to load OBS data:', error);
    }
  };

  // Enhanced deck loading with file-based storage
  const loadDecks = async () => {
    try {
      const loadedDecks = configService.getDecks();
      console.log('Loading decks from config service:', Object.keys(loadedDecks).length, 'decks');
      
      if (loadedDecks && Object.keys(loadedDecks).length > 0) {
        // Validate and clean deck structure
        const validatedDecks = {};
        Object.entries(loadedDecks).forEach(([deckId, deck]) => {
          if (deck && deck.name && deck.rows && deck.cols) {
            validatedDecks[deckId] = {
              ...deck,
              buttons: deck.buttons || {},
              id: deckId,
              updated: deck.updated || Date.now()
            };
          }
        });
        
        if (Object.keys(validatedDecks).length > 0) {
          setDecks(validatedDecks);
          console.log('HotkeyDeckManager: Loaded and validated', Object.keys(validatedDecks).length, 'decks');
          return;
        }
      }
      
      // Create default deck if none exist
      console.log('No valid decks found, creating default main deck');
      await createDefaultDecks();
      
    } catch (error) {
      console.error('HotkeyDeckManager: Failed to load decks:', error);
      await createDefaultDecks();
    }
  };

  const createDefaultDecks = async () => {
    const defaultMainDeck = {
      id: 'main',
      name: 'Main Deck',
      rows: 2,
      cols: 7,
      isMainDeck: true,
      buttons: {
        '0-0': {
          type: 'hotkey',
          action: 'playPause',
          label: 'Play/Pause',
          color: 'blue'
        },
        '0-1': {
          type: 'hotkey',
          action: 'nextSong',
          label: 'Next',
          color: 'blue'
        },
        '0-2': {
          type: 'hotkey',
          action: 'prevSong',
          label: 'Previous',
          color: 'blue'
        },
        '1-0': {
          type: 'volume',
          target: 'master',
          label: 'Master',
          color: 'green'
        },
        '1-1': {
          type: 'volume',
          target: 'mic',
          label: 'Mic',
          color: 'green'
        }
      },
      created: Date.now(),
      updated: Date.now()
    };
    
    const initialDecks = { main: defaultMainDeck };
    setDecks(initialDecks);
    await saveDecks(true, initialDecks);
  };

  const saveDecks = async (showIndicator = true, decksToSave = decks) => {
    try {
      console.log('Saving decks to config service:', Object.keys(decksToSave).length, 'decks');
      await configService.setDecks(decksToSave);
      console.log('HotkeyDeckManager: Decks saved successfully');
      
      if (showIndicator) {
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 1000);
      }
      
    } catch (error) {
      console.error('HotkeyDeckManager: Failed to save decks:', error);
      alert('Fehler beim Speichern der Hotkey-Konfiguration!');
    }
  };

  // Button execution without MIDI
  const executeButtonAction = (button) => {
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
    if (button.action === 'goToSubDeck' && button.targetDeck) {
      navigateToSubDeck(button.targetDeck);
    } else if (button.action === 'goBack') {
      navigateBack();
    } else if (button.action === 'goHome') {
      navigateHome();
    }
  };

  const executeOBSAction = async (button) => {
    if (!obsWebSocketService.isConnected()) {
      console.warn('OBS not connected, cannot execute action');
      return;
    }

    try {
      switch (button.action) {
        case 'sceneSwitch':
          if (button.obsScene || button.target) {
            await obsWebSocketService.obs.call('SetCurrentProgramScene', {
              sceneName: button.obsScene || button.target
            });
            console.log('Switched to scene:', button.obsScene || button.target);
          }
          break;
        case 'sourceToggle':
          if (button.obsSource || button.target) {
            const currentState = await obsWebSocketService.obs.call('GetSourceActive', {
              sourceName: button.obsSource || button.target
            });
            await obsWebSocketService.obs.call('SetSourceFilterEnabled', {
              sourceName: button.obsSource || button.target,
              filterName: 'Toggle',
              filterEnabled: !currentState.videoActive
            });
          }
          break;
        case 'startRecord':
          await obsWebSocketService.obs.call('StartRecord');
          break;
        case 'stopRecord':
          await obsWebSocketService.obs.call('StopRecord');
          break;
        case 'startStream':
          await obsWebSocketService.obs.call('StartStream');
          break;
        case 'stopStream':
          await obsWebSocketService.obs.call('StopStream');
          break;
      }
    } catch (error) {
      console.error('OBS action failed:', error);
    }

    // Also trigger custom event for external handling
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

  // Navigation functions
  const navigateToSubDeck = (deckId) => {
    if (decks[deckId]) {
      setDeckStack(prev => [...prev, deckId]);
      setActiveDeck(deckId);
      console.log('HotkeyDeckManager: Navigated to subdeck:', deckId);
    }
  };

  const navigateBack = () => {
    if (deckStack.length > 1) {
      const newStack = [...deckStack];
      newStack.pop();
      setDeckStack(newStack);
      setActiveDeck(newStack[newStack.length - 1]);
      console.log('HotkeyDeckManager: Navigated back to:', newStack[newStack.length - 1]);
    }
  };

  const navigateHome = () => {
    // Find first main deck or fallback to any deck
    const mainDeck = Object.values(decks).find(deck => deck.isMainDeck) || Object.values(decks)[0];
    if (mainDeck) {
      setDeckStack([mainDeck.id]);
      setActiveDeck(mainDeck.id);
      console.log('HotkeyDeckManager: Navigated home to:', mainDeck.id);
    }
  };

  // Enhanced deck creation with validation and support for multiple main decks
  const createOrUpdateDeck = async () => {
    if (!deckFormData.name.trim()) {
      alert('Bitte geben Sie einen Deck-Namen ein!');
      return;
    }

    // Validate dimensions
    if (deckFormData.rows < 1 || deckFormData.rows > 8 || deckFormData.cols < 1 || deckFormData.cols > 12) {
      alert('Ungültige Deck-Größe! Erlaubt: 1-8 Zeilen, 1-12 Spalten');
      return;
    }

    const deckId = deckFormData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    if (!deckToEdit && decks[deckId]) {
      alert('Ein Deck mit diesem Namen existiert bereits!');
      return;
    }
    
    console.log(deckToEdit ? 'Updating deck:' : 'Creating new deck:', deckId, deckFormData);
    
    const deckData = {
      id: deckId,
      name: deckFormData.name,
      rows: deckFormData.rows,
      cols: deckFormData.cols,
      isMainDeck: deckFormData.isMainDeck,
      buttons: deckToEdit ? decks[deckToEdit].buttons : {},
      created: deckToEdit ? decks[deckToEdit].created : Date.now(),
      updated: Date.now()
    };

    const updatedDecks = { ...decks };
    
    if (deckToEdit && deckToEdit !== deckId) {
      delete updatedDecks[deckToEdit];
    }
    
    updatedDecks[deckId] = deckData;

    console.log('Updated decks:', Object.keys(updatedDecks));
    
    setDecks(updatedDecks);
    await saveDecks(true, updatedDecks);
    
    // Reset form
    setDeckFormData({
      name: '',
      rows: 2,
      cols: 7,
      isMainDeck: false
    });
    
    setDeckToEdit(null);
    setShowDeckSettings(false);
    
    const action = deckToEdit ? 'aktualisiert' : 'erstellt';
    console.log(`HotkeyDeckManager: Deck ${action} successfully:`, deckData.name);
    
    // Auto-navigate to new deck
    if (!deckToEdit) {
      setActiveDeck(deckId);
      setDeckStack([deckId]);
    }
  };
  
  const openDeckEditor = (deckId = null) => {
    if (deckId && decks[deckId]) {
      const deck = decks[deckId];
      setDeckFormData({
        name: deck.name,
        rows: deck.rows,
        cols: deck.cols,
        isMainDeck: deck.isMainDeck || false
      });
      setDeckToEdit(deckId);
    } else {
      setDeckFormData({
        name: '',
        rows: 2,
        cols: 7,
        isMainDeck: false
      });
      setDeckToEdit(null);
    }
    setShowDeckSettings(true);
    setShowDeckManager(false);
  };
  
  const deleteDeck = async (deckId) => {
    const deck = decks[deckId];
    if (!deck) return;

    // Prevent deletion of the last main deck
    const mainDecks = Object.values(decks).filter(d => d.isMainDeck);
    if (deck.isMainDeck && mainDecks.length <= 1) {
      alert('Sie müssen mindestens ein Hauptdeck haben!');
      return;
    }
    
    if (confirm(`Möchten Sie das Deck "${deck.name}" wirklich löschen?\nAlle Buttons gehen verloren!`)) {
      console.log('Deleting deck:', deckId);
      
      const updatedDecks = { ...decks };
      delete updatedDecks[deckId];
      
      if (activeDeck === deckId) {
        const remainingMainDeck = Object.values(updatedDecks).find(d => d.isMainDeck);
        if (remainingMainDeck) {
          setActiveDeck(remainingMainDeck.id);
          setDeckStack([remainingMainDeck.id]);
        }
      }
      
      setDecks(updatedDecks);
      await saveDecks(true, updatedDecks);
      
      console.log('Deck deleted successfully');
    }
  };
  
  const getDeckStats = (deckId) => {
    const deck = decks[deckId];
    if (!deck) return { totalButtons: 0, configuredButtons: 0 };
    
    const buttons = Object.values(deck.buttons || {});
    const configuredButtons = buttons.filter(btn => btn.type !== 'empty').length;
    
    return {
      totalButtons: deck.rows * deck.cols,
      configuredButtons
    };
  };

  const updateButton = async (deckId, buttonKey, buttonData) => {
    console.log('Updating button:', deckId, buttonKey, buttonData);
    
    const updatedDecks = { ...decks };
    if (!updatedDecks[deckId]) {
      console.error('Deck not found:', deckId);
      return;
    }
    
    if (!updatedDecks[deckId].buttons) {
      updatedDecks[deckId].buttons = {};
    }
    
    // Enhanced button data with timestamps
    updatedDecks[deckId].buttons[buttonKey] = {
      ...buttonData,
      updated: Date.now()
    };
    
    console.log('Button updated successfully');
    
    setDecks(updatedDecks);
    await saveDecks(false, updatedDecks); // Auto-save without indicator
  };

  const handleButtonClick = (row, col, event) => {
    const buttonKey = `${row}-${col}`;
    const button = decks[activeDeck]?.buttons[buttonKey];

    if (event.detail === 1) {
      // Single click - edit mode or context menu
      if (editMode) {
        setEditingButton({ row, col, button });
      } else {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          buttonKey,
          button
        });
      }
    } else if (event.detail === 2 && !editMode) {
      // Double click - execute action
      if (button) {
        executeButtonAction(button);
      }
    }
  };

  const handleContextMenuAction = (action, buttonKey, button) => {
    switch (action) {
      case 'edit':
        const [row, col] = buttonKey.split('-').map(Number);
        const existingButton = button || {};
        const defaultData = {
          type: existingButton.type || 'hotkey',
          label: existingButton.label || '',
          action: existingButton.action || '',
          target: existingButton.target || '',
          color: existingButton.color || 'blue',
          customCommand: existingButton.customCommand || '',
          targetDeck: existingButton.targetDeck || '',
          obsScene: existingButton.obsScene || '',
          obsSource: existingButton.obsSource || '',
          ...existingButton
        };
        
        // Set default actions
        if (!defaultData.action) {
          switch (defaultData.type) {
            case 'hotkey':
              defaultData.action = 'playPause';
              break;
            case 'volume':
              defaultData.target = 'master';
              break;
            case 'music':
              defaultData.action = 'playPause';
              break;
            case 'obs':
              defaultData.action = 'sceneSwitch';
              break;
            case 'navigation':
              defaultData.action = 'goBack';
              break;
          }
        }
        
        setEditFormData(defaultData);
        setEditingButton({ row, col, button });
        setEditMode(true);
        break;
      case 'execute':
        if (button) executeButtonAction(button);
        break;
      case 'delete':
        deleteButton(buttonKey);
        break;
      case 'duplicate':
        duplicateButton(buttonKey, button);
        break;
    }
    setContextMenu(null);
  };

  const deleteButton = async (buttonKey) => {
    if (confirm('Möchten Sie diesen Button wirklich löschen?')) {
      console.log('Deleting button:', buttonKey);
      
      const updatedDecks = { ...decks };
      if (updatedDecks[activeDeck]?.buttons[buttonKey]) {
        delete updatedDecks[activeDeck].buttons[buttonKey];
        console.log('Button deleted successfully');
        
        setDecks(updatedDecks);
        await saveDecks(false, updatedDecks);
      }
    }
  };

  const duplicateButton = async (buttonKey, button) => {
    if (!button) return;
    
    // Find next empty slot
    const currentDeck = decks[activeDeck];
    let foundEmpty = false;
    
    for (let row = 0; row < currentDeck.rows && !foundEmpty; row++) {
      for (let col = 0; col < currentDeck.cols && !foundEmpty; col++) {
        const key = `${row}-${col}`;
        if (!currentDeck.buttons[key]) {
          // Duplicate button (without MIDI mapping)
          const duplicatedButton = {
            ...button,
            label: `${button.label} Copy`,
            updated: Date.now()
          };
          await updateButton(activeDeck, key, duplicatedButton);
          console.log('Button duplicated to:', key);
          foundEmpty = true;
        }
      }
    }
    
    if (!foundEmpty) {
      alert('Keine freien Button-Plätze verfügbar!');
    }
  };

  // Enhanced form data initialization - Fixed dependencies
  useEffect(() => {
    if (editingButton) {
      const existingButton = editingButton.button || {};
      const enhancedData = {
        type: existingButton.type || 'hotkey',
        label: existingButton.label || '',
        action: existingButton.action || '',
        target: existingButton.target || '',
        color: existingButton.color || 'blue',
        customCommand: existingButton.customCommand || '',
        targetDeck: existingButton.targetDeck || '',
        obsScene: existingButton.obsScene || '',
        obsSource: existingButton.obsSource || '',
        ...existingButton
      };
      
      // Auto-fill default actions based on type
      if (!enhancedData.action) {
        switch (enhancedData.type) {
          case 'hotkey':
            enhancedData.action = 'playPause';
            break;
          case 'volume':
            enhancedData.target = 'master';
            break;
          case 'music':
            enhancedData.action = 'playPause';
            break;
          case 'obs':
            enhancedData.action = 'sceneSwitch';
            break;
          case 'navigation':
            enhancedData.action = 'goBack';
            break;
        }
      }
      
      console.log('Initializing edit form with data:', enhancedData);
      setEditFormData(enhancedData);
    } else {
      console.log('Clearing edit form data');
      setEditFormData({});
    }
  }, [editingButton?.row, editingButton?.col, editingButton?.button, activeDeck]); // Fixed dependencies

  const renderButton = (row, col) => {
    const buttonKey = `${row}-${col}`;
    const button = decks[activeDeck]?.buttons[buttonKey];
    const isEditing = editingButton?.row === row && editingButton?.col === col;

    const getButtonIcon = (button) => {
      if (!button) return Square;
      
      switch (button.type) {
        case 'hotkey': return Zap;
        case 'volume': return Volume2;
        case 'navigation': 
          if (button.action === 'goBack') return ArrowLeft;
          if (button.action === 'goHome') return Home;
          return Layers;
        case 'obs': return Monitor;
        case 'music': return Music;
        default: return Square;
      }
    };

    const getButtonColor = (button) => {
      if (!button) return 'gray';
      
      const typeInfo = buttonTypes.find(t => t.value === button.type);
      return typeInfo?.color || 'gray';
    };
    
    const getButtonColorClasses = (button) => {
      if (!button) return {
        border: 'border-gray-600',
        bg: 'bg-gray-800',
        hoverBg: 'hover:bg-gray-700',
        text: 'text-gray-500'
      };
      
      const color = getButtonColor(button);
      
      const colorMap = {
        blue: {
          border: 'border-blue-500/50',
          bg: 'bg-blue-500/10',
          hoverBg: 'hover:bg-blue-500/20',
          text: 'text-blue-400'
        },
        green: {
          border: 'border-green-500/50',
          bg: 'bg-green-500/10',
          hoverBg: 'hover:bg-green-500/20',
          text: 'text-green-400'
        },
        purple: {
          border: 'border-purple-500/50',
          bg: 'bg-purple-500/10',
          hoverBg: 'hover:bg-purple-500/20',
          text: 'text-purple-400'
        },
        orange: {
          border: 'border-orange-500/50',
          bg: 'bg-orange-500/10',
          hoverBg: 'hover:bg-orange-500/20',
          text: 'text-orange-400'
        },
        pink: {
          border: 'border-pink-500/50',
          bg: 'bg-pink-500/10',
          hoverBg: 'hover:bg-pink-500/20',
          text: 'text-pink-400'
        },
        gray: {
          border: 'border-gray-600',
          bg: 'bg-gray-800',
          hoverBg: 'hover:bg-gray-700',
          text: 'text-gray-500'
        }
      };
      
      return colorMap[color] || colorMap.gray;
    };

    const Icon = getButtonIcon(button);
    const colorClasses = getButtonColorClasses(button);

    return (
      <motion.div
        key={buttonKey}
        layout={!performanceMode}
        whileHover={!performanceMode ? { scale: 1.05 } : {}}
        whileTap={!performanceMode ? { scale: 0.95 } : {}}
        className={`
          relative aspect-square border-2 rounded-lg cursor-pointer
          transition-all duration-200 flex flex-col items-center justify-center p-2
          ${isEditing ? 'border-blue-500 bg-blue-500/20 ring-2 ring-blue-500/30' : 
            button ? `${colorClasses.border} ${colorClasses.bg} ${colorClasses.hoverBg}` :
            'border-gray-600 bg-gray-800 hover:bg-gray-700'}
          ${editMode ? 'hover:border-yellow-400 hover:shadow-lg' : ''}
        `}
        onClick={(e) => handleButtonClick(row, col, e)}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <Icon className={`w-6 h-6 ${button ? colorClasses.text : 'text-gray-500'}`} />
        
        {button && (
          <div className="text-center mt-1">
            <div className="text-xs font-medium text-white truncate">
              {button.label || 'Unnamed'}
            </div>
            {button.obsScene && (
              <div className="text-xs text-orange-400 mt-0.5 truncate">
                {button.obsScene}
              </div>
            )}
          </div>
        )}

        {editMode && !isEditing && (
          <div className="absolute top-1 right-1">
            <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-lg"></div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderDeckGrid = () => {
    const currentDeck = decks[activeDeck];
    if (!currentDeck) return null;

    const buttons = [];
    for (let row = 0; row < currentDeck.rows; row++) {
      for (let col = 0; col < currentDeck.cols; col++) {
        buttons.push(renderButton(row, col));
      }
    }

    return (
      <div 
        className="grid gap-2 p-4"
        style={{ 
          gridTemplateColumns: `repeat(${currentDeck.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${currentDeck.rows}, minmax(0, 1fr))`
        }}
      >
        {buttons}
      </div>
    );
  };

  const renderEditModal = () => {
    if (!editingButton) return null;

    const buttonKey = `${editingButton.row}-${editingButton.col}`;
    const formData = editFormData;

    const saveButton = async () => {
      if (formData.type === 'empty') {
        await deleteButton(buttonKey);
        setEditingButton(null);
        setEditFormData({});
        return;
      }
      
      // Enhanced validation
      if (!formData.label || formData.label.trim() === '') {
        alert('Bitte geben Sie ein Label für den Button ein!');
        return;
      }
      
      // Validate OBS-specific fields
      if (formData.type === 'obs' && formData.action === 'sceneSwitch' && !formData.obsScene) {
        alert('Bitte wählen Sie eine OBS-Szene aus!');
        return;
      }
      
      try {
        await updateButton(activeDeck, buttonKey, formData);
        console.log('Button saved successfully:', formData);
        setEditingButton(null);
        setEditFormData({});
      } catch (error) {
        console.error('Failed to save button:', error);
        alert('Fehler beim Speichern des Buttons!');
      }
    };
    
    const setFormData = (updater) => {
      if (typeof updater === 'function') {
        setEditFormData(prev => updater(prev));
      } else {
        setEditFormData(updater);
      }
    };

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
          className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">
              Edit Button ({editingButton.row + 1}, {editingButton.col + 1})
            </h3>
            <button
              onClick={() => {
                setEditingButton(null);
                setEditFormData({});
              }}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>

          <div className="space-y-4">
            {/* Button Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Button Type</label>
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

            {/* Label */}
            {formData.type !== 'empty' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Label *</label>
                <input
                  type="text"
                  value={formData.label || ''}
                  onChange={(e) => {
                    const newLabel = e.target.value;
                    console.log('Label changed to:', newLabel);
                    setFormData(prev => ({ ...prev, label: newLabel }));
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
                  placeholder="Button label"
                  autoComplete="off"
                />
              </div>
            )}

            {/* Type-specific configurations */}
            {formData.type === 'hotkey' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Hotkey Action</label>
                <select
                  value={formData.action || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
                >
                  {hotkeyActions.map(action => (
                    <option key={action.value} value={action.value}>
                      {action.icon} {action.label}
                    </option>
                  ))}
                </select>
                
                {formData.action === 'custom' && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Custom Command</label>
                    <input
                      type="text"
                      value={formData.customCommand || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, customCommand: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
                      placeholder="Enter custom command"
                    />
                  </div>
                )}
              </div>
            )}
            
            {formData.type === 'volume' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Volume Target</label>
                <select
                  value={formData.target || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, target: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
                >
                  {volumeTargets.map(target => (
                    <option key={target.value} value={target.value}>
                      {target.icon} {target.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {formData.type === 'obs' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">OBS Action</label>
                  <select
                    value={formData.action || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
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
                      OBS Scene {obsConnected ? `(${obsScenes.length} verfügbar)` : '(OBS nicht verbunden)'}
                    </label>
                    {obsConnected && obsScenes.length > 0 ? (
                      <select
                        value={formData.obsScene || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, obsScene: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
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
                        value={formData.obsScene || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, obsScene: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
                        placeholder="Enter scene name manually"
                      />
                    )}
                  </div>
                )}
                
                {formData.action === 'sourceToggle' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      OBS Source {obsConnected ? `(${obsSources.length} verfügbar)` : '(OBS nicht verbunden)'}
                    </label>
                    {obsConnected && obsSources.length > 0 ? (
                      <select
                        value={formData.obsSource || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, obsSource: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">Select source...</option>
                        {obsSources.map(source => (
                          <option key={source.inputName} value={source.inputName}>
                            {source.inputName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formData.obsSource || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, obsSource: e.target.value }))}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
                        placeholder="Enter source name manually"
                      />
                    )}
                  </div>
                )}
                
                {!obsConnected && (
                  <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded">
                    <div className="text-xs text-orange-400">
                      ⚠️ OBS ist nicht verbunden. Szenen und Quellen können nicht automatisch geladen werden.
                    </div>
                  </div>
                )}
              </div>
            )}

            {formData.type === 'music' && (
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Music Action</label>
                <select
                  value={formData.action || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
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
                <label className="block text-sm font-medium text-gray-400 mb-2">Navigation Action</label>
                <select
                  value={formData.action || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, action: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="goBack">🔙 Go Back</option>
                  <option value="goHome">🏠 Go Home</option>
                  <option value="goToSubDeck">📂 Go to SubDeck</option>
                </select>
                
                {formData.action === 'goToSubDeck' && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-400 mb-2">Target Deck</label>
                    <select
                      value={formData.targetDeck || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, targetDeck: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select deck...</option>
                      {Object.entries(decks).map(([deckId, deck]) => (
                        <option key={deckId} value={deckId}>
                          {deck.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={saveButton}
              className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded font-medium transition-colors"
            >
              💾 Save
            </button>
            <button
              onClick={() => {
                setEditingButton(null);
                setEditFormData({});
              }}
              className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 rounded font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-2 min-w-[160px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onMouseLeave={() => setContextMenu(null)}
      >
        <button
          onClick={() => handleContextMenuAction('edit', contextMenu.buttonKey, contextMenu.button)}
          className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
        >
          <Edit3 className="w-4 h-4" />
          <span>Edit</span>
        </button>
        
        {contextMenu.button && (
          <button
            onClick={() => handleContextMenuAction('execute', contextMenu.buttonKey, contextMenu.button)}
            className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
          >
            <Play className="w-4 h-4" />
            <span>Execute</span>
          </button>
        )}
        
        {contextMenu.button && (
          <button
            onClick={() => handleContextMenuAction('duplicate', contextMenu.buttonKey, contextMenu.button)}
            className="w-full px-4 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
          >
            <Copy className="w-4 h-4" />
            <span>Duplicate</span>
          </button>
        )}
        
        {contextMenu.button && (
          <button
            onClick={() => handleContextMenuAction('delete', contextMenu.buttonKey, contextMenu.button)}
            className="w-full px-4 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>
        )}
      </motion.div>
    );
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center space-x-3">
          <Grid className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Hotkey Decks</h3>
          
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
          
          {/* Breadcrumb Navigation */}
          <div className="flex items-center space-x-2 ml-4">
            {deckStack.map((deckId, index) => (
              <React.Fragment key={deckId}>
                {index > 0 && <ChevronRight className="w-4 h-4 text-gray-500" />}
                <button
                  onClick={() => {
                    const newStack = deckStack.slice(0, index + 1);
                    setDeckStack(newStack);
                    setActiveDeck(deckId);
                  }}
                  className={`text-sm px-2 py-1 rounded transition-colors ${
                    index === deckStack.length - 1 
                      ? 'text-purple-400 bg-purple-500/20' 
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {decks[deckId]?.name || deckId}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Connection indicators */}
          <div className="flex items-center space-x-2">
            {obsConnected ? (
              <div className="flex items-center space-x-1 text-orange-400 text-xs">
                <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                <span>OBS</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-gray-500 text-xs">
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                <span>OBS</span>
              </div>
            )}
            
            {performanceMode && (
              <div className="flex items-center space-x-1 text-yellow-400 text-xs">
                <span>⚡</span>
              </div>
            )}
          </div>
          
          {/* Actions */}
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
            onClick={() => setShowDeckManager(!showDeckManager)}
            className="p-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg transition-colors"
            title="Deck manager"
          >
            <Grid className="w-4 h-4" />
          </button>
          
          <button
            onClick={() => openDeckEditor()}
            className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
            title="Create new deck"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center space-x-4 text-sm">
          <span className="text-gray-400">
            Current: <span className="text-white font-medium">{decks[activeDeck]?.name || 'Unknown'}</span>
          </span>
          <span className="text-gray-400">
            Size: <span className="text-white">
              {decks[activeDeck]?.rows || 0} × {decks[activeDeck]?.cols || 0}
            </span>
          </span>
          <span className="text-gray-400">
            Configured: <span className="text-purple-400">
              {getDeckStats(activeDeck).configuredButtons}/{getDeckStats(activeDeck).totalButtons}
            </span>
          </span>
          {editMode && (
            <span className="text-yellow-400 font-medium">✏️ Edit Mode</span>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {obsConnected && (
            <div className="text-xs text-orange-400">
              OBS: {obsScenes.length} scenes, {obsSources.length} sources
            </div>
          )}
          <div className="text-xs text-gray-400">
            File-based Storage
          </div>
        </div>
      </div>

      {/* Deck Grid */}
      <div className="min-h-64 bg-gray-900">
        {renderDeckGrid()}
      </div>

      {/* Deck Manager Panel */}
      <AnimatePresence>
        {showDeckManager && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-gray-700 p-4 bg-gray-800"
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">Deck Management</h4>
              <button
                onClick={() => setShowDeckManager(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {Object.entries(decks).map(([deckId, deck]) => {
                const stats = getDeckStats(deckId);
                const isActive = deckId === activeDeck;
                
                return (
                  <motion.div
                    key={deckId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-lg border transition-all ${
                      isActive 
                        ? 'border-purple-500 bg-purple-500/10' 
                        : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h5 className={`font-medium ${
                            isActive ? 'text-purple-300' : 'text-white'
                          }`}>
                            {deck.name}
                          </h5>
                          {deck.isMainDeck && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                              Main
                            </span>
                          )}
                          {isActive && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                              Active
                            </span>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-400">
                          <span>Size: {deck.rows}×{deck.cols}</span>
                          <span>Buttons: {stats.configuredButtons}/{stats.totalButtons}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {!isActive && (
                          <button
                            onClick={() => {
                              setActiveDeck(deckId);
                              setDeckStack([deckId]);
                              setShowDeckManager(false);
                            }}
                            className="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
                            title="Switch to deck"
                          >
                            <Target className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => openDeckEditor(deckId)}
                          className="p-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded transition-colors"
                          title="Edit deck"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => deleteDeck(deckId)}
                          className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                          title="Delete deck"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-600">
              <button
                onClick={() => openDeckEditor()}
                className="w-full p-3 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg border border-green-500/30 flex items-center justify-center space-x-2 font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Deck</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Deck Editor Modal */}
      <AnimatePresence>
        {showDeckSettings && (
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
              className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <span>{deckToEdit ? 'Edit Deck' : 'Create New Deck'}</span>
                </h3>
                <button
                  onClick={() => {
                    setShowDeckSettings(false);
                    setDeckToEdit(null);
                    setDeckFormData({
                      name: '',
                      rows: 2,
                      cols: 7,
                      isMainDeck: false
                    });
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>

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
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={deckFormData.isMainDeck}
                      onChange={(e) => setDeckFormData(prev => ({ ...prev, isMainDeck: e.target.checked }))}
                      className="rounded border-gray-500"
                    />
                    <span className="text-sm text-white">Main Deck</span>
                  </label>
                  <div className="text-xs text-gray-500 mt-1">
                    Main decks appear in navigation and can be used as starting points
                  </div>
                </div>
                
                {/* Enhanced Preview */}
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
                      <span className="text-gray-400">Type:</span>
                      <span className={deckFormData.isMainDeck ? 'text-blue-400' : 'text-gray-400'}>
                        {deckFormData.isMainDeck ? '🏠 Main Deck' : '📂 Regular Deck'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={createOrUpdateDeck}
                  disabled={!deckFormData.name.trim()}
                  className="flex-1 px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {deckToEdit ? '💾 Update Deck' : '✨ Create Deck'}
                </button>
                <button
                  onClick={() => {
                    setShowDeckSettings(false);
                    setDeckToEdit(null);
                    setDeckFormData({
                      name: '',
                      rows: 2,
                      cols: 7,
                      isMainDeck: false
                    });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 rounded font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals and Overlays */}
      <AnimatePresence>
        {editingButton && renderEditModal()}
        {contextMenu && renderContextMenu()}
      </AnimatePresence>

      {/* Enhanced Instructions */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <div className="text-xs text-gray-400 space-y-1">
          <div className="flex items-center space-x-4">
            <span><strong>Single click:</strong> Context menu</span>
            <span><strong>Double click:</strong> Execute action</span>
            <span><strong>Edit Mode:</strong> Configure buttons</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>🟡 Edit mode</span>
            <span>🟠 OBS connected</span>
            <span>🟣 Active deck</span>
            <span>⚡ Performance mode</span>
          </div>
          <div><strong>MIDI-Free:</strong> Optimized for direct control and audio mixer integration</div>
        </div>
      </div>
    </div>
  );
};

export default OptimizedHotkeyDeckManager;
