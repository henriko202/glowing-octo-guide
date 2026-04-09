export default function LoadingSpinner() {
  return (
    <div data-testid="loading-spinner" className="pointer-events-none fixed inset-0 flex items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500"></div>
    </div>
  )
}
