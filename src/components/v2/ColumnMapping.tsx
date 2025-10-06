'use client';

import React, { useState, useEffect } from 'react';
import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Columns, Wand2, CheckCircle } from 'lucide-react';

interface ColumnMappingProps {
  onComplete: () => void;
}

// Default column configuration
const defaultColumns = {
  DATE: { header: 'Date', required: true, description: 'Task date' },
  GIT_ID: { header: 'GIT ID', required: false, description: 'GitLab issue ID' },
  PROJECT_NAME: { header: 'Project Name', required: true, description: 'Main project name' },
  SPECIFIC_PROJECT: { header: 'Specific Project Name', required: false, description: 'Specific project name' },
  MAIN_TASK: { header: 'Main Task', required: true, description: 'Main task description' },
  SUB_TASK: { header: 'Sub Task', required: false, description: 'Sub task description' },
  STATUS: { header: 'Status', required: true, description: 'Task status' },
  START_DATE: { header: 'Start Date', required: false, description: 'When task started (prefers "Actual Start Date")' },
  PLANNED_ESTIMATION: { header: 'Planned Estimation', required: false, description: 'Planned hours' },
  ACTUAL_ESTIMATION: { header: 'Actual Spent Time', required: false, description: 'Actual hours spent' },
  END_DATE: { header: 'End Date', required: false, description: 'When task was completed' },
  USER: { header: 'User', required: false, description: 'User filter column' },
};

