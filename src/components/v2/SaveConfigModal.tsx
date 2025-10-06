'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { X, Save, Star } from 'lucide-react';

interface SaveConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (configData: { name: string; description: string; isDefault: boolean }) => void;
  loading?: boolean;
}

export function SaveConfigModal({ isOpen, onClose, onSave, loading = false }: SaveConfigModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [errors, setErrors] = useState<{ name?: string }>({});

  const handleSave = () => {
    // Validate inputs
    const newErrors: { name?: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'Configuration name is required';
    } else if (name.trim().length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    }
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length > 0) {
      return;
    }
    
    onSave({
      name: name.trim(),
      description: description.trim(),
      isDefault,
    });
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setIsDefault(false);
    setErrors({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md border dark:border-gray-700 bg-white dark:bg-gray-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl text-gray-900 dark:text-gray-100">Save Configuration</CardTitle>
              <CardDescription className="text-gray-600 dark:text-gray-400">
                Save your current setup for future use
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="config-name" className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Configuration Name *
            </Label>
            <Input
              id="config-name"
              type="text"
              placeholder="Enter configuration name..."
              value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
              className={errors.name ? 'border-red-500 focus:border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="config-description" className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Description (Optional)
            </Label>
            <Textarea
              id="config-description"
              placeholder="Describe this configuration..."
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is-default"
              checked={isDefault}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsDefault(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
            />
            <Label htmlFor="is-default" className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Set as default configuration
            </Label>
          </div>

          {isDefault && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Default Configuration:</strong> This will be automatically loaded when you start a new session.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={loading || !name.trim()}
              className="flex-1"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Configuration
                </>
              )}
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
