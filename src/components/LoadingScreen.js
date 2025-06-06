import React from 'react';
import { motion } from 'framer-motion';
import { Music, Volume2 } from 'lucide-react';

const LoadingScreen = () => {
  return (
    <div className="h-screen bg-primary flex items-center justify-center">
      <div className="text-center">
        {/* Logo Animation */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative mb-8"
        >
          <div className="w-24 h-24 bg-secondary rounded-2xl flex items-center justify-center mx-auto">
            <Music className="w-12 h-12 text-white" />
          </div>
          
          {/* Floating Elements */}
          <motion.div
            animate={{ 
              y: [-10, 10, -10],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute -top-2 -right-2"
          >
            <div className="w-4 h-4 bg-green-400 rounded-full" />
          </motion.div>
          
          <motion.div
            animate={{ 
              y: [10, -10, 10],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ 
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1
            }}
            className="absolute -bottom-2 -left-2"
          >
            <div className="w-3 h-3 bg-blue-400 rounded-full" />
          </motion.div>
        </motion.div>

        {/* App Name */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-6"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Mood Music</h1>
          <p className="text-lg text-gray-400">Stream-ready music player</p>
        </motion.div>

        {/* Loading Animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="space-y-4"
        >
          {/* Progress Bar */}
          <div className="w-64 h-1 bg-gray-700 rounded-full mx-auto overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 2, ease: "easeInOut" }}
              className="h-full bg-gradient-to-r from-secondary to-green-400 rounded-full"
            />
          </div>

          {/* Loading Text */}
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="text-gray-400"
          >
            Initializing audio engine...
          </motion.div>
        </motion.div>

        {/* Feature Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-12 grid grid-cols-3 gap-8 max-w-md mx-auto"
        >
          <div className="text-center">
            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Music className="w-4 h-4 text-secondary" />
            </div>
            <div className="text-xs text-gray-500">Mood-based</div>
          </div>
          
          <div className="text-center">
            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-2">
              <Volume2 className="w-4 h-4 text-secondary" />
            </div>
            <div className="text-xs text-gray-500">OBS Ready</div>
          </div>
          
          <div className="text-center">
            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-2">
              <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
            </div>
            <div className="text-xs text-gray-500">Live Stream</div>
          </div>
        </motion.div>

        {/* Version */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 1.5 }}
          className="mt-8 text-xs text-gray-600"
        >
          Version 1.0.0
        </motion.div>
      </div>
    </div>
  );
};

export default LoadingScreen;