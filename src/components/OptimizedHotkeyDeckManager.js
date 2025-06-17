// Enhanced Hotkey Deck Manager - New Architecture
// Replaces old OptimizedHotkeyDeckManager with improved performance and features

import React from 'react';
import HotkeyDeckManager from './hotkey-decks/HotkeyDeckManager';

/**
 * 🚀 ENHANCED HOTKEY DECK MANAGER
 * 
 * Major improvements:
 * - ✅ Keyboard hotkey support with recording
 * - ✅ Fixed MIDI learning race conditions
 * - ✅ Performance optimized OBS data loading
 * - ✅ Modern sidebar-based deck management
 * - ✅ No more unnecessary hundres of OBS data loads
 * - ✅ Centralized state management
 * - ✅ Better UX with preview and categories
 * 
 * Features:
 * - Global keyboard hotkeys for deck switching
 * - Individual button keyboard shortcuts
 * - MIDI learning that actually works
 * - Drag & drop deck management
 * - Categories and search
 * - Performance mode for large setups
 */
const OptimizedHotkeyDeckManager = () => {
  return <HotkeyDeckManager />;
};

export default OptimizedHotkeyDeckManager;