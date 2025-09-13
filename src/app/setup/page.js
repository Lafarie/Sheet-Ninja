"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { GitLabConfig } from '@/components/setup/GitLabConfig';
import { SheetsConfig } from '@/components/setup/SheetsConfig';
import { ColumnMapping } from '@/components/setup/ColumnMapping';
import { ProjectMapping } from '@/components/setup/ProjectMapping';
import { SyncRunner } from '@/components/setup/SyncRunner';
import { ProgressSteps } from '@/components/setup/ProgressSteps';
import { UserDashboard } from '@/components/UserDashboard';
import { SaveConfigDialog } from '@/components/SaveConfigDialog';
import { Save, User } from 'lucide-react';
import { toast } from 'sonner';

// Configuration constants
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

// Default column configuration (same as HTML version)
const defaultConfig = {
  "DATE": { "index": 1, "header": "Date", "required": true, "data_type": "date", "description": "Task date" },
  "GIT_ID": { "index": 2, "header": "GIT ID", "required": false, "data_type": "text", "description": "GitLab issue ID" },
  "PROJECT_NAME": { "index": 3, "header": "Project Name", "required": true, "data_type": "text", "description": "Main project name" },
  "SPECIFIC_PROJECT": { "index": 4, "header": "Specific Project Name", "required": false, "data_type": "text", "description": "Specific project name" },
  "MAIN_TASK": { "index": 5, "header": "Main Task", "required": true, "data_type": "text", "description": "Main task description" },
  "SUB_TASK": { "index": 6, "header": "Sub Task", "required": false, "data_type": "text", "description": "Sub task description" },
  "STATUS": { "index": 7, "header": "Status", "required": true, "data_type": "dropdown", "description": "Task status" },
  "START_DATE": { "index": 8, "header": "Start Date", "required": false, "data_type": "date", "description": "When task started" },
  "PLANNED_ESTIMATION": { "index": 9, "header": "Planned Estimation", "required": false, "data_type": "number", "description": "Planned hours" },
  "ACTUAL_ESTIMATION": { "index": 10, "header": "Actual Spent Time", "required": false, "data_type": "number", "description": "Actual hours spent" },
  "END_DATE": { "index": 11, "header": "End Date", "required": false, "data_type": "date", "description": "When task was completed" }
};

