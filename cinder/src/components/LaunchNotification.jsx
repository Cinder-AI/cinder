import { BottomSheet } from './BottomSheet.jsx'
import { Button } from './Button.jsx'

export function LaunchNotification({ 
  open, 
  onClose, 
  tokenName, 
  userShare, 
  isCreator, 
  onStartTrading 
}) {
  return (
    <BottomSheet open={open} onClose={onClose} height="auto">
      <div className="launch-notification">
        <div className="launch-icon">🚀</div>
        <h2 className="launch-title">Token Launched!</h2>
        <p className="launch-message">
          <strong>{tokenName}</strong> has successfully launched and is now available for trading!
        </p>
        
        <div className="launch-rewards">
          <div className="reward-item">
            <span className="reward-label">Your Share:</span>
            <span className="reward-value">{userShare}</span>
          </div>
          {isCreator && (
            <div className="reward-item bonus">
              <span className="reward-label">Creator Bonus:</span>
              <span className="reward-value">+10% 🎉</span>
            </div>
          )}
        </div>

        <Button 
          className="start-trading-btn" 
          onClick={onStartTrading}
        >
          Start Trading
        </Button>
      </div>
    </BottomSheet>
  )
}






