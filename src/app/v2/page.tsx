'use client';

import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
// Import components with error handling
import dynamic from 'next/dynamic';

const GitLabConfig = dynamic(() => import('@/components/v2/GitLabConfig').then(mod => ({ default: mod.GitLabConfig })), { ssr: false });
const SheetsConfig = dynamic(() => import('@/components/v2/SheetsConfig').then(mod => ({ default: mod.SheetsConfig })), { ssr: false });
const ColumnMapping = dynamic(() => import('@/components/v2/ColumnMapping').then(mod => ({ default: mod.ColumnMapping })), { ssr: false });
const ProjectMapping = dynamic(() => import('@/components/v2/ProjectMapping').then(mod => ({ default: mod.ProjectMapping })), { ssr: false });
const UserFilter = dynamic(() => import('@/components/v2/UserFilter').then(mod => ({ default: mod.UserFilter })), { ssr: false });
const SyncRunner = dynamic(() => import('@/components/v2/SyncRunner').then(mod => ({ default: mod.SyncRunner })), { ssr: false });
import { NotificationToast } from '@/components/ui/notification';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { 
  GitBranch, 
  Sheet, 
  Columns, 
  Settings, 
  Users,
  Play,
  CheckCircle,
  ArrowLeft,
  Save,
  Loader2,
  RefreshCw
} from 'lucide-react';

const steps = [
  { id: 'gitlab', title: 'GitLab', icon: GitBranch, description: 'Connect to GitLab' },
  { id: 'sheets', title: 'Sheets', icon: Sheet, description: 'Configure Google Sheets' },
  { id: 'columns', title: 'Columns', icon: Columns, description: 'Map columns' },
  { id: 'projects', title: 'Projects', icon: Settings, description: 'Configure projects' },
  { id: 'filter', title: 'Filter', icon: Users, description: 'User filter (optional)' },
  { id: 'sync', title: 'Sync', icon: Play, description: 'Run synchronization' },
];

