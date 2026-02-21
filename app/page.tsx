'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { callAIAgent, AIAgentResponse } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  FiFileText,
  FiEdit3,
  FiBook,
  FiDownload,
  FiCopy,
  FiSearch,
  FiFilter,
  FiClock,
  FiHash,
  FiChevronRight,
  FiPlus,
  FiEye,
  FiArrowLeft,
  FiLoader,
  FiX
} from 'react-icons/fi'

// ---- Constants ----

const JOURNAL_COORDINATOR_ID = '699961f1a63b170a3b817102'

const FRAMEWORKS = [
  { value: 'gibbs', label: 'Gibbs Reflective Cycle', description: 'A structured six-stage model: Description, Feelings, Evaluation, Analysis, Conclusion, and Action Plan. Ideal for exploring experiences comprehensively.' },
  { value: 'kolb', label: "Kolb's Experiential Learning", description: 'A four-stage cycle: Concrete Experience, Reflective Observation, Abstract Conceptualization, and Active Experimentation. Best for linking theory to practice.' },
  { value: 'driscoll', label: "Driscoll's What Model", description: 'Three simple questions: What? So what? Now what? An accessible framework ideal for quick, focused reflections.' },
  { value: 'schon', label: "Schon's Reflection", description: 'Distinguishes reflection-in-action (during the experience) from reflection-on-action (after the experience). Suited to professional practice.' },
  { value: 'custom', label: 'Custom Framework', description: 'Provide your own reflective structure. The assistant will adapt the journal to your specified approach.' },
]

const SAMPLE_DATA = {
  framework: 'gibbs',
  topic: 'Interprofessional Collaboration in Healthcare',
  experience: 'During my clinical placement at City General Hospital, I was part of a multidisciplinary team managing a complex patient case involving diabetes management. I worked alongside nurses, pharmacists, and a dietitian to create a comprehensive care plan. The patient was a 67-year-old male with uncontrolled Type 2 diabetes and multiple comorbidities.',
  challenges: 'The biggest challenge was communication gaps between team members. Different departments used different documentation systems, which led to information silos. I also struggled with confidence when presenting my assessment findings to senior clinicians during ward rounds. Time pressure made it difficult to have thorough team discussions.',
  skills: 'I developed stronger clinical reasoning skills by analyzing lab results and correlating them with patient symptoms. My communication skills improved significantly through daily handover reports. I also learned to use the hospital electronic health record system effectively and gained experience in patient education techniques.',
  emotions: 'Initially, I felt overwhelmed and anxious about working in such a fast-paced environment. There were moments of self-doubt, especially when I made a documentation error in the first week. However, as the placement progressed, I felt increasingly confident and even experienced pride when the patient showed improvement. The supportive team environment helped ease my anxiety.',
  insights: 'I realized that effective healthcare delivery depends heavily on interprofessional collaboration and clear communication channels. The experience highlighted the gap between theoretical knowledge from lectures and the complexity of real-world clinical practice. I also understood the importance of patient-centered care rather than purely clinical approaches.',
  future: 'Going forward, I plan to actively seek out interprofessional learning opportunities. I will practice assertive communication techniques before my next placement. I also intend to volunteer for patient education sessions to strengthen my skills in that area. Additionally, I will maintain a reflective journal throughout future placements to track my development.',
  wordCount: 2100,
}

// ---- Interfaces ----

interface JournalSection {
  heading: string
  content: string
}

interface JournalData {
  framework: string
  topic: string
  word_count: number
  sections: JournalSection[]
  full_journal: string
}

interface ArtifactFile {
  file_url: string
  name?: string
  format_type?: string
}

interface GeneratedJournal extends JournalData {
  artifactFiles: ArtifactFile[]
}

interface JournalEntry {
  id: string
  framework: string
  topic: string
  word_count: number
  sections: JournalSection[]
  full_journal: string
  artifact_files: ArtifactFile[]
  created_at: string
  inputs: {
    experience: string
    challenges: string
    skills: string
    emotions: string
    insights: string
    future: string
    wordCount: number
  }
}

