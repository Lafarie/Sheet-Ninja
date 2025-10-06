import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface GitLabConfig {
  url: string;
  token: string;
  projects: Array<{
    id: string;
    name: string;
    name_with_namespace: string;
    description?: string;
    visibility?: string;
    last_activity_at?: string;
    web_url?: string;
  }>;
}

export interface SheetsConfig {
  spreadsheetId: string;
  worksheetName: string;
  serviceAccount: any;
  serviceAccountEmail: string;
  sheetNames: string[];
  headers: string[];
}

export interface ColumnMapping {
  [key: string]: string;
}

export interface ProjectMapping {
  id: string;
  projectName: string;
  projectId: string;
  milestone: string;
  labels: string[];
  estimate: string;
  projectData: {
    labels: Array<{ id: string; name: string; color: string }>;
    milestones: Array<{ id: string; title: string }>;
    assignees: Array<{ username: string; name: string }>;
  };
}

export interface SyncConfig {
  startDate?: string;
  endDate?: string;
  checkStatusBeforeClose: boolean;
  enableDateFilter: boolean;
}

export interface SetupState {
  // Current step (1-5)
  currentStep: number;
  activeTab: string;
  
  // GitLab configuration
  gitlab: GitLabConfig;
  
  // Google Sheets configuration
  sheets: SheetsConfig;
  
  // Column mappings
  columnMappings: ColumnMapping;
  
  // Project mappings
  projectMappings: ProjectMapping[];
  
  // Sync configuration
  syncConfig: SyncConfig;
  
  // UI state
  loading: {
    gitlab: boolean;
    sheets: boolean;
    headers: boolean;
    projects: boolean;
    sync: boolean;
  };
  
  // Actions
  setCurrentStep: (step: number) => void;
  setActiveTab: (tab: string) => void;
  
  // GitLab actions
  updateGitLab: (config: Partial<GitLabConfig>) => void;
  setGitLabProjects: (projects: GitLabConfig['projects']) => void;
  setGitLabLoading: (loading: boolean) => void;
  
  // Sheets actions
  updateSheets: (config: Partial<SheetsConfig>) => void;
  setSheetNames: (names: string[]) => void;
  setHeaders: (headers: string[]) => void;
  setSheetsLoading: (loading: boolean) => void;
  setHeadersLoading: (loading: boolean) => void;
  
  // Column mapping actions
  updateColumnMapping: (key: string, value: string) => void;
  setColumnMappings: (mappings: ColumnMapping) => void;
  
  // Project mapping actions
  addProjectMapping: (mapping: ProjectMapping) => void;
  updateProjectMapping: (id: string, updates: Partial<ProjectMapping>) => void;
  removeProjectMapping: (id: string) => void;
  setProjectMappings: (mappings: ProjectMapping[]) => void;
  setProjectsLoading: (loading: boolean) => void;
  
  // Sync actions
  updateSyncConfig: (config: Partial<SyncConfig>) => void;
  setSyncLoading: (loading: boolean) => void;
  
  // Reset actions
  resetSetup: () => void;
  resetStep: (step: number) => void;
}

const defaultGitLab: GitLabConfig = {
  url: 'https://sourcecontrol.hsenidmobile.com/api/v4/',
  token: '',
  projects: [],
};

const defaultSheets: SheetsConfig = {
  spreadsheetId: '',
  worksheetName: 'Sheet1',
  serviceAccount: null,
  serviceAccountEmail: '',
  sheetNames: [],
  headers: [],
};

const defaultSyncConfig: SyncConfig = {
  checkStatusBeforeClose: false,
  enableDateFilter: false,
};

export const useSetupStore = create<SetupState>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentStep: 1,
      activeTab: 'gitlab',
      
      gitlab: defaultGitLab,
      sheets: defaultSheets,
      columnMappings: {},
      projectMappings: [],
      syncConfig: defaultSyncConfig,
      
      loading: {
        gitlab: false,
        sheets: false,
        headers: false,
        projects: false,
        sync: false,
      },

      // Step management
      setCurrentStep: (step) => set({ currentStep: step }),
      setActiveTab: (tab) => set({ activeTab: tab }),

      // GitLab actions
      updateGitLab: (config) => set((state) => ({
        gitlab: { ...state.gitlab, ...config }
      })),
      setGitLabProjects: (projects) => set((state) => ({
        gitlab: { ...state.gitlab, projects }
      })),
      setGitLabLoading: (loading) => set((state) => ({
        loading: { ...state.loading, gitlab: loading }
      })),

      // Sheets actions
      updateSheets: (config) => set((state) => ({
        sheets: { ...state.sheets, ...config }
      })),
      setSheetNames: (names) => set((state) => ({
        sheets: { ...state.sheets, sheetNames: names }
      })),
      setHeaders: (headers) => set((state) => ({
        sheets: { ...state.sheets, headers }
      })),
      setSheetsLoading: (loading) => set((state) => ({
        loading: { ...state.loading, sheets: loading }
      })),
      setHeadersLoading: (loading) => set((state) => ({
        loading: { ...state.loading, headers: loading }
      })),

      // Column mapping actions
      updateColumnMapping: (key, value) => set((state) => ({
        columnMappings: { ...state.columnMappings, [key]: value }
      })),
      setColumnMappings: (mappings) => set({ columnMappings: mappings }),

      // Project mapping actions
      addProjectMapping: (mapping) => set((state) => ({
        projectMappings: [...state.projectMappings, mapping]
      })),
      updateProjectMapping: (id, updates) => set((state) => ({
        projectMappings: state.projectMappings.map(mapping =>
          mapping.id === id ? { ...mapping, ...updates } : mapping
        )
      })),
      removeProjectMapping: (id) => set((state) => ({
        projectMappings: state.projectMappings.filter(mapping => mapping.id !== id)
      })),
      setProjectMappings: (mappings) => set({ projectMappings: mappings }),
      setProjectsLoading: (loading) => set((state) => ({
        loading: { ...state.loading, projects: loading }
      })),

      // Sync actions
      updateSyncConfig: (config) => set((state) => ({
        syncConfig: { ...state.syncConfig, ...config }
      })),
      setSyncLoading: (loading) => set((state) => ({
        loading: { ...state.loading, sync: loading }
      })),

      // Reset actions
      resetSetup: () => set({
        currentStep: 1,
        activeTab: 'gitlab',
        gitlab: defaultGitLab,
        sheets: defaultSheets,
        columnMappings: {},
        projectMappings: [],
        syncConfig: defaultSyncConfig,
        loading: {
          gitlab: false,
          sheets: false,
          headers: false,
          projects: false,
          sync: false,
        },
      }),
      
      resetStep: (step) => {
        const state = get();
        switch (step) {
          case 1:
            set({ gitlab: defaultGitLab });
            break;
          case 2:
            set({ sheets: defaultSheets });
            break;
          case 3:
            set({ columnMappings: {} });
            break;
          case 4:
            set({ projectMappings: [] });
            break;
          case 5:
            set({ syncConfig: defaultSyncConfig });
            break;
        }
      },
    }),
    {
      name: 'setup-store',
    }
  )
);
