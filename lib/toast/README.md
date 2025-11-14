# Toast Notification System

A fully customizable toast notification system for your Next.js application with support for different types, positions, and animations.

## Features

- **4 Toast Types**: Success, Error, Warning, and Info
- **6 Position Options**: Top-left, top-center, top-right, bottom-left, bottom-center, bottom-right
- **Customizable Duration**: Set how long each toast should display
- **Smooth Animations**: Position-aware enter/exit animations
- **Progress Bar**: Visual indicator of toast lifetime
- **Auto-dismiss**: Toasts automatically close after duration
- **Manual Close**: Click the X button to dismiss early
- **Queue Support**: Display multiple toasts simultaneously
- **TypeScript Support**: Full type safety

## Installation

The toast system is already set up in your `_app.tsx` with the `ToastProvider`.

## Basic Usage

```tsx
import { useToast } from '@/lib/toast';

function MyComponent() {
  const toast = useToast();

  return (
    <div>
      <button onClick={() => toast.success('Success!')}>
        Show Success
      </button>
      <button onClick={() => toast.error('Error occurred!')}>
        Show Error
      </button>
      <button onClick={() => toast.warning('Warning!')}>
        Show Warning
      </button>
      <button onClick={() => toast.info('Info message')}>
        Show Info
      </button>
    </div>
  );
}
```

## Advanced Usage

### Custom Duration

```tsx
// Toast will display for 5 seconds
toast.success('This will stay longer', { duration: 5000 });

// Toast will display for 1 second
toast.error('Quick message', { duration: 1000 });
```

### Custom Position

```tsx
// Show toast at bottom-center
toast.info('Bottom notification', {
  position: 'bottom-center'
});

// Show toast at top-left
toast.warning('Top left notification', {
  position: 'top-left',
  duration: 4000
});
```

### Available Positions

- `'top-left'`
- `'top-center'`
- `'top-right'` (default)
- `'bottom-left'`
- `'bottom-center'`
- `'bottom-right'`

### Change Default Position

```tsx
const toast = useToast();

// Change the default position for all subsequent toasts
toast.setDefaultPosition('bottom-right');

// Now all toasts will appear at bottom-right
toast.success('This appears at bottom-right');
```

### Generic Toast with Type

```tsx
// You can also use the generic showToast method
toast.showToast('Custom message', {
  type: 'success',
  duration: 3000,
  position: 'top-center'
});
```

## API Reference

### useToast Hook

Returns an object with the following methods:

#### `success(message: string, options?: ToastOptions)`
Display a success toast (green with checkmark icon).

#### `error(message: string, options?: ToastOptions)`
Display an error toast (red with X icon).

#### `warning(message: string, options?: ToastOptions)`
Display a warning toast (orange with warning icon).

#### `info(message: string, options?: ToastOptions)`
Display an info toast (blue with info icon).

#### `showToast(message: string, options?: ToastOptions)`
Generic method to display a toast with custom type.

#### `setDefaultPosition(position: ToastPosition)`
Change the default position for all toasts.

#### `removeToast(id: string)`
Manually remove a toast by ID (rarely needed).

### ToastOptions

```typescript
interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number; // milliseconds
  position?: ToastPosition;
}
```

### ToastProvider Props

```typescript
interface ToastProviderProps {
  children: ReactNode;
  defaultPosition?: ToastPosition;  // Default: 'top-right'
  defaultDuration?: number;          // Default: 3000ms
}
```

## Examples

### Form Submission

```tsx
async function handleSubmit(data: FormData) {
  try {
    await submitForm(data);
    toast.success('Form submitted successfully!');
  } catch (error) {
    toast.error('Failed to submit form');
  }
}
```

### API Request

```tsx
async function fetchData() {
  toast.info('Loading data...');

  try {
    const response = await fetch('/api/data');
    if (response.ok) {
      toast.success('Data loaded successfully');
    } else {
      toast.error('Failed to load data');
    }
  } catch (error) {
    toast.error('Network error occurred');
  }
}
```

### Multiple Sequential Toasts

```tsx
function showProgress() {
  toast.info('Starting process...', { duration: 2000 });

  setTimeout(() => {
    toast.warning('Processing...', { duration: 2000 });
  }, 2000);

  setTimeout(() => {
    toast.success('Process complete!');
  }, 4000);
}
```

### User Actions

```tsx
function handleCopy() {
  navigator.clipboard.writeText('some text');
  toast.success('Copied to clipboard!', {
    position: 'bottom-center',
    duration: 2000
  });
}

function handleDelete() {
  deleteItem();
  toast.warning('Item deleted', {
    position: 'top-center'
  });
}
```

## Demo

Visit `/toast-demo` to see the toast system in action with all available options.

## Customization

### Styling

The toast styles are defined in:
- `components/Toast/Toast.module.css` - Individual toast styling
- `components/Toast/ToastContainer.module.css` - Container positioning

You can modify these CSS modules to customize colors, sizes, animations, etc.

### Animation Duration

The default animation duration is 300ms. To change it, update the animation durations in `Toast.module.css` and the timeout in `Toast.tsx`:

```tsx
// In Toast.tsx
setTimeout(() => {
  onClose(id);
}, 300); // Match this with your CSS animation duration
```

## File Structure

```
lib/toast/
├── index.ts              # Main exports
├── types.ts              # TypeScript types
├── ToastContext.tsx      # Context provider
├── useToast.ts           # Hook
└── README.md             # This file

components/Toast/
├── index.ts              # Component exports
├── Toast.tsx             # Individual toast component
├── Toast.module.css      # Toast styling
├── ToastContainer.tsx    # Container component
└── ToastContainer.module.css  # Container styling
```

## TypeScript

The toast system is fully typed. Import types as needed:

```tsx
import type { ToastType, ToastPosition, ToastOptions } from '@/lib/toast';
```
