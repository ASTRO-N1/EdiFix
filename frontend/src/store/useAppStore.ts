import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface BatchValidationResult {
  fileName: string
  status: 'Valid' | 'Invalid'
  errorCount: number
  data: Record<string, unknown> | null
}

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
  type: 'form' | 'raw' | 'summary' | 'remittance' | 'roster' | 'audit'
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

  processFileInWorkspace: (file: File) => Promise<void>

  batchResults: BatchValidationResult[] | null
  processBatchZip: (zipFile: File, unzippedFiles: File[]) => Promise<void>

  activeSection: string
  setActiveSection: (section: string) => void

  // Added 'batch' to main views
  activeMainView: 'welcome' | 'dashboard' | 'editor' | 'export' | 'reconcile' | 'change-report' | 'eligibility-scrubber' | 'batch'
  setActiveMainView: (view: 'welcome' | 'dashboard' | 'editor' | 'export' | 'reconcile' | 'change-report' | 'eligibility-scrubber' | 'batch') => void

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

  auditParsed837: Record<string, unknown> | null
  setAuditParsed837: (data: Record<string, unknown> | null) => void
  auditParsed835: Record<string, unknown> | null
  setAuditParsed835: (data: Record<string, unknown> | null) => void
  reconciliationResult: Record<string, unknown> | null
  setReconciliationResult: (data: Record<string, unknown> | null) => void
  isReconciling: boolean
  setIsReconciling: (v: boolean) => void
  isReconcileModalOpen: boolean
  setIsReconcileModalOpen: (v: boolean) => void

  eligibilityScrubberResult: Record<string, unknown> | null
  setEligibilityScrubberResult: (data: Record<string, unknown> | null) => void

  openTabs: WorkspaceTab[]
  activeTabId: string
  setActiveTabId: (id: string) => void
  setOpenTabs: (tabs: WorkspaceTab[]) => void
  addTab: (tab: WorkspaceTab) => void
  closeTab: (id: string) => void

  changeReport834Result: Record<string, unknown> | null
  setChangeReport834Result: (data: Record<string, unknown> | null) => void
  isChangeReport834Loading: boolean
  setIsChangeReport834Loading: (v: boolean) => void

  fixSuggestions: Record<string, any>[]
  setFixSuggestions: (suggestions: Record<string, any>[]) => void
  pendingFix: Record<string, any> | null
  setPendingFix: (fix: Record<string, any> | null) => void
  fixHistory: Array<{ before: Record<string, unknown>; after: Record<string, unknown>; suggestion: Record<string, any> }>
  pushFixHistory: (entry: { before: Record<string, unknown>; after: Record<string, unknown>; suggestion: Record<string, any> }) => void

  fetchFixSuggestions: () => Promise<void>
  applyFix: (suggestion: Record<string, any>) => Promise<void>
  acceptFix: () => void
  rejectFix: () => void
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
      batchResults: null,
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
        headers: { 'X-Internal-Bypass': 'frontend-ui-secret' },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Failed to parse file')
      }

      const data = await response.json()

      const innerTree = data.parsed_data || data.data || data
      const txnType = innerTree?.metadata?.transaction_type || data.transaction_type || detectFileType(file.name)

      set({
        parseResult: innerTree,
        transactionType: txnType,
        activeMainView: 'editor',
      })
    } catch (err: any) {
      set({ error: err.message })
      console.error('Parsing failed:', err)
    } finally {
      set({ isLoading: false })
    }
  },

  batchResults: null,

  processBatchZip: async (zipFile: File, unzippedFiles: File[]) => {
    const state = get();
    // Move to full page view 'batch'
    set({ isLoading: true, error: null, batchResults: null });
    state.setActiveMainView('batch');

    const results: BatchValidationResult[] = [];
    const apiUrl = import.meta.env.VITE_API_URL || 'https://edi-parser-production.up.railway.app';

    for (const file of unzippedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${apiUrl}/api/v1/parse`, {
          method: 'POST',
          headers: { 'X-Internal-Bypass': 'frontend-ui-secret' },
          body: formData,
        });

        if (!response.ok) throw new Error('Parse failed');

        const data = await response.json();
        const innerTree = data.parsed_data || data.data || data;
        const errors = innerTree.errors || data.errors || [];
        const errorCount = errors.length;

        results.push({
          fileName: file.name,
          status: errorCount === 0 ? 'Valid' : 'Invalid',
          errorCount: errorCount,
          data: innerTree,
        });
      } catch (err) {
        results.push({
          fileName: file.name,
          status: 'Invalid',
          errorCount: -1,
          data: null,
        });
      }
    }

    set({ batchResults: results, isLoading: false });
  },

  activeSection: 'overview',
  setActiveSection: (section) => set({ activeSection: section }),

  activeMainView: 'welcome',
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

  auditParsed837: null,
  setAuditParsed837: (data) => set({ auditParsed837: data }),
  auditParsed835: null,
  setAuditParsed835: (data) => set({ auditParsed835: data }),
  reconciliationResult: null,
  setReconciliationResult: (data) => set({ reconciliationResult: data }),
  isReconciling: false,
  setIsReconciling: (v) => set({ isReconciling: v }),
  isReconcileModalOpen: false,
  setIsReconcileModalOpen: (v) => set({ isReconcileModalOpen: v }),

  eligibilityScrubberResult: null,
  setEligibilityScrubberResult: (data) => set({ eligibilityScrubberResult: data }),

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

  changeReport834Result: null,
  setChangeReport834Result: (data) => set({ changeReport834Result: data }),
  isChangeReport834Loading: false,
  setIsChangeReport834Loading: (v) => set({ isChangeReport834Loading: v }),

  fixSuggestions: [],
  setFixSuggestions: (suggestions) => set({ fixSuggestions: suggestions }),
  pendingFix: null,
  setPendingFix: (fix) => set({ pendingFix: fix }),
  fixHistory: [],
  pushFixHistory: (entry) => set((s) => ({ fixHistory: [...s.fixHistory, entry] })),

  fetchFixSuggestions: async () => {
    const state = get()
    if (!state.parseResult) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

    try {
      const res = await fetch(`${apiUrl}/api/v1/suggest-fixes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Bypass': 'frontend-ui-secret',
        },
        body: JSON.stringify({ parse_result: state.parseResult }),
      })

      const json = await res.json()

      if (json.status === 'success' && json.suggestions) {
        set({ fixSuggestions: json.suggestions })
      }
    } catch (err) {
      console.error('Failed to fetch fix suggestions:', err)
    }
  },

  applyFix: async (suggestion: Record<string, any>) => {
    const state = get()
    if (!state.parseResult) return

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

    const before = structuredClone(state.parseResult)

    try {
      const res = await fetch(`${apiUrl}/api/v1/apply-fix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Bypass': 'frontend-ui-secret',
        },
        body: JSON.stringify({
          parse_result: state.parseResult,
          suggestion: suggestion,
        }),
      })

      const json = await res.json()

      if (json.status === 'success' && json.updated_parse_result) {
        const after = json.updated_parse_result

        set({ parseResult: after, pendingFix: suggestion })
        state.pushFixHistory({ before, after, suggestion })

        const aiMsg = `✓ **Fix Applied: ${suggestion.fix_type}**\n\n` +
          `**Field**: ${suggestion.loop_key} · ${suggestion.segment_key} · ${suggestion.element_key}\n` +
          `**Before**: \`${suggestion.current_value}\`\n` +
          `**After**: \`${suggestion.suggested_value}\`\n\n` +
          `**Reason**: ${suggestion.reason}\n\n` +
          `*Use the buttons below to accept or reject this fix.*`

        set({ aiPromptContext: aiMsg, isAIPanelOpen: true })
      }
    } catch (err) {
      console.error('Failed to apply fix:', err)
      set({
        aiPromptContext: `❌ **Fix Failed**\n\nCould not apply the fix. Error: ${(err as Error).message}`,
        isAIPanelOpen: true
      })
    }
  },

  acceptFix: () => {
    const state = get()
    if (!state.pendingFix) return

    set({
      pendingFix: null,
      aiPromptContext: `✅ **Fix Accepted**\n\nThe correction has been saved. Run validation again to see updated error count.`,
    })
  },

  rejectFix: () => {
    const state = get()
    if (!state.pendingFix || state.fixHistory.length === 0) return

    const lastEntry = state.fixHistory[state.fixHistory.length - 1]
    set({
      parseResult: lastEntry.before,
      pendingFix: null,
      fixHistory: state.fixHistory.slice(0, -1),
      aiPromptContext: `❌ **Fix Rejected**\n\nReverted to original value. The change has been undone.`,
    })
  },
}))

export default useAppStore