// Approximate nutrition for one typical Indian home serving.
// Values are rounded estimates built from IFCT 2017 (ICMR-NIN) ingredient data
// and common home recipes. Oil, portion size and recipe vary a lot between
// homes, so treat every number as a guide, not a lab measurement.

export type Diet = 'veg' | 'egg' | 'nonveg'
export type Region = 'north' | 'south' | 'east' | 'west'
export type GI = 'low' | 'medium' | 'high'
export type Tag = 'staple' | 'fried' | 'sweet' | 'drink' | 'fruit' | 'protein' | 'veg' | 'snack' | 'side'

export interface Food {
  id: string
  name: string
  aliases: string[]
  serving: string
  grams: number
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
  diet: Diet
  regions: Region[]
  gi: GI
  /** Rough home-cooked cost of one serving in INR. */
  cost: number
  tags: Tag[]
}

type Row = [
  id: string,
  name: string,
  aliases: string,
  serving: string,
  grams: number,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fibre: number,
  diet: Diet,
  regions: string,
  gi: GI,
  cost: number,
  tags: string,
]

const R: Record<string, Region> = { N: 'north', S: 'south', E: 'east', W: 'west' }

// prettier-ignore
const rows: Row[] = [
  // Breads and grains
  ['roti', 'Roti / Chapati', 'chapati,chapathi,phulka,fulka,rotli,poli', '1 medium', 40, 110, 3.1, 18, 3, 2.5, 'veg', 'NEW', 'medium', 4, 'staple'],
  ['paratha', 'Plain Paratha', 'parotta,parantha,lachha paratha', '1 piece', 60, 210, 4.5, 28, 9, 3, 'veg', 'NEW', 'medium', 10, 'staple'],
  ['aloo-paratha', 'Aloo Paratha', 'aloo parantha,potato paratha', '1 piece', 100, 290, 6, 40, 12, 4, 'veg', 'NW', 'high', 20, 'staple'],
  ['puri', 'Puri', 'poori', '1 piece', 25, 100, 2, 11, 5.5, 0.8, 'veg', 'NSEW', 'high', 4, 'staple,fried'],
  ['naan', 'Naan', 'butter naan,nan', '1 piece', 90, 260, 8, 45, 5, 2, 'veg', 'N', 'high', 30, 'staple'],
  ['bhatura', 'Bhatura', 'bhature,batura', '1 piece', 80, 290, 6, 35, 14, 1.5, 'veg', 'N', 'high', 25, 'staple,fried'],
  ['rice', 'Steamed Rice', 'chawal,sadam,choru,annam,bhaat,white rice,plain rice', '1 cup cooked', 150, 195, 4, 43, 0.4, 0.6, 'veg', 'NSEW', 'high', 8, 'staple'],
  ['brown-rice', 'Brown Rice', 'red rice,matta rice', '1 cup cooked', 150, 170, 3.8, 36, 1.4, 2.7, 'veg', 'NSEW', 'medium', 12, 'staple'],
  ['jeera-rice', 'Jeera Rice', 'cumin rice', '1 cup', 150, 240, 4.3, 42, 6, 1, 'veg', 'NW', 'high', 15, 'staple'],
  ['pulao', 'Veg Pulao', 'pulav,pilaf,veg pulav', '1 cup', 180, 280, 6, 45, 8, 3, 'veg', 'NSEW', 'high', 25, 'staple'],
  ['veg-biryani', 'Veg Biryani', 'vegetable biryani', '1 plate', 250, 400, 9, 60, 13, 4, 'veg', 'NSEW', 'high', 60, 'staple'],
  ['chicken-biryani', 'Chicken Biryani', 'biryani,biriyani,hyderabadi biryani', '1 plate', 300, 550, 26, 62, 20, 2.5, 'nonveg', 'NSEW', 'high', 120, 'staple,protein'],
  ['mutton-biryani', 'Mutton Biryani', 'gosht biryani', '1 plate', 300, 620, 28, 60, 28, 2.5, 'nonveg', 'NSEW', 'high', 180, 'staple,protein'],
  ['egg-biryani', 'Egg Biryani', 'anda biryani,muttai biryani', '1 plate', 300, 500, 18, 62, 19, 2.5, 'egg', 'NSEW', 'high', 90, 'staple,protein'],
  ['curd-rice', 'Curd Rice', 'thayir sadam,dahi chawal,mosaranna', '1 bowl', 200, 270, 7, 42, 7, 1, 'veg', 'S', 'medium', 20, 'staple'],
  ['lemon-rice', 'Lemon Rice', 'chitranna,elumichai sadam,pulihora', '1 cup', 180, 280, 5, 46, 8, 1.5, 'veg', 'S', 'high', 20, 'staple'],
  ['bisi-bele-bath', 'Sambar Rice', 'bisi bele bath,sambar sadam,sambar chawal', '1 bowl', 250, 340, 10, 55, 8, 6, 'veg', 'S', 'medium', 30, 'staple'],
  ['khichdi', 'Khichdi', 'khichuri,kichdi,khichri', '1 bowl', 250, 280, 10, 45, 6, 4, 'veg', 'NEW', 'medium', 20, 'staple'],
  ['bajra-roti', 'Bajra Roti', 'bajra rotla,millet roti,bajre ki roti', '1 piece', 50, 130, 3.5, 21, 3.5, 3.5, 'veg', 'NW', 'medium', 6, 'staple'],
  ['jowar-roti', 'Jowar Roti', 'jolada rotti,jowar bhakri,bhakri', '1 piece', 50, 115, 3.5, 22, 1.5, 3, 'veg', 'SW', 'medium', 6, 'staple'],
  ['ragi-mudde', 'Ragi Mudde', 'ragi ball,ragi kali,finger millet ball', '1 ball', 150, 200, 4.5, 43, 1, 5, 'veg', 'S', 'medium', 10, 'staple'],
  ['oats', 'Oats Porridge', 'oatmeal,oats with milk', '1 bowl', 250, 230, 9, 33, 6, 4, 'veg', 'NSEW', 'low', 20, 'staple'],

  // South Indian tiffin
  ['idli', 'Idli', 'idly,iddli,itli', '1 piece', 45, 58, 2, 12, 0.2, 0.6, 'veg', 'S', 'high', 6, 'staple'],
  ['dosa', 'Plain Dosa', 'dosai,dose,thosai,sada dosa', '1 piece', 80, 165, 4, 27, 4.5, 1.2, 'veg', 'S', 'high', 25, 'staple'],
  ['masala-dosa', 'Masala Dosa', 'masala dosai,masale dose', '1 piece', 180, 360, 7, 48, 15, 3.5, 'veg', 'S', 'high', 50, 'staple'],
  ['rava-dosa', 'Rava Dosa', 'rava dosai,sooji dosa', '1 piece', 100, 220, 4, 30, 9, 1, 'veg', 'S', 'high', 40, 'staple'],
  ['uttapam', 'Uttapam', 'uthappam,oothappam,uttappa', '1 piece', 120, 230, 6, 35, 7, 2.5, 'veg', 'S', 'high', 40, 'staple'],
  ['pesarattu', 'Pesarattu', 'moong dosa,green gram dosa,moong chilla,chilla,cheela', '1 piece', 100, 190, 10, 26, 5, 4.5, 'veg', 'S', 'low', 30, 'staple,protein'],
  ['medu-vada', 'Medu Vada', 'vada,vadai,uzhunnu vada,ulundu vadai', '1 piece', 50, 140, 4.5, 14, 7.5, 2, 'veg', 'S', 'medium', 10, 'fried,snack'],
  ['upma', 'Upma', 'uppittu,rava upma,sooji upma', '1 bowl', 200, 250, 6, 38, 8, 3, 'veg', 'SW', 'medium', 20, 'staple'],
  ['pongal', 'Ven Pongal', 'pongal,khara pongal', '1 bowl', 200, 300, 8, 42, 11, 2.5, 'veg', 'S', 'high', 25, 'staple'],
  ['appam', 'Appam', 'aappam,palappam', '1 piece', 60, 120, 2, 23, 2, 0.6, 'veg', 'S', 'high', 10, 'staple'],
  ['puttu', 'Puttu', 'pittu', '1 cup', 120, 220, 4, 45, 2.5, 3, 'veg', 'S', 'medium', 15, 'staple'],
  ['sambar', 'Sambar', 'sambhar,saaru,kuzhambu', '1 katori', 150, 115, 5, 16, 3.5, 4, 'veg', 'S', 'low', 10, 'side'],
  ['rasam', 'Rasam', 'saaru,chaaru,tomato rasam', '1 cup', 150, 50, 1.5, 7, 2, 1, 'veg', 'S', 'low', 6, 'side'],
  ['coconut-chutney', 'Coconut Chutney', 'chutney,thengai chutney,nariyal chutney', '2 tbsp', 30, 75, 1, 3, 7, 1.5, 'veg', 'S', 'low', 5, 'side'],
  ['avial', 'Avial', 'aviyal', '1 katori', 150, 180, 4, 14, 12, 4.5, 'veg', 'S', 'low', 25, 'veg'],
  ['poriyal', 'Poriyal / Thoran', 'thoran,palya,beans poriyal,cabbage poriyal,stir fry', '1 katori', 100, 110, 3, 10, 7, 4, 'veg', 'S', 'low', 15, 'veg'],

  // Dals and legumes
  ['dal', 'Dal Tadka', 'dal,daal,dhal,arhar dal,toor dal,paruppu,pappu,dal fry', '1 katori', 150, 150, 8, 20, 4.5, 4, 'veg', 'NSEW', 'low', 15, 'protein,side'],
  ['moong-dal', 'Moong Dal', 'yellow dal,moong daal,pesara pappu,green gram dal', '1 katori', 150, 130, 8.5, 18, 3, 4, 'veg', 'NSEW', 'low', 15, 'protein,side'],
  ['dal-makhani', 'Dal Makhani', 'maa ki dal,kaali dal', '1 katori', 150, 260, 9, 24, 14, 6, 'veg', 'N', 'low', 40, 'protein,side'],
  ['rajma', 'Rajma', 'rajma masala,kidney beans curry', '1 katori', 150, 190, 9, 25, 6, 7, 'veg', 'N', 'low', 25, 'protein,side'],
  ['chole', 'Chole / Chana Masala', 'chana masala,chhole,chickpea curry,kabuli chana', '1 katori', 150, 220, 9.5, 28, 8, 7.5, 'veg', 'NW', 'low', 25, 'protein,side'],
  ['sprouts', 'Sprouts Salad', 'moong sprouts,sprouted moong,usal,mung sprouts', '1 bowl', 100, 110, 7, 16, 1.5, 4.5, 'veg', 'NSEW', 'low', 12, 'protein,veg'],
  ['sundal', 'Chana Sundal', 'sundal,chickpea sundal,chana chaat', '1 bowl', 100, 150, 7.5, 22, 4, 6, 'veg', 'S', 'low', 12, 'protein,snack'],
  ['soya-curry', 'Soya Chunk Curry', 'soya chunks,meal maker,nutrela curry', '1 katori', 150, 200, 18, 14, 8, 6, 'veg', 'NSEW', 'low', 20, 'protein,side'],

  // Vegetable curries
  ['aloo-sabzi', 'Aloo Sabzi', 'potato curry,aloo bhaji,batata bhaji,urulaikizhangu', '1 katori', 150, 180, 3, 24, 8, 3, 'veg', 'NSEW', 'high', 15, 'veg'],
  ['bhindi', 'Bhindi Fry', 'okra fry,vendakkai,bhindi masala,lady finger', '1 katori', 100, 120, 2.5, 9, 8.5, 4, 'veg', 'NSEW', 'low', 20, 'veg'],
  ['palak-paneer', 'Palak Paneer', 'spinach paneer,saag paneer', '1 katori', 150, 260, 12, 9, 20, 3, 'veg', 'N', 'low', 50, 'protein,veg'],
  ['paneer-butter-masala', 'Paneer Butter Masala', 'paneer makhani,shahi paneer,paneer curry', '1 katori', 150, 350, 13, 12, 28, 2, 'veg', 'N', 'low', 70, 'protein'],
  ['mixed-veg', 'Mixed Veg Curry', 'mix veg,vegetable curry,sabzi,subzi,kurma,veg kurma', '1 katori', 150, 140, 3.5, 14, 8, 4.5, 'veg', 'NSEW', 'low', 25, 'veg'],
  ['baingan-bharta', 'Baingan Bharta', 'brinjal bharta,eggplant bharta,vangi', '1 katori', 150, 130, 3, 12, 8, 5, 'veg', 'NE', 'low', 20, 'veg'],
  ['aloo-gobi', 'Aloo Gobi', 'gobi aloo,cauliflower potato', '1 katori', 150, 160, 4, 18, 8.5, 4.5, 'veg', 'N', 'medium', 20, 'veg'],
  ['kadhi', 'Kadhi', 'kadhi pakora,mor kuzhambu,majjige huli', '1 katori', 150, 150, 5, 12, 9, 1, 'veg', 'NW', 'low', 15, 'side'],
  ['paneer-bhurji', 'Paneer Bhurji', 'scrambled paneer', '1 katori', 100, 260, 14, 6, 20, 1, 'veg', 'N', 'low', 50, 'protein'],
  ['salad', 'Green Salad', 'cucumber salad,kachumber,salad,tomato onion salad', '1 bowl', 100, 25, 1, 5, 0.2, 1.8, 'veg', 'NSEW', 'low', 10, 'veg'],

  // Eggs, chicken, fish, mutton
  ['boiled-egg', 'Boiled Egg', 'egg,anda,muttai,mutta,hard boiled egg', '1 egg', 50, 78, 6.3, 0.6, 5.3, 0, 'egg', 'NSEW', 'low', 7, 'protein'],
  ['omelette', 'Omelette', 'omelet,masala omelette,egg omelette', '2 eggs', 120, 200, 13, 2, 15, 0.3, 'egg', 'NSEW', 'low', 18, 'protein'],
  ['egg-bhurji', 'Egg Bhurji', 'anda bhurji,scrambled eggs,muttai podimas', '2 eggs', 120, 220, 13, 4, 17, 0.8, 'egg', 'NSEW', 'low', 20, 'protein'],
  ['egg-curry', 'Egg Curry', 'anda curry,muttai kuzhambu,egg masala', '2 eggs + gravy', 200, 280, 14, 8, 21, 1.5, 'egg', 'NSEW', 'low', 30, 'protein'],
  ['chicken-curry', 'Chicken Curry', 'chicken gravy,kozhi kuzhambu,murgh curry,chicken masala', '1 katori', 150, 250, 23, 6, 15, 1, 'nonveg', 'NSEW', 'low', 70, 'protein'],
  ['butter-chicken', 'Butter Chicken', 'murgh makhani,chicken makhani', '1 katori', 150, 340, 24, 9, 23, 1, 'nonveg', 'N', 'low', 100, 'protein'],
  ['tandoori-chicken', 'Tandoori Chicken', 'chicken tikka,tandoori', '2 pieces', 150, 260, 36, 4, 11, 0.5, 'nonveg', 'N', 'low', 100, 'protein'],
  ['grilled-chicken', 'Grilled Chicken Breast', 'chicken breast,boiled chicken', '100 g', 100, 165, 31, 0, 3.6, 0, 'nonveg', 'NSEW', 'low', 50, 'protein'],
  ['chicken-65', 'Chicken 65', 'chilli chicken,fried chicken', '100 g', 100, 290, 20, 10, 19, 0.5, 'nonveg', 'S', 'medium', 70, 'protein,fried'],
  ['fish-curry', 'Fish Curry', 'meen kuzhambu,machher jhol,fish gravy,meen curry', '1 katori', 150, 220, 22, 6, 12, 1, 'nonveg', 'SEW', 'low', 80, 'protein'],
  ['fish-fry', 'Fish Fry', 'meen varuval,fried fish,fish tawa fry', '1 piece', 100, 230, 20, 8, 13, 0.5, 'nonveg', 'SEW', 'low', 70, 'protein,fried'],
  ['mutton-curry', 'Mutton Curry', 'mutton gravy,gosht curry,rogan josh,kosha mangsho', '1 katori', 150, 330, 25, 6, 23, 1, 'nonveg', 'NSEW', 'low', 140, 'protein'],
  ['prawn-masala', 'Prawn Masala', 'prawn curry,eral thokku,chingri malai', '1 katori', 150, 210, 22, 6, 11, 1, 'nonveg', 'SEW', 'low', 120, 'protein'],

  // Snacks and street food
  ['samosa', 'Samosa', 'samosas,singara', '1 piece', 70, 260, 4, 26, 16, 2.5, 'veg', 'NSEW', 'high', 15, 'fried,snack'],
  ['pakora', 'Pakora / Bajji', 'pakoda,bhajji,bajji,bhajiya,onion pakoda,fritters', '5 pieces', 80, 250, 5, 22, 16, 3, 'veg', 'NSEW', 'high', 20, 'fried,snack'],
  ['pav-bhaji', 'Pav Bhaji', 'pao bhaji', '1 plate', 300, 500, 12, 70, 20, 8, 'veg', 'W', 'high', 70, 'snack'],
  ['vada-pav', 'Vada Pav', 'wada pav,vada pao', '1 piece', 150, 300, 6, 42, 12, 3, 'veg', 'W', 'high', 20, 'fried,snack'],
  ['pani-puri', 'Pani Puri', 'golgappa,puchka,gol gappe', '6 pieces', 120, 210, 4, 36, 6, 3, 'veg', 'NSEW', 'high', 30, 'snack'],
  ['bhel-puri', 'Bhel Puri', 'bhel,jhal muri,churumuri', '1 plate', 150, 260, 6, 40, 9, 4, 'veg', 'WE', 'high', 30, 'snack'],
  ['dhokla', 'Dhokla', 'khaman,khaman dhokla', '3 pieces', 100, 160, 6, 22, 5, 2, 'veg', 'W', 'medium', 25, 'snack'],
  ['poha', 'Poha', 'aval,avalakki,chivda,kanda poha,chira', '1 plate', 180, 270, 5, 45, 8, 2.5, 'veg', 'WNE', 'medium', 20, 'staple'],
  ['murukku', 'Murukku', 'chakli,mixture,namkeen', '30 g', 30, 160, 3, 17, 9, 1, 'veg', 'NSEW', 'high', 10, 'fried,snack'],
  ['kachori', 'Kachori', 'khasta kachori', '1 piece', 60, 230, 5, 24, 13, 2, 'veg', 'NW', 'high', 15, 'fried,snack'],
  ['veg-momos', 'Veg Momos', 'momos,dumplings,momo', '6 pieces', 180, 280, 8, 44, 7, 3, 'veg', 'NE', 'high', 60, 'snack'],
  ['chicken-momos', 'Chicken Momos', 'chicken momo,chicken dumplings', '6 pieces', 180, 320, 16, 40, 10, 2, 'nonveg', 'NE', 'high', 80, 'snack,protein'],
  ['instant-noodles', 'Instant Noodles', 'maggi,noodles,yippee', '1 pack', 70, 350, 8, 48, 14, 2, 'veg', 'NSEW', 'high', 15, 'snack'],
  ['roasted-chana', 'Roasted Chana', 'bhuna chana,pottukadalai,roasted gram', '30 g', 30, 110, 6.5, 17, 1.6, 5, 'veg', 'NSEW', 'low', 5, 'protein,snack'],
  ['makhana', 'Roasted Makhana', 'fox nuts,phool makhana,lotus seeds', '30 g', 30, 115, 3, 21, 1.5, 1.5, 'veg', 'NE', 'low', 20, 'snack'],
  ['peanuts', 'Roasted Peanuts', 'moongphali,verkadalai,groundnuts,shengdana', '30 g', 30, 170, 7.5, 5, 14, 2.5, 'veg', 'NSEW', 'low', 6, 'protein,snack'],
  ['nuts', 'Mixed Nuts', 'almonds,badam,cashew,kaju,walnuts,dry fruits', '30 g', 30, 175, 5, 6, 15, 2.5, 'veg', 'NSEW', 'low', 30, 'snack'],

  // Dairy and drinks
  ['curd', 'Curd / Dahi', 'dahi,thayir,mosaru,perugu,yogurt,yoghurt', '1 katori', 100, 60, 3.5, 4.5, 3.2, 0, 'veg', 'NSEW', 'low', 10, 'protein,side'],
  ['raita', 'Raita', 'pachadi,boondi raita,cucumber raita', '1 katori', 150, 90, 4, 8, 4.5, 1, 'veg', 'NSEW', 'low', 12, 'side'],
  ['buttermilk', 'Buttermilk / Chaas', 'chaas,chhach,moru,majjige,mattha', '1 glass', 250, 40, 2.2, 3.5, 1.5, 0, 'veg', 'NSEW', 'low', 8, 'drink'],
  ['lassi', 'Sweet Lassi', 'lassi,mango lassi', '1 glass', 250, 220, 7, 34, 6, 0, 'veg', 'N', 'medium', 30, 'drink,sweet'],
  ['chai', 'Masala Chai', 'tea,chai,chaha,cha,milk tea', '1 cup with sugar', 150, 90, 2.5, 13, 3, 0, 'veg', 'NSEW', 'medium', 10, 'drink'],
  ['coffee', 'Filter Coffee', 'coffee,kaapi,kapi', '1 cup with sugar', 150, 95, 3, 12, 3.5, 0, 'veg', 'S', 'medium', 15, 'drink'],
  ['milk', 'Toned Milk', 'milk,doodh,paal,haldi doodh', '1 glass', 250, 145, 8, 12, 7.5, 0, 'veg', 'NSEW', 'low', 15, 'drink,protein'],
  ['paneer', 'Paneer (plain)', 'cottage cheese,paneer cubes', '100 g', 100, 265, 18, 3.5, 20, 0, 'veg', 'NSEW', 'low', 45, 'protein'],
  ['soft-drink', 'Soft Drink', 'cola,coke,pepsi,soda,thums up,cold drink', '1 can', 330, 140, 0, 35, 0, 0, 'veg', 'NSEW', 'high', 40, 'drink,sweet'],
  ['fruit-juice', 'Fruit Juice', 'orange juice,juice,mosambi juice,sugarcane juice', '1 glass', 250, 110, 1.7, 26, 0.5, 0.5, 'veg', 'NSEW', 'medium', 40, 'drink'],
  ['coconut-water', 'Coconut Water', 'tender coconut,elaneer,nariyal pani', '1 glass', 250, 45, 1.7, 9, 0.5, 2.6, 'veg', 'NSEW', 'low', 40, 'drink'],

  // Sweets
  ['gulab-jamun', 'Gulab Jamun', 'jamun,kala jamun', '1 piece', 40, 150, 2, 22, 6, 0.3, 'veg', 'NSEW', 'high', 15, 'sweet'],
  ['jalebi', 'Jalebi', 'jilebi,imarti,jangiri', '2 pieces', 50, 200, 1, 32, 8, 0.2, 'veg', 'NSEW', 'high', 15, 'sweet,fried'],
  ['rasgulla', 'Rasgulla', 'rosogolla,rasagola', '1 piece', 50, 105, 2.5, 22, 1, 0, 'veg', 'E', 'high', 15, 'sweet'],
  ['kheer', 'Kheer / Payasam', 'payasam,payesh,phirni,semiya payasam', '1 katori', 150, 230, 6, 35, 7, 0.5, 'veg', 'NSEW', 'high', 25, 'sweet'],
  ['ladoo', 'Besan Ladoo', 'laddu,laddoo,boondi ladoo,motichoor', '1 piece', 40, 190, 3.5, 21, 10.5, 1, 'veg', 'NSEW', 'high', 15, 'sweet'],
  ['gajar-halwa', 'Gajar Halwa', 'halwa,carrot halwa,sooji halwa,kesari', '1 katori', 120, 280, 5, 35, 14, 2, 'veg', 'NSEW', 'high', 30, 'sweet'],

  // Fruit
  ['banana', 'Banana', 'kela,vazhaipazham,pazham', '1 medium', 118, 105, 1.3, 27, 0.4, 3.1, 'veg', 'NSEW', 'medium', 6, 'fruit'],
  ['apple', 'Apple', 'seb,apples', '1 medium', 180, 95, 0.5, 25, 0.3, 4.4, 'veg', 'NSEW', 'low', 25, 'fruit'],
  ['papaya', 'Papaya', 'papita,pappali', '1 cup', 145, 62, 0.7, 16, 0.4, 2.5, 'veg', 'NSEW', 'medium', 15, 'fruit'],
  ['guava', 'Guava', 'amrood,koyya,peru', '1 fruit', 100, 68, 2.6, 14, 1, 5.4, 'veg', 'NSEW', 'low', 10, 'fruit'],
  ['mango', 'Mango', 'aam,maambazham,mambazham', '1 cup', 165, 100, 1.4, 25, 0.6, 2.6, 'veg', 'NSEW', 'medium', 30, 'fruit'],
]

export const FOODS: Food[] = rows.map(
  ([id, name, aliases, serving, grams, kcal, protein, carbs, fat, fibre, diet, regions, gi, cost, tags]) => ({
    id,
    name,
    aliases: aliases.split(',').map((a) => a.trim()).filter(Boolean),
    serving,
    grams,
    kcal,
    protein,
    carbs,
    fat,
    fibre,
    diet,
    regions: [...regions].map((c) => R[c]),
    gi,
    cost,
    tags: tags.split(',').filter(Boolean) as Tag[],
  }),
)

export const FOOD_BY_ID: Record<string, Food> = Object.fromEntries(FOODS.map((f) => [f.id, f]))

export function food(id: string): Food {
  const f = FOOD_BY_ID[id]
  if (!f) throw new Error(`Unknown food: ${id}`)
  return f
}

/** True if a person following `diet` can eat this food. */
export function allowed(f: Food, diet: Diet): boolean {
  if (diet === 'nonveg') return true
  if (diet === 'egg') return f.diet !== 'nonveg'
  return f.diet === 'veg'
}
