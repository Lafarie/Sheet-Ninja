import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, GitBranch } from 'lucide-react';
import { toast } from 'sonner';
import { useStepTransition } from './useStepTransition';

export function GitLabConfig({ config, updateConfig, setCurrentStep, setActiveTab, apiBaseUrl }) {
  const [loading, setLoading] = useState(false);
  const [availableProjects, setAvailableProjects] = useState([]);

  console.log(config)
  const fetchAvailableProjects = async () => {
    if (!config.gitlabToken) {
      toast.error('Please enter your GitLab token first');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/gitlab-project-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gitlabUrl: config.gitlabUrl,
          gitlabToken: config.gitlabToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAvailableProjects(data.projects);
      
      // Update config with available projects so ProjectMapping can use them
      updateConfig({ 
        availableProjects: data.projects
      });
      
      toast.success(`Found ${data.total} projects`);
      // Smooth transition to next step
      transitionTo(2);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to fetch projects: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const { animating, transitionTo } = useStepTransition(setCurrentStep, { delay: 700, setActiveTab, tabValue: 'sheets' });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            GitLab Configuration
          </CardTitle>
          <CardDescription>
            Configure your GitLab connection and fetch project metadata
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="gitlabUrl">GitLab URL</Label>
            <Input
              id="gitlabUrl"
              type="url"
              placeholder="https://gitlab.example.com/api/v4/"
              value={config.gitlabUrl}
              onChange={(e) => updateConfig({ gitlabUrl: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="gitlabToken">GitLab Token *</Label>
            <Input
              id="gitlabToken"
              type="password"
              placeholder="Enter your GitLab personal access token"
              value={config.gitlabToken}
              onChange={(e) => updateConfig({ gitlabToken: e.target.value })}
            />
          </div>

          {/* Fetch Projects Button */}
          <Button 
            onClick={fetchAvailableProjects}
            disabled={loading || !config.gitlabToken}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect & Fetch Projects
          </Button>

          {/* Projects Found Indicator */}
          {availableProjects.length > 0 && (
            <Alert>
              <AlertDescription>
                ✅ Successfully connected! Found {availableProjects.length} projects. 
                Configure individual project mappings in the Projects tab.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
