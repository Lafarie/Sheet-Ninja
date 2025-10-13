'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FallingAnimation } from '@/components/ui/falling-animation';
import { 
  Settings, 
  Play, 
  Save, 
  RefreshCw, 
  Heart,
  Sparkles,
  AlertCircle,
  User 
} from 'lucide-react';

interface UserAnimationSettings {
  id: string;
  isEnabled: boolean;
  items: string[];
  itemCount: number;
  duration: number;
  maxViewsPerUser: number;
}

export function UserAnimationPanel() {
  const [settings, setSettings] = useState<UserAnimationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/animation');
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to customize your animations');
        }
        throw new Error('Failed to fetch your animation settings');
      }
      
      const data = await response.json();
      setSettings(data.settings);
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
      setError(null);
      setSuccess(null);
      
      const response = await fetch('/api/user/animation', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }
      
      await fetchSettings();
      setSuccess('Your animation settings have been saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
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
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading your animation settings...</p>
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

      {/* Success Message */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            My Animation Settings
          </CardTitle>
          <CardDescription>
            Customize your personal falling animations that appear when you login or visit the page
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Animation Configuration
          </CardTitle>
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
            <Label htmlFor="enabled">Enable my personal animations</Label>
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
              <Label htmlFor="maxViews">Max Views Per Login Session</Label>
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
              {saving ? 'Saving...' : 'Save My Settings'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setShowPreview(true)}
              disabled={!settings.isEnabled}
            >
              <Play className="h-4 w-4 mr-2" />
              Preview Animation
            </Button>
            
            <Button variant="outline" onClick={fetchSettings}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Animation Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            My Animation Items
          </CardTitle>
          <CardDescription>
            Choose what items fall during your personal animation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add new item (emoji or text)"
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
            <Label>Your Items ({settings.items.length})</Label>
            <div className="flex flex-wrap gap-2 p-4 border rounded-lg min-h-[60px]">
              {settings.items.map((item, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-lg cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() => removeItem(index)}
                  title="Click to remove"
                >
                  {item} ×
                </Badge>
              ))}
              {settings.items.length === 0 && (
                <p className="text-muted-foreground">No items configured. Add some items or choose a preset above!</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}