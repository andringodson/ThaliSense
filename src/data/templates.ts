import type { Region } from './foods'
import type { Meal } from '../lib/nutrition'

/**
 * Real meals people eat, rather than random food combinations. The planner
 * picks a template per slot and scales its `flex` staple (roti count, rice
 * cups, idli count) to land on the calorie target.
 */
export interface Template {
  id: string
  name: string
  meal: Meal
  regions: Region[] | 'all'
  items: [foodId: string, qty: number][]
  flex?: string
}

const S: Region[] = ['south']
const N: Region[] = ['north']
const E: Region[] = ['east']
const W: Region[] = ['west']
const NW: Region[] = ['north', 'west']
const NE: Region[] = ['north', 'east']

// prettier-ignore
export const TEMPLATES: Template[] = [
  // Breakfast
  { id: 'b-idli', name: 'Idli, sambar & chutney', meal: 'breakfast', regions: S, items: [['idli', 3], ['sambar', 1], ['coconut-chutney', 1]], flex: 'idli' },
  { id: 'b-pesarattu', name: 'Pesarattu with chutney', meal: 'breakfast', regions: S, items: [['pesarattu', 2], ['coconut-chutney', 1]], flex: 'pesarattu' },
  { id: 'b-dosa', name: 'Dosa with sambar', meal: 'breakfast', regions: S, items: [['dosa', 2], ['sambar', 1], ['coconut-chutney', 0.5]], flex: 'dosa' },
  { id: 'b-pongal', name: 'Pongal with sambar', meal: 'breakfast', regions: S, items: [['pongal', 1], ['sambar', 1]], flex: 'pongal' },
  { id: 'b-uttapam', name: 'Uttapam with sambar', meal: 'breakfast', regions: S, items: [['uttapam', 1], ['sambar', 1]], flex: 'uttapam' },
  { id: 'b-ragi', name: 'Ragi mudde with sambar', meal: 'breakfast', regions: S, items: [['ragi-mudde', 1], ['sambar', 1]], flex: 'ragi-mudde' },
  { id: 'b-puttu', name: 'Puttu with chana', meal: 'breakfast', regions: S, items: [['puttu', 1], ['sundal', 1]], flex: 'puttu' },
  { id: 'b-appam-egg', name: 'Appam with egg curry', meal: 'breakfast', regions: S, items: [['appam', 2], ['egg-curry', 0.5]], flex: 'appam' },
  { id: 'b-dosa-omelette', name: 'Dosa with omelette', meal: 'breakfast', regions: S, items: [['dosa', 1], ['omelette', 1]], flex: 'dosa' },
  { id: 'b-upma', name: 'Upma with sprouts', meal: 'breakfast', regions: [...S, ...W], items: [['upma', 1], ['sprouts', 0.5]], flex: 'upma' },
  { id: 'b-poha', name: 'Poha with curd', meal: 'breakfast', regions: [...W, ...N, ...E], items: [['poha', 1], ['curd', 1]], flex: 'poha' },
  { id: 'b-chilla', name: 'Moong chilla with curd', meal: 'breakfast', regions: NW, items: [['pesarattu', 2], ['curd', 1]], flex: 'pesarattu' },
  { id: 'b-aloo-paratha', name: 'Aloo paratha with curd', meal: 'breakfast', regions: N, items: [['aloo-paratha', 1], ['curd', 1]], flex: 'aloo-paratha' },
  { id: 'b-paratha-omelette', name: 'Paratha with omelette', meal: 'breakfast', regions: N, items: [['paratha', 1], ['omelette', 1]], flex: 'paratha' },
  { id: 'b-roti-bhurji', name: 'Roti with paneer bhurji', meal: 'breakfast', regions: N, items: [['roti', 2], ['paneer-bhurji', 0.75]], flex: 'roti' },
  { id: 'b-dhokla', name: 'Dhokla with buttermilk', meal: 'breakfast', regions: W, items: [['dhokla', 1.5], ['buttermilk', 1]], flex: 'dhokla' },
  { id: 'b-luchi', name: 'Luchi with aloo', meal: 'breakfast', regions: E, items: [['puri', 3], ['aloo-sabzi', 0.75]], flex: 'puri' },
  { id: 'b-oats', name: 'Oats with banana', meal: 'breakfast', regions: 'all', items: [['oats', 1], ['banana', 0.5]], flex: 'oats' },
  { id: 'b-eggs', name: 'Boiled eggs, roti & fruit', meal: 'breakfast', regions: 'all', items: [['boiled-egg', 2], ['roti', 1], ['papaya', 1]], flex: 'roti' },

  // Lunch
  { id: 'l-sambar-rice', name: 'Rice, sambar, poriyal & curd', meal: 'lunch', regions: S, items: [['rice', 1.5], ['sambar', 1], ['poriyal', 1], ['curd', 1]], flex: 'rice' },
  { id: 'l-rasam-rice', name: 'Rice, dal, rasam & poriyal', meal: 'lunch', regions: S, items: [['rice', 1.5], ['dal', 1], ['rasam', 1], ['poriyal', 1]], flex: 'rice' },
  { id: 'l-brown-avial', name: 'Matta rice, avial & sambar', meal: 'lunch', regions: S, items: [['brown-rice', 1.5], ['avial', 1], ['sambar', 1]], flex: 'brown-rice' },
  { id: 'l-bisibele', name: 'Bisi bele bath with raita', meal: 'lunch', regions: S, items: [['bisi-bele-bath', 1], ['raita', 1], ['salad', 1]], flex: 'bisi-bele-bath' },
  { id: 'l-fish-rice', name: 'Rice, fish curry & poriyal', meal: 'lunch', regions: [...S, ...E], items: [['rice', 1.5], ['fish-curry', 1], ['poriyal', 1]], flex: 'rice' },
  { id: 'l-chicken-rice', name: 'Rice, chicken curry & rasam', meal: 'lunch', regions: S, items: [['rice', 1.5], ['chicken-curry', 1], ['rasam', 1], ['salad', 1]], flex: 'rice' },
  { id: 'l-egg-rice', name: 'Rice, egg curry & poriyal', meal: 'lunch', regions: 'all', items: [['rice', 1.5], ['egg-curry', 1], ['poriyal', 1]], flex: 'rice' },
  { id: 'l-thali', name: 'Roti, dal, sabzi, salad & curd', meal: 'lunch', regions: [...N, ...W], items: [['roti', 3], ['dal', 1], ['mixed-veg', 1], ['salad', 1], ['curd', 1]], flex: 'roti' },
  { id: 'l-rajma', name: 'Rajma chawal with salad', meal: 'lunch', regions: N, items: [['rice', 1.25], ['rajma', 1.25], ['salad', 1]], flex: 'rice' },
  { id: 'l-chole', name: 'Chole with roti & salad', meal: 'lunch', regions: NW, items: [['roti', 2], ['chole', 1.25], ['salad', 1], ['curd', 0.5]], flex: 'roti' },
  { id: 'l-kadhi', name: 'Kadhi chawal with sabzi', meal: 'lunch', regions: NW, items: [['rice', 1.25], ['kadhi', 1], ['bhindi', 1]], flex: 'rice' },
  { id: 'l-bajra', name: 'Bajra roti, bharta & dal', meal: 'lunch', regions: NW, items: [['bajra-roti', 2], ['baingan-bharta', 1], ['dal', 1]], flex: 'bajra-roti' },
  { id: 'l-jowar', name: 'Jowar bhakri, bhindi & dal', meal: 'lunch', regions: [...W, ...S], items: [['jowar-roti', 2], ['bhindi', 1], ['dal', 1], ['salad', 1]], flex: 'jowar-roti' },
  { id: 'l-machher', name: 'Bhaat, machher jhol & dal', meal: 'lunch', regions: E, items: [['rice', 1.5], ['fish-curry', 1], ['moong-dal', 0.75], ['salad', 1]], flex: 'rice' },
  { id: 'l-bengali-veg', name: 'Bhaat, dal & aloo posto-style sabzi', meal: 'lunch', regions: E, items: [['rice', 1.5], ['moong-dal', 1], ['aloo-sabzi', 0.75], ['salad', 1]], flex: 'rice' },
  { id: 'l-roti-chicken', name: 'Roti, chicken curry & salad', meal: 'lunch', regions: [...N, ...W, ...E], items: [['roti', 3], ['chicken-curry', 1], ['salad', 1]], flex: 'roti' },
  { id: 'l-soya', name: 'Roti, soya curry & salad', meal: 'lunch', regions: 'all', items: [['roti', 3], ['soya-curry', 1], ['salad', 1], ['curd', 0.5]], flex: 'roti' },

  // Dinner
  { id: 'd-roti-dal', name: 'Roti, dal & sabzi', meal: 'dinner', regions: 'all', items: [['roti', 2], ['dal', 1], ['mixed-veg', 1], ['salad', 1]], flex: 'roti' },
  { id: 'd-palak', name: 'Palak paneer with roti', meal: 'dinner', regions: N, items: [['roti', 2], ['palak-paneer', 1], ['salad', 1]], flex: 'roti' },
  { id: 'd-aloo-gobi', name: 'Aloo gobi, roti & dal', meal: 'dinner', regions: N, items: [['roti', 2], ['aloo-gobi', 0.75], ['moong-dal', 1]], flex: 'roti' },
  { id: 'd-khichdi', name: 'Khichdi with curd & salad', meal: 'dinner', regions: [...N, ...W, ...E], items: [['khichdi', 1], ['curd', 1], ['salad', 1]], flex: 'khichdi' },
  { id: 'd-tandoori', name: 'Tandoori chicken, roti & raita', meal: 'dinner', regions: N, items: [['tandoori-chicken', 1], ['roti', 2], ['raita', 1], ['salad', 1]], flex: 'roti' },
  { id: 'd-egg-roti', name: 'Egg curry with roti', meal: 'dinner', regions: 'all', items: [['roti', 2], ['egg-curry', 1], ['salad', 1]], flex: 'roti' },
  { id: 'd-chapati-kurma', name: 'Chapati with veg kurma', meal: 'dinner', regions: S, items: [['roti', 2], ['mixed-veg', 1], ['sundal', 0.5]], flex: 'roti' },
  { id: 'd-dosa-sambar', name: 'Dosa with sambar & sundal', meal: 'dinner', regions: S, items: [['dosa', 2], ['sambar', 1], ['sundal', 0.5]], flex: 'dosa' },
  { id: 'd-idli', name: 'Idli with sambar', meal: 'dinner', regions: S, items: [['idli', 3], ['sambar', 1.5]], flex: 'idli' },
  { id: 'd-curd-rice', name: 'Curd rice with poriyal', meal: 'dinner', regions: S, items: [['curd-rice', 1], ['poriyal', 1], ['sundal', 0.5]], flex: 'curd-rice' },
  { id: 'd-ragi', name: 'Ragi mudde, sambar & poriyal', meal: 'dinner', regions: S, items: [['ragi-mudde', 1], ['sambar', 1], ['poriyal', 1]], flex: 'ragi-mudde' },
  { id: 'd-fish-chapati', name: 'Fish curry with chapati', meal: 'dinner', regions: [...S, ...E, ...W], items: [['roti', 2], ['fish-curry', 1], ['salad', 1]], flex: 'roti' },
  { id: 'd-grilled', name: 'Grilled chicken, roti & salad', meal: 'dinner', regions: 'all', items: [['grilled-chicken', 1.25], ['roti', 2], ['salad', 1.5]], flex: 'roti' },
  { id: 'd-bharta', name: 'Bajra roti with baingan bharta', meal: 'dinner', regions: NE, items: [['bajra-roti', 2], ['baingan-bharta', 1], ['curd', 1]], flex: 'bajra-roti' },
  { id: 'd-soya-rice', name: 'Brown rice with soya curry', meal: 'dinner', regions: 'all', items: [['brown-rice', 1], ['soya-curry', 1], ['salad', 1]], flex: 'brown-rice' },

  // Snacks
  { id: 's-chana', name: 'Roasted chana & buttermilk', meal: 'snack', regions: 'all', items: [['roasted-chana', 1], ['buttermilk', 1]] },
  { id: 's-sprouts', name: 'Sprouts salad', meal: 'snack', regions: 'all', items: [['sprouts', 1]] },
  { id: 's-guava', name: 'Guava & peanuts', meal: 'snack', regions: 'all', items: [['guava', 1], ['peanuts', 0.5]] },
  { id: 's-sundal', name: 'Chana sundal', meal: 'snack', regions: S, items: [['sundal', 1]] },
  { id: 's-makhana', name: 'Roasted makhana & chaas', meal: 'snack', regions: NE, items: [['makhana', 1], ['buttermilk', 1]] },
  { id: 's-egg', name: 'Boiled egg & cucumber', meal: 'snack', regions: 'all', items: [['boiled-egg', 1], ['salad', 1]] },
  { id: 's-curd-fruit', name: 'Curd with papaya', meal: 'snack', regions: 'all', items: [['curd', 1], ['papaya', 1]] },
  { id: 's-apple', name: 'Apple & a few nuts', meal: 'snack', regions: 'all', items: [['apple', 1], ['nuts', 0.5]] },
  { id: 's-coconut', name: 'Tender coconut water & chana', meal: 'snack', regions: S, items: [['coconut-water', 1], ['roasted-chana', 1]] },
]

