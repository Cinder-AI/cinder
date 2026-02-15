import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from './Button'
import { TokenMedia } from './TokenMedia'
import { Token } from '../types/index'

interface TokenDetailsProps {
  token: Token
}

export const TokenDetails = ({ token }: TokenDetailsProps) => {
  const navigate = useNavigate()
  console.log(token)
  
  if (!token) {
    return <div>Token not found</div>
  }

  const image = token.image
  console.log(image)

  return (
    <div className="token-details">
      <div className="token-details-info">
        <div className="token-details-image">
          <TokenMedia
            media={token.media}
            fallbackSrc={image}
            alt={token.name}
            className="token-details-image-media"
            objectFit="cover"
            showPosterOnly={true}
          />
        </div>
        <div className="token-details-name">
          <p className="token-details-name-description">{token.description}</p>
          <p className="token-details-name-ticker">{token.ticker}</p>
        </div>
      </div>
      <div className="token-details-chat-button">
        <Button type="sell" onClick={() => navigate(`/chat/${token.id}`)}>
          Chat
        </Button>
      </div>
    </div>
  )
}