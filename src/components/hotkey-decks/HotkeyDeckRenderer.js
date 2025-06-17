import React from 'react';
import { motion } from 'framer-motion';
import { 
  Square,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Mic,
  Monitor,
  Music,
  Zap,
  Settings,
  Layers,
  Home,
  ArrowRight,
  Target,
  Gamepad2,
  Keyboard
} from 'lucide-react';

const HotkeyDeckRenderer = ({ deck, editMode, onButtonClick, onButtonExecute }) => {
  if (!deck) return null;

  const getButtonIcon = (button) => {
    if (!button || !button.type) return Square;
    
    // Custom icons
    if (button.icon) {
      const iconMap = {
        'play': Play,
        'pause': Pause,
        'skip-forward': SkipForward,
        'skip-back': SkipBack,
        'volume-2': Volume2,
        'volume-x': VolumeX,
        'mic': Mic,
        'monitor': Monitor,
        'music': Music,
        'zap': Zap,
        'settings': Settings,
        'layers': Layers,
        'home': Home,
        'arrow-right': ArrowRight,
        'target': Target,
        'gamepad': Gamepad2,
        'keyboard': Keyboard
      };
      return iconMap[button.icon] || Square;
    }
    
    // Default icons by type
    switch (button.type) {
      case 'hotkey': return Zap;
      case 'volume': return Volume2;
      case 'navigation': return Layers;
      case 'obs': return Monitor;
      case 'music': return Music;
      default: return Square;
    }
  };

  const getButtonColorClasses = (button) => {
    if (!button || !button.type) return {
      border: 'border-gray-600',
      bg: 'bg-gray-800',
      hoverBg: 'hover:bg-gray-700',
      text: 'text-gray-500'
    };
    
    const color = button.color || 'blue';
    
    const colorMap = {
      blue: {
        border: 'border-blue-500/50',
        bg: 'bg-blue-500/10',
        hoverBg: 'hover:bg-blue-500/20',
        text: 'text-blue-400',
        activeRing: 'ring-blue-500/30'
      },
      green: {
        border: 'border-green-500/50',
        bg: 'bg-green-500/10',
        hoverBg: 'hover:bg-green-500/20',
        text: 'text-green-400',
        activeRing: 'ring-green-500/30'
      },
      purple: {
        border: 'border-purple-500/50',
        bg: 'bg-purple-500/10',
        hoverBg: 'hover:bg-purple-500/20',
        text: 'text-purple-400',
        activeRing: 'ring-purple-500/30'
      },
      red: {
        border: 'border-red-500/50',
        bg: 'bg-red-500/10',
        hoverBg: 'hover:bg-red-500/20',
        text: 'text-red-400',
        activeRing: 'ring-red-500/30'
      },
      yellow: {
        border: 'border-yellow-500/50',
        bg: 'bg-yellow-500/10',
        hoverBg: 'hover:bg-yellow-500/20',
        text: 'text-yellow-400',
        activeRing: 'ring-yellow-500/30'
      },
      pink: {
        border: 'border-pink-500/50',
        bg: 'bg-pink-500/10',
        hoverBg: 'hover:bg-pink-500/20',
        text: 'text-pink-400',
        activeRing: 'ring-pink-500/30'
      },
      cyan: {
        border: 'border-cyan-500/50',
        bg: 'bg-cyan-500/10',
        hoverBg: 'hover:bg-cyan-500/20',
        text: 'text-cyan-400',
        activeRing: 'ring-cyan-500/30'
      },
      orange: {
        border: 'border-orange-500/50',
        bg: 'bg-orange-500/10',
        hoverBg: 'hover:bg-orange-500/20',
        text: 'text-orange-400',
        activeRing: 'ring-orange-500/30'
      },
      gray: {
        border: 'border-gray-600',
        bg: 'bg-gray-800',
        hoverBg: 'hover:bg-gray-700',
        text: 'text-gray-400',
        activeRing: 'ring-gray-500/30'
      }
    };
    
    return colorMap[color] || colorMap.blue;
  };

  const renderButton = (row, col) => {
    const buttonKey = `${row}-${col}`;
    const button = deck.buttons[buttonKey];
    const Icon = getButtonIcon(button);
    const colorClasses = getButtonColorClasses(button);

    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (editMode) {
        onButtonClick(deck.id, buttonKey);
      } else {
        if (button && button.type && button.type !== 'empty') {
          onButtonExecute(button, deck.id, buttonKey);
        }
      }
    };

    const handleContextMenu = (e) => {
      e.preventDefault();
      if (!editMode) {
        onButtonClick(deck.id, buttonKey);
      }
    };

    return (
      <motion.button
        key={buttonKey}
        layout
        whileHover={{ scale: editMode ? 1.02 : 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        className={`
          relative aspect-square border-2 rounded-lg cursor-pointer
          transition-all duration-200 flex flex-col items-center justify-center p-2
          ${editMode ? 'ring-2 ring-yellow-500/30 border-yellow-400' : 
            button ? `${colorClasses.border} ${colorClasses.bg} ${colorClasses.hoverBg}` :
            'border-gray-600 bg-gray-800 hover:bg-gray-700'}
          ${!editMode && button ? 'hover:ring-2 ' + colorClasses.activeRing : ''}
        `}
        title={button?.label || 'Empty slot'}
      >
        {/* Icon */}
        <Icon className={`w-6 h-6 ${button ? colorClasses.text : 'text-gray-500'}`} />
        
        {/* Label */}
        {button && button.label && (
          <div className="text-center mt-1">
            <div className="text-xs font-medium text-white truncate max-w-full">
              {button.label}
            </div>
          </div>
        )}

        {/* Keyboard Trigger Indicator */}
        {button && button.keyboardTrigger && (
          <div className="absolute top-1 right-1">
            <div className="px-1 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded border border-purple-500/30">
              <Keyboard className="w-2 h-2 inline mr-0.5" />
              {button.keyboardTrigger.length > 8 ? '⌨️' : button.keyboardTrigger}
            </div>
          </div>
        )}

        {/* MIDI Trigger Indicator */}
        {button && button.midiTrigger && (
          <div className="absolute top-1 left-1">
            <div className="px-1 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30">
              🎹 {button.midiTrigger}
            </div>
          </div>
        )}

        {/* Edit Mode Indicator */}
        {editMode && (
          <div className="absolute bottom-1 right-1">
            <div className="w-2 h-2 bg-yellow-400 rounded-full shadow-lg"></div>
          </div>
        )}

        {/* Empty Slot Indicator */}
        {!button && editMode && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs text-gray-500 text-center">
              Click to<br />configure
            </div>
          </div>
        )}
      </motion.button>
    );
  };

  const renderGrid = () => {
    const buttons = [];
    for (let row = 0; row < deck.rows; row++) {
      for (let col = 0; col < deck.cols; col++) {
        buttons.push(renderButton(row, col));
      }
    }

    return (
      <div 
        className="grid gap-3 p-6"
        style={{ 
          gridTemplateColumns: `repeat(${deck.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${deck.rows}, minmax(0, 1fr))`
        }}
      >
        {buttons}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Deck Info Bar */}
      <div className="px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full bg-${deck.color || 'blue'}-500`}></div>
              <h4 className="text-lg font-medium text-white">{deck.name}</h4>
            </div>
            
            {deck.description && (
              <p className="text-sm text-gray-400">{deck.description}</p>
            )}
            
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>{deck.rows}×{deck.cols}</span>
              <span>•</span>
              <span>{deck.category || 'general'}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Trigger Indicators */}
            {deck.keyboardTrigger && (deck.triggerType === 'keyboard' || deck.triggerType === 'both') && (
              <div className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded border border-purple-500/30 flex items-center space-x-1">
                <Keyboard className="w-3 h-3" />
                <span>{deck.keyboardTrigger}</span>
              </div>
            )}
            
            {deck.midiTrigger && (deck.triggerType === 'midi' || deck.triggerType === 'both') && (
              <div className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30 flex items-center space-x-1">
                <Music className="w-3 h-3" />
                <span>MIDI {deck.midiTrigger}</span>
              </div>
            )}
            
            {/* Button Count */}
            <div className="text-xs text-gray-400">
              {Object.keys(deck.buttons).length}/{deck.rows * deck.cols} configured
            </div>
          </div>
        </div>
      </div>

      {/* Button Grid */}
      <div className="flex-1 overflow-auto">
        {renderGrid()}
      </div>

      {/* Help Text */}
      <div className="px-6 py-3 bg-gray-800 border-t border-gray-700">
        <div className="text-xs text-gray-400">
          {editMode ? (
            <span><strong>Edit Mode:</strong> Click any button to configure • Right-click to edit in normal mode</span>
          ) : (
            <span><strong>Execute Mode:</strong> Left-click to execute • Right-click to edit • Use keyboard shortcuts for quick access</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default HotkeyDeckRenderer;