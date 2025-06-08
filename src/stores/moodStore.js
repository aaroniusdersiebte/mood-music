import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import obsWebSocketService from '../services/obsWebSocketService';

const useMoodStore = create(
  persist(
    (set, get) => ({
      // Moods State
      moods: [
        {
          id: 'chill',
          name: 'Chill',
          color: '#4ade80',
          pulseSpeed: 2.5,
          intensity: 'subtle',
          songs: []
        },
        {
          id: 'action',
          name: 'Action',
          color: '#ef4444',
          pulseSpeed: 0.5,
          intensity: 'extreme',
          songs: []
        }
      ],
      activeMood: null,
      
      // Player State
      currentSong: null,
      isPlaying: false,
      volume: 0.8,
      shuffle: true,
      queue: [],
      currentIndex: 0,
      
      // Settings
      settings: {
        obsPort: 3001,
        obsDisplayDuration: 5000,
        obsAlwaysShow: false,
        autoBackup: true,
        backupInterval: 300000, // 5 minutes
        
        // OBS WebSocket Settings
        obsWebSocketEnabled: false,
        obsWebSocketHost: 'localhost',
        obsWebSocketPort: 4455,
        obsWebSocketPassword: '',
        
        // OBS Song Display Settings
        obsSongTextSource: 'Current Song',
        obsSongTemplate: 'Now Playing: {title}\nArtist: {artist}\nMood: {mood}',
        obsAlwaysShow: false,
        obsDisplayDuration: 8000,
        obsPreDisplayDuration: 2000,
        obsShowCover: true,
        obsAnimationStyle: 'slide',
        obsMoodTransitionDuration: 1500,
        
        // MIDI Settings
        midiEnabled: false,
        midiInputDevice: '',
        midiOutputDevice: '',
        midiMappings: {},
        
        // Audio Settings
        audioVisualizationEnabled: true,
        audioSmoothingFactor: 0.1,
        peakHoldTime: 1000, // ms
      },
      
      // Actions
      addMood: (mood) => set((state) => ({
        moods: [...state.moods, { ...mood, id: Date.now().toString(), songs: [] }]
      })),
      
      updateMood: (id, updates) => set((state) => ({
        moods: state.moods.map(mood => 
          mood.id === id ? { ...mood, ...updates } : mood
        )
      })),
      
      deleteMood: (id) => set((state) => ({
        moods: state.moods.filter(mood => mood.id !== id),
        activeMood: state.activeMood === id ? null : state.activeMood
      })),
      
      setActiveMood: (moodId) => {
        const mood = get().moods.find(m => m.id === moodId);
        if (mood && mood.songs.length > 0) {
          const shuffledSongs = get().shuffle ? 
            [...mood.songs].sort(() => Math.random() - 0.5) : 
            mood.songs;
          
          const newCurrentSong = shuffledSongs[0] || null;
          
          set({
            activeMood: moodId,
            queue: shuffledSongs,
            currentIndex: 0,
            currentSong: newCurrentSong
          });
          
          // Update OBS display when mood changes
          if (newCurrentSong) {
            const state = get();
            // Enrich song data with mood background for OBS
            const enrichedSong = {
              ...newCurrentSong,
              moodBackground: mood.background
            };
            obsWebSocketService.updateSongDisplay(enrichedSong, mood, state.settings);
          }
        }
      },
      
      addSongToMood: (moodId, song) => set((state) => ({
        moods: state.moods.map(mood =>
          mood.id === moodId 
            ? { ...mood, songs: [...mood.songs, song] }
            : mood
        )
      })),
      
      removeSongFromMood: (moodId, songId) => set((state) => ({
        moods: state.moods.map(mood =>
          mood.id === moodId 
            ? { ...mood, songs: mood.songs.filter(s => s.id !== songId) }
            : mood
        )
      })),
      
      // Player Actions
      setCurrentSong: (song) => {
        set({ currentSong: song });
        
        // Update OBS display when song changes
        const state = get();
        const currentMood = state.moods.find(m => m.id === state.activeMood);
        if (song && currentMood) {
          // Enrich song data with mood background for OBS
          const enrichedSong = {
            ...song,
            moodBackground: currentMood.background
          };
          obsWebSocketService.updateSongDisplay(enrichedSong, currentMood, state.settings);
        }
      },
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setVolume: (volume) => set({ volume }),
      setShuffle: (shuffle) => set({ shuffle }),
      
      nextSong: () => {
        const { queue, currentIndex, shuffle, activeMood, moods, settings } = get();
        if (queue.length === 0) return;
        
        let nextIndex = currentIndex + 1;
        let newCurrentSong = null;
        
        if (nextIndex >= queue.length) {
          nextIndex = 0;
          if (shuffle) {
            const shuffledQueue = [...queue].sort(() => Math.random() - 0.5);
            newCurrentSong = shuffledQueue[0];
            set({ queue: shuffledQueue, currentIndex: 0, currentSong: newCurrentSong });
          } else {
            newCurrentSong = queue[nextIndex];
            set({ currentIndex: nextIndex, currentSong: newCurrentSong });
          }
        } else {
          newCurrentSong = queue[nextIndex];
          set({ currentIndex: nextIndex, currentSong: newCurrentSong });
        }
        
        // Update OBS display
        const currentMood = moods.find(m => m.id === activeMood);
        if (newCurrentSong && currentMood) {
          // Enrich song data with mood background for OBS
          const enrichedSong = {
            ...newCurrentSong,
            moodBackground: currentMood.background
          };
          obsWebSocketService.updateSongDisplay(enrichedSong, currentMood, settings);
        }
      },
      
      prevSong: () => {
        const { queue, currentIndex, activeMood, moods, settings } = get();
        if (queue.length === 0) return;
        
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : queue.length - 1;
        const newCurrentSong = queue[prevIndex];
        
        set({ 
          currentIndex: prevIndex, 
          currentSong: newCurrentSong 
        });
        
        // Update OBS display
        const currentMood = moods.find(m => m.id === activeMood);
        if (newCurrentSong && currentMood) {
          // Enrich song data with mood background for OBS
          const enrichedSong = {
            ...newCurrentSong,
            moodBackground: currentMood.background
          };
          obsWebSocketService.updateSongDisplay(enrichedSong, currentMood, settings);
        }
      },
      
      // Settings Actions
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      
      // Backup Actions
      exportData: () => {
        const state = get();
        return {
          moods: state.moods,
          settings: state.settings,
          timestamp: new Date().toISOString()
        };
      },
      
      importData: (data) => {
        if (data.moods && Array.isArray(data.moods)) {
          set({
            moods: data.moods,
            settings: { ...get().settings, ...(data.settings || {}) }
          });
        }
      }
    }),
    {
      name: 'mood-music-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        moods: state.moods,
        settings: state.settings,
        activeMood: state.activeMood,
      }),
      version: 2,
      migrate: (persistedState, version) => {
        if (version === 0) {
          // Migration logic if needed
          return persistedState;
        }
        
        // Fix songs with invalid blob URLs
        if (persistedState.moods) {
          persistedState.moods = persistedState.moods.map(mood => ({
            ...mood,
            songs: mood.songs.map(song => {
              // If song has a blob URL that's no longer valid, mark it as broken
              if (song.path && song.path.startsWith('blob:http://localhost') && !song.originalPath) {
                return {
                  ...song,
                  path: null, // Will trigger re-add prompt
                  broken: true,
                  brokenReason: 'File path lost after restart - please re-add this song'
                };
              }
              return song;
            })
          }));
        }
        
        return persistedState;
      },
    }
  )
);

export default useMoodStore;