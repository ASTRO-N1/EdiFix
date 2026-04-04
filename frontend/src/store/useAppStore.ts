import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface EDIFile {
  file: File | null
  fileName: string
  fileType: string
  parseResult: Record<string, unknown> | null
}

export interface HistoryItem {
  id: string
  file_name: string
  file_type: string
  transaction_type: string | null
  parse_result: Record<string, unknown>
  created_at: string
}

export interface WorkspaceTab {
  id: string
  label: string
  type: 'form' | 'raw' | 'summary' | 'remittance' | 'roster'
  closable: boolean
}

export type ActivePanelView = 'explorer' | 'history'

interface AppState {
  session: Session | null
  setSession: (session: Session | null) => void
  authLoading: boolean
  setAuthLoading: (loading: boolean) => void

  ediFile: EDIFile
  setEdiFile: (file: File) => void
  clearFile: () => void

  historyItems: HistoryItem[]
  isHistoryLoading: boolean
  fetchHistory: () => Promise<void>
  saveCurrentWorkspace: () => Promise<void>
  loadWorkspace: (item: HistoryItem) => void
  deleteWorkspace: (id: string) => Promise<void>

  file: File | null
  setFile: (file: File) => void

  parseResult: Record<string, unknown> | null
  setParseResult: (result: Record<string, unknown> | null) => void

  transactionType: string | null
  setTransactionType: (type: string | null) => void

  isLoading: boolean
  setLoading: (loading: boolean) => void

  error: string | null
  setError: (error: string | null) => void

  // NEW: Global parsing action
  processFileInWorkspace: (file: File) => Promise<void>

  // Active section (for dashboard navigation)
  activeSection: string
  setActiveSection: (section: string) => void

  // ── Workspace IDE State ────────────────────────────────

  activeMainView: 'welcome' | 'dashboard' | 'editor' | 'export'
  setActiveMainView: (view: 'welcome' | 'dashboard' | 'editor' | 'export') => void

  activePanelView: ActivePanelView
  setActivePanelView: (view: ActivePanelView) => void
  isLeftSidebarOpen: boolean
  setIsLeftSidebarOpen: (isOpen: boolean) => void

  isAIPanelOpen: boolean
  setIsAIPanelOpen: (isOpen: boolean) => void
  isValidationDrawerOpen: boolean
  setIsValidationDrawerOpen: (isOpen: boolean) => void
  toggleValidationDrawer: () => void

  selectedPath: string | null
  setSelectedPath: (path: string | null) => void

  focusFieldId: string | null
  setFocusFieldId: (id: string | null) => void

  isSubmitting: boolean
  setIsSubmitting: (v: boolean) => void

  aiPromptContext: string | null
  setAiPromptContext: (ctx: string | null) => void

  openTabs: WorkspaceTab[]
  activeTabId: string
  setActiveTabId: (id: string) => void
  setOpenTabs: (tabs: WorkspaceTab[]) => void
  addTab: (tab: WorkspaceTab) => void
  closeTab: (id: string) => void
}

const DEFAULT_TABS: WorkspaceTab[] = [
  { id: 'form', label: 'Form View', type: 'form', closable: false },
  { id: 'raw', label: 'Raw EDI', type: 'raw', closable: true },
  { id: 'summary', label: 'Summary', type: 'summary', closable: true },
]

function detectFileType(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.includes('837')) return '837'
  if (lower.includes('835')) return '835'
  if (lower.includes('834')) return '834'
  return 'unknown'
}

