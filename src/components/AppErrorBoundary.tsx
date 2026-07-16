import React from "react";

type State = { error: Error | null };
export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("SecuredLanding render crash", error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-xl rounded-2xl border border-rose-400/30 bg-white/10 p-6">
          <h1 className="text-2xl font-black">We found a page error</h1>
          <p className="mt-3 text-slate-300">Take a screenshot of the message below so the exact remaining issue can be repaired.</p>
          <pre className="mt-5 overflow-auto whitespace-pre-wrap rounded-xl bg-black/40 p-4 text-sm text-rose-200">{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-amber-500 px-5 py-3 font-bold text-slate-950">Reload page</button>
        </div>
      </main>
    );
  }
}
