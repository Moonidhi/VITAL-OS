import Sidebar from '../components/Sidebar.jsx'
import Header from '../components/Header.jsx'

export default function Patients() {
  return (
    <div className="flex h-screen overflow-hidden font-body">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header connected={false} lastUpdated={null} onRefresh={() => {}} />
        <main className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-base-elevated border border-base-border flex items-center justify-center">
              <span className="text-xl">🚧</span>
            </div>
            <div>
              <h1 className="font-display font-semibold text-xl text-text-primary">Patients</h1>
              <p className="text-text-faint text-sm mt-1">Coming Soon</p>
            </div>
            <p className="text-xs text-text-faint max-w-xs">
              This section is under construction and will be available in a future milestone.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
