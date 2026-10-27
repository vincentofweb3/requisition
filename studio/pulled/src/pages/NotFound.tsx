import { Link } from 'react-router-dom'
import { PageTitle } from '@/components/ui'

export default function NotFound() {
  return (
    <div>
      <PageTitle title="Page not found">That page does not exist.</PageTitle>
      <Link to="/" className="font-semibold text-accent-hover underline underline-offset-2">
        Back to home
      </Link>
    </div>
  )
}
