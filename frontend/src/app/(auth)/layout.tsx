import { SignedInRedirect } from '@/components/auth/SignedInRedirect'

// Sign in / sign up are guest-only: a signed-in user is sent to /dashboard
// (and the form never flashes for them). See SignedInRedirect.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <SignedInRedirect>{children}</SignedInRedirect>
}