export function ColumnMapping({ onComplete }: ColumnMappingProps) {
  const { sheets, columnMappings, updateColumnMapping, setColumnMappings } = useSetupStore();
  const { addNotification } = useUIStore();
  const [autoMappings, setAutoMappings] = useState<Record<string, string>>({});

  const findBestMatch = (targetHeader: string, headers: string[]) => {
    const targetLower = targetHeader.toLowerCase().trim();
    
    // Exact matches first
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].toLowerCase().trim() === targetLower) {
        return i + 1;
      }
    }
    
    // Smart partial matches with priority scoring
    const matches: { index: number; score: number; header: string }[] = [];
    
    for (let i = 0; i < headers.length; i++) {
      const headerLower = headers[i].toLowerCase().trim();
      let score = 0;
      
      // Date-related matches with priority
      if (targetLower.includes('date')) {
        if (headerLower.includes('actual') && headerLower.includes('start') && headerLower.includes('date')) {
          score = 100; // Highest priority for "Actual Start Date"
        } else if (headerLower.includes('start') && headerLower.includes('date')) {
          score = 90; // High priority for "Start Date"
        } else if (headerLower.includes('end') && headerLower.includes('date')) {
          score = 80; // High priority for "End Date"
        } else if (headerLower.includes('date')) {
          score = 50; // Lower priority for generic "Date"
        }
      }
      
      // Project-related matches
      if (targetLower.includes('project')) {
        if (headerLower.includes('specific') && headerLower.includes('project')) {
          score = 95; // High priority for "Specific Project"
        } else if (headerLower.includes('project')) {
          score = 70; // Lower priority for generic "Project"
        }
      }
      
      // Task-related matches
      if (targetLower.includes('task')) {
        if (headerLower.includes('main') && headerLower.includes('task')) {
          score = 90; // High priority for "Main Task"
        } else if (headerLower.includes('sub') && headerLower.includes('task')) {
          score = 85; // High priority for "Sub Task"
        } else if (headerLower.includes('task')) {
          score = 60; // Lower priority for generic "Task"
        }
      }
      
      // Estimation-related matches
      if (targetLower.includes('estimation')) {
        if (headerLower.includes('planned') && headerLower.includes('estimation')) {
          score = 95; // High priority for "Planned Estimation"
        } else if (headerLower.includes('actual') && headerLower.includes('estimation')) {
          score = 90; // High priority for "Actual Estimation"
        } else if (headerLower.includes('estimation') || headerLower.includes('hours')) {
          score = 70; // Lower priority for generic estimation
        }
      }
      
      // Other matches
      if (targetLower.includes('status') && headerLower.includes('status')) score = 80;
      if (targetLower.includes('git') && (headerLower.includes('git') || headerLower.includes('id'))) score = 80;
      if (targetLower.includes('user') && (headerLower.includes('user') || headerLower.includes('resource'))) score = 80;
      if (targetLower.includes('spent') && headerLower.includes('spent')) score = 85;
      
      if (score > 0) {
        matches.push({ index: i, score, header: headers[i] });
      }
    }
    
    // Sort by score (highest first) and return the best match
    if (matches.length > 0) {
      matches.sort((a, b) => b.score - a.score);
      return matches[0].index + 1;
    }
    
    return null;
  };

  const handleAutoMap = () => {
    if (sheets.headers.length === 0) {
      addNotification({
        type: 'error',
        title: 'No Headers',
        message: 'Please detect headers from the Google Sheets first',
      });
      return;
    }

    const newAutoMappings: Record<string, string> = {};
    
    Object.keys(defaultColumns).forEach(key => {
      const targetHeader = defaultColumns[key as keyof typeof defaultColumns].header;
      const matchIndex = findBestMatch(targetHeader, sheets.headers);
      if (matchIndex) {
        newAutoMappings[key] = matchIndex.toString();
      }
    });

    setAutoMappings(newAutoMappings);
    setColumnMappings({ ...columnMappings, ...newAutoMappings });
    
    const mappedCount = Object.keys(newAutoMappings).length;
    addNotification({
      type: 'success',
      title: 'Auto-Mapping Complete',
      message: `Successfully mapped ${mappedCount} columns automatically`,
    });
  };

  const handleMappingChange = (key: string, value: string) => {
    const actualValue = value === 'none' ? '' : value;
    updateColumnMapping(key, actualValue);
    
    // Remove from auto mappings if manually changed
    if (actualValue && autoMappings[key]) {
      setAutoMappings(prev => {
        const newAutoMappings = { ...prev };
        delete newAutoMappings[key];
        return newAutoMappings;
      });
    }
  };

  const handleValidate = () => {
    const requiredFields = Object.keys(defaultColumns).filter(key => 
      defaultColumns[key as keyof typeof defaultColumns].required
    );
    const missingRequired = requiredFields.filter(key => 
      !columnMappings[key] || columnMappings[key] === ''
    );
    
    if (missingRequired.length > 0) {
      addNotification({
        type: 'error',
        title: 'Required Fields Missing',
        message: `Please map required fields: ${missingRequired.map(key => defaultColumns[key as keyof typeof defaultColumns].header).join(', ')}`,
      });
      return;
    }
    
    addNotification({
      type: 'success',
      title: 'Column Mapping Complete',
      message: 'All required columns have been mapped successfully',
    });
    
    onComplete();
  };

  const getColumnStatus = (key: string) => {
    const isRequired = defaultColumns[key as keyof typeof defaultColumns].required;
    const isMapped = columnMappings[key] && columnMappings[key] !== '';
    const isAutoMapped = autoMappings[key];
    
    if (isMapped && isAutoMapped) return 'auto-mapped';
    if (isMapped) return 'manual';
    if (isRequired) return 'required-missing';
    return 'optional-missing';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'auto-mapped':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">Auto</Badge>;
      case 'manual':
        return <Badge variant="default" className="text-xs">Manual</Badge>;
      case 'required-missing':
        return <Badge variant="destructive" className="text-xs">Required</Badge>;
      case 'optional-missing':
        return <Badge variant="outline" className="text-xs">Optional</Badge>;
      default:
        return null;
    }
  };

  if (sheets.headers.length === 0) {
    return (
      <Card className="border">
        <CardContent className="py-6">
          <div className="text-center py-8">
            <Columns className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">No column headers detected.</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">Please complete the Google Sheets configuration first.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Columns className="h-5 w-5" />
            Column Mapping
          </CardTitle>
          <CardDescription className="text-sm">
            Map your spreadsheet columns to the required data fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {/* Headers Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              Detected {sheets.headers.length} columns:
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {sheets.headers.map((header, index) => (
                <Badge key={index} variant="outline" className="text-xs bg-white dark:bg-gray-800">
                  {index + 1}: {header}
                </Badge>
              ))}
            </div>
          </div>

          {/* Column Mappings */}
          <div className="space-y-4">
            {Object.keys(defaultColumns).map((key) => {
              const column = defaultColumns[key as keyof typeof defaultColumns];
              const status = getColumnStatus(key);
              
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      {column.header}
                      {column.required && <span className="text-red-500">*</span>}
                      {getStatusBadge(status)}
                    </Label>
                  </div>
                  
                  <Select
                    value={columnMappings[key] === '' || !columnMappings[key] ? 'none' : columnMappings[key]}
                    onValueChange={(value: string) => handleMappingChange(key, value)}
                  >
                    <SelectTrigger className={`w-full ${status === 'required-missing' ? 'border-red-300' : ''}`}>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="none" className="text-sm">No mapping</SelectItem>
                      {sheets.headers.map((header, index) => (
                        <SelectItem key={index} value={(index + 1).toString()} className="text-sm">
                          Column {index + 1}: {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <p className="text-xs text-gray-500">
                    {column.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Mapping Summary */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">Mapping Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Required Fields:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                  {Object.keys(defaultColumns).filter(key => 
                    defaultColumns[key as keyof typeof defaultColumns].required && columnMappings[key]
                  ).length} / {Object.keys(defaultColumns).filter(key => defaultColumns[key as keyof typeof defaultColumns].required).length}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Optional Fields:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                  {Object.keys(defaultColumns).filter(key => 
                    !defaultColumns[key as keyof typeof defaultColumns].required && columnMappings[key]
                  ).length} / {Object.keys(defaultColumns).filter(key => !defaultColumns[key as keyof typeof defaultColumns].required).length}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={handleAutoMap}
              variant="outline"
              size="sm"
              className="flex-1"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Auto-Map Columns
            </Button>
            <Button 
              onClick={handleValidate} 
              variant="default"
              size="sm"
              className="flex-1"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Validate Mapping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