// ---- Helpers ----

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-serif font-semibold text-sm mt-3 mb-1 tracking-tight">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-serif font-semibold text-base mt-3 mb-1 tracking-tight">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-serif font-bold text-lg mt-4 mb-2 tracking-tight">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm leading-relaxed">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function getFrameworkLabel(value: string): string {
  const fw = FRAMEWORKS.find((f) => f.value === value)
  return fw?.label ?? value
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function countWords(text: string): number {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

// ---- ErrorBoundary ----

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-none text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ---- Sub-components ----

function FrameworkDescription({ value }: { value: string }) {
  const fw = FRAMEWORKS.find((f) => f.value === value)
  if (!fw) return null
  return (
    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{fw.description}</p>
  )
}

function CharCount({ text, max }: { text: string; max?: number }) {
  const count = text.length
  return (
    <span className="text-xs text-muted-foreground">
      {count}{max ? ` / ${max}` : ''} chars
    </span>
  )
}

function StatusMessage({ message, type }: { message: string; type: 'success' | 'error' | 'info' }) {
  if (!message) return null
  const colorClass =
    type === 'success'
      ? 'text-green-700 bg-green-50 border-green-200'
      : type === 'error'
        ? 'text-red-700 bg-red-50 border-red-200'
        : 'text-muted-foreground bg-muted border-border'
  return (
    <div className={`px-4 py-2 border text-sm rounded-none ${colorClass}`}>
      {message}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 lg:p-8 bg-muted/50">
      <div className="bg-white border border-border mx-auto" style={{ maxWidth: '720px', minHeight: '600px' }}>
        {/* Simulated header bar */}
        <div className="border-b border-border px-8 py-2 bg-secondary/30">
          <Skeleton className="h-3 w-24 rounded-none" />
        </div>
        {/* Simulated title area */}
        <div className="px-10 pt-12 pb-8 text-center border-b border-border">
          <div className="flex items-center justify-center gap-3 mb-6">
            <FiLoader className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-sans tracking-tight animate-pulse">
              Crafting your reflective journal...
            </span>
          </div>
          <Skeleton className="h-8 w-3/5 mx-auto rounded-none mb-4" />
          <Skeleton className="h-4 w-1/4 mx-auto rounded-none mb-1" />
          <Skeleton className="h-4 w-1/5 mx-auto rounded-none" />
        </div>
        {/* Simulated body sections */}
        <div className="px-10 py-8 space-y-8">
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/5 rounded-none" />
            <Skeleton className="h-4 w-full rounded-none" />
            <Skeleton className="h-4 w-full rounded-none" />
            <Skeleton className="h-4 w-4/5 rounded-none" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3 rounded-none" />
            <Skeleton className="h-4 w-full rounded-none" />
            <Skeleton className="h-4 w-full rounded-none" />
            <Skeleton className="h-4 w-3/5 rounded-none" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-6 w-2/5 rounded-none" />
            <Skeleton className="h-4 w-full rounded-none" />
            <Skeleton className="h-4 w-full rounded-none" />
            <Skeleton className="h-4 w-4/5 rounded-none" />
            <Skeleton className="h-4 w-2/3 rounded-none" />
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyOutputState() {
  return (
    <div className="p-6 lg:p-8 bg-muted/50 h-full flex items-center justify-center">
      <div className="bg-white border border-border mx-auto text-center py-20 px-12" style={{ maxWidth: '720px' }}>
        <FiEdit3 className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-serif font-bold text-lg tracking-tight mb-2">Your Journal Awaits</h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto mb-6">
          Fill in your reflections on the left and click Generate to create a structured academic reflective journal.
        </p>
        <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FiFileText className="h-3.5 w-3.5" />
            Academic Format
          </span>
          <span className="flex items-center gap-1.5">
            <FiBook className="h-3.5 w-3.5" />
            APA References
          </span>
          <span className="flex items-center gap-1.5">
            <FiHash className="h-3.5 w-3.5" />
            2000-2200 Words
          </span>
        </div>
      </div>
    </div>
  )
}

function AcademicDocumentView({
  journal,
  sections,
  isEditable,
}: {
  journal: { topic: string; framework: string; word_count: number; full_journal: string }
  sections: JournalSection[]
  isEditable?: boolean
}) {
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const hasSections = Array.isArray(sections) && sections.length > 0

  return (
    <div className="bg-white border border-border mx-auto" style={{ maxWidth: '720px', minHeight: '900px' }}>
      {/* Document Header Bar */}
      <div className="border-b border-border px-8 py-2 flex items-center justify-between bg-secondary/30">
        <span className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground">
          Reflective Journal
        </span>
        <span className="text-[10px] font-sans text-muted-foreground">
          {currentDate}
        </span>
      </div>

      {/* Title Page Section */}
      <div className="px-10 pt-12 pb-8 text-center border-b border-border">
        <h1 className="font-serif font-bold text-2xl tracking-tight leading-tight mb-6">
          {journal.topic || 'Untitled Journal'}
        </h1>
        <div className="space-y-1 text-sm text-muted-foreground font-sans">
          <p>Framework: <span className="font-medium text-foreground">{journal.framework || 'Not specified'}</span></p>
          <p>Date: <span className="font-medium text-foreground">{currentDate}</span></p>
          <p>Word Count: <span className="font-medium text-foreground">{countWords(journal.full_journal) || journal.word_count || 0}</span></p>
        </div>
      </div>

      {/* Document Body */}
      <div
        className="px-10 py-8"
        contentEditable={isEditable}
        suppressContentEditableWarning
        style={{ lineHeight: '1.8' }}
      >
        {hasSections ? (
          <div className="space-y-8">
            {sections.map((section, idx) => {
              const isReferences = section.heading?.toLowerCase().includes('reference')
              return (
                <div key={idx}>
                  <h2
                    className={`font-serif font-bold tracking-tight mb-3 ${
                      isReferences ? 'text-base mt-8 pt-6 border-t border-border' : 'text-lg'
                    }`}
                  >
                    {section.heading}
                  </h2>
                  <div className="font-sans text-sm leading-relaxed tracking-tight text-foreground">
                    {renderMarkdown(section.content || '')}
                  </div>
                </div>
              )
            })}
          </div>
        ) : journal.full_journal ? (
          <div className="font-sans text-sm leading-relaxed tracking-tight text-foreground">
            {renderMarkdown(journal.full_journal)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No content available.</p>
        )}
      </div>

      {/* Document Footer */}
      <div className="border-t border-border px-8 py-2 flex items-center justify-between bg-secondary/30">
        <span className="text-[10px] font-sans text-muted-foreground">
          {journal.framework}
        </span>
        <span className="text-[10px] font-sans text-muted-foreground">
          {countWords(journal.full_journal) || journal.word_count || 0} words
        </span>
      </div>
    </div>
  )
}

function JournalOutput({
  journal,
  onCopy,
  copyStatus,
}: {
  journal: GeneratedJournal
  onCopy: () => void
  copyStatus: string
}) {
  const hasFiles = Array.isArray(journal.artifactFiles) && journal.artifactFiles.length > 0
  const [viewMode, setViewMode] = useState<'document' | 'edit'>('document')

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const actualWordCount = countWords(journal.full_journal || '')

  return (
    <div className="flex flex-col h-full">
      {/* Action bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="rounded-none font-sans text-xs">
            {journal.framework || 'Journal'}
          </Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <FiHash className="h-3 w-3" />
            {actualWordCount || journal.word_count || 0} words
          </span>
          <Separator orientation="vertical" className="h-4" />
          {/* View mode toggle */}
          <div className="flex items-center gap-1 border border-border rounded-none">
            <button
              onClick={() => setViewMode('document')}
              className={`px-2 py-1 text-xs font-sans transition-colors ${viewMode === 'document' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <FiFileText className="h-3 w-3 inline mr-1" />
              Document
            </button>
            <button
              onClick={() => setViewMode('edit')}
              className={`px-2 py-1 text-xs font-sans transition-colors ${viewMode === 'edit' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <FiEdit3 className="h-3 w-3 inline mr-1" />
              Edit
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasFiles &&
            journal.artifactFiles.map((file, idx) => {
              const ext = file?.file_url?.split('.')?.pop()?.toUpperCase() || 'FILE'
              return (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="rounded-none text-xs h-8"
                  onClick={() => handleDownload(file.file_url, file.name || `journal.${ext.toLowerCase()}`)}
                >
                  <FiDownload className="h-3 w-3 mr-1" />
                  {ext}
                </Button>
              )
            })}
          <Button variant="outline" size="sm" className="rounded-none text-xs h-8" onClick={onCopy}>
            <FiCopy className="h-3 w-3 mr-1" />
            {copyStatus || 'Copy'}
          </Button>
        </div>
      </div>

      {/* Content area */}
      <ScrollArea className="flex-1">
        {viewMode === 'document' ? (
          <div className="p-6 lg:p-8 bg-muted/50">
            <AcademicDocumentView
              journal={journal}
              sections={Array.isArray(journal.sections) ? journal.sections : []}
              isEditable={false}
            />
          </div>
        ) : (
          <div className="p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-3">
              <FiEdit3 className="h-4 w-4 text-muted-foreground" />
              <Label className="text-xs text-muted-foreground uppercase tracking-wide font-sans font-medium">
                Editable Full Text
              </Label>
              <span className="text-xs text-muted-foreground ml-auto">
                {actualWordCount} words
              </span>
            </div>
            <AcademicDocumentView
              journal={journal}
              sections={Array.isArray(journal.sections) ? journal.sections : []}
              isEditable={true}
            />
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

function HistoryCard({
  entry,
  onView,
  onTemplate,
}: {
  entry: JournalEntry
  onView: () => void
  onTemplate: () => void
}) {
  const preview = entry.full_journal ? entry.full_journal.substring(0, 150) + (entry.full_journal.length > 150 ? '...' : '') : 'No content preview available.'
  const hasFiles = Array.isArray(entry.artifact_files) && entry.artifact_files.length > 0

  const handleDownload = (url: string) => {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <Card className="rounded-none shadow-none border border-border">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-bold text-base tracking-tight truncate">{entry.topic || 'Untitled Journal'}</h3>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="secondary" className="rounded-none text-xs">{entry.framework || 'Unknown'}</Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FiClock className="h-3 w-3" />
                {formatDate(entry.created_at)}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FiHash className="h-3 w-3" />
                {entry.word_count || countWords(entry.full_journal)} words
              </span>
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-2">{preview}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-none text-xs h-8" onClick={onView}>
            <FiEye className="h-3 w-3 mr-1" /> View
          </Button>
          {hasFiles &&
            entry.artifact_files.map((file, idx) => (
              <Button key={idx} variant="outline" size="sm" className="rounded-none text-xs h-8" onClick={() => handleDownload(file.file_url)}>
                <FiDownload className="h-3 w-3 mr-1" /> Download
              </Button>
            ))}
          <Button variant="outline" size="sm" className="rounded-none text-xs h-8" onClick={onTemplate}>
            <FiArrowLeft className="h-3 w-3 mr-1" /> Use as Template
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function AgentStatusPanel({ isActive }: { isActive: boolean }) {
  return (
    <Card className="rounded-none shadow-none border border-border">
      <CardContent className="p-4">
        <h4 className="text-xs uppercase tracking-wide text-muted-foreground mb-3 font-sans font-medium">Agent Pipeline</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
            <span className="text-xs font-sans">Journal Coordinator</span>
            <span className="text-xs text-muted-foreground ml-auto">Manager</span>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-yellow-500 animate-pulse' : 'bg-muted'}`} />
            <span className="text-xs font-sans text-muted-foreground">Structure Planner</span>
            <span className="text-xs text-muted-foreground ml-auto">Sub-agent</span>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-yellow-500 animate-pulse' : 'bg-muted'}`} />
            <span className="text-xs font-sans text-muted-foreground">Reflective Writer</span>
            <span className="text-xs text-muted-foreground ml-auto">Sub-agent</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---- Main Page ----

export default function Page() {
  // Navigation
  const [activeView, setActiveView] = useState<'create' | 'history'>('create')

  // Form state
  const [framework, setFramework] = useState('')
  const [topic, setTopic] = useState('')
  const [experience, setExperience] = useState('')
  const [challenges, setChallenges] = useState('')
  const [skills, setSkills] = useState('')
  const [emotions, setEmotions] = useState('')
  const [insights, setInsights] = useState('')
  const [future, setFuture] = useState('')
  const [wordCount, setWordCount] = useState(2100)

  // UI state
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedJournal, setGeneratedJournal] = useState<GeneratedJournal | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusType, setStatusType] = useState<'success' | 'error' | 'info'>('info')
  const [copyStatus, setCopyStatus] = useState('')
  const [sampleData, setSampleData] = useState(false)

  // History state
  const [journalHistory, setJournalHistory] = useState<JournalEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filterFramework, setFilterFramework] = useState('all')
  const [selectedHistoryJournal, setSelectedHistoryJournal] = useState<JournalEntry | null>(null)

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('journal_history')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setJournalHistory(parsed)
        }
      }
    } catch {
      // ignore
    }
  }, [])

  // Sample data toggle
  useEffect(() => {
    if (sampleData) {
      setFramework(SAMPLE_DATA.framework)
      setTopic(SAMPLE_DATA.topic)
      setExperience(SAMPLE_DATA.experience)
      setChallenges(SAMPLE_DATA.challenges)
      setSkills(SAMPLE_DATA.skills)
      setEmotions(SAMPLE_DATA.emotions)
      setInsights(SAMPLE_DATA.insights)
      setFuture(SAMPLE_DATA.future)
      setWordCount(SAMPLE_DATA.wordCount)
    } else {
      setFramework('')
      setTopic('')
      setExperience('')
      setChallenges('')
      setSkills('')
      setEmotions('')
      setInsights('')
      setFuture('')
      setWordCount(2100)
    }
  }, [sampleData])

  const saveToHistory = useCallback((journal: GeneratedJournal) => {
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      framework: journal.framework,
      topic: journal.topic,
      word_count: journal.word_count,
      sections: Array.isArray(journal.sections) ? journal.sections : [],
      full_journal: journal.full_journal,
      artifact_files: Array.isArray(journal.artifactFiles) ? journal.artifactFiles : [],
      created_at: new Date().toISOString(),
      inputs: { experience, challenges, skills, emotions, insights, future, wordCount },
    }
    setJournalHistory((prev) => {
      const updated = [entry, ...prev]
      try {
        localStorage.setItem('journal_history', JSON.stringify(updated))
      } catch {
        // storage full
      }
      return updated
    })
  }, [experience, challenges, skills, emotions, insights, future, wordCount])

  const handleGenerate = async () => {
    if (!framework) {
      setStatusMessage('Please select a reflective framework.')
      setStatusType('error')
      return
    }
    if (!topic.trim()) {
      setStatusMessage('Please enter a topic or module name.')
      setStatusType('error')
      return
    }
    if (!experience.trim()) {
      setStatusMessage('Please describe your experience.')
      setStatusType('error')
      return
    }

    setIsGenerating(true)
    setGeneratedJournal(null)
    setStatusMessage('')

    const frameworkLabel = getFrameworkLabel(framework)
    const message = `Framework: ${frameworkLabel}
Topic: ${topic}
Experience: ${experience}
Challenges: ${challenges}
Skills Developed: ${skills}
Emotional Reflections: ${emotions}
Key Insights: ${insights}
Future Applications: ${future}
Target Word Count: ${wordCount}`

    try {
      const result: AIAgentResponse = await callAIAgent(message, JOURNAL_COORDINATOR_ID)

      if (result.success) {
        let data = result?.response?.result as any
        // Handle string response
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data)
          } catch {
            data = { framework: frameworkLabel, topic, word_count: 0, sections: [], full_journal: data }
          }
        }

        if (!data || typeof data !== 'object') {
          data = { framework: frameworkLabel, topic, word_count: 0, sections: [], full_journal: '' }
        }

        const artifactFiles = Array.isArray(result?.module_outputs?.artifact_files)
          ? result.module_outputs!.artifact_files
          : []

        const journal: GeneratedJournal = {
          framework: data?.framework ?? frameworkLabel,
          topic: data?.topic ?? topic,
          word_count: data?.word_count ?? 0,
          sections: Array.isArray(data?.sections) ? data.sections : [],
          full_journal: data?.full_journal ?? '',
          artifactFiles,
        }

        setGeneratedJournal(journal)
        saveToHistory(journal)
        setStatusMessage('Journal generated successfully.')
        setStatusType('success')
      } else {
        setStatusMessage(result?.error || result?.response?.message || 'Failed to generate journal. Please try again.')
        setStatusType('error')
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'An unexpected error occurred.')
      setStatusType('error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async () => {
    const text = generatedJournal?.full_journal || ''
    if (!text) return
    const ok = await copyToClipboard(text)
    setCopyStatus(ok ? 'Copied' : 'Failed')
    setTimeout(() => setCopyStatus(''), 2000)
  }

  const handleUseAsTemplate = (entry: JournalEntry) => {
    setFramework(FRAMEWORKS.find((f) => f.label === entry.framework)?.value || 'custom')
    setTopic(entry.topic || '')
    setExperience(entry.inputs?.experience || '')
    setChallenges(entry.inputs?.challenges || '')
    setSkills(entry.inputs?.skills || '')
    setEmotions(entry.inputs?.emotions || '')
    setInsights(entry.inputs?.insights || '')
    setFuture(entry.inputs?.future || '')
    setWordCount(entry.inputs?.wordCount || 2100)
    setActiveView('create')
    setSelectedHistoryJournal(null)
    setStatusMessage('Template loaded. Modify inputs and generate a new journal.')
    setStatusType('info')
  }

  const filteredHistory = journalHistory.filter((entry) => {
    const matchesSearch = !searchQuery || (entry.topic || '').toLowerCase().includes(searchQuery.toLowerCase()) || (entry.full_journal || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFramework = filterFramework === 'all' || entry.framework === filterFramework || FRAMEWORKS.find((f) => f.value === filterFramework)?.label === entry.framework
    return matchesSearch && matchesFramework
  })

  return (
    <ErrorBoundary>
      <TooltipProvider>
        <div className="min-h-screen bg-background text-foreground flex flex-col">
          {/* Top Header */}
          <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FiFileText className="h-5 w-5 text-foreground" />
              <h1 className="font-serif font-bold text-xl tracking-tight">Reflective Journal</h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground font-sans">
                  Sample Data
                </Label>
                <Switch id="sample-toggle" checked={sampleData} onCheckedChange={setSampleData} />
              </div>
            </div>
          </header>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <nav className="w-56 border-r border-border bg-card flex flex-col shrink-0">
              <div className="p-4 space-y-1">
                <button
                  onClick={() => setActiveView('create')}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-sans tracking-tight text-left transition-colors ${activeView === 'create' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
                >
                  <FiPlus className="h-4 w-4" />
                  Create Journal
                  {activeView === 'create' && <FiChevronRight className="h-3 w-3 ml-auto" />}
                </button>
                <button
                  onClick={() => setActiveView('history')}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-sans tracking-tight text-left transition-colors ${activeView === 'history' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
                >
                  <FiBook className="h-4 w-4" />
                  Journal History
                  {journalHistory.length > 0 && (
                    <span className="ml-auto text-xs">{journalHistory.length}</span>
                  )}
                </button>
              </div>
              <div className="mt-auto p-4">
                <AgentStatusPanel isActive={isGenerating} />
              </div>
            </nav>

            {/* Main content */}
            <main className="flex-1 overflow-hidden">
              {activeView === 'create' ? (
                <div className="flex h-full">
                  {/* Left panel: Input form */}
                  <div className="w-2/5 border-r border-border flex flex-col overflow-hidden">
                    <div className="px-6 py-4 border-b border-border bg-card">
                      <h2 className="font-serif font-bold text-base tracking-tight">Reflection Inputs</h2>
                      <p className="text-xs text-muted-foreground mt-1 font-sans">Provide details about your learning experience.</p>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-6 space-y-5">
                        {/* Framework */}
                        <div className="space-y-1.5">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-medium">
                            Reflective Framework *
                          </Label>
                          <Select value={framework} onValueChange={setFramework}>
                            <SelectTrigger className="rounded-none shadow-none">
                              <SelectValue placeholder="Select a framework" />
                            </SelectTrigger>
                            <SelectContent className="rounded-none">
                              {FRAMEWORKS.map((fw) => (
                                <SelectItem key={fw.value} value={fw.value} className="rounded-none">
                                  {fw.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {framework && <FrameworkDescription value={framework} />}
                        </div>

                        {/* Topic */}
                        <div className="space-y-1.5">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-medium">
                            Topic / Module *
                          </Label>
                          <Input
                            className="rounded-none shadow-none"
                            placeholder="e.g., Clinical Placement in Nursing"
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                          />
                        </div>

                        <Separator />

                        {/* Guided input sections */}
                        <div className="space-y-4">
                          {/* Experience */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-medium">
                                Describe Your Experience *
                              </Label>
                              <CharCount text={experience} />
                            </div>
                            <Textarea
                              className="rounded-none shadow-none min-h-[100px] resize-y leading-relaxed"
                              placeholder="What happened? Describe the situation, context, and your role..."
                              value={experience}
                              onChange={(e) => setExperience(e.target.value)}
                            />
                          </div>

                          {/* Challenges */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-medium">
                                Challenges You Faced
                              </Label>
                              <CharCount text={challenges} />
                            </div>
                            <Textarea
                              className="rounded-none shadow-none min-h-[80px] resize-y leading-relaxed"
                              placeholder="What difficulties did you encounter? How did they affect you?..."
                              value={challenges}
                              onChange={(e) => setChallenges(e.target.value)}
                            />
                          </div>

                          {/* Skills */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-medium">
                                Skills Developed
                              </Label>
                              <CharCount text={skills} />
                            </div>
                            <Textarea
                              className="rounded-none shadow-none min-h-[80px] resize-y leading-relaxed"
                              placeholder="What new skills or competencies did you develop?..."
                              value={skills}
                              onChange={(e) => setSkills(e.target.value)}
                            />
                          </div>

                          {/* Emotions */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-medium">
                                Emotional Reflections
                              </Label>
                              <CharCount text={emotions} />
                            </div>
                            <Textarea
                              className="rounded-none shadow-none min-h-[80px] resize-y leading-relaxed"
                              placeholder="How did you feel during and after the experience?..."
                              value={emotions}
                              onChange={(e) => setEmotions(e.target.value)}
                            />
                          </div>

                          {/* Insights */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-medium">
                                Key Insights & Critical Analysis
                              </Label>
                              <CharCount text={insights} />
                            </div>
                            <Textarea
                              className="rounded-none shadow-none min-h-[80px] resize-y leading-relaxed"
                              placeholder="What did you learn? How does this connect to theory?..."
                              value={insights}
                              onChange={(e) => setInsights(e.target.value)}
                            />
                          </div>

                          {/* Future */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-medium">
                                Future Applications
                              </Label>
                              <CharCount text={future} />
                            </div>
                            <Textarea
                              className="rounded-none shadow-none min-h-[80px] resize-y leading-relaxed"
                              placeholder="How will you apply what you've learned going forward?..."
                              value={future}
                              onChange={(e) => setFuture(e.target.value)}
                            />
                          </div>
                        </div>

                        <Separator />

                        {/* Word count target */}
                        <div className="space-y-1.5">
                          <Label className="text-xs uppercase tracking-wide text-muted-foreground font-sans font-medium">
                            Target Word Count
                          </Label>
                          <Input
                            type="number"
                            className="rounded-none shadow-none w-32"
                            min={500}
                            max={5000}
                            step={100}
                            value={wordCount}
                            onChange={(e) => setWordCount(parseInt(e.target.value) || 2100)}
                          />
                        </div>

                        {/* Status message */}
                        {statusMessage && activeView === 'create' && (
                          <StatusMessage message={statusMessage} type={statusType} />
                        )}

                        {/* Generate button */}
                        <Button
                          className="w-full rounded-none shadow-none h-11 font-sans tracking-tight"
                          onClick={handleGenerate}
                          disabled={isGenerating}
                        >
                          {isGenerating ? (
                            <>
                              <FiLoader className="h-4 w-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <FiFileText className="h-4 w-4 mr-2" />
                              Generate Journal
                            </>
                          )}
                        </Button>
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Right panel: Output */}
                  <div className="w-3/5 flex flex-col overflow-hidden bg-card">
                    <div className="px-6 py-4 border-b border-border">
                      <h2 className="font-serif font-bold text-base tracking-tight">Generated Journal</h2>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {isGenerating ? (
                        <LoadingSkeleton />
                      ) : generatedJournal ? (
                        <JournalOutput journal={generatedJournal} onCopy={handleCopy} copyStatus={copyStatus} />
                      ) : (
                        <EmptyOutputState />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* History View */
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-card">
                    <h2 className="font-serif font-bold text-base tracking-tight mb-3">Journal History</h2>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 max-w-sm">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="rounded-none shadow-none pl-9"
                          placeholder="Search journals by topic..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <Select value={filterFramework} onValueChange={setFilterFramework}>
                        <SelectTrigger className="rounded-none shadow-none w-56">
                          <div className="flex items-center gap-2">
                            <FiFilter className="h-3 w-3" />
                            <SelectValue placeholder="All Frameworks" />
                          </div>
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="all" className="rounded-none">All Frameworks</SelectItem>
                          {FRAMEWORKS.map((fw) => (
                            <SelectItem key={fw.value} value={fw.value} className="rounded-none">
                              {fw.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-6">
                      {filteredHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center min-h-[300px] text-center px-8">
                          <FiBook className="h-12 w-12 text-muted-foreground mb-4" />
                          <h3 className="font-serif font-bold text-lg tracking-tight mb-2">
                            {journalHistory.length === 0 ? 'No Journals Yet' : 'No Results Found'}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                            {journalHistory.length === 0
                              ? 'Create your first reflective journal to get started.'
                              : 'Try adjusting your search or filter criteria.'}
                          </p>
                          {journalHistory.length === 0 && (
                            <Button
                              variant="outline"
                              className="rounded-none shadow-none mt-4"
                              onClick={() => setActiveView('create')}
                            >
                              <FiPlus className="h-4 w-4 mr-2" />
                              Create Journal
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {filteredHistory.map((entry) => (
                            <HistoryCard
                              key={entry.id}
                              entry={entry}
                              onView={() => setSelectedHistoryJournal(entry)}
                              onTemplate={() => handleUseAsTemplate(entry)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </main>
          </div>

          {/* View History Journal Dialog */}
          <Dialog open={!!selectedHistoryJournal} onOpenChange={(open) => { if (!open) setSelectedHistoryJournal(null) }}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden rounded-none shadow-none border border-border p-0">
              <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
                <DialogTitle className="font-serif font-bold text-xl tracking-tight">
                  {selectedHistoryJournal?.topic || 'Journal'}
                </DialogTitle>
                <div className="flex items-center gap-3 mt-2">
                  <Badge variant="secondary" className="rounded-none text-xs">
                    {selectedHistoryJournal?.framework || 'Unknown'}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FiClock className="h-3 w-3" />
                    {selectedHistoryJournal ? formatDate(selectedHistoryJournal.created_at) : ''}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FiHash className="h-3 w-3" />
                    {selectedHistoryJournal?.word_count || countWords(selectedHistoryJournal?.full_journal || '')} words
                  </span>
                </div>
              </DialogHeader>
              <ScrollArea className="flex-1 max-h-[60vh]">
                <div className="p-6 bg-muted/50">
                  {selectedHistoryJournal && (
                    <AcademicDocumentView
                      journal={{
                        topic: selectedHistoryJournal.topic,
                        framework: selectedHistoryJournal.framework,
                        word_count: selectedHistoryJournal.word_count,
                        full_journal: selectedHistoryJournal.full_journal,
                      }}
                      sections={Array.isArray(selectedHistoryJournal.sections) ? selectedHistoryJournal.sections : []}
                      isEditable={false}
                    />
                  )}
                </div>
              </ScrollArea>
              <div className="px-6 py-4 border-t border-border flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  onClick={async () => {
                    if (selectedHistoryJournal?.full_journal) {
                      await copyToClipboard(selectedHistoryJournal.full_journal)
                    }
                  }}
                >
                  <FiCopy className="h-3 w-3 mr-1" /> Copy
                </Button>
                {selectedHistoryJournal && Array.isArray(selectedHistoryJournal.artifact_files) && selectedHistoryJournal.artifact_files.map((file, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="rounded-none"
                    onClick={() => {
                      const a = document.createElement('a')
                      a.href = file.file_url
                      a.target = '_blank'
                      a.rel = 'noopener noreferrer'
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                    }}
                  >
                    <FiDownload className="h-3 w-3 mr-1" /> Download
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none"
                  onClick={() => {
                    if (selectedHistoryJournal) handleUseAsTemplate(selectedHistoryJournal)
                  }}
                >
                  <FiArrowLeft className="h-3 w-3 mr-1" /> Use as Template
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-none ml-auto"
                  onClick={() => setSelectedHistoryJournal(null)}
                >
                  <FiX className="h-3 w-3 mr-1" /> Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </ErrorBoundary>
  )
}
