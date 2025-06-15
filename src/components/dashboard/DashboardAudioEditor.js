import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Save, 
  Volume2, 
  VolumeX,
  Mic,
  Speaker,
  Monitor,
  Gamepad2,
  Music,
  Bell,
  Plus,
  Trash2,
  RefreshCw,
  Settings
} from 'lucide-react';
import globalStateService from '../../services/globalStateService';

const DashboardAudioEditor = ({ isOpen, onClose, onSave }) => {
  const [audioSources, setAudioSources] = useState([]);
  const [obsConnected, setObsConnected] = useState(false);
  const [customSources, setCustomSources] = useState([]);
  const [newSourceName, setNewSourceName] = useState('');
  const [selectedSources, setSelectedSources] = useState([]);

  // Source icons mapping
  const sourceIcons = {
    master: Speaker,
    mic: Mic,
    desktop: Monitor,
    game: Gamepad2,
    music: Music,
    discord: Volume2,
    browser: Monitor,
    alert: Bell
  };

  // Predefined source templates
  const sourceTemplates = [
    { name: 'master', displayName: 'Master Volume', type: 'output', icon: Speaker },
    { name: 'mic', displayName: 'Microphone', type: 'input', icon: Mic },
    { name: 'desktop', displayName: 'Desktop Audio', type: 'output', icon: Monitor },
    { name: 'game', displayName: 'Game Audio', type: 'output', icon: Gamepad2 },
    { name: 'music', displayName: 'Music Player', type: 'output', icon: Music },
    { name: 'discord', displayName: 'Discord', type: 'output', icon: Volume2 },
    { name: 'browser', displayName: 'Browser', type: 'output', icon: Monitor },
    { name: 'alert', displayName: 'Alerts & SFX', type: 'output', icon: Bell }
  ];

  useEffect(() => {
    if (isOpen) {
      loadAudioSources();
    }
  }, [isOpen]);

  const loadAudioSources = () => {
    // Get real audio sources from OBS
    const realSources = globalStateService.getAudioSources();
    setAudioSources(realSources);
    
    // Check OBS connection
    const connected = globalStateService.isOBSConnected();
    setObsConnected(connected);
    
    // Load custom sources from localStorage
    const stored = localStorage.getItem('customAudioSources');
    if (stored) {
      try {
        setCustomSources(JSON.parse(stored));
      } catch (error) {
        console.warn('Could not load custom audio sources:', error);
        setCustomSources([]);
      }
    }
    
    console.log('DashboardAudioEditor: Loaded', realSources.length, 'real sources,', connected ? 'OBS connected' : 'OBS disconnected');
  };

  const handleSave = () => {
    const selectedSourcesData = [];
    
    // Collect selected real sources
    audioSources.forEach(source => {
      if (selectedSources.includes(source.name)) {
        selectedSourcesData.push(source);
      }
    });
    
    // Collect selected custom sources
    customSources.forEach(source => {
      if (selectedSources.includes(source.name)) {
        selectedSourcesData.push(source);
      }
    });
    
    // Collect selected template sources (create default objects)
    sourceTemplates.forEach(template => {
      if (selectedSources.includes(template.name)) {
        const existing = [...audioSources, ...customSources].find(s => s.name === template.name);
        if (!existing) {
          selectedSourcesData.push({
            name: template.name,
            displayName: template.displayName,
            type: template.type,
            volumeDb: -10,
            muted: false,
            template: true
          });
        }
      }
    });
    
    console.log('DashboardAudioEditor: Saving selected sources:', selectedSourcesData.length);
    
    if (onSave) {
      onSave(selectedSourcesData);
    }
    
    onClose();
  };

  const toggleSourceSelection = (source) => {
    const sourceName = source.name;
    const isSelected = selectedSources.includes(sourceName);
    
    if (isSelected) {
      setSelectedSources(prev => prev.filter(s => s !== sourceName));
    } else {
      setSelectedSources(prev => [...prev, sourceName]);
    }
  };

  const renderSourceItem = (source, isTemplate = false) => {
    const Icon = sourceIcons[source.name] || Volume2;
    const isSelected = selectedSources.includes(source.name);
    const displayName = source.displayName || source.name;
    
    return (
      <motion.div
        key={source.name}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'border-green-500 bg-green-500/20 text-green-400'
            : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
        }`}
        onClick={() => toggleSourceSelection(source)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Icon className="w-5 h-5" />
            <div>
              <div className="font-medium">{displayName}</div>
              <div className="text-xs opacity-70">
                {isTemplate ? 'Template' : source.type || 'OBS Source'}
              </div>
            </div>
          </div>
          
          {isSelected && (
            <span className="text-green-400 text-sm">✓</span>
          )}
        </div>
      </motion.div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Volume2 className="w-6 h-6 text-green-400" />
              <div>
                <h2 className="text-xl font-bold text-white">
                  Audio Source Manager
                </h2>
                <p className="text-sm text-gray-400">
                  Select audio sources for your mixer
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Source Templates</h3>
              <div className="grid grid-cols-2 gap-2">
                {sourceTemplates.map(template => renderSourceItem(template, true))}
              </div>
            </div>

            {audioSources.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">OBS Audio Sources</h3>
                <div className="grid grid-cols-2 gap-2">
                  {audioSources.map(source => renderSourceItem(source, false))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-700">
            <div className="text-sm text-gray-400">
              {selectedSources.length} sources selected
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-gray-300 hover:bg-gray-500 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={selectedSources.length === 0}
                className="px-4 py-2 bg-green-500 text-white hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Add Sources</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default DashboardAudioEditor;