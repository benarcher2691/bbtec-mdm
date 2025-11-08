"use client"

import { useState, useEffect } from "react"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createEnrollmentQRCode } from "@/app/actions/enrollment"
import { QrCode, Copy, Check, AlertCircle, ArrowRight, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { Id } from "../../convex/_generated/dataModel"

interface EnrollmentToken {
  token: string
  qrCode: string
  expirationTimestamp: string
  apkVersion?: string
}

export function QRCodeGenerator() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tokenData, setTokenData] = useState<EnrollmentToken | null>(null)
  const [copied, setCopied] = useState(false)
  const [currentTokenId, setCurrentTokenId] = useState<Id<"enrollmentTokens"> | null>(null)
  const [selectedPolicyId, setSelectedPolicyId] = useState<Id<"policies"> | null>(null)
  const [selectedCompanyUserId, setSelectedCompanyUserId] = useState<Id<"companyUsers"> | null>(null)
  const dpcType = 'bbtec' // Always use BBTec MDM Client

  // Query default policy and company users from Convex
  const defaultPolicy = useQuery(api.policies.getDefaultPolicy)
  const companyUsers = useQuery(api.companyUsers.listCompanyUsers)

  // Reactively check token status (only when we have a token)
  const tokenStatus = useQuery(
    api.enrollmentTokens.checkTokenStatus,
    currentTokenId ? { tokenId: currentTokenId } : "skip"
  )

  // Set default policy when it loads
  useEffect(() => {
    if (defaultPolicy && !selectedPolicyId) {
      setSelectedPolicyId(defaultPolicy._id)
    }
  }, [defaultPolicy, selectedPolicyId])

  // Watch for token being used (reactive!)
  useEffect(() => {
    if (tokenStatus?.used && tokenStatus.device && currentTokenId) {
      // Token has been used - device enrolled!
      setCurrentTokenId(null) // Stop polling
      setTokenData(null) // Hide QR code
    }
  }, [tokenStatus, currentTokenId])

  const handleGenerateToken = async () => {
    if (!selectedCompanyUserId) {
      setError('Please select a company user first')
      return
    }

    if (!selectedPolicyId) {
      setError('Default policy not found. Please contact support.')
      return
    }

    setLoading(true)
    setError(null)
    setCurrentTokenId(null) // Reset previous token

    try {
      const result = await createEnrollmentQRCode(selectedPolicyId, 3600, false, dpcType, selectedCompanyUserId)

      console.log('[QR GEN CLIENT] Full result:', result)
      console.log('[QR GEN CLIENT] Debug object:', result.debug)

      if (result.success && result.tokenId) {
        setTokenData({
          token: result.token || '',
          qrCode: result.qrCode || '',
          expirationTimestamp: result.expirationTimestamp || '',
          apkVersion: result.apkVersion,
        })

        // Start watching this token for enrollment (reactive!)
        setCurrentTokenId(result.tokenId)
      } else {
        setError(result.error || 'Failed to create enrollment QR code')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleGoToDevice = () => {
    // Navigate to device detail page
    if (tokenStatus?.device?.deviceId) {
      router.push(`/management/devices?device=${tokenStatus.device.deviceId}`)
    } else {
      router.push('/management/devices')
    }
  }

  const handleCopyToken = async () => {
    if (tokenData?.token) {
      await navigator.clipboard.writeText(tokenData.token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const formatExpirationTime = (timestamp: string) => {
    if (!timestamp) return 'Unknown'
    const date = new Date(timestamp)
    return date.toISOString().split('T')[0] // YYYY-MM-DD
  }

  return (
    <div className="space-y-6">
      {/* Company User Selection */}
      <div className="space-y-2">
        <Label htmlFor="company-user-select">Company User *</Label>
        <Select
          value={selectedCompanyUserId || undefined}
          onValueChange={(value) => setSelectedCompanyUserId(value as Id<"companyUsers">)}
        >
          <SelectTrigger id="company-user-select" className="w-full md:w-[400px]">
            <SelectValue placeholder="Select a company user" />
          </SelectTrigger>
          <SelectContent>
            {companyUsers?.map((user) => (
              <SelectItem key={user._id} value={user._id}>
                {user.companyName} - {user.contactPersonName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {companyUsers?.length === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
            No company users available. Please create a user in Company → Users first.
          </p>
        )}
      </div>

      {/* Generate Button */}
      <div className="flex gap-4 items-center">
        <Button
          onClick={handleGenerateToken}
          disabled={loading || !selectedCompanyUserId}
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <QrCode className="mr-2 h-4 w-4" />
              Generate Enrollment QR Code
            </>
          )}
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900">Error</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Device Enrolled Success */}
      {tokenStatus?.used && tokenStatus.device && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <div className="flex items-start gap-3 mb-4">
            <Check className="h-6 w-6 text-green-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 text-lg">Device Enrolled Successfully!</h3>
              <p className="text-sm text-green-700 mt-1">
                {tokenStatus.device.model || 'A device'} has been enrolled and is now being managed.
              </p>
              <p className="text-xs text-green-600 mt-1 font-mono">
                Serial: {tokenStatus.device.serialNumber}
              </p>
            </div>
          </div>
          <Button onClick={handleGoToDevice} className="w-full md:w-auto">
            <ArrowRight className="mr-2 h-4 w-4" />
            View Device Details
          </Button>
        </div>
      )}

      {/* Waiting for Enrollment */}
      {currentTokenId && tokenData && !tokenStatus?.used && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            <div>
              <p className="text-sm text-blue-900 font-medium">Waiting for device enrollment...</p>
              <p className="text-xs text-blue-700 mt-1">
                Scan the QR code below to enroll your device
              </p>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Display */}
      {tokenData && !tokenStatus?.used && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Enrollment QR Code</h3>

          <div className="grid md:grid-cols-2 gap-6">
            {/* QR Code Image */}
            <div className="flex flex-col items-center gap-4">
              {tokenData.qrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tokenData.qrCode}
                  alt="Enrollment QR Code"
                  className="border-4 border-slate-200 rounded-lg"
                  style={{ maxWidth: '300px', width: '100%' }}
                />
              ) : (
                <div className="w-64 h-64 border-4 border-dashed border-slate-300 rounded-lg flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No QR code available</p>
                </div>
              )}
              <p className="text-sm text-muted-foreground text-center">
                Scan this QR code during Android device setup
              </p>
            </div>

            {/* Token Details */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Enrollment Token
                </label>
                <div className="mt-2 flex gap-2">
                  <code className="flex-1 p-3 bg-slate-100 rounded-md text-sm font-mono break-all">
                    {tokenData.token}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyToken}
                    title="Copy token"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Expires
                </label>
                <p className="mt-2 text-sm">
                  {formatExpirationTime(tokenData.expirationTimestamp)}
                </p>
              </div>

              {tokenData.apkVersion && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      DPC Version
                    </label>
                    <p className="mt-2 text-sm font-mono">
                      {tokenData.apkVersion}
                    </p>
                  </div>
                </>
              )}

              <Separator />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">
                  How to use
                </h4>
                <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                  <li>Factory reset an Android device (or use new device)</li>
                  <li>During setup, scan the QR code above</li>
                  <li>The device will automatically enroll</li>
                  <li>Policies will be applied automatically</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions (shown when no token generated yet) */}
      {!tokenData && !error && !loading && (
        <div className="rounded-lg border bg-slate-50 p-6">
          <h3 className="text-lg font-semibold mb-4">Getting Started</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate an enrollment QR code to add new Android devices to your MDM system.
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>QR codes are valid for 1 hour after generation</li>
            <li>Each QR code can be used to enroll one device</li>
            <li>Devices will automatically apply the default policy</li>
            <li>You can generate new codes as needed</li>
          </ul>
        </div>
      )}
    </div>
  )
}
