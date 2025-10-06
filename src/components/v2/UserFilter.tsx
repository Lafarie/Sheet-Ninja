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
import { Users, Filter, CheckCircle } from 'lucide-react';

interface UserFilterProps {
  onComplete?: () => void;
}

export function UserFilter({ onComplete }: UserFilterProps) {
  const { sheets, columnMappings, updateColumnMapping } = useSetupStore();
  const { addNotification } = useUIStore();
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(false);

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
    if (!selectedUser || selectedUser === 'all') {
      addNotification({
        type: 'error',
        title: 'No User Selected',
        message: 'Please select a user to filter by',
      });
      return;
    }

    // Store the selected user in the store for use during sync
    updateColumnMapping('SELECTED_USER', selectedUser);
    
    addNotification({
      type: 'success',
      title: 'Filter Applied',
      message: `Synchronization will be filtered for user: ${selectedUser}`,
    });

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
              <Alert variant="default" className="border-yellow-200 bg-yellow-50">
                <AlertDescription className="text-yellow-800">
                  <strong>USER column not mapped.</strong> If you want to use user filtering, go back to the Column Mapping step 
                  and map a column that contains user information. Otherwise, you can skip this step.
                </AlertDescription>
              </Alert>
              
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

              <Button 
                onClick={extractUsers}
                disabled={loading}
                variant="default"
                size="sm"
                className="w-full"
              >
                {loading ? 'Extracting Users...' : 'Extract Users from Sheet'}
              </Button>

              {availableUsers.length > 0 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Select User to Filter By</Label>
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
                      disabled={!selectedUser || selectedUser === 'all'}
                      variant="default"
                      size="sm"
                      className="flex-1"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Apply User Filter
                    </Button>
                    <Button 
                      onClick={handleClearFilter}
                      variant="outline"
                      size="sm"
                      className="text-sm"
                      disabled={!selectedUser || selectedUser === 'all'}
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
                    <strong>Filter Active:</strong> Synchronization will only include rows for user: <strong>{selectedUser}</strong>
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
