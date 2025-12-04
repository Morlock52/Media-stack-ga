import { DashboardBentoGrid } from './modern/DashboardBentoGrid'
import { ProgressCharts } from './ProgressCharts'
import { QuickActions } from './QuickActions'

export function DashboardPage() {
  return (
    <div className="space-y-16">
      <DashboardBentoGrid />
      <ProgressCharts />
      <QuickActions />
    </div>
  )
}
