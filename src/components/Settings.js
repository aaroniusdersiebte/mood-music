import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Monitor, 
  Database, 
  Download, 
  Upload, 
  Check, 
  X, 
  ExternalLink, 
  RefreshCw,
  Clock,
  Eye,
  EyeOff,
  Save,
  Gamepad2,
  Sliders,
  Wifi,
  WifiOff,
  Play,
  FileText,
  Info
} from 'lucide-react';
import useMoodStore from '../stores/moodStore';

import obsWebSocketService from '../services/obsWebSocketService';
import midiService from '../services/midiService';
import fileUtils from '../utils/fileUtils';
import OBSBrowserRefreshPanel from './OBSBrowserRefreshPanel';

const Settings = () => {
  const { settings, updateSettings, exportData, importData } = useMoodStore();
  
  const [localSettings, setLocalSettings] = useState({
    obsPort: 3001,
    obsDisplayDuration: 5000,
    obsAlwaysShow: false,
    autoBackup: true,
    obsWebSocketEnabled: false,
    obsWebSocketHost: 'localhost',
    obsWebSocketPort: 4455,
    obsWebSocketPassword: '',
    midiEnabled: false,
    midiInputDevice: '',
    midiOutputDevice: '',
    audioVisualizationEnabled: true,
    audioSmoothingFactor: 0.1,
    peakHoldTime: 1000,
    ...settings
  });

  const [obsWebSocketStatus, setObsWebSocketStatus] = useState('disconnected');
  const [midiStatus, setMidiStatus] = useState('disconnected');
  const [backups, setBackups] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testingObs, setTestingObs] = useState(false);
  const [testingMidi, setTestingMidi] = useState(false);
  const [midiDevices, setMidiDevices] = useState({ inputs: [], outputs: [] });

  // Load backups on mount
  useEffect(() => {
    loadBackups();
    checkAllStatus();
    loadMidiDevices();
  }, []);

  // Check OBS WebSocket status
  useEffect(() => {
    checkObsWebSocketStatus();
  }, [localSettings.obsWebSocketEnabled, localSettings.obsWebSocketHost, localSettings.obsWebSocketPort]);

  // Check MIDI status
  useEffect(() => {
    checkMidiStatus();
  }, [localSettings.midiEnabled]);

  const loadBackups = async () => {
    try {
      const backupList = await fileUtils.getBackupList();
      setBackups(backupList);
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };

  const loadMidiDevices = async () => {
    try {
      const devices = midiService.getAvailableDevices();
      setMidiDevices(devices);
    } catch (error) {
      console.error('Failed to load MIDI devices:', error);
    }
  };

  const checkAllStatus = () => {
    checkObsWebSocketStatus();
    checkMidiStatus();
  };

  const checkObsWebSocketStatus = () => {
    try {
      if (obsWebSocketService.isConnected()) {
        setObsWebSocketStatus('connected');
      } else {
        setObsWebSocketStatus('disconnected');
      }
    } catch (error) {
      setObsWebSocketStatus('error');
    }
  };

  const checkMidiStatus = () => {
    try {
      const devices = midiService.getAvailableDevices();
      if (devices.inputs.length > 0 || devices.outputs.length > 0) {
        setMidiStatus('connected');
      } else {
        setMidiStatus('disconnected');
      }
    } catch (error) {
      setMidiStatus('error');
    }
  };

  const handleSettingChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    
    try {
      if (localSettings.obsWebSocketEnabled !== settings.obsWebSocketEnabled ||
          localSettings.obsWebSocketHost !== settings.obsWebSocketHost ||
          localSettings.obsWebSocketPort !== settings.obsWebSocketPort) {
        
        if (settings.obsWebSocketEnabled) {
          await obsWebSocketService.disconnect();
        }
        
        if (localSettings.obsWebSocketEnabled) {
          await obsWebSocketService.connect(
            localSettings.obsWebSocketHost,
            localSettings.obsWebSocketPort,
            localSettings.obsWebSocketPassword
          );
        }
      }
      
      if (localSettings.midiEnabled !== settings.midiEnabled) {
        if (localSettings.midiEnabled) {
          await midiService.initialize();
        } else {
          midiService.destroy();
        }
      }
      
      updateSettings(localSettings);
      
      if (localSettings.autoBackup) {
        await createBackup();
      }
      
      checkAllStatus();
      
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    
    setSaving(false);
  };

  const testOBSDisplay = async () => {
    try {
      // Create test data
      const testSong = {
        id: 'test-song-' + Date.now(),
        title: 'Test Song Display',
        artist: 'Mood Music System',
        album: 'Settings Test',
        cover: 'https://via.placeholder.com/300x300/4ade80/ffffff?text=TEST',
        moodBackground: null
      };
      
      const testMood = {
        id: 'test-mood',
        name: 'Test Mode',
        color: '#4ade80',
        pulseSpeed: 2.0,
        intensity: 'moderate',
        background: null
      };
      
      await obsWebSocketService.updateSongDisplay(testSong, testMood, localSettings);
      
      console.log('🎵 Test display sent! Check your OBS Browser Source.');
      alert('🎵 Test display sent! Check your OBS Browser Source to see the display.');
      
      // Auto-hide after 5 seconds if not always show
      if (!localSettings.obsAlwaysShow) {
        setTimeout(async () => {
          await obsWebSocketService.hideSongDisplay();
          console.log('🎵 Test display hidden');
        }, 5000);
      }
      
    } catch (error) {
      console.error('Failed to test OBS display:', error);
      alert('Failed to test OBS display. Check console for details.');
    }
  };

  const testObsWebSocketConnection = async () => {
    setTestingObs(true);
    
    try {
      await obsWebSocketService.connect(
        localSettings.obsWebSocketHost,
        localSettings.obsWebSocketPort,
        localSettings.obsWebSocketPassword
      );
      
      const version = await obsWebSocketService.testConnection();
      if (version) {
        setObsWebSocketStatus('connected');
        
        // Test the OBS display with sample data
        const testSong = {
          id: 'test-song',
          title: 'Test Song',
          artist: 'Mood Music',
          album: 'Test Album',
          cover: 'https://via.placeholder.com/300x300/4ade80/ffffff?text=Test',
          moodBackground: null
        };
        
        const testMood = {
          id: 'test-mood',
          name: 'Test Mood',
          color: '#4ade80',
          pulseSpeed: 2.0,
          intensity: 'moderate',
          background: null
        };
        
        await obsWebSocketService.updateSongDisplay(testSong, testMood, localSettings);
        console.log('🎵 Test display sent to OBS');
      } else {
        setObsWebSocketStatus('error');
      }
    } catch (error) {
      console.error('OBS WebSocket test failed:', error);
      setObsWebSocketStatus('error');
    }
    
    setTestingObs(false);
  };

  const testMidiConnection = async () => {
    setTestingMidi(true);
    
    try {
      await midiService.initialize();
      const devices = midiService.getAvailableDevices();
      setMidiDevices(devices);
      
      if (devices.inputs.length > 0 || devices.outputs.length > 0) {
        setMidiStatus('connected');
      } else {
        setMidiStatus('disconnected');
      }
    } catch (error) {
      console.error('MIDI test failed:', error);
      setMidiStatus('error');
    }
    
    setTestingMidi(false);
  };

  const createBackup = async () => {
    try {
      const data = exportData();
      await fileUtils.createBackup(data);
      await loadBackups();
    } catch (error) {
      console.error('Failed to create backup:', error);
    }
  };

  const restoreBackup = async (backupPath) => {
    try {
      const data = await fileUtils.loadBackup(backupPath);
      importData(data);
      await loadBackups();
    } catch (error) {
      console.error('Failed to restore backup:', error);
    }
  };

  const handleExport = () => {
    const data = exportData();
    const filename = `mood-music-export-${new Date().toISOString().split('T')[0]}.json`;
    fileUtils.downloadAsFile(JSON.stringify(data, null, 2), filename);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await fileUtils.readFileAsText(file);
      const data = JSON.parse(text);
      importData(data);
      setImportFile(null);
    } catch (error) {
      console.error('Failed to import data:', error);
      alert('Invalid backup file format');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected': return 'text-green-400';
      case 'error': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'error': return 'Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
          <p className="text-gray-400">
            Configure your Mood Music app and OBS integration
          </p>
        </div>

        {/* OBS WebSocket */}
        <section className="card">
          <div className="flex items-center mb-4">
            <Wifi className="w-5 h-5 text-blue-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">OBS WebSocket</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={localSettings.obsWebSocketEnabled}
                  onChange={(e) => handleSettingChange('obsWebSocketEnabled', e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-300">Enable OBS WebSocket</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Connect to OBS for audio level monitoring and automatic browser source refresh
              </p>
            </div>

            {localSettings.obsWebSocketEnabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Host
                    </label>
                    <input
                      type="text"
                      value={localSettings.obsWebSocketHost}
                      onChange={(e) => handleSettingChange('obsWebSocketHost', e.target.value)}
                      className="input-primary w-full"
                      placeholder="localhost"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Port
                    </label>
                    <input
                      type="number"
                      min="1024"
                      max="65535"
                      value={localSettings.obsWebSocketPort}
                      onChange={(e) => handleSettingChange('obsWebSocketPort', parseInt(e.target.value))}
                      className="input-primary w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={localSettings.obsWebSocketPassword}
                      onChange={(e) => handleSettingChange('obsWebSocketPassword', e.target.value)}
                      className="input-primary w-full"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Connection Status
                    </label>
                    <div className="flex items-center space-x-3">
                      <div className={`flex items-center ${getStatusColor(obsWebSocketStatus)}`}>
                        {obsWebSocketStatus === 'connected' ? (
                          <Wifi className="w-4 h-4 mr-2" />
                        ) : (
                          <WifiOff className="w-4 h-4 mr-2" />
                        )}
                        {getStatusText(obsWebSocketStatus)}
                      </div>
                      <button
                        onClick={testObsWebSocketConnection}
                        disabled={testingObs}
                        className="btn-ghost text-xs"
                      >
                        {testingObs ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Test
                      </button>
                    </div>
                  </div>
                </div>

                {/* OBS Browser Refresh Panel */}
                <OBSBrowserRefreshPanel />

                {/* Simplified OBS Display Settings */}
                <div className="border-t border-gray-600 pt-4">
                  <h4 className="text-md font-medium text-white mb-3">OBS Song Display Setup</h4>
                  
                  <div className="space-y-4">
                    
                    {/* Display Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Display Duration (seconds)
                        </label>
                        <input
                          type="number"
                          min="3"
                          max="60"
                          value={localSettings.obsDisplayDuration / 1000 || 8}
                          onChange={(e) => handleSettingChange('obsDisplayDuration', parseInt(e.target.value) * 1000)}
                          className="input-primary w-full"
                          disabled={localSettings.obsAlwaysShow}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          How long to show after song change
                        </p>
                      </div>
                      
                      <div className="flex flex-col justify-center">
                        <label className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={localSettings.obsAlwaysShow || false}
                            onChange={(e) => handleSettingChange('obsAlwaysShow', e.target.checked)}
                            className="rounded"
                          />
                          <span className="text-gray-300">Always show display</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1 ml-6">
                          Keep song info visible at all times
                        </p>
                      </div>
                    </div>
                    
                    {/* Download OBS Files */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        <FileText className="w-4 h-4 inline mr-2" />
                        Download OBS Display Files
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = window.location.origin + '/obs-display-xhr.html';
                            a.download = 'obs-display-xhr.html';
                            a.click();
                          }}
                          className="btn-primary flex items-center justify-center"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download OBS Display (XMLHttpRequest)
                        </button>
                        
                        <button
                          onClick={testOBSDisplay}
                          className="btn-secondary flex items-center justify-center"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Test Display in OBS
                        </button>
                      </div>
                    </div>
                    
                    {/* Setup Instructions */}
                    <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <div className="text-sm text-blue-400 font-medium mb-2">
                            🎵 OBS Setup Instructions:
                          </div>
                          <div className="text-xs text-blue-300 space-y-2">
                            <div><strong>1. Download:</strong> Click "Download OBS Display" above</div>
                            <div><strong>2. OBS Setup:</strong> Browser Source → Local File → Select downloaded HTML file</div>
                            <div><strong>3. Size:</strong> Set to 800x200 pixels</div>
                            <div><strong>4. Settings:</strong> Disable "Shutdown source when not visible"</div>
                            <div><strong>5. Test:</strong> Play a song in Mood Music - should appear automatically!</div>
                          </div>
                          <div className="mt-3 p-2 bg-green-500/20 border border-green-500/40 rounded text-xs text-green-300">
                            <strong>✅ How it works:</strong> When you change songs, obs-data.json gets updated in the same folder as the HTML file. 
                            The HTML file reads this JSON and displays the song info. OBS WebSocket automatically refreshes the browser source.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* MIDI Controller */}
        <section className="card">
          <div className="flex items-center mb-4">
            <Gamepad2 className="w-5 h-5 text-purple-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">MIDI Controller</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={localSettings.midiEnabled}
                  onChange={(e) => handleSettingChange('midiEnabled', e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-300">Enable MIDI Controller</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Use physical MIDI controllers for audio mixing and hotkeys
              </p>
            </div>

            {localSettings.midiEnabled && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Input Device
                    </label>
                    <select
                      value={localSettings.midiInputDevice}
                      onChange={(e) => handleSettingChange('midiInputDevice', e.target.value)}
                      className="input-primary w-full"
                    >
                      <option value="">Auto-detect</option>
                      {midiDevices.inputs.map(device => (
                        <option key={device.id} value={device.id}>
                          {device.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Output Device
                    </label>
                    <select
                      value={localSettings.midiOutputDevice}
                      onChange={(e) => handleSettingChange('midiOutputDevice', e.target.value)}
                      className="input-primary w-full"
                    >
                      <option value="">None</option>
                      {midiDevices.outputs.map(device => (
                        <option key={device.id} value={device.id}>
                          {device.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Status
                    </label>
                    <div className="flex items-center space-x-3">
                      <div className={`flex items-center ${getStatusColor(midiStatus)}`}>
                        <Gamepad2 className="w-4 h-4 mr-2" />
                        {getStatusText(midiStatus)}
                      </div>
                      <button
                        onClick={testMidiConnection}
                        disabled={testingMidi}
                        className="btn-ghost text-xs"
                      >
                        {testingMidi ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Scan
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Detected Devices
                    </label>
                    <div className="text-sm text-gray-400">
                      {midiDevices.inputs.length} inputs, {midiDevices.outputs.length} outputs
                    </div>
                  </div>
                </div>

                {(midiDevices.inputs.length > 0 || midiDevices.outputs.length > 0) && (
                  <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <div className="text-sm text-purple-400 font-medium mb-2">
                      Available MIDI Devices:
                    </div>
                    <div className="text-xs text-purple-300 space-y-1">
                      {midiDevices.inputs.map(device => (
                        <div key={device.id} className="flex items-center">
                          <span className="w-2 h-2 bg-green-400 rounded-full mr-2" />
                          Input: {device.name}
                        </div>
                      ))}
                      {midiDevices.outputs.map(device => (
                        <div key={device.id} className="flex items-center">
                          <span className="w-2 h-2 bg-blue-400 rounded-full mr-2" />
                          Output: {device.name}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-gray-700/50 border border-gray-600 rounded-lg">
                  <div className="text-sm text-gray-300 font-medium mb-1">
                    Default MIDI Mapping:
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <div>• CC 1-8: Volume controls (Master, Desktop, Mic, Discord, etc.)</div>
                    <div>• CC 16-23: Hotkeys (Mood swap, Play/Pause, Next/Previous, etc.)</div>
                    <div>• Use the MIDI Mapping tab to customize controls</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Audio Settings */}
        <section className="card">
          <div className="flex items-center mb-4">
            <Sliders className="w-5 h-5 text-green-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">Audio Settings</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={localSettings.audioVisualizationEnabled}
                  onChange={(e) => handleSettingChange('audioVisualizationEnabled', e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-300">Enable Audio Visualization</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Show real-time audio level meters in the mixer
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Audio Smoothing Factor
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.5"
                  step="0.01"
                  value={localSettings.audioSmoothingFactor}
                  onChange={(e) => handleSettingChange('audioSmoothingFactor', parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Current: {(localSettings.audioSmoothingFactor || 0.1).toFixed(2)} (Lower = More Responsive)
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Peak Hold Time (ms)
                </label>
                <input
                  type="number"
                  min="100"
                  max="5000"
                  step="100"
                  value={localSettings.peakHoldTime}
                  onChange={(e) => handleSettingChange('peakHoldTime', parseInt(e.target.value))}
                  className="input-primary w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  How long to hold peak indicators
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Backup & Data */}
        <section className="card">
          <div className="flex items-center mb-4">
            <Database className="w-5 h-5 text-secondary mr-2" />
            <h3 className="text-lg font-semibold text-white">Backup & Data</h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={localSettings.autoBackup}
                  onChange={(e) => handleSettingChange('autoBackup', e.target.checked)}
                  className="rounded"
                />
                <span className="text-gray-300">Enable automatic backups</span>
              </label>
              <p className="text-xs text-gray-500 mt-1 ml-6">
                Automatically create backups every 5 minutes when changes are made
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-md font-medium text-white mb-2">Export Data</h4>
                <button
                  onClick={handleExport}
                  className="btn-secondary w-full flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Configuration
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Download all moods and settings as JSON
                </p>
              </div>

              <div>
                <h4 className="text-md font-medium text-white mb-2">Import Data</h4>
                <label className="btn-secondary w-full flex items-center justify-center cursor-pointer">
                  <Upload className="w-4 h-4 mr-2" />
                  Import Configuration
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Restore from exported JSON file
                </p>
              </div>
            </div>

            {backups.length > 0 && (
              <div>
                <h4 className="text-md font-medium text-white mb-2">Recent Backups</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {backups.slice(0, 5).map((backup, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                      <div>
                        <div className="text-sm text-white">{backup.filename}</div>
                        <div className="text-xs text-gray-400">
                          {backup.created.toLocaleDateString()} • {backup.size}
                        </div>
                      </div>
                      <button
                        onClick={() => restoreBackup(backup.path)}
                        className="btn-ghost text-xs"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="btn-primary flex items-center"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        {/* App Info */}
        <section className="card">
          <h3 className="text-lg font-semibold text-white mb-4">About</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Version</div>
              <div className="text-white">1.0.0</div>
            </div>
            <div>
              <div className="text-gray-400">Build</div>
              <div className="text-white">XMLHttpRequest Release</div>
            </div>
            <div>
              <div className="text-gray-400">Node.js</div>
              <div className="text-white">{window.process?.version || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-gray-400">Platform</div>
              <div className="text-white">{window.process?.platform || window.navigator.platform}</div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-500">
              Mood Music - Stream-optimized music player with simplified OBS integration via local files
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
