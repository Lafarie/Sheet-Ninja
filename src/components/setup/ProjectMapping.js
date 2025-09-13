import { useState, useEffect, useCallback, useRef } from 'react';
import { useStepTransition } from './useStepTransition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';

// Custom Label Selector Component with search and dropdown functionality
function LabelSelector({ project, onAddLabel, onRemoveLabel }) {
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
          value={searchTerm}
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
                    <span className="text-green-600">Create &quot;{searchTerm.trim()}&quot;</span>
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
                <span>Create &quot;{searchTerm.trim()}&quot;</span>
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

// Custom Assignee Selector Component with search and dropdown functionality
function AssigneeSelector({ project, currentAssignee, onAssigneeChange, disabled }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputRef, setInputRef] = useState(null);

  // Get assignees from project data
  const getAssignees = () => {
    if (!project.projectData?.assignees) return [];
    return project.projectData.assignees.reduce((acc, assignee) => {
      if (!acc.find(a => a.username === assignee.username)) {
        acc.push(assignee);
      }
      return acc;
    }, []);
  };

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
  const getCurrentAssigneeDisplay = () => {
    if (!currentAssignee) return '';
    const assignee = getAssignees().find(a => a.username === currentAssignee);
    return assignee ? `@${assignee.username} (${assignee.name || assignee.username})` : currentAssignee;
  };

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
  }, [currentAssignee, showDropdown]);

  const filteredAssignees = getFilteredAssignees();

  return (
    <div className="relative">
      <Input
        ref={setInputRef}
        placeholder={disabled ? "Select GitLab project first" : "Type to search assignees..."}
        value={showDropdown ? searchTerm : (currentAssignee ? getCurrentAssigneeDisplay() : '')}
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

// Custom Milestone Selector Component with search and dropdown functionality
function MilestoneSelector({ project, currentMilestone, onMilestoneChange, disabled }) {
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
  const getCurrentMilestoneDisplay = () => {
    if (!currentMilestone) return '';
    const milestone = project.projectData?.milestones?.find(m => m.id.toString() === currentMilestone);
    return milestone ? milestone.title : currentMilestone;
  };

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
  }, [currentMilestone, showDropdown]);

  const filteredMilestones = getFilteredMilestones();

  return (
    <div className="relative">
      <Input
        ref={setInputRef}
        placeholder={disabled ? "Select GitLab project first" : "Type to search milestones..."}
        value={showDropdown ? searchTerm : (currentMilestone ? getCurrentMilestoneDisplay() : '')}
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
              No milestones found matching &quot;{searchTerm}&quot;
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

export function ProjectMapping({ 
  config, 
  projectMappings, 
  setProjectMappings, 
  currentHeaders,
  apiBaseUrl,
  setCurrentStep,
  setActiveTab
}) {
  const [uniqueProjectNames, setUniqueProjectNames] = useState([]);
  const projectMappingsRef = useRef(null);
  const { animating, transitionTo } = useStepTransition(setCurrentStep, { delay: 700 });
  // override to also switch the active tab to 'sync' when moving to step 5
  const { animating: animating2, transitionTo: transitionToSync } = useStepTransition(setCurrentStep, { delay: 700, setActiveTab, tabValue: 'sync' });
  const [showAddProject, setShowAddProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProjectData, setLoadingProjectData] = useState({});

  // Fetch unique project names from Google Sheet
  const fetchProjectNamesFromSheet = useCallback(async () => {
    if (!config.spreadsheetId || !config.worksheetName) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/sheet-project-names`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: config.spreadsheetId,
          worksheetName: config.worksheetName,
          // Include inline service account creds so server can use them immediately
          serviceAccount: config.serviceAccount || null,
          serviceAccountFilename: config.serviceAccountFilename || null,
          serviceAccountEmail: config.serviceAccountEmail || (config.serviceAccount && config.serviceAccount.client_email) || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setUniqueProjectNames(data.projectNames || []);
        
        // Initialize project mappings if none exist
        if (projectMappings.length === 0 && data.projectNames && data.projectNames.length > 0) {
          const initialMappings = data.projectNames.map(projectName => ({
            id: Date.now() + Math.random(),
            projectName: projectName,
            projectId: '',
            assignee: '',
            milestone: '',
            labels: [],
            projectData: { labels: [], milestones: [], assignees: [] }
          }));
          setProjectMappings(initialMappings);
        }
      } else {
        toast.error('Failed to fetch project names from sheet');
      }
    } catch (error) {
      console.error('Error fetching project names:', error);
      toast.error('Error fetching project names: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, config.spreadsheetId, config.worksheetName, projectMappings.length, setProjectMappings]);

  // Extract unique project names from sheet data when headers or sheet config change
  useEffect(() => {
    if (currentHeaders && currentHeaders.length > 0) {
      // Only fetch if we don't already have mappings initialized to avoid repeated calls
      if (projectMappings.length === 0) {
        fetchProjectNamesFromSheet();
      }
    }
    // We intentionally only depend on currentHeaders and sheet identifiers + projectMappings.length
  }, [currentHeaders, config.spreadsheetId, config.worksheetName, projectMappings.length, fetchProjectNamesFromSheet]);

  // Auto-scroll to Project Mappings when this component is mounted or when transition to sync completes
  useEffect(() => {
    const tryScroll = () => {
      try {
        if (projectMappingsRef.current && typeof projectMappingsRef.current.scrollIntoView === 'function') {
          projectMappingsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (e) {
        // ignore scrolling errors
      }
    };

    // Scroll on mount
    tryScroll();

    // Scroll again when the sync transition finishes (animating2 may indicate transition)
    if (!animating2) {
      // small timeout to let layout settle
      setTimeout(tryScroll, 300);
    }
  }, [animating2]);

  // Update project mapping and fetch project-specific data when project ID changes
  const handleProjectIdChange = async (projectMappingId, gitlabProjectId) => {
    // Update the project mapping
    setProjectMappings(prevMappings => prevMappings.map(project => {
      if (project.id === projectMappingId) {
        return { 
          ...project, 
          projectId: gitlabProjectId,
          // Reset project-specific settings when project changes
          assignee: '',
          milestone: '',
          labels: [],
          projectData: { labels: [], milestones: [], assignees: [] }
        };
      }
      return project;
    }));

    // Fetch project-specific data if a valid project is selected
    if (gitlabProjectId && gitlabProjectId !== 'none') {
      await fetchProjectSpecificData(projectMappingId, gitlabProjectId);
    }
  };

  // Fetch project-specific data (assignees, milestones, labels)
  const fetchProjectSpecificData = async (projectMappingId, gitlabProjectId) => {
    setLoadingProjectData(prev => ({ ...prev, [projectMappingId]: true }));
    
    try {
      const response = await fetch(`${apiBaseUrl}/api/project-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gitlabUrl: config.gitlabUrl,
          gitlabToken: config.gitlabToken,
          projectId: gitlabProjectId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the specific project mapping with fetched data
        setProjectMappings(prevMappings => prevMappings.map(project => {
          if (project.id === projectMappingId) {
            return { 
              ...project, 
              projectData: {
                labels: data.labels || [],
                milestones: data.milestones || [],
                assignees: data.assignees || []
              }
            };
          }
          return project;
        }));
        
        toast.success('Project data loaded successfully');
      } else {
        toast.error('Failed to fetch project data');
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
      toast.error('Error fetching project data: ' + error.message);
    } finally {
      setLoadingProjectData(prev => ({ ...prev, [projectMappingId]: false }));
    }
  };

  // Initialize project mappings with default settings
  useEffect(() => {
    if (config.projectData && uniqueProjectNames.length > 0 && projectMappings.length === 0) {
      const defaultMappings = uniqueProjectNames.map(projectName => ({
        id: Date.now() + Math.random(),
        projectName,
        assignee: config.defaultAssignee || '',
        milestone: config.defaultMilestone || '',
        labels: config.defaultLabel ? [config.defaultLabel] : [],
        estimate: config.defaultEstimate || '8h'
      }));
      setProjectMappings(defaultMappings);
    }
  }, [config.projectData, uniqueProjectNames, config.defaultAssignee, config.defaultEstimate, config.defaultLabel, config.defaultMilestone, projectMappings.length, setProjectMappings]);

  const addProjectMapping = () => {
    if (!newProjectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    const newMapping = {
      id: Date.now(),
      projectName: newProjectName.trim(),
      assignee: config.defaultAssignee || '',
      milestone: config.defaultMilestone || '',
      labels: config.defaultLabel ? [config.defaultLabel] : [],
      estimate: config.defaultEstimate || '8h'
    };

    const updatedMappings = [...projectMappings, newMapping];
    setProjectMappings(updatedMappings);
    
    setNewProjectName('');
    setShowAddProject(false);
    toast.success('Project mapping added');
  };

  const removeProjectMapping = (projectId) => {
    const updatedMappings = projectMappings.filter(p => p.id !== projectId);
    setProjectMappings(updatedMappings);
    toast.success('Project mapping removed');
  };

  const updateProjectMapping = (projectId, field, value) => {
    const updatedMappings = projectMappings.map(project => {
      if (project.id === projectId) {
        return { ...project, [field]: value };
      }
      return project;
    });
    setProjectMappings(updatedMappings);
  };

  const addLabelToProject = (projectId, labelName) => {
    if (labelName && labelName !== 'none') {
      const updatedMappings = projectMappings.map(project => {
        if (project.id === projectId) {
          const newLabels = project.labels.includes(labelName) 
            ? project.labels 
            : [...project.labels, labelName];
          return { ...project, labels: newLabels };
        }
        return project;
      });
      setProjectMappings(updatedMappings);
    }
  };

  const removeLabelFromProject = (projectId, labelName) => {
    const updatedMappings = projectMappings.map(project => {
      if (project.id === projectId) {
        return { ...project, labels: project.labels.filter(l => l !== labelName) };
      }
      return project;
    });
    setProjectMappings(updatedMappings);
  };

  const proceedToSync = () => {
    if (projectMappings.length === 0) {
      toast.error('Please add at least one project mapping');
      return;
    }
  // Smoothly scroll and transition to sync step (also switches active tab)
  transitionToSync(5);
    toast.success('Project mappings configured successfully!');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Project Mappings
          </CardTitle>
          <CardDescription>
            Configure individual settings for each project in your sheet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Each project in your sheet can have its own assignee, milestone, and labels. 
              Configure the settings below for each project that will be synced to GitLab.
            </AlertDescription>
          </Alert>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-4">
              <div className="text-sm text-gray-500">Loading project names from sheet...</div>
            </div>
          )}

          {/* No Projects Found */}
          {!loading && uniqueProjectNames.length === 0 && (
            <Alert>
              <AlertDescription>
                No project names found in your sheet. Make sure your sheet has a &quot;Project Name&quot; or similar column with data.
                You can also add projects manually below.
              </AlertDescription>
            </Alert>
          )}

          {/* Detected Projects */}
          {!loading && uniqueProjectNames.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Detected Projects from Sheet</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {uniqueProjectNames.map((name, index) => (
                  <Badge key={index} variant="outline">{name}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Mapping Cards */}
      {projectMappings.map((project) => (
        <Card key={project.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{project.projectName}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => removeProjectMapping(project.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* GitLab Project Selection */}
            <div>
              <Label className="py-1">GitLab Project</Label><i className='text-xs py-2'> {project.projectId && `If project name is not shown in the dropdown but its already picked Project ID:{${project.projectId}}`}</i>
              <Select
                value={project.projectId || 'none'}
                onValueChange={(value) => handleProjectIdChange(project.id, value === 'none' ? '' : value)}
              >
                <SelectTrigger className="mb-2 py-2">
                  <SelectValue placeholder="Select GitLab project..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project selected (won&lsquo;t sync)</SelectItem>
                  {config.availableProjects?.map((gitlabProject) => (
                    <SelectItem key={gitlabProject.id} value={gitlabProject.id.toString()}>
                      {gitlabProject.name_with_namespace || gitlabProject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!project.projectId || project.projectId === 'none') && (
                <p className="text-xs text-amber-600 mt-1">
                  This project will be skipped during sync
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Assignee */}
              <div>
                <Label className="pb-2">Assignee</Label>
                <AssigneeSelector
                  project={project}
                  currentAssignee={project.assignee}
                  onAssigneeChange={(value) => updateProjectMapping(project.id, 'assignee', value)}
                  disabled={!project.projectId || loadingProjectData[project.id]}
                />
              </div>

              {/* Milestone */}
              <div>
                <Label className="pb-2">Milestone</Label>
                <MilestoneSelector
                  project={project}
                  currentMilestone={project.milestone}
                  onMilestoneChange={(value) => updateProjectMapping(project.id, 'milestone', value)}
                  disabled={!project.projectId || loadingProjectData[project.id]}
                />
              </div>
            </div>

            {/* Labels */}
            <div>
              <Label className="pb-2">Labels</Label>
              {loadingProjectData[project.id] ? (
                <div className="text-sm text-gray-500 py-2">Loading labels...</div>
              ) : !project.projectId ? (
                <div className="text-sm text-gray-500 py-2">Select GitLab project first</div>
              ) : (
                <LabelSelector
                  project={project}
                  onAddLabel={(labelName) => addLabelToProject(project.id, labelName)}
                  onRemoveLabel={(labelName) => removeLabelFromProject(project.id, labelName)}
                />
              )}
            </div>

            {/* Estimate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="pb-2">Default Estimate</Label>
                <Input
                  placeholder="8h"
                  value={project.estimate}
                  onChange={(e) => updateProjectMapping(project.id, 'estimate', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add New Project */}
      <Card>
        <CardContent className="p-4">
          {!showAddProject ? (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setShowAddProject(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Project Mapping
            </Button>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Project Name</Label>
                <Input
                  placeholder="Enter project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={addProjectMapping}>Add Project</Button>
                <Button variant="outline" onClick={() => {
                  setShowAddProject(false);
                  setNewProjectName('');
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {projectMappings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Configuration Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Projects:</span>
                <Badge variant="secondary">{projectMappings.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Projects with Assignees:</span>
                <Badge variant="secondary">
                  {projectMappings.filter(p => p.assignee).length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Projects with Milestones:</span>
                <Badge variant="secondary">
                  {projectMappings.filter(p => p.milestone).length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Projects with Labels:</span>
                <Badge variant="secondary">
                  {projectMappings.filter(p => p.labels.length > 0).length}
                </Badge>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <Button onClick={proceedToSync} className="w-full">
              Proceed to Sync
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
