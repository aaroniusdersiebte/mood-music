import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Trash2, 
  Edit, 
  Upload, 
  Music, 
  Image, 
  MoreVertical,
  Search,
  SortAsc,
  SortDesc
} from 'lucide-react';
import useMoodStore from '../stores/moodStore';
import metadataService from '../services/metadataService';
import fileUtils from '../utils/fileUtils';

const SongList = ({ mood, onClose }) => {
  const { 
    currentSong, 
    isPlaying, 
    setCurrentSong, 
    setIsPlaying, 
    removeSongFromMood, 
    addSongToMood,
    updateMood 
  } = useMoodStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedSong, setSelectedSong] = useState(null);
  const [showContextMenu, setShowContextMenu] = useState(null);
  const [editingSong, setEditingSong] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const fileInputRef = useRef(null);
  const contextMenuRef = useRef(null);

  // Filter and sort songs
  const filteredSongs = mood.songs
    .filter(song => 
      song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      song.album.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let aVal = a[sortBy] || '';
      let bVal = b[sortBy] || '';
      
      if (sortBy === 'duration') {
        aVal = parseFloat(aVal);
        bVal = parseFloat(bVal);
      } else {
        aVal = aVal.toString().toLowerCase();
        bVal = bVal.toString().toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

  const handleSongPlay = (song) => {
    if (currentSong?.id === song.id) {
      setIsPlaying(!isPlaying);
    } else {
      setCurrentSong(song);
      setIsPlaying(true);
    }
  };

  const handleSongDelete = (song) => {
    if (window.confirm(`Remove "${song.title}" from this mood?`)) {
      removeSongFromMood(mood.id, song.id);
      setShowContextMenu(null);
    }
  };

  const handleFileUpload = async (files) => {
    setIsUploading(true);
    
    try {
      const { audioFiles } = await fileUtils.handleDroppedFiles(Array.from(files));
      
      if (audioFiles.length > 0) {
        const { results } = await metadataService.processMultipleFiles(audioFiles);
        
        results.forEach(song => {
          addSongToMood(mood.id, song);
        });
      }
    } catch (error) {
      console.error('Error uploading files:', error);
    }
    
    setIsUploading(false);
  };

  const handleContextMenu = (e, song) => {
    e.preventDefault();
    setShowContextMenu({ song, x: e.clientX, y: e.clientY });
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />;
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setShowContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search songs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-primary w-full pl-10"
          />
        </div>

        {/* Add Songs Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="btn-primary w-full flex items-center justify-center"
        >
          {isUploading ? (
            <div className="spinner w-4 h-4 mr-2" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {isUploading ? 'Adding Songs...' : 'Add Songs'}
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp3,.flac,.wav,.m4a,.ogg,.wma"
          onChange={(e) => handleFileUpload(e.target.files)}
          className="hidden"
        />
      </div>

      {/* Song List */}
      <div className="flex-1 overflow-hidden">
        {mood.songs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <Music className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">
                No songs yet
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Add some music files to get started
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary"
              >
                <Upload className="w-4 h-4 mr-2" />
                Add Your First Song
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="px-4 py-2 border-b border-gray-700 bg-gray-800/50">
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-400 uppercase tracking-wide">
                <div className="col-span-1"></div>
                <div 
                  className="col-span-4 cursor-pointer hover:text-white flex items-center space-x-1"
                  onClick={() => handleSort('title')}
                >
                  <span>Title</span>
                  {getSortIcon('title')}
                </div>
                <div 
                  className="col-span-3 cursor-pointer hover:text-white flex items-center space-x-1"
                  onClick={() => handleSort('artist')}
                >
                  <span>Artist</span>
                  {getSortIcon('artist')}
                </div>
                <div 
                  className="col-span-2 cursor-pointer hover:text-white flex items-center space-x-1"
                  onClick={() => handleSort('album')}
                >
                  <span>Album</span>
                  {getSortIcon('album')}
                </div>
                <div 
                  className="col-span-1 cursor-pointer hover:text-white flex items-center space-x-1"
                  onClick={() => handleSort('duration')}
                >
                  <span>Duration</span>
                  {getSortIcon('duration')}
                </div>
                <div className="col-span-1"></div>
              </div>
            </div>

            {/* Songs */}
            <div className="flex-1 overflow-y-auto">
              <AnimatePresence>
                {filteredSongs.map((song, index) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.02 }}
                    className={`song-item group ${
                      currentSong?.id === song.id ? 'playing' : ''
                    } ${
                      song.broken ? 'broken' : ''
                    }`}
                    onContextMenu={(e) => handleContextMenu(e, song)}
                  >
                    <div className="grid grid-cols-12 gap-4 items-center">
                      {/* Play Button or Warning */}
                      <div className="col-span-1">
                        {song.broken ? (
                          <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center text-red-400">
                            <Music className="w-4 h-4" />
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSongPlay(song)}
                            className="w-8 h-8 rounded-full bg-gray-700 hover:bg-secondary flex items-center justify-center text-white transition-all duration-200 opacity-0 group-hover:opacity-100"
                          >
                            {currentSong?.id === song.id && isPlaying ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Title */}
                      <div className="col-span-4 min-w-0">
                        <div className="flex items-center space-x-3">
                          {/* Cover */}
                          <div className="w-10 h-10 bg-gray-700 rounded overflow-hidden flex-shrink-0">
                            {song.cover ? (
                              <img 
                                src={song.cover} 
                                alt="Cover"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Music className="w-4 h-4 text-gray-400" />
                              </div>
                            )}
                          </div>
                          {/* Title */}
                          <div className="min-w-0">
                            <div className={`font-medium truncate ${
                              song.broken ? 'text-red-400' : 'text-white'
                            }`}>
                              {song.title}
                            </div>
                            {song.broken ? (
                              <div className="text-xs text-red-500">
                                File missing - please re-add
                              </div>
                            ) : currentSong?.id === song.id ? (
                              <div className="text-xs text-secondary">Now Playing</div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Artist */}
                      <div className="col-span-3 text-gray-400 truncate">
                        {song.artist}
                      </div>

                      {/* Album */}
                      <div className="col-span-2 text-gray-400 truncate">
                        {song.album}
                      </div>

                      {/* Duration */}
                      <div className="col-span-1 text-gray-400 text-sm">
                        {fileUtils.formatDuration(song.duration)}
                      </div>

                      {/* Actions */}
                      <div className="col-span-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContextMenu(e, song);
                          }}
                          className="song-actions p-1 rounded hover:bg-gray-600 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredSongs.length === 0 && searchTerm && (
                <div className="text-center py-8">
                  <Search className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400">No songs match your search</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {showContextMenu && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="context-menu"
            style={{
              position: 'fixed',
              left: showContextMenu.x,
              top: showContextMenu.y,
              zIndex: 1000
            }}
          >
            <button
              onClick={() => handleSongPlay(showContextMenu.song)}
              className="context-menu-item"
            >
              <Play className="w-4 h-4" />
              Play Song
            </button>
            <button
              onClick={() => {
                setEditingSong(showContextMenu.song);
                setShowContextMenu(null);
              }}
              className="context-menu-item"
            >
              <Edit className="w-4 h-4" />
              Edit Info
            </button>
            <button
              onClick={() => {
                // Handle custom cover upload
                setShowContextMenu(null);
              }}
              className="context-menu-item"
            >
              <Image className="w-4 h-4" />
              Change Cover
            </button>
            <hr className="border-gray-600 my-1" />
            <button
              onClick={() => handleSongDelete(showContextMenu.song)}
              className="context-menu-item text-red-400 hover:bg-red-600/20"
            >
              <Trash2 className="w-4 h-4" />
              Remove from Mood
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary */}
      <div className="p-4 border-t border-gray-700 bg-gray-800/30">
        <div className="text-sm text-gray-400">
          {filteredSongs.length} of {mood.songs.length} songs
          {searchTerm && ` matching "${searchTerm}"`}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Total duration: {fileUtils.formatDuration(
            mood.songs.reduce((acc, song) => acc + (song.duration || 0), 0)
          )}
        </div>
      </div>
    </div>
  );
};

export default SongList;