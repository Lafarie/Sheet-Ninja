'use client';

import React, { useState } from 'react';
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
      <Card className="border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitBranch className="h-5 w-5" />
            GitLab Configuration
          </CardTitle>
          <CardDescription className="text-sm">
            Connect to your GitLab instance and fetch available projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-2">
            <Label htmlFor="gitlabUrl" className="text-sm font-medium">GitLab URL</Label>
            <Input
              id="gitlabUrl"
              type="url"
              className="w-full"
              placeholder="https://gitlab.example.com/api/v4/"
              value={gitlab.url}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateGitLab({ url: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gitlabToken" className="text-sm font-medium">GitLab Personal Access Token *</Label>
            <Input
              id="gitlabToken"
              type="password"
              className="w-full"
              placeholder="Enter your GitLab personal access token"
              value={gitlab.token}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateGitLab({ token: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Create a personal access token in GitLab with API scope
            </p>
          </div>

          <Button 
            onClick={handleConnect}
            disabled={isConnecting || !gitlab.token}
            variant="default"
            size="sm"
            className="w-full"
          >
            {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect to GitLab
          </Button>

          {gitlab.projects.length > 0 && (
            <Alert variant="default" className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <div className="space-y-2">
                  <p>✅ Successfully connected to GitLab!</p>
                  <div className="flex items-center gap-2">
                    <span>Found {gitlab.projects.length} projects:</span>
                    <Badge variant="secondary" className="text-xs">{gitlab.projects.length}</Badge>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {gitlab.projects.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Available Projects</CardTitle>
            <CardDescription className="text-sm">
              Projects found in your GitLab instance
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {gitlab.projects.map((project) => (
                <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {project.name_with_namespace}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">ID: {project.id}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
