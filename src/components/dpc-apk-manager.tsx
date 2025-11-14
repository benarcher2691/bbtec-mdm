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
  Loader2,
  Trash2,
  Package,
  Download
} from 'lucide-react'
import { parseApkMetadataClient, validateApkFile } from '@/lib/apk-signature-client'
import { upload } from '@vercel/blob/client'
import type { Id } from '../../convex/_generated/dataModel'

interface UploadStatus {
  stage: 'idle' | 'validating' | 'parsing' | 'uploading' | 'saving' | 'success' | 'error'
  progress: number
  message: string
}

export function DpcApkManager() {
  const [status, setStatus] = useState<UploadStatus>({
    stage: 'idle',
    progress: 0,
    message: '',
  })
  const [isDragging, setIsDragging] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [apkToDelete, setApkToDelete] = useState<{ id: Id<"apkMetadata">; version: string; blobUrl: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Detect current environment to determine variant
  const isLocal = process.env.NEXT_PUBLIC_CONVEX_URL?.includes('127.0.0.1')
  const isPreview = process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'

  const currentVariant: 'local' | 'staging' | 'production' =
    isLocal ? 'local' :
    isPreview ? 'staging' :
    'production'

  console.log('[DPC APK Manager] Environment:', { isLocal, isPreview, currentVariant })

  // Get current APK for THIS environment only
  const currentApk = useQuery(api.apkStorage.getCurrentApkByVariant, { variant: currentVariant })
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

      // Stage 3: Upload to Vercel Blob
      setStatus({ stage: 'uploading', progress: 50, message: 'Uploading APK to Vercel Blob...' })

      const blob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blobs/upload',
      })

      console.log('[DPC APK UPLOAD] Uploaded to Vercel Blob:', blob.url)

      // Stage 4: Extract metadata server-side (signature + package name)
      setStatus({ stage: 'parsing', progress: 65, message: 'Extracting APK signature and metadata...' })

      const extractResponse = await fetch('/api/apk/extract-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl: blob.url }),
      })

      if (!extractResponse.ok) {
        const errorData = await extractResponse.json()
        throw new Error(errorData.details || 'Failed to extract APK metadata')
      }

      const extractedMetadata = await extractResponse.json()

      if (!extractedMetadata.success) {
        throw new Error('Server-side extraction failed')
      }

      // Use current ENVIRONMENT as variant (NOT package name!)
      const variant = currentVariant
      console.log('[DPC APK] Using environment variant:', variant, '| APK package:', extractedMetadata.packageName)

      // Stage 5: Delete old APK of SAME environment if exists
      if (currentApk) {
        setStatus({ stage: 'saving', progress: 85, message: `Removing old ${variant} APK...` })
        console.log('[DPC APK] Deleting old', variant, 'APK:', currentApk.version)

        // Delete blob from Vercel
        try {
          await fetch('/api/blobs/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blobUrl: currentApk.blobUrl }),
          })
        } catch (err) {
          console.warn('[DPC APK] Failed to delete old blob:', err)
        }

        // Delete metadata from Convex
        await deleteApk({ apkId: currentApk._id, blobUrl: currentApk.blobUrl })
      }

      // Stage 6: Save NEW metadata to database
      setStatus({ stage: 'saving', progress: 90, message: `Saving ${variant} APK metadata...` })
      await saveApkMetadata({
        version: extractedMetadata.versionName,
        versionCode: extractedMetadata.versionCode,
        blobUrl: blob.url,
        variant: variant,
        signatureChecksum: extractedMetadata.signatureChecksum,
        fileSize: file.size,
        fileName: file.name,
      })

      // Success!
      setStatus({
        stage: 'success',
        progress: 100,
        message: `${variant.toUpperCase()} APK uploaded successfully!`,
      })
    } catch (error) {
      console.error('APK upload error:', error)
      setStatus({
        stage: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Failed to upload APK',
      })
    }
  }, [currentApk, currentVariant, deleteApk, saveApkMetadata])

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
  }, [])

  const handleDeleteClick = (id: Id<"apkMetadata">, version: string, blobUrl: string) => {
    setApkToDelete({ id, version, blobUrl })
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!apkToDelete) return

    setDeleting(true)
    try {
      // Delete blob from Vercel
      await fetch('/api/blobs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobUrl: apkToDelete.blobUrl }),
      })

      // Delete metadata from Convex
      await deleteApk({ apkId: apkToDelete.id, blobUrl: apkToDelete.blobUrl })
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
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}`
  }

  return (
    <div className="space-y-6">
      {/* Environment Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm font-medium text-blue-900">
          Current Environment: <span className="font-bold">{currentVariant.toUpperCase()}</span>
        </p>
        <p className="text-xs text-blue-700 mt-1">
          Any APK uploaded here will be tagged as &lsquo;{currentVariant}&rsquo; variant
        </p>
      </div>

      {/* Current APK - Only show if APK exists */}
      {currentApk && currentApk !== undefined && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Current {currentVariant.toUpperCase()} APK</h3>
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="rounded-lg bg-blue-100 p-2">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex items-center gap-6 flex-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">Version: </span>
                    <span className="font-semibold">v{currentApk.version}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Uploaded: </span>
                    <span className="font-medium">{formatDate(currentApk.uploadedAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{currentApk.downloadCount}</span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteClick(currentApk._id, currentApk.version, currentApk.blobUrl)}
                title="Delete this APK"
              >
                <Trash2 className="h-5 w-5 text-red-600" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Upload New {currentVariant.toUpperCase()} APK</h3>
        <p className="text-sm text-muted-foreground">
          Upload any APK - it will be tagged as &lsquo;{currentVariant}&rsquo; based on your current environment.
        </p>

        {/* Upload Area */}
        {status.stage === 'idle' && (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`
              border-2 border-dashed rounded-lg px-8 py-6
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
                <p className="text-lg font-medium">Upload {currentVariant.toUpperCase()} APK</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Environment: {currentVariant}
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
        {status.stage === 'success' && (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {status.message}
              </AlertDescription>
            </Alert>

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete DPC APK?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>v{apkToDelete?.version}</strong>?
              <br /><br />
              This will permanently remove the APK file from storage and you will need to upload a new one. This action cannot be undone.
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
