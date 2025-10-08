'use client';

import React, { useState, useRef } from 'react';
import { useSetupStore } from '@/stores/useSetupStore';
import { useUIStore } from '@/stores/useUIStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Sheet, Loader2, CheckCircle, Upload } from 'lucide-react';

interface SheetsConfigProps {
  onComplete: () => void;
}

export function SheetsConfig({ onComplete }: SheetsConfigProps) {
  const { sheets, loading, updateSheets, setSheetNames, setHeaders, setSheetsLoading, setHeadersLoading } = useSetupStore();
  const { addNotification } = useUIStore();
  const [isDetecting, setIsDetecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateServiceAccount = (serviceAccount: any): boolean => {
    return (
      serviceAccount &&
      typeof serviceAccount === 'object' &&
      typeof serviceAccount.client_email === 'string' &&
      typeof serviceAccount.private_key === 'string' &&
      typeof serviceAccount.project_id === 'string' &&
      serviceAccount.client_email.includes('@') &&
      serviceAccount.private_key.includes('-----BEGIN PRIVATE KEY-----')
    );
  };

  const handleServiceAccountUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const serviceAccount = JSON.parse(e.target?.result as string);
        
        if (!validateServiceAccount(serviceAccount)) {
          addNotification({
            type: 'error',
            title: 'Invalid Service Account',
            message: 'The uploaded file is not a valid Google service account JSON. Please ensure it contains client_email, private_key, and project_id fields.',
          });
          return;
        }
        
        updateSheets({ 
          serviceAccount,
          serviceAccountEmail: serviceAccount.client_email || ''
        });
        addNotification({
          type: 'success',
          title: 'Service Account Loaded',
          message: 'Service account credentials loaded successfully',
        });
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Invalid File',
          message: 'Please upload a valid JSON service account file',
        });
      }
    };
    reader.readAsText(file);
  };

  const handleFetchSheets = async () => {
    if (!sheets.spreadsheetId) {
      addNotification({
        type: 'error',
        title: 'Spreadsheet ID Required',
        message: 'Please enter a Google Sheets spreadsheet ID',
      });
      return;
    }

    setSheetsLoading(true);

    try {
      const response = await fetch('/api/sheet-names', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: sheets.spreadsheetId,
          serviceAccount: sheets.serviceAccount,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Sheets API response:', data);
      setSheetNames(data.sheetNames || []);
      
      addNotification({
        type: 'success',
        title: 'Sheets Fetched',
        message: `Found ${data.sheetNames?.length || 0} worksheets`,
      });
    } catch (error) {
      console.error('Sheets fetch error:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please check your internet connection and try again.';
        } else if (error.message.includes('Permission denied')) {
          errorMessage = 'Permission denied. Please ensure the service account has access to the spreadsheet.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'Spreadsheet not found. Please verify the spreadsheet ID is correct.';
        } else if (error.message.includes('Invalid credentials')) {
          errorMessage = 'Authentication failed. Please check your service account credentials.';
        } else {
          errorMessage = error.message;
        }
      }
      
      addNotification({
        type: 'error',
        title: 'Fetch Failed',
        message: `Failed to fetch sheets: ${errorMessage}`,
      });
    } finally {
      setSheetsLoading(false);
    }
  };

  const handleDetectHeaders = async () => {
    if (!sheets.spreadsheetId || !sheets.worksheetName) {
      addNotification({
        type: 'error',
        title: 'Configuration Required',
        message: 'Please enter spreadsheet ID and select a worksheet',
      });
      return;
    }

    setIsDetecting(true);
    setHeadersLoading(true);

    try {
      const response = await fetch('/api/detect-headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: sheets.spreadsheetId,
          worksheetName: sheets.worksheetName,
          serviceAccount: sheets.serviceAccount,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setHeaders(data.headers || []);
      
      addNotification({
        type: 'success',
        title: 'Headers Detected',
        message: `Found ${data.headers?.length || 0} columns`,
      });
      
      onComplete();
    } catch (error) {
      console.error('Header detection error:', error);
      
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again.';
        } else if (error.message.includes('Permission denied')) {
          errorMessage = 'Permission denied. Please ensure the service account has access to the worksheet.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'Worksheet not found. Please verify the worksheet name is correct.';
        } else if (error.message.includes('Invalid credentials')) {
          errorMessage = 'Authentication failed. Please check your service account credentials.';
        } else {
          errorMessage = error.message;
        }
      }
      
      addNotification({
        type: 'error',
        title: 'Detection Failed',
        message: `Failed to detect headers: ${errorMessage}`,
      });
    } finally {
      setIsDetecting(false);
      setHeadersLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sheet className="h-5 w-5" />
            Google Sheets Configuration
          </CardTitle>
          <CardDescription>
            Configure your Google Sheets connection and detect column headers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Service Account Instructions */}
          <Alert variant="default" className="border-blue-200 bg-blue-50">
            <AlertDescription className="text-blue-800">
              <div className="space-y-2">
                <p className="font-medium">📧 Service Account Setup Required</p>
                <p className="text-sm">
                  To sync your Google Sheets, please add this service account email to your spreadsheet with <strong>Editor</strong> permissions:
                </p>
                <div className="flex items-center gap-2">
                  <div className="bg-gray-100 p-2 rounded font-mono text-xs break-all">
                    {sheets.serviceAccountEmail || sheets.serviceAccount?.client_email || 'automate@bright-torus-466008-t9.iam.gserviceaccount.com'}
                  </div>
                  <button
                    type="button"
                    className="px-2 py-1 bg-gray-200 rounded text-sm"
                    onClick={() => {
                      const email = sheets.serviceAccountEmail || sheets.serviceAccount?.client_email || 'automate@bright-torus-466008-t9.iam.gserviceaccount.com';
                      try {
                        navigator.clipboard.writeText(email);
                        addNotification({
                          type: 'success',
                          title: 'Copied',
                          message: 'Service account email copied to clipboard',
                        });
                      } catch (err) {
                        console.error('Clipboard copy failed', err);
                      }
                    }}
                    aria-label="Copy service account email"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-xs text-gray-600">
                  1. Open your Google Sheets document<br/>
                  2. Click the "Share" button in the top right<br/>
                  3. Add the email above with "Editor" access<br/>
                  4. Click "Send" (no notification needed)
                </p>
              </div>
            </AlertDescription>
          </Alert>

          {/* Service Account Upload */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Service Account JSON (Optional)</Label>
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600">
                {sheets.serviceAccount ? 'Service account loaded' : 'Click to upload service account JSON'}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleServiceAccountUpload(file);
                }}
              />
            </div>
            {sheets.serviceAccountEmail && (
              <p className="text-xs text-muted-foreground">
                Service Account: {sheets.serviceAccountEmail}
              </p>
            )}
          </div>

          {/* Spreadsheet ID */}
          <div className="space-y-2">
            <Label htmlFor="spreadsheetId" className="text-sm font-medium">Spreadsheet ID *</Label>
            <Input
              id="spreadsheetId"
              className="w-full"
              type="text"
              placeholder="Enter the spreadsheet ID from the URL"
              value={sheets.spreadsheetId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSheets({ spreadsheetId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Google Sheets URL: https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
            </p>
            <p className="text-xs text-amber-600 mt-1">
              📝 <strong>Note:</strong> Make sure your Date column is in DD/MM/YYYY format for proper date filtering
            </p>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={handleFetchSheets}
            disabled={!sheets.spreadsheetId || loading.sheets}
            className="w-full"
          >
            {loading.sheets && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading.sheets ? 'Fetching Sheets...' : 'Fetch Available Sheets'}
          </Button>
        </CardContent>
      </Card>

      {/* Sheet Selection */}
      {sheets.sheetNames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Worksheet Selection</CardTitle>
            <CardDescription>
              Select the worksheet to sync with GitLab issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="worksheetName" className="text-sm font-medium">Worksheet Name</Label>
              <Select
                value={sheets.worksheetName}
                onValueChange={(value: string) => updateSheets({ worksheetName: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select worksheet..." />
                </SelectTrigger>
                <SelectContent className="w-full">
                  {sheets.sheetNames.map((sheetName) => (
                    <SelectItem key={sheetName} value={sheetName} className="w-full">
                      {sheetName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Available Sheets</p>
                <p className="text-xs text-muted-foreground">
                  Found {sheets.sheetNames.length} sheets
                </p>
              </div>
              <Badge variant="secondary" className="text-xs">{sheets.sheetNames.length}</Badge>
            </div>

            <Button
              variant="default"
              size="sm"
              onClick={handleDetectHeaders}
              disabled={isDetecting || !sheets.worksheetName}
              className="w-full"
            >
              {isDetecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Detect Column Headers
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Headers Display */}
      {sheets.headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Detected Headers
            </CardTitle>
            <CardDescription>
              Column headers found in the selected worksheet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sheets.headers.map((header, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {index + 1}: {header}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
