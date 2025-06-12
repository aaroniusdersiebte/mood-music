import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Palette, 
  Play, 
  Pause, 
  Heart, 
  Star, 
  Clock, 
  Shuffle, 
  Settings,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  MoreHorizontal
} from 'lucide-react';
import configService from '../../services/configService';

const MoodSelectorWidget = ({ component, editMode, onUpdate, onRemove, performanceMode }) => {
  const [moods, setMoods] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [recentlyUsed, setRecentlyUsed] = useState([]);
  const [currentMood, setCurrentMood] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', 'compact'
  const [showContextMenu, setShowContextMenu] = useState(null);

  useEffect(() => {
    loadMoods();
    loadMoodShortcuts();
    
    // Listen for music state changes
    const handleMusicStateChange = (state) => {
      setIsPlaying(state.isPlaying);
      setCurrentMood(state.currentMood);
    };

    window.addEventListener('musicStateChanged', handleMusicStateChange);
    return () => window.removeEventListener('musicStateChanged', handleMusicStateChange);
  }, []);

  const loadMoods = async () => {
    try {
      // This should be replaced with your actual mood loading logic
      const mockMoods = [
        {
          id: 'energetic',
          name: 'Energetic',
          color: '#ff6b6b',
          background: '/assets/moods/energetic.jpg',
          songCount: 45,
          description: 'High energy tracks for motivation'
        },
        {
          id: 'chill',
          name: 'Chill',
          color: '#4ecdc4',
          background: '/assets/moods/chill.jpg',
          songCount: 32,
          description: 'Relaxing vibes for focus'
        },
        {
          id: 'focus',
          name: 'Focus',
          color: '#45b7d1',
          background: '/assets/moods/focus.jpg',
          songCount: 28,
          description: 'Concentration music'
        },
        {
          id: 'gaming',
          name: 'Gaming',
          color: '#96ceb4',
          background: '/assets/moods/gaming.jpg',
          songCount: 52,
          description: 'Epic gaming soundtracks'
        },
        {
          id: 'ambient',
          name: 'Ambient',
          color: '#ffeaa7',
          background: '/assets/moods/ambient.jpg',
          songCount: 19,
          description: 'Atmospheric background music'
        },
        {
          id: 'dark',
          name: 'Dark',
          color: '#6c5ce7',
          background: '/assets/moods/dark.jpg',
          songCount: 37,
          description: 'Dark and mysterious tracks'
        }
      ];
      setMoods(mockMoods);
    } catch (error) {
      console.error('Failed to load moods:', error);
    }
  };

  const loadMoodShortcuts = () => {
    const shortcuts = configService.getMoodShortcuts();
    setFavorites(shortcuts.favorites || []);
    setRecentlyUsed(shortcuts.recentlyUsed || []);
  };

  const saveMoodShortcuts = async () => {
    const shortcuts = {
      favorites,
      recentlyUsed,
      quickAccess: favorites.slice(0, 6) // Top 6 favorites as quick access
    };
    await configService.setMoodShortcuts(shortcuts);
  };

  const playMood = async (mood) => {
    try {
      // Add to recently used
      const updatedRecent = [mood.id, ...recentlyUsed.filter(id => id !== mood.id)].slice(0, 10);
      setRecentlyUsed(updatedRecent);
      
      // Trigger mood playback
      const event = new CustomEvent('playMood', {
        detail: { mood }
      });
      window.dispatchEvent(event);
      
      setCurrentMood(mood);
      setIsPlaying(true);
      
      // Save updated shortcuts
      await saveMoodShortcuts();
      
      console.log('Playing mood:', mood.name);
    } catch (error) {
      console.error('Failed to play mood:', error);
    }
  };

  const toggleFavorite = async (moodId) => {
    const updatedFavorites = favorites.includes(moodId)
      ? favorites.filter(id => id !== moodId)
      : [...favorites, moodId];
    
    setFavorites(updatedFavorites);
    await saveMoodShortcuts();
  };

  const handleContextMenu = (e, mood) => {
    e.preventDefault();
    e.stopPropagation();
    
    setShowContextMenu({
      x: e.clientX,
      y: e.clientY,
      mood
    });
  };

  const renderMoodCard = (mood, size = 'normal') => {
    const isFavorite = favorites.includes(mood.id);
    const isRecent = recentlyUsed.includes(mood.id);
    const isCurrent = currentMood?.id === mood.id;
    
    const cardClasses = {
      normal: 'p-3 rounded-lg border-2 transition-all cursor-pointer',
      compact: 'p-2 rounded border transition-all cursor-pointer',
      large: 'p-4 rounded-xl border-2 transition-all cursor-pointer'
    };

    return (
      <motion.div
        key={mood.id}
        layout={!performanceMode}
        whileHover={!performanceMode ? { scale: 1.02 } : {}}
        whileTap={!performanceMode ? { scale: 0.98 } : {}}
        className={`
          ${cardClasses[size]}
          ${isCurrent 
            ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20' 
            : 'border-gray-600 bg-gray-700 hover:bg-gray-600 hover:border-gray-500'
          }
        `}
        style={{
          background: isCurrent ? `linear-gradient(135deg, ${mood.color}20, ${mood.color}10)` : undefined
        }}
        onClick={() => playMood(mood)}
        onContextMenu={(e) => handleContextMenu(e, mood)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: mood.color }}
            />
            <h4 className={`font-medium text-white ${size === 'compact' ? 'text-sm' : 'text-base'}`}>
              {mood.name}
            </h4>
          </div>
          
          <div className="flex items-center space-x-1">
            {isCurrent && isPlaying && (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            )}
            {isFavorite && (
              <Heart className="w-3 h-3 text-red-400 fill-current" />
            )}
            {isRecent && !isFavorite && (
              <Clock className="w-3 h-3 text-yellow-400" />
            )}
          </div>
        </div>
        
        {size !== 'compact' && (
          <>
            <p className="text-xs text-gray-400 mb-2">{mood.description}</p>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{mood.songCount} songs</span>
              {isCurrent && (
                <div className="flex items-center space-x-1 text-blue-400">
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                  <span>Playing</span>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    );
  };

  const renderContextMenu = () => {
    if (!showContextMenu) return null;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-2 min-w-[150px]"
        style={{ left: showContextMenu.x, top: showContextMenu.y }}
        onMouseLeave={() => setShowContextMenu(null)}
      >
        <button
          onClick={() => {
            playMood(showContextMenu.mood);
            setShowContextMenu(null);
          }}
          className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>Play</span>
        </button>
        
        <button
          onClick={() => {
            toggleFavorite(showContextMenu.mood.id);
            setShowContextMenu(null);
          }}
          className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
        >
          <Heart className={`w-4 h-4 ${favorites.includes(showContextMenu.mood.id) ? 'text-red-400 fill-current' : ''}`} />
          <span>{favorites.includes(showContextMenu.mood.id) ? 'Remove Favorite' : 'Add Favorite'}</span>
        </button>
        
        <button
          onClick={() => {
            // Add shuffle functionality
            const event = new CustomEvent('shuffleMood', {
              detail: { mood: showContextMenu.mood }
            });
            window.dispatchEvent(event);
            setShowContextMenu(null);
          }}
          className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 flex items-center space-x-2"
        >
          <Shuffle className="w-4 h-4" />
          <span>Shuffle</span>
        </button>
      </motion.div>
    );
  };

  const renderWidget = () => {
    const visibleMoods = viewMode === 'favorites' 
      ? moods.filter(mood => favorites.includes(mood.id))
      : viewMode === 'recent'
      ? moods.filter(mood => recentlyUsed.includes(mood.id))
      : moods;

    return (
      <div className="h-full flex flex-col bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        {/* Widget Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-750">
          <div className="flex items-center space-x-2">
            <Palette className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-medium text-white">Moods</h3>
            {currentMood && (
              <div className="flex items-center space-x-1 text-xs">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: currentMood.color }}
                />
                <span className="text-gray-400">{currentMood.name}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-1">
            {/* View Mode Toggle */}
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="text-xs bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white"
            >
              <option value="grid">All</option>
              <option value="favorites">Favorites</option>
              <option value="recent">Recent</option>
            </select>
            
            {editMode && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-1 text-gray-400 hover:text-white"
              >
                <Settings className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Widget Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {visibleMoods.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              <div className="text-center">
                <Palette className="w-6 h-6 mx-auto mb-2 opacity-50" />
                <div>No moods {viewMode !== 'grid' ? `in ${viewMode}` : 'available'}</div>
              </div>
            </div>
          ) : (
            <div className={`grid gap-2 ${
              component.size.width < 250 ? 'grid-cols-1' : 
              component.size.width < 400 ? 'grid-cols-2' : 'grid-cols-3'
            }`}>
              {visibleMoods.map(mood => renderMoodCard(mood, 
                component.size.width < 250 ? 'compact' : 'normal'
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {favorites.length > 0 && viewMode === 'grid' && (
          <div className="border-t border-gray-700 p-2 bg-gray-750">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Quick Access</span>
              <Star className="w-3 h-3 text-yellow-400" />
            </div>
            <div className="flex space-x-1 overflow-x-auto">
              {favorites.slice(0, 4).map(favoriteId => {
                const mood = moods.find(m => m.id === favoriteId);
                if (!mood) return null;
                
                return (
                  <button
                    key={mood.id}
                    onClick={() => playMood(mood)}
                    className="flex-shrink-0 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs text-white transition-colors"
                    style={{ borderLeft: `3px solid ${mood.color}` }}
                  >
                    {mood.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {renderWidget()}
      <AnimatePresence>
        {showContextMenu && renderContextMenu()}
      </AnimatePresence>
    </>
  );
};

export default MoodSelectorWidget;
