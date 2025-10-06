'use client';

import React, { useState, useMemo } from 'react';
import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Loader2, CheckCircle, Search, Filter, Shield, Wifi, WifiOff } from 'lucide-react';

interface GitLabConfigProps {
  onComplete: () => void;
}

export function GitLabConfig({ onComplete }: GitLabConfigProps) {
  const { gitlab, updateGitLab, setGitLabProjects, setGitLabLoading, loading } = useSetupStore();
  const { addNotification } = useUIStore();
  const [isConnecting, setIsConnecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [showVpnModal, setShowVpnModal] = useState(false);

  // Filter projects based on search term and visibility
  const filteredProjects = useMemo(() => {
    return gitlab.projects.filter(project => {
      const matchesSearch = !searchTerm || 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.name_with_namespace.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesVisibility = visibilityFilter === 'all' || (project.visibility && project.visibility === visibilityFilter);
      
      return matchesSearch && matchesVisibility;
    });
  }, [gitlab.projects, searchTerm, visibilityFilter]);

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
        const errorData = await response.json();
        if (errorData.error === 'VPN_REQUIRED') {
          throw new Error('VPN_REQUIRED');
        }
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
      
      // Check if it's a VPN required error
      if (error instanceof Error && error.message.includes('VPN_REQUIRED')) {
        addNotification({
          type: 'error',
          title: 'VPN Required',
          message: 'GitLab server is blocking the request. Please connect to VPN and try again.',
          duration: 10000, // Show for 10 seconds
        });
        
        // Show VPN modal
        setShowVpnModal(true);
      } else {
        addNotification({
          type: 'error',
          title: 'Connection Failed',
          message: `Failed to connect to GitLab: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
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
                    <span>Found {gitlab.projects.length} projects</span>
                    <Badge variant="secondary" className="text-xs">{gitlab.projects.length}</Badge>
                  </div>
                  <p className="text-sm">
                    All available projects are listed below. You can select any of them in the Project Mapping step.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {gitlab.projects.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              Available Projects
              <Badge variant="secondary" className="text-xs">
                {filteredProjects.length} of {gitlab.projects.length} projects
              </Badge>
            </CardTitle>
            <CardDescription className="text-sm">
              All projects found in your GitLab instance that you have access to
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {/* Search and Filter Controls */}
            <div className="space-y-3 mb-4">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <select
                    value={visibilityFilter}
                    onChange={(e) => setVisibilityFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Projects</option>
                    <option value="private">Private</option>
                    <option value="internal">Internal</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>
              
              {searchTerm && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>Filtered by: "{searchTerm}"</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSearchTerm('')}
                    className="h-6 px-2 text-xs"
                  >
                    Clear
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredProjects.map((project, index) => (
                <div key={project.id} className="flex items-start justify-between p-4 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{project.name}</p>
                      <Badge variant="outline" className="text-xs shrink-0">
                        ID: {project.id}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 truncate">
                      {project.name_with_namespace}
                    </p>
                    {project.description && (
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>#{index + 1}</span>
                      {project.visibility && (
                        <Badge 
                          variant={project.visibility === 'private' ? 'destructive' : 'secondary'} 
                          className="text-xs"
                        >
                          {project.visibility}
                        </Badge>
                      )}
                      {project.last_activity_at && (
                        <span>Last activity: {new Date(project.last_activity_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  {project.web_url && (
                    <a 
                      href={project.web_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="ml-2 text-blue-600 hover:text-blue-800 text-xs underline shrink-0"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}
            </div>
            
            {filteredProjects.length === 0 && searchTerm && (
              <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>No projects found</strong> matching your search criteria. 
                  Try adjusting your search term or filters.
                </p>
              </div>
            )}
            
            {gitlab.projects.length > 10 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Showing {filteredProjects.length} of {gitlab.projects.length} projects. 
                  You can select any of these projects in the Project Mapping step.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* VPN Required Modal */}
      {showVpnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <Shield className="h-8 w-8 text-red-600" />
                </div>
              </div>
              <CardTitle className="text-xl text-red-800">VPN Required</CardTitle>
              <CardDescription className="text-gray-600">
                GitLab server is blocking the request due to network restrictions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive" className="border-red-200 bg-red-50">
                <WifiOff className="h-4 w-4" />
                <AlertDescription className="text-red-800">
                  <strong>Network Access Denied</strong><br />
                  The GitLab server is protected by a Web Application Firewall (WAF) that requires VPN access.
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">To resolve this issue:</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">1</div>
                    <span>Connect to your company VPN</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">2</div>
                    <span>Wait for VPN connection to establish</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-600">3</div>
                    <span>Try the GitLab connection again</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <strong>Already on VPN?</strong> Contact your IT administrator if you're still experiencing issues.
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowVpnModal(false)}
                  variant="outline" 
                  className="flex-1"
                >
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    setShowVpnModal(false);
                    handleConnect();
                  }}
                  className="flex-1"
                >
                  <Wifi className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