const useAppStore = create<AppState>((set, get) => ({
  session: null,
  setSession: (session) => set({ session }),
  authLoading: true,
  setAuthLoading: (loading) => set({ authLoading: loading }),

  ediFile: { file: null, fileName: '', fileType: '', parseResult: null },
  setEdiFile: (file: File) =>
    set({
      ediFile: { file, fileName: file.name, fileType: detectFileType(file.name), parseResult: null },
    }),
  clearFile: () =>
    set({
      ediFile: { file: null, fileName: '', fileType: '', parseResult: null },
      file: null,
      parseResult: null,
      transactionType: null,
    }),


    historyItems: [],
  isHistoryLoading: false,

  fetchHistory: async () => {
    const session = get().session
    if (!session?.user?.id) return

    set({ isHistoryLoading: true })
    try {
      const { data, error } = await supabase
        .from('saved_workspaces')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ historyItems: data as HistoryItem[] })
    } catch (err) {
      console.error('Failed to fetch history:', err)
    } finally {
      set({ isHistoryLoading: false })
    }
  },

  saveCurrentWorkspace: async () => {
    const state = get()
    if (!state.session?.user?.id || !state.parseResult) {
      set({ error: 'No active session or data to save.' })
      return
    }

    set({ isLoading: true, error: null })
    try {
      const { error } = await supabase
        .from('saved_workspaces')
        .insert({
          user_id: state.session.user.id,
          file_name: state.ediFile.fileName || 'Untitled.edi',
          file_type: state.ediFile.fileType || 'unknown',
          transaction_type: state.transactionType,
          parse_result: state.parseResult,
        })

      if (error) throw error
      
      // Refresh history so the new item appears
      await state.fetchHistory()
    } catch (err: any) {
      set({ error: err.message })
      console.error('Save failed:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  loadWorkspace: (item: HistoryItem) => {
    set({
      ediFile: {
        file: null,
        fileName: item.file_name,
        fileType: item.file_type,
        parseResult: item.parse_result
      },
      parseResult: item.parse_result,
      transactionType: item.transaction_type,
      activeMainView: 'editor',
      selectedPath: null
    })
  },
  deleteWorkspace: async (id: string) => {
    try {
      const { error } = await supabase
        .from('saved_workspaces')
        .delete()
        .eq('id', id)
        
      if (error) throw error
      
      set((state) => ({
        historyItems: state.historyItems.filter((item) => item.id !== id)
      }))
    } catch (err) {
      console.error('Failed to delete workspace:', err)
    }
  },

  file: null,
  setFile: (file) => set({ file }),

  parseResult: null,
  setParseResult: (result) => set({ parseResult: result }),

  transactionType: null,
  setTransactionType: (type) => set({ transactionType: type }),

  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  error: null,
  setError: (error) => set({ error }),

  processFileInWorkspace: async (file: File) => {
    set({ isLoading: true, error: null })
    
    set({ 
      ediFile: { 
        file, 
        fileName: file.name, 
        fileType: detectFileType(file.name), 
        parseResult: null 
      }, 
      file 
    })
      try {
      const formData = new FormData()
      formData.append('file', file)

      const apiUrl = import.meta.env.VITE_API_URL || 'https://edi-parser-production.up.railway.app'
      
      const response = await fetch(`${apiUrl}/api/v1/parse`, {
        method: 'POST',
        headers: { 
          'X-Internal-Bypass': 'frontend-ui-secret' 
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to parse file')
      }
      
      const data = await response.json()
      
      set({ 
        parseResult: data, 
        transactionType: data.metadata?.transaction_type || data.transaction_type || detectFileType(file.name) 
      })
    } catch (err: any) {
      set({ error: err.message })
      console.error('Parsing failed:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  activeSection: 'overview',
  setActiveSection: (section) => set({ activeSection: section }),

  activeMainView: 'dashboard',
  setActiveMainView: (view) => set({ activeMainView: view }),

  activePanelView: 'explorer',
  setActivePanelView: (view) => set({ activePanelView: view }),
  isLeftSidebarOpen: true,
  setIsLeftSidebarOpen: (isOpen) => set({ isLeftSidebarOpen: isOpen }),

  isAIPanelOpen: true,
  setIsAIPanelOpen: (isOpen) => set({ isAIPanelOpen: isOpen }),

  isValidationDrawerOpen: true,
  setIsValidationDrawerOpen: (isOpen) => set({ isValidationDrawerOpen: isOpen }),
  toggleValidationDrawer: () => set((s) => ({ isValidationDrawerOpen: !s.isValidationDrawerOpen })),

  selectedPath: null,
  setSelectedPath: (path) => set({ selectedPath: path }),

  focusFieldId: null,
  setFocusFieldId: (id) => set({ focusFieldId: id }),

  isSubmitting: false,
  setIsSubmitting: (v) => set({ isSubmitting: v }),

  aiPromptContext: null,
  setAiPromptContext: (ctx) => set({ aiPromptContext: ctx }),

  openTabs: DEFAULT_TABS,
  activeTabId: 'form',
  setActiveTabId: (id) => set({ activeTabId: id }),
  setOpenTabs: (tabs) => set({ openTabs: tabs }),
  addTab: (tab) => {
    const existing = get().openTabs.find((t) => t.id === tab.id)
    if (!existing) set((s) => ({ openTabs: [...s.openTabs, tab] }))
    set({ activeTabId: tab.id })
  },
  closeTab: (id) => {
    const tabs = get().openTabs.filter((t) => t.id !== id)
    const activeId = get().activeTabId
    set({
      openTabs: tabs,
      activeTabId: activeId === id ? (tabs[0]?.id ?? '') : activeId,
    })
  },
}))

export default useAppStore