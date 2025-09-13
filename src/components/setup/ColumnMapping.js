import { useState, useEffect, useRef } from 'react';
import { useStepTransition } from './useStepTransition';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Columns, Wand2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ColumnMapping({ 
  config,
  currentHeaders,
  currentMappings,
  setCurrentMappings,
  autoMappings,
  setAutoMappings,
  defaultConfig,
  setCurrentStep,
  setActiveTab
}) {
  const [mappingComplete, setMappingComplete] = useState(false);

  const findBestMatch = (targetHeader, headers) => {
    const targetLower = targetHeader.toLowerCase().trim();
    
    // First, try exact matches
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].toLowerCase().trim() === targetLower) {
        return i + 1; // 1-based index
      }
    }
    
    // Then, try more specific partial matches for date-related fields
    for (let i = 0; i < headers.length; i++) {
      const headerLower = headers[i].toLowerCase().trim();
      
      // Special cases for common variations
      if (targetLower.includes('date') && headerLower.includes('date')) return i + 1;
      if (targetLower.includes('project') && headerLower.includes('project')) return i + 1;
      if (targetLower.includes('task') && headerLower.includes('task')) return i + 1;
      if (targetLower.includes('status') && headerLower.includes('status')) return i + 1;
      if (targetLower.includes('estimation') && (headerLower.includes('estimation') || headerLower.includes('hours'))) return i + 1;
      if (targetLower.includes('git') && (headerLower.includes('git') || headerLower.includes('id'))) return i + 1;
    }
    
    return null;
  };

  const autoMapColumns = () => {
    if (currentHeaders.length === 0) {
      toast.error('No headers detected. Please detect headers from sheet first.');
      return;
    }
    
    const newAutoMappings = {};
    
    Object.keys(defaultConfig).forEach(key => {
      const targetHeader = defaultConfig[key].header;
      const matchIndex = findBestMatch(targetHeader, currentHeaders);
      if (matchIndex) {
        newAutoMappings[key] = matchIndex.toString();
      }
    });
    
    setAutoMappings(newAutoMappings);
    
    // Update current mappings with auto mappings
    setCurrentMappings(prev => ({ ...prev, ...newAutoMappings }));
    
    const mappedCount = Object.keys(newAutoMappings).length;
    const totalOptional = Object.keys(defaultConfig).filter(key => !defaultConfig[key].required).length;
    const unmappedOptional = Object.keys(defaultConfig).filter(key => 
      !defaultConfig[key].required && !newAutoMappings[key]
    ).length;
    
    let message = `Auto-mapped ${mappedCount} columns`;
    if (unmappedOptional > 0) {
      message += `. ${unmappedOptional} optional columns remain unmapped.`;
    }
    
    toast.success(message);
  };

  // Ref for the auto-map button so we can scroll to it and apply a glow effect
  const autoMapBtnRef = useRef(null);
  const [glowActive, setGlowActive] = useState(false);
  // Banner state for saved mappings from DB
  const [showSavedBanner, setShowSavedBanner] = useState(true);

  // Detect saved mappings provided in the config (from DB)
  const savedMappings = config?.columnMappings || {};
  const savedMappingsCount = Object.keys(savedMappings).filter(k => savedMappings[k] && savedMappings[k] !== '').length;
  const hasSavedMappings = savedMappingsCount > 0;

  // Inject CSS for gold glow animation once
  const ensureGlowStyles = () => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('gold-glow-styles')) return;
    const style = document.createElement('style');
    style.id = 'gold-glow-styles';
    style.innerHTML = `
      @keyframes goldPulse {
        0% { box-shadow: 0 0 0 0 rgba(255,215,0,0.85); }
        50% { box-shadow: 0 0 20px 8px rgba(255,215,0,0.6); }
        100% { box-shadow: 0 0 0 0 rgba(255,215,0,0.85); }
      }
      .gold-glow {
        animation: goldPulse 1.2s ease-in-out infinite;
        border-color: #f6c200 !important;
      }
    `;
    document.head.appendChild(style);
  };

  const triggerGlow = (duration = 3000) => {
    ensureGlowStyles();
    setGlowActive(true);
    window.setTimeout(() => setGlowActive(false), duration);
  };

  // On mount: scroll to the auto-map button and show the glow for a few seconds
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // wait a tick for layout
    const t = setTimeout(() => {
      try {
        if (autoMapBtnRef.current && typeof autoMapBtnRef.current.scrollIntoView === 'function') {
          autoMapBtnRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        triggerGlow(3600);
      } catch (e) {
        // ignore
      }
    }, 120);
    return () => clearTimeout(t);
  }, []);

  const applySavedMappings = () => {
    if (!hasSavedMappings) return;
    setCurrentMappings(savedMappings);
    setAutoMappings({});
    setShowSavedBanner(false);
    toast.success(`Applied ${savedMappingsCount} saved mappings from database`);
  };

  // If saved mappings exist and the current mappings are empty, auto-load them
  useEffect(() => {
    const mappingsEmpty = Object.keys(defaultConfig).every(k => !currentMappings || !currentMappings[k] || currentMappings[k] === '');
    if (hasSavedMappings && mappingsEmpty) {
      // apply silently so the user sees the mapping preview without needing to click
      setCurrentMappings(savedMappings);
      setAutoMappings({});
      // keep the banner visible so user can dismiss if desired
    }
    // only run when savedMappings or currentMappings change
  }, [savedMappings, currentMappings]);

  const updateMapping = (key, value) => {
    const actualValue = value === 'none' ? '' : value;
    setCurrentMappings(prev => ({ ...prev, [key]: actualValue }));
    
    if (actualValue && autoMappings[key]) {
      // Remove from auto mappings if manually changed
      setAutoMappings(prev => {
        const newAutoMappings = { ...prev };
        delete newAutoMappings[key];
        return newAutoMappings;
      });
    }
  };

  const validateMappings = () => {
    const requiredFields = Object.keys(defaultConfig).filter(key => defaultConfig[key].required);
    const missingRequired = requiredFields.filter(key => !currentMappings[key] || currentMappings[key] === '');
    
    if (missingRequired.length > 0) {
      toast.error(`Please map required fields: ${missingRequired.map(key => defaultConfig[key].header).join(', ')}`);
      return false;
    }
    
    setMappingComplete(true);
    toast.success('Column mapping complete!');
    // Wait a moment and smoothly transition to Project Mapping
    transitionTo(4);
    return true;
  };

  const { animating, transitionTo } = useStepTransition(setCurrentStep, { delay: 700, setActiveTab, tabValue: 'projects' });

  const getColumnStatus = (key) => {
    const isRequired = defaultConfig[key].required;
    const isMapped = currentMappings[key] && currentMappings[key] !== '';
    const isAutoMapped = autoMappings[key];
    
    if (isMapped && isAutoMapped) return 'auto-mapped';
    if (isMapped) return 'manual';
    if (isRequired) return 'required-missing';
    return 'optional-missing';
  };

  const getStatusBadge = (status) => {
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

  if (currentHeaders.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          {/* Saved mappings banner (from DB) - show even when headers missing */}
          {hasSavedMappings && showSavedBanner && (
            <div className="p-3 rounded-lg border border-gray-200 bg-yellow-50 flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-medium text-yellow-800">Saved column mappings found</div>
                <div className="text-xs text-yellow-700">{savedMappingsCount} mappings were saved with this configuration.</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={applySavedMappings} className="bg-yellow-600 text-white hover:bg-yellow-700">Apply</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSavedBanner(false)}>Dismiss</Button>
              </div>
            </div>
          )}

          <div className="text-center py-8">
            <Columns className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No column headers detected.</p>
            <p className="text-sm text-gray-500">Please complete the Google Sheets configuration first.</p>
          </div>
          {/* If saved mappings exist, show a preview list and summary so user can inspect before fetching headers */}
          {hasSavedMappings && (
            <div className="mt-4">
              <div className="text-sm font-medium text-gray-800 mb-2">Saved mapping preview</div>
              <div className="bg-white rounded-md border p-3 space-y-3">
                {Object.keys(defaultConfig).map((key) => {
                  const mapped = savedMappings[key];
                  if (!mapped) return null;
                  const fieldConfig = defaultConfig[key];
                  return (
                    <div key={key} className="pb-2 border-b last:border-b-0">
                      <div className="text-sm font-medium">Column {mapped}: {fieldConfig.header}</div>
                      <div className="text-xs text-gray-500">{fieldConfig.description}</div>
                    </div>
                  );
                })}

                <div className="mt-3 pt-2 border-t">
                  <div className="text-xs text-gray-600">
                    <div>Required Fields: {Object.keys(defaultConfig).filter(k => defaultConfig[k].required && savedMappings[k]).length} / {Object.keys(defaultConfig).filter(k => defaultConfig[k].required).length}</div>
                    <div>Optional Fields: {Object.keys(defaultConfig).filter(k => !defaultConfig[k].required && savedMappings[k]).length} / {Object.keys(defaultConfig).filter(k => !defaultConfig[k].required).length}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
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

          {/* Saved mappings banner (from DB) */}
          {hasSavedMappings && showSavedBanner && (
            <div className="p-3 rounded-lg border border-gray-200 bg-yellow-50 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-yellow-800">Saved column mappings found</div>
                <div className="text-xs text-yellow-700">{savedMappingsCount} mappings were saved with this configuration.</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={applySavedMappings} className="bg-yellow-600 text-white hover:bg-yellow-700">Apply</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowSavedBanner(false)}>Dismiss</Button>
              </div>
            </div>
          )}
          

          {/* Headers detected info */}
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-sm font-medium text-blue-900">
              Detected {currentHeaders.length} columns:
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {currentHeaders.map((header, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {index + 1}: {header}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Column mappings */}
          <div className="space-y-4">
            {Object.keys(defaultConfig).map((key) => {
              const fieldConfig = defaultConfig[key];
              const status = getColumnStatus(key);
              
              return (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      {fieldConfig.header}
                      {fieldConfig.required && <span className="text-red-500">*</span>}
                      {getStatusBadge(status)}
                    </Label>
                  </div>
                  
                  <Select
                    value={currentMappings[key] === '' || !currentMappings[key] ? 'none' : currentMappings[key]}
                    onValueChange={(value) => updateMapping(key, value)}
                  >
                    <SelectTrigger className={
                      status === 'required-missing' ? 'border-red-300' : ''
                    }>
                      <SelectValue placeholder="Select column..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No mapping</SelectItem>
                      {currentHeaders.map((header, index) => (
                        <SelectItem key={index} value={(index + 1).toString()}>
                          Column {index + 1}: {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <p className="text-xs text-gray-500">
                    {fieldConfig.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Mapping summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Mapping Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Required Fields:</span>
                <span className="ml-2 font-medium">
                  {Object.keys(defaultConfig).filter(key => 
                    defaultConfig[key].required && currentMappings[key]
                  ).length} / {Object.keys(defaultConfig).filter(key => defaultConfig[key].required).length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Optional Fields:</span>
                <span className="ml-2 font-medium">
                  {Object.keys(defaultConfig).filter(key => 
                    !defaultConfig[key].required && currentMappings[key]
                  ).length} / {Object.keys(defaultConfig).filter(key => !defaultConfig[key].required).length}
                </span>
              </div>
            </div>
          </div>

          {/* Auto-mapping button */}
          <Button 
            ref={autoMapBtnRef}
            onClick={() => { autoMapColumns(); triggerGlow(1800); }}
            className={`w-full ${glowActive ? 'gold-glow' : ''}`}
            variant="outline"
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Auto-Map Columns
          </Button>

          <Button onClick={validateMappings} className="w-full">
            <CheckCircle className="mr-2 h-4 w-4" />
            Validate Column Mapping
          </Button>
        </CardContent>
      </Card>

      {mappingComplete && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            ✅ Column mapping is complete! You can now generate configuration files.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