export default function SetupPage() {
  const { 
    currentStep, 
    activeTab, 
    setCurrentStep, 
    setActiveTab,
    gitlab,
    sheets,
    columnMappings,
    projectMappings,
    loading
  } = useSetupStore();

  const { addNotification, openModal } = useUIStore();

  const handleStepComplete = (step: number) => {
    if (step < 6) {
      setCurrentStep(step + 1);
      const nextTab = steps[step]?.id;
      if (nextTab) setActiveTab(nextTab);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const response = await fetch('/api/v2/config/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Current Setup',
          description: 'Auto-saved configuration',
          gitlabUrl: gitlab.url,
          gitlabToken: gitlab.token,
          spreadsheetId: sheets.spreadsheetId,
          worksheetName: sheets.worksheetName,
          columnMappings,
          projectMappings,
          userFilter: columnMappings.SELECTED_USER ? { user: columnMappings.SELECTED_USER } : null,
          serviceAccount: sheets.serviceAccount,
          isDefault: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      addNotification({
        type: 'success',
        title: 'Configuration Saved',
        message: 'Your setup has been saved successfully',
      });
    } catch (error) {
      console.error('Save config error:', error);
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  };

  const handleResetConfig = () => {
    // Reset all configuration to defaults
    useSetupStore.getState().resetSetup();
    addNotification({
      type: 'info',
      title: 'Configuration Reset',
      message: 'All configuration has been reset to defaults',
    });
  };

  const getStepStatus = (step: number) => {
    if (step < currentStep) return 'completed';
    if (step === currentStep) return 'active';
    return 'pending';
  };

  const getStepIcon = (step: number) => {
    const status = getStepStatus(step);
    const Icon = steps[step - 1]?.icon;
    
    if (status === 'completed') {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (status === 'active') {
      return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    }
    return Icon ? <Icon className="h-4 w-4 text-gray-400" /> : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 relative">
      <NotificationToast />
      
      {/* Loading Overlay */}
      {(loading.gitlab || loading.sheets || loading.headers || loading.projects || loading.sync) && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
          <Card className="p-6 border dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Processing...</h3>
                <p className="text-sm text-muted-foreground dark:text-gray-400">Please wait while we process your request</p>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <Card className="mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardHeader className="text-center">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
                className="text-white hover:bg-white/10"
                disabled={currentStep === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="flex-1 text-center">
                <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
                  <span>🥷🏿</span>
                  Sheet Ninja v2
                </CardTitle>
                <CardDescription className="text-blue-100 text-lg">
                  Advanced GitLab and Google Sheets synchronization
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSaveConfig}
                  className="text-white hover:bg-white/10"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Config
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Progress Steps */}
        <Card className="mb-8 border dark:border-gray-700">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Setup Progress</h3>
                <Badge variant="secondary" className="text-xs">Step {currentStep} of 6</Badge>
              </div>
              
              <Progress value={(currentStep / 6) * 100} className="h-2" />
              
              <div className="grid grid-cols-6 gap-4">
                {steps.map((step, index) => {
                  const stepNumber = index + 1;
                  const status = getStepStatus(stepNumber);
                  const Icon = step.icon;
                  
                  return (
                    <div
                      key={step.id}
                      className={`flex flex-col items-center p-3 rounded-lg transition-colors ${
                        status === 'active' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' :
                        status === 'completed' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                        'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                      } border`}
                    >
                      {getStepIcon(stepNumber)}
                      <span className={`text-sm font-medium mt-2 ${
                        status === 'active' ? 'text-blue-900 dark:text-blue-100' :
                        status === 'completed' ? 'text-green-900 dark:text-green-100' :
                        'text-gray-500 dark:text-gray-400'
                      }`}>
                        {step.title}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {step.description}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Setup Content */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-6">
                {steps.map((step) => {
                  const Icon = step.icon;
                  return (
                    <TabsTrigger key={step.id} value={step.id} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {step.title}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              <TabsContent value="gitlab" className="mt-6">
                <GitLabConfig onComplete={() => handleStepComplete(1)} />
              </TabsContent>

              <TabsContent value="sheets" className="mt-6">
                <SheetsConfig onComplete={() => handleStepComplete(2)} />
              </TabsContent>

              <TabsContent value="columns" className="mt-6">
                <ColumnMapping onComplete={() => handleStepComplete(3)} />
              </TabsContent>

              <TabsContent value="projects" className="mt-6">
                <ProjectMapping onComplete={() => handleStepComplete(4)} />
              </TabsContent>

              <TabsContent value="filter" className="mt-6">
                <UserFilter onComplete={() => handleStepComplete(5)} />
              </TabsContent>

              <TabsContent value="sync" className="mt-6">
                <SyncRunner onComplete={() => handleStepComplete(6)} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Status Sidebar */}
          <div className="lg:col-span-1">
            <Card className="h-fit border dark:border-gray-700">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-gray-100">
                  <CheckCircle className="h-5 w-5" />
                  Configuration Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">GitLab Connection</span>
                    <Badge variant={gitlab.token ? 'default' : 'secondary'} className="text-xs">
                      {gitlab.token ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Google Sheets</span>
                    <Badge variant={sheets.spreadsheetId ? 'default' : 'secondary'} className="text-xs">
                      {sheets.spreadsheetId ? 'Configured' : 'Not Configured'}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Column Mapping</span>
                    <Badge variant={Object.keys(columnMappings).length > 0 ? 'default' : 'secondary'} className="text-xs">
                      {Object.keys(columnMappings).length} mapped
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Project Mappings</span>
                    <Badge variant={projectMappings.length > 0 ? 'default' : 'secondary'} className="text-xs">
                      {projectMappings.length} projects
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">User Filter</span>
                    <Badge variant={columnMappings.SELECTED_USER ? 'default' : 'secondary'} className="text-xs">
                      {columnMappings.SELECTED_USER ? 'Active' : 'None'}
                    </Badge>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Quick Actions</h4>
                  <div className="space-y-2">
                    <Button 
                      onClick={handleSaveConfig}
                      variant="outline" 
                      size="sm"
                      className="w-full"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Configuration
                    </Button>
                    <Button 
                      onClick={() => {
                        addNotification({
                          type: 'info',
                          title: 'Refreshing',
                          message: 'Refreshing configuration status...',
                        });
                      }}
                      variant="outline" 
                      size="sm"
                      className="w-full"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Status
                    </Button>
                    <Button 
                      onClick={handleResetConfig}
                      variant="outline" 
                      size="sm"
                      className="w-full"
                    >
                      Reset Configuration
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
