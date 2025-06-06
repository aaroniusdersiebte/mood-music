import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Shuffle,
  Music,
  Maximize2
} from 'lucide-react';
import useMoodStore from '../stores/moodStore';
import audioService from '../services/audioService';
import fileUtils from '../utils/fileUtils';

const Player = () => {
  const {
    currentSong,
    isPlaying,
    volume,
    shuffle,
    activeMood,
    moods,
    setIsPlaying,
    setVolume,
    setShuffle,
    nextSong,
    prevSong
  } = useMoodStore();

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [previousVolume, setPreviousVolume] = useState(volume);

  // Update progress
  useEffect(() => {
    const updateProgress = () => {
      if (!isDragging && audioService.currentHowl) {
        setCurrentTime(audioService.getCurrentTime());
        setDuration(audioService.getDuration());
      }
    };

    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [isDragging]);

  const handlePlayPause = () => {
    if (!currentSong) return;
    setIsPlaying(!isPlaying);
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(previousVolume);
      setIsMuted(false);
    } else {
      setPreviousVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleProgressClick = (e) => {
    if (!audioService.currentHowl || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const newTime = clickPercent * duration;

    audioService.seek(newTime);
    setCurrentTime(newTime);
  };

  const getCurrentMood = () => {
    return moods.find(mood => mood.id === activeMood);
  };

  const currentMood = getCurrentMood();

  if (!currentSong) {
    return (
      <div className="h-20 bg-gray-900 border-t border-gray-700 flex items-center justify-center">
        <div className="flex items-center text-gray-500">
          <Music className="w-5 h-5 mr-2" />
          <span>Select a mood to start playing music</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-20 bg-gray-900 border-t border-gray-700 flex items-center">
      {/* Song Info */}
      <div className="flex-1 flex items-center px-4">
        <div className="flex items-center min-w-0">
          {/* Album Cover */}
          <div className="w-12 h-12 bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 mr-3">
            {currentSong.cover ? (
              <img 
                src={currentSong.cover} 
                alt="Album cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Music className="w-6 h-6 text-gray-400" />
              </div>
            )}
          </div>

          {/* Song Details */}
          <div className="min-w-0 flex-1">
            <div className="text-white font-medium truncate">
              {currentSong.title}
            </div>
            <div className="text-gray-400 text-sm truncate">
              {currentSong.artist}
            </div>
          </div>

          {/* Mood Indicator */}
          {currentMood && (
            <div className="ml-4 flex items-center">
              <div 
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: currentMood.color }}
              />
              <span className="text-xs text-gray-400">{currentMood.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Player Controls */}
      <div className="flex-1 flex flex-col items-center max-w-md">
        {/* Control Buttons */}
        <div className="flex items-center space-x-4 mb-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShuffle(!shuffle)}
            className={`p-2 rounded-full transition-colors ${
              shuffle 
                ? 'text-secondary bg-secondary/20' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Shuffle className="w-4 h-4" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={prevSong}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handlePlayPause}
            className="w-10 h-10 bg-secondary hover:bg-secondary/80 rounded-full flex items-center justify-center text-white transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={nextSong}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="text-gray-400 hover:text-white transition-colors"
            title="Expand Player"
          >
            <Maximize2 className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Progress Bar */}
        <div className="w-full flex items-center space-x-2">
          <span className="text-xs text-gray-400 min-w-12">
            {fileUtils.formatDuration(currentTime)}
          </span>
          
          <div 
            className="flex-1 h-1 bg-gray-700 rounded-full cursor-pointer group"
            onClick={handleProgressClick}
          >
            <div 
              className="h-full bg-secondary rounded-full transition-all duration-200 group-hover:bg-secondary/80 relative"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-secondary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          
          <span className="text-xs text-gray-400 min-w-12">
            {fileUtils.formatDuration(duration)}
          </span>
        </div>
      </div>

      {/* Volume Control */}
      <div className="flex-1 flex items-center justify-end px-4">
        <div className="flex items-center space-x-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleMuteToggle}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </motion.button>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-24 volume-slider"
          />
          
          <span className="text-xs text-gray-400 min-w-8">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default Player;