import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Grid, 
  Plus, 
  Settings, 
  Move, 
  Maximize2, 
  Minimize2,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Trash2,
  Lock,
  Unlock,
  Magnet,
  Layout,
  Music,
  Volume2,
  Monitor,
  Palette,
  Sparkles,
  Zap,
  X,
  Download,
  Upload,
  RefreshCw,
  Layers
} from 'lucide-react';
import configService from '../services/configService';
import globalStateService from '../services/globalStateService';
import MoodSelectorWidget from './dashboard/MoodSelectorWidget';
// import UnifiedAudioMixerWidget from './dashboard/UnifiedAudioMixerWidget'; // DISABLED - see SYSTEM_VOLLSTÄNDIG_REPARIERT.md
import AudioDeckWidget from './dashboard/AudioDeckWidget';
import EnhancedHotkeyDeckWidget from './dashboard/EnhancedHotkeyDeckWidget';
import DashboardDeckEditor from './dashboard/DashboardDeckEditor';
import audioDeckService from '../services/audioDeckService';

const EnhancedModularDashboard = () => {
  const [dashboardLayout, setDashboardLayout] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [draggedComponent, setDraggedComponent] = useState(null);
  const [resizingComponent, setResizingComponent] = useState(null);
  const [showComponentPalette, setShowComponentPalette] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [magneticDocking, setMagneticDocking] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [saveOnChange, setSaveOnChange] = useState(true);
  const [performanceMode, setPerformanceMode] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(null);
  const [deckEditor, setDeckEditor] = useState({ isOpen: false, deckId: null, buttonKey: null });
  const [connectionStatus, setConnectionStatus] = useState({ obs: false, midi: false });
  const [dashboardStats, setDashboardStats] = useState({ widgets: 0, activeConnections: 0 });
  const [showDashboardSettings, setShowDashboardSettings] = useState(false);
  
  const dashboardRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const componentStartPos = useRef({ x: 0, y: 0 });
  const autoSaveInterval = useRef(null);

  // Enhanced widget types with better integration
  const availableWidgets = [
    {
      type: 'mood-selector',
      name: 'Mood Selector',
      icon: Palette,
      description: 'Quick mood selection and music playback control',
      defaultSize: { width: 300, height: 200 },
      color: 'purple',
      category: 'Music',
      enhanced: false
    },
    {
      type: 'audio-mixer',
      name: 'Audio Mixer',
      icon: Volume2,
      description: 'Unified OBS audio source volume controls with real-time levels and MIDI support',
      defaultSize: { width: 280, height: 400 },
      color: 'green',
      category: 'Audio',
      enhanced: true
    },
    {
      type: 'audio-deck',
      name: 'Audio Deck',
      icon: Layers,
      description: 'Dedicated audio deck with grouped sources, dynamic orientation and MIDI control',
      defaultSize: { width: 280, height: 400 },
      color: 'cyan',
      category: 'Audio',
      enhanced: true
    },
    {
      type: 'hotkey-deck',
      name: 'Hotkey Deck',
      icon: Grid,
      description: 'Customizable button deck with keyboard and MIDI mapping',
      defaultSize: { width: 320, height: 180 },
      color: 'blue',
      category: 'Control',
      enhanced: true
    },
    {
      type: 'obs-controls',
      name: 'OBS Controls',
      icon: Monitor,
      description: 'Scene switching and recording controls',
      defaultSize: { width: 200, height: 250 },
      color: 'orange',
      category: 'Streaming',
      enhanced: false
    },
    {
      type: 'music-player',
      name: 'Music Player',
      icon: Music,
      description: 'Current song display and playback controls',
      defaultSize: { width: 350, height: 120 },
      color: 'pink',
      category: 'Music',
      enhanced: false
    }
  ];

  useEffect(() => {
    console.log('Unified ModularDashboard: Initializing...');
    
    initializeDashboard();
    setupEventListeners();
    setupAutoSave();
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeDashboard = async () => {
    try {
      // Set dashboard edit mode in global service
      globalStateService.setDashboardEditMode(editMode);
      
      // Load dashboard layout
      await loadDashboard();
      
      // Load performance settings
      const appSettings = configService.getAppSettings();
      setPerformanceMode(appSettings.performance?.memoryOptimization || false);
      
      // Update connection status
      updateConnectionStatus();
      
      console.log('Unified ModularDashboard: Initialization completed');
    } catch (error) {
      console.error('Unified ModularDashboard: Failed to initialize:', error);
      createDefaultDashboard();
    }
  };

  const setupEventListeners = () => {
    // Unified Global State Service listeners
    globalStateService.on('obsStateChanged', handleOBSStateChange);
    globalStateService.on('midiStateChanged', handleMIDIStateChange);
    globalStateService.on('contextMenuChanged', handleContextMenuChange);
    globalStateService.on('widgetRegistered', handleWidgetRegistered);
    globalStateService.on('widgetUnregistered', handleWidgetUnregistered);
    
    // Window events
    window.addEventListener('openDeckEditor', handleOpenDeckEditor);
    window.addEventListener('addAudioMixerToWidget', handleAddAudioMixerWidget);
    window.addEventListener('addAudioDeckToWidget', handleAddAudioDeckWidget);
    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('beforeunload', handleBeforeUnload);
  };

  const cleanup = () => {
    // Remove event listeners
    globalStateService.off('obsStateChanged', handleOBSStateChange);
    globalStateService.off('midiStateChanged', handleMIDIStateChange);
    globalStateService.off('contextMenuChanged', handleContextMenuChange);
    globalStateService.off('widgetRegistered', handleWidgetRegistered);
    globalStateService.off('widgetUnregistered', handleWidgetUnregistered);
    
    window.removeEventListener('openDeckEditor', handleOpenDeckEditor);
    window.removeEventListener('addAudioMixerToWidget', handleAddAudioMixerWidget);
    window.removeEventListener('addAudioDeckToWidget', handleAddAudioDeckWidget);
    window.removeEventListener('resize', handleWindowResize);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    
    // Clear intervals
    if (autoSaveInterval.current) {
      clearInterval(autoSaveInterval.current);
    }
    
    // Final save
    saveDashboard(false);
  };

  const setupAutoSave = () => {
    const appSettings = configService.getAppSettings();
    const interval = appSettings.autoSaveInterval || 10000;
    
    autoSaveInterval.current = setInterval(() => {
      if (dashboardLayout && saveOnChange) {
        saveDashboard(false); // Silent auto-save
      }
    }, interval);
    
    console.log('Unified ModularDashboard: Auto-save enabled with', interval/1000, 'second interval');
  };

  // Event Handlers
  const handleOBSStateChange = useCallback((state) => {
    setConnectionStatus(prev => ({ ...prev, obs: state.connected }));
    updateDashboardStats();
  }, []);

  const handleMIDIStateChange = useCallback((state) => {
    setConnectionStatus(prev => ({ ...prev, midi: state.connected }));
  }, []);

  const handleContextMenuChange = useCallback((contextMenuData) => {
    // Handle context menu conflicts between dashboard and widgets
    if (contextMenuData && contextMenuData.id.startsWith('dashboard')) {
      // Dashboard owns this context menu
      console.log('Unified ModularDashboard: Taking control of context menu');
    } else if (contextMenuData) {
      // Widget owns this context menu - clear dashboard context menu
      setShowContextMenu(null);
    }
  }, []);

  const handleWidgetRegistered = useCallback((data) => {
    console.log('Unified ModularDashboard: Widget registered:', data.widgetId, data.widgetType);
    updateDashboardStats();
  }, []);

  const handleWidgetUnregistered = useCallback((data) => {
    console.log('Unified ModularDashboard: Widget unregistered:', data.widgetId);
    updateDashboardStats();
  }, []);

  const handleOpenDeckEditor = useCallback((event) => {
    console.log('Unified ModularDashboard: Opening deck editor for:', event.detail);
    const { deckId, buttonKey } = event.detail;
    setDeckEditor({ isOpen: true, deckId, buttonKey });
  }, []);

  const handleAddAudioMixerWidget = useCallback((event) => {
    console.log('Unified ModularDashboard: Adding AudioMixer widget', event.detail);
    
    if (!dashboardLayout) return;
    
    const { sources, size } = event.detail;
    
    const newComponent = {
      id: `audio-mixer-${Date.now()}`,
      type: 'audio-mixer',
      position: findFreePosition(size || { width: 280, height: 400 }),
      size: size || { width: 280, height: 400 },
      visible: true,
      locked: false,
      zIndex: getHighestZIndex() + 1,
      sources: sources && sources.length > 0 ? sources.map(s => s.name) : ['master', 'mic', 'desktop'],
      orientation: 'vertical',
      sliderSize: 'medium',
      enhanced: true
    };
    
    addComponentToLayout(newComponent);
    
    console.log('✅ Unified ModularDashboard: AudioMixer widget added successfully');
  }, [dashboardLayout]);

  const handleAddAudioDeckWidget = useCallback((event) => {
    console.log('🔧 Unified ModularDashboard: Adding AudioDeck widget', event.detail);
    
    if (!dashboardLayout) {
      console.error('Unified ModularDashboard: No dashboard layout available');
      return;
    }
    
    const { 
      id, 
      deckId, 
      size, 
      position, 
      deckName, 
      deckColor, 
      orientation, 
      showMeters 
    } = event.detail;
    
    // Verify the deck exists
    const deck = audioDeckService.getDeck(deckId);
    if (!deck) {
      console.error('Unified ModularDashboard: Audio deck not found:', deckId);
      console.log('Available decks:', audioDeckService.getAllDecks().map(d => ({ id: d.id, name: d.name })));
      alert(`❌ Audio deck not found: ${deckId}`);
      return;
    }
    
    // Check if a widget for this deck already exists
    const existingWidget = dashboardLayout.layout.components.find(
      comp => comp.type === 'audio-deck' && comp.deckId === deckId
    );
    
    if (existingWidget) {
      console.log('Unified ModularDashboard: Audio deck widget already exists, bringing to front');
      updateComponent(existingWidget.id, { 
        zIndex: getHighestZIndex() + 1,
        visible: true 
      });
      alert(`ℹ️ Audio Deck "${deck.name}" is already on the dashboard!`);
      return;
    }
    
    const newComponent = {
      id: id || `audio-deck-${deckId}-${Date.now()}`,
      type: 'audio-deck',
      position: position || findFreePosition(size || { width: 280, height: 400 }),
      size: size || { width: 280, height: 400 },
      visible: true,
      locked: false,
      zIndex: getHighestZIndex() + 1,
      deckId: deckId,
      orientation: orientation || deck.orientation || 'vertical',
      showMeters: showMeters !== undefined ? showMeters : (deck.showMeters !== false),
      deckName: deckName || deck.name,
      deckColor: deckColor || deck.color || 'cyan',
      enhanced: true,
      created: Date.now()
    };
    
    console.log('Unified ModularDashboard: Creating AudioDeck component:', newComponent);
    addComponentToLayout(newComponent);
    
    console.log('✅ Unified ModularDashboard: AudioDeck widget added successfully:', deck.name);
    alert(`✅ Audio Deck "${deck.name}" added to dashboard!`);
  }, [dashboardLayout]);

  const handleWindowResize = useCallback(() => {
    // Adjust component positions if they're out of bounds
    if (!dashboardLayout || !dashboardRef.current) return;
    
    const rect = dashboardRef.current.getBoundingClientRect();
    let needsUpdate = false;
    
    const updatedComponents = dashboardLayout.layout.components.map(component => {
      const maxX = rect.width - component.size.width;
      const maxY = rect.height - component.size.height;
      
      if (component.position.x > maxX || component.position.y > maxY) {
        needsUpdate = true;
        return {
          ...component,
          position: {
            x: Math.min(component.position.x, Math.max(0, maxX)),
            y: Math.min(component.position.y, Math.max(0, maxY))
          }
        };
      }
      
      return component;
    });
    
    if (needsUpdate) {
      const updatedLayout = {
        ...dashboardLayout,
        layout: {
          ...dashboardLayout.layout,
          components: updatedComponents
        }
      };
      setDashboardLayout(updatedLayout);
    }
  }, [dashboardLayout]);

  const handleBeforeUnload = useCallback((event) => {
    saveDashboard(false);
  }, []);

  // Dashboard Management
  const loadDashboard = async () => {
    try {
      const layout = configService.getDashboardLayout();
      
      if (layout && layout.layout) {
        setDashboardLayout(layout);
        setSnapToGrid(layout.layout?.snapToGrid ?? true);
        setMagneticDocking(layout.layout?.magneticDocking ?? true);
        setGridSize(layout.layout?.gridSize ?? 10);
        console.log('Unified ModularDashboard: Loaded', layout.layout?.components?.length || 0, 'components');
      } else {
        throw new Error('No valid dashboard layout found');
      }
    } catch (error) {
      console.error('Unified ModularDashboard: Failed to load dashboard:', error);
      createDefaultDashboard();
    }
  };

  const createDefaultDashboard = () => {
    console.log('Unified ModularDashboard: Creating default dashboard...');
    
    const defaultLayout = {
      version: '2.0',
      layout: {
        snapToGrid: true,
        magneticDocking: true,
        gridSize: 10,
        components: [
          {
            id: `mood-selector-${Date.now()}`,
            type: 'mood-selector',
            position: { x: 20, y: 20 },
            size: { width: 300, height: 200 },
            visible: true,
            locked: false,
            zIndex: 1,
            enhanced: false
          },
          {
            id: `audio-mixer-${Date.now() + 1}`,
            type: 'audio-mixer',
            position: { x: 340, y: 20 },
            size: { width: 280, height: 400 },
            visible: true,
            locked: false,
            zIndex: 2,
            sources: ['master', 'mic', 'desktop'],
            orientation: 'vertical',
            enhanced: true
          },
          {
            id: `hotkey-deck-${Date.now() + 2}`,
            type: 'hotkey-deck',
            position: { x: 20, y: 240 },
            size: { width: 320, height: 180 },
            visible: true,
            locked: false,
            zIndex: 3,
            deckId: 'main',
            enhanced: true
          }
        ],
        created: Date.now(),
        lastUpdated: Date.now()
      }
    };
    
    setDashboardLayout(defaultLayout);
    saveDashboard(true, defaultLayout);
  };

  const saveDashboard = async (showIndicator = true, layoutToSave = dashboardLayout) => {
    if (!layoutToSave) return;
    
    try {
      const enhancedLayout = {
        ...layoutToSave,
        layout: {
          ...layoutToSave.layout,
          snapToGrid,
          magneticDocking,
          gridSize,
          lastUpdated: Date.now(),
          version: '2.0'
        }
      };
      
      await configService.setDashboardLayout(enhancedLayout);
      
      if (showIndicator) {
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 1500);
      }
      
      console.log('Unified ModularDashboard: Dashboard saved successfully');
    } catch (error) {
      console.error('Unified ModularDashboard: Failed to save dashboard:', error);
    }
  };

  const updateConnectionStatus = () => {
    const obsConnected = globalStateService.isOBSConnected();
    const midiConnected = globalStateService.isMIDIConnected();
    
    setConnectionStatus({ obs: obsConnected, midi: midiConnected });
  };

  const updateDashboardStats = () => {
    if (!dashboardLayout) return;
    
    const widgets = dashboardLayout.layout.components.length;
    const activeConnections = Object.values(connectionStatus).filter(Boolean).length;
    
    setDashboardStats({ widgets, activeConnections });
  };

  // Component Management
  const addComponent = (widgetType) => {
    const widget = availableWidgets.find(w => w.type === widgetType);
    if (!widget || !dashboardLayout) return;

    const newComponent = {
      id: `${widgetType}-${Date.now()}`,
      type: widgetType,
      position: findFreePosition(widget.defaultSize),
      size: widget.defaultSize,
      visible: true,
      locked: false,
      zIndex: getHighestZIndex() + 1,
      enhanced: widget.enhanced,
      created: Date.now(),
      ...(widgetType === 'hotkey-deck' && { deckId: getAvailableDeckId() }),
      ...(widgetType === 'audio-mixer' && { 
        sources: ['master', 'mic', 'desktop'],
        orientation: 'vertical',
        showMeters: true 
      }),
      ...(widgetType === 'audio-deck' && { 
        deckId: getAvailableAudioDeckId(),
        orientation: 'vertical',
        showMeters: true 
      })
    };

    addComponentToLayout(newComponent);
    setShowComponentPalette(false);
    
    console.log('Unified ModularDashboard: Added component:', newComponent.type, newComponent.id);
  };

  const addComponentToLayout = (newComponent) => {
    const updatedLayout = {
      ...dashboardLayout,
      layout: {
        ...dashboardLayout.layout,
        components: [...dashboardLayout.layout.components, newComponent],
        lastUpdated: Date.now()
      }
    };

    setDashboardLayout(updatedLayout);
    saveDashboard(false, updatedLayout);
  };

  const updateComponent = (componentId, updates) => {
    if (!dashboardLayout) return;

    const updatedLayout = {
      ...dashboardLayout,
      layout: {
        ...dashboardLayout.layout,
        components: dashboardLayout.layout.components.map(component =>
          component.id === componentId ? { ...component, ...updates, updated: Date.now() } : component
        ),
        lastUpdated: Date.now()
      }
    };

    setDashboardLayout(updatedLayout);
    
    if (saveOnChange) {
      saveDashboard(false, updatedLayout);
    }
  };

  const removeComponent = (componentId) => {
    if (!dashboardLayout) return;

    const updatedLayout = {
      ...dashboardLayout,
      layout: {
        ...dashboardLayout.layout,
        components: dashboardLayout.layout.components.filter(c => c.id !== componentId),
        lastUpdated: Date.now()
      }
    };

    setDashboardLayout(updatedLayout);
    setSelectedComponent(null);
    saveDashboard(false, updatedLayout);
    
    console.log('Unified ModularDashboard: Removed component:', componentId);
  };

  // Layout Utilities
  const findFreePosition = (size) => {
    if (!dashboardLayout) return { x: 20, y: 20 };

    const components = dashboardLayout.layout.components;
    let x = 20, y = 20;
    const step = 20;
    const maxAttempts = 100;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const overlap = components.some(comp => 
        x < comp.position.x + comp.size.width &&
        x + size.width > comp.position.x &&
        y < comp.position.y + comp.size.height &&
        y + size.height > comp.position.y
      );

      if (!overlap) {
        break;
      }

      x += step;
      if (x > 800) {
        x = 20;
        y += step;
      }
      attempts++;
    }

    return snapToGrid ? snapToGridPosition({ x, y }) : { x, y };
  };

  const getHighestZIndex = () => {
    if (!dashboardLayout) return 0;
    return Math.max(...dashboardLayout.layout.components.map(c => c.zIndex || 0), 0);
  };

  const getAvailableDeckId = () => {
    const decks = configService.getDecks();
    const deckIds = Object.keys(decks);
    return deckIds.length > 0 ? deckIds[0] : 'main';
  };

  const getAvailableAudioDeckId = () => {
    // Force initialization of audio deck service if needed
    if (!audioDeckService.initialized) {
      console.log('Unified ModularDashboard: AudioDeckService not initialized, waiting...');
      return 'main-output'; // fallback
    }
    
    const audioDecks = audioDeckService.getAllDecks();
    console.log('Unified ModularDashboard: Available audio decks:', audioDecks.length, audioDecks.map(d => d.name));
    
    if (audioDecks.length > 0) {
      return audioDecks[0].id;
    }
    
    // Create default audio decks if none exist
    console.log('Unified ModularDashboard: Creating default audio decks...');
    
    const defaultDecks = [
      {
        name: 'Main Output',
        description: 'Primary audio output sources',
        color: 'green',
        orientation: 'vertical'
      },
      {
        name: 'Microphones',
        description: 'All microphone inputs',
        color: 'blue',
        orientation: 'vertical'
      },
      {
        name: 'Media Sources',
        description: 'Music, game audio, and media',
        color: 'purple',
        orientation: 'vertical'
      }
    ];
    
    const createdDecks = defaultDecks.map(deckData => 
      audioDeckService.createAudioDeck(deckData)
    );
    
    console.log('Unified ModularDashboard: Created', createdDecks.length, 'default audio decks');
    
    return createdDecks[0].id;
  };

  const snapToGridPosition = (position) => {
    if (!snapToGrid) return position;
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  };

  const findSnapTargets = (component, position) => {
    if (!magneticDocking || !dashboardLayout) return position;

    const snapDistance = 15;
    const components = dashboardLayout.layout.components.filter(c => c.id !== component.id);
    let snappedX = position.x;
    let snappedY = position.y;

    for (const target of components) {
      // Horizontal snapping
      if (Math.abs(position.x - target.position.x) < snapDistance) {
        snappedX = target.position.x;
      } else if (Math.abs(position.x - (target.position.x + target.size.width)) < snapDistance) {
        snappedX = target.position.x + target.size.width;
      } else if (Math.abs((position.x + component.size.width) - target.position.x) < snapDistance) {
        snappedX = target.position.x - component.size.width;
      }

      // Vertical snapping
      if (Math.abs(position.y - target.position.y) < snapDistance) {
        snappedY = target.position.y;
      } else if (Math.abs(position.y - (target.position.y + target.size.height)) < snapDistance) {
        snappedY = target.position.y + target.size.height;
      } else if (Math.abs((position.y + component.size.height) - target.position.y) < snapDistance) {
        snappedY = target.position.y - component.size.height;
      }
    }

    return { x: snappedX, y: snappedY };
  };

  // Drag and Drop Handlers
  const handleMouseDown = (e, component) => {
    if (!editMode || component.locked) return;

    e.preventDefault();
    setDraggedComponent(component);
    setSelectedComponent(component);
    
    const rect = dashboardRef.current.getBoundingClientRect();
    dragStartPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    componentStartPos.current = { ...component.position };

    // Bring to front
    updateComponent(component.id, { zIndex: getHighestZIndex() + 1 });
  };

  const handleResizeMouseDown = (e, component) => {
    if (!editMode || component.locked) return;

    e.preventDefault();
    e.stopPropagation();
    setResizingComponent(component);
    setSelectedComponent(component);
    
    const rect = dashboardRef.current.getBoundingClientRect();
    dragStartPos.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    componentStartPos.current = { ...component.size };
  };

  const handleRightClick = (e, component) => {
    if (!editMode) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Clear any existing context menu
    globalStateService.clearActiveContextMenu();
    
    const menuData = {
      x: e.clientX,
      y: e.clientY,
      component,
      timestamp: Date.now()
    };
    
    setShowContextMenu(menuData);
    globalStateService.setActiveContextMenu('dashboardComponent', menuData);
    
    console.log('Unified ModularDashboard: Component context menu:', component.type);
  };

  const handleMouseMove = useCallback((e) => {
    if ((!draggedComponent && !resizingComponent) || !editMode) return;

    const rect = dashboardRef.current.getBoundingClientRect();
    const currentPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    if (draggedComponent) {
      // Handle dragging
      const newPosition = {
        x: componentStartPos.current.x + (currentPos.x - dragStartPos.current.x),
        y: componentStartPos.current.y + (currentPos.y - dragStartPos.current.y)
      };

      // Apply constraints
      newPosition.x = Math.max(0, Math.min(newPosition.x, rect.width - draggedComponent.size.width));
      newPosition.y = Math.max(0, Math.min(newPosition.y, rect.height - draggedComponent.size.height));

      // Apply snapping
      const snappedPosition = findSnapTargets(draggedComponent, newPosition);
      const finalPosition = snapToGrid ? snapToGridPosition(snappedPosition) : snappedPosition;

      updateComponent(draggedComponent.id, { position: finalPosition });
    } else if (resizingComponent) {
      // Handle resizing
      const deltaX = currentPos.x - dragStartPos.current.x;
      const deltaY = currentPos.y - dragStartPos.current.y;

      const newSize = {
        width: Math.max(150, componentStartPos.current.width + deltaX),
        height: Math.max(100, componentStartPos.current.height + deltaY)
      };

      // Apply grid snapping to size
      if (snapToGrid) {
        newSize.width = Math.round(newSize.width / gridSize) * gridSize;
        newSize.height = Math.round(newSize.height / gridSize) * gridSize;
      }

      // Ensure component doesn't go out of bounds
      const maxWidth = rect.width - resizingComponent.position.x;
      const maxHeight = rect.height - resizingComponent.position.y;
      newSize.width = Math.min(newSize.width, maxWidth);
      newSize.height = Math.min(newSize.height, maxHeight);

      updateComponent(resizingComponent.id, { size: newSize });
    }
  }, [draggedComponent, resizingComponent, editMode, snapToGrid, magneticDocking, gridSize]);

  const handleMouseUp = useCallback(() => {
    if (draggedComponent) {
      setDraggedComponent(null);
      if (saveOnChange) {
        saveDashboard(false);
      }
    }
    if (resizingComponent) {
      setResizingComponent(null);
      if (saveOnChange) {
        saveDashboard(false);
      }
    }
  }, [draggedComponent, resizingComponent, saveOnChange]);

  useEffect(() => {
    if (editMode) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [editMode, handleMouseMove, handleMouseUp]);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showContextMenu) {
        setShowContextMenu(null);
        globalStateService.clearActiveContextMenu();
      }
    };
    
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  // Update edit mode in global service
  useEffect(() => {
    globalStateService.setDashboardEditMode(editMode);
  }, [editMode]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedComponent(null);
        setShowContextMenu(null);
        setShowComponentPalette(false);
        setDeckEditor({ isOpen: false, deckId: null, buttonKey: null });
        globalStateService.clearActiveContextMenu();
      }
      if (e.key === 'Delete' && selectedComponent && editMode) {
        if (confirm('Remove this widget from the dashboard?')) {
          removeComponent(selectedComponent.id);
          setSelectedComponent(null);
        }
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveDashboard(true);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedComponent, editMode]);

  const handleDeckEditorSave = (deckId, buttonKey, buttonData) => {
    console.log('Unified ModularDashboard: Deck editor saved button:', deckId, buttonKey, buttonData);
    
    // Trigger refresh of HotkeyDeckWidgets
    const event = new CustomEvent('deckUpdated', {
      detail: { deckId, buttonKey, buttonData }
    });
    window.dispatchEvent(event);
    
    // Show save indicator
    setSaveIndicator(true);
    setTimeout(() => setSaveIndicator(false), 1000);
  };

  // Widget Rendering
  const renderWidget = (component) => {
    const commonProps = {
      key: component.id,
      component,
      editMode,
      onUpdate: (updates) => updateComponent(component.id, updates),
      onRemove: () => removeComponent(component.id),
      performanceMode
    };

    switch (component.type) {
      case 'mood-selector':
        return <MoodSelectorWidget {...commonProps} />;
      case 'audio-mixer':
        // UnifiedAudioMixerWidget is disabled - see SYSTEM_VOLLSTÄNDIG_REPARIERT.md
        // Use AudioDeckWidget as replacement for now
        return component.enhanced ? 
          <AudioDeckWidget {...commonProps} /> : 
          <MoodSelectorWidget {...commonProps} />; // Fallback
      case 'audio-deck':
        return component.enhanced ? 
          <AudioDeckWidget {...commonProps} /> : 
          <div {...commonProps} className="p-4 bg-gray-800 rounded border border-gray-600 text-white">Audio Deck Loading...</div>;
      case 'hotkey-deck':
        return component.enhanced ? 
          <EnhancedHotkeyDeckWidget {...commonProps} /> : 
          <MoodSelectorWidget {...commonProps} />; // Fallback
      case 'obs-controls':
        return <div {...commonProps} className="p-4 bg-gray-800 rounded border border-gray-600 text-white">OBS Controls (Coming Soon)</div>;
      case 'music-player':
        return <div {...commonProps} className="p-4 bg-gray-800 rounded border border-gray-600 text-white">Music Player (Coming Soon)</div>;
      default:
        return null;
    }
  };

  const renderComponentPalette = () => (
    <AnimatePresence>
      {showComponentPalette && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center space-x-2">
                <Sparkles className="w-6 h-6 text-purple-400" />
                <span>Add Dashboard Widget</span>
              </h3>
              <button
                onClick={() => setShowComponentPalette(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Widget Categories */}
            {/* Audio Deck Selection */}
            <div className="mb-6">
              <h4 className="text-lg font-medium text-white mb-3 flex items-center space-x-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>Audio Decks</span>
              </h4>
              
              <div className="space-y-3">
                {(() => {
                  const audioDecks = audioDeckService.getAllDecks();
                  if (audioDecks.length === 0) {
                    return (
                      <div className="p-4 bg-gray-700 border border-gray-600 rounded-lg text-center">
                        <p className="text-gray-400 text-sm mb-3">No audio decks available</p>
                        <button
                          onClick={() => {
                            // Initialize default decks
                            getAvailableAudioDeckId();
                            // Refresh the palette
                            setTimeout(() => setShowComponentPalette(false), 100);
                            setTimeout(() => setShowComponentPalette(true), 200);
                          }}
                          className="px-3 py-1 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded text-sm transition-colors"
                        >
                          Create Default Audio Decks
                        </button>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {audioDecks.map((deck) => {
                        const existingWidget = dashboardLayout.layout.components.find(
                          comp => comp.type === 'audio-deck' && comp.deckId === deck.id
                        );
                        
                        return (
                          <motion.button
                            key={deck.id}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              if (existingWidget) {
                                alert(`⚠️ Audio Deck "${deck.name}" is already on the dashboard!`);
                                return;
                              }
                              
                              const newComponent = {
                                id: `audio-deck-${deck.id}-${Date.now()}`,
                                type: 'audio-deck',
                                position: findFreePosition({ width: 280, height: 400 }),
                                size: { width: 280, height: 400 },
                                visible: true,
                                locked: false,
                                zIndex: getHighestZIndex() + 1,
                                deckId: deck.id,
                                orientation: deck.orientation || 'vertical',
                                showMeters: deck.showMeters !== false,
                                deckName: deck.name,
                                deckColor: deck.color || 'cyan',
                                enhanced: true,
                                created: Date.now()
                              };
                              
                              addComponentToLayout(newComponent);
                              setShowComponentPalette(false);
                            }}
                            disabled={existingWidget}
                            className={`p-3 border rounded-lg text-left transition-all ${
                              existingWidget
                                ? 'bg-gray-600 border-gray-500 cursor-not-allowed opacity-50'
                                : 'bg-gray-700 hover:bg-gray-600 border-gray-600'
                            }`}
                          >
                            <div className="flex items-center space-x-2 mb-2">
                              <Volume2 className={`w-5 h-5 text-${deck.color || 'cyan'}-400`} />
                              <h5 className="font-medium text-white">{deck.name}</h5>
                              {existingWidget && (
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">On Dashboard</span>
                              )}
                            </div>
                            
                            <p className="text-xs text-gray-400 mb-2">
                              {deck.description || 'Audio source deck'}
                            </p>
                            
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>{deck.sources?.length || 0} sources</span>
                              <span className={`text-${deck.color || 'cyan'}-400`}>
                                {deck.orientation || 'vertical'}
                              </span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
            
            {/* Standard Widget Categories */}
            {Object.entries(
              availableWidgets.reduce((acc, widget) => {
                if (!acc[widget.category]) acc[widget.category] = [];
                acc[widget.category].push(widget);
                return acc;
              }, {})
            ).map(([category, widgets]) => (
              <div key={category} className="mb-6">
                <h4 className="text-lg font-medium text-white mb-3 flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-blue-400" />
                  <span>{category}</span>
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {widgets.filter(widget => widget.type !== 'audio-deck').map((widget) => (
                    <motion.button
                      key={widget.type}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addComponent(widget.type)}
                      className={`p-4 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-left transition-all`}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <widget.icon className={`w-6 h-6 text-${widget.color}-400`} />
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{widget.name}</h4>
                          {widget.enhanced && (
                            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded mt-1 inline-block">
                              ✨ Unified
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{widget.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>Size: {widget.defaultSize.width} × {widget.defaultSize.height}</span>
                        <span className={`text-${widget.color}-400`}>{widget.color}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const renderContextMenu = () => (
    <AnimatePresence>
      {showContextMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-2 min-w-[180px]"
          style={{ left: showContextMenu.x, top: showContextMenu.y }}
          onMouseLeave={() => {
            setShowContextMenu(null);
            globalStateService.clearActiveContextMenu();
          }}
        >
          <button
            onClick={() => {
              updateComponent(showContextMenu.component.id, { 
                locked: !showContextMenu.component.locked 
              });
              setShowContextMenu(null);
              globalStateService.clearActiveContextMenu();
              saveDashboard(false);
            }}
            className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
          >
            {showContextMenu.component.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            <span>{showContextMenu.component.locked ? 'Unlock' : 'Lock'}</span>
          </button>
          
          <button
            onClick={() => {
              updateComponent(showContextMenu.component.id, { 
                visible: !showContextMenu.component.visible 
              });
              setShowContextMenu(null);
              globalStateService.clearActiveContextMenu();
              saveDashboard(false);
            }}
            className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
          >
            {showContextMenu.component.visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span>{showContextMenu.component.visible ? 'Hide' : 'Show'}</span>
          </button>
          
          <div className="border-t border-gray-600 my-1"></div>
          
          <button
            onClick={() => {
              updateComponent(showContextMenu.component.id, { zIndex: getHighestZIndex() + 1 });
              setShowContextMenu(null);
              globalStateService.clearActiveContextMenu();
              saveDashboard(false);
            }}
            className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Bring to Front</span>
          </button>
          
          <button
            onClick={() => {
              updateComponent(showContextMenu.component.id, { zIndex: 0 });
              setShowContextMenu(null);
              globalStateService.clearActiveContextMenu();
              saveDashboard(false);
            }}
            className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
          >
            <Minimize2 className="w-4 h-4" />
            <span>Send to Back</span>
          </button>
          
          <div className="border-t border-gray-600 my-1"></div>
          
          <button
            onClick={() => {
              if (confirm('Remove this widget from the dashboard?')) {
                removeComponent(showContextMenu.component.id);
                setShowContextMenu(null);
                globalStateService.clearActiveContextMenu();
                saveDashboard(false);
              }
            }}
            className="w-full px-3 py-2 text-left text-red-400 hover:bg-gray-700 flex items-center space-x-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Remove</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!dashboardLayout) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <Layout className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <div>Loading Unified Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Unified Dashboard Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center space-x-3">
          <Layout className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Unified Dashboard</h2>
          
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${connectionStatus.obs ? 'bg-orange-400' : 'bg-gray-500'}`} 
                 title={`OBS ${connectionStatus.obs ? 'Connected' : 'Disconnected'}`}></div>
            <div className={`w-2 h-2 rounded-full ${connectionStatus.midi ? 'bg-purple-400' : 'bg-gray-500'}`}
                 title={`MIDI ${connectionStatus.midi ? 'Connected' : 'Disconnected'}`}></div>
          </div>
          
          {/* Save Indicator */}
          <AnimatePresence>
            {saveIndicator && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center space-x-1 text-green-400 text-sm"
              >
                <Save className="w-4 h-4" />
                <span>Saved</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center space-x-2">
          {/* Grid Settings */}
          <div className="flex items-center space-x-2 mr-4">
            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`p-2 rounded-lg text-sm ${
                snapToGrid ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-600 text-gray-400'
              }`}
              title="Snap to Grid"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMagneticDocking(!magneticDocking)}
              className={`p-2 rounded-lg text-sm ${
                magneticDocking ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-600 text-gray-400'
              }`}
              title="Magnetic Docking"
            >
              <Magnet className="w-4 h-4" />
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              editMode 
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
          >
            {editMode ? 'Exit Edit' : 'Edit Mode'}
          </button>

          <button
            onClick={() => setShowComponentPalette(true)}
            className="px-3 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Add Widget
          </button>

          {/* Quick Add Audio Deck Button for Testing */}
          <button
            onClick={() => {
              const decks = audioDeckService.getAllDecks();
              if (decks.length > 0) {
                const testDeck = decks[0];
                handleAddAudioDeckWidget({
                  detail: {
                    deckId: testDeck.id,
                    deckName: testDeck.name,
                    deckColor: testDeck.color
                  }
                });
              } else {
                alert('No audio decks available. Create some first!');
              }
            }}
            className="px-3 py-2 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded-lg text-sm font-medium transition-colors"
          >
            <Layers className="w-4 h-4 inline mr-1" />
            Test Add Deck
          </button>

          <button
            onClick={() => saveDashboard(true)}
            className="px-3 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg text-sm font-medium transition-colors"
          >
            <Save className="w-4 h-4 inline mr-1" />
            Save
          </button>
        </div>
      </div>

      {/* Dashboard Canvas */}
      <div 
        ref={dashboardRef}
        className="flex-1 relative overflow-hidden bg-gray-900"
        style={{
          backgroundImage: snapToGrid ? 
            `radial-gradient(circle, #374151 1px, transparent 1px)` : 'none',
          backgroundSize: snapToGrid ? `${gridSize}px ${gridSize}px` : 'auto'
        }}
      >
        {/* Render Components */}
        {dashboardLayout.layout.components
          .filter(component => component.visible)
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map(component => (
            <motion.div
              key={component.id}
              layout={!draggedComponent && !resizingComponent && !performanceMode}
              className={`absolute ${
                editMode && !component.locked ? 'cursor-move' : 'cursor-default'
              } ${
                selectedComponent?.id === component.id && editMode ? 'ring-2 ring-blue-500' : ''
              } ${
                resizingComponent?.id === component.id ? 'ring-2 ring-green-500' : ''
              }`}
              style={{
                left: component.position.x,
                top: component.position.y,
                width: component.size.width,
                height: component.size.height,
                zIndex: component.zIndex || 0
              }}
              onMouseDown={(e) => {
                if (editMode && !component.locked) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const headerHeight = 40;
                  const relativeY = e.clientY - rect.top;
                  
                  if (relativeY <= headerHeight) {
                    handleMouseDown(e, component);
                  }
                }
              }}
              onContextMenu={(e) => {
                if (!editMode) return;
                
                const rect = e.currentTarget.getBoundingClientRect();
                const headerHeight = 40;
                const relativeY = e.clientY - rect.top;
                
                if (relativeY <= headerHeight) {
                  handleRightClick(e, component);
                }
              }}
            >
              {renderWidget(component)}
              
              {/* Edit Mode Overlay */}
              {editMode && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-br z-10">
                    {component.enhanced && <span className="text-cyan-300">✨ </span>}
                    {component.type}
                  </div>
                  
                  {/* Resize Handles */}
                  {!component.locked && (
                    <>
                      <div 
                        className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize pointer-events-auto z-10"
                        onMouseDown={(e) => handleResizeMouseDown(e, component)}
                      />
                      
                      <div 
                        className="absolute bottom-0 right-2 left-2 h-2 bg-blue-500/50 cursor-s-resize pointer-events-auto z-10"
                        onMouseDown={(e) => handleResizeMouseDown(e, component)}
                      />
                      <div 
                        className="absolute right-0 top-2 bottom-2 w-2 bg-blue-500/50 cursor-e-resize pointer-events-auto z-10"
                        onMouseDown={(e) => handleResizeMouseDown(e, component)}
                      />
                    </>
                  )}
                  
                  {/* Lock Indicator */}
                  {component.locked && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl z-10">
                      <Lock className="w-3 h-3" />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}

        {/* Empty State */}
        {dashboardLayout.layout.components.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Layout className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Your unified dashboard is empty</h3>
              <p className="text-sm mb-4">Add widgets to create your custom streaming workspace</p>
              <button
                onClick={() => setShowComponentPalette(true)}
                className="px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Your First Widget
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Unified Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
        <div className="flex items-center space-x-4">
          <span>Widgets: {dashboardLayout.layout.components.length}</span>
          <span>Grid: {snapToGrid ? `${gridSize}px` : 'Off'}</span>
          <span>Magnetic: {magneticDocking ? 'On' : 'Off'}</span>
          <span>Connections: {dashboardStats.activeConnections}</span>
        </div>
        <div className="flex items-center space-x-2">
          {performanceMode && (
            <span className="text-yellow-400">⚡ Performance Mode</span>
          )}
          {connectionStatus.obs && (
            <span className="text-orange-400">OBS</span>
          )}
          {connectionStatus.midi && (
            <span className="text-purple-400">MIDI</span>
          )}
          <span>Unified Dashboard v2.0</span>
        </div>
      </div>

      {/* Component Palette */}
      {renderComponentPalette()}
      
      {/* Context Menu */}
      {renderContextMenu()}
      
      {/* Deck Editor Modal */}
      <DashboardDeckEditor
        isOpen={deckEditor.isOpen}
        deckId={deckEditor.deckId}
        buttonKey={deckEditor.buttonKey}
        onClose={() => setDeckEditor({ isOpen: false, deckId: null, buttonKey: null })}
        onSave={handleDeckEditorSave}
      />
    </div>
  );
};

export default EnhancedModularDashboard;