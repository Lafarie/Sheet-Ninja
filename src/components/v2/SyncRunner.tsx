'use client';

import { useState, useEffect, useRef } from 'react';
import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, Square, RotateCcw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

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
    setSyncLoading 
  } = useSetupStore();
  const { addNotification } = useUIStore();
  
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncProgress, setSyncProgress] = useState('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [syncOutput, setSyncOutput] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const validateConfiguration = () => {
    const issues = [];
    
    if (!gitlab.token) issues.push('GitLab Token is required');
    if (!sheets.spreadsheetId) issues.push('Spreadsheet ID is required');
    if (!sheets.worksheetName) issues.push('Worksheet Name is required');
    if (projectMappings.length === 0) issues.push('At least one project mapping is required');
    
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
        ...syncConfig
      };

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

    updateSyncProgress();
    intervalRef.current = setInterval(updateSyncProgress, 2000);
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
      
      if (data.currentStep) {
        const stepIndex = syncSteps.findIndex(step => step.id === data.currentStep);
        if (stepIndex !== -1) {
          setCurrentStep(stepIndex);
        }
      }

      if (data.output) {
        setSyncOutput(data.output);
      }

      const isCompleted = data.currentStep === 'completed' || (!data.running && data.endTime);
      if (isCompleted) {
        setSyncRunning(false);
        setSyncProgress('completed');
        setCurrentStep(syncSteps.length - 1);
        setSyncLoading(false);
        
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
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
        return;
      }
    } catch (error) {
      console.error('Progress polling error:', error);
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
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

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
                      {mapping.assignee && ` Assignee: @${mapping.assignee} |`}
                      {mapping.milestone && ` Milestone: ${mapping.milestone} |`}
                      {mapping.labels.length > 0 && ` Labels: ${mapping.labels.join(', ')}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={syncConfig.startDate || ''}
                    onChange={(e) => updateSyncConfig({ startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={syncConfig.endDate || ''}
                    onChange={(e) => updateSyncConfig({ endDate: e.target.value })}
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
                <Button onClick={startSync} className="flex-1">
                  <Play className="h-4 w-4 mr-2" />
                  Start Sync
                </Button>
                <Button onClick={resetSync} variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
              </>
            ) : (
              <Button onClick={stopSync} variant="destructive" className="flex-1">
                <Square className="h-4 w-4 mr-2" />
                Stop Sync
              </Button>
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

      {/* Status Alerts */}
      {syncProgress === 'completed' && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            ✅ Synchronization completed successfully! Check the output above for details.
          </AlertDescription>
        </Alert>
      )}

      {syncProgress === 'error' && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            ❌ Synchronization failed. Check the output above for error details.
          </AlertDescription>
        </Alert>
      )}

      {syncProgress === 'stopped' && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            ⏹️ Synchronization was stopped by user.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
