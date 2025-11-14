import React from 'react';
import { useToast } from '@/lib/toast';
import type { ToastPosition } from '@/lib/toast';

const ToastDemo: React.FC = () => {
  const toast = useToast();
  const [selectedPosition, setSelectedPosition] = React.useState<ToastPosition>('top-right');

  const handlePositionChange = (position: ToastPosition) => {
    setSelectedPosition(position);
    toast.setDefaultPosition(position);
    toast.info(`Position changed to ${position}`, { position });
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '30px' }}>Toast Notification System Demo</h1>

      {/* Toast Type Buttons */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px' }}>Toast Types</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => toast.success('Operation completed successfully!')}
            style={{
              padding: '10px 20px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Show Success
          </button>
          <button
            onClick={() => toast.error('Something went wrong!')}
            style={{
              padding: '10px 20px',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Show Error
          </button>
          <button
            onClick={() => toast.warning('This is a warning message!')}
            style={{
              padding: '10px 20px',
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Show Warning
          </button>
          <button
            onClick={() => toast.info('Here is some information for you.')}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            Show Info
          </button>
        </div>
      </section>

      {/* Position Buttons */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px' }}>Toast Positions</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', maxWidth: '500px' }}>
          {(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as ToastPosition[]).map(
            (position) => (
              <button
                key={position}
                onClick={() => handlePositionChange(position)}
                style={{
                  padding: '10px',
                  background: selectedPosition === position ? '#6366f1' : '#e5e7eb',
                  color: selectedPosition === position ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '14px',
                }}
              >
                {position}
              </button>
            )
          )}
        </div>
      </section>

      {/* Custom Duration */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px' }}>Custom Duration</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => toast.success('This will disappear in 1 second', { duration: 1000 })}
            style={{
              padding: '10px 20px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            1 Second
          </button>
          <button
            onClick={() => toast.info('This will disappear in 5 seconds', { duration: 5000 })}
            style={{
              padding: '10px 20px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            5 Seconds
          </button>
          <button
            onClick={() => toast.warning('This will disappear in 10 seconds', { duration: 10000 })}
            style={{
              padding: '10px 20px',
              background: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            10 Seconds
          </button>
        </div>
      </section>

      {/* Multiple Toasts */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px' }}>Multiple Toasts</h2>
        <button
          onClick={() => {
            toast.success('First toast!');
            setTimeout(() => toast.info('Second toast!'), 200);
            setTimeout(() => toast.warning('Third toast!'), 400);
            setTimeout(() => toast.error('Fourth toast!'), 600);
          }}
          style={{
            padding: '10px 20px',
            background: '#ec4899',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          Show Multiple Toasts
        </button>
      </section>

      {/* Usage Instructions */}
      <section style={{ marginTop: '60px', padding: '20px', background: '#f3f4f6', borderRadius: '8px' }}>
        <h2 style={{ marginBottom: '15px' }}>Usage Instructions</h2>
        <pre style={{ background: '#1f2937', color: '#f9fafb', padding: '15px', borderRadius: '6px', overflow: 'auto' }}>
{`// Import the hook
import { useToast } from '@/lib/toast';

// Use in your component
const MyComponent = () => {
  const toast = useToast();

  const handleClick = () => {
    // Basic usage
    toast.success('Success message!');
    toast.error('Error message!');
    toast.warning('Warning message!');
    toast.info('Info message!');

    // With options
    toast.success('Custom duration', {
      duration: 5000
    });

    // With custom position
    toast.error('Error at bottom', {
      position: 'bottom-center',
      duration: 3000
    });
  };

  return <button onClick={handleClick}>Show Toast</button>;
};`}
        </pre>
      </section>
    </div>
  );
};

export default ToastDemo;
