import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            📱 bbtec-mdm
          </h1>
          <p className="text-slate-600">
            Sign in to manage your Android devices
          </p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-xl"
            }
          }}
        />
      </div>
    </div>
  )
}
