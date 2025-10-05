import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// Configuration store
export const useConfigStore = create(
  devtools(
    persist(
      (set, get) => ({
        // GitLab configuration
        gitlabUrl: 'https://sourcecontrol.hsenidmobile.com/api/v4/',
        gitlabToken: '',
        projectId: '',
        
        // Google Sheets configuration
        spreadsheetId: '',
        worksheetName: 'Sheet1',
        serviceAccount: null,
        serviceAccountFilename: '',
        serviceAccountEmail: '',
        sheetNames: [],
        
        // Default values
        defaultAssignee: '',
        defaultMilestone: '',
        defaultLabel: '',
        defaultEstimate: '8h',
        
        // Column mappings
        columnMappings: {},
        currentHeaders: [],
        currentMappings: {},
        autoMappings: {},
        
        // Project data
        projectData: { labels: [], milestones: [], assignees: [] },
        availableProjects: [],
        
        // Project mappings
        projectMappings: [],
        
        // Sync state
        syncRunning: false,
        syncProgress: 'idle',
        
        // UI state
        currentStep: 1,
        activeTab: 'gitlab',
        showDashboard: true,
        showSaveDialog: false,
        skipAutoLoad: false,
        
        // Actions
        updateConfig: (updates) => set((state) => ({ ...state, ...updates })),
        
        setCurrentStep: (step) => set({ currentStep: step }),
        setActiveTab: (tab) => set({ activeTab: tab }),
        
        setCurrentHeaders: (headers) => set({ currentHeaders: headers }),
        setCurrentMappings: (mappings) => set({ currentMappings: mappings }),
        setAutoMappings: (mappings) => set({ autoMappings: mappings }),
        
        setProjectMappings: (mappings) => set({ projectMappings: mappings }),
        
        setSyncRunning: (running) => set({ syncRunning: running }),
        setSyncProgress: (progress) => set({ syncProgress: progress }),
        
        setShowDashboard: (show) => set({ showDashboard: show }),
        setShowSaveDialog: (show) => set({ showSaveDialog: show }),
        setSkipAutoLoad: (skip) => set({ skipAutoLoad: skip }),
        
        // Reset functions
        resetConfig: () => set({
          gitlabUrl: 'https://sourcecontrol.hsenidmobile.com/api/v4/',
          gitlabToken: '',
          projectId: '',
          spreadsheetId: '',
          worksheetName: 'Sheet1',
          serviceAccount: null,
          serviceAccountFilename: '',
          serviceAccountEmail: '',
          sheetNames: [],
          defaultAssignee: '',
          defaultMilestone: '',
          defaultLabel: '',
          defaultEstimate: '8h',
          columnMappings: {},
          currentHeaders: [],
          currentMappings: {},
          autoMappings: {},
          projectData: { labels: [], milestones: [], assignees: [] },
          availableProjects: [],
          projectMappings: [],
          syncRunning: false,
          syncProgress: 'idle',
          currentStep: 1,
          activeTab: 'gitlab',
          showDashboard: true,
          showSaveDialog: false,
          skipAutoLoad: false,
        }),
        
        // Load saved configuration
        loadConfigFromSaved: (savedConfig) => set((state) => ({
          ...state,
          gitlabUrl: savedConfig.gitlabUrl,
          gitlabToken: savedConfig.gitlabToken,
          id: savedConfig.id,
          name: savedConfig.name,
          isDefault: savedConfig.isDefault,
          createdAt: savedConfig.createdAt,
          updatedAt: savedConfig.updatedAt,
          projectId: savedConfig.projectId || state.projectId || '',
          spreadsheetId: savedConfig.spreadsheetId,
          worksheetName: savedConfig.worksheetName,
          serviceAccount: savedConfig.serviceAccount || null,
          serviceAccountFilename: savedConfig.serviceAccountFilename || '',
          serviceAccountEmail: savedConfig.serviceAccountEmail || (savedConfig.serviceAccount?.client_email ?? ''),
          sheetNames: savedConfig.sheetNames || [],
          columnMappings: savedConfig.columnMappings || {},
          defaultAssignee: savedConfig.defaultAssignee,
          defaultMilestone: savedConfig.defaultMilestone,
          defaultLabel: savedConfig.defaultLabel,
          defaultEstimate: savedConfig.defaultEstimate,
        })),
      }),
      {
        name: 'config-store',
        partialize: (state) => ({
          gitlabUrl: state.gitlabUrl,
          defaultAssignee: state.defaultAssignee,
          defaultMilestone: state.defaultMilestone,
          defaultLabel: state.defaultLabel,
          defaultEstimate: state.defaultEstimate,
        }),
      }
    ),
    {
      name: 'config-store',
    }
  )
);

// Sync state store
export const useSyncStore = create(
  devtools(
    (set, get) => ({
      syncRunning: false,
      syncProgress: 'idle',
      currentSyncStep: 0,
      syncOutput: '',
      completionAnnounced: false,
      
      // Actions
      setSyncRunning: (running) => set({ syncRunning: running }),
      setSyncProgress: (progress) => set({ syncProgress: progress }),
      setCurrentSyncStep: (step) => set({ currentSyncStep: step }),
      setSyncOutput: (output) => set({ syncOutput: output }),
      setCompletionAnnounced: (announced) => set({ completionAnnounced: announced }),
      
      resetSync: () => set({
        syncRunning: false,
        syncProgress: 'idle',
        currentSyncStep: 0,
        syncOutput: '',
        completionAnnounced: false,
      }),
    }),
    {
      name: 'sync-store',
    }
  )
);
