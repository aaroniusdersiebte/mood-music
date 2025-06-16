import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, 
  VolumeX, 
  Mic, 
  Monitor, 
  Headphones, 
  Power, 
  Activity, 
  Eye, 
  EyeOff, 
  LayoutDashboard, 
  Layout,
  Plus,
  Layers,
  FolderPlus,
  Grid,
  List,
  Filter,
  Search,
  RefreshCw,
  Settings,
  Palette,
  ArrowRight,
  Check,
  X,
  Move,
  GripVertical
} from 'lucide-react';
import globalStateService from '../services/globalStateService';
import audioDeckService from '../services/audioDeckService';
import useMoodStore from '../stores/moodStore';
import AudioLevelMeter from './AudioLevelMeter';

const EnhancedAudioMixer = () => {
  const { settings } = useMoodStore();
  
  // State management
  const [audioSources, setAudioSources] = useState([]);
  const [audioLevels, setAudioLevels] = useState({});
  const [realTimeAudioLevels, setRealTimeAudioLevels] = useState({});
  const [connected, setConnected] = useState(false);
  const [midiConnected, setMidiConnected] = useState(false);
  const [lastMIDIMessage, setLastMIDIMessage] = useState(null);
  const [hiddenSources, setHiddenSources] = useState(new Set());
  const [showHiddenSources, setShowHiddenSources] = useState(false);
  const [learningMidi, setLearningMidi] = useState(null);
  const [sourceMidiMappings, setSourceMidiMappings] = useState({});
  const [draggedSlider, setDraggedSlider] = useState(null);
  
  // Enhanced features
  const [audioDecks, setAudioDecks] = useState([]);
  const [deckSourceMappings, setDeckSourceMappings] = useState(new Map());
  const [showDeckManager, setShowDeckManager] = useState(true); // Default: visible
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'unmapped', 'by-deck'
  const [searchFilter, setSearchFilter] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'type', 'deck'
  const [showCreateDeck, setShowCreateDeck] = useState(false);
  
  // Drag & Drop state
  const [draggedSource, setDraggedSource] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [sourceOrder, setSourceOrder] = useState([]);
  
  const [newDeckData, setNewDeckData] = useState({
    name: '',
    description: '',
    color: 'blue',
    orientation: 'vertical'
  });
  
  // Refs
  const searchInputRef = useRef(null);

  useEffect(() => {
    console.log('EnhancedAudioMixer: Initializing...');
    
    // Initialize services
    initializeServices();
    
    // Setup event listeners  
    setupEventListeners();
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeServices = async () => {
    try {
      // Load initial state from GlobalStateService
      const obsState = globalStateService.getOBSState();
      const midiState = globalStateService.getMIDIState();
      const audioMappings = globalStateService.getAudioSourceMappings();
      
      setConnected(obsState.connected);
      setAudioSources(obsState.sources || []);
      setAudioLevels(obsState.audioLevels || {});
      setMidiConnected(midiState.connected);
      setLastMIDIMessage(midiState.lastActivity);
      setSourceMidiMappings(audioMappings);
      
      // Load audio decks
      await loadAudioDecks();
      
      // Update real-time audio levels
      if (obsState.realTimeAudioLevels) {
        const levelsObj = {};
        if (obsState.realTimeAudioLevels instanceof Map) {
          obsState.realTimeAudioLevels.forEach((value, key) => {
            levelsObj[key] = value;
          });
        } else {
          Object.assign(levelsObj, obsState.realTimeAudioLevels);
        }
        setRealTimeAudioLevels(levelsObj);
      }
      
      console.log('EnhancedAudioMixer: Initialization completed', {
        obsConnected: obsState.connected,
        sourcesCount: obsState.sources?.length || 0,
        midiConnected: midiState.connected,
        decksCount: audioDecks.length
      });
      
    } catch (error) {
      console.error('EnhancedAudioMixer: Failed to initialize:', error);
    }
  };

  const setupEventListeners = () => {
    // Global state events
    globalStateService.on('obsStateChanged', handleOBSStateChange);
    globalStateService.on('midiStateChanged', handleMIDIStateChange);
    globalStateService.on('mappingsChanged', handleMappingsChange);
    globalStateService.on('midiLearningCompleted', handleMIDILearningCompleted);
    globalStateService.on('midiLearningStopped', handleMIDILearningStopped);
    globalStateService.on('audioLevelsUpdated', handleAudioLevelsUpdate);
    globalStateService.on('sourceVolumeUpdated', handleSourceVolumeUpdate);
    
    // Audio deck events
    audioDeckService.on('deckCreated', handleDeckCreated);
    audioDeckService.on('deckUpdated', handleDeckUpdated);
    audioDeckService.on('deckDeleted', handleDeckDeleted);
    audioDeckService.on('sourceAddedToDeck', handleSourceAddedToDeck);
    audioDeckService.on('sourceRemovedFromDeck', handleSourceRemovedFromDeck);
    audioDeckService.on('audioDecksInitialized', handleAudioDecksInitialized);
  };

  const cleanup = () => {
    // Remove global state listeners
    globalStateService.off('obsStateChanged', handleOBSStateChange);
    globalStateService.off('midiStateChanged', handleMIDIStateChange);
    globalStateService.off('mappingsChanged', handleMappingsChange);
    globalStateService.off('midiLearningCompleted', handleMIDILearningCompleted);
    globalStateService.off('midiLearningStopped', handleMIDILearningStopped);
    globalStateService.off('audioLevelsUpdated', handleAudioLevelsUpdate);
    globalStateService.off('sourceVolumeUpdated', handleSourceVolumeUpdate);
    
    // Remove audio deck listeners
    audioDeckService.off('deckCreated', handleDeckCreated);
    audioDeckService.off('deckUpdated', handleDeckUpdated);
    audioDeckService.off('deckDeleted', handleDeckDeleted);
    audioDeckService.off('sourceAddedToDeck', handleSourceAddedToDeck);
    audioDeckService.off('sourceRemovedFromDeck', handleSourceRemovedFromDeck);
    audioDeckService.off('audioDecksInitialized', handleAudioDecksInitialized);
  };

  const loadAudioDecks = async () => {
    try {
      const decks = audioDeckService.getAllDecks();
      setAudioDecks(decks);
      
      // Build deck source mappings for quick lookup
      const mappings = new Map();
      decks.forEach(deck => {
        deck.sources.forEach(sourceName => {
          mappings.set(sourceName, deck.id);
        });
      });
      setDeckSourceMappings(mappings);
      
      console.log('EnhancedAudioMixer: Loaded', decks.length, 'audio decks');
    } catch (error) {
      console.error('EnhancedAudioMixer: Failed to load audio decks:', error);
    }
  };

  // Event Handlers
  const handleOBSStateChange = useCallback((newState) => {
    setConnected(newState.connected);
    setAudioSources(newState.sources || []);
    setAudioLevels(newState.audioLevels || {});
    
    if (newState.realTimeAudioLevels) {
      const levelsObj = {};
      if (newState.realTimeAudioLevels instanceof Map) {
        newState.realTimeAudioLevels.forEach((value, key) => {
          levelsObj[key] = value;
        });
      } else {
        Object.assign(levelsObj, newState.realTimeAudioLevels);
      }
      setRealTimeAudioLevels(levelsObj);
    }
  }, []);

  const handleMIDIStateChange = useCallback((newState) => {
    setMidiConnected(newState.connected);
    setLastMIDIMessage(newState.lastActivity);
  }, []);

  const handleMappingsChange = useCallback((data) => {
    if (data.type === 'audio') {
      setSourceMidiMappings(data.mappings);
    }
  }, []);

  const handleMIDILearningCompleted = useCallback((data) => {
    if (learningMidi) {
      const { sourceName, type } = learningMidi;
      const midiKey = data.message.note.toString();
      
      // WICHTIG: Stop learning IMMEDIATELY to prevent infinite loop
      setLearningMidi(null);
      globalStateService.stopMIDILearning();
      
      setSourceMidiMappings(prev => ({
        ...prev,
        [sourceName]: {
          ...prev[sourceName],
          [type]: midiKey
        }
      }));
      
      globalStateService.setAudioSourceMapping(sourceName, type, midiKey);
      
      if (type === 'volume') {
        const mapping = {
          type: 'volume',
          target: sourceName,
          min: 0,
          max: 127
        };
        globalStateService.setMIDIMapping(midiKey, mapping, 'EnhancedAudioMixer');
      } else if (type === 'mute') {
        const mapping = {
          type: 'hotkey',
          action: 'mute',
          target: sourceName
        };
        globalStateService.setMIDIMapping(midiKey, mapping, 'EnhancedAudioMixer');
      }
      
      console.log('✅ EnhancedAudioMixer: MIDI learning completed for', sourceName, type);
    }
  }, [learningMidi]);

  const handleMIDILearningStopped = useCallback(() => {
    setLearningMidi(null);
  }, []);

  const handleAudioLevelsUpdate = useCallback((data) => {
    if (data.allLevels) {
      setRealTimeAudioLevels(data.allLevels);
    }
  }, []);

  const handleSourceVolumeUpdate = useCallback((data) => {
    if (draggedSlider !== data.sourceName) {
      setAudioSources(prevSources => 
        prevSources.map(source => 
          source.name === data.sourceName 
            ? { ...source, volumeDb: data.volumeDb, volume: data.volume }
            : source
        )
      );
    }
  }, [draggedSlider]);

  // Audio Deck Event Handlers
  const handleDeckCreated = useCallback((data) => {
    console.log('EnhancedAudioMixer: Deck created:', data.deck.name);
    setAudioDecks(prev => [...prev, data.deck]);
    loadAudioDecks(); // Refresh mappings
  }, []);

  const handleDeckUpdated = useCallback((data) => {
    console.log('EnhancedAudioMixer: Deck updated:', data.deck.name);
    setAudioDecks(prev => prev.map(deck => 
      deck.id === data.deck.id ? data.deck : deck
    ));
    loadAudioDecks(); // Refresh mappings
  }, []);

  const handleDeckDeleted = useCallback((data) => {
    console.log('EnhancedAudioMixer: Deck deleted:', data.deckId);
    setAudioDecks(prev => prev.filter(deck => deck.id !== data.deckId));
    loadAudioDecks(); // Refresh mappings
  }, []);

  const handleSourceAddedToDeck = useCallback((data) => {
    console.log('EnhancedAudioMixer: Source added to deck:', data.sourceId, 'to', data.deckId);
    loadAudioDecks(); // Refresh mappings
  }, []);

  const handleSourceRemovedFromDeck = useCallback((data) => {
    console.log('EnhancedAudioMixer: Source removed from deck:', data.sourceId, 'from', data.deckId);
    loadAudioDecks(); // Refresh mappings
  }, []);

  const handleAudioDecksInitialized = useCallback((data) => {
    console.log('EnhancedAudioMixer: Audio decks initialized');
    setAudioDecks(data.decks);
    loadAudioDecks();
  }, []);

  // Audio Controls
  const handleVolumeChange = async (sourceName, volumeDb) => {
    const success = await globalStateService.setVolume(sourceName, volumeDb, 'EnhancedAudioMixer');
    if (!success) {
      console.error('EnhancedAudioMixer: Failed to set volume');
    }
  };
  
  const handleSliderStart = useCallback((sourceName) => {
    setDraggedSlider(sourceName);
  }, []);
  
  const handleSliderEnd = useCallback(() => {
    setDraggedSlider(null);
  }, []);

  const handleMuteToggle = async (sourceName) => {
    const success = await globalStateService.toggleMute(sourceName, 'EnhancedAudioMixer');
    if (!success) {
      console.error('EnhancedAudioMixer: Failed to toggle mute');
    }
  };

  // MIDI Learning Functions
  const startMidiLearning = (sourceName, type) => {
    console.log('EnhancedAudioMixer: Starting MIDI learning for', sourceName, type);
    
    // Stop any existing learning first
    if (learningMidi) {
      globalStateService.stopMIDILearning();
    }
    
    setLearningMidi({ sourceName, type });
    
    // Add timeout to prevent infinite learning
    setTimeout(() => {
      if (learningMidi && learningMidi.sourceName === sourceName && learningMidi.type === type) {
        console.log('EnhancedAudioMixer: MIDI learning timeout');
        setLearningMidi(null);
        globalStateService.stopMIDILearning();
      }
    }, 30000);
    
    const success = globalStateService.startMIDILearning(`EnhancedAudioMixer_${sourceName}_${type}`);
    if (!success) {
      console.error('EnhancedAudioMixer: Failed to start MIDI learning');
      setLearningMidi(null);
    }
  };

  const stopMidiLearning = () => {
    console.log('EnhancedAudioMixer: Stopping MIDI learning');
    setLearningMidi(null);
    globalStateService.stopMIDILearning();
  };

  // Source Management
  const toggleSourceVisibility = (sourceName) => {
    setHiddenSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceName)) {
        newSet.delete(sourceName);
        globalStateService.setSourceHidden(sourceName, false);
      } else {
        newSet.add(sourceName);
        globalStateService.setSourceHidden(sourceName, true);
      }
      return newSet;
    });
  };

  const showAllSources = () => {
    hiddenSources.forEach(sourceName => {
      globalStateService.setSourceHidden(sourceName, false);
    });
    setHiddenSources(new Set());
  };

  const toggleSourceSelection = (sourceName) => {
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sourceName)) {
        newSet.delete(sourceName);
      } else {
        newSet.add(sourceName);
      }
      return newSet;
    });
  };

  const selectAllVisibleSources = () => {
    const visibleSources = getFilteredSources();
    setSelectedSources(new Set(visibleSources.map(s => s.name)));
  };

  const clearSelection = () => {
    setSelectedSources(new Set());
  };

  // Drag & Drop Functions for Source Reordering
  const handleDragStart = (e, source, index) => {
    console.log('EnhancedAudioMixer: Drag start:', source.name, 'at index', index);
    setDraggedSource({ source, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', source.name);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (!draggedSource || draggedSource.index === dropIndex) {
      setDraggedSource(null);
      setDragOverIndex(null);
      return;
    }
    
    console.log('EnhancedAudioMixer: Dropping source from', draggedSource.index, 'to', dropIndex);
    
    const newOrder = [...getFilteredSources()];
    const [movedSource] = newOrder.splice(draggedSource.index, 1);
    newOrder.splice(dropIndex, 0, movedSource);
    
    // Update source order
    const orderMap = [];
    newOrder.forEach((source, index) => {
      orderMap.push([source.name, index]);
    });
    
    setSourceOrder(orderMap);
    
    console.log('✅ EnhancedAudioMixer: Reordered sources:', newOrder.map(s => s.name));
    
    setDraggedSource(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedSource(null);
    setDragOverIndex(null);
  };

  // FIXED: Enhanced Deck Management
  const createNewDeck = async () => {
    try {
      console.log('🔧 EnhancedAudioMixer: Creating new deck:', newDeckData, 'with sources:', Array.from(selectedSources));
      
      if (!newDeckData.name.trim()) {
        alert('Please enter a deck name.');
        return;
      }
      
      // Wait for audioDeckService to be ready
      if (!audioDeckService.initialized) {
        console.log('EnhancedAudioMixer: Waiting for audioDeckService to initialize...');
        let attempts = 0;
        while (!audioDeckService.initialized && attempts < 50) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (!audioDeckService.initialized) {
          throw new Error('AudioDeckService failed to initialize in time');
        }
      }
      
      const selectedSourcesArray = Array.from(selectedSources);
      const deckData = {
        ...newDeckData,
        sources: selectedSourcesArray
      };
      
      console.log('EnhancedAudioMixer: Creating deck with data:', deckData);
      const newDeck = audioDeckService.createAudioDeck(deckData);
      
      if (!newDeck) {
        throw new Error('Failed to create deck - audioDeckService returned null');
      }
      
      console.log('✅ EnhancedAudioMixer: Deck created successfully:', newDeck.id, newDeck.name);
      
      // Add selected sources to the new deck if not already included
      if (selectedSourcesArray.length > 0) {
        console.log('EnhancedAudioMixer: Adding', selectedSourcesArray.length, 'sources to deck');
        let successCount = 0;
        
        for (const sourceName of selectedSourcesArray) {
          const success = audioDeckService.addSourceToDeck(sourceName, newDeck.id);
          if (success) {
            successCount++;
            console.log('EnhancedAudioMixer: ✅ Added source', sourceName, 'to deck');
          } else {
            console.warn('EnhancedAudioMixer: ❌ Failed to add source', sourceName, 'to deck');
          }
        }
        
        console.log('EnhancedAudioMixer: Added', successCount, 'of', selectedSourcesArray.length, 'sources to deck');
      }
      
      // Reset form and selection
      setNewDeckData({
        name: '',
        description: '',
        color: 'blue',
        orientation: 'vertical'
      });
      setSelectedSources(new Set());
      setShowCreateDeck(false);
      
      // Show success notification
      alert(`✅ Audio Deck "${newDeck.name}" created successfully with ${selectedSourcesArray.length} sources!`);
      
      // Trigger UI refresh
      await loadAudioDecks();
      
    } catch (error) {
      console.error('EnhancedAudioMixer: Failed to create deck:', error);
      alert(`❌ Failed to create audio deck: ${error.message}. Please try again.`);
    }
  };

  const addSelectedSourcesToDeck = (deckId) => {
    const selectedCount = selectedSources.size;
    const selectedSourcesArray = Array.from(selectedSources);
    
    console.log('EnhancedAudioMixer: Adding', selectedCount, 'sources to deck:', deckId);
    
    let successCount = 0;
    selectedSourcesArray.forEach(sourceName => {
      const success = audioDeckService.addSourceToDeck(sourceName, deckId);
      if (success) {
        successCount++;
        console.log('EnhancedAudioMixer: ✅ Added source', sourceName, 'to deck:', deckId);
      } else {
        console.error('EnhancedAudioMixer: ❌ Failed to add source', sourceName, 'to deck:', deckId);
      }
    });
    
    setSelectedSources(new Set());
    console.log('EnhancedAudioMixer: Successfully added', successCount, 'of', selectedCount, 'sources to deck:', deckId);
    
    if (successCount > 0) {
      alert(`✅ Added ${successCount} source${successCount > 1 ? 's' : ''} to deck!`);
    }
  };

  const addDeckToDashboard = (deck) => {
    try {
      console.log('EnhancedAudioMixer: Adding deck to dashboard:', deck.name, 'ID:', deck.id);
      
      // Generate unique component ID
      const componentId = `audio-deck-${deck.id}-${Date.now()}`;
      
      const eventData = { 
        id: componentId,
        deckId: deck.id,
        type: 'audio-deck',
        deckName: deck.name,
        deckColor: deck.color,
        orientation: deck.orientation || 'vertical',
        showMeters: deck.showMeters !== false,
        size: deck.size || { width: 280, height: 400 },
        position: deck.position || { x: 20, y: 20 },
        visible: true
      };
      
      const event = new CustomEvent('addAudioDeckToWidget', {
        detail: eventData
      });
      
      console.log('EnhancedAudioMixer: Dispatching addAudioDeckToWidget event with data:', eventData);
      window.dispatchEvent(event);
      
      // Switch to dashboard after a short delay
      setTimeout(() => {
        const switchToDashboard = new CustomEvent('switchToView', {
          detail: { view: 'dashboard' }
        });
        window.dispatchEvent(switchToDashboard);
        console.log('EnhancedAudioMixer: Switched to dashboard view');
      }, 200);
      
      console.log('✅ EnhancedAudioMixer: Audio deck added to dashboard successfully');
      alert(`✅ Audio Deck "${deck.name}" added to dashboard!`);
      
    } catch (error) {
      console.error('EnhancedAudioMixer: Failed to add deck to dashboard:', error);
      alert(`❌ Failed to add deck to dashboard: ${error.message}`);
    }
  };

  // Connection functions
  const connectToOBS = async () => {
    if (!settings.obsWebSocketEnabled) {
      alert('OBS WebSocket is disabled. Enable it in Settings first.');
      return;
    }
    
    try {
      const obsService = globalStateService.services.obs;
      if (obsService) {
        await obsService.connect(
          settings.obsWebSocketHost,
          settings.obsWebSocketPort,
          settings.obsWebSocketPassword
        );
      }
    } catch (error) {
      console.error('Failed to connect to OBS:', error);
      alert('Failed to connect to OBS. Please check your settings.');
    }
  };

  const refreshSources = async () => {
    if (connected) {
      try {
        const obsService = globalStateService.services.obs;
        if (obsService) {
          await obsService.discoverAudioSources();
        }
      } catch (error) {
        console.error('Failed to refresh sources:', error);
      }
    }
  };

  // Utility functions
  const getSourceIcon = (sourceKind) => {
    if (sourceKind?.includes('input') || sourceKind?.includes('mic')) {
      return <Mic className="w-4 h-4" />;
    } else if (sourceKind?.includes('output') || sourceKind?.includes('desktop')) {
      return <Monitor className="w-4 h-4" />;
    } else {
      return <Headphones className="w-4 h-4" />;
    }
  };

  const getSourceDeck = (sourceName) => {
    const deckId = deckSourceMappings.get(sourceName);
    return audioDecks.find(deck => deck.id === deckId);
  };

  const getFilteredSources = () => {
    let filtered = audioSources;
    
    // Apply search filter
    if (searchFilter) {
      filtered = filtered.filter(source => 
        source.name.toLowerCase().includes(searchFilter.toLowerCase())
      );
    }
    
    // Apply view mode filter
    switch (viewMode) {
      case 'unmapped':
        filtered = filtered.filter(source => !deckSourceMappings.has(source.name));
        break;
      case 'by-deck':
        // This would need deck selection, for now just show all
        break;
      default:
        // 'all' - no additional filtering
        break;
    }
    
    // Apply visibility filter
    filtered = filtered.filter(source => !hiddenSources.has(source.name));
    
    // Apply custom sorting with drag & drop order
    if (sourceOrder.length > 0) {
      const orderMap = new Map(sourceOrder);
      filtered.sort((a, b) => {
        const orderA = orderMap.get(a.name) ?? 999;
        const orderB = orderMap.get(b.name) ?? 999;
        return orderA - orderB;
      });
    } else {
      // Apply sorting
      switch (sortBy) {
        case 'type':
          filtered.sort((a, b) => (a.kind || '').localeCompare(b.kind || ''));
          break;
        case 'deck':
          filtered.sort((a, b) => {
            const deckA = getSourceDeck(a.name)?.name || 'No deck';
            const deckB = getSourceDeck(b.name)?.name || 'No deck';
            return deckA.localeCompare(deckB);
          });
          break;
        default:
          filtered.sort((a, b) => a.name.localeCompare(b.name));
          break;
      }
    }
    
    return filtered;
  };

  const getDeckColorClass = (color) => {
    const colorMap = {
      blue: 'text-blue-400 border-blue-500',
      green: 'text-green-400 border-green-500',
      purple: 'text-purple-400 border-purple-500',
      red: 'text-red-400 border-red-500',
      yellow: 'text-yellow-400 border-yellow-500',
      pink: 'text-pink-400 border-pink-500',
      cyan: 'text-cyan-400 border-cyan-500',
      orange: 'text-orange-400 border-orange-500'
    };
    return colorMap[color] || 'text-blue-400 border-blue-500';
  };

  // Rendering functions
  const renderSourceItem = (source, index) => {
    const isLearningVolume = learningMidi?.sourceName === source.name && learningMidi?.type === 'volume';
    const isLearningMute = learningMidi?.sourceName === source.name && learningMidi?.type === 'mute';
    const volumeMapping = sourceMidiMappings[source.name]?.volume;
    const muteMapping = sourceMidiMappings[source.name]?.mute;
    const sourceDeck = getSourceDeck(source.name);
    const isSelected = selectedSources.has(source.name);
    const isDraggedOver = dragOverIndex === index;
    const isDragging = draggedSource?.source.name === source.name;

    const removeMidiMapping = (type) => {
      const mapping = sourceMidiMappings[source.name]?.[type];
      if (mapping) {
        globalStateService.removeMIDIMapping(mapping);
        setSourceMidiMappings(prev => ({
          ...prev,
          [source.name]: {
            ...prev[source.name],
            [type]: undefined
          }
        }));
      }
    };

    return (
      <motion.div
        key={source.name}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
        className={`bg-gray-800 border rounded-lg p-3 transition-all relative ${
          isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'
        } ${
          isDraggedOver ? 'border-green-500 bg-green-500/10 transform scale-105' : ''
        } ${
          isDragging ? 'opacity-50 transform scale-95' : ''
        }`}
        draggable={true}
        onDragStart={(e) => handleDragStart(e, source, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index)}
        onDragEnd={handleDragEnd}
      >
        {/* Drop indicator */}
        {isDraggedOver && (
          <div className="absolute -top-1 left-0 right-0 h-1 bg-green-500 rounded-full"></div>
        )}
        
        <div className="flex items-start space-x-3">
          {/* Drag Handle & Selection */}
          <div className="flex items-center space-x-2 mt-1">
            <div className="p-1 text-gray-500 hover:text-white cursor-move" title="Drag to reorder">
              <GripVertical className="w-4 h-4" />
            </div>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSourceSelection(source.name)}
              className="rounded border-gray-500"
            />
          </div>

          {/* Source Info & Controls */}
          <div className="flex-1 min-w-0">
            {/* Source Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                {getSourceIcon(source.kind)}
                <span className="text-sm font-medium text-white truncate">
                  {source.name}
                </span>
                
                {/* Deck Assignment Indicator */}
                {sourceDeck && (
                  <span className={`px-2 py-1 text-xs rounded-full border ${getDeckColorClass(sourceDeck.color)}`}>
                    {sourceDeck.name}
                  </span>
                )}
                
                {/* MIDI Learning Indicator */}
                {(learningMidi?.sourceName === source.name) && (
                  <div className="px-2 py-1 bg-blue-500 text-white text-xs rounded animate-pulse">
                    Learning MIDI...
                  </div>
                )}
              </div>

              {/* Source Actions */}
              <div className="flex items-center space-x-1">
                {/* Visibility Toggle */}
                <button
                  onClick={() => toggleSourceVisibility(source.name)}
                  className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                  title="Hide this source"
                >
                  <EyeOff className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Volume Control Row */}
            <div className="flex items-center space-x-3">
              {/* Mute Button with MIDI Learning */}
              <div className="flex flex-col items-center space-y-1">
                <button
                  onClick={() => handleMuteToggle(source.name)}
                  className={`p-2 rounded-lg transition-colors ${
                    source.muted 
                      ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                      : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                  }`}
                >
                  {source.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => isLearningMute ? stopMidiLearning() : startMidiLearning(source.name, 'mute')}
                    className={`px-1 py-0.5 text-xs rounded transition-colors ${
                      isLearningMute 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : muteMapping
                          ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                          : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                    }`}
                  >
                    {isLearningMute ? 'Cancel' : muteMapping ? `CC${muteMapping}` : 'Learn'}
                  </button>
                  
                  {muteMapping && !isLearningMute && (
                    <button
                      onClick={() => removeMidiMapping('mute')}
                      className="px-1 py-0.5 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              
              {/* Volume Slider with MIDI Learning */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs text-gray-400">
                    {source.volumeDb?.toFixed(1) || '-60.0'} dB
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => isLearningVolume ? stopMidiLearning() : startMidiLearning(source.name, 'volume')}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        isLearningVolume 
                          ? 'bg-red-500 text-white animate-pulse' 
                          : volumeMapping
                            ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30'
                            : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                      }`}
                    >
                      {isLearningVolume ? 'Cancel' : volumeMapping ? `CC${volumeMapping}` : 'Learn Vol'}
                    </button>
                    
                    {volumeMapping && !isLearningVolume && (
                      <button
                        onClick={() => removeMidiMapping('volume')}
                        className="px-1 py-0.5 text-xs rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                
                <input
                  type="range"
                  min="-60"
                  max="0"
                  step="0.1"
                  value={source.volumeDb || -60}
                  onChange={(e) => handleVolumeChange(source.name, parseFloat(e.target.value))}
                  onMouseDown={() => handleSliderStart(source.name)}
                  onMouseUp={handleSliderEnd}
                  onTouchStart={() => handleSliderStart(source.name)}
                  onTouchEnd={handleSliderEnd}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>

              {/* Audio Level Meter - FIXED */}
              <div className="flex items-center space-x-2">
                <AudioLevelMeter
                  inputName={source.name}
                  audioLevel={realTimeAudioLevels[source.name]}
                  isActive={connected}
                  width={120}
                  height={24}
                  style="horizontal"
                />
              </div>
            </div>

            {/* Deck Assignment Actions */}
            {selectedSources.size > 0 && showBulkActions && selectedSources.has(source.name) && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="text-xs text-gray-400 mb-2">Add to Audio Deck:</div>
                <div className="flex flex-wrap gap-1">
                  {audioDecks.map(deck => (
                    <button
                      key={deck.id}
                      onClick={() => addSelectedSourcesToDeck(deck.id)}
                      className={`px-2 py-1 text-xs rounded border transition-colors ${getDeckColorClass(deck.color)}`}
                    >
                      {deck.name}
                    </button>
                  ))}
                  <button
                    onClick={() => setShowCreateDeck(true)}
                    className="px-2 py-1 text-xs rounded border border-green-500 text-green-400 hover:bg-green-500/20 transition-colors"
                  >
                    <Plus className="w-3 h-3 inline mr-1" />
                    New Deck
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderFiltersAndControls = () => (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
      {/* Search and Filters */}
      <div className="flex items-center space-x-4 mb-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search audio sources..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* View Mode */}
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          <option value="all">All Sources</option>
          <option value="unmapped">Unmapped Only</option>
          <option value="by-deck">By Deck</option>
        </select>

        {/* Sort By */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
        >
          <option value="name">Sort by Name</option>
          <option value="type">Sort by Type</option>
          <option value="deck">Sort by Deck</option>
        </select>
      </div>

      {/* Selection Controls */}
      {selectedSources.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center space-x-3">
            <span className="text-blue-400 font-medium">
              {selectedSources.size} source{selectedSources.size > 1 ? 's' : ''} selected
            </span>
            
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-sm transition-colors"
            >
              {showBulkActions ? 'Hide' : 'Show'} Deck Actions
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={selectAllVisibleSources}
              className="px-3 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded text-sm transition-colors"
            >
              Select All Visible
            </button>
            
            <button
              onClick={clearSelection}
              className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm transition-colors"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      {selectedSources.size > 0 && showBulkActions && (
        <div className="mt-3 p-3 bg-gray-700 rounded-lg">
          <div className="text-sm font-medium text-white mb-3">Add Selected Sources to Deck:</div>
          
          <div className="flex flex-wrap gap-2">
            {audioDecks.map(deck => (
              <button
                key={deck.id}
                onClick={() => addSelectedSourcesToDeck(deck.id)}
                className={`px-3 py-2 text-sm rounded border transition-colors ${getDeckColorClass(deck.color)}`}
              >
                {deck.name} ({deck.sources.length})
              </button>
            ))}
            
            <button
              onClick={() => setShowCreateDeck(true)}
              className="px-3 py-2 text-sm rounded border border-green-500 text-green-400 hover:bg-green-500/20 transition-colors flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Deck</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderDeckManager = () => (
    <AnimatePresence>
      {showDeckManager && (
        <motion.div
          initial={{ opacity: 0, x: 300 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 300 }}
          className="fixed top-0 right-0 w-80 h-full bg-gray-800 border-l border-gray-700 z-40 overflow-y-auto"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Audio Decks ({audioDecks.length})</h3>
              <button
                onClick={() => setShowDeckManager(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Create New Deck Button */}
            <button
              onClick={() => setShowCreateDeck(true)}
              className="w-full mb-4 px-4 py-3 bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create New Audio Deck</span>
            </button>

            {/* Deck List */}
            <div className="space-y-3">
              {audioDecks.map(deck => (
                <div key={deck.id} className={`p-3 border rounded-lg ${getDeckColorClass(deck.color)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">{deck.name}</h4>
                    <span className="text-xs text-gray-400">{deck.sources.length} sources</span>
                  </div>
                  
                  {deck.description && (
                    <p className="text-xs text-gray-400 mb-2">{deck.description}</p>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => addDeckToDashboard(deck)}
                      className="px-2 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors flex items-center space-x-1"
                    >
                      <LayoutDashboard className="w-3 h-3" />
                      <span>Add to Dashboard</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {audioDecks.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No audio decks created yet</p>
                <p className="text-xs mt-1">Select sources and create your first deck</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderCreateDeckModal = () => (
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
            className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-md w-full mx-4"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Create New Audio Deck</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Deck Name *</label>
                <input
                  type="text"
                  value={newDeckData.name}
                  onChange={(e) => setNewDeckData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter deck name..."
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Description</label>
                <textarea
                  value={newDeckData.description}
                  onChange={(e) => setNewDeckData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description..."
                  rows="2"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {['blue', 'green', 'purple', 'red', 'yellow', 'pink', 'cyan', 'orange'].map(color => (
                    <button
                      key={color}
                      onClick={() => setNewDeckData(prev => ({ ...prev, color }))}
                      className={`p-2 rounded border text-xs transition-colors ${
                        newDeckData.color === color
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
                <label className="block text-sm font-medium text-white mb-2">Orientation</label>
                <select
                  value={newDeckData.orientation}
                  onChange={(e) => setNewDeckData(prev => ({ ...prev, orientation: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                >
                  <option value="vertical">Vertical (Stacked)</option>
                  <option value="horizontal">Horizontal (Side by side)</option>
                </select>
              </div>
              
              <div className="text-sm text-gray-400 p-3 bg-gray-700 rounded">
                <strong>Selected sources ({selectedSources.size}):</strong><br />
                {selectedSources.size > 0 ? (
                  <div>
                    <span className="text-green-400">{Array.from(selectedSources).slice(0, 3).join(', ')}</span>
                    {selectedSources.size > 3 && (
                      <span className="text-blue-400"> (+{selectedSources.size - 3} more)</span>
                    )}
                  </div>
                ) : (
                  <span className="text-red-400">No sources selected - select sources first, then create deck</span>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-3 mt-6">
              <button
                onClick={createNewDeck}
                disabled={!newDeckData.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Create Deck ({selectedSources.size} sources)</span>
              </button>
              
              <button
                onClick={() => setShowCreateDeck(false)}
                className="px-4 py-2 bg-gray-600 text-gray-300 rounded hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const filteredSources = getFilteredSources();

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 h-full flex overflow-hidden">
      {/* Main Audio Mixer */}
      <div className="flex-1 flex flex-col">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-white">Enhanced Audio Mixer</h3>
            <div className="flex space-x-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-400">
                {connected ? 'OBS Connected' : 'OBS Disconnected'}
              </span>
              {midiConnected && (
                <>
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-xs text-gray-400">MIDI</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex space-x-2">
            {connected && (
              <>
                <button
                  onClick={refreshSources}
                  className="p-2 text-blue-400 hover:text-blue-300 transition-colors"
                  title="Refresh audio sources"
                >
                  <Activity className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => setShowDeckManager(!showDeckManager)}
                  className={`p-2 transition-colors ${
                    showDeckManager ? 'text-purple-400' : 'text-gray-400 hover:text-purple-300'
                  }`}
                  title="Toggle Audio Deck Manager"
                >
                  <Layers className="w-4 h-4" />
                </button>
              </>
            )}
            
            {!connected && (
              <button
                onClick={connectToOBS}
                className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-colors"
                title="Connect to OBS"
              >
                <Power className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* MIDI Activity Monitor */}
        {lastMIDIMessage && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-xs text-blue-400 font-medium">MIDI Activity</span>
              <span className="text-xs text-gray-400">
                {new Date(lastMIDIMessage.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-xs text-blue-300 mt-1">
              {lastMIDIMessage.type} - CC/Note: {lastMIDIMessage.note} - Value: {lastMIDIMessage.velocity}
              {lastMIDIMessage.mock && ' (Keyboard Simulation)'}
            </div>
          </div>
        )}

        {/* Enhanced Controls and Filters */}
        {connected && renderFiltersAndControls()}

        {/* Audio Sources */}
        {connected ? (
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-3">
              {/* Drag & Drop Info */}
              {filteredSources.length > 0 && (
                <div className="p-2 bg-gray-800/50 border border-gray-600 rounded-lg">
                  <div className="flex items-center space-x-2 text-xs text-gray-400">
                    <GripVertical className="w-4 h-4" />
                    <span>🎛️ Drag sources to reorder • ✅ Select multiple sources to create decks</span>
                  </div>
                </div>
              )}
              
              {filteredSources.map((source, index) => renderSourceItem(source, index))}
              
              {/* Quick Create Deck Button */}
              {selectedSources.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="sticky bottom-0 p-3 bg-gray-800 border border-gray-600 rounded-lg shadow-lg"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white font-medium">
                      {selectedSources.size} source{selectedSources.size > 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => setShowCreateDeck(true)}
                      className="px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 rounded-lg transition-colors flex items-center space-x-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create Audio Deck</span>
                    </button>
                  </div>
                </motion.div>
              )}
              
              {/* Hidden Sources Summary */}
              {hiddenSources.size > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-gray-800/50 border border-gray-600 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-gray-400">
                      <EyeOff className="w-4 h-4" />
                      <span className="text-sm">
                        {hiddenSources.size} source{hiddenSources.size > 1 ? 's' : ''} hidden
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowHiddenSources(!showHiddenSources)}
                        className="px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors"
                      >
                        {showHiddenSources ? 'Hide' : 'Show'} Hidden
                      </button>
                      <button
                        onClick={showAllSources}
                        className="px-3 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded text-xs transition-colors"
                      >
                        Show All
                      </button>
                    </div>
                  </div>
                  
                  {/* Hidden Sources List */}
                  <AnimatePresence>
                    {showHiddenSources && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-2"
                      >
                        {Array.from(hiddenSources).map(sourceName => {
                          const source = audioSources.find(s => s.name === sourceName);
                          return source ? (
                            <div key={sourceName} className="flex items-center justify-between py-2 px-3 bg-gray-700/50 rounded">
                              <div className="flex items-center space-x-2">
                                {getSourceIcon(source.kind)}
                                <span className="text-sm text-gray-300">{sourceName}</span>
                              </div>
                              <button
                                onClick={() => toggleSourceVisibility(sourceName)}
                                className="p-1 text-green-400 hover:text-green-300 transition-colors"
                                title="Show this source"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            </div>
                          ) : null;
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Power className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Connect to OBS to control audio</p>
            <p className="text-xs mt-1">
              Configure OBS WebSocket in Settings first (Tools → WebSocket Server Settings in OBS)
            </p>
            {!settings.obsWebSocketEnabled && (
              <p className="text-xs mt-2 text-yellow-400">
                ⚠️ OBS WebSocket is disabled in Settings
              </p>
            )}
          </div>
        )}

        {connected && filteredSources.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Headphones className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No audio sources found</p>
            <p className="text-xs mt-1">
              {searchFilter ? 'Try adjusting your search filter' : 'Make sure OBS has audio sources configured'}
            </p>
          </div>
        )}
      </div>

      {/* Deck Manager Panel */}
      {renderDeckManager()}
      
      {/* Create Deck Modal */}
      {renderCreateDeckModal()}

      {/* Custom Styles */}
      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          border: 2px solid #064e3b;
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #10b981;
          cursor: pointer;
          border: 2px solid #064e3b;
        }
      `}</style>
    </div>
  );
};

export default EnhancedAudioMixer;
