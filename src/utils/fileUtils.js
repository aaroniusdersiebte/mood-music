// Browser-compatible file utilities
class FileUtils {
  constructor() {
    this.audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.wma'];
    this.imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp'];
  }

  // Handle dropped files and return audio files
  async handleDroppedFiles(files) {
    const audioFiles = [];
    const errors = [];

    for (const file of files) {
      try {
        if (this.isAudioFile(file.name)) {
          // Verify file is accessible
          if (await this.verifyFile(file)) {
            audioFiles.push(file);
          } else {
            errors.push({
              file: file.name,
              error: 'File not accessible or corrupted'
            });
          }
        } else {
          errors.push({
            file: file.name,
            error: 'Not a supported audio format'
          });
        }
      } catch (error) {
        errors.push({
          file: file.name,
          error: error.message
        });
      }
    }

    return { audioFiles, errors };
  }

  // Verify file exists and is readable
  async verifyFile(file) {
    try {
      // Check if file has content
      return file && file.size > 0 && file.type;
    } catch {
      return false;
    }
  }

  // Check if file is an audio file
  isAudioFile(filename) {
    const ext = this.getExtension(filename);
    return this.audioExtensions.includes(ext);
  }

  // Check if file is an image file
  isImageFile(filename) {
    const ext = this.getExtension(filename);
    return this.imageExtensions.includes(ext);
  }

  // Get file size in human readable format
  getFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  // Format duration from seconds
  formatDuration(seconds) {
    if (!seconds || seconds === 0) return '--:--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  // Create backup of configuration (browser storage)
  async createBackup(data, backupKey = null) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupId = backupKey || `mood-music-backup-${timestamp}`;
      
      const backupData = {
        ...data,
        backupId,
        timestamp: new Date().toISOString()
      };

      // Store in localStorage with backup prefix
      const backupKeys = this.getBackupKeys();
      backupKeys.push(backupId);
      
      // Keep only last 10 backups
      if (backupKeys.length > 10) {
        const toDelete = backupKeys.splice(0, backupKeys.length - 10);
        toDelete.forEach(key => {
          localStorage.removeItem(`backup_${key}`);
        });
      }

      localStorage.setItem('backup_keys', JSON.stringify(backupKeys));
      localStorage.setItem(`backup_${backupId}`, JSON.stringify(backupData));
      
      return backupId;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw error;
    }
  }

  // Load backup from storage
  async loadBackup(backupId) {
    try {
      const data = localStorage.getItem(`backup_${backupId}`);
      if (!data) {
        throw new Error('Backup not found');
      }
      return JSON.parse(data);
    } catch (error) {
      console.error('Error loading backup:', error);
      throw error;
    }
  }

  // Get list of available backups
  async getBackupList() {
    try {
      const backupKeys = this.getBackupKeys();
      const backups = [];

      for (const key of backupKeys) {
        try {
          const data = localStorage.getItem(`backup_${key}`);
          if (data) {
            const backup = JSON.parse(data);
            backups.push({
              id: key,
              filename: `${key}.json`,
              created: new Date(backup.timestamp),
              size: this.getFileSize(data.length)
            });
          }
        } catch (error) {
          console.error(`Error reading backup ${key}:`, error);
        }
      }

      // Sort by creation date, newest first
      return backups.sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('Error getting backup list:', error);
      return [];
    }
  }

  // Get backup keys from localStorage
  getBackupKeys() {
    try {
      const keys = localStorage.getItem('backup_keys');
      return keys ? JSON.parse(keys) : [];
    } catch {
      return [];
    }
  }

  // Clean up old backups
  async cleanupOldBackups(keepCount = 10) {
    try {
      const backupKeys = this.getBackupKeys();
      
      if (backupKeys.length > keepCount) {
        const toDelete = backupKeys.splice(0, backupKeys.length - keepCount);
        
        toDelete.forEach(key => {
          localStorage.removeItem(`backup_${key}`);
        });

        localStorage.setItem('backup_keys', JSON.stringify(backupKeys));
      }
    } catch (error) {
      console.error('Error cleaning up backups:', error);
    }
  }

  // Ensure data directories exist (no-op in browser)
  async ensureDataDirectories() {
    // Browser doesn't need file system directories
    // Data is stored in localStorage/IndexedDB
    return Promise.resolve();
  }

  // Get relative path for display
  getDisplayPath(filePath, maxLength = 50) {
    if (filePath.length <= maxLength) {
      return filePath;
    }

    const filename = this.getBasename(filePath, true);
    
    if (filename.length >= maxLength - 3) {
      return '...' + filename.slice(-(maxLength - 3));
    }

    return '...' + filePath.slice(-(maxLength));
  }

  // Validate file path
  isValidPath(filePath) {
    try {
      return typeof filePath === 'string' && filePath.length > 0;
    } catch {
      return false;
    }
  }

  // Get file extension
  getExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
  }

  // Check if path is absolute (always false in browser)
  isAbsolutePath(filePath) {
    return false; // Browser doesn't have absolute paths
  }

  // Normalize path for cross-platform compatibility
  normalizePath(filePath) {
    return filePath.replace(/\\/g, '/');
  }

  // Get filename without extension
  getBasename(filePath, includeExt = false) {
    const parts = filePath.split(/[/\\]/);
    const filename = parts[parts.length - 1];
    
    if (includeExt) {
      return filename;
    }
    
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(0, lastDot) : filename;
  }

  // Download data as file
  downloadAsFile(data, filename, mimeType = 'application/json') {
    try {
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  // Read file as text
  async readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  // Read file as array buffer
  async readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Create object URL for file
  createObjectURL(file) {
    try {
      return URL.createObjectURL(file);
    } catch (error) {
      console.error('Error creating object URL:', error);
      return null;
    }
  }

  // Revoke object URL
  revokeObjectURL(url) {
    try {
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error revoking object URL:', error);
    }
  }
}

export default new FileUtils();