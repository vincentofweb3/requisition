import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { BundleError, encodeBundle, parseBundleInput } from '@/lib/requisition'
import { Button, Notice } from './ui'

export default function OpenBundle({ compact }: { compact?: boolean }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  const navigate = useNavigate()

  const open = () => {
    try {
      const bundle = parseBundleInput(text)
      void navigate({ pathname: '/desk', hash: `#b=${encodeBundle(bundle)}` })
    } catch (e) {
      setError(e instanceof BundleError ? e.message : 'That does not look like a bundle.')
    }
  }

  return (
    <div className="space-y-3">
      <label htmlFor="bundle-input" className="label-caps">
        Bundle link or JSON
      </label>
      <textarea
        id="bundle-input"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setError(undefined)
        }}
        rows={compact ? 3 : 4}
        spellCheck={false}
        placeholder="Paste the link your agent gave you"
        className="mono w-full resize-y rounded-2xl border border-line bg-surface-muted p-3 text-[13px] text-ink placeholder:text-subtle focus:border-line-strong"
      />
      {error && <Notice tone="bad">{error}</Notice>}
      <Button onClick={open} disabled={!text.trim()}>
        Open in Desk
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
