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
  Sparkles
} from 'lucide-react';
import configService from '../services/configService';
import MoodSelectorWidget from './dashboard/MoodSelectorWidget';
import AudioMixerWidget from './dashboard/AudioMixerWidget';
import HotkeyDeckWidget from './dashboard/HotkeyDeckWidget';
import globalStateService from '../services/globalStateService';

const ModularDashboard = () => {
  const [dashboardLayout, setDashboardLayout] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [draggedComponent, setDraggedComponent] = useState(null);
  const [showComponentPalette, setShowComponentPalette] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [magneticDocking, setMagneticDocking] = useState(true);
  const [gridSize, setGridSize] = useState(10);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [performanceMode, setPerformanceMode] = useState(false);
  
  const dashboardRef = useRef(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const componentStartPos = useRef({ x: 0, y: 0 });

  // Available widget types
  const availableWidgets = [
    {
      type: 'mood-selector',
      name: 'Mood Selector',
      icon: Palette,
      description: 'Quick mood selection and playback',
      defaultSize: { width: 300, height: 200 },
      color: 'purple'
    },
    {
      type: 'audio-mixer',
      name: 'Audio Mixer',
      icon: Volume2,
      description: 'Audio source volume controls',
      defaultSize: { width: 250, height: 400 },
      color: 'green'
    },
    {
      type: 'hotkey-deck',
      name: 'Hotkey Deck',
      icon: Grid,
      description: 'Customizable button deck',
      defaultSize: { width: 300, height: 150 },
      color: 'blue'
    },
    {
      type: 'obs-controls',
      name: 'OBS Controls',
      icon: Monitor,
      description: 'OBS scene and recording controls',
      defaultSize: { width: 200, height: 250 },
      color: 'orange'
    },
    {
      type: 'music-player',
      name: 'Music Player',
      icon: Music,
      description: 'Current song display and controls',
      defaultSize: { width: 350, height: 120 },
      color: 'pink'
    }
  ];

  useEffect(() => {
    loadDashboard();
    
    // Performance optimization based on app settings
    const appSettings = configService.getAppSettings();
    setPerformanceMode(appSettings.performance?.memoryOptimization || false);
    
    // Auto-save interval
    const autoSaveInterval = setInterval(() => {
      if (dashboardLayout) {
        saveDashboard(false); // Silent save
      }
    }, appSettings.autoSaveInterval || 5000);

    return () => {
      clearInterval(autoSaveInterval);
      saveDashboard(true); // Force save on unmount
    };
  }, []);

  const loadDashboard = async () => {
    try {
      const layout = configService.getDashboardLayout();
      setDashboardLayout(layout);
      setSnapToGrid(layout.layout?.snapToGrid ?? true);
      setMagneticDocking(layout.layout?.magneticDocking ?? true);
      setGridSize(layout.layout?.gridSize ?? 10);
      console.log('Dashboard loaded:', layout.layout?.components?.length || 0, 'components');
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      // Create default dashboard
      const defaultLayout = configService.getDefaultConfig('dashboard');
      setDashboardLayout(defaultLayout);
    }
  };

  const saveDashboard = async (showIndicator = true) => {
    if (!dashboardLayout) return;
    
    try {
      const layoutToSave = {
        ...dashboardLayout,
        layout: {
          ...dashboardLayout.layout,
          snapToGrid,
          magneticDocking,
          gridSize,
          lastUpdated: Date.now()
        }
      };
      
      await configService.setDashboardLayout(layoutToSave);
      
      if (showIndicator) {
        setSaveIndicator(true);
        setTimeout(() => setSaveIndicator(false), 1000);
      }
      
      console.log('Dashboard saved');
    } catch (error) {
      console.error('Failed to save dashboard:', error);
    }
  };

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
      ...(widgetType === 'hotkey-deck' && { deckId: getAvailableDeckId() }),
      ...(widgetType === 'audio-mixer' && { sources: ['master', 'mic', 'desktop'] })
    };

    const updatedLayout = {
      ...dashboardLayout,
      layout: {
        ...dashboardLayout.layout,
        components: [...dashboardLayout.layout.components, newComponent]
      }
    };

    setDashboardLayout(updatedLayout);
    setShowComponentPalette(false);
    console.log('Added component:', newComponent.type, newComponent.id);
  };

  const updateComponent = (componentId, updates) => {
    if (!dashboardLayout) return;

    const updatedLayout = {
      ...dashboardLayout,
      layout: {
        ...dashboardLayout.layout,
        components: dashboardLayout.layout.components.map(component =>
          component.id === componentId ? { ...component, ...updates } : component
        )
      }
    };

    setDashboardLayout(updatedLayout);
  };

  const removeComponent = (componentId) => {
    if (!dashboardLayout) return;

    const updatedLayout = {
      ...dashboardLayout,
      layout: {
        ...dashboardLayout.layout,
        components: dashboardLayout.layout.components.filter(c => c.id !== componentId)
      }
    };

    setDashboardLayout(updatedLayout);
    setSelectedComponent(null);
  };

  const findFreePosition = (size) => {
    if (!dashboardLayout) return { x: 20, y: 20 };

    const components = dashboardLayout.layout.components;
    let x = 20, y = 20;
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

      x += 20;
      if (x > 800) {
        x = 20;
        y += 20;
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

  const snapToGridPosition = (position) => {
    if (!snapToGrid) return position;
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize
    };
  };

  const findSnapTargets = (component, position) => {
    if (!magneticDocking || !dashboardLayout) return position;

    const snapDistance = 20;
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

  const handleMouseMove = useCallback((e) => {
    if (!draggedComponent || !editMode) return;

    const rect = dashboardRef.current.getBoundingClientRect();
    const currentPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

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
  }, [draggedComponent, editMode, snapToGrid, magneticDocking]);

  const handleMouseUp = useCallback(() => {
    if (draggedComponent) {
      setDraggedComponent(null);
      saveDashboard();
    }
  }, [draggedComponent]);

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
        return <AudioMixerWidget {...commonProps} />;
      case 'hotkey-deck':
        return <HotkeyDeckWidget {...commonProps} />;
      case 'obs-controls':
        return <div {...commonProps}>OBS Controls (Coming Soon)</div>;
      case 'music-player':
        return <div {...commonProps}>Music Player (Coming Soon)</div>;
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
            className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span>Add Dashboard Widget</span>
              </h3>
              <button
                onClick={() => setShowComponentPalette(false)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableWidgets.map((widget) => (
                <motion.button
                  key={widget.type}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => addComponent(widget.type)}
                  className={`p-4 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-left transition-all`}
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <widget.icon className={`w-6 h-6 text-${widget.color}-400`} />
                    <h4 className="font-medium text-white">{widget.name}</h4>
                  </div>
                  <p className="text-sm text-gray-400">{widget.description}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    Size: {widget.defaultSize.width} × {widget.defaultSize.height}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!dashboardLayout) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <div className="text-center">
          <Layout className="w-8 h-8 mx-auto mb-2 animate-spin" />
          <div>Loading Dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center space-x-3">
          <Layout className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Dashboard</h2>
          
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
              layout={!draggedComponent}
              className={`absolute ${
                editMode ? 'cursor-move' : 'cursor-default'
              } ${
                selectedComponent?.id === component.id && editMode ? 'ring-2 ring-blue-500' : ''
              }`}
              style={{
                left: component.position.x,
                top: component.position.y,
                width: component.size.width,
                height: component.size.height,
                zIndex: component.zIndex || 0
              }}
              onMouseDown={(e) => handleMouseDown(e, component)}
            >
              {renderWidget(component)}
              
              {/* Edit Mode Overlay */}
              {editMode && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-br">
                    {component.type}
                  </div>
                  
                  {/* Resize Handles */}
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-se-resize pointer-events-auto" />
                  
                  {/* Lock Indicator */}
                  {component.locked && (
                    <div className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl">
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
              <h3 className="text-lg font-medium mb-2">Your dashboard is empty</h3>
              <p className="text-sm mb-4">Add widgets to create your custom workspace</p>
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

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
        <div className="flex items-center space-x-4">
          <span>Components: {dashboardLayout.layout.components.length}</span>
          <span>Grid: {snapToGrid ? `${gridSize}px` : 'Off'}</span>
          <span>Magnetic: {magneticDocking ? 'On' : 'Off'}</span>
        </div>
        <div className="flex items-center space-x-2">
          {performanceMode && (
            <span className="text-yellow-400">⚡ Performance Mode</span>
          )}
          <span>Dashboard v2.0</span>
        </div>
      </div>

      {/* Component Palette */}
      {renderComponentPalette()}
    </div>
  );
};

export default ModularDashboard;
