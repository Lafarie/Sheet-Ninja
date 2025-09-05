import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Play, Square, RotateCcw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
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
  syncRunning,
  setSyncRunning,
  syncProgress,
  setSyncProgress,
  apiBaseUrl,
  setCurrentStep 
}) {
  const [syncOutput, setSyncOutput] = useState('');
  const [currentSyncStep, setCurrentSyncStep] = useState(0);
  const [syncInterval, setSyncInterval] = useState(null);
  const [enableDateFilter, setEnableDateFilter] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const validateSyncConfiguration = () => {
    const issues = [];
    
    if (!config.gitlabToken) issues.push('GitLab Token is required');
    if (!config.projectId) issues.push('Project ID is required');
    if (!config.spreadsheetId) issues.push('Spreadsheet ID is required');
    if (!config.worksheetName) issues.push('Worksheet Name is required');
    
    if (issues.length > 0) {
      toast.error('Configuration issues: ' + issues.join(', '));
      return false;
    }
    
    return true;
  };

  const startSync = async () => {
    if (!validateSyncConfiguration()) return;

    try {
      setSyncRunning(true);
      setSyncProgress('running');
      setCurrentSyncStep(0);
      setSyncOutput('');
      
      const syncData = {
        gitlabUrl: config.gitlabUrl,
        gitlabToken: config.gitlabToken,
        projectId: config.projectId,
        spreadsheetId: config.spreadsheetId,
        worksheetName: config.worksheetName,
        defaultAssignee: config.defaultAssignee,
        defaultMilestone: config.defaultMilestone,
        defaultLabel: config.defaultLabel,
        defaultEstimate: config.defaultEstimate,
      };

      if (enableDateFilter) {
        syncData.startDate = startDate;
        syncData.endDate = endDate;
      }

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
      
      if (syncInterval) {
        clearInterval(syncInterval);
        setSyncInterval(null);
      }
      
      toast.warning('Sync stopped by user');
    } catch (error) {
      console.error('Error stopping sync:', error);
      toast.error('Failed to stop sync');
    }
  };

  const startProgressPolling = () => {
    const interval = setInterval(updateSyncProgress, 2000);
    setSyncInterval(interval);
  };

  const updateSyncProgress = async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/sync-status`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
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

      // Check if sync is complete
      if (data.status === 'completed') {
        setSyncRunning(false);
        setSyncProgress('completed');
        setCurrentSyncStep(syncSteps.length - 1);
        
        if (syncInterval) {
          clearInterval(syncInterval);
          setSyncInterval(null);
        }
        
        toast.success('Sync completed successfully!');
      } else if (data.status === 'error') {
        setSyncRunning(false);
        setSyncProgress('error');
        
        if (syncInterval) {
          clearInterval(syncInterval);
          setSyncInterval(null);
        }
        
        toast.error('Sync failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Progress polling error:', error);
    }
  };

  const resetSync = () => {
    setSyncRunning(false);
    setSyncProgress('idle');
    setCurrentSyncStep(0);
    setSyncOutput('');
    
    if (syncInterval) {
      clearInterval(syncInterval);
      setSyncInterval(null);
    }
  };

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [syncInterval]);

  const getStepStatus = (index) => {
    if (index < currentSyncStep) return 'completed';
    if (index === currentSyncStep && syncRunning) return 'active';
    if (syncProgress === 'error' && index === currentSyncStep) return 'error';
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
