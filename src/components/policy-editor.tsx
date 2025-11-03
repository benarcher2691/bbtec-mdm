"use client"

import { useState, useEffect } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import type { Id } from '../../convex/_generated/dataModel'

interface PolicyEditorProps {
  policyId?: Id<"policies">
  initialData?: any
  onSave?: () => void
  onCancel?: () => void
}

export function PolicyEditor({ policyId, initialData, onSave, onCancel }: PolicyEditorProps) {
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  // Password policies
  const [passwordRequired, setPasswordRequired] = useState(false)
  const [passwordMinLength, setPasswordMinLength] = useState<number>(8)
  const [passwordQuality, setPasswordQuality] = useState<string>('numeric')

  // Device restrictions
  const [cameraDisabled, setCameraDisabled] = useState(false)
  const [screenCaptureDisabled, setScreenCaptureDisabled] = useState(false)
  const [bluetoothDisabled, setBluetoothDisabled] = useState(false)
  const [usbFileTransferDisabled, setUsbFileTransferDisabled] = useState(false)
  const [factoryResetDisabled, setFactoryResetDisabled] = useState(false)

  // Kiosk mode
  const [kioskEnabled, setKioskEnabled] = useState(false)
  const [kioskPackageNames, setKioskPackageNames] = useState<string>('')
  const [statusBarDisabled, setStatusBarDisabled] = useState(false)

  // System apps
  const [systemAppsDisabled, setSystemAppsDisabled] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const createPolicy = useMutation(api.policies.createPolicy)
  const updatePolicy = useMutation(api.policies.updatePolicy)

  // Load initial data if editing
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '')
      setIsDefault(initialData.isDefault || false)
      setPasswordRequired(initialData.passwordRequired || false)
      setPasswordMinLength(initialData.passwordMinLength || 8)
      setPasswordQuality(initialData.passwordQuality || 'numeric')
      setCameraDisabled(initialData.cameraDisabled || false)
      setScreenCaptureDisabled(initialData.screenCaptureDisabled || false)
      setBluetoothDisabled(initialData.bluetoothDisabled || false)
      setUsbFileTransferDisabled(initialData.usbFileTransferDisabled || false)
      setFactoryResetDisabled(initialData.factoryResetDisabled || false)
      setKioskEnabled(initialData.kioskEnabled || false)
      setKioskPackageNames(initialData.kioskPackageNames?.join(', ') || '')
      setStatusBarDisabled(initialData.statusBarDisabled || false)
      setSystemAppsDisabled(initialData.systemAppsDisabled?.join(', ') || '')
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const policyData = {
        name,
        isDefault,
        passwordRequired,
        ...(passwordRequired && {
          passwordMinLength,
          passwordQuality,
        }),
        cameraDisabled,
        screenCaptureDisabled,
        bluetoothDisabled,
        usbFileTransferDisabled,
        factoryResetDisabled,
        kioskEnabled,
        ...(kioskEnabled && {
          kioskPackageNames: kioskPackageNames.split(',').map(s => s.trim()).filter(Boolean),
        }),
        statusBarDisabled,
        ...(systemAppsDisabled && {
          systemAppsDisabled: systemAppsDisabled.split(',').map(s => s.trim()).filter(Boolean),
        }),
      }

      if (policyId) {
        await updatePolicy({ policyId, ...policyData })
      } else {
        await createPolicy(policyData)
      }

      setSuccess(true)
      setTimeout(() => {
        if (onSave) onSave()
      }, 1500)
    } catch (err) {
      console.error('Policy save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save policy')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Policy Name */}
      <div className="space-y-2">
        <Label htmlFor="policy-name">Policy Name</Label>
        <Input
          id="policy-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Standard Security Policy"
          required
        />
      </div>

      {/* Default Policy */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="is-default">Default Policy</Label>
          <p className="text-sm text-muted-foreground">
            Use this policy for new enrollments by default
          </p>
        </div>
        <Switch
          id="is-default"
          checked={isDefault}
          onCheckedChange={setIsDefault}
        />
      </div>

      <Separator />

      {/* Password Policies */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Password Policies</h3>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="password-required">Require Password</Label>
            <p className="text-sm text-muted-foreground">
              Enforce device password/PIN
            </p>
          </div>
          <Switch
            id="password-required"
            checked={passwordRequired}
            onCheckedChange={setPasswordRequired}
          />
        </div>

        {passwordRequired && (
          <div className="ml-6 space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="password-length">Minimum Length</Label>
              <Input
                id="password-length"
                type="number"
                min={4}
                max={16}
                value={passwordMinLength}
                onChange={(e) => setPasswordMinLength(parseInt(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password-quality">Password Quality</Label>
              <Select value={passwordQuality} onValueChange={setPasswordQuality}>
                <SelectTrigger id="password-quality">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="numeric">Numeric PIN</SelectItem>
                  <SelectItem value="alphabetic">Alphabetic</SelectItem>
                  <SelectItem value="alphanumeric">Alphanumeric</SelectItem>
                  <SelectItem value="complex">Complex (with symbols)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* Device Restrictions */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Device Restrictions</h3>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="camera-disabled">Disable Camera</Label>
            <p className="text-sm text-muted-foreground">
              Prevent camera usage
            </p>
          </div>
          <Switch
            id="camera-disabled"
            checked={cameraDisabled}
            onCheckedChange={setCameraDisabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="screenshot-disabled">Disable Screenshots</Label>
            <p className="text-sm text-muted-foreground">
              Prevent screen capture
            </p>
          </div>
          <Switch
            id="screenshot-disabled"
            checked={screenCaptureDisabled}
            onCheckedChange={setScreenCaptureDisabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="bluetooth-disabled">Disable Bluetooth</Label>
            <p className="text-sm text-muted-foreground">
              Prevent Bluetooth usage
            </p>
          </div>
          <Switch
            id="bluetooth-disabled"
            checked={bluetoothDisabled}
            onCheckedChange={setBluetoothDisabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="usb-disabled">Disable USB File Transfer</Label>
            <p className="text-sm text-muted-foreground">
              Prevent USB file transfers
            </p>
          </div>
          <Switch
            id="usb-disabled"
            checked={usbFileTransferDisabled}
            onCheckedChange={setUsbFileTransferDisabled}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="factory-reset-disabled">Disable Factory Reset</Label>
            <p className="text-sm text-muted-foreground">
              Prevent factory reset
            </p>
          </div>
          <Switch
            id="factory-reset-disabled"
            checked={factoryResetDisabled}
            onCheckedChange={setFactoryResetDisabled}
          />
        </div>
      </div>

      <Separator />

      {/* Kiosk Mode */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Kiosk Mode</h3>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="kiosk-enabled">Enable Kiosk Mode</Label>
            <p className="text-sm text-muted-foreground">
              Lock device to specific apps
            </p>
          </div>
          <Switch
            id="kiosk-enabled"
            checked={kioskEnabled}
            onCheckedChange={setKioskEnabled}
          />
        </div>

        {kioskEnabled && (
          <div className="ml-6 space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="kiosk-packages">Allowed Package Names</Label>
              <Input
                id="kiosk-packages"
                value={kioskPackageNames}
                onChange={(e) => setKioskPackageNames(e.target.value)}
                placeholder="com.example.app1, com.example.app2"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of package names
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="status-bar-disabled">Hide Status Bar</Label>
                <p className="text-sm text-muted-foreground">
                  Hide system status bar
                </p>
              </div>
              <Switch
                id="status-bar-disabled"
                checked={statusBarDisabled}
                onCheckedChange={setStatusBarDisabled}
              />
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* System Apps */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">System Apps</h3>

        <div className="space-y-2">
          <Label htmlFor="system-apps-disabled">Disabled System Apps</Label>
          <Input
            id="system-apps-disabled"
            value={systemAppsDisabled}
            onChange={(e) => setSystemAppsDisabled(e.target.value)}
            placeholder="com.android.browser, com.android.chrome"
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated list of system app package names to disable
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Policy {policyId ? 'updated' : 'created'} successfully!
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading || success}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Policy'
          )}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
