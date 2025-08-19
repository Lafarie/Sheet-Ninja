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
  const [projectData, setProjectData] = useState(null);

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
      toast.success('Project data fetched successfully!');
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

          <div>
            <Label htmlFor="projectId">Project ID *</Label>
            <Input
              id="projectId"
              type="text"
              placeholder="Enter GitLab project ID"
              value={config.projectId}
              onChange={(e) => updateConfig({ projectId: e.target.value })}
            />
          </div>

          <Button 
            onClick={fetchProjectData} 
            disabled={loading || !config.gitlabToken || !config.projectId}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fetch Project Data
          </Button>
        </CardContent>
      </Card>

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
                value={config.defaultAssignee}
                onValueChange={(value) => updateConfig({ defaultAssignee: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No default assignee</SelectItem>
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
                value={config.defaultMilestone}
                onValueChange={(value) => updateConfig({ defaultMilestone: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select milestone..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No default milestone</SelectItem>
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
                value={config.defaultLabel}
                onValueChange={(value) => updateConfig({ defaultLabel: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select label..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No default label</SelectItem>
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

      {projectData && (
        <Alert>
          <AlertDescription>
            ✅ GitLab configuration complete! You can now proceed to configure Google Sheets.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
