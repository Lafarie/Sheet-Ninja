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
  const { sheets, updateSheets, setSheetNames, setHeaders, setSheetsLoading, setHeadersLoading } = useSetupStore();
  const { addNotification } = useUIStore();
  const [isDetecting, setIsDetecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleServiceAccountUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const serviceAccount = JSON.parse(e.target?.result as string);
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
      const response = await fetch('/api/v2/sheets/connect', {
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
      setSheetNames(data.worksheets?.map((w: any) => w.title) || []);
      
      addNotification({
        type: 'success',
        title: 'Sheets Fetched',
        message: `Found ${data.worksheets?.length || 0} worksheets`,
      });
    } catch (error) {
      console.error('Sheets fetch error:', error);
      addNotification({
        type: 'error',
        title: 'Fetch Failed',
        message: `Failed to fetch sheets: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      const response = await fetch('/api/v2/sheets/detect-headers', {
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
      addNotification({
        type: 'error',
        title: 'Detection Failed',
        message: `Failed to detect headers: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
              onChange={(e : any) => updateSheets({ spreadsheetId: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Find this in your Google Sheets URL: https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
            </p>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={handleFetchSheets}
            disabled={!sheets.spreadsheetId}
            className="w-full"
          >
            Fetch Available Sheets
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
                onValueChange={(value : any) => updateSheets({ worksheetName: value })}
                className="w-full"
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
