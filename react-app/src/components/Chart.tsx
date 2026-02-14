import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Token } from '../types/index'
import { formatNumber } from '../utils/index'
import { BondingCurve } from './BondingCurve'
import { sseApi, type ChartHistoryResponse, type ChartSummary } from '../services/indexerGraphQL'
import '@styles/components/chart.css'

interface ChartProps {
  token: Token;
  width?: number;
  height?: number;
}

type Point = {
  x: number;
  y: number;
}

const LINE_COLOR = '#22c55e'
const CANVAS_BG_COLOR = '#F5F5F5'
const LINE_WIDTH = 4
const SERIES_LENGTH = 120
const MIN_PRICE = 0.0000001
const DEFAULT_PRICE = 0.00000558
const MARKET_CAP_ANIMATION_MS = 1200
const HISTORY_WINDOW_SEC = 24 * 60 * 60
const HISTORY_INTERVAL_SEC = 5 * 60
const DEFAULT_SSE_URL = 'http://localhost:5002'

const clampProgress = (value?: number) => {
  const numeric = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return Math.min(Math.max(numeric, 0), 100)
}

const clampPrice = (price?: number) => Math.max(price || DEFAULT_PRICE, MIN_PRICE)

const toFiniteNumber = (value: unknown): number | undefined => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : undefined
}

const formatUsdDisplay = (value: number) => {
  const safe = Number.isFinite(value) ? Math.max(value, 0) : 0
  if (safe >= 1000) return formatNumber(safe)
  if (safe >= 1) return safe.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return safe.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })
}

const buildFallbackSeries = (token: Token): Point[] => {
  const base = clampPrice(token.price)
  return Array.from({ length: SERIES_LENGTH }, (_, index) => {
    const drift = 1 + index * 0.0002
    return { x: index, y: Number((base * drift).toFixed(8)) }
  })
}

const toPriceFromScaled = (priceScaled?: string) => {
  if (!priceScaled) return undefined
  const value = Number(priceScaled)
  if (!Number.isFinite(value)) return undefined
  return clampPrice(value / 1_000_000_000)
}

const toBigInt = (value: string | null | undefined) => {
  if (!value) return 0n
  try {
    return BigInt(value)
  } catch {
    return 0n
  }
}

const createSummaryFromPayload = (
  payload: Record<string, unknown>,
  priceScaledKey: 'priceScaled' | 'currentPriceScaled',
  priceKey: 'price' | 'currentPrice',
): ChartSummary | null => {
  const priceScaled = typeof payload[priceScaledKey] === 'string' ? String(payload[priceScaledKey]) : null
  const price =
    toPriceFromScaled(priceScaled ?? undefined) ??
    (Number.isFinite(Number(payload[priceKey])) ? clampPrice(Number(payload[priceKey])) : null)

  if (!priceScaled && price === null) return null
  return {
    firstPriceScaled: priceScaled,
    lastPriceScaled: priceScaled,
    firstPrice: price,
    lastPrice: price,
    priceChangePct: 0,
    highPriceScaled: priceScaled,
    lowPriceScaled: priceScaled,
    highPrice: price,
    lowPrice: price,
    volumeBase: '0',
    volumeToken: '0',
    tradeCount: 0,
  }
}

