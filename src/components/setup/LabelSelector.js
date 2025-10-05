'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';

export function LabelSelector({ project, onAddLabel, onRemoveLabel }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputRef, setInputRef] = useState(null);

  // Filter available labels based on search term and exclude already selected ones
  const getFilteredLabels = () => {
    if (!project.projectData?.labels) return [];
    
    return project.projectData.labels.filter(label => {
      const matchesSearch = label.name.toLowerCase().includes(searchTerm.toLowerCase());
      const notAlreadySelected = !project.labels.includes(label.name);
      return matchesSearch && notAlreadySelected;
    });
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    setShowDropdown(true);
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow click on dropdown items
    setTimeout(() => setShowDropdown(false), 200);
  };

  const handleLabelSelect = (labelName) => {
    onAddLabel(labelName);
    setSearchTerm('');
    setShowDropdown(false);
    if (inputRef) {
      inputRef.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      // If there's an exact match in filtered labels, select it
      const exactMatch = getFilteredLabels().find(
        label => label.name.toLowerCase() === searchTerm.toLowerCase()
      );
      
      if (exactMatch) {
        handleLabelSelect(exactMatch.name);
      } else {
        // Add as custom label if no exact match found
        onAddLabel(searchTerm.trim());
        setSearchTerm('');
        setShowDropdown(false);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setSearchTerm('');
    }
  };

  const filteredLabels = getFilteredLabels();

  return (
    <div className="space-y-2">
      {/* Search Input with Dropdown */}
      <div className="relative">
        <Input
          ref={setInputRef}
          placeholder="Type to search labels or create new..."
          value={searchTerm ?? ''}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          className="pr-10"
        />
        
        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-auto">
            {filteredLabels.length > 0 ? (
              <>
                {filteredLabels.map((label) => (
                  <button
                    key={label.id}
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm"
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur
                      handleLabelSelect(label.name);
                    }}
                  >
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: `#${label.color}` }}
                    ></div>
                    <span className="truncate">{label.name}</span>
                  </button>
                ))}
                {/* Add custom label option if search term doesn't match any existing label */}
                {searchTerm.trim() && !filteredLabels.some(
                  label => label.name.toLowerCase() === searchTerm.toLowerCase()
                ) && (
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm border-t border-gray-100"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onAddLabel(searchTerm.trim());
                      setSearchTerm('');
                      setShowDropdown(false);
                    }}
                  >
                    <Plus className="w-3 h-3 flex-shrink-0 text-green-600" />
                    <span className="text-green-600">Create "{searchTerm.trim()}"</span>
                  </button>
                )}
              </>
            ) : searchTerm.trim() ? (
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm text-green-600"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAddLabel(searchTerm.trim());
                  setSearchTerm('');
                  setShowDropdown(false);
                }}
              >
                <Plus className="w-3 h-3 flex-shrink-0" />
                <span>Create "{searchTerm.trim()}"</span>
              </button>
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                {project.projectData?.labels?.length === 0 ? 'No labels available' : 'Start typing to search...'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Labels */}
      {project.labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {project.labels.map((labelName) => {
            const labelData = project.projectData?.labels?.find(l => l.name === labelName);
            return (
              <Badge 
                key={labelName}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {labelData && (
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: `#${labelData.color}` }}
                  ></div>
                )}
                {labelName}
                <button
                  type="button"
                  onClick={() => onRemoveLabel(labelName)}
                  className="ml-1 text-xs hover:text-red-500"
                >
                  ×
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
