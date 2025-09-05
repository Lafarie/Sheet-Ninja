"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitLabConfig } from '@/components/setup/GitLabConfig';
import { SheetsConfig } from '@/components/setup/SheetsConfig';
import { ColumnMapping } from '@/components/setup/ColumnMapping';
import { SyncRunner } from '@/components/setup/SyncRunner';
import { ProgressSteps } from '@/components/setup/ProgressSteps';

// Configuration constants
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

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

  const updateConfig = (updates) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <Card className="mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
              <span>🥷🏿</span>
              Sheet Ninja
            </CardTitle>
            <CardDescription className="text-blue-100 text-lg">
              Configure your synchronization between GitLab issues and Google Sheets
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Progress Steps */}
        <ProgressSteps currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="gitlab" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="gitlab">GitLab</TabsTrigger>
                <TabsTrigger value="sheets">Sheets</TabsTrigger>
                <TabsTrigger value="columns">Columns</TabsTrigger>
                <TabsTrigger value="sync">Sync</TabsTrigger>
              </TabsList>

              <TabsContent value="gitlab" className="mt-6">
                <GitLabConfig
                  config={config}
                  updateConfig={updateConfig}
                  setCurrentStep={setCurrentStep}
                  apiBaseUrl={API_BASE_URL}
                />
              </TabsContent>

              <TabsContent value="sheets" className="mt-6">
                <SheetsConfig
                  config={config}
                  updateConfig={updateConfig}
                  setCurrentHeaders={setCurrentHeaders}
                  setCurrentStep={setCurrentStep}
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
                />
              </TabsContent>

              <TabsContent value="sync" className="mt-6">
                <SyncRunner
                  config={config}
                  syncRunning={syncRunning}
                  setSyncRunning={setSyncRunning}
                  syncProgress={syncProgress}
                  setSyncProgress={setSyncProgress}
                  apiBaseUrl={API_BASE_URL}
                  setCurrentStep={setCurrentStep}
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
                    <span>Project ID:</span>
                    <span className={config.projectId ? 'text-green-600' : 'text-red-500'}>
                      {config.projectId ? '✓' : '✗'}
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
      </div>
    </div>
  );
}