const applyPriceToSummary = (
  summary: ChartSummary | null,
  payload: Record<string, unknown>,
  priceScaledKey: 'priceScaled' | 'currentPriceScaled',
  priceKey: 'price' | 'currentPrice',
) => {
  const base = summary ?? createSummaryFromPayload(payload, priceScaledKey, priceKey)
  if (!base) return summary

  const priceScaled = typeof payload[priceScaledKey] === 'string' ? String(payload[priceScaledKey]) : null
  const nextPrice =
    toPriceFromScaled(priceScaled ?? undefined) ??
    (Number.isFinite(Number(payload[priceKey])) ? clampPrice(Number(payload[priceKey])) : null)

  const firstPrice = base.firstPrice ?? nextPrice
  const lastPrice = nextPrice ?? base.lastPrice
  const priceChangePct =
    firstPrice && lastPrice && firstPrice > 0 ? Number((((lastPrice - firstPrice) / firstPrice) * 100).toFixed(4)) : 0

  const prevHigh = toBigInt(base.highPriceScaled)
  const prevLow = toBigInt(base.lowPriceScaled || base.highPriceScaled)
  const nextScaled = toBigInt(priceScaled)

  const highScaled =
    priceScaled && (!base.highPriceScaled || nextScaled > prevHigh) ? priceScaled : base.highPriceScaled
  const lowScaled = priceScaled && (!base.lowPriceScaled || nextScaled < prevLow) ? priceScaled : base.lowPriceScaled

  return {
    ...base,
    lastPriceScaled: priceScaled ?? base.lastPriceScaled,
    lastPrice,
    firstPrice,
    priceChangePct,
    highPriceScaled: highScaled,
    lowPriceScaled: lowScaled,
    highPrice: toPriceFromScaled(highScaled ?? undefined) ?? base.highPrice,
    lowPrice: toPriceFromScaled(lowScaled ?? undefined) ?? base.lowPrice,
  }
}

const applyTradeToSummary = (summary: ChartSummary | null, payload: Record<string, unknown>) => {
  const next = applyPriceToSummary(summary, payload, 'priceScaled', 'price')
  if (!next) return next

  return {
    ...next,
    volumeBase: (toBigInt(next.volumeBase) + toBigInt(payload.amountBase as string | undefined)).toString(),
    volumeToken: (toBigInt(next.volumeToken) + toBigInt(payload.amountToken as string | undefined)).toString(),
    tradeCount: next.tradeCount + 1,
  }
}

const normalizeSeries = (prices: number[]): Point[] =>
  prices.slice(-SERIES_LENGTH).map((price, idx) => ({ x: idx, y: Number(clampPrice(price).toFixed(8)) }))

const appendPoint = (prev: Point[], price: number): Point[] => {
  const updated = [...prev, { x: prev.length, y: Number(clampPrice(price).toFixed(8)) }].slice(-SERIES_LENGTH)
  return updated.map((p, idx) => ({ x: idx, y: p.y }))
}

const pointsFromHistory = (history: ChartHistoryResponse): Point[] => {
  const fuelUsd = toFiniteNumber(history.fuelUsd)
  const seriesPrices = history.series
    .map((point) => {
      const priceUsd = toFiniteNumber(point.price_usd)
      if (priceUsd !== undefined && priceUsd > 0) return priceUsd
      if (fuelUsd !== undefined && Number.isFinite(point.price) && point.price > 0) return point.price * fuelUsd
      return point.price
    })
    .filter((value) => Number.isFinite(value) && value > 0)
  if (seriesPrices.length > 1) {
    return normalizeSeries(seriesPrices)
  }

  const candlePrices = history.candles
    .filter((candle) => candle.n > 0)
    .map((candle) => {
      const fuelPrice = toPriceFromScaled(candle.c)
      if (fuelPrice === undefined) return undefined
      return fuelUsd !== undefined ? fuelPrice * fuelUsd : fuelPrice
    })
    .filter((price): price is number => price !== undefined && Number.isFinite(price) && price > 0)
  return normalizeSeries(candlePrices)
}

const resolveBaseMarketCap = (token: Token, price: number) => {
  const cap = Number(token.marketCap)
  if (Number.isFinite(cap) && cap > 0) return cap

  const supply = Number(token.totalSupply)
  if (Number.isFinite(supply) && supply > 0) return Math.max(supply * price, 0)

  const pledged = Number(token.totalPledged)
  if (Number.isFinite(pledged) && pledged > 0) return Math.max(pledged, 0)

  const target = Number(token.target)
  const progress = Number(token.progress)
  if (Number.isFinite(target) && Number.isFinite(progress) && progress > 0) {
    return Math.max((target * progress) / 100, 0)
  }

  return 0
}

