'use client';

import { useState } from 'react';
import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Loader2, CheckCircle } from 'lucide-react';

interface GitLabConfigProps {
  onComplete: () => void;
}

export function GitLabConfig({ onComplete }: GitLabConfigProps) {
  const { gitlab, updateGitLab, setGitLabProjects, setGitLabLoading, loading } = useSetupStore();
  const { addNotification } = useUIStore();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (!gitlab.token) {
      addNotification({
        type: 'error',
        title: 'GitLab Token Required',
        message: 'Please enter your GitLab personal access token',
      });
      return;
    }

    setIsConnecting(true);
    setGitLabLoading(true);

    try {
      const response = await fetch('/api/gitlab-project-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gitlabUrl: gitlab.url,
          gitlabToken: gitlab.token,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setGitLabProjects(data.projects || []);
      
      addNotification({
        type: 'success',
        title: 'GitLab Connected',
        message: `Successfully connected! Found ${data.projects?.length || 0} projects`,
      });
      
      onComplete();
    } catch (error) {
      console.error('GitLab connection error:', error);
      addNotification({
        type: 'error',
        title: 'Connection Failed',
        message: `Failed to connect to GitLab: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsConnecting(false);
      setGitLabLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            GitLab Configuration
          </CardTitle>
          <CardDescription>
            Connect to your GitLab instance and fetch available projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="gitlabUrl">GitLab URL</Label>
            <Input
              id="gitlabUrl"
              type="url"
              placeholder="https://gitlab.example.com/api/v4/"
              value={gitlab.url}
              onChange={(e) => updateGitLab({ url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gitlabToken">GitLab Personal Access Token *</Label>
            <Input
              id="gitlabToken"
              type="password"
              placeholder="Enter your GitLab personal access token"
              value={gitlab.token}
              onChange={(e) => updateGitLab({ token: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Create a personal access token in GitLab with API scope
            </p>
          </div>

          <Button 
            onClick={handleConnect}
            disabled={isConnecting || !gitlab.token}
            className="w-full"
          >
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect to GitLab
          </Button>

          {gitlab.projects.length > 0 && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p>✅ Successfully connected to GitLab!</p>
                  <div className="flex items-center gap-2">
                    <span>Found {gitlab.projects.length} projects:</span>
                    <Badge variant="secondary">{gitlab.projects.length}</Badge>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {gitlab.projects.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Available Projects</CardTitle>
            <CardDescription>
              Projects found in your GitLab instance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {gitlab.projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium">{project.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {project.name_with_namespace}
                    </p>
                  </div>
                  <Badge variant="outline">ID: {project.id}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
