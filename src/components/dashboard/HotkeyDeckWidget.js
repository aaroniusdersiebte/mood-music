import React, { useState, useEffect, useRef } from 'react';
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
  Layers
} from 'lucide-react';
import configService from '../../services/configService';
import globalStateService from '../../services/globalStateService';

const HotkeyDeckWidget = ({ component, editMode, onUpdate, onRemove, performanceMode }) => {
  const [decks, setDecks] = useState({});
  const [activeDeck, setActiveDeck] = useState(component.deckId || 'main');
  const [deckStack, setDeckStack] = useState([component.deckId || 'main']);
  const [showDeckSelector, setShowDeckSelector] = useState(false);
  const [widgetEditMode, setWidgetEditMode] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [compactMode, setCompactMode] = useState(component.size?.width < 250);

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
    loadDecks();
  }, []);

  useEffect(() => {
    // Update compact mode based on widget size
    setCompactMode(component.size?.width < 250);
  }, [component.size]);

  const loadDecks = () => {
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
  };

  const executeButtonAction = (button) => {
    console.log('Executing button action:', button.type, button.action);

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
    
    globalStateService.setVolume(button.target, dbValue, 'HotkeyDeckWidget');
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

  const executeOBSAction = (button) => {
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

  const navigateToSubDeck = (deckId) => {
    if (decks[deckId]) {
      setDeckStack(prev => [...prev, deckId]);
      setActiveDeck(deckId);
    }
  };

  const navigateBack = () => {
    if (deckStack.length > 1) {
      const newStack = [...deckStack];
      newStack.pop();
      setDeckStack(newStack);
      setActiveDeck(newStack[newStack.length - 1]);
    }
  };

  const navigateHome = () => {
    const mainDeck = Object.values(decks).find(deck => deck.isMainDeck) || Object.values(decks)[0];
    if (mainDeck) {
      setDeckStack([mainDeck.id]);
      setActiveDeck(mainDeck.id);
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
    if (widgetEditMode) {
      // Open full deck editor
      const event = new CustomEvent('openDeckEditor', {
        detail: { deckId: activeDeck, buttonKey: `${row}-${col}` }
      });
      window.dispatchEvent(event);
    } else if (button) {
      executeButtonAction(button);
    }
  };

  const handleButtonContextMenu = (e, row, col, button) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      row,
      col,
      button
    });
  };

  const renderButton = (row, col) => {
    const currentDeck = decks[activeDeck];
    if (!currentDeck) return null;

    const buttonKey = `${row}-${col}`;
    const button = currentDeck.buttons?.[buttonKey];
    const typeStyle = buttonTypeStyles[button?.type] || buttonTypeStyles.empty;
    const Icon = typeStyle.icon;

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
          flex flex-col items-center justify-center p-1
          ${button ? getColorClasses(typeStyle.color) : 'border-gray-600 bg-gray-800 text-gray-500'}
          ${button ? 'hover:brightness-110' : 'hover:bg-gray-700'}
          ${widgetEditMode ? 'hover:border-yellow-400' : ''}
        `}
        onClick={() => handleButtonClick(row, col, button)}
        onContextMenu={(e) => handleButtonContextMenu(e, row, col, button)}
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

        {widgetEditMode && (
          <div className="absolute top-0 right-0 w-2 h-2 bg-yellow-400 rounded-full -mt-1 -mr-1" />
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
                onClick={() => switchToDeck(deckId)}
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
        className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-2 min-w-[120px]"
        style={{ left: contextMenu.x, top: contextMenu.y }}
        onMouseLeave={() => setContextMenu(null)}
      >
        {contextMenu.button && (
          <button
            onClick={() => {
              executeButtonAction(contextMenu.button);
              setContextMenu(null);
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
              detail: { deckId: activeDeck, buttonKey: `${contextMenu.row}-${contextMenu.col}` }
            });
            window.dispatchEvent(event);
            setContextMenu(null);
          }}
          className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
        >
          <Edit3 className="w-3 h-3" />
          <span>Edit</span>
        </button>
      </motion.div>
    );
  };

  const currentDeck = decks[activeDeck];
  const stats = currentDeck ? {
    total: currentDeck.rows * currentDeck.cols,
    configured: Object.values(currentDeck.buttons || {}).filter(btn => btn.type !== 'empty').length
  } : { total: 0, configured: 0 };

  return (
    <div className="h-full flex flex-col bg-gray-800 border border-gray-700 rounded-lg overflow-hidden relative">
      {/* Widget Header */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700 bg-gray-750">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <Grid className="w-4 h-4 text-blue-400 flex-shrink-0" />
          
          <button
            onClick={() => setShowDeckSelector(!showDeckSelector)}
            className="flex items-center space-x-1 text-sm font-medium text-white hover:text-blue-400 transition-colors min-w-0"
          >
            <span className="truncate">{currentDeck?.name || 'No Deck'}</span>
            <ChevronRight className={`w-3 h-3 transition-transform ${showDeckSelector ? 'rotate-90' : ''}`} />
          </button>
          
          {!compactMode && (
            <span className="text-xs text-gray-400 flex-shrink-0">
              {stats.configured}/{stats.total}
            </span>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          {/* Navigation */}
          {deckStack.length > 1 && (
            <button
              onClick={navigateBack}
              className="p-1 text-gray-400 hover:text-white"
              title="Go back"
            >
              <ArrowLeft className="w-3 h-3" />
            </button>
          )}
          
          {editMode && (
            <button
              onClick={() => setWidgetEditMode(!widgetEditMode)}
              className={`p-1 rounded transition-colors ${
                widgetEditMode ? 'text-yellow-400' : 'text-gray-400 hover:text-white'
              }`}
              title="Edit buttons"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}
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
            <span>{currentDeck?.rows}×{currentDeck?.cols} deck</span>
            {widgetEditMode && (
              <span className="text-yellow-400">Edit Mode</span>
            )}
          </div>
        </div>
      )}

      {/* Overlays */}
      {renderDeckSelector()}
      <AnimatePresence>
        {contextMenu && renderContextMenu()}
      </AnimatePresence>
    </div>
  );
};

export default HotkeyDeckWidget;
