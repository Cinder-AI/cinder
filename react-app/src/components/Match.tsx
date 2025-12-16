import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BottomSheet } from './BottomSheet.jsx'
import { Button } from './Button.jsx'
import { TokenMedia } from './TokenMedia'
import WAIFU_VIDEO from '../assets/tokens/WAIFU.mp4'

import WAIFU_VIDEO2 from '../assets/tokens/WAIFU2.mp4'
import { useNavigate } from 'react-router-dom'

import { Campaign, Token } from '../types/index.ts'
import { processGraphqlStatus } from 'fuels'
import { formatNumber } from '../utils/index.ts'

interface MatchProps {
  open: boolean
  token: Token | null
  onClose: () => void
  onTradeNow: () => void
  onKeepSwiping: () => void
  container: HTMLElement | null
}

export const Match: React.FC<MatchProps> = ({
  open,
  token,
  onClose,
  onTradeNow,
  onKeepSwiping,
  container
}) => {
  const [visible, setVisible] = useState(false)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    console.log("token", token);
    if (open) {
      setVisible(true)

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true)
        })
      })
    } else {
      // Задержка для анимации закрытия
      setAnimate(false)
      const timer = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  const animateMatch = () => {

  }

  if (!visible || !token) return null

  const matchContent = (
    <div className={`match-overlay ${animate ? 'match-overlay--open' : ''}`}> 
      
      <div className="match-content">
        <h1 className="match-title">It's a match!</h1>
        
        <div className="match-card-wrapper">
          <div className="match-token-image-container">
            <TokenMedia
              media={
                token.id === 3
                  ? { type: 'video', src: WAIFU_VIDEO2, poster: token.image }
                  : token.media
              }
              fallbackSrc={token.image}
              alt={token.name}
              className="match-token-image"
            />
            <div className="match-token-overlay"></div>
            <div className="match-token-info">
              <p className="match-token-description">{token.description}</p>
              <p className="match-token-name">${token.name}</p>
            </div>
          </div>

        </div>

        <div className="match-stats">
          <p className="match-mcap">{token.ticker} has been launched! </p>
          <p className="match-24h">Your share: {formatNumber(11238)} {token.ticker}</p>
        </div>

        <div className="match-buttons">
          <Button type="buy" onClick={onTradeNow}>
            Trade now
          </Button>
          <Button type="sell" onClick={onKeepSwiping}>
            Keep Swiping
          </Button>
        </div>
      </div>
    </div>
  )

  // Используем portal для рендера поверх всего
  return createPortal(matchContent, container || document.body)
}