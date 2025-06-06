import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Play, Pause, Edit, Trash2, Upload, Music } from 'lucide-react';
import useMoodStore from '../stores/moodStore';
import MoodCard from './MoodCard';
import MoodEditor from './MoodEditor';
import SongList from './SongList';

const MoodGrid = () => {
  const { 
    moods, 
    activeMood, 
    isPlaying,
    setActiveMood,
    setIsPlaying,
    deleteMood,
    addSongToMood
  } = useMoodStore();

  const [selectedMood, setSelectedMood] = useState(null);
  const [editingMood, setEditingMood] = useState(null);
  const [showMoodEditor, setShowMoodEditor] = useState(false);

  const handleMoodClick = (mood) => {
    // Nur das Song-Panel öffnen, keine Wiedergabe-Änderung
    setSelectedMood(mood);
  };

  const handleMoodPlay = (mood) => {
    if (mood.songs.length === 0) {
      alert('Diese Mood hat noch keine Songs. Füge zuerst Musik hinzu.');
      return;
    }

    if (activeMood === mood.id) {
      setIsPlaying(!isPlaying);
    } else {
      setActiveMood(mood.id);
      setIsPlaying(true);
    }
  };

  const handleMoodEdit = (mood) => {
    setEditingMood(mood);
    setShowMoodEditor(true);
  };

  const handleMoodDelete = (moodId) => {
    if (window.confirm('Are you sure you want to delete this mood?')) {
      deleteMood(moodId);
    }
  };

  const handleCreateMood = () => {
    setEditingMood(null);
    setShowMoodEditor(true);
  };

  const handleMoodDrop = async (moodId, files) => {
    const mood = moods.find(m => m.id === moodId);
    if (!mood) return;

    try {
      // Import file utilities and metadata service
      const fileUtils = await import('../utils/fileUtils');
      const metadataService = await import('../services/metadataService');
      
      // Filter audio files
      const { audioFiles, errors } = await fileUtils.default.handleDroppedFiles(files);
      
      if (audioFiles.length === 0) {
        alert('No supported audio files found');
        return;
      }

      // Process metadata
      const { results: songs, errors: metadataErrors } = await metadataService.default.processMultipleFiles(
        audioFiles,
        (progress) => console.log('Processing:', progress)
      );

      // Add songs to mood
      songs.forEach(song => {
        addSongToMood(moodId, song);
      });

      // Show feedback
      if (songs.length > 0) {
        console.log(`Added ${songs.length} songs to ${mood.name}`);
      }
      
      if (errors.length > 0 || metadataErrors.length > 0) {
        console.warn('Some files had errors:', [...errors, ...metadataErrors]);
      }
      
    } catch (error) {
      console.error('Error processing dropped files:', error);
      alert('Error processing files: ' + error.message);
    }
  };

  return (
    <div className="h-full flex">
      {/* Mood Grid */}
      <div className="flex-1 p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">Your Music Moods</h2>
          <p className="text-gray-400">
            Create and manage mood-based playlists for your streams
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Create New Mood Button */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mood-card bg-gray-800/30 border-2 border-dashed border-gray-600 hover:border-secondary/50 transition-all duration-300 cursor-pointer group min-h-48 flex flex-col items-center justify-center"
            onClick={handleCreateMood}
          >
            <div className="text-center">
              <Plus className="w-8 h-8 text-gray-400 group-hover:text-secondary transition-colors duration-300 mb-3 mx-auto" />
              <div className="text-lg font-medium text-gray-300 group-hover:text-white transition-colors duration-300">
                Create New Mood
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Add a new music mood
              </div>
            </div>
          </motion.div>

          {/* Existing Moods */}
          {moods.map((mood) => (
            <MoodCard
              key={mood.id}
              mood={mood}
              isActive={activeMood === mood.id}
              isPlaying={isPlaying && activeMood === mood.id}
              onClick={() => handleMoodClick(mood)}
              onPlay={() => handleMoodPlay(mood)}
              onEdit={() => handleMoodEdit(mood)}
              onDelete={() => handleMoodDelete(mood.id)}
              onSelectSongs={() => setSelectedMood(mood)}
              onDrop={handleMoodDrop}
            />
          ))}
        </div>

        {moods.length === 0 && (
          <div className="text-center py-12">
            <Music className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-300 mb-2">
              No moods created yet
            </h3>
            <p className="text-gray-500 mb-6">
              Create your first mood to start organizing your music for streaming
            </p>
            <button
              onClick={handleCreateMood}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Mood
            </button>
          </div>
        )}
      </div>

      {/* Song Management Panel */}
      <AnimatePresence>
        {selectedMood && (
          <>
            {/* Background Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setSelectedMood(null)}
            />
            
            {/* Panel */}
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed right-0 top-0 bottom-0 w-96 bg-gray-900 border-l border-gray-700 flex flex-col z-50"
            >
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {selectedMood.name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {selectedMood.songs.length} songs
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMood(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            <SongList 
              mood={selectedMood}
              onClose={() => setSelectedMood(null)}
            />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Mood Editor Modal */}
      <AnimatePresence>
        {showMoodEditor && (
          <MoodEditor
            mood={editingMood}
            onClose={() => {
              setShowMoodEditor(false);
              setEditingMood(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default MoodGrid;