import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/** Shows a message instead of a blank page if a screen crashes while rendering. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main role="alert">
        <h1>পেজটি দেখাতে সমস্যা হয়েছে</h1>
        <p>পেজটি আবার লোড করে দেখুন। সমস্যা থেকে গেলে একটু পরে আবার চেষ্টা করুন।</p>
        <button type="button" onClick={() => window.location.reload()}>
          আবার লোড করুন
        </button>
      </main>
    )
  }
}
