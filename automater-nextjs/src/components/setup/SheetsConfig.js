import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sheet, Upload, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export function SheetsConfig({ 
  config, 
  updateConfig, 
  setCurrentHeaders, 
  setCurrentStep, 
  apiBaseUrl, 
  serviceAccountLink 
}) {
  const [loading, setLoading] = useState(false);
  const [detectingHeaders, setDetectingHeaders] = useState(false);
  const fileInputRef = useRef(null);

  const handleServiceAccountUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Please select a valid JSON file');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('serviceAccount', file);

      const response = await fetch(`${apiBaseUrl}/api/upload-service-account`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      updateConfig({ serviceAccountFile: file.name });
      toast.success('Service account file uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload service account file: ' + error.message);
    }
  };

  const fetchSheetNames = async () => {
    if (!config.spreadsheetId) {
      toast.error('Please enter a spreadsheet ID');
      return;
    }

    if (!config.serviceAccountFile) {
      toast.error('Please upload a service account file');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/sheet-names`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: config.spreadsheetId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      updateConfig({ sheetNames: data.sheetNames });
      toast.success('Sheet names fetched successfully!');
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to fetch sheet names: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const detectHeaders = async () => {
    if (!config.spreadsheetId) {
      toast.error('Please enter a spreadsheet ID');
      return;
    }

    if (!config.worksheetName) {
      toast.error('Please select a worksheet');
      return;
    }

    setDetectingHeaders(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/detect-headers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          spreadsheetId: config.spreadsheetId,
          worksheetName: config.worksheetName,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setCurrentHeaders(data.headers);
      toast.success(`Detected ${data.headers.length} columns from sheet!`);
      setCurrentStep(3);
    } catch (error) {
      console.error('Detection error:', error);
      toast.error('Failed to detect headers: ' + error.message);
    } finally {
      setDetectingHeaders(false);
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
            Upload service account credentials and configure your spreadsheet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Service Account Upload */}
          <div>
            <Label htmlFor="serviceAccount">Service Account JSON File *</Label>
            <div className="mt-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
              >
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">
                  {config.serviceAccountFile ? (
                    <span className="text-green-600">✓ {config.serviceAccountFile}</span>
                  ) : (
                    'Click to upload service account JSON file'
                  )}
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleServiceAccountUpload}
                className="hidden"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Need help creating a service account?{' '}
              <a 
                href={serviceAccountLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                View guide <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {/* Spreadsheet ID */}
          <div>
            <Label htmlFor="spreadsheetId">Google Sheets Spreadsheet ID *</Label>
            <Input
              id="spreadsheetId"
              placeholder="Enter the spreadsheet ID from the URL"
              value={config.spreadsheetId}
              onChange={(e) => updateConfig({ spreadsheetId: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">
              Find this in your Google Sheets URL: https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
            </p>
          </div>

          {/* Fetch Sheet Names */}
          <Button 
            onClick={fetchSheetNames}
            disabled={loading || !config.spreadsheetId || !config.serviceAccountFile}
            className="w-full"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Fetch Available Sheets
          </Button>
        </CardContent>
      </Card>

      {config.sheetNames && config.sheetNames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Sheet Selection</CardTitle>
            <CardDescription>
              Select the worksheet to sync with GitLab issues
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="worksheetName">Worksheet Name</Label>
              <Select
                value={config.worksheetName}
                onValueChange={(value) => updateConfig({ worksheetName: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select worksheet..." />
                </SelectTrigger>
                <SelectContent>
                  {config.sheetNames.map((sheetName) => (
                    <SelectItem key={sheetName} value={sheetName}>
                      {sheetName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Available Sheets</p>
                <p className="text-xs text-gray-500">Found {config.sheetNames.length} sheets</p>
              </div>
              <Badge variant="secondary">{config.sheetNames.length}</Badge>
            </div>

            <Button 
              onClick={detectHeaders}
              disabled={detectingHeaders || !config.worksheetName}
              className="w-full"
            >
              {detectingHeaders && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Detect Column Headers
            </Button>
          </CardContent>
        </Card>
      )}

      {config.serviceAccountFile && config.spreadsheetId && config.worksheetName && (
        <Alert>
          <AlertDescription>
            ✅ Google Sheets configuration complete! Click "Detect Column Headers" to proceed to column mapping.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
