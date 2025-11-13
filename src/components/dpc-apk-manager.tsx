"use client"

import { useState, useCallback } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Upload,
  CheckCircle2,
  XCircle,
  FileType,
  Loader2,
  Trash2,
  Package,
  Download,
  Shield
} from 'lucide-react'
import { parseApkMetadataClient, validateApkFile, formatFileSize } from '@/lib/apk-signature-client'
import type { Id } from '../../convex/_generated/dataModel'

interface UploadStatus {
  stage: 'idle' | 'validating' | 'parsing' | 'uploading' | 'saving' | 'success' | 'error'
  progress: number
  message: string
}

interface ApkInfo {
  packageName: string
  versionName: string
  versionCode: number
  signatureChecksum: string
  fileSize: string
  fileName: string
}

export function DpcApkManager() {
  const [status, setStatus] = useState<UploadStatus>({
    stage: 'idle',
    progress: 0,
    message: '',
  })
  const [apkInfo, setApkInfo] = useState<ApkInfo | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [apkToDelete, setApkToDelete] = useState<{ id: Id<"apkMetadata">; version: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Convex queries and mutations
  const apkList = useQuery(api.apkStorage.listApks)
  const currentApk = useQuery(api.apkStorage.getCurrentApk)
  const generateUploadUrl = useMutation(api.apkStorage.generateUploadUrl)
  const saveApkMetadata = useMutation(api.apkStorage.saveApkMetadata)
  const deleteApk = useMutation(api.apkStorage.deleteApk)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.apk')) {
      setStatus({
        stage: 'error',
        progress: 0,
        message: 'Please select a valid APK file',
      })
      return
    }

    try {
      // Stage 1: Validate
      setStatus({ stage: 'validating', progress: 10, message: 'Validating APK file...' })

      if (!(await validateApkFile(file))) {
        throw new Error('Invalid APK file format')
      }

      // Stage 2: Validate APK structure (client-side using JSZip)
      setStatus({ stage: 'validating', progress: 25, message: 'Validating APK structure...' })
      await parseApkMetadataClient(file) // Validates structure, returns placeholders

      // Stage 3: Upload to Convex storage
      setStatus({ stage: 'uploading', progress: 50, message: 'Uploading APK to storage...' })
      const uploadUrl = await generateUploadUrl()

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      })

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload APK to storage')
      }

      const { storageId } = await uploadResponse.json()

      // Stage 4: Extract metadata server-side (signature + package name)
      setStatus({ stage: 'parsing', progress: 65, message: 'Extracting APK signature and metadata...' })

      const extractResponse = await fetch('/api/apk/extract-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageId }),
      })

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json()
        throw new Error(errorData.details || 'Failed to extract APK metadata')
      }

      const extractedMetadata = await extractResponse.json()

      if (!extractedMetadata.success) {
        throw new Error('Server-side extraction failed')
      }

      // Update apkInfo with extracted metadata
      setApkInfo({
        packageName: extractedMetadata.packageName,
        versionName: extractedMetadata.versionName,
        versionCode: extractedMetadata.versionCode,
        signatureChecksum: extractedMetadata.signatureChecksum,
        fileSize: formatFileSize(file.size),
        fileName: file.name,
      })

      // Stage 5: Save metadata to database
      setStatus({ stage: 'saving', progress: 85, message: 'Saving APK metadata...' })
      await saveApkMetadata({
        version: extractedMetadata.versionName,
        versionCode: extractedMetadata.versionCode,
        storageId,
        signatureChecksum: extractedMetadata.signatureChecksum,
        fileSize: file.size,
        fileName: file.name,
      })

      // Success!
      setStatus({
        stage: 'success',
        progress: 100,
        message: 'DPC APK uploaded successfully! This version is now active.',
      })
    } catch (error) {
      console.error('APK upload error:', error)
      setStatus({
        stage: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Failed to upload APK',
      })
    }
  }, [generateUploadUrl, saveApkMetadata])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }, [handleFile])

  const resetUploader = useCallback(() => {
    setStatus({ stage: 'idle', progress: 0, message: '' })
    setApkInfo(null)
  }, [])

  const handleDeleteClick = (id: Id<"apkMetadata">, version: string) => {
    setApkToDelete({ id, version })
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!apkToDelete) return

    setDeleting(true)
    try {
      await deleteApk({ apkId: apkToDelete.id })
      setDeleteDialogOpen(false)
      setApkToDelete(null)
    } catch (err) {
      console.error('Delete error:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete APK')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Upload New Version</h3>

        {/* Upload Area */}
        {status.stage === 'idle' && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              border-2 border-dashed rounded-lg p-8
              transition-colors duration-200
              ${isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }
            `}
          >
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">Upload DPC APK</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Drag and drop your APK file here, or click to browse
                </p>
              </div>
              <Button variant="outline" onClick={() => document.getElementById('dpc-apk-input')?.click()}>
                Browse Files
              </Button>
              <input
                id="dpc-apk-input"
                type="file"
                accept=".apk"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          </div>
        )}

        {/* Progress */}
        {(status.stage === 'validating' || status.stage === 'parsing' || status.stage === 'uploading' || status.stage === 'saving') && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm font-medium">{status.message}</p>
            </div>
            <Progress value={status.progress} className="h-2" />
          </div>
        )}

        {/* Success */}
        {status.stage === 'success' && apkInfo && (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {status.message}
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <FileType className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <p className="font-medium">{apkInfo.fileName}</p>
                    <p className="text-sm text-muted-foreground">{apkInfo.fileSize}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Package:</span>
                      <p className="font-mono text-xs mt-0.5">{apkInfo.packageName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Version:</span>
                      <p className="font-mono text-xs mt-0.5">
                        {apkInfo.versionName} ({apkInfo.versionCode})
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Signature:</span>
                      <p className="font-mono text-xs mt-0.5 break-all">
                        {apkInfo.signatureChecksum}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={resetUploader} variant="outline" className="w-full">
              Upload Another Version
            </Button>
          </div>
        )}

        {/* Error */}
        {status.stage === 'error' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{status.message}</AlertDescription>
            </Alert>
            <Button onClick={resetUploader} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        )}
      </div>

      {/* Version History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">DPC APK Versions</h3>
          <p className="text-sm text-muted-foreground">
            {apkList?.length || 0} version{apkList?.length === 1 ? '' : 's'}
          </p>
        </div>

        {/* Loading state */}
        {apkList === undefined ? (
          <div className="rounded-lg border bg-card p-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading DPC versions...</p>
            </div>
          </div>
        ) : apkList.length === 0 ? (
          <div className="rounded-lg border bg-card p-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-full bg-slate-100 p-4">
                <Package className="h-8 w-8 text-slate-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">No DPC APK Uploaded</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Upload your first DPC APK to get started
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium text-sm">Version</th>
                    <th className="text-left p-4 font-medium text-sm">File Name</th>
                    <th className="text-left p-4 font-medium text-sm">Size</th>
                    <th className="text-left p-4 font-medium text-sm">Signature</th>
                    <th className="text-left p-4 font-medium text-sm">Uploaded</th>
                    <th className="text-left p-4 font-medium text-sm">Downloads</th>
                    <th className="text-left p-4 font-medium text-sm w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {apkList.map((apk) => {
                    const isCurrent = currentApk?._id === apk._id
                    return (
                      <tr key={apk._id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="rounded-lg bg-blue-100 p-2">
                              <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">v{apk.version}</p>
                                {isCurrent && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <Shield className="h-3 w-3" />
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Code: {apk.versionCode}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm font-mono">{apk.fileName}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm">{formatFileSize(apk.fileSize)}</p>
                        </td>
                        <td className="p-4">
                          <code className="text-xs bg-slate-100 px-2 py-1 rounded block max-w-[200px] truncate">
                            {apk.signatureChecksum}
                          </code>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">
                            {formatDate(apk.uploadedAt)}
                          </p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Download className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm">{apk.downloadCount}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(apk._id, apk.version)}
                            disabled={isCurrent}
                            title={isCurrent ? "Cannot delete current version" : "Delete this version"}
                          >
                            <Trash2 className={`h-4 w-4 ${isCurrent ? 'text-slate-300' : 'text-red-600'}`} />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete DPC APK Version?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>v{apkToDelete?.version}</strong>?
              <br /><br />
              This will permanently remove the APK file from storage. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
