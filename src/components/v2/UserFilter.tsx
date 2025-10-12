'use client';

import React, { useState, useEffect } from 'react';
import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, Filter, CheckCircle, GitBranch } from 'lucide-react';

interface UserFilterProps {
  onComplete?: () => void;
}

export function UserFilter({ onComplete }: UserFilterProps) {
  const { sheets, gitlab, columnMappings, projectMappings, updateColumnMapping } = useSetupStore();
  const { addNotification } = useUIStore();
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<'sheet' | 'assignee' | 'gitlab'>('sheet');
  const [gitlabUser, setGitlabUser] = useState<any>(null);

  // Extract unique users from the USER column if it exists
  const extractUsers = async () => {
    if (!sheets.spreadsheetId || !sheets.worksheetName || !columnMappings.USER) {
      addNotification({
        type: 'error',
        title: 'Configuration Required',
        message: 'Please configure Google Sheets and map the USER column first',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/sheet-user-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: sheets.spreadsheetId,
          worksheetName: sheets.worksheetName,
          userColumn: columnMappings.USER,
          serviceAccount: sheets.serviceAccount,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableUsers(data.users || []);
        
        addNotification({
          type: 'success',
          title: 'Users Extracted',
          message: `Found ${data.users?.length || 0} unique users`,
        });
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('User extraction error:', error);
      addNotification({
        type: 'error',
        title: 'Extraction Failed',
        message: `Failed to extract users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Get assignees from GitLab projects
  const getAssigneesFromProjects = () => {
    const allAssignees = new Set<string>();
    
    projectMappings.forEach(project => {
      if (project.projectData?.assignees) {
        project.projectData.assignees.forEach(assignee => {
          allAssignees.add(assignee.username);
        });
      }
    });
    
    const assigneeList = Array.from(allAssignees);
    setAvailableUsers(assigneeList);
    setFilterMode('assignee');
    
    addNotification({
      type: 'success',
      title: 'Assignees Loaded',
      message: `Found ${assigneeList.length} assignees from GitLab projects`,
    });
  };

  // Get current GitLab user information
  const getGitLabUser = async () => {
    if (!gitlab.url || !gitlab.token) {
      addNotification({
        type: 'error',
        title: 'GitLab Configuration Required',
        message: 'Please configure GitLab connection first',
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/gitlab-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gitlabUrl: gitlab.url,
          gitlabToken: gitlab.token,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setGitlabUser(data.user);
        setAvailableUsers([data.user.username]);
        setFilterMode('gitlab');
        setSelectedUser(data.user.username); // Automatically select the GitLab user
        
        // Store GitLab user information in the store for sync process
        updateColumnMapping('GITLAB_USER', data.user.username);
        updateColumnMapping('GITLAB_USER_NAME', data.user.name);
        updateColumnMapping('GITLAB_USER_EMAIL', data.user.email || '');
        updateColumnMapping('USE_GITLAB_USER_AS_ASSIGNEE', 'true');
        
        addNotification({
          type: 'success',
          title: 'GitLab User Loaded',
          message: `Connected as: ${data.user.name} (@${data.user.username})`,
        });
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('GitLab user fetch error:', error);
      addNotification({
        type: 'error',
        title: 'GitLab User Fetch Failed',
        message: `Failed to fetch GitLab user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (user: string) => {
    setSelectedUser(user);
    if (user === 'all') {
      addNotification({
        type: 'info',
        title: 'Filter Cleared',
        message: 'No user filter applied - showing all users',
      });
    } else {
      addNotification({
        type: 'info',
        title: 'User Selected',
        message: `Filtering for user: ${user}`,
      });
    }
  };

  const handleApplyFilter = () => {
    if (!selectedUser || selectedUser === '') {
      addNotification({
        type: 'error',
        title: 'No User Selected',
        message: 'Please select a user to filter by',
      });
      return;
    }

    // Store the selected user in the store for use during sync
    if (selectedUser === 'all') {
      updateColumnMapping('SELECTED_USER', ''); // Clear filter for all users
      addNotification({
        type: 'success',
        title: 'Filter Applied',
        message: 'Synchronization will include all users (no filtering)',
      });
    } else {
      updateColumnMapping('SELECTED_USER', selectedUser);
      
      // If we're using GitLab user mode, store the GitLab user information
      if (filterMode === 'gitlab' && gitlabUser) {
        updateColumnMapping('GITLAB_USER', gitlabUser.username);
        updateColumnMapping('GITLAB_USER_NAME', gitlabUser.name);
        updateColumnMapping('GITLAB_USER_EMAIL', gitlabUser.email || '');
        updateColumnMapping('USE_GITLAB_USER_AS_ASSIGNEE', 'true');
      }
      
      // If we're using assignee mode and no USER column is mapped, 
      // we need to set the ASSIGNEE column mapping to the USER column
      if (filterMode === 'assignee' && !columnMappings.USER) {
        // Find the USER column index from the sheet headers
        const userColumnIndex = sheets.headers.findIndex(header => 
          header.toLowerCase().includes('user') || 
          header.toLowerCase().includes('assignee') ||
          header.toLowerCase().includes('resource')
        );
        
        if (userColumnIndex !== -1) {
          updateColumnMapping('ASSIGNEE', (userColumnIndex + 1).toString());
          addNotification({
            type: 'info',
            title: 'Assignee Column Mapped',
            message: `Auto-mapped column ${userColumnIndex + 1} (${sheets.headers[userColumnIndex]}) as assignee column`,
          });
        }
      }
      
      addNotification({
        type: 'success',
        title: 'Filter Applied',
        message: `Synchronization will be filtered for ${filterMode === 'assignee' ? 'assignee' : filterMode === 'gitlab' ? 'GitLab user' : 'user'}: ${selectedUser}`,
      });
    }

    if (onComplete) {
      onComplete();
    }
  };

  const handleClearFilter = () => {
    setSelectedUser('all');
    updateColumnMapping('SELECTED_USER', '');
    addNotification({
      type: 'info',
      title: 'Filter Cleared',
      message: 'User filter has been removed',
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" />
            User Filter
          </CardTitle>
          <CardDescription className="text-sm">
            Optionally filter synchronization by specific users from your Google Sheets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <Alert variant="default" className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-800">
              This optional feature allows you to filter the synchronization process to only include rows 
              for specific users. If you don&apos;t need user filtering, you can skip this step entirely.
            </AlertDescription>
          </Alert>

          {!columnMappings.USER ? (
            <div className="space-y-4">
              <Alert variant="default" className="border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-800">
                  <strong>USER column not mapped.</strong> You can still filter by GitLab assignees from your configured projects, 
                  or skip this step entirely.
                </AlertDescription>
              </Alert>
              
              {projectMappings.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">GitLab Projects Configured</p>
                      <p className="text-xs text-muted-foreground">
                        {projectMappings.length} projects with assignee data available
                      </p>
                    </div>
                    <Badge variant="default" className="text-xs">
                      <GitBranch className="h-3 w-3 mr-1" />
                      {projectMappings.length} projects
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <Button 
                      onClick={getAssigneesFromProjects}
                      disabled={loading}
                      variant="default"
                      size="sm"
                      className="w-full"
                    >
                      <GitBranch className="h-4 w-4 mr-2" />
                      Load Assignees from GitLab Projects
                    </Button>
                    
                    <Button 
                      onClick={getGitLabUser}
                      disabled={loading}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Use My GitLab Account
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    if (onComplete) onComplete();
                    addNotification({
                      type: 'info',
                      title: 'User Filter Skipped',
                      message: 'Proceeding without user filtering',
                    });
                  }}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  Skip User Filter
                </Button>
                {projectMappings.length === 0 && (
                  <Button 
                    onClick={() => {
                      if (onComplete) onComplete();
                      addNotification({
                        type: 'info',
                        title: 'No Projects Configured',
                        message: 'Please configure project mappings first to use assignee filtering',
                      });
                    }}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled
                  >
                    No Projects Available
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">USER Column Mapped</p>
                  <p className="text-xs text-muted-foreground">
                    Column {columnMappings.USER}: {sheets.headers[parseInt(columnMappings.USER) - 1]}
                  </p>
                </div>
                <Badge variant="default" className="text-xs">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Mapped
                </Badge>
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={extractUsers}
                  disabled={loading}
                  variant="default"
                  size="sm"
                  className="w-full"
                >
                  {loading ? 'Extracting Users...' : 'Extract Users from Sheet'}
                </Button>
                
                {gitlab.url && gitlab.token && (
                  <Button 
                    onClick={getGitLabUser}
                    disabled={loading}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Use My GitLab Account
                  </Button>
                )}
              </div>

              {availableUsers.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Select {filterMode === 'assignee' ? 'Assignee' : filterMode === 'gitlab' ? 'GitLab User' : 'User'} to Filter By
                    </Label>
                    <Select value={selectedUser} onValueChange={handleUserSelect}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a user..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="all" className="text-sm">No filter (all users)</SelectItem>
                        {availableUsers.map((user) => (
                          <SelectItem key={user} value={user} className="text-sm">
                            {user}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {availableUsers.map((user) => (
                      <Badge 
                        key={user} 
                        variant={selectedUser === user ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => handleUserSelect(user)}
                      >
                        {user}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      onClick={handleApplyFilter}
                      disabled={!selectedUser || selectedUser === ''}
                      variant="default"
                      size="sm"
                      className="flex-1"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Apply {filterMode === 'assignee' ? 'Assignee' : filterMode === 'gitlab' ? 'GitLab User' : 'User'} Filter
                    </Button>
                    <Button 
                      onClick={handleClearFilter}
                      variant="outline"
                      size="sm"
                      className="text-sm"
                      disabled={!selectedUser || selectedUser === 'all' || selectedUser === ''}
                    >
                      Clear Filter
                    </Button>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-200">
                    <Button 
                      onClick={() => {
                        if (onComplete) onComplete();
                        addNotification({
                          type: 'info',
                          title: 'User Filter Skipped',
                          message: 'Proceeding without user filtering',
                        });
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      Skip User Filter
                    </Button>
                  </div>
                </div>
              )}

              {selectedUser && selectedUser !== 'all' && (
                <Alert variant="default" className="border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    <strong>Filter Active:</strong> Synchronization will only include rows for {filterMode === 'assignee' ? 'assignee' : filterMode === 'gitlab' ? 'GitLab user' : 'user'}: <strong>{selectedUser}</strong>
                    {filterMode === 'gitlab' && gitlabUser && (
                      <div className="mt-2 text-sm">
                        <div className="flex items-center gap-2">
                          {gitlabUser.avatar_url && (
                            <img 
                              src={gitlabUser.avatar_url} 
                              alt={gitlabUser.name}
                              className="w-6 h-6 rounded-full"
                            />
                          )}
                          <span className="font-medium">{gitlabUser.name}</span>
                          <span className="text-gray-600">(@{gitlabUser.username})</span>
                        </div>
                        {gitlabUser.email && (
                          <div className="text-xs text-gray-600 mt-1">
                            {gitlabUser.email}
                          </div>
                        )}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
