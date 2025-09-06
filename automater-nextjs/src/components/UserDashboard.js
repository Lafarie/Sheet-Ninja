'use client';

import { useSession, signOut } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Plus, Settings, Trash2, Star, User, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';

export function UserDashboard({ onSelectConfig, onCreateNew }) {
  const { data: session } = useSession();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user) {
      fetchConfigs();
    }
  }, [session]);

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/user/configs');
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      } else {
        toast.error('Failed to fetch saved configurations');
      }
    } catch (error) {
      console.error('Error fetching configs:', error);
      toast.error('Error loading configurations');
    } finally {
      setLoading(false);
    }
  };

  const deleteConfig = async (configId) => {
    if (!confirm('Are you sure you want to delete this configuration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/user/configs/${configId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConfigs(configs.filter(c => c.id !== configId));
        toast.success('Configuration deleted');
      } else {
        toast.error('Failed to delete configuration');
      }
    } catch (error) {
      console.error('Error deleting config:', error);
      toast.error('Error deleting configuration');
    }
  };

  const setAsDefault = async (configId) => {
    try {
      const config = configs.find(c => c.id === configId);
      const response = await fetch(`/api/user/configs/${configId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...config,
          isDefault: true,
        }),
      });

      if (response.ok) {
        setConfigs(configs.map(c => ({
          ...c,
          isDefault: c.id === configId,
        })));
        toast.success('Default configuration updated');
      } else {
        toast.error('Failed to update default configuration');
      }
    } catch (error) {
      console.error('Error updating default config:', error);
      toast.error('Error updating configuration');
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* User Profile Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                {session.user.image ? (
                  <Image 
                    src={session.user.image} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full"
                    width={40}
                    height={40}
                  />
                ) : (
                  <User className="w-5 h-5 text-gray-500" />
                )}
              </div>
              <div>
                <CardTitle className="text-xl">{session.user.name || session.user.email}</CardTitle>
                <CardDescription>{session.user.email}</CardDescription>
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
              <CardTitle>Saved Configurations</CardTitle>
              <CardDescription>
                Your saved GitLab and Google Sheets sync configurations
              </CardDescription>
            </div>
            <Button onClick={onCreateNew}>
              <Plus className="w-4 h-4 mr-2" />
              New Configuration
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading configurations...</div>
          ) : configs.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">No saved configurations yet</div>
              <Button onClick={onCreateNew} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Configuration
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => (
                <div
                  key={config.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-lg">{config.name}</h3>
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
                        onClick={() => onSelectConfig(config)}
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
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-4">
                      <span><strong>GitLab:</strong> {config.gitlabUrl}</span>
                      <Separator orientation="vertical" className="h-4" />
                      <span><strong>Sheet:</strong> {config.spreadsheetId}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span><strong>Projects:</strong> {config.projectMappings?.length || 0}</span>
                      <Separator orientation="vertical" className="h-4" />
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
  );
}
