"use client"

import { useState, useCallback } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, CheckCircle2, XCircle, FileType, Loader2 } from 'lucide-react'
import { parseApkMetadataClient, validateApkFile, formatFileSize } from '@/lib/apk-signature-client'

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

export function ApkUploader() {
  const [status, setStatus] = useState<UploadStatus>({
    stage: 'idle',
    progress: 0,
    message: '',
  })
  const [apkInfo, setApkInfo] = useState<ApkInfo | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const generateUploadUrl = useMutation(api.apkStorage.generateUploadUrl)
  const saveApkMetadata = useMutation(api.apkStorage.saveApkMetadata)

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
        message: 'APK uploaded successfully!',
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

  return (
    <div className="space-y-4">
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
            <Button variant="outline" onClick={() => document.getElementById('apk-input')?.click()}>
              Browse Files
            </Button>
            <input
              id="apk-input"
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
                      {apkInfo.signatureChecksum.slice(0, 32)}...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={resetUploader} variant="outline" className="w-full">
            Upload Another APK
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
  )
}
