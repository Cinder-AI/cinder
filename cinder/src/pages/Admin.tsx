import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  indexerGraphQL,
  type AdminOverview,
  type CampaignRecord,
  type CampaignSnapshot,
  type CampaignStatusCounts,
  type DailyTrendPoint,
} from '../services/indexerGraphQL'

const DEFAULT_SSE_URL = 'http://localhost:5002'
const BASE_DECIMALS = 9
const RECONCILE_DELAY_MS = 12000
const POLLING_MS = 60000

type TradeCreatedEvent = {
  type: 'trade_created'
  campaignId: string
  amountBase?: string | null
  timestamp?: string | null
}

function toBigInt(value?: string | number | null): bigint {
  if (value === null || value === undefined) return 0n
  try {
    return BigInt(value)
  } catch {
    return 0n
  }
}

function fromBaseUnits(raw: string, decimals: number = BASE_DECIMALS): number {
  const base = toBigInt(raw)
  const divisor = 10n ** BigInt(decimals)
  const whole = base / divisor
  const fraction = base % divisor
  const fractionStr = fraction.toString().padStart(decimals, '0').slice(0, 2)
  return Number(`${whole.toString()}.${fractionStr}`)
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatUsdFromBase(raw: string): string {
  return `$${formatCompact(fromBaseUnits(raw))}`
}

function polylineFromTrend(trend: DailyTrendPoint[], maxPoints: number = 12): string {
  const points = trend.slice(-maxPoints)
  if (!points.length) return ''
  const values = points.map((p) => fromBaseUnits(p.total_volume_base))
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const width = 200
  const height = 56

  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width
      const normalized = max === min ? 0.5 : (value - min) / (max - min)
      const y = height - normalized * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function statusClass(status: string): string {
  const normalized = String(status || '').toLowerCase()
  if (normalized === 'active') return 'is-active'
  if (normalized === 'migrated') return 'is-migrated'
  if (normalized === 'denied') return 'is-denied'
  if (normalized === 'deleted' || normalized === 'dead') return 'is-dead'
  return ''
}

export function AdminPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [statusCounts, setStatusCounts] = useState<CampaignStatusCounts | null>(null)
  const [dailyTrend, setDailyTrend] = useState<DailyTrendPoint[]>([])
  const [topCampaigns, setTopCampaigns] = useState<CampaignRecord[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())

  const reconcileTimerRef = useRef<number | null>(null)

  const refreshDashboard = useCallback(async (showLoader: boolean) => {
    try {
      if (showLoader) setIsLoading(true)
      setError(null)

      const [nextOverview, nextStatuses, nextTrend, nextTop] = await Promise.all([
        indexerGraphQL.getAdminOverview(),
        indexerGraphQL.getCampaignStatusCounts(),
        indexerGraphQL.getDailyTrend(30),
        indexerGraphQL.getTopCampaigns(8),
      ])

      setOverview(nextOverview)
      setStatusCounts(nextStatuses)
      setDailyTrend(nextTrend)
      setTopCampaigns(nextTop)
      setLastUpdated(Date.now())
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Failed to load admin dashboard'
      setError(message)
    } finally {
      if (showLoader) setIsLoading(false)
    }
  }, [])

  const scheduleReconcile = useCallback(() => {
    if (reconcileTimerRef.current) return
    reconcileTimerRef.current = window.setTimeout(async () => {
      reconcileTimerRef.current = null
      await refreshDashboard(false)
    }, RECONCILE_DELAY_MS)
  }, [refreshDashboard])

  useEffect(() => {
    refreshDashboard(true)
  }, [refreshDashboard])

  useEffect(() => {
    const timer = window.setInterval(() => {
      refreshDashboard(false)
    }, POLLING_MS)
    return () => window.clearInterval(timer)
  }, [refreshDashboard])

  // SSE теперь работает глобально в StoreProvider, поэтому локальный SSE убран

  const trendLine = useMemo(() => polylineFromTrend(dailyTrend), [dailyTrend])
  const activeUsers30d = useMemo(
    () => dailyTrend.reduce((sum, day) => sum + Number(day.unique_users || 0), 0),
    [dailyTrend],
  )

  return (
    <div className={`admin-dashboard ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <aside
        className={[
          'admin-sidebar',
          sidebarCollapsed ? 'is-collapsed' : '',
          mobileSidebarOpen ? 'is-open' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="admin-sidebar-brand">
          <button
            className="admin-icon-btn"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '»' : '«'}
          </button>
          {!sidebarCollapsed && (
            <div className="admin-brand-copy">
              <strong>Cinder</strong>
              <span>Admin</span>
            </div>
          )}
        </div>

        <nav className="admin-nav">
          <button className="admin-nav-item is-active">Dashboard</button>
          <button className="admin-nav-item">Campaigns</button>
          <button className="admin-nav-item">Users</button>
          <button className="admin-nav-item">System</button>
        </nav>
      </aside>

      {mobileSidebarOpen && (
        <button
          className="admin-sidebar-overlay"
          onClick={() => setMobileSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <main className="admin-main">
        <div className="admin-main-toolbar">
          <button className="admin-icon-btn admin-mobile-menu" onClick={() => setMobileSidebarOpen(true)}>
            ☰
          </button>
          <div className="admin-live-chip">
            <span className={`dot ${isLive ? 'is-live' : ''}`} />
            {isLive ? 'Live' : 'Polling'}
          </div>
          <div className="admin-toolbar-spacer" />
          <button className="admin-refresh-btn" onClick={() => refreshDashboard(false)}>
            Refresh
          </button>
        </div>

        {isLoading && <div className="admin-state">Loading dashboard...</div>}
        {!isLoading && error && <div className="admin-state is-error">{error}</div>}

        {!isLoading && !error && (
          <>
            <section className="admin-kpi-grid">
              <article className="admin-kpi-card">
                <h4>DAU</h4>
                <p>{formatCompact(overview?.dau || 0)}</p>
              </article>
              <article className="admin-kpi-card">
                <h4>WAU</h4>
                <p>{formatCompact(overview?.wau || 0)}</p>
              </article>
              <article className="admin-kpi-card">
                <h4>MAU</h4>
                <p>{formatCompact(overview?.mau || 0)}</p>
              </article>
              <article className="admin-kpi-card">
                <h4>Total Users</h4>
                <p>{formatCompact(overview?.totalUsers || 0)}</p>
              </article>
              <article className="admin-kpi-card">
                <h4>Total Volume (30d)</h4>
                <p className="is-gradient">{formatUsdFromBase(overview?.totalVolume30d || '0')}</p>
              </article>
              <article className="admin-kpi-card">
                <h4>Total Volume (all)</h4>
                <p>{formatUsdFromBase(overview?.totalVolumeAll || '0')}</p>
              </article>
            </section>

            <section className="admin-status-grid">
              <article className="admin-status-card">
                <h5>Launched</h5>
                <p>{formatCompact(statusCounts?.launched || 0)}</p>
              </article>
              <article className="admin-status-card">
                <h5>Migrated</h5>
                <p>{formatCompact(statusCounts?.migrated || 0)}</p>
              </article>
              <article className="admin-status-card">
                <h5>Denied</h5>
                <p>{formatCompact(statusCounts?.denied || 0)}</p>
              </article>
              <article className="admin-status-card">
                <h5>Dead</h5>
                <p>{formatCompact(statusCounts?.dead || 0)}</p>
              </article>
            </section>

            <section className="admin-content-grid">
              <article className="admin-card">
                <div className="admin-card-head">
                  <h3>Volume trend (30d)</h3>
                  <span>{formatCompact(activeUsers30d)} user-visits</span>
                </div>
                <div className="admin-trend-chart">
                  <svg viewBox="0 0 200 56" preserveAspectRatio="none">
                    <polyline points={trendLine} />
                  </svg>
                </div>
                <div className="admin-trend-bars">
                  {dailyTrend.slice(-14).map((day) => (
                    <div
                      key={day.date_start}
                      className="bar"
                      style={{
                        height: `${Math.max(
                          10,
                          Math.min(100, (fromBaseUnits(day.total_volume_base) / Math.max(fromBaseUnits(overview?.totalVolume30d || '1'), 1)) * 2200),
                        )}%`,
                      }}
                      title={`Volume ${formatUsdFromBase(day.total_volume_base)}`}
                    />
                  ))}
                </div>
              </article>

              <article className="admin-card">
                <div className="admin-card-head">
                  <h3>Top campaigns</h3>
                  <span>By total volume</span>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Campaign</th>
                        <th>Status</th>
                        <th>Pledged</th>
                        <th>Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topCampaigns.map((campaign) => (
                        <tr key={campaign.id}>
                          <td>
                            <div className="campaign-cell">
                              <strong>{campaign.ticker || campaign.name || campaign.id}</strong>
                              <span>{campaign.creator_id}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`status-chip ${statusClass(campaign.status)}`}>{campaign.status || 'unknown'}</span>
                          </td>
                          <td>{formatUsdFromBase(campaign.total_pledged || '0')}</td>
                          <td>{formatUsdFromBase(campaign.total_volume_base || '0')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </section>
          </>
        )}

        <div className="admin-footnote">
          Last update: {new Date(lastUpdated).toLocaleString()}
        </div>
      </main>
    </div>
  )
}
