import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Token } from '../types/index'
import { formatNumber } from '../utils/index'
import { BondingCurve } from './BondingCurve'
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
const TICK_MS = 900
const JUMP_PROBABILITY = 0.22
const JUMP_MIN = 0.985   // до -1.5% за тик
const JUMP_MAX = 1.06    // до +6% за тик
const MIN_PRICE = 0.0000001
const DEFAULT_PRICE = 0.00000558
const NOISE = 0.001
const MARKET_CAP_ANIMATION_MS = 1200

const clampProgress = (value?: number) => {
  const numeric = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  return Math.min(Math.max(numeric, 0), 100)
}

const clampPrice = (price?: number) => Math.max(price || DEFAULT_PRICE, MIN_PRICE)

const buildSeries = (token: Token): Point[] => {
  const base = clampPrice(token.price)
  const targetChange = Number.isFinite(token.price24Change) ? token.price24Change : 4
  const targetPrice = clampPrice(base * (1 + targetChange / 100))
  const step = Math.pow(targetPrice / base || 1, 1 / Math.max(SERIES_LENGTH - 1, 1))

  let current = base
  return Array.from({ length: SERIES_LENGTH }, (_, index) => {
    if (index > 0) {
      const noise = 1 + ((Math.random() - 0.5) * NOISE)
      current = clampPrice(current * step * noise)
    }
    return { x: index, y: Number(current.toFixed(8)) }
  })
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
  const [points, setPoints] = useState<Point[]>(() => buildSeries(token))
  const [lineProgress, setLineProgress] = useState(0)
  const basePrice = useMemo(() => clampPrice(token.price), [token.price])
  const baseCap = useMemo(() => resolveBaseMarketCap(token, basePrice), [token, basePrice])
  const [marketCapValue, setMarketCapValue] = useState(() => baseCap)
  const [displayProgress, setDisplayProgress] = useState(80)

  const pointsRef = useRef(points)
  const lineProgressRef = useRef(lineProgress)
  const marketCapRef = useRef(marketCapValue)
  const progressAnimId = useRef<number | null>(null)

  const latestPrice = useMemo(() => {
    if (!points.length) return basePrice
    return Number(points[points.length - 1].y.toFixed(8))
  }, [points, basePrice])

  const priceChange = useMemo(() => {
    if (points.length < 2) return 0
    const first = points[0].y
    const last = points[points.length - 1].y
    return Number((((last - first) / first) * 100).toFixed(2))
  }, [points])

  const progress = useMemo(() => clampProgress(token.progress), [token.progress])

  const targetMarketCap = useMemo(() => {
    if (!basePrice) return 0
    const ratio = latestPrice / basePrice
    return Math.max(baseCap * ratio, 0)
  }, [baseCap, basePrice, latestPrice])

  const marketCapDisplay = useMemo(() => formatNumber(Math.max(marketCapValue, 0)), [marketCapValue])

  const volumeDisplay = useMemo(() => {
    const baseVolume = Number.isFinite(token.volume24h) ? token.volume24h : baseCap * 0.35
    const ratio = basePrice ? latestPrice / basePrice : 1
    return formatNumber(Math.max(baseVolume * ratio, 0))
  }, [token.volume24h, baseCap, basePrice, latestPrice])

  useEffect(() => {
    const series = buildSeries(token)
    setPoints(series)
    pointsRef.current = series
    setLineProgress(0)
    lineProgressRef.current = 0
    setMarketCapValue(baseCap)
    marketCapRef.current = baseCap
    setDisplayProgress(80)
  }, [token.id, token.price, token.price24Change, baseCap])

  useEffect(() => {
    let animationId = 0
    const start = performance.now()

    const from = marketCapRef.current
    const animate = (timestamp: number) => {
      const elapsed = timestamp - start
      const t = Math.min(elapsed / MARKET_CAP_ANIMATION_MS, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setLineProgress(eased)
      const next = Math.floor(from + (targetMarketCap - from) * eased)
      setMarketCapValue(next)
      marketCapRef.current = next
      if (t < 1) animationId = requestAnimationFrame(animate)
    }

    animationId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationId)
  }, [targetMarketCap])

  useEffect(() => {
    const start = 80
    const target = Math.max(clampProgress(token.progress), 80)
    setDisplayProgress(start)

    const step = Math.max((target - start) / 60, 0.2) // плавный рост ~18s max
    const interval = window.setInterval(() => {
      setDisplayProgress(prev => {
        if (prev >= target) return target
        return Math.min(prev + step, target)
      })
    }, 300)

    return () => window.clearInterval(interval)
  }, [token.id, token.progress])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPoints(prev => {
        if (!prev.length) return prev
        const last = prev[prev.length - 1]
        const dir = Math.random() < 0.42 ? -1 : 1
        const drift = 1 + dir * 0.0038 // ±0.38%
        const noise = 1 + ((Math.random() - 0.5) * 0.004)
        const jump = Math.random() < JUMP_PROBABILITY
          ? JUMP_MIN + Math.random() * (JUMP_MAX - JUMP_MIN)
          : 1
        const nextY = clampPrice(last.y * drift * noise * jump)
        const nextPoint = { x: last.x + 1, y: Number(nextY.toFixed(8)) }
        const updated = [...prev, nextPoint].slice(-SERIES_LENGTH)
        return updated.map((p, idx) => ({ x: idx, y: p.y }))
      })
    }, TICK_MS)

    return () => window.clearInterval(interval)
  }, [token.id])

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