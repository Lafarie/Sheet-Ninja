import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sheet } from 'lucide-react';
import { toast } from 'sonner';
import { useStepTransition } from './useStepTransition';

export function SheetsConfig({ 
  config, 
  updateConfig, 
  setCurrentHeaders, 
  setCurrentStep, 
  apiBaseUrl
}) {
  const [loading, setLoading] = useState(false);
  const [detectingHeaders, setDetectingHeaders] = useState(false);

  const fetchSheetNames = async () => {
    if (!config.spreadsheetId) {
      toast.error('Please enter a spreadsheet ID');
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
  transitionTo(3);
    } catch (error) {
      console.error('Detection error:', error);
      toast.error('Failed to detect headers: ' + error.message);
    } finally {
      setDetectingHeaders(false);
    }
  };

  const { animating, transitionTo } = useStepTransition(setCurrentStep, { delay: 700 });

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
          {/* Service Account Instructions */}
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">📧 Service Account Setup Required</p>
                <p className="text-sm">
                  To sync your Google Sheets, please add this service account email to your spreadsheet with <strong>Editor</strong> permissions:
                </p>
                <div className="bg-gray-100 p-2 rounded font-mono text-xs break-all">
                  automate@bright-torus-466008-t9.iam.gserviceaccount.com
                </div>
                <p className="text-xs text-gray-600">
                  1. Open your Google Sheets document<br/>
                  2. Click the &ldquo;Share&rdquo; button in the top right<br/>
                  3. Add the email above with &ldquo;Editor&rdquo; access<br/>
                  4. Click &ldquo;Send&rdquo; (no notification needed)
                </p>
              </div>
            </AlertDescription>
          </Alert>

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
            disabled={loading || !config.spreadsheetId}
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

      {config.spreadsheetId && config.worksheetName && (
        <Alert>
          <AlertDescription>
            ✅ Google Sheets configuration complete! Click &ldquo;Detect Column Headers&rdquo; to proceed to column mapping.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
