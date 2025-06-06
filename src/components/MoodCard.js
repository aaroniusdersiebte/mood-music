import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Edit, Trash2, Upload, Music, MoreVertical } from 'lucide-react';

const MoodCard = ({ 
  mood, 
  isActive, 
  isPlaying, 
  onClick, 
  onPlay,
  onEdit, 
  onDelete, 
  onSelectSongs,
  onDrop 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleMenuClick = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const handleMenuAction = (action, e) => {
    e.stopPropagation();
    setShowMenu(false);
    action();
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && onDrop) {
      onDrop(mood.id, files);
    }
  };

  const getPulseAnimation = () => {
    if (mood.pulseSpeed < 1) {
      return 'animate-pulse-fast';
    } else if (mood.pulseSpeed > 2) {
      return 'animate-pulse-slow';
    }
    return 'animate-pulse';
  };

  const getIntensityClass = () => {
    switch (mood.intensity) {
      case 'subtle': return 'opacity-30';
      case 'moderate': return 'opacity-50';
      case 'extreme': return 'opacity-70';
      default: return 'opacity-40';
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`mood-card relative bg-gray-800 border transition-all duration-300 cursor-pointer min-h-48 ${
        isDragOver 
          ? 'border-secondary shadow-lg shadow-secondary/30 scale-105' 
          : isActive 
          ? 'border-secondary shadow-lg shadow-secondary/20' 
          : 'border-gray-700 hover:border-gray-600'
      }`}
      style={{ '--mood-color': mood.color }}
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Animated Background */}
      <div 
        className={`absolute inset-0 rounded-xl transition-all duration-500 ${
          isActive && isPlaying ? getPulseAnimation() : ''
        } ${getIntensityClass()}`}
        style={{
          background: isDragOver 
            ? `linear-gradient(135deg, ${mood.color}60 0%, ${mood.color}20 70%)`
            : `linear-gradient(135deg, ${mood.color}20 0%, transparent 70%)`,
        }}
      />

      {/* Drag Over Indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
          <div className="text-center">
            <Upload className="w-8 h-8 text-white mx-auto mb-2" />
            <div className="text-white font-medium">Drop music files here</div>
            <div className="text-gray-300 text-sm">to add to {mood.name}</div>
          </div>
        </div>
      )}

      {/* Mood Indicator Dot */}
      {isActive && (
        <div 
          className={`absolute top-3 right-3 w-3 h-3 rounded-full ${
            isPlaying ? 'animate-pulse' : ''
          }`}
          style={{ backgroundColor: mood.color }}
        />
      )}

      {/* Menu Button */}
      <div className="absolute top-3 right-3">
        <div className="relative">
          <button
            onClick={handleMenuClick}
            className="p-1 rounded-full bg-black/20 backdrop-blur-sm text-gray-300 hover:text-white hover:bg-black/40 transition-all duration-200 opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Context Menu */}
          {showMenu && (
            <div className="context-menu absolute top-full right-0 mt-1">
              <button
                onClick={(e) => handleMenuAction(onEdit, e)}
                className="context-menu-item"
              >
                <Edit className="w-4 h-4" />
                Edit Mood
              </button>
              <button
                onClick={(e) => handleMenuAction(onSelectSongs, e)}
                className="context-menu-item"
              >
                <Upload className="w-4 h-4" />
                Manage Songs
              </button>
              <hr className="border-gray-600 my-1" />
              <button
                onClick={(e) => handleMenuAction(onDelete, e)}
                className="context-menu-item text-red-400 hover:bg-red-600/20"
              >
                <Trash2 className="w-4 h-4" />
                Delete Mood
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 p-4 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: mood.color }}
          />
          <div className="text-right text-xs text-gray-400">
            {mood.songs.length} songs
          </div>
        </div>

        {/* Mood Name */}
        <div className="flex-1 flex flex-col justify-center">
          <h3 className="text-xl font-bold text-white mb-2">
            {mood.name}
          </h3>
          
          {/* Stats */}
          <div className="space-y-1 text-sm text-gray-400">
            <div>Speed: {mood.pulseSpeed}s</div>
            <div>Intensity: {mood.intensity}</div>
          </div>
        </div>

        {/* Play Button */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            {mood.songs.length > 0 ? (
              <div className="flex items-center text-green-400">
                <Music className="w-4 h-4 mr-1" />
                <span className="text-xs">Ready</span>
              </div>
            ) : (
              <div className="flex items-center text-yellow-400">
                <Upload className="w-4 h-4 mr-1" />
                <span className="text-xs">Add songs</span>
              </div>
            )}
          </div>

          {mood.songs.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 ${
                isActive
                  ? 'bg-secondary text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onPlay(); // Verwende onPlay statt onClick
              }}
            >
              {isActive && isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </motion.button>
          )}
        </div>
      </div>

      {/* Active Indicator */}
      {isActive && (
        <div 
          className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl"
          style={{ backgroundColor: mood.color }}
        />
      )}
    </motion.div>
  );
};

export default MoodCard;