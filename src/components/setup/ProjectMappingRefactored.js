'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStepTransition } from './useStepTransition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Plus, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useConfigStore } from '@/lib/store';
import { ProjectMappingCard } from './ProjectMappingCard';
import { logger } from '@/lib/logger';

export function ProjectMappingRefactored({ 
  apiBaseUrl,
  setCurrentStep,
  setActiveTab
}) {
  const {
    config,
    projectMappings,
    setProjectMappings,
    updateConfig,
    setCurrentHeaders
  } = useConfigStore();

  const [uniqueProjectNames, setUniqueProjectNames] = useState([]);
  const projectMappingsRef = useRef(null);
  const { animating, transitionTo } = useStepTransition(setCurrentStep, { delay: 700 });
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
            estimate: '8h',
            projectData: { labels: [], milestones: [], assignees: [] }
          }));
          setProjectMappings(initialMappings);
        }
      } else {
        toast.error('Failed to fetch project names from sheet');
      }
    } catch (error) {
      logger.error('Error fetching project names:', error);
      toast.error('Error fetching project names: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, config.spreadsheetId, config.worksheetName, projectMappings.length, setProjectMappings, config.serviceAccount, config.serviceAccountEmail, config.serviceAccountFilename]);

  // Extract unique project names from sheet data when headers or sheet config change
  useEffect(() => {
    if (config.currentHeaders && config.currentHeaders.length > 0) {
      // Only fetch if we don't already have mappings initialized to avoid repeated calls
      if (projectMappings.length === 0) {
        fetchProjectNamesFromSheet();
      }
    }
  }, [config.currentHeaders, config.spreadsheetId, config.worksheetName, projectMappings.length, fetchProjectNamesFromSheet]);

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

    // Scroll again when the sync transition finishes
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
      logger.error('Error fetching project data:', error);
      toast.error('Error fetching project data: ' + error.message);
    } finally {
      setLoadingProjectData(prev => ({ ...prev, [projectMappingId]: false }));
    }
  };

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
      estimate: config.defaultEstimate || '8h',
      projectData: { labels: [], milestones: [], assignees: [] }
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
      <div ref={projectMappingsRef}>
        {projectMappings.map((project) => (
          <ProjectMappingCard
            key={project.id}
            project={project}
            config={config}
            onUpdate={updateProjectMapping}
            onRemove={removeProjectMapping}
            onProjectIdChange={handleProjectIdChange}
            loadingProjectData={loadingProjectData[project.id]}
          />
        ))}
      </div>

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
                  value={newProjectName ?? ''}
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