/** Common swaps the coach can recommend. `to` replaces `from` one for one. */
export const SWAPS: { from: string; to: [string, number][]; why: string }[] = [
  { from: 'rice', to: [['brown-rice', 0.5], ['sprouts', 0.5]], why: 'Half the rice, swapped for matta rice and sprouts, keeps the plate full with a slower sugar rise.' },
  { from: 'samosa', to: [['roasted-chana', 1]], why: 'Same crunch, a third of the calories and four times the fibre.' },
  { from: 'pakora', to: [['sundal', 1]], why: 'Chana sundal is steamed, not fried, and doubles the protein.' },
  { from: 'soft-drink', to: [['buttermilk', 1]], why: 'A can of cola is about 9 teaspoons of sugar. Chaas cools you down with none.' },
  { from: 'fruit-juice', to: [['guava', 1]], why: 'Whole fruit keeps its fibre, so it fills you up and spikes sugar less than juice.' },
  { from: 'jalebi', to: [['papaya', 1]], why: 'Satisfies the sweet craving for a third of the calories.' },
  { from: 'gulab-jamun', to: [['curd', 1], ['banana', 0.5]], why: 'Curd with banana is sweet, cooling and adds protein instead of syrup.' },
  { from: 'instant-noodles', to: [['poha', 1]], why: 'Poha with peanuts and veg is less processed and lower in sodium.' },
  { from: 'paratha', to: [['roti', 1]], why: 'A dry roti saves about 100 kcal of oil or ghee per piece.' },
  { from: 'aloo-paratha', to: [['roti', 1], ['curd', 1]], why: 'Roti with curd keeps the meal satisfying without the oil and potato.' },
  { from: 'naan', to: [['roti', 2]], why: 'Two rotis are lighter than one naan and add whole-wheat fibre.' },
  { from: 'masala-dosa', to: [['pesarattu', 1]], why: 'Moong dosa has more than twice the protein and a lower glycaemic load.' },
  { from: 'puri', to: [['roti', 1]], why: 'Not deep-fried, so about 40% fewer calories per piece.' },
  { from: 'chai', to: [['buttermilk', 1]], why: 'If you drink 3 or more sweet chais a day, swap one for chaas or have chai with less sugar.' },
  { from: 'jeera-rice', to: [['brown-rice', 1]], why: 'Matta or brown rice has more fibre and less added fat.' },
  { from: 'vada-pav', to: [['dhokla', 1]], why: 'Steamed dhokla instead of a fried vada saves about 140 kcal.' },
  { from: 'murukku', to: [['makhana', 1]], why: 'Roasted makhana is light and crunchy without the deep frying.' },
  { from: 'butter-chicken', to: [['tandoori-chicken', 1]], why: 'Same chicken, without the cream and butter gravy.' },
  { from: 'paneer-butter-masala', to: [['palak-paneer', 1]], why: 'Spinach gravy instead of cream: fewer calories, more iron and fibre.' },
]
