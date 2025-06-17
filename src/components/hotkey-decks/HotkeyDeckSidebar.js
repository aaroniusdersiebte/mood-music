import React from 'react';
import { motion } from 'framer-motion';
import { 
  X,
  Plus,
  Edit3,
  Trash2,
  Target,
  Grid,
  Layers,
  Keyboard,
  Music,
  Gamepad2,
  Filter,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const HotkeyDeckSidebar = ({ 
  decks, 
  categories, 
  selectedCategory, 
  onCategoryChange,
  activeDeck, 
  onDeckSelect, 
  onDeckDelete, 
  onCreateDeck, 
  onCloseSidebar 
}) => {
  
  const getDeckColorClass = (color) => {
    const colorMap = {
      blue: 'border-blue-500 bg-blue-500/10 text-blue-400',
      green: 'border-green-500 bg-green-500/10 text-green-400',
      purple: 'border-purple-500 bg-purple-500/10 text-purple-400',
      red: 'border-red-500 bg-red-500/10 text-red-400',
      yellow: 'border-yellow-500 bg-yellow-500/10 text-yellow-400',
      pink: 'border-pink-500 bg-pink-500/10 text-pink-400',
      cyan: 'border-cyan-500 bg-cyan-500/10 text-cyan-400',
      orange: 'border-orange-500 bg-orange-500/10 text-orange-400',
      gray: 'border-gray-500 bg-gray-500/10 text-gray-400'
    };
    return colorMap[color] || colorMap.blue;
  };

  const getTriggerIcon = (deck) => {
    switch (deck.triggerType) {
      case 'keyboard': return <Keyboard className="w-3 h-3" />;
      case 'midi': return <Music className="w-3 h-3" />;
      case 'both': return <Gamepad2 className="w-3 h-3" />;
      default: return null;
    }
  };

  const getCategoryDisplayName = (category) => {
    const categoryMap = {
      all: 'All Decks',
      general: 'General',
      music: 'Music',
      streaming: 'Streaming',
      games: 'Games',
      productivity: 'Productivity'
    };
    return categoryMap[category] || category;
  };

  const getDeckStats = (deck) => {
    const totalButtons = deck.rows * deck.cols;
    const configuredButtons = Object.keys(deck.buttons).length;
    return { total: totalButtons, configured: configuredButtons };
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col h-full"
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
            <Layers className="w-5 h-5 text-purple-400" />
            <span>Hotkey Decks</span>
          </h3>
          <button
            onClick={onCloseSidebar}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <Filter className="w-4 h-4" />
            <span>Filter by Category</span>
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:border-purple-500 focus:outline-none"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {getCategoryDisplayName(category)}
              </option>
            ))}
          </select>
        </div>

        {/* Create New Deck Button */}
        <button
          onClick={onCreateDeck}
          className="w-full mt-4 px-4 py-3 bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30 rounded-lg transition-colors flex items-center justify-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Deck</span>
        </button>
      </div>

      {/* Deck List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {decks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Grid className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No decks in this category</p>
            <p className="text-xs mt-1">Create your first deck to get started</p>
          </div>
        ) : (
          decks.map(deck => {
            const isActive = deck.id === activeDeck;
            const stats = getDeckStats(deck);
            const colorClass = getDeckColorClass(deck.color);
            
            return (
              <motion.div
                key={deck.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  isActive 
                    ? `${colorClass} ring-2 ring-${deck.color || 'blue'}-500/30`
                    : 'border-gray-600 bg-gray-700 hover:bg-gray-600 hover:border-gray-500'
                }`}
                onClick={() => onDeckSelect(deck.id)}
              >
                {/* Deck Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full bg-${deck.color || 'blue'}-500`}></div>
                      <h4 className={`font-medium truncate ${
                        isActive ? 'text-white' : 'text-gray-200'
                      }`}>
                        {deck.name}
                      </h4>
                      {isActive && (
                        <Target className="w-3 h-3 text-green-400 flex-shrink-0" />
                      )}
                    </div>
                    
                    {deck.description && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {deck.description}
                      </p>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center space-x-1 ml-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeckDelete(deck.id);
                      }}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete deck"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Deck Info */}
                <div className="space-y-2">
                  {/* Size and Stats */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 text-gray-400">
                      <Grid className="w-3 h-3" />
                      <span>{deck.rows}×{deck.cols}</span>
                    </div>
                    <div className="text-gray-400">
                      <span className={stats.configured > 0 ? 'text-blue-400' : ''}>
                        {stats.configured}
                      </span>
                      /{stats.total} configured
                    </div>
                  </div>

                  {/* Triggers */}
                  <div className="flex items-center space-x-2">
                    {deck.triggerType !== 'none' && (
                      <div className="flex items-center space-x-1">
                        {getTriggerIcon(deck)}
                        <span className="text-xs text-gray-400">
                          {deck.triggerType === 'keyboard' && deck.keyboardTrigger && (
                            <span className="px-1 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                              {deck.keyboardTrigger}
                            </span>
                          )}
                          {deck.triggerType === 'midi' && (
                            <span className="px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                              MIDI
                            </span>
                          )}
                          {deck.triggerType === 'both' && (
                            <span className="px-1 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                              Both
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    
                    {deck.triggerType === 'none' && (
                      <span className="text-xs text-gray-500">No trigger</span>
                    )}
                  </div>

                  {/* Category */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {getCategoryDisplayName(deck.category || 'general')}
                    </span>
                    
                    {/* Last Updated */}
                    <span className="text-xs text-gray-500">
                      {new Date(deck.updated).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Button Preview */}
                {stats.configured > 0 && (
                  <div className="mt-3 pt-2 border-t border-gray-600">
                    <div className="text-xs text-gray-400 mb-1">Recent buttons:</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.values(deck.buttons)
                        .slice(0, 3)
                        .map((button, index) => (
                          <span
                            key={index}
                            className={`px-1 py-0.5 text-xs rounded border ${getDeckColorClass(button.color || deck.color)}`}
                          >
                            {button.label || 'Unnamed'}
                          </span>
                        ))}
                      {stats.configured > 3 && (
                        <span className="px-1 py-0.5 text-xs rounded border border-gray-500 bg-gray-500/10 text-gray-400">
                          +{stats.configured - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 bg-gray-800">
        <div className="text-xs text-gray-400 space-y-1">
          <div className="flex items-center justify-between">
            <span>Total Decks:</span>
            <span className="text-white font-medium">{decks.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Active Category:</span>
            <span className="text-purple-400">{getCategoryDisplayName(selectedCategory)}</span>
          </div>
        </div>
        
        <div className="mt-3 text-xs text-gray-500">
          💡 <strong>Tip:</strong> Use keyboard shortcuts to quickly switch between decks
        </div>
      </div>
    </motion.div>
  );
};

export default HotkeyDeckSidebar;