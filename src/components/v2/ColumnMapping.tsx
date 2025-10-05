'use client';

import { useState, useEffect } from 'react';
import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  START_DATE: { header: 'Start Date', required: false, description: 'When task started' },
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
    
    // Partial matches for common variations
    for (let i = 0; i < headers.length; i++) {
      const headerLower = headers[i].toLowerCase().trim();
      
      if (targetLower.includes('date') && headerLower.includes('date')) return i + 1;
      if (targetLower.includes('project') && headerLower.includes('project')) return i + 1;
      if (targetLower.includes('task') && headerLower.includes('task')) return i + 1;
      if (targetLower.includes('status') && headerLower.includes('status')) return i + 1;
      if (targetLower.includes('estimation') && (headerLower.includes('estimation') || headerLower.includes('hours'))) return i + 1;
      if (targetLower.includes('git') && (headerLower.includes('git') || headerLower.includes('id'))) return i + 1;
      if (targetLower.includes('user') && headerLower.includes('user')) return i + 1;
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
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Auto</Badge>;
      case 'manual':
        return <Badge variant="default">Manual</Badge>;
      case 'required-missing':
        return <Badge variant="destructive">Required</Badge>;
      case 'optional-missing':
        return <Badge variant="outline">Optional</Badge>;
      default:
        return null;
    }
  };

  if (sheets.headers.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center py-8">
            <Columns className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No column headers detected.</p>
            <p className="text-sm text-gray-500">Please complete the Google Sheets configuration first.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Columns className="h-5 w-5" />
            Column Mapping
          </CardTitle>
          <CardDescription>
            Map your spreadsheet columns to the required data fields
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Headers Info */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-blue-900">
              Detected {sheets.headers.length} columns:
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {sheets.headers.map((header, index) => (
                <Badge key={index} variant="outline" className="text-xs">
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
                    onValueChange={(value) => handleMappingChange(key, value)}
                  >
                    <SelectTrigger className={status === 'required-missing' ? 'border-red-300' : ''}>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No mapping</SelectItem>
                      {sheets.headers.map((header, index) => (
                        <SelectItem key={index} value={(index + 1).toString()}>
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
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Mapping Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Required Fields:</span>
                <span className="ml-2 font-medium">
                  {Object.keys(defaultColumns).filter(key => 
                    defaultColumns[key as keyof typeof defaultColumns].required && columnMappings[key]
                  ).length} / {Object.keys(defaultColumns).filter(key => defaultColumns[key as keyof typeof defaultColumns].required).length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Optional Fields:</span>
                <span className="ml-2 font-medium">
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
              className="flex-1"
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Auto-Map Columns
            </Button>
            <Button onClick={handleValidate} className="flex-1">
              <CheckCircle className="mr-2 h-4 w-4" />
              Validate Mapping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
