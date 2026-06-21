export default function LoadingSpinner() {
  return (
    <div
      data-testid="loading-spinner"
      className="pointer-events-none fixed inset-0 flex items-center justify-center"
    >
      <div className="border-border border-t-primary h-10 w-10 animate-spin rounded-full border-4"></div>
    </div>
  )
}
