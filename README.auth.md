# Authentication Setup Guide

This app uses a flexible authentication system that works with any auth service.

## Quick Start

### 1. Choose Your Auth Service

Edit [lib/auth/adapter.ts](lib/auth/adapter.ts) and:
- Uncomment one of the example implementations (Supabase, Firebase, Custom API, etc.)
- OR create your own implementation of the `AuthAdapter` interface
- Update the export at the bottom: `export const authAdapter: AuthAdapter = new YourAuthAdapter();`

### 2. Install Dependencies

Based on your choice:

```bash
# Supabase
npm install @supabase/supabase-js

# Firebase
npm install firebase

# Auth0
npm install @auth0/auth0-react

# Clerk
npm install @clerk/nextjs
```

### 3. Configure Environment Variables

Copy [.env.example](.env.example) to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your auth service credentials.

### 4. Test the Integration

The auth system is already integrated in [pages/_app.tsx](pages/_app.tsx:1).

## Usage

### In Your Components

```tsx
import { useAuth } from '@/lib/auth';

function MyComponent() {
  const { user, isAuthenticated, isLoading, signIn, signOut } = useAuth();

  if (isLoading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <button onClick={() => signIn('email@example.com', 'password')}>
      Sign In
    </button>;
  }

  return (
    <div>
      <p>Welcome, {user.email}!</p>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

### Protect Routes

```tsx
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div>Protected content here</div>
    </ProtectedRoute>
  );
}
```

### Use the Login Form

```tsx
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return <LoginForm />;
}
```

## File Structure

```
lib/auth/
├── types.ts          - Core type definitions
├── adapter.ts        - 🔧 CONFIGURE YOUR AUTH SERVICE HERE
├── AuthContext.tsx   - React context provider
└── index.ts          - Public exports

components/auth/
├── ProtectedRoute.tsx - Route protection wrapper
└── LoginForm.tsx      - Example login form

pages/
└── _app.tsx          - AuthProvider integrated here
```

## Where to Make Changes

### To Switch Auth Services
**File**: [lib/auth/adapter.ts](lib/auth/adapter.ts)
- Uncomment/implement your auth service
- Update the export at line ~350

### To Add Custom User Fields
**File**: [lib/auth/types.ts](lib/auth/types.ts)
- Modify the `User` interface (line ~8)

### To Customize Auth Behavior
**File**: [lib/auth/AuthContext.tsx](lib/auth/AuthContext.tsx)
- Modify the `AuthProvider` component
- Add custom hooks or methods

### To Change Environment Variables
**Files**: [.env.example](.env.example) and `.env.local`
- Add your service-specific variables

## Supported Auth Services

The adapter system supports:
- Supabase (example included)
- Firebase Auth (example included)
- Custom API (example included)
- NextAuth.js (implement interface)
- Auth0 (implement interface)
- Clerk (implement interface)
- AWS Cognito (implement interface)
- Any other service (implement interface)

## Need Help?

1. Check the comments in [lib/auth/adapter.ts](lib/auth/adapter.ts)
2. Review the example implementations
3. Ensure your auth service implements all methods in the `AuthAdapter` interface
