import React from 'react';
import { motion } from 'framer-motion';
import { Music, Settings, Grid, Volume2 } from 'lucide-react';
import useMoodStore from '../stores/moodStore';

const Sidebar = ({ currentView, onViewChange }) => {
  const { isPlaying, currentSong } = useMoodStore();

  const navigationItems = [
    {
      id: 'moods',
      label: 'Moods',
      icon: Grid,
      description: 'Manage your music moods'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'App and OBS configuration'
    }
  ];

  return (
    <div className="w-64 bg-gray-900 border-r border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Mood Music</h1>
            <p className="text-xs text-gray-400">Streaming Music Player</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 p-4">
        <nav className="space-y-2">
          {navigationItems.map((item) => (
            <motion.button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 group ${
                currentView === item.id
                  ? 'bg-secondary text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <item.icon className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium">{item.label}</div>
                <div className="text-xs opacity-60">{item.description}</div>
              </div>
            </motion.button>
          ))}
        </nav>
      </div>

      {/* Now Playing Info */}
      {currentSong && (
        <div className="p-4 border-t border-gray-700">
          <div className="glass rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gray-700 rounded-lg overflow-hidden">
                  {currentSong.cover ? (
                    <img 
                      src={currentSong.cover} 
                      alt="Album cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                </div>
                {isPlaying && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full animate-pulse">
                    <Volume2 className="w-2 h-2 text-white m-0.5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">
                  {currentSong.title}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {currentSong.artist}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Version Info */}
      <div className="p-4 border-t border-gray-700">
        <div className="text-center">
          <div className="text-xs text-gray-500">Version 1.0.0</div>
          <div className="text-xs text-gray-600 mt-1">
            OBS Ready • Stream Optimized
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;