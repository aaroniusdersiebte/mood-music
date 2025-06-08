// 🎯 OBS Browser Refresh Panel - Einfaches Test-Interface
import React, { useState, useEffect } from 'react';
import { Zap, Monitor, RefreshCw, Eye, Play, Bug } from 'lucide-react';
import useMoodStore from '../stores/moodStore';

const OBSBrowserRefreshPanel = () => {
  const [status, setStatus] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugOutput, setDebugOutput] = useState([]);
  const { currentSong, activeMood, moods } = useMoodStore();

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const updateStatus = () => {
    if (window.obsBrowserRefresh) {
      const newStatus = window.obsBrowserRefresh.getStatus();
      setStatus(newStatus);
    }
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    addDebugMessage('🔄 Manual refresh triggered');
    
    try {
      if (window.obsBrowserRefresh) {
        await window.obsBrowserRefresh.manualRefresh();
        addDebugMessage('✅ Manual refresh completed');
      } else {
        addDebugMessage('❌ Browser Refresh Service not available');
      }
    } catch (error) {
      addDebugMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRediscover = async () => {
    addDebugMessage('🔍 Rediscovering browser sources');
    
    try {
      if (window.obsBrowserRefresh) {
        await window.obsBrowserRefresh.rediscover();
        setTimeout(updateStatus, 1000);
        addDebugMessage('✅ Discovery completed');
      } else {
        addDebugMessage('❌ Browser Refresh Service not available');
      }
    } catch (error) {
      addDebugMessage(`❌ Discovery failed: ${error.message}`);
    }
  };

  const handleTestCurrentSong = async () => {
    if (!currentSong) {
      addDebugMessage('❌ No current song to test');
      return;
    }
    
    addDebugMessage(`🎵 Testing with: "${currentSong.title}"`);
    
    try {
      if (window.obsBrowserRefresh) {
        await window.obsBrowserRefresh.testWithCurrentSong();
        addDebugMessage('✅ Test completed');
      } else {
        addDebugMessage('❌ Browser Refresh Service not available');
      }
    } catch (error) {
      addDebugMessage(`❌ Test failed: ${error.message}`);
    }
  };

  const handleDebug = () => {
    if (window.obsBrowserRefresh) {
      window.obsBrowserRefresh.debug();
      addDebugMessage('🐛 Debug info printed to console');
    }
  };

  const addDebugMessage = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugOutput(prev => [...prev.slice(-4), `[${timestamp}] ${message}`]);
  };

  if (!status) {
    return (
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="w-5 h-5 text-green-400" />
          <h3 className="text-lg font-semibold">OBS Browser Refresh</h3>
        </div>
        <p className="text-gray-400">Initializing...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center gap-3 mb-6">
        <Zap className="w-5 h-5 text-green-400" />
        <h3 className="text-lg font-semibold">OBS Browser Refresh</h3>
        <div className="flex gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            status.obsConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            OBS {status.obsConnected ? 'Connected' : 'Disconnected'}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            status.initialized ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
          }`}>
            {status.initialized ? 'Initialized' : 'Starting'}
          </span>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-secondary/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">Browser Sources</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {status.browserSourcesCount}
          </div>
          <div className="text-xs text-gray-400">
            Mood Music sources found
          </div>
        </div>

        <div className="bg-secondary/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className={`w-4 h-4 text-green-400 ${status.monitoring ? 'animate-pulse' : ''}`} />
            <span className="text-sm font-medium">Monitoring</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {status.monitoring ? 'Active' : 'Inactive'}
          </div>
          <div className="text-xs text-gray-400">
            Song change detection
          </div>
        </div>
      </div>

      {/* Current Song Info */}
      {currentSong && (
        <div className="bg-primary/30 rounded-lg p-4 mb-6">
          <div className="text-sm font-medium text-white mb-2">🎵 Current Song:</div>
          <div className="text-lg font-bold text-accent">{currentSong.title}</div>
          <div className="text-sm text-gray-300">{currentSong.artist}</div>
          <div className="text-xs text-gray-400 mt-1">
            Mood: {moods.find(m => m.id === activeMood)?.name || 'Unknown'} | 
            Last Song ID: {status.lastSongId ? status.lastSongId.slice(-8) : 'None'}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing || !status.obsConnected}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-accent hover:bg-accent/80 
                     disabled:bg-accent/50 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Manual Refresh'}
        </button>

        <button
          onClick={handleRediscover}
          disabled={!status.obsConnected}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 
                     disabled:bg-blue-500/50 text-white rounded-lg transition-colors"
        >
          <Eye className="w-4 h-4" />
          Rediscover Sources
        </button>

        <button
          onClick={handleTestCurrentSong}
          disabled={!currentSong || !status.obsConnected}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 
                     disabled:bg-purple-500/50 text-white rounded-lg transition-colors"
        >
          <Play className="w-4 h-4" />
          Test Current Song
        </button>

        <button
          onClick={handleDebug}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-600 hover:bg-gray-700 
                     text-white rounded-lg transition-colors"
        >
          <Bug className="w-4 h-4" />
          Debug Info
        </button>
      </div>

      {/* Debug Output */}
      {debugOutput.length > 0 && (
        <div className="border-t border-secondary pt-4 mb-4">
          <h4 className="text-sm font-medium mb-3">Recent Activity:</h4>
          <div className="bg-black/30 rounded-lg p-3 font-mono text-xs space-y-1">
            {debugOutput.map((line, index) => (
              <div key={index} className="text-gray-300">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
        <h4 className="text-sm font-semibold text-green-400 mb-2">🎯 Setup Instructions:</h4>
        <div className="text-xs text-green-300 space-y-1">
          <div><strong>1.</strong> Create a Browser Source in OBS</div>
          <div><strong>2.</strong> Name it with "mood", "music", or "song" (e.g., "Mood Music Display")</div>
          <div><strong>3.</strong> Set URL to your obs-display.html file</div>
          <div><strong>4.</strong> Set size to 800x200</div>
          <div><strong>5.</strong> Play a song and watch it auto-refresh! 🎵</div>
        </div>
        
        {status.browserSourcesCount === 0 && status.obsConnected && (
          <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <div className="text-xs text-yellow-300">
              ⚠️ No browser sources found. Make sure your browser source name contains "mood", "music", or "song".
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OBSBrowserRefreshPanel;