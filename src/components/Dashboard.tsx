import { useAllShifts } from '../hooks/useShifts'
import TodayTile from './tiles/TodayTile'
import { WeekTile, MonthTile } from './tiles/StatTiles'
import SplitTile from './tiles/SplitTile'
import HoursByJobTile from './tiles/HoursByJobTile'
import EffectiveRateTile from './tiles/EffectiveRateTile'
import GrossNetTile from './tiles/GrossNetTile'
import TrendTile from './tiles/TrendTile'
import RecentTile from './tiles/RecentTile'
import type { Shift } from '../types'
import { t } from '../strings'
import { cn } from '../lib/utils'

export default function Dashboard({ onNew, onEdit }: { onNew: () => void; onEdit: (s: Shift) => void }) {
  const shifts = useAllShifts()

  if (!shifts) return <SkeletonGrid />

  if (shifts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl mt-10 tile-hero p-8 text-center animate-fade-up">
        <div className="num-display text-4xl text-white mb-3">שלום</div>
        <p className="text-white/90 mb-6">טרם הוזנו משמרות. הוסף את המשמרת הראשונה כדי להתחיל.</p>
        <button onClick={onNew} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold bg-white text-indigo-deep active:scale-[0.98] transition shadow-lg">
          <span className="text-xl leading-none">＋</span>
          {t.nav.new}
        </button>
      </div>
    )
  }

  // True bento: 2 cols on mobile, 4 on ≥sm so wider tiles mosaic instead of stacking.
  // Chart/number tiles that need horizontal room stay full-width on mobile.
  return (
    <div className="mx-auto max-w-2xl grid grid-cols-2 sm:grid-cols-4 auto-rows-min gap-3 mt-2">
      <BentoItem index={0} className="col-span-2 sm:col-span-4">
        <TodayTile shifts={shifts} />
      </BentoItem>
      <BentoItem index={1} className="col-span-1 sm:col-span-2">
        <WeekTile shifts={shifts} />
      </BentoItem>
      <BentoItem index={2} className="col-span-1 sm:col-span-2">
        <MonthTile shifts={shifts} />
      </BentoItem>
      <BentoItem index={3} className="col-span-2">
        <EffectiveRateTile shifts={shifts} />
      </BentoItem>
      <BentoItem index={4} className="col-span-2">
        <SplitTile shifts={shifts} />
      </BentoItem>
      <BentoItem index={5} className="col-span-2">
        <HoursByJobTile shifts={shifts} />
      </BentoItem>
      <BentoItem index={6} className="col-span-2">
        <GrossNetTile shifts={shifts} />
      </BentoItem>
      <BentoItem index={7} className="col-span-2 sm:col-span-4">
        <TrendTile shifts={shifts} />
      </BentoItem>
      <BentoItem index={8} className="col-span-2 sm:col-span-4">
        <RecentTile shifts={shifts} onEdit={onEdit} />
      </BentoItem>
    </div>
  )
}

/** Grid cell wrapper that handles its column span and a staggered entrance. */
function BentoItem({ index, className, children }: { index: number; className: string; children: React.ReactNode }) {
  return (
    <div className={cn(className, 'animate-fade-up')} style={{ animationDelay: `${index * 45}ms` }}>
      {children}
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="mx-auto max-w-2xl grid grid-cols-2 gap-3 mt-2 animate-pulse">
      <div className="col-span-2 h-40 tile" />
      <div className="h-28 tile" />
      <div className="h-28 tile" />
      <div className="col-span-2 h-36 tile" />
      <div className="col-span-2 h-48 tile" />
    </div>
  )
}
