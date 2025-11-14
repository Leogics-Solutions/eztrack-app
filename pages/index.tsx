import { AppLayout } from "@/components/layout";

export default function Home() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Dashboard
          </h1>
          <p style={{ color: 'var(--muted-foreground)' }}>
            Welcome to EZTrack! Your smart, futuristic tracking dashboard.
          </p>
        </div>

        {/* Sample Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1 - Stats */}
          <div
            className="rounded-lg p-6 border transition-all hover:shadow-lg"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--card-foreground)'
            }}
          >
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Total Users
            </h3>
            <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
              1,234
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--success)' }}>
              ↑ 12% from last month
            </p>
          </div>

          {/* Card 2 - Stats */}
          <div
            className="rounded-lg p-6 border transition-all hover:shadow-lg"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--card-foreground)'
            }}
          >
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Active Sessions
            </h3>
            <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
              567
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--info)' }}>
              ↑ 8% from last week
            </p>
          </div>

          {/* Card 3 - Stats */}
          <div
            className="rounded-lg p-6 border transition-all hover:shadow-lg"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--card-foreground)'
            }}
          >
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--muted-foreground)' }}>
              Error Rate
            </h3>
            <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
              0.3%
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--error)' }}>
              ↓ 2% from yesterday
            </p>
          </div>
        </div>

        {/* Action Button Example */}
        <div className="flex gap-4">
          <button
            className="px-6 py-3 rounded-lg font-medium transition-all"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-foreground)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--accent-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
            }}
          >
            Primary Action
          </button>

          <button
            className="px-6 py-3 rounded-lg font-medium transition-all border"
            style={{
              background: 'var(--secondary)',
              color: 'var(--secondary-foreground)',
              borderColor: 'var(--border)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--secondary-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--secondary)';
            }}
          >
            Secondary Action
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
