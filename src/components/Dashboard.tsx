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

export default function Dashboard({ onNew, onEdit }: { onNew: () => void; onEdit: (s: Shift) => void }) {
  const shifts = useAllShifts()

  if (!shifts) return <SkeletonGrid />

  if (shifts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl mt-10 tile-hero p-8 text-center">
        <div className="num-display text-4xl text-white mb-3">שלום</div>
        <p className="text-white/90 mb-6">טרם הוזנו משמרות. הוסף את המשמרת הראשונה כדי להתחיל.</p>
        <button onClick={onNew} className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-bold bg-white text-indigo-deep active:scale-[0.98] transition shadow-lg">
          <span className="text-xl leading-none">＋</span>
          {t.nav.new}
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl grid grid-cols-2 gap-3 mt-2">
      <div className="col-span-2">
        <TodayTile shifts={shifts} />
      </div>
      <WeekTile shifts={shifts} />
      <MonthTile shifts={shifts} />
      <div className="col-span-2">
        <SplitTile shifts={shifts} />
      </div>
      <div className="col-span-2">
        <HoursByJobTile shifts={shifts} />
      </div>
      <div className="col-span-2">
        <EffectiveRateTile shifts={shifts} />
      </div>
      <div className="col-span-2">
        <GrossNetTile shifts={shifts} />
      </div>
      <div className="col-span-2">
        <TrendTile shifts={shifts} />
      </div>
      <div className="col-span-2">
        <RecentTile shifts={shifts} onEdit={onEdit} />
      </div>
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
