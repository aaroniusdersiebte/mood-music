// Browser-compatible metadata service
class MetadataService {
  constructor() {
    this.supportedFormats = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.wma'];
  }

  async extractMetadata(file) {
    try {
      // Detect if we're in Electron environment
      const isElectron = window.process && window.process.type;
      
      // Use original file path in Electron, blob URL in browser
      const filePath = isElectron && file.path ? file.path : URL.createObjectURL(file);
      
      // Basic file info
      const basicInfo = {
        id: this.generateId(file.name),
        path: filePath,
        originalPath: file.path, // Store original path separately for Electron
        filename: file.name,
        title: this.extractTitleFromFilename(file.name),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        genre: 'Unknown',
        year: null,
        duration: 0,
        bitrate: 0,
        sampleRate: 0,
        cover: null,
        fileSize: file.size,
        dateAdded: new Date().toISOString(),
        lastModified: new Date(file.lastModified).toISOString(),
        isElectron: isElectron,
      };

      // Try to extract audio metadata if possible
      if (window.musicMetadata) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const metadata = await window.musicMetadata.parseBuffer(arrayBuffer);
          
          if (metadata.common) {
            basicInfo.title = metadata.common.title || basicInfo.title;
            basicInfo.artist = metadata.common.artist || basicInfo.artist;
            basicInfo.album = metadata.common.album || basicInfo.album;
            basicInfo.genre = metadata.common.genre?.[0] || basicInfo.genre;
            basicInfo.year = metadata.common.year || basicInfo.year;
          }

          if (metadata.format) {
            basicInfo.duration = metadata.format.duration || 0;
            basicInfo.bitrate = metadata.format.bitrate || 0;
            basicInfo.sampleRate = metadata.format.sampleRate || 0;
          }

          // Extract cover if available
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            basicInfo.cover = await this.processCoverImage(metadata.common.picture[0]);
          }
        } catch (metadataError) {
          console.warn('Could not extract detailed metadata:', metadataError);
        }
      }

      return basicInfo;
    } catch (error) {
      console.error('Error extracting metadata:', error);
      
      // Detect if we're in Electron environment
      const isElectron = window.process && window.process.type;
      const filePath = isElectron && file.path ? file.path : URL.createObjectURL(file);
      
      // Fallback
      return {
        id: this.generateId(file.name),
        path: filePath,
        originalPath: file.path,
        filename: file.name,
        title: this.extractTitleFromFilename(file.name),
        artist: 'Unknown Artist',
        album: 'Unknown Album',
        genre: 'Unknown',
        year: null,
        duration: 0,
        bitrate: 0,
        sampleRate: 0,
        cover: null,
        fileSize: file.size,
        dateAdded: new Date().toISOString(),
        lastModified: new Date(file.lastModified).toISOString(),
        isElectron: isElectron,
      };
    }
  }

  async processCoverImage(pictureData) {
    try {
      // Create blob from picture data
      const blob = new Blob([pictureData.data], { type: pictureData.format });
      
      // Create image element to get dimensions and resize if needed
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      return new Promise((resolve) => {
        img.onload = () => {
          // Resize to 400x400 max
          const maxSize = 400;
          let { width, height } = img;
          
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height * maxSize) / width;
              width = maxSize;
            } else {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to WebP blob if supported, otherwise JPEG
          const quality = 0.8;
          try {
            canvas.toBlob((webpBlob) => {
              if (webpBlob) {
                resolve(URL.createObjectURL(webpBlob));
              } else {
                // Fallback to JPEG
                canvas.toBlob((jpegBlob) => {
                  resolve(URL.createObjectURL(jpegBlob));
                }, 'image/jpeg', quality);
              }
            }, 'image/webp', quality);
          } catch {
            // Fallback to JPEG
            canvas.toBlob((jpegBlob) => {
              resolve(URL.createObjectURL(jpegBlob));
            }, 'image/jpeg', quality);
          }
        };
        
        img.onerror = () => {
          resolve(null);
        };
        
        img.src = URL.createObjectURL(blob);
      });
    } catch (error) {
      console.error('Error processing cover image:', error);
      return null;
    }
  }

  async processMultipleFiles(files, onProgress) {
    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        if (this.isSupported(file.name)) {
          const metadata = await this.extractMetadata(file);
          results.push(metadata);
        } else {
          errors.push({
            file: file.name,
            error: 'Unsupported file format'
          });
        }
      } catch (error) {
        errors.push({
          file: file.name,
          error: error.message
        });
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: files.length,
          processed: results.length,
          errors: errors.length
        });
      }
    }

    return { results, errors };
  }

  extractTitleFromFilename(filename) {
    // Remove extension and clean up filename
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    
    // Try to extract title from common patterns
    // Pattern: "Artist - Title"
    const dashPattern = nameWithoutExt.split(' - ');
    if (dashPattern.length >= 2) {
      return dashPattern.slice(1).join(' - ').trim();
    }
    
    // Pattern: "01. Title" or "Track 01 Title"
    const trackPattern = nameWithoutExt.replace(/^\d+\.?\s*/, '').replace(/^Track\s*\d+\s*/i, '');
    if (trackPattern !== nameWithoutExt) {
      return trackPattern.trim();
    }
    
    // Return cleaned filename
    return nameWithoutExt.trim();
  }

  generateId(filename) {
    // Generate a consistent ID based on filename and timestamp
    const timestamp = Date.now();
    const hash = this.simpleHash(filename + timestamp);
    return hash.toString(36);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  isSupported(filename) {
    const ext = this.getExtension(filename);
    return this.supportedFormats.includes(ext);
  }

  getExtension(filename) {
    const lastDot = filename.lastIndexOf('.');
    return lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : '';
  }

  getSupportedFormats() {
    return [...this.supportedFormats];
  }

  async updateMetadata(songId, updates) {
    try {
      return {
        success: true,
        updates: updates
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addCustomCover(songId, coverFile) {
    try {
      if (!coverFile || !coverFile.type.startsWith('image/')) {
        throw new Error('Invalid image file');
      }

      // Process the image
      const processedCover = await this.processCoverImage({
        data: await coverFile.arrayBuffer(),
        format: coverFile.type
      });

      return processedCover;
    } catch (error) {
      console.error('Error adding custom cover:', error);
      throw error;
    }
  }
}

export default new MetadataService();