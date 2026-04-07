'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Download, ArrowLeft, CheckCircle, XCircle, AlertCircle,
  Square, RotateCcw, Loader2, GitBranch, Sheet,
} from 'lucide-react';

interface GitLabProject {
  id: string;
  name: string;
  name_with_namespace: string;
  web_url?: string;
}

interface ProjectData {
  milestones: Array<{ id: string; title: string; start_date?: string; due_date?: string }>;
  labels: Array<{ id: string; name: string; color: string }>;
  assignees: Array<{ id: number; username: string; name: string }>;
}

const importSteps = [
  { id: 'sync-start', title: 'Starting Import', description: 'Initializing import process' },
  { id: 'reading-sheet', title: 'Connecting Sheet', description: 'Connecting to Google Sheets' },
  { id: 'creating-issues', title: 'Fetching Issues', description: 'Fetching issues from GitLab' },
  { id: 'updating-sheet', title: 'Writing Sheet', description: 'Writing issues to sheet' },
  { id: 'completed', title: 'Completed', description: 'Import completed successfully' },
];

export default function ImportPage() {
  const { data: session, status: authStatus } = useSession();

  // GitLab connection
  const [gitlabUrl, setGitlabUrl] = useState('');
  const [gitlabToken, setGitlabToken] = useState('');
  const [gitlabConnected, setGitlabConnected] = useState(false);
  const [gitlabProjects, setGitlabProjects] = useState<GitLabProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // Selected project
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loadingProjectData, setLoadingProjectData] = useState(false);

  // Sheet config
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [worksheetName, setWorksheetName] = useState('GitLab Import');
  const [serviceAccount, setServiceAccount] = useState<any>(null);
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');

  // Filters
  const [importState, setImportState] = useState<'all' | 'opened' | 'closed'>('all');
  const [importMilestone, setImportMilestone] = useState('');
  const [importLabels, setImportLabels] = useState('');
  const [importAssignee, setImportAssignee] = useState('');
  const [dateFormat, setDateFormat] = useState<'MM/DD/YYYY' | 'DD/MM/YYYY'>('MM/DD/YYYY');

  // Import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<'idle' | 'running' | 'completed' | 'error' | 'stopped'>('idle');
  const [currentStep, setCurrentStep] = useState(0);
  const [importOutput, setImportOutput] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved config from v2 setup store if available
  useEffect(() => {
    try {
      const stored = localStorage.getItem('setup-store');
      if (stored) {
        const parsed = JSON.parse(stored);
        const state = parsed?.state;
        if (state?.gitlab?.url) setGitlabUrl(state.gitlab.url);
        if (state?.gitlab?.token) setGitlabToken(state.gitlab.token);
        if (state?.sheets?.spreadsheetId) setSpreadsheetId(state.sheets.spreadsheetId);
        if (state?.sheets?.serviceAccount) setServiceAccount(state.sheets.serviceAccount);
        if (state?.sheets?.serviceAccountEmail) setServiceAccountEmail(state.sheets.serviceAccountEmail);
        if (state?.syncConfig?.dateFormat) setDateFormat(state.syncConfig.dateFormat);
        if (state?.gitlab?.projects) {
          setGitlabProjects(state.gitlab.projects);
          if (state.gitlab.projects.length > 0) setGitlabConnected(true);
        }
      }
    } catch {}
  }, []);

  // Connect to GitLab
  const connectGitLab = async () => {
    if (!gitlabUrl || !gitlabToken) return;
    setLoadingProjects(true);
    try {
      const baseUrl = gitlabUrl.endsWith('/') ? gitlabUrl : gitlabUrl + '/';
      const resp = await fetch(`${baseUrl}projects?membership=true&per_page=100&order_by=last_activity_at`, {
        headers: { 'Private-Token': gitlabToken },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const projects = await resp.json();
      setGitlabProjects(projects);
      setGitlabConnected(true);
    } catch (err: any) {
      alert('Failed to connect to GitLab: ' + err.message);
    } finally {
      setLoadingProjects(false);
    }
  };

  // Fetch project data when project is selected
  useEffect(() => {
    if (!selectedProjectId || !gitlabUrl || !gitlabToken) {
      setProjectData(null);
      return;
    }
    const fetchData = async () => {
      setLoadingProjectData(true);
      try {
        const resp = await fetch('/api/project-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gitlabUrl, gitlabToken, projectId: selectedProjectId }),
        });
        if (resp.ok) {
          setProjectData(await resp.json());
        }
      } catch {} finally {
        setLoadingProjectData(false);
      }
    };
    fetchData();
  }, [selectedProjectId, gitlabUrl, gitlabToken]);

  // Service account upload
  const handleServiceAccountUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setServiceAccount(json);
        setServiceAccountEmail(json.client_email || '');
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  // Polling
  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const pollProgress = async () => {
    try {
      const resp = await fetch('/api/sync-status');
      if (!resp.ok) return;
      const data = await resp.json();

      if (data.currentStep) {
        const idx = importSteps.findIndex(s => s.id === data.currentStep);
        if (idx !== -1) setCurrentStep(idx);
      }
      if (data.output) setImportOutput(data.output);

      const isCompleted = data.currentStep === 'completed' || (!data.running && data.endTime);
      const hasCompletionOutput = data.output?.includes('Sync process completed successfully');

      if (isCompleted || hasCompletionOutput) {
        stopPolling();
        setImporting(false);
        setImportProgress('completed');
        setCurrentStep(importSteps.length - 1);
        return;
      }
      if (data.error || data.currentStep === 'error') {
        stopPolling();
        setImporting(false);
        setImportProgress('error');
        return;
      }
      if (data.currentStep === 'stopped') {
        stopPolling();
        setImporting(false);
        setImportProgress('stopped');
        return;
      }
    } catch {}
  };

  // Start import
  const startImport = async () => {
    if (!gitlabUrl || !gitlabToken || !selectedProjectId || !spreadsheetId) {
      alert('Please fill in all required fields: GitLab connection, project, spreadsheet ID');
      return;
    }

    const selectedProject = gitlabProjects.find(p => String(p.id) === String(selectedProjectId));

    setImporting(true);
    setImportProgress('running');
    setCurrentStep(0);
    setImportOutput('');

    try {
      const resp = await fetch('/api/import-from-gitlab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gitlabUrl,
          gitlabToken,
          spreadsheetId,
          worksheetName,
          dateFormat,
          serviceAccount,
          serviceAccountEmail,
          projectMappings: [{
            projectId: selectedProjectId,
            projectName: selectedProject?.name || selectedProjectId,
            projectData: projectData || { milestones: [], labels: [], assignees: [] },
          }],
          importState,
          importMilestone,
          importLabels,
          importAssignee,
        }),
      });

      if (resp.ok) {
        intervalRef.current = setInterval(pollProgress, 1500);
      } else {
        const err = await resp.json().catch(() => ({ error: 'Unknown error' }));
        alert('Failed to start import: ' + (err.error || resp.status));
        setImporting(false);
        setImportProgress('error');
      }
    } catch (err: any) {
      alert('Failed to start import: ' + err.message);
      setImporting(false);
      setImportProgress('error');
    }
  };

  const stopImport = async () => {
    try { await fetch('/api/stop-sync', { method: 'POST' }); } catch {}
    stopPolling();
    setImporting(false);
    setImportProgress('stopped');
  };

  const resetImport = () => {
    stopPolling();
    setImporting(false);
    setImportProgress('idle');
    setCurrentStep(0);
    setImportOutput('');
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const getStepStatus = (index: number) => {
    if (importProgress === 'completed') return 'completed';
    if (importProgress === 'error') {
      if (index < currentStep) return 'completed';
      if (index === currentStep) return 'error';
      return 'pending';
    }
    if (index < currentStep) return 'completed';
    if (index === currentStep && importing) return 'active';
    return 'pending';
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'active': return <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default: return <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />;
    }
  };

  if (authStatus === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/v2">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to Sync
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Download className="h-5 w-5" />
                Import from GitLab
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Fetch GitLab issues into a Google Sheet
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Step 1: GitLab Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" /> GitLab Connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">GitLab API URL</Label>
                <Input
                  type="url"
                  placeholder="https://gitlab.example.com/api/v4/"
                  value={gitlabUrl}
                  onChange={(e) => { setGitlabUrl(e.target.value); setGitlabConnected(false); }}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Personal Access Token</Label>
                <Input
                  type="password"
                  placeholder="glpat-..."
                  value={gitlabToken}
                  onChange={(e) => { setGitlabToken(e.target.value); setGitlabConnected(false); }}
                  className="mt-1"
                />
              </div>
            </div>
            <Button size="sm" onClick={connectGitLab} disabled={loadingProjects || !gitlabUrl || !gitlabToken}>
              {loadingProjects ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              {gitlabConnected ? 'Reconnect' : 'Connect'}
            </Button>
            {gitlabConnected && (
              <Badge variant="default" className="bg-green-100 text-green-800 ml-2">
                Connected ({gitlabProjects.length} projects)
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Select Project */}
        {gitlabConnected && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Select Repository</CardTitle>
              <CardDescription>Choose which GitLab project to import issues from</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {gitlabProjects.map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name_with_namespace || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {loadingProjectData && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-3 w-3 animate-spin" /> Loading project data...
                </div>
              )}
              {projectData && (
                <div className="flex gap-3 text-xs text-gray-500">
                  <span>{projectData.milestones.length} milestones</span>
                  <span>{projectData.labels.length} labels</span>
                  <span>{projectData.assignees.length} members</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Sheet Config */}
        {selectedProjectId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sheet className="h-4 w-4" /> Google Sheet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Spreadsheet ID</Label>
                  <Input
                    placeholder="Spreadsheet ID from URL"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Worksheet Name</Label>
                  <Input
                    placeholder="GitLab Import"
                    value={worksheetName}
                    onChange={(e) => setWorksheetName(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              {!serviceAccount && (
                <div>
                  <Label className="text-xs">Service Account JSON</Label>
                  <Input type="file" accept=".json" onChange={handleServiceAccountUpload} className="mt-1" />
                </div>
              )}
              {serviceAccountEmail && (
                <Badge variant="outline" className="text-xs">{serviceAccountEmail}</Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Filters */}
        {selectedProjectId && spreadsheetId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import Filters</CardTitle>
              <CardDescription>Filter which issues to import</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {/* State */}
                <div>
                  <Label className="text-xs">Issue State</Label>
                  <Select value={importState} onValueChange={(v: any) => setImportState(v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All (Open + Closed)</SelectItem>
                      <SelectItem value="opened">Open only</SelectItem>
                      <SelectItem value="closed">Closed only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date format */}
                <div>
                  <Label className="text-xs">Date Format in Sheet</Label>
                  <Select value={dateFormat} onValueChange={(v: any) => setDateFormat(v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Milestone */}
                <div>
                  <Label className="text-xs">Milestone</Label>
                  <Select value={importMilestone || '_all_'} onValueChange={(v) => setImportMilestone(v === '_all_' ? '' : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all_">All milestones</SelectItem>
                      <SelectItem value="none">No milestone</SelectItem>
                      {(projectData?.milestones || []).map(m => (
                        <SelectItem key={m.id} value={m.title}>{m.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee */}
                <div>
                  <Label className="text-xs">Assignee</Label>
                  <Select value={importAssignee || '_all_'} onValueChange={(v) => setImportAssignee(v === '_all_' ? '' : v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all_">All assignees</SelectItem>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {(projectData?.assignees || []).map(a => (
                        <SelectItem key={a.username} value={a.username}>{a.name} (@{a.username})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Labels */}
                <div className="col-span-2">
                  <Label className="text-xs">Labels (comma separated)</Label>
                  <Input
                    placeholder="e.g. bug, feature"
                    value={importLabels}
                    onChange={(e) => setImportLabels(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Controls */}
        {selectedProjectId && spreadsheetId && (
          <div className="flex gap-2">
            {!importing ? (
              <>
                <Button onClick={startImport} className="flex-1">
                  <Download className="h-4 w-4 mr-2" /> Start Import
                </Button>
                {importProgress !== 'idle' && (
                  <Button variant="outline" onClick={resetImport}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Reset
                  </Button>
                )}
              </>
            ) : (
              <Button variant="destructive" onClick={stopImport} className="flex-1">
                <Square className="h-4 w-4 mr-2" /> Stop Import
              </Button>
            )}
          </div>
        )}

        {/* Progress */}
        {(importing || importProgress !== 'idle') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Import Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {importSteps.map((step, index) => {
                  const status = getStepStatus(index);
                  return (
                    <div key={step.id} className="flex items-center gap-3">
                      {getStepIcon(status)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`font-medium text-sm ${
                            status === 'completed' ? 'text-green-900' :
                            status === 'active' ? 'text-blue-900' :
                            status === 'error' ? 'text-red-900' : 'text-gray-500'
                          }`}>
                            {step.title}
                          </span>
                          <Badge variant={
                            status === 'completed' ? 'default' :
                            status === 'active' ? 'default' :
                            status === 'error' ? 'destructive' : 'secondary'
                          } className={
                            status === 'completed' ? 'bg-green-100 text-green-800' :
                            status === 'active' ? 'bg-blue-100 text-blue-800' : ''
                          }>
                            {status}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500">{step.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Progress value={(currentStep / (importSteps.length - 1)) * 100} className="w-full" />

              {importOutput && (
                <div>
                  <h4 className="font-medium mb-2 text-sm">Output</h4>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs max-h-64 overflow-y-auto">
                    <pre className="whitespace-pre-wrap">{importOutput}</pre>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Alerts */}
        {importProgress === 'completed' && (
          <Alert variant="default" className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">Import completed successfully! Check the output above for details.</AlertDescription>
          </Alert>
        )}
        {importProgress === 'error' && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>Import failed. Check the output above for error details.</AlertDescription>
          </Alert>
        )}
        {importProgress === 'stopped' && (
          <Alert variant="default" className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">Import was stopped by user.</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
