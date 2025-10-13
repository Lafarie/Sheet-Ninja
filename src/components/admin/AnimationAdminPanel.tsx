'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FallingAnimation } from '@/components/ui/falling-animation';
import { 
  Settings, 
  Play, 
  Save, 
  RefreshCw, 
  Trash2, 
  Users, 
  Eye, 
  Heart,
  Sparkles,
  AlertCircle 
} from 'lucide-react';

interface AnimationSettings {
  id: string;
  isEnabled: boolean;
  items: string[];
  itemCount: number;
  duration: number;
  maxViewsPerUser: number;
}

interface AnimationStats {
  totalViews: number;
  uniqueViewers: number;
  totalUserSettings: number;
  usersWithCustomSettings: number;
  recentViews: Array<{
    id: string;
    viewCount: number;
    lastViewAt: string;
    user: {
      name: string;
      email: string;
    };
  }>;
  topUserSettings: Array<{
    id: string;
    isEnabled: boolean;
    items: string[];
    itemCount: number;
    duration: number;
    maxViewsPerUser: number;
    updatedAt: string;
    user: {
      name: string;
      email: string;
    };
  }>;
}

export function AnimationAdminPanel() {
  const [settings, setSettings] = useState<AnimationSettings | null>(null);
  const [stats, setStats] = useState<AnimationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/animation');
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error('Failed to fetch animation settings');
      }
      
      const data = await response.json();
      setSettings(data.settings);
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    try {
      setSaving(true);
      const response = await fetch('/api/admin/animation', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save settings');
      }
      
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetViewCounts = async () => {
    if (!confirm('Are you sure you want to reset all user view counts? This will allow all users to see the animation again.')) {
      return;
    }
    
    try {
      const response = await fetch('/api/admin/animation?action=reset-views', {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset view counts');
      }
      
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset view counts');
    }
  };

  const addItem = () => {
    if (!newItem.trim() || !settings) return;
    
    setSettings({
      ...settings,
      items: [...settings.items, newItem.trim()],
    });
    setNewItem('');
  };

  const removeItem = (index: number) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      items: settings.items.filter((_, i) => i !== index),
    });
  };

  const presetItems = {
    hearts: ['❤️', '💖', '💕', '💗', '💝', '💓', '💞', '💘'],
    sparkles: ['✨', '⭐', '🌟', '💫', '⚡', '🌠', '💥'],
    celebration: ['🎉', '🎊', '🎈', '🎁', '🎀', '🍾', '🥳', '🎂'],
    nature: ['🌸', '🌺', '🌻', '🌷', '🌹', '🌼', '🌿', '🍀'],
    food: ['🍕', '🍔', '🍟', '🍰', '🍪', '🍩', '🧁', '🍫'],
    animals: ['🐱', '🐶', '🐰', '🐸', '🦄', '🐝', '🦋', '🐠'],
  };

  const applyPreset = (preset: keyof typeof presetItems) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      items: presetItems[preset],
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading animation settings...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!settings) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No animation settings found.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preview Animation */}
      <FallingAnimation
        isVisible={showPreview}
        onComplete={() => setShowPreview(false)}
        items={settings.items}
        itemCount={settings.itemCount}
        duration={settings.duration}
      />

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Animation Administration
          </CardTitle>
          <CardDescription>
            Manage global default animation settings. Users can customize their own animations at /v2/settings/animation
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger className="" value="settings">Global Defaults</TabsTrigger>
          <TabsTrigger className="" value="items">Default Items</TabsTrigger>
          <TabsTrigger className="" value="stats">View Statistics</TabsTrigger>
          <TabsTrigger className="" value="users">User Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Global Default Settings
              </CardTitle>
              <CardDescription>
                These settings serve as defaults for new users. Existing users with custom settings won't be affected.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={settings.isEnabled}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, isEnabled: checked })
                  }
                />
                <Label htmlFor="enabled">Enable animations</Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="itemCount">Number of Items</Label>
                  <Input
                    id="itemCount"
                    type="number"
                    min="1"
                    max="200"
                    value={settings.itemCount}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        itemCount: parseInt(e.target.value) || 50,
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="duration">Duration (ms)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1000"
                    max="10000"
                    value={settings.duration}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        duration: parseInt(e.target.value) || 3000,
                      })
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="maxViews">Max Views Per User</Label>
                  <Input
                    id="maxViews"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.maxViewsPerUser}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maxViewsPerUser: parseInt(e.target.value) || 5,
                      })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={saveSettings} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Global Defaults'}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => setShowPreview(true)}
                  disabled={!settings.isEnabled}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Preview Animation
                </Button>
                
                <Button variant="outline" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Default Animation Items
              </CardTitle>
              <CardDescription>
                Configure the default items that new users will start with. Users can customize their own items later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add new item (emoji)"
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addItem();
                    }
                  }}
                />
                <Button onClick={addItem} disabled={!newItem.trim()}>
                  Add Item
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Quick Presets</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(presetItems).map((preset) => (
                    <Button
                      key={preset}
                      variant="outline"
                      size="sm"
                      onClick={() => applyPreset(preset as keyof typeof presetItems)}
                    >
                      {preset.charAt(0).toUpperCase() + preset.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Current Items ({settings.items.length})</Label>
                <div className="flex flex-wrap gap-2 p-4 border rounded-lg">
                  {settings.items.map((item, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-lg cursor-pointer hover:bg-red-100"
                      onClick={() => removeItem(index)}
                    >
                      {item} ×
                    </Badge>
                  ))}
                  {settings.items.length === 0 && (
                    <p className="text-muted-foreground">No items configured</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-blue-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Total Views</p>
                    <p className="text-2xl font-bold">{stats?.totalViews || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Unique Viewers</p>
                    <p className="text-2xl font-bold">{stats?.uniqueViewers || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Settings className="h-4 w-4 text-purple-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Users with Settings</p>
                    <p className="text-2xl font-bold">{stats?.totalUserSettings || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Custom Settings</p>
                    <p className="text-2xl font-bold">{stats?.usersWithCustomSettings || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Views</CardTitle>
              <CardDescription>
                Latest animation views from users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.recentViews && stats.recentViews.length > 0 ? (
                <div className="space-y-2">
                  {stats.recentViews.map((view) => (
                    <div
                      key={view.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div>
                        <p className="font-medium">{view.user.name || view.user.email}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(view.lastViewAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {view.viewCount} views
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No recent views</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>
                These actions cannot be undone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                onClick={resetViewCounts}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Reset All View Counts
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>User Animation Settings</CardTitle>
              <CardDescription>
                Overview of users who have customized their animation settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats?.topUserSettings && stats.topUserSettings.length > 0 ? (
                <div className="space-y-4">
                  {stats.topUserSettings.map((userSetting) => (
                    <div
                      key={userSetting.id}
                      className="p-4 border rounded-lg space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{userSetting.user.name || userSetting.user.email}</p>
                          <p className="text-sm text-muted-foreground">
                            Last updated: {new Date(userSetting.updatedAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={userSetting.isEnabled ? "default" : "secondary"}>
                          {userSetting.isEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Items: </span>
                          <span className="text-muted-foreground">{userSetting.itemCount}</span>
                        </div>
                        <div>
                          <span className="font-medium">Duration: </span>
                          <span className="text-muted-foreground">{userSetting.duration}ms</span>
                        </div>
                        <div>
                          <span className="font-medium">Max Views: </span>
                          <span className="text-muted-foreground">{userSetting.maxViewsPerUser}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1">
                        {userSetting.items.slice(0, 10).map((item, index) => (
                          <span key={index} className="text-lg">{item}</span>
                        ))}
                        {userSetting.items.length > 10 && (
                          <span className="text-sm text-muted-foreground">+{userSetting.items.length - 10} more</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No users have customized their animation settings yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}