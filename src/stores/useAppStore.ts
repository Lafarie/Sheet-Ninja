import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // Projects state
  projects: Project[];
  selectedProject: Project | null;
  
  // UI state
  isLoading: boolean;
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  
  // Actions
  setUser: (user: User | null) => void;
  setProjects: (projects: Project[]) => void;
  setSelectedProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      projects: [],
      selectedProject: null,
      isLoading: false,
      sidebarOpen: true,
      theme: 'system',

      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setProjects: (projects) => set({ projects }),
      
      setSelectedProject: (project) => set({ selectedProject: project }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      setTheme: (theme) => set({ theme }),
      
      addProject: (project) => set((state) => ({ 
        projects: [...state.projects, project] 
      })),
      
      updateProject: (id, updates) => set((state) => ({
        projects: state.projects.map(project => 
          project.id === id ? { ...project, ...updates } : project
        )
      })),
      
      deleteProject: (id) => set((state) => ({
        projects: state.projects.filter(project => project.id !== id),
        selectedProject: state.selectedProject?.id === id ? null : state.selectedProject
      })),
    }),
    {
      name: 'app-store',
    }
  )
);
