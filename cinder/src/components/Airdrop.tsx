import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Token } from '../types/index.ts';
import { Button } from './Button.jsx';
import ArrowRightIcon from '../../public/assets/arrow-right.svg';

interface AirdropProps {
    content: React.ReactNode;
    open: boolean;
    dead: Token | null;
    living: Token | null;
    onClose: () => void;
}

export const Airdrop: React.FC<AirdropProps> = ({ content, open, dead, living, onClose }) => {
    const [visible, setVisible] = useState(false);
    const [animate, setAnimate] = useState(false);
    const [userShare, setUserShare] = useState(0.00000272);

    useEffect(() => {
      if (open) {
        setVisible(true)
        requestAnimationFrame(() => setAnimate(true))
      } else {
        setAnimate(false)
        const timeout = setTimeout(() => setVisible(false), 300) // время анимации
        return () => clearTimeout(timeout)
      }
    }, [open])



    if (!visible) return null;

    const airdropContent = (
        <>
          <div
            className={`airdrop-backdrop ${animate ? 'airdrop-backdrop--visible' : ''}`}
            onClick={onClose}
          />
          <div className={`airdrop-overlay ${animate ? 'airdrop-overlay--open' : ''}`}>
            {dead && living && buildAirdropContent(dead, living, userShare, onClose)}
          </div>
        </>
      )

    return createPortal(airdropContent, document.body);
}

const buildAirdropContent = (dead: Token, living: Token, userShare: number, onClose: () => void) => {
    return (
        <div className="airdrop-content">
            <div className="airdrop-images">
              <img src={dead.image} alt={dead.ticker} />
              <img src={ArrowRightIcon} alt="arrow-right" className="airdrop-arrow" />
              <img src={living.image} alt={living.ticker} />
            </div>
            <div className="airdrop-text">
              <h2>Token {dead.ticker} has been dead</h2>
              <p><b>4K$</b> goes to holders of living token <b>{living.ticker}</b></p>
              <p>Your share: {userShare} {living.ticker}</p>
            </div>
            <div className="airdrop-button">
              <Button label="Keep swiping" variant="buy" className="airdrop-button" onClick={onClose}>Keep swiping</Button>
            </div>
        </div>
    )
}