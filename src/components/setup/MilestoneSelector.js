'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';

export function MilestoneSelector({ project, currentMilestone, onMilestoneChange, disabled }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputRef, setInputRef] = useState(null);

  // Filter available milestones based on search term
  const getFilteredMilestones = () => {
    if (!project.projectData?.milestones) return [];
    if (!searchTerm.trim()) return project.projectData.milestones;
    
    return project.projectData.milestones.filter(milestone =>
      milestone.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  // Get current milestone display name
  const getCurrentMilestoneDisplay = useCallback(() => {
    if (!currentMilestone) return '';
    const milestone = project.projectData?.milestones?.find(m => m.id.toString() === currentMilestone);
    return milestone ? milestone.title : currentMilestone;
  }, [currentMilestone, project.projectData]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setShowDropdown(true);
      if (!searchTerm && currentMilestone) {
        setSearchTerm(getCurrentMilestoneDisplay());
      }
    }
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow click on dropdown items
    setTimeout(() => {
      setShowDropdown(false);
      // Reset search term to current milestone display
      if (currentMilestone) {
        setSearchTerm(getCurrentMilestoneDisplay());
      } else {
        setSearchTerm('');
      }
    }, 200);
  };

  const handleMilestoneSelect = (milestoneId) => {
    onMilestoneChange(milestoneId);
    setSearchTerm(getCurrentMilestoneDisplay());
    setShowDropdown(false);
    if (inputRef) {
      inputRef.blur();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      const filteredMilestones = getFilteredMilestones();
      if (filteredMilestones.length === 1) {
        handleMilestoneSelect(filteredMilestones[0].id.toString());
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      if (currentMilestone) {
        setSearchTerm(getCurrentMilestoneDisplay());
      } else {
        setSearchTerm('');
      }
    }
  };

  // Update search term when currentMilestone changes
  useEffect(() => {
    if (currentMilestone && !showDropdown) {
      setSearchTerm(getCurrentMilestoneDisplay());
    } else if (!currentMilestone && !showDropdown) {
      setSearchTerm('');
    }
  }, [currentMilestone, showDropdown, getCurrentMilestoneDisplay]);

  const filteredMilestones = getFilteredMilestones();

  return (
    <div className="relative">
      <Input
        ref={setInputRef}
        placeholder={disabled ? "Select GitLab project first" : "Type to search milestones..."}
        value={showDropdown ? (searchTerm ?? '') : (currentMilestone ? getCurrentMilestoneDisplay() : '')}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="pr-10"
      />
      
      {/* Dropdown */}
      {showDropdown && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
          {/* No milestone option */}
          <button
            type="button"
            className={`w-full px-3 py-2 text-left hover:bg-gray-50 text-sm ${!currentMilestone ? 'bg-gray-100' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleMilestoneSelect('');
            }}
          >
            No milestone
          </button>
          
          {filteredMilestones.length > 0 ? (
            filteredMilestones.map((milestone) => (
              <button
            key={milestone.id}
            type="button"
            className={`w-full px-3 py-2 text-left hover:bg-gray-50 text-sm ${currentMilestone === milestone.id.toString() ? 'bg-gray-100' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleMilestoneSelect(milestone.id.toString());
            }}
          >
            {milestone.title}
          </button>
        ))
      ) : searchTerm.trim() ? (
        <div className="px-3 py-2 text-sm text-gray-500">
          No milestones found matching "{searchTerm}"
        </div>
      ) : (
        <div className="px-3 py-2 text-sm text-gray-500">
          {project.projectData?.milestones?.length === 0 ? 'No milestones available' : 'Start typing to search...'}
        </div>
      )}
    </div>
  )}
</div>
);
}
