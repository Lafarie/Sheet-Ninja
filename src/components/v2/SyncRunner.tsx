'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Square, RotateCcw, CheckCircle, XCircle, AlertCircle, Users, Eye } from 'lucide-react';

interface SyncRunnerProps {
  onComplete: () => void;
}

const syncSteps = [
  { id: 'sync-start', title: 'Starting Sync', description: 'Initializing synchronization process' },
  { id: 'reading-sheet', title: 'Reading Sheet', description: 'Reading data from Google Sheets' },
  { id: 'creating-issues', title: 'Creating Issues', description: 'Creating GitLab issues' },
  { id: 'updating-sheet', title: 'Updating Sheet', description: 'Updating sheet with GitLab IDs' },
  { id: 'completed', title: 'Completed', description: 'Synchronization completed successfully' }
];

export function SyncRunner({ onComplete }: SyncRunnerProps) {
  const { 
    gitlab, 
    sheets, 
    columnMappings, 
    projectMappings, 
    syncConfig, 
    updateSyncConfig,
    updateColumnMapping,
    setSyncLoading 
  } = useSetupStore();
  const { addNotification } = useUIStore();
  
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncProgress, setSyncProgress] = useState('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [syncOutput, setSyncOutput] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // User filtering state
  const [enableUserFilter, setEnableUserFilter] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [pollingTimeout, setPollingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Auto-detect users from USER column
  const detectUsers = async () => {
    if (!sheets.spreadsheetId || !sheets.worksheetName || !columnMappings.USER) {
      addNotification({
        type: 'error',
        title: 'Configuration Required',
        message: 'Please configure Google Sheets and map the USER column first',
      });
      return;
    }

    setLoadingUsers(true);
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
          title: 'Users Detected',
          message: `Found ${data.users?.length || 0} unique users`,
        });
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('User detection error:', error);
      addNotification({
        type: 'error',
        title: 'Detection Failed',
        message: `Failed to detect users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  // Preview filtered data
  const previewFilteredData = async () => {
    if (!sheets.spreadsheetId || !sheets.worksheetName) {
      addNotification({
        type: 'error',
        title: 'Configuration Required',
        message: 'Please configure Google Sheets first',
      });
      return;
    }

    setLoadingPreview(true);
    try {
      const response = await fetch('/api/preview-sync-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: sheets.spreadsheetId,
          worksheetName: sheets.worksheetName,
          columnMappings,
          projectMappings,
          serviceAccount: sheets.serviceAccount,
          userFilter: enableUserFilter && selectedUser && selectedUser !== 'all' ? selectedUser : null,
          dateFilter: syncConfig.enableDateFilter ? {
            startDate: syncConfig.startDate,
            endDate: syncConfig.endDate
          } : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewData(data.rows || []);
        setShowPreview(true);
        
        addNotification({
          type: 'success',
          title: 'Preview Generated',
          message: `Found ${data.rows?.length || 0} rows to sync`,
        });
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Preview error:', error);
      addNotification({
        type: 'error',
        title: 'Preview Failed',
        message: `Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const validateConfiguration = () => {
    const issues = [];
    
    if (!gitlab.token) issues.push('GitLab Token is required');
    if (!sheets.spreadsheetId) issues.push('Spreadsheet ID is required');
    if (!sheets.worksheetName) issues.push('Worksheet Name is required');
    if (projectMappings.length === 0) issues.push('At least one project mapping is required');
    if (enableUserFilter && (!selectedUser || selectedUser === 'all')) issues.push('Please select a user for filtering');
    if (syncConfig.enableDateFilter && (!syncConfig.startDate || !syncConfig.endDate)) {
      issues.push('Please set both start and end dates for date filtering');
    }
    
    if (issues.length > 0) {
      addNotification({
        type: 'error',
        title: 'Configuration Issues',
        message: issues.join(', '),
      });
      return false;
    }
    
    return true;
  };

  const startSync = async () => {
    if (!validateConfiguration()) return;

    try {
      setSyncRunning(true);
      setSyncProgress('running');
      setCurrentStep(0);
      setSyncOutput('');
      setSyncLoading(true);
      
      const syncData = {
        gitlabUrl: gitlab.url,
        gitlabToken: gitlab.token,
        spreadsheetId: sheets.spreadsheetId,
        worksheetName: sheets.worksheetName,
        projectMappings: projectMappings,
        columnMappings: columnMappings,
        serviceAccount: sheets.serviceAccount,
        serviceAccountEmail: sheets.serviceAccountEmail,
        userFilter: enableUserFilter && selectedUser && selectedUser !== 'all' ? selectedUser : null,
        dateFilter: syncConfig.enableDateFilter ? {
          startDate: syncConfig.startDate,
          endDate: syncConfig.endDate
        } : null,
        checkStatusBeforeClose: syncConfig.checkStatusBeforeClose,
        startDate: syncConfig.startDate,
        endDate: syncConfig.endDate
      };

      // Debug: Log sync data
      console.log('Sync data being sent:', {
        enableUserFilter,
        selectedUser,
        userFilter: syncData.userFilter,
        columnMappings: columnMappings,
        hasUserMapping: !!columnMappings.USER
      });

      const response = await fetch('/api/start-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(syncData),
      });

      if (!response.ok) {
        if (response.status === 409) {
          setSyncRunning(true);
          setSyncProgress('running');
          startProgressPolling();
          addNotification({
            type: 'info',
            title: 'Sync Already Running',
            message: 'Connected to existing sync process',
          });
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      } else {
        startProgressPolling();
        addNotification({
          type: 'success',
          title: 'Sync Started',
          message: 'Synchronization process has been initiated',
        });
      }
    } catch (error) {
      console.error('Sync start error:', error);
      addNotification({
        type: 'error',
        title: 'Sync Failed',
        message: `Failed to start sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      setSyncRunning(false);
      setSyncProgress('error');
      setSyncLoading(false);
    }
  };

  const stopSync = async () => {
    try {
      await fetch('/api/stop-sync', { method: 'POST' });
      
      setSyncRunning(false);
      setSyncProgress('stopped');
      setCurrentStep(0);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      addNotification({
        type: 'warning',
        title: 'Sync Stopped',
        message: 'Synchronization was stopped by user',
      });
    } catch (error) {
      console.error('Error stopping sync:', error);
      addNotification({
        type: 'error',
        title: 'Stop Failed',
        message: 'Failed to stop synchronization',
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const startProgressPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (pollingTimeout) {
      clearTimeout(pollingTimeout);
    }

    // Set sync start time for timeout calculations
    (window as any).syncStartTime = Date.now();
    (window as any).lastStep = null;
    (window as any).lastStepTime = Date.now();
    (window as any).syncErrorCount = 0; // Reset error counter
    
    updateSyncProgress();
    intervalRef.current = setInterval(updateSyncProgress, 2000);
    
    // Add a more frequent check for completion after 30 seconds
    setTimeout(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(updateSyncProgress, 1000); // Check every second
        console.log('Switched to faster polling (1s) for completion detection');
      }
    }, 30000);
    
    // Set a timeout to stop polling after 5 minutes (reduced from 10)
    const timeout = setTimeout(() => {
      console.log('Sync polling timeout reached, stopping polling');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setSyncLoading(false);
      setSyncRunning(false);
      setSyncProgress('error');
      addNotification({
        type: 'error',
        title: 'Sync Timeout',
        message: 'Sync process timed out after 5 minutes',
      });
    }, 5 * 60 * 1000); // 5 minutes
    
    setPollingTimeout(timeout);
  };

  const updateSyncProgress = async () => {
    if (syncProgress === 'completed' || syncProgress === 'stopped' || syncProgress === 'error') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    try {
      const response = await fetch('/api/sync-status');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Debug: Log sync status data
      console.log('Sync status data:', {
        currentStep: data.currentStep,
        running: data.running,
        endTime: data.endTime,
        error: data.error,
        isCompleted: data.currentStep === 'completed' || (!data.running && data.endTime)
      });
      
      if (data.currentStep) {
        const stepIndex = syncSteps.findIndex(step => step.id === data.currentStep);
        if (stepIndex !== -1) {
          setCurrentStep(stepIndex);
        }
      }
      
      // Reset error counter on successful response
      (window as any).syncErrorCount = 0;

      if (data.output) {
        setSyncOutput(data.output);
        
        // Immediate completion check based on output
        if (data.output.includes('Sync process completed successfully')) {
          console.log('Found completion message in output, triggering completion immediately');
          setSyncRunning(false);
          setSyncProgress('completed');
          setCurrentStep(syncSteps.length - 1);
          setSyncLoading(false);
          
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          
          if (pollingTimeout) {
            clearTimeout(pollingTimeout);
            setPollingTimeout(null);
          }

          addNotification({
            type: 'success',
            title: 'Sync Completed',
            message: 'Synchronization completed successfully!',
          });
          
          onComplete();
          return;
        }
      }

      // Enhanced completion detection with multiple indicators
      const isCompleted = data.currentStep === 'completed' || (!data.running && data.endTime);
      
      // Check for completion indicators in output
      const hasCompletionOutput = data.output && (
        data.output.includes('Sync process completed successfully') ||
        data.output.includes('Synchronization completed successfully') ||
        data.output.includes('Finalizing updates') ||
        (data.output.includes('Created') && data.output.includes('GitLab issues')) ||
        data.output.includes('Updated') && data.output.includes('sheet rows')
      );
      
      // Check if we're in the final step (updating-sheet) and not running
      const isInFinalStep = data.currentStep === 'updating-sheet' && !data.running;
      
      // Timeout fallback - if we've been polling for more than 1 minute without completion
      const hasBeenPolling = Date.now() - (window as any).syncStartTime > 60000; // 1 minute
      const shouldForceComplete = hasBeenPolling && !data.running && !data.error;
      
      // Check if we've been stuck in the same step for too long
      const currentStepTime = (window as any).lastStepTime || (window as any).syncStartTime;
      const stepStuckTooLong = Date.now() - currentStepTime > 30000; // 30 seconds
      const isStuckInFinalSteps = ['updating-sheet', 'completed'].includes(data.currentStep) && stepStuckTooLong;
      
      // Update step tracking
      if (data.currentStep && data.currentStep !== (window as any).lastStep) {
        (window as any).lastStep = data.currentStep;
        (window as any).lastStepTime = Date.now();
      }
      
      // Debug logging for completion detection
      console.log('Completion detection:', {
        isCompleted,
        hasCompletionOutput,
        isInFinalStep,
        shouldForceComplete,
        isStuckInFinalSteps,
        stepStuckTooLong,
        currentStep: data.currentStep,
        running: data.running,
        endTime: data.endTime,
        hasOutput: !!data.output,
        outputSnippet: data.output ? data.output.slice(-200) : 'no output'
      });
      
      if (isCompleted || hasCompletionOutput || isInFinalStep || shouldForceComplete || isStuckInFinalSteps) {
        setSyncRunning(false);
        setSyncProgress('completed');
        setCurrentStep(syncSteps.length - 1);
        setSyncLoading(false);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        if (pollingTimeout) {
          clearTimeout(pollingTimeout);
          setPollingTimeout(null);
        }

        addNotification({
          type: 'success',
          title: 'Sync Completed',
          message: 'Synchronization completed successfully!',
        });
        
        onComplete();
        return;
      }

      if (data.error || data.currentStep === 'error') {
        setSyncRunning(false);
        setSyncProgress('error');
        setSyncLoading(false);

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        if (pollingTimeout) {
          clearTimeout(pollingTimeout);
          setPollingTimeout(null);
        }

        addNotification({
          type: 'error',
          title: 'Sync Failed',
          message: `Synchronization failed: ${data.error || 'Unknown error'}`,
        });
        return;
      }

      if (data.currentStep === 'stopped') {
        setSyncRunning(false);
        setSyncProgress('stopped');
        setSyncLoading(false);

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        if (pollingTimeout) {
          clearTimeout(pollingTimeout);
          setPollingTimeout(null);
        }
        return;
      }
    } catch (error) {
      console.error('Progress polling error:', error);
      
      // If we get network errors repeatedly, consider the sync failed
      const errorCount = (window as any).syncErrorCount || 0;
      (window as any).syncErrorCount = errorCount + 1;
      
      if (errorCount >= 5) { // After 5 consecutive errors
        setSyncRunning(false);
        setSyncProgress('error');
        setSyncLoading(false);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        
        if (pollingTimeout) {
          clearTimeout(pollingTimeout);
          setPollingTimeout(null);
        }
        
        addNotification({
          type: 'error',
          title: 'Sync Connection Error',
          message: 'Lost connection to sync process. Please check your network and try again.',
        });
      }
    }
  };

  const resetSync = () => {
    setSyncRunning(false);
    setSyncProgress('idle');
    setCurrentStep(0);
    setSyncOutput('');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    if (pollingTimeout) {
      clearTimeout(pollingTimeout);
      setPollingTimeout(null);
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (pollingTimeout) {
        clearTimeout(pollingTimeout);
      }
    };
  }, [pollingTimeout]);

  const getStepStatus = (index: number) => {
    if (syncProgress === 'completed') return 'completed';
    if (syncProgress === 'error') {
      if (index < currentStep) return 'completed';
      if (index === currentStep) return 'error';
      return 'pending';
    }
    if (index < currentStep) return 'completed';
    if (index === currentStep && syncRunning) return 'active';
    return 'pending';
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'active':
        return <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default:
        return <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Run Synchronization
          </CardTitle>
          <CardDescription>
            Execute the sync process between Google Sheets and GitLab
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Project Mappings Display */}
          {projectMappings.length > 0 && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-sm">Project Mappings ({projectMappings.length} configured)</h4>
              <div className="space-y-2">
                {projectMappings.map((mapping) => (
                  <div key={mapping.id} className="text-sm bg-white p-2 rounded border">
                    <div className="font-medium">{mapping.projectName}</div>
                    <div className="text-gray-600">
                      Project ID: {mapping.projectId} | 
                      {mapping.milestone && ` Milestone: ${mapping.milestone} |`}
                      {mapping.labels.length > 0 && ` Labels: ${mapping.labels.join(', ')}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Filter Options */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="enableUserFilter"
                  checked={enableUserFilter}
                  onChange={(e) => setEnableUserFilter(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <label htmlFor="enableUserFilter" className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Enable user filter
                </label>
              </div>
              {enableUserFilter && selectedUser && selectedUser !== 'all' && (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Filtering for: {selectedUser}
                </Badge>
              )}
            </div>
            
            {enableUserFilter && (
              <div className="space-y-4">
                {!columnMappings.USER ? (
                  <Alert variant="destructive" className="border-red-200 bg-red-50">
                    <AlertDescription className="text-red-800">
                      <strong>USER column not mapped!</strong> Please go back to the Column Mapping step 
                      and map a column that contains user information.
                    </AlertDescription>
                  </Alert>
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

                    <div className="flex gap-2">
                      <Button 
                        onClick={detectUsers}
                        disabled={loadingUsers}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        {loadingUsers ? 'Detecting...' : 'Auto-detect Users'}
                      </Button>
                      <Button 
                        onClick={previewFilteredData}
                        disabled={loadingPreview}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {loadingPreview ? 'Generating...' : 'Preview Data'}
                      </Button>
                    </div>

                    {availableUsers.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Select User to Filter By</Label>
                        <Select value={selectedUser} onValueChange={setSelectedUser}>
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
              </div>
            )}
          </div>

          {/* Date Filter Options */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enableDateFilter"
                checked={syncConfig.enableDateFilter}
                onChange={(e) => updateSyncConfig({ enableDateFilter: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="enableDateFilter" className="text-sm font-medium">
                Enable date filter
              </label>
            </div>
            
            {syncConfig.enableDateFilter && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate" className="text-sm font-medium">Start Date</Label>
                  <Input
                    className="w-full"
                    id="startDate"
                    type="date"
                    value={syncConfig.startDate || ''}
                    onChange={(e : any) => updateSyncConfig({ startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate" className="text-sm font-medium">End Date</Label>
                  <Input
                    className="w-full"
                    id="endDate"
                    type="date"
                    value={syncConfig.endDate || ''}
                    onChange={(e : any) => updateSyncConfig({ endDate: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="checkStatusBeforeClose"
                checked={syncConfig.checkStatusBeforeClose}
                onChange={(e) => updateSyncConfig({ checkStatusBeforeClose: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="checkStatusBeforeClose" className="text-sm font-medium">
                Close issues based on status column
              </label>
            </div>
          </div>

          {/* Sync Controls */}
          <div className="flex gap-2">
            {!syncRunning ? (
              <>
                <Button size="sm" variant="default" onClick={startSync} className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Start Sync
                </Button>
                <Button size="sm" variant="outline" onClick={resetSync} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={stopSync} className="flex-1">
                  <Square className="h-4 w-4 mr-2" />
                  Stop Sync
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setSyncRunning(false);
                    setSyncProgress('completed');
                    setSyncLoading(false);
                    if (intervalRef.current) {
                      clearInterval(intervalRef.current);
                      intervalRef.current = null;
                    }
                    if (pollingTimeout) {
                      clearTimeout(pollingTimeout);
                      setPollingTimeout(null);
                    }
                    addNotification({
                      type: 'warning',
                      title: 'Sync Manually Completed',
                      message: 'Sync was manually marked as completed',
                    });
                  }}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Force Complete
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sync Progress */}
      {(syncRunning || syncProgress !== 'idle') && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Progress</CardTitle>
            <CardDescription>
              Real-time progress of the synchronization process
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Steps */}
            <div className="space-y-3">
              {syncSteps.map((step, index) => {
                const status = getStepStatus(index);
                return (
                  <div key={step.id} className="flex items-center gap-3">
                    {getStepIcon(status)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium ${
                          status === 'completed' ? 'text-green-900' :
                          status === 'active' ? 'text-blue-900' :
                          status === 'error' ? 'text-red-900' : 'text-gray-500'
                        }`}>
                          {step.title}
                        </span>
                        <Badge 
                          variant={
                            status === 'completed' ? 'default' :
                            status === 'active' ? 'default' :
                            status === 'error' ? 'destructive' : 'secondary'
                          }
                          className={
                            status === 'completed' ? 'bg-green-100 text-green-800' :
                            status === 'active' ? 'bg-blue-100 text-blue-800' : ''
                          }
                        >
                          {status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            <Progress 
              value={(currentStep / (syncSteps.length - 1)) * 100} 
              className="w-full"
            />

            {/* Sync Output */}
            {syncOutput && (
              <div>
                <h4 className="font-medium mb-2">Output</h4>
                <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs max-h-64 overflow-y-auto">
                  <pre className="whitespace-pre-wrap">{syncOutput}</pre>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview Data */}
      {showPreview && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview Data ({previewData.length} rows)
            </CardTitle>
            <CardDescription>
              This is what will be synchronized based on your current filters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {previewData.slice(0, 10).map((row, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div><strong>Title:</strong> {row.title || 'N/A'}</div>
                      <div><strong>User:</strong> {row.user || 'N/A'}</div>
                      <div><strong>Project:</strong> {row.project || 'N/A'}</div>
                      <div><strong>Date:</strong> {row.date || 'N/A'}</div>
                    </div>
                  </div>
                ))}
                {previewData.length > 10 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    ... and {previewData.length - 10} more rows
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setShowPreview(false)}
                className="flex-1"
              >
                Close Preview
              </Button>
              <Button 
                size="sm" 
                variant="default" 
                onClick={() => {
                  setShowPreview(false);
                  startSync();
                }}
                className="flex-1"
              >
                Start Sync with This Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Alerts */}
      {syncProgress === 'completed' && (
        <Alert variant="default" className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription className="text-green-800">
            ✅ Synchronization completed successfully! Check the output above for details.
          </AlertDescription>
        </Alert>
      )}

      {syncProgress === 'error' && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <XCircle className="h-4 w-4" />
          <AlertDescription className="text-red-800">
            ❌ Synchronization failed. Check the output above for error details.
          </AlertDescription>
        </Alert>
      )}

      {syncProgress === 'stopped' && (
        <Alert variant="default" className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-yellow-800">
            ⏹️ Synchronization was stopped by user.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
