import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Play, Square, RotateCcw, CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

const syncSteps = [
  { id: 'sync-start', title: 'Starting Sync', description: 'Initializing synchronization process' },
  { id: 'reading-sheet', title: 'Reading Sheet', description: 'Reading data from Google Sheets' },
  { id: 'creating-issues', title: 'Creating Issues', description: 'Creating GitLab issues' },
  { id: 'updating-sheet', title: 'Updating Sheet', description: 'Updating sheet with GitLab IDs' },
  { id: 'completed', title: 'Completed', description: 'Synchronization completed successfully' }
];

export function SyncRunner({ 
  config,
  projectMappings,
  syncRunning,
  setSyncRunning,
  syncProgress,
  setSyncProgress,
  apiBaseUrl,
  setCurrentStep 
}) {
  const [syncOutput, setSyncOutput] = useState('');
  const [currentSyncStep, setCurrentSyncStep] = useState(0);
  const intervalRef = useRef(null);
  const containerRef = useRef(null);
  const [enableDateFilter, setEnableDateFilter] = useState(false);
  const [checkStatusBeforeClose, setCheckStatusBeforeClose] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [completionAnnounced, setCompletionAnnounced] = useState(false);
  // Refs to keep latest values inside the interval callback to avoid stale closures
  const syncProgressRef = useRef(syncProgress);
  const completionAnnouncedRef = useRef(completionAnnounced);
  const progressRef = useRef(null);

  // Keep refs updated when state changes
  useEffect(() => {
    syncProgressRef.current = syncProgress;
  }, [syncProgress]);

  useEffect(() => {
    completionAnnouncedRef.current = completionAnnounced;
  }, [completionAnnounced]);

  // Auto-scroll to the SyncRunner area on mount
  useEffect(() => {
    try {
      if (containerRef.current && typeof containerRef.current.scrollIntoView === 'function') {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (e) {
      // ignore scroll errors
    }
  }, []);

  // When sync completes, scroll the progress/terminal Card (progressRef) into view
  useEffect(() => {
    if (syncProgress === 'completed') {
      try {
        if (progressRef.current && typeof progressRef.current.scrollIntoView === 'function') {
          // small timeout to allow final output to render
          setTimeout(() => {
            try {
              progressRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (e) {}
          }, 200);
        }
      } catch (e) {
        // ignore scroll errors
      }
    }
  }, [syncProgress]);

  const validateSyncConfiguration = () => {
    const issues = [];
    
    if (!config.gitlabToken) issues.push('GitLab Token is required');
    if (!config.spreadsheetId) issues.push('Spreadsheet ID is required');
    if (!config.worksheetName) issues.push('Worksheet Name is required');
    
    // Check if either single project or project mappings are configured
    if (!config.projectId && (!projectMappings || projectMappings.length === 0)) {
      issues.push('Either Project ID or Project Mappings must be configured');
    }
    
    if (issues.length > 0) {
      toast.error('Configuration issues: ' + issues.join(', '));
      return false;
    }
    
    return true;
  };

  // Get unique assignees from project data
  const getAssignees = () => {
    if (!config.projectData?.assignees) return [];
    return config.projectData.assignees.reduce((acc, assignee) => {
      if (!acc.find(a => a.username === assignee.username)) {
        acc.push(assignee);
      }
      return acc;
    }, []);
  };

  const startSync = async () => {
    if (!validateSyncConfiguration()) return;

    try {
      setSyncRunning(true);
      setSyncProgress('running');
      setCurrentSyncStep(0);
      setSyncOutput('');
      setCompletionAnnounced(false); // Reset completion flag
      
      const syncData = {
        gitlabUrl: config.gitlabUrl,
        gitlabToken: config.gitlabToken,
        projectId: config.projectId,
        spreadsheetId: config.spreadsheetId,
        worksheetName: config.worksheetName,
        projectMappings: projectMappings || [],
        // send column mappings saved in the config so the server can use explicit GIT_ID column
        columnMappings: config.columnMappings || {}
      };

      // Include inline service account info so server can use uploaded creds immediately
      if (config.serviceAccount) {
        syncData.serviceAccount = config.serviceAccount;
        syncData.serviceAccountFilename = config.serviceAccountFilename || null;
        syncData.serviceAccountEmail = config.serviceAccountEmail || config.serviceAccount.client_email || null;
      }

      if (enableDateFilter) {
        syncData.startDate = startDate;
        syncData.endDate = endDate;
      }
      // Include checkbox behavior flag
      syncData.checkStatusBeforeClose = !!checkStatusBeforeClose;

      const response = await fetch(`${apiBaseUrl}/api/start-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(syncData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Start polling for progress
      startProgressPolling();
      // Auto-scroll to progress area so user sees real-time output
      try {
        if (progressRef.current && typeof progressRef.current.scrollIntoView === 'function') {
          progressRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (e) {
        // ignore scroll errors
      }
      toast.success('Sync started successfully!');
      
    } catch (error) {
      console.error('Sync start error:', error);
      toast.error('Failed to start sync: ' + error.message);
      setSyncRunning(false);
      setSyncProgress('error');
    }
  };

  const stopSync = async () => {
    try {
      await fetch(`${apiBaseUrl}/api/stop-sync`, {
        method: 'POST',
      });
      
      setSyncRunning(false);
      setSyncProgress('stopped');
      setCurrentSyncStep(0);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      toast.warning('Sync stopped by user');
    } catch (error) {
      console.error('Error stopping sync:', error);
      toast.error('Failed to stop sync');
    }
  };

  const startProgressPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Do an immediate tick then schedule interval. Use the update function which reads refs.
    updateSyncProgress();
    intervalRef.current = setInterval(updateSyncProgress, 2000);
    // debug
    // console.debug('startProgressPolling: interval started', intervalRef.current);
  };

  const updateSyncProgress = async () => {
    // Read latest statuses from refs to avoid stale closures
    const latestProgress = syncProgressRef.current;
    const latestAnnounced = completionAnnouncedRef.current;

    // Don't poll if sync is already completed, stopped, or errored
    if (latestProgress === 'completed' || latestProgress === 'stopped' || latestProgress === 'error') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        // console.debug('updateSyncProgress: cleared interval due to progress state', latestProgress);
      }
      return;
    }

    try {
      const response = await fetch(`${apiBaseUrl}/api/sync-status`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // debug: log server status for diagnosis
      try {
        console.debug('sync-status response', data);
      } catch (e) {}
      
      // Update progress step
      if (data.currentStep) {
        const stepIndex = syncSteps.findIndex(step => step.id === data.currentStep);
        if (stepIndex !== -1) {
          setCurrentSyncStep(stepIndex);
        }
      }

      // Update output
      if (data.output) {
        setSyncOutput(data.output);
      }

      // Determine status based on syncStateManager shape
      const serverStep = data.currentStep || null;
      const serverRunning = typeof data.running === 'boolean' ? data.running : true;
      const serverError = data.error || null;

      // Completed: either explicit currentStep === 'completed' or running === false and endTime exists
      const isCompleted = serverStep === 'completed' || (serverRunning === false && data.endTime);
      if (isCompleted && !latestAnnounced) {
        setSyncRunning(false);
        setSyncProgress('completed');
        try { console.debug('sync -> setting completed'); } catch (e) {}
        syncProgressRef.current = 'completed';
        setCurrentSyncStep(syncSteps.length - 1);
        setCompletionAnnounced(true);
        completionAnnouncedRef.current = true;

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

  toast.success('Sync completed successfully!');
  try { console.debug('sync state after complete', { syncRunning: false, syncProgress: 'completed' }); } catch (e) {}
        setCurrentStep(6);
        return;
      }

      // Error
      if (serverError || serverStep === 'error') {
        setSyncRunning(false);
        setSyncProgress('error');
        try { console.debug('sync -> setting error', serverError); } catch (e) {}
        syncProgressRef.current = 'error';

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

  toast.error('Sync failed: ' + (serverError || 'Unknown error'));
  try { console.debug('sync state after error', { syncRunning: false, syncProgress: 'error' }); } catch (e) {}
        return;
      }

      // Stopped
      if (serverStep === 'stopped' || (serverRunning === false && serverStep === 'stopped')) {
        setSyncRunning(false);
        setSyncProgress('stopped');
        try { console.debug('sync -> setting stopped'); } catch (e) {}
        syncProgressRef.current = 'stopped';

        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

  try { console.debug('sync state after stopped', { syncRunning: false, syncProgress: 'stopped' }); } catch (e) {}
  return;
      }
    } catch (error) {
      console.error('Progress polling error:', error);
      // Don't stop polling on network errors, just log them
    }
  };

  const resetSync = () => {
    setSyncRunning(false);
    setSyncProgress('idle');
    setCurrentSyncStep(0);
    setSyncOutput('');
    setCompletionAnnounced(false); // Reset completion flag
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Cleanup interval when sync is completed, stopped, or errored
  useEffect(() => {
    if (syncProgress === 'completed' || syncProgress === 'stopped' || syncProgress === 'error') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [syncProgress]);

  const getStepStatus = (index) => {
    // If sync is completed, show all steps including the last one as completed
    if (syncProgress === 'completed') {
      return 'completed';
    }
    
    // If sync errored, show error for current step and completed for previous steps
    if (syncProgress === 'error') {
      if (index < currentSyncStep) return 'completed';
      if (index === currentSyncStep) return 'error';
      return 'pending';
    }
    
    // Normal running state
    if (index < currentSyncStep) return 'completed';
    if (index === currentSyncStep && syncRunning) return 'active';
    return 'pending';
  };

  const getStepIcon = (status) => {
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
          {projectMappings && projectMappings.length > 0 && (
            <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-sm">Project Mappings ({projectMappings.length} configured)</h4>
              <div className="space-y-2">
                {projectMappings.map((mapping, index) => (
                  <div key={index} className="text-sm bg-white p-2 rounded border">
                    <div className="font-medium">{mapping.projectName}</div>
                    <div className="text-gray-600">
                      Project ID: {mapping.projectId} | 
                      {mapping.assignee && mapping.assignee !== 'none' && ` Assignee: @${mapping.assignee} |`}
                      {mapping.milestone && mapping.milestone !== 'none' && ` Milestone: ${mapping.milestone} |`}
                      {mapping.labels && mapping.labels.length > 0 && ` Labels: ${mapping.labels.join(', ')}`}
                    </div>
                  </div>
                ))}
              </div>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Using project mappings mode. Issues will be created in the appropriate project based on the project name in each sheet row.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <Separator />

          {/* Date Filter Option */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="enableDateFilter"
                checked={enableDateFilter}
                onChange={(e) => setEnableDateFilter(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="enableDateFilter" className="text-sm font-medium">
                Enable date filter
              </label>
            </div>
            
            {enableDateFilter && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
            <div className="flex items-center space-x-2 mt-2">
              <input
                type="checkbox"
                id="checkStatusBeforeClose"
                checked={checkStatusBeforeClose}
                onChange={(e) => setCheckStatusBeforeClose(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="checkStatusBeforeClose" className="text-sm">
                Check status column create and close issues accordingly
              </label>
            </div>
          </div>

          <Separator />

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
        <Card ref={progressRef}>
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
              value={(currentSyncStep / (syncSteps.length - 1)) * 100} 
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

      {/* Sync Status Alerts */}
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
