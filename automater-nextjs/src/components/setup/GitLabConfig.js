import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, GitBranch, Users, Tag, Milestone } from 'lucide-react';
import { toast } from 'sonner';

export function GitLabConfig({ config, updateConfig, setCurrentStep, apiBaseUrl }) {
  const [loading, setLoading] = useState(false);
  const [fetchingProjects, setFetchingProjects] = useState(false);
  const [projectData, setProjectData] = useState(null);
  const [availableProjects, setAvailableProjects] = useState([]);

  const fetchAvailableProjects = async () => {
    if (!config.gitlabToken) {
      toast.error('Please enter your GitLab token first');
      return;
    }

    setFetchingProjects(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/gitlab-project-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gitlabUrl: config.gitlabUrl,
          gitlabToken: config.gitlabToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAvailableProjects(data.projects);
      toast.success(`Found ${data.total} projects`);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to fetch projects: ' + error.message);
    } finally {
      setFetchingProjects(false);
    }
  };

  const fetchProjectData = async () => {
    if (!config.gitlabToken) {
      toast.error('Please enter your GitLab token');
      return;
    }

    if (!config.projectId) {
      toast.error('Please enter a project ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/project-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gitlabUrl: config.gitlabUrl,
          gitlabToken: config.gitlabToken,
          projectId: config.projectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProjectData(data);
      updateConfig({ projectData: data });
      toast.success(`Connected to project: ${data.name}`);
      setCurrentStep(2);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to fetch project data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Remove duplicate assignees
  const uniqueAssignees = projectData?.assignees ? 
    projectData.assignees.reduce((acc, assignee) => {
      if (!acc.find(a => a.username === assignee.username)) {
        acc.push(assignee);
      }
      return acc;
    }, []) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            GitLab Configuration
          </CardTitle>
          <CardDescription>
            Configure your GitLab connection and fetch project metadata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="gitlabUrl">GitLab URL</Label>
            <Input
              id="gitlabUrl"
              type="url"
              placeholder="https://gitlab.example.com/api/v4/"
              value={config.gitlabUrl}
              onChange={(e) => updateConfig({ gitlabUrl: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="gitlabToken">GitLab Token *</Label>
            <Input
              id="gitlabToken"
              type="password"
              placeholder="Enter your GitLab personal access token"
              value={config.gitlabToken}
              onChange={(e) => updateConfig({ gitlabToken: e.target.value })}
            />
          </div>

          {/* Fetch Projects Button */}
          <Button 
            onClick={fetchAvailableProjects}
            disabled={fetchingProjects || !config.gitlabToken}
            variant="outline"
            className="w-full"
          >
            {fetchingProjects && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fetch Available Projects
          </Button>

          {/* Project Selection */}
          {availableProjects.length > 0 && (
            <div>
              <Label htmlFor="projectSelection">Select Project *</Label>
              <Select
                value={config.projectId}
                onValueChange={(value) => {
                  const selectedProject = availableProjects.find(p => p.id.toString() === value);
                  updateConfig({ 
                    projectId: value,
                    selectedProject: selectedProject 
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableProjects.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      <div className="flex flex-col">
                        <div className="font-medium">{project.name}</div>
                        <div className="text-xs text-gray-500">{project.path_with_namespace}</div>
                        {project.description && (
                          <div className="text-xs text-gray-400 truncate max-w-[300px]">
                            {project.description}
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                Found {availableProjects.length} projects you have access to
              </p>
            </div>
          )}

          {/* Manual Project ID Input (fallback) */}
          {availableProjects.length === 0 && (
            <div>
              <Label htmlFor="projectId">Project ID *</Label>
              <Input
                id="projectId"
                type="text"
                placeholder="Enter GitLab project ID manually"
                value={config.projectId}
                onChange={(e) => updateConfig({ projectId: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">
                You can enter the project ID manually if the project list doesn't load
              </p>
            </div>
          )}

          <Button 
            onClick={fetchProjectData} 
            disabled={loading || !config.gitlabToken || !config.projectId}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect to Selected Project
          </Button>
        </CardContent>
      </Card>

      {projectData && (
        <Alert>
          <AlertDescription>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span>✅ Connected to project:</span>
                <Badge variant="outline">{projectData.name}</Badge>
              </div>
              {config.selectedProject && (
                <div className="text-sm text-gray-600">
                  <div><strong>Namespace:</strong> {config.selectedProject.path_with_namespace}</div>
                  {projectData.description && (
                    <div><strong>Description:</strong> {projectData.description}</div>
                  )}
                  <div><strong>Visibility:</strong> {config.selectedProject.visibility}</div>
                  <div><strong>Last Activity:</strong> {new Date(config.selectedProject.last_activity_at).toLocaleDateString()}</div>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {projectData && (
        <Card>
          <CardHeader>
            <CardTitle>Project Metadata</CardTitle>
            <CardDescription>
              Configure default values for new GitLab issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="defaultAssignee">Default Assignee</Label>
              <Select
                value={config.defaultAssignee || 'none'}
                onValueChange={(value) => updateConfig({ defaultAssignee: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default assignee</SelectItem>
                  {uniqueAssignees.map((assignee) => (
                    <SelectItem key={assignee.username} value={`@${assignee.username}`}>
                      @{assignee.username} ({assignee.name || assignee.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="defaultMilestone">Default Milestone</Label>
              <Select
                value={config.defaultMilestone || 'none'}
                onValueChange={(value) => updateConfig({ defaultMilestone: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select milestone..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default milestone</SelectItem>
                  {projectData.milestones?.map((milestone) => (
                    <SelectItem key={milestone.title} value={`%${milestone.title}`}>
                      %{milestone.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="defaultLabel">Default Label</Label>
              <Select
                value={config.defaultLabel || 'none'}
                onValueChange={(value) => updateConfig({ defaultLabel: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select label..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No default label</SelectItem>
                  {projectData.labels?.map((label) => (
                    <SelectItem key={label.name} value={`~${label.name}`}>
                      ~{label.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="defaultEstimate">Default Estimate</Label>
              <Input
                id="defaultEstimate"
                placeholder="8h"
                value={config.defaultEstimate}
                onChange={(e) => updateConfig({ defaultEstimate: e.target.value })}
              />
            </div>

            {/* Project Statistics */}
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                  <Users className="h-4 w-4" />
                  Assignees
                </div>
                <Badge variant="secondary">{uniqueAssignees.length}</Badge>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                  <Milestone className="h-4 w-4" />
                  Milestones
                </div>
                <Badge variant="secondary">{projectData.milestones?.length || 0}</Badge>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-sm text-gray-600">
                  <Tag className="h-4 w-4" />
                  Labels
                </div>
                <Badge variant="secondary">{projectData.labels?.length || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
