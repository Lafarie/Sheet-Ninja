 'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';

export function AssigneeSelector({ project, currentAssignee, onAssigneeChange, disabled }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputRef, setInputRef] = useState(null);

  // Get assignees from project data
  const getAssignees = useCallback(() => {
    if (!project.projectData?.assignees) return [];
    return project.projectData.assignees.reduce((acc, assignee) => {
      if (!acc.find(a => a.username === assignee.username)) {
        acc.push(assignee);
      }
      return acc;
    }, []);
  }, [project.projectData]);

  // Filter available assignees based on search term
  const getFilteredAssignees = () => {
    const assignees = getAssignees();
    if (!searchTerm.trim()) return assignees;
    
    return assignees.filter(assignee => {
      const searchLower = searchTerm.toLowerCase();
      return (
        assignee.username.toLowerCase().includes(searchLower) ||
        (assignee.name && assignee.name.toLowerCase().includes(searchLower))
      );
    });
  };

  // Get current assignee display name
  const getCurrentAssigneeDisplay = useCallback(() => {
    if (!currentAssignee) return '';
    const assignee = getAssignees().find(a => a.username === currentAssignee);
    return assignee ? `@${assignee.username} (${assignee.name || assignee.username})` : currentAssignee;
  }, [currentAssignee, getAssignees]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setShowDropdown(true);
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setShowDropdown(true);
      if (!searchTerm && currentAssignee) {
        setSearchTerm(getCurrentAssigneeDisplay());
      }
    }
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow click on dropdown items
    setTimeout(() => {
      setShowDropdown(false);
      // Reset search term to current assignee display
      if (currentAssignee) {
        setSearchTerm(getCurrentAssigneeDisplay());
      } else {
        setSearchTerm('');
      }
    }, 200);
  };

  const handleAssigneeSelect = (assigneeUsername) => {
    onAssigneeChange(assigneeUsername);
    setSearchTerm(getCurrentAssigneeDisplay());
    setShowDropdown(false);
    if (inputRef) {
      inputRef.blur();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && searchTerm.trim()) {
      e.preventDefault();
      const filteredAssignees = getFilteredAssignees();
      if (filteredAssignees.length === 1) {
        handleAssigneeSelect(filteredAssignees[0].username);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      if (currentAssignee) {
        setSearchTerm(getCurrentAssigneeDisplay());
      } else {
        setSearchTerm('');
      }
    }
  };

  // Update search term when currentAssignee changes
  useEffect(() => {
    if (currentAssignee && !showDropdown) {
      setSearchTerm(getCurrentAssigneeDisplay());
    } else if (!currentAssignee && !showDropdown) {
      setSearchTerm('');
    }
  }, [currentAssignee, showDropdown, getCurrentAssigneeDisplay]);

  const filteredAssignees = getFilteredAssignees();

  return (
    <div className="relative">
      <Input
        ref={setInputRef}
        placeholder={disabled ? "Select GitLab project first" : "Type to search assignees..."}
        value={showDropdown ? (searchTerm ?? '') : (currentAssignee ? getCurrentAssigneeDisplay() : '')}
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
          {/* No assignee option */}
          <button
            type="button"
            className={`w-full px-3 py-2 text-left hover:bg-gray-50 text-sm ${!currentAssignee ? 'bg-gray-100' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              handleAssigneeSelect('');
            }}
          >
            No assignee
          </button>
          
          {filteredAssignees.length > 0 ? (
            filteredAssignees.map((assignee) => (
              <button
                key={assignee.username}
                type="button"
                className={`w-full px-3 py-2 text-left hover:bg-gray-50 text-sm ${currentAssignee === assignee.username ? 'bg-gray-100' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAssigneeSelect(assignee.username);
                }}
              >
                @{assignee.username} ({assignee.name || assignee.username})
              </button>
            ))
          ) : searchTerm.trim() ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              No assignees found matching &quot;{searchTerm}&quot;
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              {getAssignees().length === 0 ? 'No assignees available' : 'Start typing to search...'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
