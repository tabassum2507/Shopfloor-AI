'use client'

import { useCallback, useRef, useState } from 'react'
import Papa from 'papaparse'
import Modal from '@/components/ui/Modal'
import {
  Upload, FileText, Download, Loader2,
  CheckCircle, AlertCircle, UploadCloud,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────

export type ColDef = {
  key: string       // payload key sent to the API
  label: string     // human-readable label shown in mapping UI
  required: boolean
}

type ImportResult = {
  imported: number
  skipped:  number
  errors:   string[]
}

type Stage = 'drop' | 'preview' | 'uploading' | 'done'

interface Props {
  title:            string       // modal title, e.g. "Import Products"
  endpoint:         string       // POST URL, e.g. "/api/products/import"
  columns:          ColDef[]     // expected columns, in order
  templateFilename: string       // e.g. "products-template.csv"
  templateContent:  string       // raw CSV string for the template
  onSuccess:        () => void   // called after a successful import
  buttonLabel?:     string
}

// ─── Helpers ──────────────────────────────────────────────────

function autoMap(
  csvHeaders: string[],
  columns: ColDef[],
): Record<string, string> {
  const m: Record<string, string> = {}
  for (const col of columns) {
    const normalize = (s: string) => s.toLowerCase().replace(/[\s_\-]/g, '')
    const hit = csvHeaders.find(h => normalize(h) === normalize(col.key))
              ?? csvHeaders.find(h => normalize(h) === normalize(col.label))
    if (hit) m[col.key] = hit
  }
  return m
}

function downloadBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────

export default function CsvUploader({
  title,
  endpoint,
  columns,
  templateFilename,
  templateContent,
  onSuccess,
  buttonLabel = 'Import CSV',
}: Props) {
  const [open,     setOpen]     = useState(false)
  const [stage,    setStage]    = useState<Stage>('drop')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers,  setHeaders]  = useState<string[]>([])
  const [rows,     setRows]     = useState<Record<string, string>[]>([])
  const [mapping,  setMapping]  = useState<Record<string, string>>({})
  const [progress, setProgress] = useState(0)
  const [result,   setResult]   = useState<ImportResult | null>(null)
  const [parseErr, setParseErr] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef     = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── State machine ─────────────────────────────────────────

  function reset() {
    setStage('drop')
    setDragging(false)
    setFileName('')
    setHeaders([])
    setRows([])
    setMapping({})
    setProgress(0)
    setResult(null)
    setParseErr('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  function handleOpen() { reset(); setOpen(true) }
  function handleClose() { reset(); setOpen(false) }

  // ── CSV parsing ───────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseErr('Please upload a .csv file.')
      return
    }
    setFileName(file.name)
    setParseErr('')
    Papa.parse<Record<string, string>>(file, {
      header:         true,
      skipEmptyLines: true,
      complete(results) {
        if (!results.meta.fields?.length) {
          setParseErr('CSV has no headers. Download the template to see the expected format.')
          return
        }
        setHeaders(results.meta.fields)
        setRows(results.data)
        setMapping(autoMap(results.meta.fields, columns))
        setStage('preview')
      },
      error(err) {
        setParseErr(`Parse error: ${err.message}`)
      },
    })
  }, [columns])

  // ── Drag-and-drop ─────────────────────────────────────────

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true)  }
  function onDragLeave()                  { setDragging(false) }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  // ── Upload ────────────────────────────────────────────────

  async function handleUpload() {
    setStage('uploading')
    setProgress(0)

    // Animate progress bar: 0 → 70% during fetch, snap to 100% on done
    timerRef.current = setTimeout(() => setProgress(70), 80)

    const payload = rows.map(row => {
      const obj: Record<string, string> = {}
      for (const col of columns) {
        const csvKey = mapping[col.key]
        obj[col.key] = csvKey ? (row[csvKey] ?? '').trim() : ''
      }
      return obj
    })

    try {
      const res  = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows: payload }),
      })
      const raw = await res.json()
      if (timerRef.current) clearTimeout(timerRef.current)
      setProgress(100)

      // Normalise: if the server returned { error: "..." } (e.g. 401 / 500),
      // turn it into a proper ImportResult so the done-stage render is safe.
      const data: ImportResult =
        !res.ok || typeof raw.imported !== 'number'
          ? { imported: 0, skipped: 0, errors: [raw.error ?? `Server error (${res.status})`] }
          : { imported: raw.imported, skipped: raw.skipped ?? 0, errors: raw.errors ?? [] }

      setResult(data)
      setStage('done')
      if (data.imported > 0) onSuccess()
    } catch {
      if (timerRef.current) clearTimeout(timerRef.current)
      setProgress(100)
      setResult({ imported: 0, skipped: 0, errors: ['Network error — please try again.'] })
      setStage('done')
    }
  }

  // ── Derived ───────────────────────────────────────────────

  const canUpload = columns.filter(c => c.required).every(c => !!mapping[c.key])
  const preview5  = rows.slice(0, 5)

  // ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 text-[12.5px] font-medium text-gray-600 hover:text-primary border border-gray-200 hover:border-primary/40 px-3 py-1.5 rounded-lg transition-colors"
      >
        <Upload style={{ width: 13, height: 13 }} />
        {buttonLabel}
      </button>

      <Modal isOpen={open} onClose={handleClose} title={title} size="lg">

        {/* ── Template download (always visible) ── */}
        <div className="flex items-center justify-between mb-4 pb-3.5 border-b border-gray-100">
          <p className="text-[12.5px] text-gray-500">
            Upload a <span className="font-mono font-semibold text-gray-700">.csv</span> file
            with columns: <span className="font-mono text-[11.5px] text-gray-600">
              {columns.map(c => c.key).join(', ')}
            </span>
          </p>
          <button
            type="button"
            onClick={() => downloadBlob(templateContent, templateFilename)}
            className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primary/80 shrink-0 ml-4"
          >
            <Download style={{ width: 12, height: 12 }} />
            Download Template
          </button>
        </div>

        {/* ══════ STAGE: drop ══════ */}
        {stage === 'drop' && (
          <div className="space-y-3">
            {/* Drag-and-drop zone */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={[
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 cursor-pointer transition-all',
                dragging
                  ? 'border-primary bg-primary/5 scale-[1.01]'
                  : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50',
              ].join(' ')}
            >
              <UploadCloud
                style={{ width: 32, height: 32 }}
                className={dragging ? 'text-primary' : 'text-gray-300'}
                strokeWidth={1.5}
              />
              <div className="text-center">
                <p className="text-[13.5px] font-medium text-gray-700">
                  {dragging ? 'Drop it here' : 'Drag & drop your CSV here'}
                </p>
                <p className="text-[12px] text-gray-400 mt-0.5">
                  or click to browse
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            {parseErr && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-[12.5px] text-red-700">
                <AlertCircle className="shrink-0 mt-0.5" style={{ width: 13, height: 13 }} />
                {parseErr}
              </div>
            )}
          </div>
        )}

        {/* ══════ STAGE: preview ══════ */}
        {stage === 'preview' && (
          <div className="space-y-5">

            {/* File name pill */}
            <div className="flex items-center gap-2">
              <FileText style={{ width: 13, height: 13 }} className="text-gray-400" />
              <span className="text-[12.5px] font-medium text-gray-700">{fileName}</span>
              <span className="text-[11.5px] text-gray-400">·</span>
              <span className="text-[11.5px] text-gray-400">{rows.length} rows</span>
              <button
                type="button"
                onClick={reset}
                className="ml-auto text-[12px] text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2"
              >
                Choose different file
              </button>
            </div>

            {/* ── Column mapping ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Column Mapping
              </p>
              <div className="rounded-lg border border-gray-100 overflow-hidden">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="py-2 px-3 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Expected field
                      </th>
                      <th className="py-2 px-3 text-left font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        CSV column
                      </th>
                      <th className="py-2 px-3 text-center font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((col, i) => {
                      const mapped = mapping[col.key]
                      const ok     = !!mapped
                      return (
                        <tr key={col.key} className={i < columns.length - 1 ? 'border-b border-gray-100' : ''}>
                          <td className="py-2 px-3">
                            <span className="font-mono text-gray-700">{col.key}</span>
                            {col.required && <span className="ml-1 text-red-400 text-[10px]">*</span>}
                            <span className="ml-2 text-[11.5px] text-gray-400">({col.label})</span>
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={mapped ?? ''}
                              onChange={e => setMapping(prev => ({ ...prev, [col.key]: e.target.value }))}
                              className={[
                                'w-full px-2 py-1 rounded border text-[12.5px] focus:outline-none focus:ring-2 transition-colors bg-white',
                                ok
                                  ? 'border-gray-200 focus:ring-primary/20 focus:border-primary'
                                  : col.required
                                    ? 'border-red-300 focus:ring-red-200 focus:border-red-400'
                                    : 'border-gray-200 focus:ring-primary/20 focus:border-primary',
                              ].join(' ')}
                            >
                              <option value="">— not mapped —</option>
                              {headers.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {ok
                              ? <CheckCircle style={{ width: 13, height: 13 }} className="text-green-500 mx-auto" />
                              : col.required
                                ? <AlertCircle style={{ width: 13, height: 13 }} className="text-red-400 mx-auto" />
                                : <span className="text-[11px] text-gray-300">optional</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {!canUpload && (
                <p className="mt-2 text-[11.5px] text-red-500">
                  Map all required fields (*) before uploading.
                </p>
              )}
            </div>

            {/* ── Data preview ── */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                Preview (first {Math.min(5, rows.length)} of {rows.length} rows)
              </p>
              <div className="rounded-lg border border-gray-100 overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {columns.map(col => (
                        <th key={col.key} className="py-1.5 px-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview5.map((row, i) => (
                      <tr key={i} className={i < preview5.length - 1 ? 'border-b border-gray-50' : ''}>
                        {columns.map(col => {
                          const csvKey = mapping[col.key]
                          const val    = csvKey ? row[csvKey] : ''
                          return (
                            <td key={col.key} className="py-1.5 px-3 text-gray-600 whitespace-nowrap max-w-[160px] truncate">
                              {val || <span className="text-gray-300">—</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!canUpload || rows.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload style={{ width: 13, height: 13 }} />
                Import {rows.length} row{rows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        )}

        {/* ══════ STAGE: uploading ══════ */}
        {stage === 'uploading' && (
          <div className="py-8 flex flex-col items-center gap-5">
            <Loader2 className="text-primary animate-spin" style={{ width: 28, height: 28 }} />
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[11.5px] text-gray-500 mb-1.5">
                <span>Importing {rows.length} rows…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ══════ STAGE: done ══════ */}
        {stage === 'done' && result && (
          <div className="space-y-4">

            {/* Summary banner */}
            <div className={[
              'flex items-start gap-3 p-4 rounded-xl border',
              result.errors.length === 0
                ? 'bg-green-50 border-green-100'
                : 'bg-amber-50 border-amber-100',
            ].join(' ')}>
              {result.errors.length === 0
                ? <CheckCircle className="text-green-500 shrink-0 mt-0.5" style={{ width: 18, height: 18 }} />
                : <AlertCircle className="text-amber-500 shrink-0 mt-0.5" style={{ width: 18, height: 18 }} />
              }
              <div>
                <p className="text-[13.5px] font-semibold text-gray-800">
                  {result.imported > 0
                    ? `${result.imported} row${result.imported !== 1 ? 's' : ''} imported successfully`
                    : 'No rows imported'}
                </p>
                <p className="text-[12.5px] text-gray-500 mt-0.5">
                  {result.skipped > 0 && `${result.skipped} skipped (duplicate)`}
                  {result.skipped > 0 && result.errors.length > 0 && ' · '}
                  {result.errors.length > 0 && `${result.errors.length} error${result.errors.length !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* Error list */}
            {result.errors.length > 0 && (
              <div className="rounded-lg border border-red-100 overflow-hidden">
                <div className="bg-red-50 px-3 py-2 border-b border-red-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-red-500">
                    Errors ({result.errors.length})
                  </p>
                </div>
                <ul className="divide-y divide-red-50 max-h-40 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i} className="px-3 py-2 text-[12px] text-red-700 font-mono">
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={reset}
                className="px-4 py-2 text-[13px] text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Import Another File
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 bg-primary text-white rounded-lg text-[13px] font-medium hover:bg-primary/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

      </Modal>
    </>
  )
}
