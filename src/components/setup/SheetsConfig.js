import { useState, useRef } from 'react';
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
  setActiveTab,
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
          serviceAccount: config.serviceAccount || null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

  const data = await response.json();
      updateConfig({ sheetNames: data.sheetNames });

      // Auto-scroll to the sheet selection area so the user can pick the worksheet
      // Wrap in a small timeout to allow the DOM to render the selection card
      setTimeout(() => {
        try {
          if (sheetSelectionRef.current && typeof sheetSelectionRef.current.scrollIntoView === 'function') {
            sheetSelectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        } catch (e) {
          // ignore scrolling errors
        }
      }, 120);
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
          serviceAccount: config.serviceAccount || null,
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

  const { animating, transitionTo } = useStepTransition(setCurrentStep, { delay: 700, setActiveTab, tabValue: 'columns' });

  const sheetSelectionRef = useRef(null);

  // Drag & drop state for service account upload
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleServiceAccountFile(file);
  };

  // Service account file upload handling
  const handleServiceAccountFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        updateConfig({ serviceAccount: parsed, serviceAccountFilename: file.name });
        toast.success('Service account loaded');
      } catch (err) {
        console.error('Invalid service account file', err);
        toast.error('Invalid JSON in service account file');
      }
    };
    reader.onerror = (err) => {
      console.error('File read error', err);
      toast.error('Failed to read service account file');
    };
    reader.readAsText(file);
  };

  const clearServiceAccount = () => {
    updateConfig({ serviceAccount: null, serviceAccountFilename: '' });
    toast.success('Service account cleared');
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
          {/* Service Account Instructions */}
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">📧 Service Account Setup Required</p>
                <p className="text-sm">
                  To sync your Google Sheets, please add this service account email to your spreadsheet with <strong>Editor</strong> permissions:
                </p>
                <div className="flex items-center gap-2">
                  <div className="bg-gray-100 p-2 rounded font-mono text-xs break-all">
                    {config.serviceAccountEmail || config.serviceAccount?.client_email || 'automate@bright-torus-466008-t9.iam.gserviceaccount.com'}
                  </div>
                  {/* Copy button for the service account email */}
                  <button
                    type="button"
                    className="px-2 py-1 bg-gray-200 rounded text-sm"
                    onClick={() => {
                      const email = config.serviceAccountEmail || config.serviceAccount?.client_email || 'automate@bright-torus-466008-t9.iam.gserviceaccount.com';
                      try {
                        navigator.clipboard.writeText(email);
                        toast.success('Service account email copied to clipboard');
                      } catch (err) {
                        console.error('Clipboard copy failed', err);
                        toast('Copy failed');
                      }
                    }}
                    aria-label="Copy service account email"
                  >
                    Copy
                  </button>
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
            {/* Service Account upload */}
            <div className="mb-3">
              <Label htmlFor="serviceAccount">Service Account JSON (optional)</Label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full border rounded p-4 flex items-center justify-between cursor-pointer transition-colors ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-dashed border-gray-300 bg-white'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <div className="font-medium">Drag & drop your service_account.json here</div>
                    <div className="text-xs text-gray-500">or click to browse</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    id="serviceAccount"
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => handleServiceAccountFile(e.target.files?.[0])}
                  />
                  {config.serviceAccountFilename ? (
                    <div className="text-sm text-gray-600">{config.serviceAccountFilename}</div>
                  ) : (
                    <div className="text-xs text-gray-400">No file selected</div>
                  )}
                  {config.serviceAccount && (
                    <button type="button" className="text-sm text-red-600 ml-2" onClick={clearServiceAccount}>Remove</button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Spreadsheet ID */}
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
            <div ref={sheetSelectionRef}>
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
                title={!config.worksheetName ? 'Please select a worksheet first' : 'Detect column headers from the selected worksheet'}
                className="w-full"
              >
                {detectingHeaders && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Detect Column Headers
              </Button>
            </div>
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
