/*
 * Precompute CLIP text embeddings for every dish, so the browser only has to
 * download and run the vision half of the model.
 *
 *   npx vite-node scripts/embed-labels.ts
 *
 * Writes src/vision/labels.json: one int8-quantised, L2-normalised 512-d vector
 * per food, averaged over several prompts that describe what the dish looks like.
 */
import { AutoTokenizer, CLIPTextModelWithProjection } from '@huggingface/transformers'
import { writeFileSync } from 'node:fs'
import { FOODS } from '../src/data/foods'

const MODEL = 'Xenova/clip-vit-base-patch32'

// What each dish looks like, in plain words CLIP understands.
const LOOKS: Record<string, string> = {
  roti: 'round flat whole wheat Indian bread',
  paratha: 'layered flaky pan-fried flatbread',
  'aloo-paratha': 'stuffed potato flatbread with butter',
  puri: 'small puffed deep-fried round bread',
  naan: 'oval leavened tandoor flatbread with char spots',
  bhatura: 'large puffed deep-fried bread',
  rice: 'a bowl of plain white steamed rice',
  'brown-rice': 'red brown parboiled rice grains',
  'jeera-rice': 'white rice with cumin seeds',
  pulao: 'rice cooked with peas and vegetables',
  'veg-biryani': 'layered spiced rice with vegetables',
  'chicken-biryani': 'spiced saffron rice with chicken pieces',
  'mutton-biryani': 'spiced rice with mutton pieces',
  'egg-biryani': 'spiced rice with boiled eggs',
  'curd-rice': 'white rice mixed with yogurt and tempering',
  'lemon-rice': 'yellow turmeric rice with peanuts and curry leaves',
  'bisi-bele-bath': 'brown mushy lentil rice with vegetables',
  khichdi: 'soft yellow rice and lentil porridge',
  'bajra-roti': 'thick grey pearl millet flatbread',
  'jowar-roti': 'thin pale sorghum flatbread',
  'ragi-mudde': 'dark brown finger millet ball',
  oats: 'a bowl of oatmeal porridge',
  idli: 'soft white round steamed rice cakes',
  dosa: 'thin crispy golden crepe',
  'masala-dosa': 'large crispy crepe folded over potato filling',
  'rava-dosa': 'lacy crispy semolina crepe with holes',
  uttapam: 'thick pancake topped with onions and tomatoes',
  pesarattu: 'green lentil crepe',
  'medu-vada': 'doughnut-shaped fried lentil fritter',
  upma: 'semolina porridge with vegetables and curry leaves',
  pongal: 'creamy rice and lentil mash with pepper and ghee',
  appam: 'bowl-shaped lacy rice pancake with soft centre',
  puttu: 'cylinder of steamed rice flour and coconut',
  sambar: 'orange lentil vegetable stew in a bowl',
  rasam: 'thin red tangy tomato soup',
  'coconut-chutney': 'white coconut chutney',
  avial: 'mixed vegetables in coconut yogurt sauce',
  poriyal: 'stir fried chopped vegetables with grated coconut',
  dal: 'yellow lentil curry with tempering',
  'moong-dal': 'thin yellow lentil soup',
  'dal-makhani': 'creamy dark black lentil curry',
  rajma: 'red kidney bean curry',
  chole: 'chickpea curry in brown gravy',
  sprouts: 'sprouted green moong bean salad',
  sundal: 'boiled chickpeas with coconut and curry leaves',
  'soya-curry': 'soya chunks curry',
  'aloo-sabzi': 'potato curry',
  bhindi: 'stir fried okra pieces',
  'palak-paneer': 'green spinach gravy with paneer cubes',
  'paneer-butter-masala': 'orange creamy gravy with paneer cubes',
  'mixed-veg': 'mixed vegetable curry',
  'baingan-bharta': 'mashed roasted eggplant',
  'aloo-gobi': 'potato and cauliflower dry curry',
  kadhi: 'yellow yogurt gram flour curry with fritters',
  'paneer-bhurji': 'scrambled crumbled paneer',
  salad: 'sliced cucumber tomato onion salad',
  'boiled-egg': 'boiled eggs cut in half',
  omelette: 'folded egg omelette',
  'egg-bhurji': 'spiced scrambled eggs',
  'egg-curry': 'boiled eggs in red gravy',
  'chicken-curry': 'chicken pieces in brown curry',
  'butter-chicken': 'chicken in creamy orange butter sauce',
  'tandoori-chicken': 'red roasted tandoori chicken legs',
  'grilled-chicken': 'grilled chicken breast',
  'chicken-65': 'deep fried red spicy chicken bites',
  'fish-curry': 'fish pieces in red tangy curry',
  'fish-fry': 'masala fried fish slices',
  'mutton-curry': 'mutton pieces in dark red gravy',
  'prawn-masala': 'prawns in thick masala',
  samosa: 'triangular fried pastry',
  pakora: 'deep fried battered vegetable fritters',
  'pav-bhaji': 'mashed vegetable curry with buttered bread rolls',
  'vada-pav': 'fried potato dumpling in a bread bun',
  'pani-puri': 'small hollow crispy puris with filling',
  'bhel-puri': 'puffed rice mixed with sev and chutney',
  dhokla: 'yellow spongy steamed squares',
  poha: 'yellow flattened rice with peanuts',
  murukku: 'crunchy spiral fried snack',
  kachori: 'round puffed fried pastry',
  'veg-momos': 'steamed dumplings',
  'chicken-momos': 'steamed chicken dumplings',
  'instant-noodles': 'instant noodles in a bowl',
  'roasted-chana': 'roasted chickpeas',
  makhana: 'white puffed fox nuts',
  peanuts: 'roasted peanuts',
  nuts: 'almonds cashews and walnuts',
  curd: 'a bowl of plain white yogurt',
  raita: 'yogurt with cucumber',
  buttermilk: 'a glass of thin white buttermilk',
  lassi: 'a tall glass of thick lassi',
  chai: 'a cup of milky tea',
  coffee: 'south indian filter coffee in a steel tumbler',
  milk: 'a glass of milk',
  paneer: 'white paneer cubes',
  'soft-drink': 'a can or glass of cola',
  'fruit-juice': 'a glass of orange juice',
  'coconut-water': 'green tender coconut with straw',
  'gulab-jamun': 'brown fried balls in sugar syrup',
  jalebi: 'orange spiral sweets',
  rasgulla: 'white spongy balls in syrup',
  kheer: 'creamy rice pudding',
  ladoo: 'round yellow sweet balls',
  'gajar-halwa': 'orange grated carrot pudding',
  banana: 'banana',
  apple: 'red apple',
  papaya: 'orange papaya slices',
  guava: 'green guava',
  mango: 'yellow mango slices',
}

