import { useRef, useState } from 'react'
import { Button } from '../components/Button.jsx'
import { Field, TextArea } from '../components/Field.jsx'
import { AmountSelector } from '../components/AmountSelector.jsx'
import { BottomSheet } from '../components/BottomSheet.jsx'
import { CoinCreatedNotification } from '../components/notifications/CoinCreatedNotification.jsx'
import { useStore } from '../store/StoreProvider.jsx'
import { useContracts } from '../hooks/useContracts.tsx'

export function CreateTokenPage() {
  const { refreshCampaigns } = useStore()
  const contracts = useContracts()
  const launchpad = contracts?.launchpad
  const storageBaseUrl = import.meta.env.VITE_STORAGE_URL || 'http://localhost:8000'
  const [name, setName] = useState('')
  const [ticker, setTicker] = useState('')
  const [description, setDescription] = useState('')
  const [aiCharacterPrompt, setAiCharacterPrompt] = useState('')
  const [amount, setAmount] = useState(10000)
  const [imageData, setImageData] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [createdToken, setCreatedToken] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const fileInputRef = useRef(null)

  function onFile(file) {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) return alert('Max 10MB')
    const reader = new FileReader()
    reader.onload = (e) => setImageData(e.target.result)
    reader.readAsDataURL(file)
  }

  function resolveStorageUrl(path) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path
    const prefix = path.startsWith('/') ? '' : '/'
    return `${storageBaseUrl}${prefix}${path}`
  }

  async function uploadImage(file) {
    const formData = new FormData()
    formData.append('file', file)
    const response = await fetch(`${storageBaseUrl}/upload`, {
      method: 'POST',
      body: formData
    })
    if (!response.ok) {
      const message = await response.text().catch(() => '')
      throw new Error(message || 'Image upload failed')
    }
    const data = await response.json()
    return resolveStorageUrl(data.url || '')
  }

  async function handleCreate() {
    if (!name || !ticker) return alert('Please fill in coin name and ticker')
    if (!imageData) return alert('Please select an image')
    if (!launchpad) return alert('Connect wallet to create a campaign')
    if (isCreating) return
    setIsCreating(true)
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setIsCreating(false)
      return alert('Please select an image')
    }
    let imageUrl = ''
    try {
      imageUrl = await uploadImage(file)
    } catch (error) {
      setIsCreating(false)
      return alert(error?.message || 'Failed to upload image')
    }
    const token = {
      name: name,
      description: description,
      image: imageUrl,
      ticker: ticker,
      progress: 0,
      creator: 'user',
      marketCap: 0,
      price: 0.00000001,
      price24Change: '+0.00%',
      volume24h: 0,
      isBoosted: true,
      totalPledged: 0,
      totalSupply: 0,
      target: 1000000
    }
    try {
      const { waitForResult } = await launchpad.functions
        .create_campaign(name.trim(), ticker.trim(), description ?? '', imageUrl)
        .call()
      const { value: assetId } = await waitForResult()
      const created = { ...token, assetId: assetId?.bits || '' }
      setCreatedToken(created)
      refreshCampaigns().catch((error) => {
        console.error('Failed to refresh campaigns:', error)
      })
      setSheetOpen(true)
    } catch (error) {
      alert(error?.message || 'Failed to create campaign')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="create-token-page">
      <h1>Create Coin</h1>
      <div className="image-upload-field" onClick={() => fileInputRef.current?.click()}>
        {imageData ? (
          <img className="image-preview" alt="Preview" src={imageData} />
        ) : (
          <div className="upload-content">
            <div className="upload-icon"><img src="/assets/select_image.png" width={48} height={48} /></div>
            <p className="upload-text">Select Image</p>
            <p className="upload-subtext"></p>
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
      </div>

      <div className="token-name-fields">
        <Field title="Coin Name" placeholder="Enter coin name" value={name} onChange={setName} />
        <Field title="Coin Ticker" placeholder="Enter coin ticker" value={ticker} onChange={setTicker} />
      </div>

      <div className="token-description-field">
        <TextArea title="Token Description" placeholder="Enter token description" value={description} onChange={setDescription} />
      </div>

      <div className="ai-settings-field">
        <TextArea title="AI Character Prompt" placeholder="Set AI Character behavior" value={aiCharacterPrompt} onChange={setAiCharacterPrompt} />
      </div>
      
      <div className="amount-selector-field">
        <h3>CIN Sacrifice</h3>
        <p>More you burn, the longer you shine</p>
        <AmountSelector balance={'250 CIN'} showButtons={false} tokenName={'CIN'} onAmountChange={setAmount} />
      </div>

      <div className="create-button-container">
        <Button type="buy" label={isCreating ? 'Creating...' : 'Create coin'} onClick={handleCreate} />
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <CoinCreatedNotification token={createdToken} />
      </BottomSheet>
    </div>
  )
}

