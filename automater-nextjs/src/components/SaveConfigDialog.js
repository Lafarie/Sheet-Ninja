'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Save, X } from 'lucide-react';
import { toast } from 'sonner';

export function SaveConfigDialog({ 
  isOpen, 
  onClose, 
  config, 
  columnMappings, 
  projectMappings, 
  onConfigSaved 
}) {
  const { data: session } = useSession();
  const [saving, setSaving] = useState(false);
  const [configName, setConfigName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  if (!isOpen || !session) return null;

  const handleSave = async () => {
    if (!configName.trim()) {
      toast.error('Please enter a configuration name');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/user/configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: configName.trim(),
          description: description.trim(),
          gitlabUrl: config.gitlabUrl,
          gitlabToken: config.gitlabToken,
          spreadsheetId: config.spreadsheetId,
          worksheetName: config.worksheetName,
          serviceAccount: config.serviceAccount,
          columnMappings,
          projectMappings,
          defaultAssignee: config.defaultAssignee,
          defaultMilestone: config.defaultMilestone,
          defaultLabel: config.defaultLabel,
          defaultEstimate: config.defaultEstimate,
          isDefault,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success('Configuration saved successfully!');
        onConfigSaved?.(data.config);
        onClose();
        // Reset form
        setConfigName('');
        setDescription('');
        setIsDefault(false);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to save configuration');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Save Configuration</CardTitle>
              <CardDescription>
                Save this setup to reuse later
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="configName">Configuration Name</Label>
            <Input
              id="configName"
              placeholder="e.g., My Project Sync Setup"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
            />
          </div>
          
          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Brief description of this configuration..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDefault"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
            <Label htmlFor="isDefault" className="text-sm">
              Set as default configuration
            </Label>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg text-sm">
            <div className="font-medium mb-1">This will save:</div>
            <ul className="text-gray-600 space-y-1">
              <li>• GitLab connection settings</li>
              <li>• Google Sheets configuration</li>
              <li>• Column mappings</li>
              <li>• Project mappings ({projectMappings?.length || 0} projects)</li>
              <li>• Default values</li>
            </ul>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
