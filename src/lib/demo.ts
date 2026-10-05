import { daysBack, uid, type LogEntry, type Meal } from './nutrition'

/*
 * A realistic week for the demo profile (Priya, 38, Chennai, vegetarian):
 * rice-heavy lunches, three sweet coffees or chais a day, a couple of fried
 * snacks and two skipped breakfasts. Gives the coach something real to find.
 */
type Day = Partial<Record<Meal, [string, number][]>>

const WEEK: Day[] = [
  {
    breakfast: [['idli', 4], ['sambar', 1], ['coconut-chutney', 1.5], ['coffee', 1]],
    lunch: [['rice', 2.5], ['sambar', 1], ['poriyal', 0.5], ['curd', 1]],
    snack: [['chai', 1], ['murukku', 1]],
    dinner: [['dosa', 3], ['coconut-chutney', 1.5], ['coffee', 1]],
  },
  {
    lunch: [['rice', 2.5], ['rasam', 1], ['dal', 0.5], ['poriyal', 0.5]],
    snack: [['chai', 1], ['samosa', 1], ['coffee', 1]],
    dinner: [['veg-biryani', 1], ['raita', 1], ['gulab-jamun', 1]],
  },
  {
    breakfast: [['pongal', 1.5], ['coconut-chutney', 1], ['coffee', 1]],
    lunch: [['rice', 2], ['sambar', 1], ['curd', 1]],
    snack: [['chai', 1], ['pakora', 1]],
    dinner: [['roti', 2], ['mixed-veg', 1], ['coffee', 1]],
  },
  {
    breakfast: [['masala-dosa', 1], ['coffee', 1]],
    lunch: [['lemon-rice', 1.5], ['curd', 1]],
    snack: [['chai', 1], ['banana', 1]],
    dinner: [['idli', 4], ['sambar', 1], ['coconut-chutney', 1], ['coffee', 1]],
  },
  {
    lunch: [['bisi-bele-bath', 1.5], ['raita', 1]],
    snack: [['chai', 1], ['murukku', 1], ['soft-drink', 1]],
    dinner: [['rice', 1.5], ['sambar', 1], ['poriyal', 1], ['coffee', 1]],
  },
  {
    breakfast: [['upma', 1.5], ['coffee', 1]],
    lunch: [['rice', 2.5], ['sambar', 1], ['avial', 1]],
    snack: [['chai', 1], ['medu-vada', 2]],
    dinner: [['curd-rice', 1.5], ['coffee', 1]],
  },
  {
    breakfast: [['idli', 3], ['sambar', 1], ['coconut-chutney', 1], ['coffee', 1]],
  },
]

export function demoLogs(today: Date = new Date()): LogEntry[] {
  const dates = daysBack(7, today)
  return WEEK.flatMap((day, i) =>
    (Object.entries(day) as [Meal, [string, number][]][]).flatMap(([meal, items]) =>
      items
        .filter(([, qty]) => qty > 0)
        .map(([foodId, qty]) => ({ id: uid(), date: dates[i], meal, foodId, qty, source: 'manual' as const })),
    ),
  )
}
