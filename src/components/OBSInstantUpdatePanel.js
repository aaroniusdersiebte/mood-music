// 🚀 OBS Instant Update Test Panel
import React, { useState, useEffect } from 'react';
import { Zap, Monitor, RefreshCw, Eye, Settings2, AlertCircle } from 'lucide-react';
import useMoodStore from '../stores/moodStore';

const OBSInstantUpdatePanel = () => {
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
    if (window.obsInstantUpdateService) {
      const newStatus = window.obsInstantUpdateService.getStatus();
      setStatus(newStatus);
    }
  };

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      if (window.obsInstantUpdateService) {
        const success = await window.obsInstantUpdateService.forceRefresh();
        
        if (success) {
          addDebugMessage('✅ Manual refresh successful');
        } else {
          addDebugMessage('❌ Manual refresh failed');
        }
      } else {
        addDebugMessage('❌ OBS Instant Update Service not available');
      }
    } catch (error) {
      addDebugMessage(`❌ Error: ${error.message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDebug = () => {
    if (window.obsInstantUpdateService) {
      window.obsInstantUpdateService.debug();
      addDebugMessage('🐛 Debug info printed to console');
    }
  };

  const handleDiscoverSources = async () => {
    if (window.obsInstantUpdateService) {
      try {
        await window.obsInstantUpdateService.discoverBrowserSources();
        addDebugMessage('🔍 Browser source discovery triggered');
        setTimeout(updateStatus, 1000);
      } catch (error) {
        addDebugMessage(`❌ Discovery failed: ${error.message}`);
      }
    }
  };
  
  const handleTestSongChange = () => {
    if (window.obsInstantUpdateService && currentSong) {
      try {
        window.obsInstantUpdateService.handleSongChange(currentSong);
        addDebugMessage(`🎵 Triggered test song change: ${currentSong.title}`);
      } catch (error) {
        addDebugMessage(`❌ Test failed: ${error.message}`);
      }
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
          <Zap className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold">OBS Instant Update</h3>
        </div>
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center gap-3 mb-6">
        <Zap className="w-5 h-5 text-yellow-400" />
        <h3 className="text-lg font-semibold">OBS Instant Update</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          status.connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {status.connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Status Info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-secondary/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">Browser Sources</span>
          </div>
          <div className="text-2xl font-bold text-blue-400">
            {status.browserSources}
          </div>
          <div className="text-xs text-gray-400">
            Discovered sources
          </div>
        </div>

        <div className="bg-secondary/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw className={`w-4 h-4 text-green-400 ${status.isProcessing ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">Queue</span>
          </div>
          <div className="text-2xl font-bold text-green-400">
            {status.queueLength}
          </div>
          <div className="text-xs text-gray-400">
            Pending updates
          </div>
        </div>
      </div>
      
      {/* Current Song Info */}
      {currentSong && (
        <div className="bg-primary/30 rounded-lg p-4 mb-6">
          <div className="text-sm font-medium text-white mb-2">Current Song:</div>
          <div className="text-lg font-bold text-accent">{currentSong.title}</div>
          <div className="text-sm text-gray-300">{currentSong.artist}</div>
          <div className="text-xs text-gray-400 mt-1">
            Mood: {moods.find(m => m.id === activeMood)?.name || 'Unknown'}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={handleForceRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 
                     disabled:bg-accent/50 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Force Refresh'}
        </button>

        <button
          onClick={handleDiscoverSources}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 
                     text-white rounded-lg transition-colors"
        >
          <Eye className="w-4 h-4" />
          Discover Sources
        </button>
        
        <button
          onClick={handleTestSongChange}
          disabled={!currentSong}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 
                     disabled:bg-purple-500/50 text-white rounded-lg transition-colors"
        >
          <Zap className="w-4 h-4" />
          Test Current Song
        </button>

        <button
          onClick={handleDebug}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 
                     text-white rounded-lg transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          Debug Info
        </button>
      </div>

      {/* Settings */}
      <div className="border-t border-secondary pt-4 mb-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          Settings
        </h4>
        
        <div className="space-y-2">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={status.settings.instantUpdate}
              onChange={(e) => {
                if (window.obsInstantUpdateService) {
                  window.obsInstantUpdateService.updateSettings({
                    instantUpdate: e.target.checked
                  });
                  setTimeout(updateStatus, 100);
                }
              }}
              className="rounded"
            />
            <span className="text-sm">Instant Updates</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={status.settings.useBrowserSourceRefresh}
              onChange={(e) => {
                if (window.obsInstantUpdateService) {
                  window.obsInstantUpdateService.updateSettings({
                    useBrowserSourceRefresh: e.target.checked
                  });
                  setTimeout(updateStatus, 100);
                }
              }}
              className="rounded"
            />
            <span className="text-sm">Browser Source Refresh</span>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={status.settings.debugMode}
              onChange={(e) => {
                if (window.obsInstantUpdateService) {
                  window.obsInstantUpdateService.updateSettings({
                    debugMode: e.target.checked
                  });
                  setTimeout(updateStatus, 100);
                }
              }}
              className="rounded"
            />
            <span className="text-sm">Debug Mode</span>
          </label>
        </div>
      </div>

      {/* Debug Output */}
      {debugOutput.length > 0 && (
        <div className="border-t border-secondary pt-4">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Recent Activity
          </h4>
          <div className="bg-black/30 rounded-lg p-3 font-mono text-xs space-y-1">
            {debugOutput.map((line, index) => (
              <div key={index} className="text-gray-300">
                {line}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-400 mb-2">💡 How it works:</h4>
        <ul className="text-xs text-gray-300 space-y-1">
          <li>• Automatically detects Browser Sources with "mood", "music" or "song" in name</li>
          <li>• Refreshes browser sources instantly when songs change</li>
          <li>• Works alongside existing OBS WebSocket and HTTP server</li>
          <li>• Use "Force Refresh" to manually update all sources</li>
          <li>• Use "Test Current Song" to test with the currently playing song</li>
        </ul>
      </div>
    </div>
  );
};

export default OBSInstantUpdatePanel;