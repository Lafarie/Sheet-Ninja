import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings, Download, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ConfigGeneration({ 
  config, 
  currentMappings, 
  currentHeaders, 
  defaultConfig, 
  setCurrentStep 
}) {
  const [configGenerated, setConfigGenerated] = useState(false);
  const [envContent, setEnvContent] = useState('');
  const [configContent, setConfigContent] = useState('');

  const generateConfiguration = () => {
    // Generate .env content
    const envFile = `# Environment Variables for GitLab ↔ Google Sheets Sync
GITLAB_TOKEN=${config.gitlabToken}
GITLAB_URL=${config.gitlabUrl}
PROJECT_ID=${config.projectId}
SPREADSHEET_ID=${config.spreadsheetId}
WORKSHEET_NAME=${config.worksheetName}
SERVICE_ACCOUNT_FILE=service_account.json
DEFAULT_ASSIGNEE=${config.defaultAssignee}
DEFAULT_ESTIMATE=${config.defaultEstimate}
DEFAULT_MILESTONE=${config.defaultMilestone}
DEFAULT_DUE_DATE=
DEFAULT_LABEL=${config.defaultLabel}`;

    // Generate column configuration
    const updatedConfig = {};
    Object.keys(defaultConfig).forEach(key => {
      const newIndex = parseInt(currentMappings[key]);
      if (newIndex && newIndex <= currentHeaders.length) {
        updatedConfig[key] = {
          ...defaultConfig[key],
          index: newIndex,
          header: currentHeaders[newIndex - 1] // Convert to 0-based for header lookup
        };
      } else {
        updatedConfig[key] = defaultConfig[key];
      }
    });

    setEnvContent(envFile);
    setConfigContent(JSON.stringify(updatedConfig, null, 2));
    setConfigGenerated(true);
    setCurrentStep(5);
    toast.success('Configuration files generated successfully!');
  };

  const copyToClipboard = async (content, type) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success(`${type} copied to clipboard!`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const downloadFile = (content, filename, contentType = 'text/plain') => {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${filename} downloaded!`);
  };

  const validateConfiguration = () => {
    const issues = [];
    
    if (!config.gitlabToken) issues.push('GitLab Token is required');
    if (!config.projectId) issues.push('Project ID is required');
    if (!config.spreadsheetId) issues.push('Spreadsheet ID is required');
    
    // Check required mappings
    const requiredFields = Object.keys(defaultConfig).filter(key => defaultConfig[key].required);
    const missingMappings = requiredFields.filter(key => !currentMappings[key]);
    if (missingMappings.length > 0) {
      issues.push(`Missing column mappings: ${missingMappings.map(key => defaultConfig[key].header).join(', ')}`);
    }
    
    if (issues.length > 0) {
      toast.error('Configuration issues: ' + issues.join(', '));
      return false;
    } else {
      toast.success('Configuration is valid!');
      return true;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Generate Configuration
          </CardTitle>
          <CardDescription>
            Create the configuration files needed to run the sync
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Validation Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h4 className="font-medium">Configuration Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
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
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Project Name:</span>
                  <span className={config.projectData?.name ? 'text-green-600' : 'text-gray-500'}>
                    {config.projectData?.name || 'Not fetched'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Worksheet:</span>
                  <span className={config.worksheetName ? 'text-green-600' : 'text-red-500'}>
                    {config.worksheetName ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Column Mapping:</span>
                  <span className={Object.keys(currentMappings).filter(k => currentMappings[k]).length > 0 ? 'text-green-600' : 'text-red-500'}>
                    {Object.keys(currentMappings).filter(k => currentMappings[k]).length > 0 ? '✓' : '✗'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={validateConfiguration} variant="outline" className="flex-1">
              Validate Configuration
            </Button>
            <Button onClick={generateConfiguration} className="flex-1">
              Generate Config Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {configGenerated && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Configuration Files</CardTitle>
            <CardDescription>
              Copy these files to your scripts directory to run the sync
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="env" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="env">.env file</TabsTrigger>
                <TabsTrigger value="config">custom_columns.json</TabsTrigger>
              </TabsList>
              
              <TabsContent value="env" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Environment Variables</h4>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(envContent, '.env file')}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile(envContent, '.env')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={envContent}
                  readOnly
                  className="font-mono text-xs h-64"
                />
              </TabsContent>
              
              <TabsContent value="config" className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium">Column Configuration</h4>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(configContent, 'config file')}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadFile(configContent, 'custom_columns.json', 'application/json')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={configContent}
                  readOnly
                  className="font-mono text-xs h-64"
                />
              </TabsContent>
            </Tabs>

            {/* Instructions */}
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">Setup Instructions:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Save the .env content to a file named '.env'</li>
                    <li>Save the JSON content to a file named 'custom_columns.json'</li>
                    <li>Place both files in your scripts directory</li>
                    <li>Ensure your service_account.json is in the same directory</li>
                    <li>Run your sync scripts!</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>

            {/* Validation Stats */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="text-center">
                <Badge variant="secondary">
                  {config.projectData?.name ? `Project: ${config.projectData.name}` : `Project ID: ${config.projectId}`}
                </Badge>
              </div>
              <div className="text-center">
                <Badge variant="secondary">Worksheet: {config.worksheetName}</Badge>
              </div>
              <div className="text-center">
                <Badge variant="secondary">
                  Mapped Columns: {Object.keys(currentMappings).filter(k => currentMappings[k]).length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
