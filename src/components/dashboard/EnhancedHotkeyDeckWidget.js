import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Grid, 
  Play, 
  Square, 
  Volume2, 
  Zap, 
  Monitor, 
  Music, 
  ArrowLeft, 
  Home, 
  Settings,
  ChevronRight,
  Eye,
  EyeOff,
  MoreHorizontal,
  Edit3,
  Layers,
  Layout,
  RefreshCw,
  Keyboard,
  Target,
  Save,
  Trash2,
  Copy
} from 'lucide-react';
import configService from '../../services/configService';
import globalStateService from '../../services/globalStateService';

const EnhancedHotkeyDeckWidget = ({ component, editMode, onUpdate, onRemove, performanceMode }) => {
  const [decks, setDecks] = useState({});
  const [activeDeck, setActiveDeck] = useState(component.deckId || 'main');
  const [deckStack, setDeckStack] = useState([component.deckId || 'main']);
  const [showDeckSelector, setShowDeckSelector] = useState(false);
  const [widgetEditMode, setWidgetEditMode] = useState(false);
  const [editingButton, setEditingButton] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [compactMode, setCompactMode] = useState(component.size?.width < 250);
  const [showHotkeyMapper, setShowHotkeyMapper] = useState(false);
  const [mappingButton, setMappingButton] = useState(null);
  const [obsData, setObsData] = useState({ scenes: [], sources: [], connected: false });
  const [lastRefresh, setLastRefresh] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const widgetRef = useRef(null);
  const obsDataCache = useRef({ scenes: [], sources: [], lastUpdate: 0, ttl: 30000 });

  // Button type styling
  const buttonTypeStyles = {
    hotkey: { color: 'blue', icon: Zap },
    volume: { color: 'green', icon: Volume2 },
    obs: { color: 'orange', icon: Monitor },
    music: { color: 'pink', icon: Music },
    navigation: { color: 'purple', icon: Layers },
    empty: { color: 'gray', icon: Square }
  };

  useEffect(() => {
    console.log('Enhanced HotkeyDeckWidget: Initializing...');
    
    // Widget registration
    globalStateService.registerDashboardWidget(
      `hotkey-deck-${component.id}`, 
      'hotkey-deck', 
      { deckId: activeDeck }
    );
    
    initializeComponent();
    setupEventListeners();
    
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    setCompactMode(component.size?.width < 250);
  }, [component.size]);

  const cleanup = () => {
    globalStateService.unregisterDashboardWidget(`hotkey-deck-${component.id}`);
    
    // Remove event listeners
    globalStateService.off('obsStateChanged', handleOBSStateChange);
    globalStateService.off('hotkeyMappingChanged', handleHotkeyMappingChanged);
    globalStateService.off('midiMappingChanged', handleMIDIMappingChanged);
  };

  const setupEventListeners = () => {
    globalStateService.on('obsStateChanged', handleOBSStateChange);
    globalStateService.on('hotkeyMappingChanged', handleHotkeyMappingChanged);
    globalStateService.on('midiMappingChanged', handleMIDIMappingChanged);
    
    // Listen for deck editor requests from dashboard
    const handleOpenDeckEditor = (event) => {
      console.log('Enhanced HotkeyDeckWidget: Received openDeckEditor event', event.detail);
      const { deckId, buttonKey } = event.detail;
      
      if (deckId === activeDeck && buttonKey) {
        const [row, col] = buttonKey.split('-').map(Number);
        const button = decks[deckId]?.buttons[buttonKey];
        setEditingButton({ row, col, button, buttonKey });
        setWidgetEditMode(true);
      }
    };
    
    const handleDeckUpdated = (event) => {
      console.log('Enhanced HotkeyDeckWidget: Deck updated event received', event.detail);
      const { deckId } = event.detail;
      
      if (deckId === activeDeck) {
        loadDecks();
      }
    };
    
    window.addEventListener('openDeckEditor', handleOpenDeckEditor);
    window.addEventListener('deckUpdated', handleDeckUpdated);
    
    return () => {
      window.removeEventListener('openDeckEditor', handleOpenDeckEditor);
      window.removeEventListener('deckUpdated', handleDeckUpdated);
    };
  };

  const initializeComponent = async () => {
    await loadDecks();
    await loadOBSDataWithCaching();
  };

  // Enhanced OBS Data Loading with Caching
  const loadOBSDataWithCaching = async () => {
    const now = Date.now();
    const cacheValid = (now - obsDataCache.current.lastUpdate) < obsDataCache.current.ttl;
    
    if (cacheValid && obsDataCache.current.scenes.length > 0) {
      console.log('Enhanced HotkeyDeckWidget: Using cached OBS data');
      setObsData({
        scenes: obsDataCache.current.scenes,
        sources: obsDataCache.current.sources,
        connected: globalStateService.isOBSConnected()
      });
      return;
    }

    if (isRefreshing) {
      console.log('Enhanced HotkeyDeckWidget: Already refreshing, skipping...');
      return;
    }

    setIsRefreshing(true);
    
    try {
      console.log('Enhanced HotkeyDeckWidget: Loading fresh OBS data...');
      
      const connected = globalStateService.isOBSConnected();
      
      if (connected) {
        // Get cached data from enhanced service
        const scenes = globalStateService.getOBSScenes();
        const sources = globalStateService.getAudioSources();
        
        // Update cache
        obsDataCache.current = {
          scenes: scenes,
          sources: sources,
          lastUpdate: now,
          ttl: 30000
        };
        
        setObsData({ scenes, sources, connected: true });
        setLastRefresh(now);
        
        console.log('Enhanced HotkeyDeckWidget: OBS data updated:', {
          scenes: scenes.length,
          sources: sources.length
        });
      } else {
        console.log('Enhanced HotkeyDeckWidget: OBS not connected');
        setObsData({ scenes: [], sources: [], connected: false });
      }
    } catch (error) {
      console.error('Enhanced HotkeyDeckWidget: Failed to load OBS data:', error);
      setObsData({ scenes: [], sources: [], connected: false });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOBSStateChange = useCallback((state) => {
    console.log('Enhanced HotkeyDeckWidget: OBS state changed');
    
    if (state.connected && (state.scenes || state.sources)) {
      const now = Date.now();
      const newData = {
        scenes: state.scenes || obsData.scenes,
        sources: state.sources || obsData.sources,
        connected: state.connected
      };
      
      // Update cache
      obsDataCache.current = {
        scenes: newData.scenes,
        sources: newData.sources,
        lastUpdate: now,
        ttl: 30000
      };
      
      setObsData(newData);
      setLastRefresh(now);
    } else {
      setObsData(prev => ({ ...prev, connected: state.connected }));
    }
  }, [obsData]);

  const handleHotkeyMappingChanged = useCallback((data) => {
    console.log('Enhanced HotkeyDeckWidget: Hotkey mapping changed:', data);
    // Refresh decks to show updated mappings
    loadDecks();
  }, []);

  const handleMIDIMappingChanged = useCallback((data) => {
    console.log('Enhanced HotkeyDeckWidget: MIDI mapping changed:', data);
    // Update button displays if they have MIDI mappings
    loadDecks();
  }, []);

  const loadDecks = () => {
    console.log('Enhanced HotkeyDeckWidget: Loading decks...');
    const loadedDecks = configService.getDecks();
    setDecks(loadedDecks);
    
    // Ensure active deck exists
    if (!loadedDecks[activeDeck]) {
      const availableDecks = Object.keys(loadedDecks);
      if (availableDecks.length > 0) {
        setActiveDeck(availableDecks[0]);
        setDeckStack([availableDecks[0]]);
        onUpdate({ deckId: availableDecks[0] });
      }
    }
    
    console.log('Enhanced HotkeyDeckWidget: Loaded', Object.keys(loadedDecks).length, 'decks');
  };

  // Enhanced Button Execution with Hotkey Support
  const executeButtonAction = useCallback((button) => {
    console.log('Enhanced HotkeyDeckWidget: Executing button action:', button.type, button.action);

    // Check for hotkey mapping
    const buttonKey = `${activeDeck}-${button.row || 0}-${button.col || 0}`;
    const hotkeyMapping = globalStateService.getAllHotkeyMappings()[buttonKey];
    
    if (hotkeyMapping) {
      console.log('Enhanced HotkeyDeckWidget: Executing with hotkey mapping:', hotkeyMapping);
      executeHotkeyMapping(hotkeyMapping);
    }

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
  }, [activeDeck]);

  const executeHotkeyMapping = (mapping) => {
    if (mapping.type === 'keyboard') {
      // Simulate keyboard shortcut
      const event = new CustomEvent('simulateKeyboard', {
        detail: { keys: mapping.keys, modifier: mapping.modifier }
      });
      window.dispatchEvent(event);
    } else if (mapping.type === 'midi') {
      // Send MIDI command
      globalStateService.setMIDIMapping(mapping.midiKey, mapping.midiData);
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
    
    globalStateService.setVolume(button.target, dbValue, 'EnhancedHotkeyDeckWidget');
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
    if (!obsData.connected) {
      console.warn('Enhanced HotkeyDeckWidget: OBS not connected, cannot execute action');
      return;
    }

    try {
      const obsService = globalStateService.services.obs;
      if (!obsService || !obsService.obs) {
        console.error('Enhanced HotkeyDeckWidget: OBS service not available');
        return;
      }

      switch (button.action) {
        case 'sceneSwitch':
          if (button.obsScene || button.target) {
            await obsService.obs.call('SetCurrentProgramScene', {
              sceneName: button.obsScene || button.target
            });
            console.log('Enhanced HotkeyDeckWidget: Switched to scene:', button.obsScene || button.target);
          }
          break;
        case 'sourceToggle':
          if (button.obsSource || button.target) {
            const currentState = await obsService.obs.call('GetSourceActive', {
              sourceName: button.obsSource || button.target
            });
            await obsService.obs.call('SetSourceFilterEnabled', {
              sourceName: button.obsSource || button.target,
              filterName: 'Toggle',
              filterEnabled: !currentState.videoActive
            });
          }
          break;
        case 'startRecord':
          await obsService.obs.call('StartRecord');
          break;
        case 'stopRecord':
          await obsService.obs.call('StopRecord');
          break;
        case 'startStream':
          await obsService.obs.call('StartStream');
          break;
        case 'stopStream':
          await obsService.obs.call('StopStream');
          break;
      }
    } catch (error) {
      console.error('Enhanced HotkeyDeckWidget: OBS action failed:', error);
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
      onUpdate({ deckId });
      console.log('Enhanced HotkeyDeckWidget: Navigated to subdeck:', deckId);
    }
  };

  const navigateBack = () => {
    if (deckStack.length > 1) {
      const newStack = [...deckStack];
      newStack.pop();
      setDeckStack(newStack);
      setActiveDeck(newStack[newStack.length - 1]);
      onUpdate({ deckId: newStack[newStack.length - 1] });
      console.log('Enhanced HotkeyDeckWidget: Navigated back to:', newStack[newStack.length - 1]);
    }
  };

  const navigateHome = () => {
    const mainDeck = Object.values(decks).find(deck => deck.isMainDeck) || Object.values(decks)[0];
    if (mainDeck) {
      setDeckStack([mainDeck.id]);
      setActiveDeck(mainDeck.id);
      onUpdate({ deckId: mainDeck.id });
      console.log('Enhanced HotkeyDeckWidget: Navigated home to:', mainDeck.id);
    }
  };

  const switchToDeck = (deckId) => {
    if (decks[deckId]) {
      setActiveDeck(deckId);
      setDeckStack([deckId]);
      setShowDeckSelector(false);
      onUpdate({ deckId });
    }
  };

  const handleButtonClick = (row, col, button) => {
    const buttonKey = `${row}-${col}`;
    
    console.log('Enhanced HotkeyDeckWidget: Button clicked:', { row, col, button, widgetEditMode });
    
    if (widgetEditMode) {
      // Open edit mode for this button
      setEditingButton({ row, col, button, buttonKey });
      
      // Trigger the full deck editor
      console.log('Enhanced HotkeyDeckWidget: Opening deck editor for button:', buttonKey);
      const event = new CustomEvent('openDeckEditor', {
        detail: { deckId: activeDeck, buttonKey }
      });
      window.dispatchEvent(event);
    } else if (button) {
      console.log('Enhanced HotkeyDeckWidget: Executing button action:', button.type, button.action);
      executeButtonAction({ ...button, row, col });
    } else {
      console.log('Enhanced HotkeyDeckWidget: Empty button clicked - no action');
    }
  };

  const handleButtonContextMenu = (e, row, col, button) => {
    if (!editMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any existing dashboard context menu
    globalStateService.clearActiveContextMenu();
    
    const menuData = {
      x: e.clientX,
      y: e.clientY,
      buttonKey: `${row}-${col}`,
      button,
      timestamp: Date.now()
    };
    
    setContextMenu(menuData);
    globalStateService.setActiveContextMenu('hotkeyDeckButton', menuData);
    
    console.log('Enhanced HotkeyDeckWidget: Button context menu:', `${row}-${col}`);
  };

  // Hotkey Mapping Functions
  const openHotkeyMapper = (button, row, col) => {
    setMappingButton({ ...button, row, col, buttonKey: `${row}-${col}` });
    setShowHotkeyMapper(true);
  };

  const saveHotkeyMapping = (mappingData) => {
    if (!mappingButton) return;
    
    const buttonKey = `${activeDeck}-${mappingButton.row}-${mappingButton.col}`;
    globalStateService.setHotkeyMapping(buttonKey, {
      type: mappingData.type,
      keys: mappingData.keys,
      modifier: mappingData.modifier,
      midiKey: mappingData.midiKey,
      midiData: mappingData.midiData,
      buttonData: mappingButton,
      created: Date.now()
    });
    
    setShowHotkeyMapper(false);
    setMappingButton(null);
    
    console.log('Enhanced HotkeyDeckWidget: Hotkey mapping saved:', buttonKey, mappingData);
  };

  const removeHotkeyMapping = () => {
    if (!mappingButton) return;
    
    const buttonKey = `${activeDeck}-${mappingButton.row}-${mappingButton.col}`;
    globalStateService.removeHotkeyMapping(buttonKey);
    
    setShowHotkeyMapper(false);
    setMappingButton(null);
  };

  // Event handling for click outside to close menus
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target)) {
        setContextMenu(null);
        setShowDeckSelector(false);
        setShowHotkeyMapper(false);
        globalStateService.clearActiveContextMenu();
      }
    };

    if (contextMenu || showDeckSelector || showHotkeyMapper) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu, showDeckSelector, showHotkeyMapper]);

  const renderButton = (row, col) => {
    const currentDeck = decks[activeDeck];
    if (!currentDeck) return null;

    const buttonKey = `${row}-${col}`;
    const button = currentDeck.buttons?.[buttonKey];
    const typeStyle = buttonTypeStyles[button?.type] || buttonTypeStyles.empty;
    const Icon = typeStyle.icon;

    // Check for hotkey mapping
    const hotkeyMappingKey = `${activeDeck}-${row}-${col}`;
    const hasHotkeyMapping = globalStateService.getAllHotkeyMappings()[hotkeyMappingKey];

    const getColorClasses = (color) => {
      const colorMap = {
        blue: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
        green: 'border-green-500/50 bg-green-500/10 text-green-400',
        purple: 'border-purple-500/50 bg-purple-500/10 text-purple-400',
        orange: 'border-orange-500/50 bg-orange-500/10 text-orange-400',
        pink: 'border-pink-500/50 bg-pink-500/10 text-pink-400',
        gray: 'border-gray-600 bg-gray-800 text-gray-500'
      };
      return colorMap[color] || colorMap.gray;
    };

    return (
      <motion.button
        key={buttonKey}
        layout={!performanceMode}
        whileHover={!performanceMode ? { scale: 1.05 } : {}}
        whileTap={!performanceMode ? { scale: 0.95 } : {}}
        className={`
          aspect-square border-2 rounded-lg cursor-pointer transition-all duration-200 
          flex flex-col items-center justify-center p-1 relative
          ${button ? getColorClasses(typeStyle.color) : 'border-gray-600 bg-gray-800 text-gray-500'}
          ${button ? 'hover:brightness-110' : 'hover:bg-gray-700'}
          ${widgetEditMode ? 'hover:border-yellow-400' : ''}
          ${hasHotkeyMapping ? 'ring-2 ring-cyan-500/30' : ''}
        `}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleButtonClick(row, col, button);
        }}
        onContextMenu={(e) => {
          if (editMode) {
            handleButtonContextMenu(e, row, col, button);
          }
        }}
      >
        <Icon className={`${compactMode ? 'w-3 h-3' : 'w-4 h-4'} mb-1`} />
        
        {button && (
          <div className="text-center">
            <div className={`${compactMode ? 'text-xs' : 'text-xs'} font-medium truncate`}>
              {button.label || 'Unnamed'}
            </div>
            {!compactMode && button.obsScene && (
              <div className="text-xs text-orange-400 truncate mt-1">
                {button.obsScene}
              </div>
            )}
          </div>
        )}

        {/* Hotkey Mapping Indicator */}
        {hasHotkeyMapping && (
          <div className="absolute top-0 right-0 w-3 h-3 bg-cyan-400 rounded-full -mt-1 -mr-1" 
               title="Has hotkey mapping" />
        )}

        {widgetEditMode && (
          <div className="absolute top-0 left-0 w-2 h-2 bg-yellow-400 rounded-full -mt-1 -ml-1" />
        )}
      </motion.button>
    );
  };

  const renderDeckGrid = () => {
    const currentDeck = decks[activeDeck];
    if (!currentDeck) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">
          <div className="text-center">
            <Grid className="w-6 h-6 mx-auto mb-2 opacity-50" />
            <div>Deck not found</div>
          </div>
        </div>
      );
    }

    const buttons = [];
    const maxButtons = compactMode ? 8 : (currentDeck.rows * currentDeck.cols);
    let buttonCount = 0;

    for (let row = 0; row < currentDeck.rows && buttonCount < maxButtons; row++) {
      for (let col = 0; col < currentDeck.cols && buttonCount < maxButtons; col++) {
        buttons.push(renderButton(row, col));
        buttonCount++;
      }
    }

    const gridCols = compactMode ? 
      Math.min(4, currentDeck.cols) : 
      Math.min(currentDeck.cols, Math.floor(component.size?.width / 60) || 4);

    return (
      <div 
        className="grid gap-1 p-2"
        style={{ 
          gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
        }}
      >
        {buttons}
      </div>
    );
  };

  const renderBreadcrumb = () => {
    if (deckStack.length <= 1) return null;

    return (
      <div className="flex items-center space-x-1 text-xs">
        {deckStack.map((deckId, index) => (
          <React.Fragment key={deckId}>
            {index > 0 && <ChevronRight className="w-3 h-3 text-gray-500" />}
            <button
              onClick={() => {
                const newStack = deckStack.slice(0, index + 1);
                setDeckStack(newStack);
                setActiveDeck(deckId);
                onUpdate({ deckId });
              }}
              className={`px-1 py-0.5 rounded ${
                index === deckStack.length - 1 
                  ? 'text-blue-400 bg-blue-500/20' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {decks[deckId]?.name || deckId}
            </button>
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderDeckSelector = () => (
    <AnimatePresence>
      {showDeckSelector && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg p-2 z-50 max-h-48 overflow-y-auto"
        >
          <div className="space-y-1">
            {Object.entries(decks).map(([deckId, deck]) => (
              <button
                key={deckId}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  switchToDeck(deckId);
                }}
                className={`w-full text-left px-2 py-1 rounded text-sm transition-colors ${
                  deckId === activeDeck 
                    ? 'bg-blue-500/20 text-blue-400' 
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{deck.name}</span>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <span>{deck.rows}×{deck.cols}</span>
                    {deck.isMainDeck && <span className="text-blue-400">●</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderContextMenu = () => {
    if (!contextMenu) return null;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-2 min-w-[160px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onMouseLeave={() => {
          setContextMenu(null);
          globalStateService.clearActiveContextMenu();
        }}
      >
        {contextMenu.button && (
          <button
            onClick={() => {
              executeButtonAction(contextMenu.button);
              setContextMenu(null);
              globalStateService.clearActiveContextMenu();
            }}
            className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
          >
            <Play className="w-3 h-3" />
            <span>Execute</span>
          </button>
        )}
        
        <button
          onClick={() => {
            const event = new CustomEvent('openDeckEditor', {
              detail: { deckId: activeDeck, buttonKey: contextMenu.buttonKey }
            });
            window.dispatchEvent(event);
            setContextMenu(null);
            globalStateService.clearActiveContextMenu();
          }}
          className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
        >
          <Edit3 className="w-3 h-3" />
          <span>Edit</span>
        </button>
        
        {contextMenu.button && (
          <button
            onClick={() => {
              const [row, col] = contextMenu.buttonKey.split('-').map(Number);
              openHotkeyMapper(contextMenu.button, row, col);
              setContextMenu(null);
              globalStateService.clearActiveContextMenu();
            }}
            className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
          >
            <Keyboard className="w-3 h-3" />
            <span>Set Hotkey</span>
          </button>
        )}
      </motion.div>
    );
  };

  const renderHotkeyMapper = () => (
    <AnimatePresence>
      {showHotkeyMapper && mappingButton && (
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
                <Keyboard className="w-5 h-5 text-cyan-400" />
                <span>Set Hotkey Mapping</span>
              </h3>
              <button
                onClick={() => {
                  setShowHotkeyMapper(false);
                  setMappingButton(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-gray-700 rounded">
                <div className="text-sm text-white font-medium">
                  Button: {mappingButton.label || 'Unnamed'}
                </div>
                <div className="text-xs text-gray-400">
                  Position: ({mappingButton.row + 1}, {mappingButton.col + 1})
                </div>
                <div className="text-xs text-gray-400">
                  Action: {mappingButton.action || 'None'}
                </div>
              </div>

              <div className="text-sm text-gray-300">
                <p>You can assign keyboard shortcuts or MIDI controls to this button.</p>
                <p className="mt-2 text-xs text-gray-500">
                  Note: This feature will be expanded in future updates.
                </p>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  // For now, just save a basic mapping
                  saveHotkeyMapping({
                    type: 'keyboard',
                    keys: ['Space'],
                    modifier: 'none'
                  });
                }}
                className="flex-1 px-4 py-2 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded font-medium transition-colors"
              >
                Set Keyboard Shortcut
              </button>
              <button
                onClick={() => {
                  setShowHotkeyMapper(false);
                  setMappingButton(null);
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
  );

  const currentDeck = decks[activeDeck];
  const stats = currentDeck ? {
    total: currentDeck.rows * currentDeck.cols,
    configured: Object.values(currentDeck.buttons || {}).filter(btn => btn.type !== 'empty').length
  } : { total: 0, configured: 0 };

  const hotkeyMappingCount = Object.keys(globalStateService.getAllHotkeyMappings()).filter(
    key => key.startsWith(activeDeck)
  ).length;

  return (
    <div 
      ref={widgetRef} 
      className="h-full flex flex-col bg-gray-800 border border-gray-700 rounded-lg overflow-hidden relative"
      onContextMenu={(e) => {
        if (editMode) {
          e.preventDefault();
          e.stopPropagation();
          globalStateService.clearActiveContextMenu();
          
          const menuData = {
            x: e.clientX,
            y: e.clientY,
            timestamp: Date.now()
          };
          
          setContextMenu(menuData);
          globalStateService.setActiveContextMenu('hotkeyDeckWidget', menuData);
        }
      }}
    >
      {/* Widget Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-750">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <Grid className="w-4 h-4 text-blue-400 flex-shrink-0" />
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDeckSelector(!showDeckSelector);
            }}
            className="flex items-center space-x-1 text-sm font-medium text-white hover:text-blue-400 transition-colors min-w-0"
          >
            <span className="truncate">{currentDeck?.name || 'No Deck'}</span>
            <ChevronRight className={`w-3 h-3 transition-transform ${showDeckSelector ? 'rotate-90' : ''}`} />
          </button>
          
          {!compactMode && (
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <span>{stats.configured}/{stats.total}</span>
              {hotkeyMappingCount > 0 && (
                <span className="flex items-center space-x-1 text-cyan-400">
                  <Keyboard className="w-3 h-3" />
                  <span>{hotkeyMappingCount}</span>
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          {/* OBS Connection Status */}
          <div className={`w-2 h-2 rounded-full ${
            obsData.connected ? 'bg-orange-400' : 'bg-gray-500'
          }`} title={`OBS ${obsData.connected ? 'Connected' : 'Disconnected'}`}></div>
          
          {/* Navigation */}
          {deckStack.length > 1 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateBack();
              }}
              className="p-1 text-gray-400 hover:text-white"
              title="Go back"
            >
              <ArrowLeft className="w-3 h-3" />
            </button>
          )}
          
          {/* Refresh OBS Data */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              loadOBSDataWithCaching();
            }}
            disabled={isRefreshing}
            className="p-1 text-gray-400 hover:text-white disabled:opacity-50"
            title="Refresh OBS data"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setWidgetEditMode(!widgetEditMode);
            }}
            className={`p-1 rounded transition-colors ${
              widgetEditMode ? 'text-yellow-400' : 'text-gray-400 hover:text-white'
            }`}
            title="Toggle edit mode"
          >
            <Layout className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      {!compactMode && renderBreadcrumb() && (
        <div className="px-2 py-1 border-b border-gray-700 bg-gray-750">
          {renderBreadcrumb()}
        </div>
      )}

      {/* Widget Content */}
      <div className="flex-1 overflow-hidden">
        {renderDeckGrid()}
      </div>

      {/* Widget Footer */}
      {!compactMode && (
        <div className="border-t border-gray-700 px-2 py-1 bg-gray-750">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center space-x-3">
              <span>{currentDeck?.rows}×{currentDeck?.cols} deck</span>
              {obsData.connected && (
                <span className="text-orange-400">
                  OBS: {obsData.scenes.length} scenes
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {hotkeyMappingCount > 0 && (
                <span className="text-cyan-400">
                  {hotkeyMappingCount} hotkeys
                </span>
              )}
              {widgetEditMode && (
                <span className="text-yellow-400">Edit Mode</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Overlays */}
      {renderDeckSelector()}
      <AnimatePresence>
        {contextMenu && renderContextMenu()}
        {renderHotkeyMapper()}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedHotkeyDeckWidget;
