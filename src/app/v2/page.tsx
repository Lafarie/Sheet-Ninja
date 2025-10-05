'use client';

import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GitLabConfig } from '@/components/v2/GitLabConfig';
import { SheetsConfig } from '@/components/v2/SheetsConfig';
import { ColumnMapping } from '@/components/v2/ColumnMapping';
import { ProjectMapping } from '@/components/v2/ProjectMapping';
import { UserFilter } from '@/components/v2/UserFilter';
import { SyncRunner } from '@/components/v2/SyncRunner';
import { NotificationToast } from '@/components/ui/notification';
import { 
  GitBranch, 
  Sheet, 
  Columns, 
  Settings, 
  Users,
  Play,
  CheckCircle,
  ArrowLeft,
  Save
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

  const handleSaveConfig = () => {
    openModal('saveConfig');
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
      return <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
    }
    return Icon ? <Icon className="h-4 w-4 text-gray-400" /> : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NotificationToast />
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <Card className="mb-8 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
          <CardHeader className="text-center">
            <div className="flex items-center justify-between">
              <Button 
                variant="ghost" 
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
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Setup Progress</h3>
                <Badge variant="secondary">Step {currentStep} of 6</Badge>
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
                        status === 'active' ? 'bg-blue-50 border-blue-200' :
                        status === 'completed' ? 'bg-green-50 border-green-200' :
                        'bg-gray-50 border-gray-200'
                      } border`}
                    >
                      {getStepIcon(stepNumber)}
                      <span className={`text-sm font-medium mt-2 ${
                        status === 'active' ? 'text-blue-900' :
                        status === 'completed' ? 'text-green-900' :
                        'text-gray-500'
                      }`}>
                        {step.title}
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Configuration Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">GitLab Connection</span>
                    <Badge variant={gitlab.token ? 'default' : 'secondary'}>
                      {gitlab.token ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Google Sheets</span>
                    <Badge variant={sheets.spreadsheetId ? 'default' : 'secondary'}>
                      {sheets.spreadsheetId ? 'Configured' : 'Not Configured'}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Column Mapping</span>
                    <Badge variant={Object.keys(columnMappings).length > 0 ? 'default' : 'secondary'}>
                      {Object.keys(columnMappings).length} mapped
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Project Mappings</span>
                    <Badge variant={projectMappings.length > 0 ? 'default' : 'secondary'}>
                      {projectMappings.length} projects
                    </Badge>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Quick Actions</h4>
                  <div className="space-y-2">
                    <Button 
                      onClick={handleSaveConfig}
                      variant="outline" 
                      className="w-full"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Configuration
                    </Button>
                    <Button 
                      onClick={() => {
                        addNotification({
                          type: 'info',
                          title: 'Reset Configuration',
                          message: 'Configuration has been reset to defaults',
                        });
                      }}
                      variant="outline" 
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
