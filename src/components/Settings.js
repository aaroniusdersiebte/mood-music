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
  Save
} from 'lucide-react';
import useMoodStore from '../stores/moodStore';
import obsService from '../services/obsService';
import fileUtils from '../utils/fileUtils';

const Settings = () => {
  const { settings, updateSettings, exportData, importData } = useMoodStore();
  
  const [localSettings, setLocalSettings] = useState(settings);
  const [obsStatus, setObsStatus] = useState('disconnected');
  const [backups, setBackups] = useState([]);
  const [importFile, setImportFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testingObs, setTestingObs] = useState(false);

  // Load backups on mount
  useEffect(() => {
    loadBackups();
  }, []);

  // Check OBS status
  useEffect(() => {
    checkObsStatus();
  }, [localSettings.obsPort]);

  const loadBackups = async () => {
    try {
      const backupList = await fileUtils.getBackupList();
      setBackups(backupList);
    } catch (error) {
      console.error('Failed to load backups:', error);
    }
  };

  const checkObsStatus = async () => {
    // Simple check - just verify if service is initialized
    try {
      if (obsService.isServerRunning()) {
        setObsStatus('connected');
      } else {
        setObsStatus('disconnected');
      }
    } catch (error) {
      setObsStatus('error');
    }
  };

  const handleSettingChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    
    try {
      // Update OBS service port if changed
      if (localSettings.obsPort !== settings.obsPort) {
        await obsService.stopServer();
        await obsService.startServer(localSettings.obsPort);
      }
      
      updateSettings(localSettings);
      
      // Create backup if auto-backup is enabled
      if (localSettings.autoBackup) {
        await createBackup();
      }
      
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
    
    setSaving(false);
  };

  const testObsConnection = async () => {
    setTestingObs(true);
    
    try {
      // Start the OBS service
      await obsService.startServer(localSettings.obsPort);
      
      // Test by updating with dummy data
      obsService.updateCurrentSong(
        {
          title: 'Test Song',
          artist: 'Mood Music',
          cover: null,
          id: 'test'
        },
        {
          name: 'Test Mood',
          color: '#4ade80',
          pulseSpeed: 2.5,
          intensity: 'moderate'
        },
        localSettings
      );
      
      setObsStatus('connected');
    } catch (error) {
      console.error('OBS test failed:', error);
      setObsStatus('error');
    }
    
    setTestingObs(false);
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

        {/* OBS Integration */}
        <section className="card">
          <div className="flex items-center mb-4">
            <Monitor className="w-5 h-5 text-secondary mr-2" />
            <h3 className="text-lg font-semibold text-white">OBS Integration</h3>
          </div>

          <div className="space-y-4">
            {/* Server Port */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Server Port
                </label>
                <input
                  type="number"
                  min="3000"
                  max="9999"
                  value={localSettings.obsPort}
                  onChange={(e) => handleSettingChange('obsPort', parseInt(e.target.value))}
                  className="input-primary w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Port for the local server (3000-9999)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Status
                </label>
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center ${getStatusColor(obsStatus)}`}>
                    <div className="w-2 h-2 rounded-full bg-current mr-2" />
                    {getStatusText(obsStatus)}
                  </div>
                  <button
                    onClick={testObsConnection}
                    disabled={testingObs}
                    className="btn-ghost text-xs"
                  >
                    {testingObs ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Display Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Display Duration (seconds)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={localSettings.obsDisplayDuration / 1000}
                  onChange={(e) => handleSettingChange('obsDisplayDuration', parseInt(e.target.value) * 1000)}
                  className="input-primary w-full"
                  disabled={localSettings.obsAlwaysShow}
                />
                <p className="text-xs text-gray-500 mt-1">
                  How long to show song info after change
                </p>
              </div>

              <div>
                <label className="flex items-center space-x-3 mt-6">
                  <input
                    type="checkbox"
                    checked={localSettings.obsAlwaysShow}
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

            {/* Browser Source URL - now downloads file */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                OBS Browser Source
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => obsService.downloadOBSFile()}
                  className="btn-secondary w-full flex items-center justify-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download OBS HTML File
                </button>
                <p className="text-xs text-gray-500">
                  Download the HTML file and add it as a Local File source in OBS (400x120 recommended)
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
            {/* Auto Backup */}
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

            {/* Manual Backup/Restore */}
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

            {/* Recent Backups */}
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
              <div className="text-white">Release</div>
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
              Mood Music - Stream-optimized music player with OBS integration
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;