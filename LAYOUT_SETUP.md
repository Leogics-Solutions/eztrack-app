# AppLayout Setup Guide

## Installation

Install the required icon library:

```bash
npm install lucide-react
```

## Usage

### Basic Usage

Simply wrap your page content with `<AppLayout>`:

```tsx
import { AppLayout } from '@/components/layout';

export default function MyPage() {
  return (
    <AppLayout>
      <h1>Your page content here</h1>
    </AppLayout>
  );
}
```

The `AppLayout` automatically includes:
- `ProtectedRoute` wrapper (authentication required)
- Collapsible sidebar with navigation
- Header with search and profile dropdown

## Customization Points

### 1. Navigation Menu Items
**File**: [components/layout/Sidebar.tsx](components/layout/Sidebar.tsx:18-24)

Edit the `navItems` array:

```tsx
const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/your-route', label: 'Your Label', icon: YourIcon },
  // Add more items...
];
```

### 2. Brand/Logo
**File**: [components/layout/Sidebar.tsx](components/layout/Sidebar.tsx:35-48)

Change the logo and brand name:

```tsx
<div className="h-8 w-8 rounded-lg bg-blue-600">
  <span className="text-white font-bold">EZ</span> {/* Change this */}
</div>
<span className="font-semibold text-lg">
  EZTrack {/* Change this */}
</span>
```

### 3. Header Search
**File**: [components/layout/Header.tsx](components/layout/Header.tsx:42-51)

Customize or remove the search bar.

### 4. Profile Dropdown Menu
**File**: [components/layout/Header.tsx](components/layout/Header.tsx:88-109)

Add or remove menu items in the dropdown.

### 5. Sidebar Width
**File**: [components/layout/Sidebar.tsx](components/layout/Sidebar.tsx:31-34)

Change the collapsed/expanded widths:

```tsx
${isCollapsed ? 'w-16' : 'w-64'} // Adjust these values
```

## Components

### AppLayout
**File**: [components/layout/AppLayout.tsx](components/layout/AppLayout.tsx)

Main wrapper component that orchestrates the layout.

### Sidebar
**File**: [components/layout/Sidebar.tsx](components/layout/Sidebar.tsx)

- Collapsible navigation sidebar
- Active route highlighting
- Customizable navigation items

### Header
**File**: [components/layout/Header.tsx](components/layout/Header.tsx)

- Search bar
- Notification bell (with badge)
- Profile dropdown with avatar
- Sign out functionality

## Features

### Responsive Design
- Mobile-friendly
- Collapsible sidebar for more space
- Responsive profile menu

### Dark Mode Support
All components include dark mode classes ready to use with your theme system.

### Authentication Integration
- Uses `useAuth()` hook from your auth system
- Shows user info (name, email, avatar)
- Sign out functionality built-in

### Active Route Highlighting
Sidebar automatically highlights the current page using Next.js router.

## Example: Using on Multiple Pages

```tsx
// pages/dashboard.tsx
import { AppLayout } from '@/components/layout';

export default function Dashboard() {
  return (
    <AppLayout>
      <h1>Dashboard</h1>
      {/* Your dashboard content */}
    </AppLayout>
  );
}

// pages/settings.tsx
import { AppLayout } from '@/components/layout';

export default function Settings() {
  return (
    <AppLayout>
      <h1>Settings</h1>
      {/* Your settings content */}
    </AppLayout>
  );
}
```

## Icons

This layout uses [Lucide React](https://lucide.dev/icons/) icons. Browse available icons at their website and import them:

```tsx
import { Home, User, Settings, Mail } from 'lucide-react';
```
