"use client"

import { useState, useRef } from "react"
import { useMutation, useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Package, Upload, Trash2, AlertCircle, Download } from "lucide-react"
import type { Id } from "../../convex/_generated/dataModel"

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB in bytes

interface UploadForm {
  name: string
  packageName: string
  versionName: string
  versionCode: string
  description: string
}

export function ApplicationsManager() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [appToDelete, setAppToDelete] = useState<{ id: Id<"applications">; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [parsing, setParsing] = useState(false)

  const [formData, setFormData] = useState<UploadForm>({
    name: "",
    packageName: "",
    versionName: "",
    versionCode: "",
    description: "",
  })

  const fileInputRef = useRef<HTMLInputElement>(null)

  const applications = useQuery(api.applications.listApplications)
  const generateUploadUrl = useMutation(api.applications.generateUploadUrl)
  const saveApplication = useMutation(api.applications.saveApplication)
  const deleteApplication = useMutation(api.applications.deleteApplication)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.apk')) {
      setError('Please select an APK file')
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`)
      return
    }

    setSelectedFile(file)
    setError(null)
    setParsing(true)

    try {
      // Read file as ArrayBuffer and convert to Uint8Array for serialization
      const arrayBuffer = await file.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // Parse APK metadata
      const { parseApkMetadata } = await import('@/app/actions/parse-apk')
      const result = await parseApkMetadata(Array.from(uint8Array))

      if (result.success && result.metadata) {
        // Auto-fill form with extracted metadata
        setFormData({
          name: result.metadata.name,
          packageName: result.metadata.packageName,
          versionName: result.metadata.versionName,
          versionCode: result.metadata.versionCode.toString(),
          description: formData.description, // Keep existing description
        })
      } else {
        // Fallback to filename if parsing fails
        setFormData({
          ...formData,
          name: file.name.replace('.apk', ''),
        })
        if (result.error) {
          setError(`Warning: ${result.error}. Please fill in details manually.`)
        }
      }
    } catch (err) {
      console.error('Error parsing APK:', err)
      // Fallback to filename
      setFormData({
        ...formData,
        name: file.name.replace('.apk', ''),
      })
      setError('Could not parse APK metadata. Please fill in details manually.')
    } finally {
      setParsing(false)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file')
      return
    }

    // Validate required fields
    if (!formData.name || !formData.packageName || !formData.versionName || !formData.versionCode) {
      setError('Please fill in all required fields')
      return
    }

    const versionCode = parseInt(formData.versionCode, 10)
    if (isNaN(versionCode) || versionCode < 1) {
      setError('Version code must be a positive number')
      return
    }

    setUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // Generate upload URL
      const uploadUrl = await generateUploadUrl()

      // Upload file
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: selectedFile,
      })

      if (!result.ok) {
        throw new Error('Failed to upload file')
      }

      const { storageId } = await result.json() as { storageId: Id<"_storage"> }

      // Save application metadata
      await saveApplication({
        name: formData.name,
        packageName: formData.packageName,
        versionName: formData.versionName,
        versionCode,
        fileSize: selectedFile.size,
        storageId,
        description: formData.description || undefined,
      })

      // Reset form and close dialog
      setFormData({
        name: "",
        packageName: "",
        versionName: "",
        versionCode: "",
        description: "",
      })
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setUploadDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload application')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDeleteClick = (id: Id<"applications">, name: string) => {
    setAppToDelete({ id, name })
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!appToDelete) return

    setDeleting(true)
    try {
      await deleteApplication({ id: appToDelete.id })
      setDeleteDialogOpen(false)
      setAppToDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete application')
    } finally {
      setDeleting(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* Upload Button */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {applications?.length || 0} application{applications?.length === 1 ? '' : 's'} uploaded
        </p>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload APK
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Upload Application</DialogTitle>
              <DialogDescription>
                Upload an APK file - metadata will be extracted automatically. Maximum file size: 100MB
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* File Input */}
              <div className="space-y-2">
                <Label htmlFor="apk-file">APK File *</Label>
                <Input
                  id="apk-file"
                  type="file"
                  accept=".apk"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  disabled={uploading || parsing}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
                {parsing && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent" />
                    <span>Parsing APK metadata...</span>
                  </div>
                )}
              </div>

              {/* App Name */}
              <div className="space-y-2">
                <Label htmlFor="app-name">Application Name * (auto-filled)</Label>
                <Input
                  id="app-name"
                  placeholder="My App"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={uploading || parsing}
                />
              </div>

              {/* Package Name */}
              <div className="space-y-2">
                <Label htmlFor="package-name">Package Name * (auto-filled)</Label>
                <Input
                  id="package-name"
                  placeholder="com.example.myapp"
                  value={formData.packageName}
                  onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                  disabled={uploading || parsing}
                />
              </div>

              {/* Version Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="version-name">Version Name * (auto-filled)</Label>
                  <Input
                    id="version-name"
                    placeholder="1.0.0"
                    value={formData.versionName}
                    onChange={(e) => setFormData({ ...formData, versionName: e.target.value })}
                    disabled={uploading || parsing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="version-code">Version Code * (auto-filled)</Label>
                  <Input
                    id="version-code"
                    type="number"
                    placeholder="1"
                    value={formData.versionCode}
                    onChange={(e) => setFormData({ ...formData, versionCode: e.target.value })}
                    disabled={uploading || parsing}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="Brief description of the app"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={uploading || parsing}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}

              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setUploadDialogOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Applications List */}
      {applications === undefined ? (
        <div className="rounded-lg border bg-card p-12">
          <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
            <p className="text-sm text-muted-foreground">Loading applications...</p>
          </div>
        </div>
      ) : applications.length === 0 ? (
        <div className="rounded-lg border bg-card p-12">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-slate-100 p-4">
              <Package className="h-8 w-8 text-slate-400" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">No Applications</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Upload an APK file to get started
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
                  <th className="text-left p-4 font-medium text-sm">Name</th>
                  <th className="text-left p-4 font-medium text-sm">Package Name</th>
                  <th className="text-left p-4 font-medium text-sm">Version</th>
                  <th className="text-left p-4 font-medium text-sm">Size</th>
                  <th className="text-left p-4 font-medium text-sm">Uploaded</th>
                  <th className="text-left p-4 font-medium text-sm w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {applications.map((app) => (
                  <tr key={app._id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-100 p-2">
                          <Package className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">{app.name}</p>
                          {app.description && (
                            <p className="text-sm text-muted-foreground">{app.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <code className="text-sm bg-slate-100 px-2 py-1 rounded">
                        {app.packageName}
                      </code>
                    </td>
                    <td className="p-4">
                      <p className="text-sm">
                        {app.versionName} ({app.versionCode})
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm">{formatFileSize(app.fileSize)}</p>
                    </td>
                    <td className="p-4">
                      <p className="text-sm text-muted-foreground">
                        {formatDate(app.uploadedAt)}
                      </p>
                    </td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(app._id, app.name)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{appToDelete?.name}</strong>?
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
