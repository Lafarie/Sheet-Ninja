'use client';

import React, { useState, useEffect } from 'react';
import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Settings, Plus, Trash2, Loader2 } from 'lucide-react';

interface ProjectMappingProps {
  onComplete: () => void;
}

export function ProjectMapping({ onComplete }: ProjectMappingProps) {
  const { 
    gitlab, 
    sheets, 
    projectMappings, 
    addProjectMapping, 
    updateProjectMapping, 
    removeProjectMapping,
    setProjectMappings,
    setProjectsLoading 
  } = useSetupStore();
  const { addNotification } = useUIStore();
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // Fetch project names from Google Sheets
  const fetchProjectNames = async () => {
    if (!sheets.spreadsheetId || !sheets.worksheetName) return;

    setLoading(true);
    try {
      const response = await fetch('/api/sheet-project-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: sheets.spreadsheetId,
          worksheetName: sheets.worksheetName,
          serviceAccount: sheets.serviceAccount,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const projectNames = data.projectNames || [];
        
        // Initialize project mappings if none exist
        if (projectMappings.length === 0 && projectNames.length > 0) {
          const initialMappings = projectNames.map((name: string) => ({
            id: Date.now() + Math.random().toString(),
            projectName: name,
            projectId: '',
            milestone: '',
            labels: [],
            estimate: '8h',
            projectData: { labels: [], milestones: [], assignees: [] }
          }));
          setProjectMappings(initialMappings);
        }
      }
    } catch (error) {
      console.error('Error fetching project names:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch project-specific data (labels, milestones, assignees)
  const fetchProjectData = async (projectId: string, mappingId: string) => {
    if (!projectId || !gitlab.token) return;

    setProjectsLoading(true);
    try {
      const response = await fetch('/api/project-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gitlabUrl: gitlab.url,
          gitlabToken: gitlab.token,
          projectId: projectId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        updateProjectMapping(mappingId, {
          projectData: {
            labels: data.labels || [],
            milestones: data.milestones || [],
            assignees: data.assignees || []
          }
        });
      }
    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setProjectsLoading(false);
    }
  };

  const handleProjectIdChange = (mappingId: string, projectId: string) => {
    updateProjectMapping(mappingId, { 
      projectId,
      milestone: '',
      labels: [],
      projectData: { labels: [], milestones: [], assignees: [] }
    });
    
    if (projectId) {
      fetchProjectData(projectId, mappingId);
    }
  };

  const handleAddProject = () => {
    if (!newProjectName.trim()) {
      addNotification({
        type: 'error',
        title: 'Project Name Required',
        message: 'Please enter a project name',
      });
      return;
    }

    const newMapping = {
      id: Date.now().toString(),
      projectName: newProjectName.trim(),
      projectId: '',
      milestone: '',
      labels: [],
      estimate: '8h',
      projectData: { labels: [], milestones: [], assignees: [] }
    };

    addProjectMapping(newMapping);
    setNewProjectName('');
    setShowAddForm(false);
    
    addNotification({
      type: 'success',
      title: 'Project Added',
      message: 'New project mapping has been added',
    });
  };

  const handleRemoveProject = (mappingId: string) => {
    removeProjectMapping(mappingId);
    addNotification({
      type: 'success',
      title: 'Project Removed',
      message: 'Project mapping has been removed',
    });
  };

  const handleProceed = () => {
    if (projectMappings.length === 0) {
      addNotification({
        type: 'error',
        title: 'No Projects',
        message: 'Please add at least one project mapping',
      });
      return;
    }

    addNotification({
      type: 'success',
      title: 'Project Mappings Complete',
      message: `${projectMappings.length} project mappings configured successfully`,
    });
    
    onComplete();
  };

  useEffect(() => {
    if (sheets.headers.length > 0 && projectMappings.length === 0) {
      fetchProjectNames();
    }
  }, [sheets.headers, projectMappings.length, fetchProjectNames]);

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
          <Alert variant="default" className="bg-gray-50 border border-gray-200">
            <AlertDescription className="text-gray-700">
              Each project in your sheet can have its own assignee, milestone, and labels. 
              Configure the settings below for each project that will be synced to GitLab.
            </AlertDescription>
          </Alert>

          {loading && (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading project names from sheet...</p>
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
                onClick={() => handleRemoveProject(project.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* GitLab Project Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">GitLab Project</Label>
              <Select
                value={project.projectId || 'none'}
                onValueChange={(value : any) => handleProjectIdChange(project.id, value === 'none' ? '' : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select GitLab project..." />
                </SelectTrigger>
                <SelectContent className="w-full">
                  <SelectItem value="none" className="w-full">No project selected (won&apos;t sync)</SelectItem>
                  {gitlab.projects.map((gitlabProject) => (
                    <SelectItem key={gitlabProject.id} value={gitlabProject.id} className="w-full">
                      {gitlabProject.name_with_namespace || gitlabProject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!project.projectId || project.projectId === 'none') && (
                <p className="text-xs text-amber-600">
                  This project will be skipped during sync
                </p>
              )}
            </div>

            {/* Milestone */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Milestone</Label>
              <Select
                value={project.milestone || 'none'}
                onValueChange={(value : any) => updateProjectMapping(project.id, { milestone: value === 'none' ? '' : value })}
                disabled={!project.projectId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select milestone..." />
                </SelectTrigger>
                <SelectContent className="w-full">
                  <SelectItem value="none" className="w-full">No milestone</SelectItem>
                  {(project.projectData?.milestones || []).map((milestone) => (
                    <SelectItem key={milestone.id} value={milestone.id} className="w-full">
                      {milestone.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Labels */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Labels</Label>
              <div className="flex flex-wrap gap-2">
                {project.labels.map((label) => (
                  <Badge key={label} variant="secondary" className="flex items-center gap-1">
                    {label}
                    <button
                      onClick={() => updateProjectMapping(project.id, { 
                        labels: project.labels.filter(l => l !== label) 
                      })}
                      className="ml-1 text-xs hover:text-red-500"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
                <Select
                  value=""
                  onValueChange={(value : any) => {
                    if (value && !project.labels.includes(value)) {
                      updateProjectMapping(project.id, { 
                        labels: [...project.labels, value] 
                      });
                    }
                  }}
                  disabled={!project.projectId}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Add label..." />
                  </SelectTrigger>
                  <SelectContent className="w-full">
                    {(project.projectData?.labels || [])
                      .filter(label => !project.labels.includes(label.name))
                      .map((label) => (
                        <SelectItem key={label.id} value={label.name} className="w-full">
                          {label.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Estimate */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Default Estimate</Label>
              <Input
                type="text"
                placeholder="8h"
                value={project.estimate}
                onChange={(e : any) => updateProjectMapping(project.id, { estimate: e.target.value })}
                className="w-32"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add New Project */}
      <Card>
        <CardContent className="p-4">
          {!showAddForm ? (
            <Button
              size="sm"
              variant="outline" 
              className="w-full"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Project Mapping
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Project Name</Label>
                <Input
                  className="w-full"
                  type="text"
                  placeholder="Enter project name"
                  value={newProjectName}
                  onChange={(e : any) => setNewProjectName(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="default" onClick={handleAddProject} className="w-full">Add Project</Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewProjectName('');
                  }}
                >
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
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span>Total Projects:</span>
                <Badge variant="secondary" className="text-xs">{projectMappings.length}</Badge>
              </div>
              <div className="flex justify-between">
                <span>Projects with Milestones:</span>
                <Badge variant="secondary" className="text-xs">
                  {projectMappings.filter(p => p.milestone).length}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Projects with Labels:</span>
                <Badge variant="secondary" className="text-xs">
                  {projectMappings.filter(p => p.labels.length > 0).length}
                </Badge>
              </div>
            </div>
            
            <Button size="sm" variant="default" onClick={handleProceed} className="w-full">
              Proceed to Sync
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