const prompts = (name: string, looks: string) => [
  `a photo of ${name}, a type of Indian food.`,
  `a photo of ${name}, ${looks}.`,
  `${looks}, served on a plate.`,
  `a close-up photo of ${name}.`,
]

async function main() {
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL)
  const model = await CLIPTextModelWithProjection.from_pretrained(MODEL, { dtype: 'fp32' })

  const ids: string[] = []
  const scales: number[] = []
  const bytes: number[] = []
  let dim = 0

  for (const f of FOODS) {
    const name = f.name.split('/')[0].trim().toLowerCase()
    const looks = LOOKS[f.id] ?? name
    const inputs = tokenizer(prompts(name, looks), { padding: true, truncation: true })
    const { text_embeds } = await model(inputs)
    const [n, d] = text_embeds.dims as number[]
    dim = d
    const data = text_embeds.data as Float32Array
    const mean = new Float32Array(d)
    for (let i = 0; i < n; i++) {
      let norm = 0
      for (let j = 0; j < d; j++) norm += data[i * d + j] ** 2
      norm = Math.sqrt(norm)
      for (let j = 0; j < d; j++) mean[j] += data[i * d + j] / norm / n
    }
    let norm = 0
    for (let j = 0; j < d; j++) norm += mean[j] ** 2
    norm = Math.sqrt(norm)
    let max = 0
    for (let j = 0; j < d; j++) max = Math.max(max, Math.abs(mean[j] / norm))
    const scale = max / 127
    for (let j = 0; j < d; j++) bytes.push(Math.round(mean[j] / norm / scale) & 0xff)
    ids.push(f.id)
    scales.push(Number(scale.toPrecision(6)))
    process.stdout.write('.')
  }

  const out = { model: MODEL, dim, ids, scales, data: Buffer.from(bytes).toString('base64') }
  writeFileSync(new URL('../src/vision/labels.json', import.meta.url), JSON.stringify(out))
  console.log(`\nwrote ${ids.length} label embeddings`)
}

main()