export const Chart = ({ token }: ChartProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [points, setPoints] = useState<Point[]>(() => buildFallbackSeries(token))
  const [lineProgress, setLineProgress] = useState(0)
  const basePrice = useMemo(() => clampPrice(token.price), [token.price])
  const baseCap = useMemo(() => resolveBaseMarketCap(token, basePrice), [token, basePrice])
  const [marketCapValue, setMarketCapValue] = useState(() => baseCap)
  const [historySummary, setHistorySummary] = useState<ChartSummary | null>(null)
  const [liveProgress, setLiveProgress] = useState(() => clampProgress(token.progress))
  const [liveMarketCapUsd, setLiveMarketCapUsd] = useState<number | null>(null)
  const [liveVolumeUsd, setLiveVolumeUsd] = useState<number | null>(null)
  const [fuelUsdQuote, setFuelUsdQuote] = useState<number | null>(null)

  const pointsRef = useRef(points)
  const lineProgressRef = useRef(lineProgress)
  const marketCapRef = useRef(marketCapValue)

  const latestPrice = useMemo(() => {
    if (!points.length) return basePrice
    return Number(points[points.length - 1].y.toFixed(8))
  }, [points, basePrice])

  const priceChange = useMemo(() => {
    if (historySummary && Number.isFinite(historySummary.priceChangePct)) {
      return Number(historySummary.priceChangePct.toFixed(2))
    }
    if (points.length < 2) return 0
    const first = points[0].y
    const last = points[points.length - 1].y
    return Number((((last - first) / first) * 100).toFixed(2))
  }, [historySummary, points])

  const displayProgress = useMemo(() => clampProgress(liveProgress), [liveProgress])

  const targetMarketCap = useMemo(() => {
    if (liveMarketCapUsd !== null && Number.isFinite(liveMarketCapUsd) && liveMarketCapUsd >= 0) {
      return liveMarketCapUsd
    }
    if (fuelUsdQuote !== null && Number.isFinite(fuelUsdQuote) && fuelUsdQuote > 0) {
      return Math.max(baseCap * fuelUsdQuote, 0)
    }
    return Math.max(baseCap, 0)
  }, [liveMarketCapUsd, baseCap, fuelUsdQuote])

  const marketCapDisplay = useMemo(() => formatUsdDisplay(marketCapValue), [marketCapValue])

  const volumeDisplay = useMemo(() => {
    if (liveVolumeUsd !== null && Number.isFinite(liveVolumeUsd) && liveVolumeUsd >= 0) {
      return formatUsdDisplay(liveVolumeUsd)
    }
    if (historySummary) {
      const historyVolumeUsd = Number(historySummary.volumeUsd)
      if (Number.isFinite(historyVolumeUsd) && historyVolumeUsd >= 0) {
        return formatUsdDisplay(historyVolumeUsd)
      }
      const historyVolume = Number(historySummary.volumeBase)
      if (Number.isFinite(historyVolume) && historyVolume >= 0) {
        if (fuelUsdQuote !== null && Number.isFinite(fuelUsdQuote) && fuelUsdQuote > 0) {
          return formatUsdDisplay(historyVolume * fuelUsdQuote)
        }
        return formatUsdDisplay(historyVolume)
      }
    }
    const baseVolume = Number.isFinite(token.volume24h) ? token.volume24h : baseCap * 0.35
    if (fuelUsdQuote !== null && Number.isFinite(fuelUsdQuote) && fuelUsdQuote > 0) {
      return formatUsdDisplay(baseVolume * fuelUsdQuote)
    }
    return formatUsdDisplay(baseVolume)
  }, [liveVolumeUsd, historySummary, token.volume24h, baseCap, fuelUsdQuote])

  useEffect(() => {
    let cancelled = false
    const toTs = Math.floor(Date.now() / 1000)
    const fromTs = toTs - HISTORY_WINDOW_SEC

    const loadHistory = async () => {
      try {
        const snapshotResponse = await sseApi.getCampaignSnapshot(String(token.id))
        if (!cancelled) {
          const snapshot = snapshotResponse.snapshot
          const quoteUsd = toFiniteNumber(snapshot.fuelUsd)
          if (quoteUsd !== undefined && quoteUsd > 0) {
            setFuelUsdQuote(quoteUsd)
          }
          const marketCapUsd = toFiniteNumber(snapshot.marketCapUsd)
          if (marketCapUsd !== undefined) {
            setLiveMarketCapUsd(Math.max(marketCapUsd, 0))
          }
          const totalVolumeUsd = toFiniteNumber(snapshot.totalVolumeUsd)
          if (totalVolumeUsd !== undefined) {
            setLiveVolumeUsd(Math.max(totalVolumeUsd, 0))
          }
          if (Number.isFinite(Number(snapshot.progress))) {
            setLiveProgress(clampProgress(Number(snapshot.progress)))
          }
        }
      } catch (error) {
        console.warn('Failed to load campaign snapshot:', error)
      }

      try {
        const history = await sseApi.getChartHistory(String(token.id), {
          fromTs,
          toTs,
          intervalSec: HISTORY_INTERVAL_SEC,
        })
        if (cancelled) return
        const historyPoints = pointsFromHistory(history)
        const nextSeries = historyPoints.length > 0 ? historyPoints : buildFallbackSeries(token)
        setPoints(nextSeries)
        pointsRef.current = nextSeries
        setHistorySummary(history.summary ?? null)
        const historyQuote = toFiniteNumber(history.fuelUsd)
        if (historyQuote !== undefined && historyQuote > 0) {
          setFuelUsdQuote(historyQuote)
        }
      } catch (error) {
        console.error('Failed to load chart history:', error)
        if (cancelled) return
        const fallback = buildFallbackSeries(token)
        setPoints(fallback)
        pointsRef.current = fallback
        setHistorySummary(null)
      }
    }

    loadHistory()
    setLineProgress(0)
    lineProgressRef.current = 0
    setMarketCapValue(baseCap)
    marketCapRef.current = baseCap
    setLiveProgress(clampProgress(token.progress))
    setLiveMarketCapUsd(null)
    setLiveVolumeUsd(null)
    setFuelUsdQuote(null)
    setHistorySummary(null)
    return () => {
      cancelled = true
    }
  }, [token.id, baseCap, token.progress])

  useEffect(() => {
    let animationId = 0
    const start = performance.now()

    const animate = (timestamp: number) => {
      const elapsed = timestamp - start
      const t = Math.min(elapsed / MARKET_CAP_ANIMATION_MS, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setLineProgress(eased)
      if (t < 1) animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [token.id])

  useEffect(() => {
    let animationId = 0
    const from = marketCapRef.current
    const start = performance.now()

    const animate = (timestamp: number) => {
      const elapsed = timestamp - start
      const t = Math.min(elapsed / MARKET_CAP_ANIMATION_MS, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = from + (targetMarketCap - from) * eased
      setMarketCapValue(next)
      marketCapRef.current = next
      if (t < 1) animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [targetMarketCap])

  useEffect(() => {
    const baseUrl = (import.meta.env.VITE_SSE_URL || DEFAULT_SSE_URL).replace(/\/+$/, '')
    const source = new EventSource(`${baseUrl}/sse?campaignId=${encodeURIComponent(String(token.id))}`)

    const handleTrade = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data)
        const quoteUsd = toFiniteNumber(payload.fuelUsd)
        if (quoteUsd !== undefined && quoteUsd > 0) {
          setFuelUsdQuote(quoteUsd)
        }
        const priceUsd = toFiniteNumber(payload.priceUsd)
        const price =
          (priceUsd !== undefined ? clampPrice(priceUsd) : undefined) ??
          toPriceFromScaled(payload.priceScaled) ??
          (Number.isFinite(Number(payload.price)) ? clampPrice(Number(payload.price)) : undefined)
        if (price === undefined) return
        setPoints((prev) => appendPoint(prev.length ? prev : buildFallbackSeries(token), price))
        setHistorySummary((prev) => applyTradeToSummary(prev, payload))
      } catch (error) {
        console.error('Failed to parse trade_created event:', error)
      }
    }

    const handleCampaign = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data)
        const quoteUsd = toFiniteNumber(payload.fuelUsd)
        if (quoteUsd !== undefined && quoteUsd > 0) {
          setFuelUsdQuote(quoteUsd)
        }
        const priceUsd = toFiniteNumber(payload.currentPriceUsd)
        const price = (priceUsd !== undefined ? clampPrice(priceUsd) : undefined) ?? toPriceFromScaled(payload.currentPriceScaled)
        if (price !== undefined) {
          setPoints((prev) => appendPoint(prev.length ? prev : buildFallbackSeries(token), price))
        }
        setHistorySummary((prev) => {
          const next = applyPriceToSummary(prev, payload, 'currentPriceScaled', 'currentPrice')
          if (!next) return next
          const totalVolumeBase =
            typeof payload.totalVolumeBase === 'string' ? payload.totalVolumeBase : next.volumeBase
          const totalVolumeUsd = toFiniteNumber(payload.totalVolumeUsd)
          return {
            ...next,
            volumeBase: totalVolumeBase,
            volumeUsd: totalVolumeUsd ?? next.volumeUsd,
          }
        })
        if (Number.isFinite(Number(payload.progress))) {
          setLiveProgress(clampProgress(Number(payload.progress)))
        } else if (payload.curveSoldSupply && payload.curveMaxSupply) {
          const sold = toBigInt(payload.curveSoldSupply as string)
          const max = toBigInt(payload.curveMaxSupply as string)
          if (max > 0n) {
            setLiveProgress(clampProgress(Number((sold * 10000n) / max) / 100))
          }
        }
        const marketCapUsd = toFiniteNumber(payload.marketCapUsd)
        if (marketCapUsd !== undefined) {
          setLiveMarketCapUsd(Math.max(marketCapUsd, 0))
        } else if (Number.isFinite(Number(payload.marketCapBase))) {
          setLiveMarketCapUsd(Math.max(Number(payload.marketCapBase), 0))
        }
        const totalVolumeUsd = toFiniteNumber(payload.totalVolumeUsd)
        if (totalVolumeUsd !== undefined) {
          setLiveVolumeUsd(Math.max(totalVolumeUsd, 0))
        }
      } catch (error) {
        console.error('Failed to parse campaign_updated event:', error)
      }
    }

    source.addEventListener('trade_created', handleTrade as EventListener)
    source.addEventListener('campaign_updated', handleCampaign as EventListener)
    source.onerror = () => {
      // EventSource auto-reconnects; keep quiet to avoid noisy logs.
    }

    return () => {
      source.removeEventListener('trade_created', handleTrade as EventListener)
      source.removeEventListener('campaign_updated', handleCampaign as EventListener)
      source.close()
    }
  }, [token.id, token.price])

  useEffect(() => {
    pointsRef.current = points
    if (canvasRef.current) {
      drawSmoothLine(canvasRef.current, points, lineProgressRef.current || 0)
    }
  }, [points])

  useEffect(() => {
    lineProgressRef.current = lineProgress || 0
    if (canvasRef.current) {
      drawSmoothLine(canvasRef.current, pointsRef.current, lineProgressRef.current || 0)
    }
  }, [lineProgress])

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return

    const canvas = canvasRef.current
    const container = containerRef.current

    const handleResize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
      drawSmoothLine(canvas, pointsRef.current, lineProgressRef.current || 0)
    }

    handleResize()

    let observer: ResizeObserver | null = null
    let fallbackListenerAttached = false

    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(handleResize)
      observer.observe(container)
    } else {
      fallbackListenerAttached = true
      window.addEventListener('resize', handleResize)
    }

    return () => {
      observer?.disconnect()
      if (fallbackListenerAttached) {
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  return (
    <div className="chart-wrapper">
      <div className="chart-header">
        <ChartHeader marketCap={marketCapDisplay} priceChange={priceChange} price={latestPrice} />
      </div>

      <div ref={containerRef} className="chart-canvas-container">
        <canvas ref={canvasRef} className="chart-canvas" />
      </div>

      <div className="chart-footer">
        <ChartStats progress={displayProgress} volume={volumeDisplay} />
      </div>
    </div>
  )
}

const ChartHeader = ({ marketCap, priceChange, price }: { marketCap: string; priceChange: number; price: number }) => {
  const isPositive = priceChange >= 0

  return (
    <>
      <div className="chart-label">Market Cap</div>
      <div className="chart-value">
        ${marketCap}
        <span className={isPositive ? 'positive' : 'negative'}>
          ({isPositive ? '+' : ''}{priceChange.toFixed(2)}%)
        </span>
        <span className="chart-timeframe">in the last 24hr</span>
      </div>
      <div className="chart-price">Price: ${price.toFixed(8)}</div>
    </>
  )
}

const ChartStats = ({ progress, volume }: { progress: number; volume: string }) => {
  return (
    <>
      <div className="chart-volume">
        Vol 24h: ${volume}
      </div>
      <BondingCurve progress={progress} showText={false} />
    </>
  )
}

const drawSmoothLine = (canvas: HTMLCanvasElement, rawPoints: { x: number; y: number }[], visiblePortion = 1) => {
  const ctx = canvas.getContext('2d')
  if (!ctx || !rawPoints.length) return

  ctx.fillStyle = CANVAS_BG_COLOR
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const xValues = rawPoints.map(p => p.x)
  const yValues = rawPoints.map(p => p.y)
  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)

  const baseY = rawPoints[0]?.y ?? 1
  const maxDelta = Math.max(...yValues.map(y => Math.abs(y - baseY)), baseY * 0.02)
  const minY = baseY - maxDelta
  const maxY = baseY + maxDelta

  const padding = 10
  const chartWidth = canvas.width - padding * 2
  const chartHeight = canvas.height - padding * 2

  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1

  const normalizedPoints = rawPoints.map(p => ({
    x: padding + ((p.x - minX) / rangeX) * chartWidth,
    y: padding + chartHeight - ((p.y - minY) / rangeY) * chartHeight
  }))

  const portion = Math.min(Math.max(visiblePortion, 0), 1)
  const sliceCount = Math.max(2, Math.ceil(normalizedPoints.length * portion))
  const pts = normalizedPoints.slice(0, sliceCount)
  if (pts.length < 2) return

  const drawSmoothPath = () => {
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2
      const yc = (pts[i].y + pts[i + 1].y) / 2
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc)
    }
    const last = pts[pts.length - 1]
    ctx.quadraticCurveTo(last.x, last.y, last.x, last.y)
  }

  ctx.beginPath()
  drawSmoothPath()

  const lastPoint = pts[pts.length - 1]
  ctx.lineTo(lastPoint.x, canvas.height - padding)
  ctx.lineTo(pts[0].x, canvas.height - padding)
  ctx.closePath()

  const gradient = ctx.createLinearGradient(0, padding, 0, canvas.height - padding)
  gradient.addColorStop(0, 'rgba(34, 197, 94, 0.15)')
  gradient.addColorStop(1, 'rgba(34, 197, 94, 0)')
  ctx.fillStyle = gradient
  ctx.fill()

  ctx.beginPath()
  drawSmoothPath()
  ctx.strokeStyle = LINE_COLOR
  ctx.lineWidth = LINE_WIDTH
  ctx.stroke()
}