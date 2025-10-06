'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
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
  RefreshCw,
  User,
  Plus,
  Star,
  Trash2,
  LogOut
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
  const { data: session, status } = useSession();
  const { 
    currentStep, 
    activeTab, 
    setCurrentStep, 
    setActiveTab,
    gitlab,
    sheets,
    columnMappings,
    projectMappings,
    loading,
    resetSetup
  } = useSetupStore();

  const { addNotification, openModal } = useUIStore();
  const [showDashboard, setShowDashboard] = useState(true);
  const [savedConfigs, setSavedConfigs] = useState<any[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);

  const handleStepComplete = (step: number) => {
    if (step < 6) {
      setCurrentStep(step + 1);
      const nextTab = steps[step]?.id;
      if (nextTab) setActiveTab(nextTab);
    }
  };

  const handleSaveConfig = async () => {
    try {
      const response = await fetch('/api/user/configs', {
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

  // Load saved configurations
  const loadSavedConfigs = async () => {
    setLoadingConfigs(true);
    try {
      const response = await fetch('/api/user/configs');
      if (response.ok) {
        const data = await response.json();
        setSavedConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Error loading configs:', error);
      addNotification({
        type: 'error',
        title: 'Load Failed',
        message: 'Failed to load saved configurations',
      });
    } finally {
      setLoadingConfigs(false);
    }
  };

  // Load a specific configuration
  const loadConfig = (savedConfig: any) => {
    // Update store with saved configuration
    useSetupStore.getState().loadFromSavedConfig(savedConfig);
    setShowDashboard(false);
    addNotification({
      type: 'success',
      title: 'Configuration Loaded',
      message: `Loaded configuration: ${savedConfig.name}`,
    });
  };

  // Create new configuration
  const createNewConfig = () => {
    resetSetup();
    setShowDashboard(false);
    addNotification({
      type: 'info',
      title: 'New Configuration',
      message: 'Starting with a fresh configuration',
    });
  };

  // Delete configuration
  const deleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/user/configs/${configId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSavedConfigs(savedConfigs.filter(c => c.id !== configId));
        addNotification({
          type: 'success',
          title: 'Configuration Deleted',
          message: 'Configuration has been deleted successfully',
        });
      } else {
        throw new Error('Failed to delete configuration');
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: 'Failed to delete configuration',
      });
    }
  };

  // Set as default configuration
  const setAsDefault = async (configId: string) => {
    try {
      const config = savedConfigs.find(c => c.id === configId);
      const response = await fetch(`/api/user/configs/${configId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, isDefault: true }),
      });

      if (response.ok) {
        setSavedConfigs(savedConfigs.map(c => ({
          ...c,
          isDefault: c.id === configId,
        })));
        addNotification({
          type: 'success',
          title: 'Default Updated',
          message: 'Default configuration has been updated',
        });
      } else {
        throw new Error('Failed to update default configuration');
      }
    } catch (error) {
      console.error('Error updating default config:', error);
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: 'Failed to update default configuration',
      });
    }
  };

  // Load configurations when component mounts
  useEffect(() => {
    if (session?.user) {
      loadSavedConfigs();
    }
  }, [session]);

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

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold flex items-center justify-center gap-2">
              <span>🥷🏿</span>
              Sheet Ninja v2
            </CardTitle>
            <CardDescription>
              Sign in to save your configurations and manage your sync setups
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
            <div className="text-xs text-gray-500 dark:text-gray-400">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <Card className="mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-bold flex items-center justify-center gap-2">
                <span>🥷🏿</span>
                Sheet Ninja v2
              </CardTitle>
              <CardDescription className="text-blue-100 text-lg">
                Welcome back! Choose a configuration or create a new one
              </CardDescription>
            </CardHeader>
          </Card>

          {/* User Profile Header */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    {session.user.image ? (
                      <img 
                        src={session.user.image} 
                        alt="Profile" 
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-xl text-gray-900 dark:text-gray-100">{session.user.name || session.user.email}</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">{session.user.email}</CardDescription>
                  </div>
                </div>
                <Button variant="outline" onClick={() => signOut()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Saved Configurations */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 dark:text-gray-100">Saved Configurations</CardTitle>
                  <CardDescription className="text-gray-600 dark:text-gray-400">
                    Your saved GitLab and Google Sheets sync configurations
                  </CardDescription>
                </div>
                <Button onClick={createNewConfig}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Configuration
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingConfigs ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading configurations...</div>
              ) : savedConfigs.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 dark:text-gray-400 mb-4">No saved configurations yet</div>
                  <Button onClick={createNewConfig} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Configuration
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedConfigs.map((config) => (
                    <div
                      key={config.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <h3 className="font-medium text-lg text-gray-900 dark:text-gray-100">{config.name}</h3>
                          {config.isDefault && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" />
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadConfig(config)}
                          >
                            <Settings className="w-4 h-4 mr-1" />
                            Use
                          </Button>
                          {!config.isDefault && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setAsDefault(config.id)}
                              title="Set as default"
                            >
                              <Star className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteConfig(config.id)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <div className="flex items-center gap-4">
                          <span><strong>GitLab:</strong> {config.gitlabUrl}</span>
                          <span>•</span>
                          <span><strong>Sheet:</strong> {config.spreadsheetId}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span><strong>Projects:</strong> {config.projectMappings?.length || 0}</span>
                          <span>•</span>
                          <span><strong>Updated:</strong> {new Date(config.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 relative">
      <NotificationToast />
      
      {/* Loading Overlay */}
      {(loading.gitlab || loading.sheets || loading.headers || loading.projects) && (
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
                onClick={() => setShowDashboard(true)}
                className="text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
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
