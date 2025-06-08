import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save, Palette } from 'lucide-react';
import useMoodStore from '../stores/moodStore';

const MoodEditor = ({ mood, onClose }) => {
  const { addMood, updateMood } = useMoodStore();
  
  const [formData, setFormData] = useState({
    name: mood?.name || '',
    color: mood?.color || '#4ade80',
    background: mood?.background || null,
    pulseSpeed: mood?.pulseSpeed || 2.5,
    intensity: mood?.intensity || 'moderate'
  });

  const [errors, setErrors] = useState({});
  const [backgroundPreview, setBackgroundPreview] = useState(mood?.background || null);

  const predefinedColors = [
    '#4ade80', // Green
    '#ef4444', // Red  
    '#3b82f6', // Blue
    '#f59e0b', // Yellow
    '#8b5cf6', // Purple
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#ec4899', // Pink
    '#84cc16', // Lime
    '#6366f1', // Indigo
    '#14b8a6', // Teal
    '#f43f5e'  // Rose
  ];

  const intensityOptions = [
    { value: 'subtle', label: 'Subtle', description: 'Gentle, barely noticeable effects' },
    { value: 'moderate', label: 'Moderate', description: 'Balanced visual effects' },
    { value: 'extreme', label: 'Extreme', description: 'Strong, attention-grabbing effects' }
  ];

  const handleBackgroundUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        setFormData(prev => ({ ...prev, background: dataUrl }));
        setBackgroundPreview(dataUrl);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeBackground = () => {
    setFormData(prev => ({ ...prev, background: null }));
    setBackgroundPreview(null);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Mood name is required';
    }
    
    if (formData.pulseSpeed < 0.1 || formData.pulseSpeed > 5) {
      newErrors.pulseSpeed = 'Pulse speed must be between 0.1 and 5 seconds';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const moodData = {
      ...formData,
      name: formData.name.trim()
    };

    if (mood) {
      updateMood(mood.id, moodData);
    } else {
      addMood(moodData);
    }

    onClose();
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const getPreviewAnimation = () => {
    const speed = formData.pulseSpeed;
    if (speed < 1) return 'animate-pulse-fast';
    if (speed > 2) return 'animate-pulse-slow';
    return 'animate-pulse';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-800 rounded-xl border border-gray-600 p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {mood ? 'Edit Mood' : 'Create New Mood'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mood Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Mood Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`input-primary w-full ${errors.name ? 'border-red-500' : ''}`}
              placeholder="Enter mood name..."
              maxLength={30}
            />
            {errors.name && (
              <p className="text-red-400 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              <Palette className="w-4 h-4 inline mr-2" />
              Mood Color
            </label>
            
            {/* Predefined Colors */}
            <div className="grid grid-cols-6 gap-3 mb-3">
              {predefinedColors.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleInputChange('color', color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                    formData.color === color 
                      ? 'border-white scale-110' 
                      : 'border-gray-600 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Custom Color Input */}
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={formData.color}
                onChange={(e) => handleInputChange('color', e.target.value)}
                className="w-12 h-8 border border-gray-600 rounded cursor-pointer"
              />
              <input
                type="text"
                value={formData.color}
                onChange={(e) => handleInputChange('color', e.target.value)}
                className="input-primary flex-1"
                placeholder="#ffffff"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
          </div>

          {/* Background Image */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Mood Background Image
            </label>
            
            {backgroundPreview ? (
              <div className="relative">
                <div 
                  className="w-full h-32 rounded-lg border border-gray-600 overflow-hidden bg-cover bg-center"
                  style={{ backgroundImage: `url(${backgroundPreview})` }}
                >
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={removeBackground}
                      className="bg-red-500 text-white px-3 py-1 rounded text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  This image will be used as the background in OBS displays
                </p>
              </div>
            ) : (
              <div>
                <label className="flex flex-col items-center justify-center w-full h-32 border border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700/50 hover:bg-gray-700 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-2 text-sm text-gray-400">
                      <span className="font-semibold">Click to upload</span> background image
                    </p>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">
                  Optional: Upload an image to use as background in OBS displays
                </p>
              </div>
            )}
          </div>

          {/* Pulse Speed */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Pulse Speed: {formData.pulseSpeed}s
            </label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={formData.pulseSpeed}
              onChange={(e) => handleInputChange('pulseSpeed', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Fast (0.1s)</span>
              <span>Slow (5s)</span>
            </div>
            {errors.pulseSpeed && (
              <p className="text-red-400 text-sm mt-1">{errors.pulseSpeed}</p>
            )}
          </div>

          {/* Intensity */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Visual Intensity
            </label>
            <div className="space-y-2">
              {intensityOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-start space-x-3 cursor-pointer group"
                >
                  <input
                    type="radio"
                    name="intensity"
                    value={option.value}
                    checked={formData.intensity === option.value}
                    onChange={(e) => handleInputChange('intensity', e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-white group-hover:text-gray-200">
                      {option.label}
                    </div>
                    <div className="text-xs text-gray-400">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Preview
            </label>
            <div className="relative">
              <div 
                className={`w-full h-24 rounded-lg border border-gray-600 overflow-hidden ${
                  formData.intensity === 'extreme' && formData.pulseSpeed < 1 ? 'animate-pulse-fast' :
                  formData.pulseSpeed > 2 ? 'animate-pulse-slow' : 'animate-pulse'
                }`}
                style={{
                  backgroundImage: backgroundPreview ? `url(${backgroundPreview})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div 
                  className={`w-full h-full ${
                    formData.intensity === 'subtle' ? 'opacity-30' :
                    formData.intensity === 'moderate' ? 'opacity-50' : 'opacity-70'
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${formData.color}40 0%, transparent 70%)`
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-white font-medium">{formData.name || 'Mood Preview'}</div>
                    <div className="text-xs text-gray-300 mt-1">
                      {formData.intensity} • {formData.pulseSpeed}s{backgroundPreview ? ' • Custom Background' : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {mood ? 'Update Mood' : 'Create Mood'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default MoodEditor;