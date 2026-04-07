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

  // Convert YYYY-MM-DD (from date picker) to the selected format for display/sending
  const datePickerToFormat = (isoDate: string): string => {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return '';
    const format = syncConfig.dateFormat || 'MM/DD/YYYY';
    if (format === 'DD/MM/YYYY') {
      return `${day}/${month}/${year}`;
    }
    return `${month}/${day}/${year}`;
  };

  // Convert the selected format back to YYYY-MM-DD (for date picker value)
  const formatToDatePicker = (dateStr: string): string => {
    if (!dateStr) return '';
    const format = syncConfig.dateFormat || 'MM/DD/YYYY';
    const match = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (!match) return '';
    let month: string, day: string, year: string;
    if (format === 'DD/MM/YYYY') {
      day = match[1].padStart(2, '0');
      month = match[2].padStart(2, '0');
      year = match[3];
    } else {
      month = match[1].padStart(2, '0');
      day = match[2].padStart(2, '0');
      year = match[3];
    }
    return `${year}-${month}-${day}`;
  };
  
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncProgress, setSyncProgress] = useState('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [syncOutput, setSyncOutput] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [pollingTimeout, setPollingTimeout] = useState<NodeJS.Timeout | null>(null);


  const validateConfiguration = () => {
    const issues = [];
    
    if (!gitlab.token) issues.push('GitLab Token is required');
    if (!sheets.spreadsheetId) issues.push('Spreadsheet ID is required');
    if (!sheets.worksheetName) issues.push('Worksheet Name is required');
    if (projectMappings.length === 0) issues.push('At least one project mapping is required');
    
    // Date filter validation
    if (syncConfig.enableDateFilter) {
      if (!syncConfig.startDate && !syncConfig.endDate) {
        issues.push('Please set at least one date (start or end) for date filtering');
      } else if (syncConfig.startDate && syncConfig.endDate) {
        // Check start is before end using the picker values
        const startPicker = formatToDatePicker(syncConfig.startDate);
        const endPicker = formatToDatePicker(syncConfig.endDate);
        if (startPicker && endPicker && startPicker > endPicker) {
          issues.push('Start date must be before or equal to end date');
        }
      }
    }
    
    // Note: User mapping and user filter are optional - no validation needed
    
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
        userFilter: columnMappings.SELECTED_USER || null, // Optional user filter
        gitlabUser: columnMappings.GITLAB_USER || null, // GitLab user information
        gitlabUserName: columnMappings.GITLAB_USER_NAME || null,
        gitlabUserEmail: columnMappings.GITLAB_USER_EMAIL || null,
        useGitlabUserAsAssignee: columnMappings.USE_GITLAB_USER_AS_ASSIGNEE === 'true', // Flag to use GitLab user as assignee
        dateFormat: syncConfig.dateFormat || 'MM/DD/YYYY',
        dateFilter: syncConfig.enableDateFilter ? {
          startDate: syncConfig.startDate || null,
          endDate: syncConfig.endDate || null
        } : null,
        checkStatusBeforeClose: syncConfig.checkStatusBeforeClose,
        startDate: syncConfig.startDate || null,
        endDate: syncConfig.endDate || null
      };

      // Debug: Log sync data
      console.log('Sync data being sent:', {
        userFilter: syncData.userFilter,
        hasUserFilter: !!syncData.userFilter,
        gitlabUser: syncData.gitlabUser,
        gitlabUserName: syncData.gitlabUserName,
        useGitlabUserAsAssignee: syncData.useGitlabUserAsAssignee,
        columnMappings: columnMappings,
        hasUserMapping: !!columnMappings.USER,
        userMappingOptional: true,
        dateFilter: syncData.dateFilter,
        startDate: syncData.startDate,
        endDate: syncData.endDate,
        dateFilterTypes: {
          startDateType: typeof syncData.dateFilter?.startDate,
          endDateType: typeof syncData.dateFilter?.endDate,
          startDateValue: syncData.dateFilter?.startDate,
          endDateValue: syncData.dateFilter?.endDate
        }
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
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">Project Mappings ({projectMappings.length} configured)</h4>
              <div className="space-y-2">
                {projectMappings.map((mapping) => (
                  <div key={mapping.id} className="text-sm bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{mapping.projectName}</div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Project ID: {mapping.projectId} | 
                      {mapping.milestone && ` Milestone: ${mapping.milestone} |`}
                      {mapping.labels.length > 0 && ` Labels: ${mapping.labels.join(', ')}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Filter Status */}
          {columnMappings.USE_GITLAB_USER_AS_ASSIGNEE === 'true' ? (
            <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-100">GitLab User Assignment</span>
                </div>
                <Badge variant="default" className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                  Assigning to: {columnMappings.GITLAB_USER}
                </Badge>
              </div>
              <Alert variant="default" className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
                <CheckCircle className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <AlertDescription className="text-purple-800 dark:text-purple-200">
                  <strong>GitLab User Mode:</strong> All issues will be assigned to <strong>{columnMappings.GITLAB_USER}</strong> ({columnMappings.GITLAB_USER_NAME})
                </AlertDescription>
              </Alert>
            </div>
          ) : columnMappings.SELECTED_USER ? (
            <div className="space-y-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">User Filter Active</span>
                </div>
                <Badge variant="default" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                  Filtering for: {columnMappings.SELECTED_USER}
                </Badge>
              </div>
              <Alert variant="default" className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <strong>Filter Active:</strong> Synchronization will only include rows for user: <strong>{columnMappings.SELECTED_USER}</strong>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">No User Filter</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Synchronization will include all rows (no user filtering applied)
              </p>
            </div>
          )}

          {/* Date Format Selection */}
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="space-y-2">
              <Label htmlFor="dateFormat" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Date Format in Sheet
              </Label>
              <Select
                value={syncConfig.dateFormat || 'MM/DD/YYYY'}
                onValueChange={(newFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY') => {
                  // Re-convert existing filter dates to the new format
                  const oldFormat = syncConfig.dateFormat || 'MM/DD/YYYY';
                  if (oldFormat !== newFormat) {
                    const updates: any = { dateFormat: newFormat };
                    // Convert start date
                    if (syncConfig.startDate) {
                      const iso = formatToDatePicker(syncConfig.startDate);
                      if (iso) {
                        const [y, m, d] = iso.split('-');
                        updates.startDate = newFormat === 'DD/MM/YYYY' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
                      }
                    }
                    // Convert end date
                    if (syncConfig.endDate) {
                      const iso = formatToDatePicker(syncConfig.endDate);
                      if (iso) {
                        const [y, m, d] = iso.split('-');
                        updates.endDate = newFormat === 'DD/MM/YYYY' ? `${d}/${m}/${y}` : `${m}/${d}/${y}`;
                      }
                    }
                    updateSyncConfig(updates);
                  } else {
                    updateSyncConfig({ dateFormat: newFormat });
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select date format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (e.g., 10/15/2025)</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (e.g., 15/10/2025)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Select the date format used in your Google Sheet. This format will be used to parse all date columns.
              </p>
            </div>
          </div>

          {/* Date Filter Options */}
          <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enableDateFilter"
                checked={syncConfig.enableDateFilter}
                onChange={(e) => updateSyncConfig({ enableDateFilter: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
              <label htmlFor="enableDateFilter" className="text-sm font-medium text-gray-900 dark:text-gray-100">
                Enable date filter
              </label>
            </div>
            
            {syncConfig.enableDateFilter && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">Start Date</Label>
                  <Input
                    className="w-full"
                    id="startDate"
                    type="date"
                    value={formatToDatePicker(syncConfig.startDate || '')}
                    onChange={(e: any) => updateSyncConfig({ startDate: datePickerToFormat(e.target.value) })}
                  />
                  {syncConfig.startDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Sending as: {syncConfig.startDate}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="endDate" className="text-sm font-medium text-gray-700 dark:text-gray-300">End Date</Label>
                  <Input
                    className="w-full"
                    id="endDate"
                    type="date"
                    value={formatToDatePicker(syncConfig.endDate || '')}
                    onChange={(e: any) => updateSyncConfig({ endDate: datePickerToFormat(e.target.value) })}
                  />
                  {syncConfig.endDate && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Sending as: {syncConfig.endDate}
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="checkStatusBeforeClose"
                checked={syncConfig.checkStatusBeforeClose}
                onChange={(e) => updateSyncConfig({ checkStatusBeforeClose: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
              />
              <label htmlFor="checkStatusBeforeClose" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Close issues based on status column
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 pl-6">
              💡 <strong>Example:</strong> Close when status is &apos;Done&apos;, &apos;Complete&apos;, &apos;Finished&apos;, or &apos;Resolved&apos;
            </p>
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


      {/* Status Alerts */}
      {syncProgress === 'completed' && (
        <Alert variant="default" className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            ✅ Synchronization completed successfully! Check the output above for details.
          </AlertDescription>
        </Alert>
      )}

      {syncProgress === 'error' && (
        <Alert variant="destructive" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            ❌ Synchronization failed. Check the output above for error details.
          </AlertDescription>
        </Alert>
      )}

      {syncProgress === 'stopped' && (
        <Alert variant="default" className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-200">
            ⏹️ Synchronization was stopped by user.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
