import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Music, AlertCircle, CheckCircle } from 'lucide-react';
import useMoodStore from '../stores/moodStore';
import metadataService from '../services/metadataService';
import fileUtils from '../utils/fileUtils';

const DropZone = ({ onFilesDropped, onClose, targetMoodId = null }) => {
  const { moods, addSongToMood } = useMoodStore();
  const [selectedMood, setSelectedMood] = useState(targetMoodId || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState(null);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
  };

  const processFiles = async (files) => {
    if (!selectedMood) {
      alert('Please select a mood first');
      return;
    }

    setIsProcessing(true);
    setProgress({ current: 0, total: files.length });

    try {
      // Filter audio files
      const { audioFiles, errors } = await fileUtils.handleDroppedFiles(files);
      
      if (audioFiles.length === 0) {
        setResults({ 
          processed: [], 
          errors: errors.length > 0 ? errors : [{ file: 'No files', error: 'No supported audio files found' }]
        });
        setIsProcessing(false);
        return;
      }

      // Process metadata
      const { results: songs, errors: metadataErrors } = await metadataService.processMultipleFiles(
        audioFiles,
        (progress) => setProgress(progress)
      );

      // Add songs to mood
      songs.forEach(song => {
        addSongToMood(selectedMood, song);
      });

      setResults({
        processed: songs,
        errors: [...errors, ...metadataErrors]
      });

    } catch (error) {
      console.error('Error processing files:', error);
      setResults({
        processed: [],
        errors: [{ file: 'Processing', error: error.message }]
      });
    }

    setIsProcessing(false);
  };

  const handleClose = () => {
    if (!isProcessing) {
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-800 rounded-xl border border-gray-600 p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {!results ? (
          <>
            <div className="text-center mb-6">
              <Music className="w-12 h-12 text-secondary mx-auto mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Add Music to Mood
              </h3>
              <p className="text-gray-400">
                Drop your music files or browse to add them to a mood
              </p>
            </div>

            {/* Mood Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Select Mood
              </label>
              <select
                value={selectedMood}
                onChange={(e) => setSelectedMood(e.target.value)}
                className="input-primary w-full"
                disabled={isProcessing}
              >
                <option value="">Choose a mood...</option>
                {moods.map(mood => (
                  <option key={mood.id} value={mood.id}>
                    {mood.name} ({mood.songs.length} songs)
                  </option>
                ))}
              </select>
            </div>

            {!isProcessing ? (
              <>
                {/* Drop Zone */}
                <div
                  className="drop-zone mb-4"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-300 font-medium mb-1">
                    Drop music files here
                  </p>
                  <p className="text-gray-500 text-sm">
                    Supported: MP3, FLAC, WAV, M4A, OGG, WMA
                  </p>
                </div>

                {/* File Input */}
                <div className="text-center">
                  <label className="btn-secondary cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept=".mp3,.flac,.wav,.m4a,.ogg,.wma"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                    Browse Files
                  </label>
                </div>
              </>
            ) : (
              /* Processing */
              <div className="text-center">
                <div className="spinner w-8 h-8 mx-auto mb-4" />
                <p className="text-white mb-2">Processing files...</p>
                <p className="text-gray-400 text-sm">
                  {progress.current} of {progress.total} files
                </p>
                <div className="progress-bar mt-4">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` 
                    }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          /* Results */
          <div>
            <div className="text-center mb-6">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-xl font-semibold text-white mb-2">
                Import Complete
              </h3>
            </div>

            <div className="space-y-4">
              {results.processed.length > 0 && (
                <div>
                  <div className="flex items-center text-green-400 mb-2">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    <span className="font-medium">
                      {results.processed.length} songs added successfully
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    {results.processed.slice(0, 3).map((song, i) => (
                      <div key={i}>• {song.title} - {song.artist}</div>
                    ))}
                    {results.processed.length > 3 && (
                      <div>... and {results.processed.length - 3} more</div>
                    )}
                  </div>
                </div>
              )}

              {results.errors.length > 0 && (
                <div>
                  <div className="flex items-center text-red-400 mb-2">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span className="font-medium">
                      {results.errors.length} files had errors
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 space-y-1">
                    {results.errors.slice(0, 3).map((error, i) => (
                      <div key={i}>• {fileUtils.getBasename(error.file)}: {error.error}</div>
                    ))}
                    {results.errors.length > 3 && (
                      <div>... and {results.errors.length - 3} more</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={handleClose}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default DropZone;