import { cn } from '../lib/utils'
import { t } from '../strings'

// Logo.png lives in /public and is served under the Vite base path.
const LOGO_SRC = import.meta.env.BASE_URL + 'Logo.png'

/**
 * App logo shown inside a cream "badge". The artwork has a cream background,
 * so the badge keeps it looking intentional in both light and dark themes.
 */
export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center justify-center rounded-2xl bg-[#fefae0] overflow-hidden shrink-0', className)}>
      <img src={LOGO_SRC} alt={t.appName} className="w-full h-full object-contain" />
    </span>
  )
}