export default function SetupPage() {
  const { data: session, status } = useSession();
  const [showDashboard, setShowDashboard] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  // When true we avoid auto-loading the user's default saved config. Used
  // to prevent the default loader from overwriting an explicit 'Create New'
  // action.
  const [skipAutoLoad, setSkipAutoLoad] = useState(false);

  // Configuration state
  const [config, setConfig] = useState({
    gitlabUrl: 'https://sourcecontrol.hsenidmobile.com/api/v4/',
    gitlabToken: '',
    projectId: '',
    spreadsheetId: '',
    worksheetName: 'Sheet1',
    defaultAssignee: '',
    defaultMilestone: '',
    defaultLabel: '',
    defaultEstimate: '8h',
    columnMappings: {},
    projectData: { labels: [], milestones: [], assignees: [] },
    sheetNames: []
  });

  // Project mappings state
  const [projectMappings, setProjectMappings] = useState([]);

  // Column mapping state
  const [currentHeaders, setCurrentHeaders] = useState([]);
  const [currentMappings, setCurrentMappings] = useState(() => {
    const mappings = {};
    Object.keys(defaultConfig).forEach(key => {
      mappings[key] = defaultConfig[key].index.toString();
    });
    return mappings;
  });
  const [autoMappings, setAutoMappings] = useState({});

  // Sync state
  const [syncRunning, setSyncRunning] = useState(false);
  const [syncProgress, setSyncProgress] = useState('idle');

  // Current step for progress tracking
  const [currentStep, setCurrentStep] = useState(1);
  // Controlled active tab so we can programmatically switch tabs when steps change
  const [activeTab, setActiveTab] = useState('gitlab');

  const updateConfig = (updates) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // When user returns to the dashboard, allow auto-loading default config again
  const returnToDashboard = () => {
    setSkipAutoLoad(false);
    setShowDashboard(true);
  };

  // Apply a saved configuration into local state
  const loadConfigFromSaved = useCallback((savedConfig) => {
    setConfig(prev => ({
      ...prev,
      gitlabUrl: savedConfig.gitlabUrl,
      gitlabToken: savedConfig.gitlabToken,
      // include basic identity fields
      id: savedConfig.id,
      name: savedConfig.name,
      isDefault: savedConfig.isDefault,
      createdAt: savedConfig.createdAt,
      updatedAt: savedConfig.updatedAt,
      projectId: savedConfig.projectId || prev.projectId || '',
      spreadsheetId: savedConfig.spreadsheetId,
      worksheetName: savedConfig.worksheetName,
      // include service account info so downstream components can access it
      serviceAccount: savedConfig.serviceAccount || null,
      serviceAccountFilename: savedConfig.serviceAccountFilename || '',
      serviceAccountEmail: savedConfig.serviceAccountEmail || (savedConfig.serviceAccount?.client_email ?? ''),
  sheetNames: savedConfig.sheetNames || [],
  // ensure columnMappings is present on the config object for downstream logic
  columnMappings: savedConfig.columnMappings || {},
      defaultAssignee: savedConfig.defaultAssignee,
      defaultMilestone: savedConfig.defaultMilestone,
      defaultLabel: savedConfig.defaultLabel,
      defaultEstimate: savedConfig.defaultEstimate,
    }));

    if (savedConfig.columnMappings) {
      setCurrentMappings(savedConfig.columnMappings);
    }

    if (savedConfig.projectMappings) {
      const mappings = savedConfig.projectMappings.map(pm => ({
        id: pm.id,
        projectName: pm.projectName,
        projectId: pm.projectId,
        assignee: pm.assignee,
        milestone: pm.milestone,
        labels: pm.labels || [],
        estimate: pm.estimate,
        projectData: { labels: [], milestones: [], assignees: [] }
      }));
      setProjectMappings(mappings);
    }

    toast.success('Configuration loaded successfully!');
  }, [setCurrentMappings, setProjectMappings, setConfig]);

  // Load default configuration if user is authenticated
  const loadDefaultConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/user/configs');
      if (response.ok) {
        const data = await response.json();
        const defaultConfig = data.configs?.find(c => c.isDefault);
        if (defaultConfig) {
          loadConfigFromSaved(defaultConfig);
        }
      }
    } catch (error) {
      console.error('Error loading default config:', error);
    }
  }, [loadConfigFromSaved]);

  useEffect(() => {
    // Only auto-load the user's default saved config when entering setup without
    // an already-selected config. This prevents overriding a config the user
    // explicitly selected from the dashboard.
    if (session?.user && showDashboard === false && !config?.id && !skipAutoLoad) {
      loadDefaultConfig();
    }
  }, [session, showDashboard, loadDefaultConfig]);

  const handleSelectConfig = (savedConfig) => {
    loadConfigFromSaved(savedConfig);
    setShowDashboard(false);
  };

  const handleCreateNew = () => {
    // Reset to a clean, empty configuration so saved values don't persist
    setConfig({
      gitlabUrl: 'https://sourcecontrol.hsenidmobile.com/api/v4/',
      gitlabToken: '',
      projectId: '',
      spreadsheetId: '',
      worksheetName: 'Sheet1',
      defaultAssignee: '',
      defaultMilestone: '',
      defaultLabel: '',
      defaultEstimate: '8h',
      columnMappings: {},
      projectData: { labels: [], milestones: [], assignees: [] },
      sheetNames: [],
      serviceAccount: null,
      serviceAccountFilename: '',
      serviceAccountEmail: '',
      id: undefined,
      name: '',
      isDefault: false,
    });
    // Clear any project mappings and mappings state
    setProjectMappings([]);
    setCurrentMappings(() => {
      const mappings = {};
      Object.keys(defaultConfig).forEach(key => {
        mappings[key] = defaultConfig[key].index.toString();
      });
      return mappings;
    });
    setCurrentHeaders([]);
    setSkipAutoLoad(true);
    setShowDashboard(false);
  };

  const handleSaveConfig = () => {
    setShowSaveDialog(true);
  };

  const handleConfigSaved = () => {
    toast.success('Configuration saved! You can access it from your dashboard.');
  };

  // Show sign-in prompt if not authenticated
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <span>🥷🏿</span>
              Sheet Ninja
            </CardTitle>
            <CardDescription>
              Sign in to save your configurations and manage your sync setups
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Benefits of signing in:
              <ul className="text-left mt-2 space-y-1">
                <li>• Save your configurations for reuse</li>
                <li>• Encrypt and secure your credentials</li>
                <li>• Quick setup for recurring syncs</li>
                <li>• Manage multiple project setups</li>
              </ul>
            </div>
            <Button onClick={() => signIn()} className="w-full">
              <User className="w-4 h-4 mr-2" />
              Sign In to Continue
            </Button>
            <div className="text-xs text-gray-500">
              Your data is encrypted and secure
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show dashboard if user wants to see it
  if (showDashboard) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-8">
          <Card className="mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
                <span>🥷🏿</span>
                Sheet Ninja
              </CardTitle>
              <CardDescription className="text-blue-100 text-lg">
                Welcome back! Choose a configuration or create a new one
              </CardDescription>
            </CardHeader>
          </Card>

          <UserDashboard 
            onSelectConfig={handleSelectConfig}
            onCreateNew={handleCreateNew}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <Card className="mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardHeader className="text-center">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                onClick={returnToDashboard}
                className="text-white hover:bg-white/10"
              >
                ← Back to Dashboard
              </Button>
              <div className="flex-1 text-center">
                <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
                  <span>🥷🏿</span>
                  Sheet Ninja
                </CardTitle>
                <CardDescription className="text-blue-100 text-lg">
                  Configure your synchronization between GitLab issues and Google Sheets
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                onClick={handleSaveConfig}
                className="text-white hover:bg-white/10"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Config
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Progress Steps */}
        <ProgressSteps currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="gitlab">GitLab</TabsTrigger>
                <TabsTrigger value="sheets">Sheets</TabsTrigger>
                <TabsTrigger value="columns">Columns</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
                <TabsTrigger value="sync">Sync</TabsTrigger>
              </TabsList>

              <TabsContent value="gitlab" className="mt-6">
                <GitLabConfig
                  config={config}
                  updateConfig={updateConfig}
                  setCurrentStep={setCurrentStep}
                  setActiveTab={setActiveTab}
                  apiBaseUrl={API_BASE_URL}
                />
              </TabsContent>

              <TabsContent value="sheets" className="mt-6">
                <SheetsConfig
                  config={config}
                  updateConfig={updateConfig}
                  setCurrentHeaders={setCurrentHeaders}
                  setCurrentStep={setCurrentStep}
                  setActiveTab={setActiveTab}
                  apiBaseUrl={API_BASE_URL}
                />
              </TabsContent>

              <TabsContent value="columns" className="mt-6">
                <ColumnMapping
                  config={config}
                  currentHeaders={currentHeaders}
                  currentMappings={currentMappings}
                  setCurrentMappings={setCurrentMappings}
                  autoMappings={autoMappings}
                  setAutoMappings={setAutoMappings}
                  defaultConfig={defaultConfig}
                  setCurrentStep={setCurrentStep}
                  setActiveTab={setActiveTab}
                />
              </TabsContent>

              <TabsContent value="projects" className="mt-6">
                <ProjectMapping
                  config={config}
                  projectMappings={projectMappings}
                  setProjectMappings={setProjectMappings}
                  currentHeaders={currentHeaders}
                  apiBaseUrl={API_BASE_URL}
                  setCurrentStep={setCurrentStep}
                  setActiveTab={setActiveTab}
                />
              </TabsContent>

              <TabsContent value="sync" className="mt-6">
                <SyncRunner
                  config={config}
                  projectMappings={projectMappings}
                  syncRunning={syncRunning}
                  setSyncRunning={setSyncRunning}
                  syncProgress={syncProgress}
                  setSyncProgress={setSyncProgress}
                  apiBaseUrl={API_BASE_URL}
                  setCurrentStep={setCurrentStep}
                  onSaveConfig={handleSaveConfig}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>📊</span>
                  Configuration Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>GitLab Token:</span>
                    <span className={config.gitlabToken ? 'text-green-600' : 'text-red-500'}>
                      {config.gitlabToken ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Spreadsheet ID:</span>
                    <span className={config.spreadsheetId ? 'text-green-600' : 'text-red-500'}>
                      {config.spreadsheetId ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Column Mapping:</span>
                    <span className={currentHeaders.length > 0 ? 'text-green-600' : 'text-red-500'}>
                      {currentHeaders.length > 0 ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Project Mappings:</span>
                    <span className={projectMappings.length > 0 ? 'text-green-600' : 'text-red-500'}>
                      {projectMappings.length > 0 ? `${projectMappings.length} projects` : '✗'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span>📚</span>
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleSaveConfig}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Configuration
                </Button>
                <button
                  onClick={() => {
                    updateConfig({
                      gitlabUrl: 'https://sourcecontrol.hsenidmobile.com/api/v4/',
                      projectId: '263',
                      spreadsheetId: '11nzrsIa3PFsuQEMD8b0rATf0aHEMuzXnOJoiHiCodv4'
                    });
                  }}
                  className="w-full text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 py-2 px-3 rounded transition-colors"
                >
                  Load Example Config
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full text-sm bg-gray-100 hover:bg-gray-200 text-gray-800 py-2 px-3 rounded transition-colors"
                >
                  Reset Configuration
                </button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Save Configuration Dialog */}
        <SaveConfigDialog
          isOpen={showSaveDialog}
          onClose={() => setShowSaveDialog(false)}
          config={config}
          columnMappings={currentMappings}
          projectMappings={projectMappings}
          onConfigSaved={handleConfigSaved}
        />
      </div>
    </div>
  );
}
