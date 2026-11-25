import type { FoodItem, Language } from '../types/fitplate';

/**
 * Normalize text for resilient English + Hindi/Hinglish search and deduplication.
 */
export function normalizeFoodText(input: string): string {
  return String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`".,/\\()[\]{}:;!?&+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SYNONYM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(microni|macroni|makroni|macarony)\b/g, 'macaroni'],
  [/\bpanjeeri\b/g, 'panjiri'],
  [/\b(chapati|chappati|phulka|fulka)\b/g, 'roti'],
  [/\bparotha\b/g, 'paratha'],
  [/\b(tuvar|tuver|arhar|tor)\b/g, 'toor'],
  [/\b(masur|mashore)\b/g, 'masoor'],
  [/\b(mung)\b/g, 'moong'],
  [/\b(chach|chhaas|chhachh)\b/g, 'chaas'],
  [/\b(yoghurt|yogurt|dahi)\b/g, 'curd'],
  [/\b(pyaz|pyaaz|kanda)\b/g, 'onion'],
  [/\b(tamatar)\b/g, 'tomato'],
  [/\b(pudina)\b/g, 'mint'],
  [/\b(dhaniya)\b/g, 'coriander'],
  [/\b(adrak)\b/g, 'ginger'],
  [/\b(elaichi)\b/g, 'cardamom'],
  [/\b(kesar)\b/g, 'saffron'],
  [/\b(badam)\b/g, 'almond'],
  [/\b(pista)\b/g, 'pistachio'],
  [/\b(kaju)\b/g, 'cashew'],
  [/\b(nariyal)\b/g, 'coconut'],
  [/\b(nimbu)\b/g, 'lemon'],
  [/\b(kheera)\b/g, 'cucumber'],
  [/\b(lauki|ghiya|doodhi)\b/g, 'bottle gourd'],
  [/\b(doodh)\b/g, 'milk'],
  [/\b(chawal|sadam|bhat)\b/g, 'rice'],
  [/\b(shakar|shakkar|gud|gur)\b/g, 'jaggery'],
  [/\b(laddu)\b/g, 'ladoo'],
  [/\b(firni)\b/g, 'phirni'],
  [/\b(barfee|burfi)\b/g, 'barfi'],
  [/\b(biriyani)\b/g, 'biryani'],
  [/\b(pulaav|pulav)\b/g, 'pulao'],
  [/\b(momoz|momo)\b/g, 'momos'],
  [/\b(szechuan|schezuan|sichuan)\b/g, 'schezwan'],
  [/\b(drt)\b/g, 'dry'],
  [/\b(margerita|margharita|margheritta|margrita)\b/g, 'margherita'],
  [/\b(pizaa|piza|pizzza)\b/g, 'pizza'],
  [/\b(tecobell|tacobell|tako bell|teco bell)\b/g, 'taco bell'],
  [/\b(mcdonalds|mc donalds|mc donald|macdonalds|macdonald|mcd)\b/g, 'mcdonald'],
  [/\b(burgerking|bk)\b/g, 'burger king'],
  [/\b(panner|panneer)\b/g, 'paneer'],
  [/\b(frankie|franky|kathi)\b/g, 'roll'],
  [/\b(dalia|daliyaa|broken wheat)\b/g, 'daliya'],
  [/\b(nkeen|namkin|nmkeen|namken|namkeen)\b/g, 'namkeen'],
  [/\bmissal\b/g, 'misal'],
  [/\bpaw\b/g, 'pav'],
  [/\bwada\b/g, 'vada'],
  [/\bzhunka\b/g, 'zunka'],
  [/\bpitla\b/g, 'pithla'],
  [/\bpohe\b/g, 'poha'],
  [/\b(browni|browny)\b/g, 'brownie'],
  [/\b(fruite|froot)\b/g, 'fruit'],
  [/\b(rawa)\b/g, 'rava'],
  [/\b(chiken|chickn|chikn)\b/g, 'chicken'],
  [/\b(dimsumb|dimsums|dimsum)\b/g, 'dim sum'],
  [/\b(allu|alu)\b/g, 'aloo'],
  [/\b(bhujiya|bhujiaa)\b/g, 'bhujia'],
  [/\b(sahi)\b/g, 'shahi'],
  [/\b(mixcer|mixcher|mixure|mixtur)\b/g, 'mixture'],
  [/\b(singdana|moongfali|mungfali|moongphali)\b/g, 'peanut'],
  [/\b(khoya)\b/g, 'mawa'],
  [/\b(pattice|patis)\b/g, 'patties'],
  [/\b(juce|juices|juic|jooce|ras)\b/g, 'juice'],
  [/\b(bhuta|bhutta|bhutte|chhalli|challi)\b/g, 'bhutta'],
  [/\b(maka|makka|makai)\b/g, 'makka'],
  [/\b(pop corn|popcons|popcon)\b/g, 'popcorn'],
  [/\b(shakarkandi|shakarkand|shakkarkand|shakkarkandi|sakarkand|ratatalu)\b/g, 'sweet potato'],
  [/\b(ubla|ubli|steamed)\b/g, 'boiled'],
  [/\b(bhuna|bhuni|seka|grilled)\b/g, 'roasted'],
];

export function canonicalizeFoodTerms(input: string): string {
  let out = normalizeFoodText(input);
  for (const [pattern, replacement] of SYNONYM_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Generates a canonical deduplication key ignoring parenthetical notes/brands & noise words.
 */
export function canonicalFoodNameKey(name: string): string {
  const withoutParens = String(name || '').replace(/\([^)]*\)/g, ' ');
  return canonicalizeFoodTerms(withoutParens)
    .replace(/\b(plain|classic|style|homestyle|authentic|traditional|fresh|homemade|steamed|boiled|indian|global|with|and|the|in)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Local regional, Hinglish, and colloquial aliases mapped directly to catalog food IDs.
 */
export const FOOD_LOCAL_ALIASES: Record<string, string[]> = {
  roti_wheat: ['chapati', 'phulka', 'tawa roti', 'gehu ki roti', 'wheat chapati'],
  plain_rice_white: ['plain rice', 'sada rice', 'sada chawal', 'white rice', 'boiled rice', 'chawal', 'bhat'],
  steamed_basmati_rice: ['plain basmati rice', 'basmati chawal', 'steamed rice'],
  jeera_rice: ['zeera rice', 'cumin rice', 'jeera chawal'],
  veg_pulao: ['vegetable pulao', 'pulao', 'veg pulav'],
  mix_veg_rice: ['mixveg rice', 'mix veg rice', 'mixed vegetable rice', 'sabzi chawal', 'vegetable masala rice'],
  desi_tawa_fry_rice: ['fry rice', 'fried chawal', 'tawa fry rice', 'tadka rice', 'masala fry rice'],
  veg_fried_rice: ['fry rice', 'veg fry rice', 'chinese fried rice'],
  paneer_tawa_pulao: ['tawa pulao', 'mumbai tawa pulao', 'street pulao'],
  matar_pulao: ['peas pulao', 'matar pulav'],
  kashmiri_pulao: ['shahi pulao', 'mewa pulao', 'dry fruit pulao'],
  veg_biryani: ['veg biryani', 'vegetable biryani', 'subz biryani'],
  moong_khichdi: ['dal khichdi', 'khichdi', 'moong dal khichdi'],
  dal_khichdi_tadka: ['dal khichdi', 'khichdi tadka', 'hotel dal khichdi'],
  lemon_rice: ['chitranna', 'nimbu chawal', 'nimmakaya pulihora'],
  curd_rice: ['thayir sadam', 'dahi chawal', 'baghala bath'],
  tamarind_rice: ['puliyogare', 'pulihora', 'imli chawal'],
  tomato_rice: ['thakkali sadam', 'tamatar chawal'],
  coconut_rice: ['thengai sadam', 'nariyal chawal'],
  ghee_rice: ['neychoru', 'ghee chawal'],
  pongal_ven: ['ven pongal', 'khara pongal'],
  tahiri_veg: ['tehri', 'tahari', 'veg tehri'],
  rice_porridge_kanji: ['congee', 'kanji', 'pej', 'rice gruel'],

  curd_dahi: ['plain curd', 'dahi', 'yogurt', 'natural dahi'],
  boondi_raita: ['bundi raita', 'boondi dahi'],
  cucumber_raita: ['kheera raita', 'kakdi raita'],
  mix_veg_raita: ['mixed veg raita', 'vegetable raita'],
  onion_raita: ['pyaz raita', 'kanda raita', 'onion tomato raita'],
  green_salad: ['fresh green salad', 'hara salad', 'kachra salad'],
  kachumber_salad: ['kachumber', 'indian salad'],

  toor_dal_plain: ['toor dal', 'tor dal', 'arhar dal', 'tuvar dal', 'yellow dal'],
  masoor_dal: ['masoor dal', 'mashore dal', 'masur dal', 'red lentil dal'],
  kali_masoor_dal: ['sabut masoor', 'black masoor', 'malka masoor'],
  mix_dal_panchratna: ['mix dal', 'panchmel dal', 'panchratna dal'],
  yellow_moong_dal: ['dhuli moong', 'moong dal', 'pesarapappu'],
  dal_makhani: ['kali dal', 'makhani dal', 'urad makhani'],
  maa_ki_dal_langar: ['langar dal', 'maa ki dal', 'kali dal'],
  chole_masala: ['chana masala', 'kabuli chana', 'chhole'],
  rajma_chawal: ['rajma', 'kidney beans rice'],

  butter_naan: ['plain naan', 'tandoori naan'],
  garlic_naan: ['lasooni naan', 'garlic butter naan'],
  onion_naan: ['pyaz naan', 'onion kulcha'],
  chilli_garlic_naan: ['chili garlic naan', 'mirch garlic naan'],
  pudina_naan: ['mint naan', 'poodina naan'],
  coriander_naan: ['dhaniya naan', 'cilantro naan'],
  kulcha_naan: ['tandoori kulcha', 'plain kulcha'],
  amritsari_naan: ['amritsari kulcha'],

  ginger_tea_milk: ['adrak chai', 'chai', 'indian masala chai', 'milk tea'],
  tea_without_sugar: ['sugar free chai', 'bina cheeni chai', 'unsweetened milk tea'],
  chaas_buttermilk: ['masala chaas', 'chach', 'mattha', 'spiced buttermilk'],
  plain_chaas: ['sada chaas', 'plain buttermilk', 'lassi namkeen'],
  rajasthani_masala_chaas: ['rajasthani chaas', 'jeera hing chaas', 'smoked chaas'],
  sweet_lassi: ['meethi lassi', 'punjabi lassi'],
  salted_lassi: ['namkeen lassi', 'salt lassi'],
  makhaniya_lassi: ['jodhpuri lassi', 'makkhan lassi', 'creamy lassi'],
  badam_milk: ['badam doodh', 'kesar badam milk', 'almond milk'],
  rose_milk_sharbat: ['rose milk', 'gulab sharbat', 'rooh afza milk'],
  thandai_festive: ['thandai', 'kesar thandai', 'holi thandai'],
  aam_panna: ['kairi panna', 'raw mango drink'],
  nimbu_pani_salted: ['shikanji', 'salted shikanji', 'nimbu pani'],
  nimbu_shikanji_sweet: ['shikanji', 'sweet shikanji', 'meetha nimbu pani'],
  jaljeera_drink: ['jaljeera', 'jal jeera'],
  sattu_drink_namkeen: ['sattu drink', 'bihari sattu', 'roasted chana drink'],
  coconut_water: ['tender coconut water', 'nariyal pani', 'elaneer'],
  filter_coffee_milk: ['filter coffee', 'filter coffee with milk', 'south indian filter coffee', 'kaapi'],
  madras_coffee: ['madras kaapi', 'madras filter coffee'],
  south_indian_degree_coffee: ['degree coffee', 'kumbakonam degree coffee'],
  sukku_coffee: ['chukku kaapi', 'sukku malli coffee', 'dry ginger coffee'],
  neer_mor: ['neer moru', 'spiced buttermilk'],
  nannari_sarbath: ['nannari sherbet', 'naruneendi sarbath'],
  jigarthanda: ['madurai jigarthanda'],
  bajra_raab: ['bajre ki raab', 'raabdi'],
  jowar_raab: ['jowar ki raab'],
  mineral_water: ['bisleri', 'kinley', 'aquafina', 'bottled water', 'pani'],
  packaged_drinking_water: ['drinking water', 'water bottle'],
  soda_water: ['club soda', 'plain soda'],
  sparkling_water: ['carbonated water', 'perrier'],
  white_tea: ['safed chai'],
  matcha_tea: ['japanese green tea', 'matcha latte unsweetened'],
  saffron_milk_tea: ['kesar chai', 'saffron chai'],
  badam_tea: ['almond chai', 'badam chai'],
  rose_milk_tea: ['gulab chai', 'rose chai'],
  pista_tea: ['pistachio chai', 'pista chai'],

  dry_pasta_uncooked: ['raw pasta', 'drt pasta', 'uncooked penne', 'dry fusilli'],
  macaroni_dry_raw: ['microni dry', 'macroni dry', 'dry macaroni', 'raw macaroni', 'uncooked macaroni'],
  indian_masala_macaroni: ['desi microni', 'masala microni', 'veg macaroni'],
  red_sauce_pasta: ['arrabbiata pasta', 'tomato pasta'],
  white_sauce_pasta: ['alfredo pasta', 'creamy cheese pasta'],

  pani_puri: ['golgappa', 'puchka', 'gupchup', 'panipuri'],
  onion_pakora: ['kanda bhajji', 'pyaz pakora', 'onion bhaji'],
  poha_kanda: ['kanda poha', 'chivda', 'avalakki'],
  sweet_pongal: ['sakkarai pongal', 'chakkara pongal'],
  kesari_bath: ['rava kesari', 'suji kesari', 'sheera kesari'],
  suji_halwa: ['sheera', 'rava halwa', 'sooji halwa'],
  atta_panjiri: ['panjiri', 'panjeeri', 'wheat panjiri'],
  panjeeri_ladoo: ['panjiri ladoo', 'panjeeri laddu'],
  phirni_classic: ['phirni', 'firni', 'shahi phirni'],
  kesar_phirni: ['saffron phirni', 'kesar firni'],
  rice_kheer: ['chawal ki kheer', 'payasam', 'paal payasam'],
  kozhukattai: ['kolukattai', 'modak', 'modagam'],

  schezwan_sauce: ['sichuan sauce', 'chings schezwan chutney'],
  vinegar_chilli: ['sirka mirch', 'chilli vinegar', 'green chilli vinegar'],
  momos_red_chutney: ['momo chutney', 'red momos chutney'],
  mint_mayo: ['pudina mayo', 'mint mayonnaise'],
  garlic_mayo: ['garlic mayonnaise', 'toum mayo'],
  tomato_ketchup: ['ketchup', 'tomato sauce'],

  margherita_pizza: ['margerita pizza', 'cheese pizza', 'dominos margherita', 'pizza hut margherita'],
  onion_pizza: ['onion pizaa', 'pyaz pizza', 'pizza mania onion', 'simply veg onion pizza'],
  onion_capsicum_pizza: ['onion capsicum pizza', 'veg pizza', 'capsicum onion pizza'],
  golden_corn_pizza: ['sweet corn pizza', 'cheese corn pizza', 'golden corn pizza mania'],
  farmhouse_veg_pizza: ['farmhouse pizza', 'farm house pizza', 'veg farmhouse'],
  peppy_paneer_pizza: ['peppy paneer pizza', 'paneer pizza', 'dominos paneer pizza'],
  indi_tandoori_paneer_pizza: ['tandoori paneer pizza', 'indian paneer pizza'],
  veg_extravaganza_pizza: ['veg extravaganza', 'supreme veg pizza'],
  cheese_burst_margherita_pizza: ['cheese burst pizza', 'double cheese margherita'],
  classic_pepperoni_pizza: ['pepperoni pizza', 'meat pizza'],
  chicken_tikka_pizza: ['chicken pizza', 'tandoori chicken pizza'],
  bbq_chicken_pizza: ['barbeque chicken pizza', 'bbq chicken pizza'],

  mcd_mcaloo_tikki: ['mcaloo tikki', 'mc aloo tikki', 'mcdonald aloo tikki burger', 'mcd burger'],
  mcd_mcveggie: ['mcveggie', 'mc veggie', 'mcdonald veg burger'],
  mcd_mcspicy_paneer: ['mcspicy paneer', 'mc spicy paneer', 'mcdonald paneer burger'],
  mcd_veg_maharaja_mac: ['veg maharaja mac', 'maharaja burger'],
  mcd_mcchicken: ['mcchicken', 'mc chicken', 'mcdonald chicken burger'],
  mcd_mcspicy_chicken: ['mcspicy chicken', 'mc spicy chicken'],
  mcd_chicken_maharaja_mac: ['chicken maharaja mac', 'maharaja chicken burger'],
  mcd_filet_o_fish: ['filet o fish', 'fish burger mcdonalds'],
  mcd_mcegg_burger: ['mcegg', 'mc egg burger', 'egg burger'],
  mcd_french_fries: ['mcdonalds fries', 'mcd fries', 'mc fries'],
  mcd_chicken_mcnuggets: ['mcnuggets', 'chicken nuggets mcdonalds'],

  bk_veg_whopper: ['veg whopper', 'whopper veg', 'burger king whopper'],
  bk_chicken_whopper: ['chicken whopper', 'whopper chicken'],
  bk_mutton_whopper: ['mutton whopper', 'whopper mutton'],
  bk_crispy_veg: ['bk crispy veg', 'burger king veg burger', 'crispy veg burger'],
  bk_crispy_chicken: ['bk crispy chicken', 'burger king chicken burger'],
  bk_paneer_king: ['paneer king burger', 'bk paneer royale'],
  bk_king_fries: ['burger king fries', 'bk fries'],

  tb_crunchy_taco_veg: ['taco bell taco', 'crunchy veg taco', 'tecobell taco', 'bean taco'],
  tb_crunchy_taco_chicken: ['crunchy chicken taco', 'taco bell chicken taco'],
  tb_naked_chicken_taco: ['naked chicken taco', 'taco bell naked chicken'],
  tb_7_layer_burrito_veg: ['veg burrito', 'taco bell burrito', '7 layer burrito'],
  tb_mexican_chicken_burrito: ['chicken burrito', 'taco bell chicken burrito'],
  tb_cheese_quesadilla: ['cheese quesadilla', 'veg quesadilla', 'taco bell quesadilla'],
  tb_chicken_quesadilla: ['chicken quesadilla', 'taco bell chicken quesadilla'],
  tb_crunchwrap_supreme_veg: ['crunchwrap', 'crunch wrap veg', 'taco bell crunchwrap'],
  tb_crunchwrap_supreme_chicken: ['crunchwrap chicken', 'taco bell chicken crunchwrap'],
  tb_bell_nachos_supreme: ['taco bell nachos', 'loaded nachos'],

  veg_kathi_roll: ['veg roll', 'vegetable roll', 'veg frankie', 'veg kathi roll', 'mix veg roll'],
  aloo_tikki_roll: ['aloo roll', 'potato roll', 'aloo frankie'],
  paneer_roll: ['paneer roll', 'panner roll', 'paneer kathi roll', 'paneer frankie'],
  paneer_tikka_roll: ['paneer tikka roll', 'tandoori paneer roll'],
  egg_roll_kathi: ['egg roll', 'anda roll', 'kolkata egg roll', 'single egg roll'],
  double_egg_roll: ['double egg roll', '2 egg roll', 'double anda roll'],
  chicken_roll_kathi: ['chicken roll', 'chicken kathi roll', 'chicken frankie'],
  double_chicken_roll: ['double chicken roll', '2x chicken roll'],
  egg_chicken_roll: ['egg chicken roll', 'egg-chicken roll', 'chicken egg roll', 'anda chicken roll', 'kolkata chicken egg roll'],
  double_egg_chicken_roll: ['double egg chicken roll', 'double egg double chicken roll'],
  soya_chaap_roll: ['soya roll', 'soyabean roll', 'chaap roll'],
  cheese_corn_roll: ['cheese corn roll', 'corn cheese roll'],
  mutton_seekh_roll: ['mutton roll', 'seekh kabab roll'],

  plain_wheat_daliya: ['daliya', 'dalia', 'plain daliya', 'sada daliya', 'boiled daliya', 'broken wheat porridge'],
  milk_daliya: ['milk daliya', 'doodh daliya', 'dudh daliya', 'sweet milk daliya', 'daliya milk', 'meetha doodh daliya'],
  mix_veg_daliya: ['mix veg daliya', 'mixveg daliya', 'mixed veg daliya', 'vegetable daliya', 'veg daliya'],
  namkeen_daliya: ['namkeen daliya', 'nkeen daliya', 'namkin daliya', 'masala daliya', 'tadka daliya', 'savory daliya'],
  moong_dal_daliya_khichdi: ['dal daliya', 'daliya khichdi', 'moong dal daliya', 'khichdi daliya'],
  meetha_gur_daliya: ['meetha daliya', 'gur daliya', 'lapsi', 'sweet daliya'],
  dry_fruit_milk_daliya: ['dry fruit daliya', 'badam daliya', 'kaju badam milk daliya'],
  oats_daliya_mix: ['oats daliya', 'oats dalia', 'oats mix daliya'],
  palak_paneer_daliya: ['paneer daliya', 'palak daliya', 'protein daliya'],

  chocolate_cake: ['chocolate cake', 'chocolate truffle cake', 'choco cake', 'chocolate pastry', 'dark chocolate cake'],
  chocolate_brownie_cake: ['brownie', 'brownie cake', 'browni cake', 'fudge brownie', 'chocolate brownie'],
  walnut_brownie_cake: ['walnut brownie', 'walnut brownie cake'],
  fruit_cake_tutti_frutti: ['fruit cake', 'fruite cake', 'tutti frutti cake', 'bakery fruit cake', 'tea fruit cake'],
  plum_dry_fruit_cake: ['plum cake', 'dry fruit cake', 'christmas cake'],
  rava_suji_cake: ['rava cake', 'rawa cake', 'suji cake', 'semolina cake', 'iyengar rava cake'],
  mawa_cake_irani: ['mawa cake', 'khoya cake', 'parsi mawa cake', 'irani mawa cake'],
  red_velvet_cake: ['red velvet cake', 'red velvet pastry'],
  vanilla_sponge_cake: ['vanilla cake', 'sponge cake', 'plain cake', 'tea cake'],
  black_forest_cake: ['black forest cake', 'black forest pastry'],
  pineapple_cream_cake: ['pineapple cake', 'pineapple pastry'],
  butterscotch_cake: ['butterscotch cake', 'butterscotch pastry'],
  mango_cream_cake: ['mango cake', 'mango pastry'],
  strawberry_cream_cake: ['strawberry cake', 'strawberry pastry'],
  baked_cheesecake: ['cheesecake', 'new york cheesecake', 'baked cheesecake'],
  blueberry_cheesecake: ['blueberry cheesecake'],
  choco_lava_cake: ['choco lava cake', 'lava cake', 'molten lava cake'],
  marble_swirl_cake: ['marble cake', 'zebra cake'],
  carrot_walnut_cake: ['carrot cake', 'carrot walnut cake'],
  banana_walnut_cake: ['banana cake', 'banana bread', 'banana walnut cake'],
  coffee_mocha_cake: ['coffee cake', 'mocha cake'],
  dates_walnut_cake: ['dates cake', 'date walnut cake', 'sugar free cake'],
  rasmalai_fusion_cake: ['rasmalai cake', 'tres leches cake'],

  veg_puff_patty: ['veg puff', 'veg patties', 'vegetable puff', 'bakery puff', 'curry puff'],
  paneer_puff_patty: ['paneer puff', 'paneer patties', 'panner puff', 'masala paneer puff'],
  chicken_puff_patty: ['chicken puff', 'chicken patties', 'chiken puff', 'keema puff'],
  egg_puff_patty: ['egg puff', 'anda puff', 'egg patties'],
  aloo_puff_patty: ['aloo puff', 'aloo patties', 'potato puff'],
  cheese_corn_puff: ['cheese puff', 'cheese corn puff', 'corn puff'],
  mushroom_pepper_puff: ['mushroom puff', 'mushroom patties'],
  mutton_keema_puff: ['mutton puff', 'keema patties', 'mutton patties'],
  khari_puff_biscuit: ['khari', 'khari biscuit', 'puff khari'],

  veg_dim_sum: ['veg dim sum', 'veg dimsum', 'vegetable dim sum', 'steamed dim sum', 'veg dumplings'],
  chicken_dim_sum: ['chicken dim sum', 'chicken dimsum', 'chiken dim sum', 'chicken siu mai', 'chicken dumplings'],
  paneer_corn_dim_sum: ['paneer dim sum', 'paneer corn dim sum'],
  edamame_truffle_dim_sum: ['edamame dim sum', 'truffle dim sum'],
  spinach_cheese_dim_sum: ['spinach cheese dim sum', 'palak cheese dim sum'],
  prawn_har_gow_dim_sum: ['prawn dim sum', 'har gow', 'shrimp dim sum'],
  chicken_chilli_oil_dim_sum: ['chilli oil dim sum', 'chicken wonton'],
  veg_gyoza_dim_sum: ['veg gyoza', 'gyoza dim sum'],
  veg_steamed_bao_dim_sum: ['veg bao', 'steamed bao', 'baozi'],
  chicken_steamed_bao_dim_sum: ['chicken bao', 'char siu bao'],

  roasted_peanut_masala: ['roasted peanut masala', 'peanut masala', 'masala peanut', 'chakna', 'peanut chakna', 'masala singdana', 'bar peanut masala'],
  roasted_peanuts_salted: ['roasted peanut', 'roasted peanuts', 'salted peanuts', 'bhuni moongfali', 'singdana', 'chakna peanuts'],
  dry_roasted_peanuts_plain: ['plain roasted peanuts', 'dry roasted peanuts', 'unsalted peanuts'],
  masala_besan_peanuts: ['masala sing', 'sing bhujia', 'besan peanuts', 'nut cracker', 'chakna'],
  aloo_bhujia_namkeen: ['aloo bhujia', 'allu bhujiya', 'alu bhujiya', 'haldiram aloo bhujia', 'namkeen'],
  bikaneri_bhujia: ['bikaneri bhujia', 'bhujia', 'bhujiya', 'sev bhujia'],
  shahi_mixture_namkeen: ['shahi mixture', 'shahi mixture namkeen', 'sahi mixcer namken', 'shahi mix', 'dry fruit mixture', 'namkeen mixture'],
  khatta_meetha_namkeen: ['khatta meetha', 'khatta meetha namkeen', 'mixture'],
  navratan_mixture_namkeen: ['navratan mixture', 'navratan namkeen', 'mix namkeen'],
  dal_moth_namkeen: ['dal moth', 'dalmoth', 'namkeen'],
  moong_dal_namkeen: ['moong dal namkeen', 'fried moong dal', 'haldiram moong dal'],
  chana_dal_namkeen: ['chana dal namkeen', 'fried chana dal'],
  chana_jor_garam: ['chana jor garam', 'chana chor garam', 'chakna'],
  paneer_namkeen: ['paneer namkeen', 'panner namkeen', 'paneer chakna', 'crispy paneer chakna'],
  paneer_bhujia_namkeen: ['paneer bhujia', 'paneer sev namkeen'],
  masala_makhana_chakna: ['masala makhana', 'roasted masala makhana', 'makhana chakna', 'chakna'],
  khara_masala_boondi: ['khara boondi', 'masala boondi', 'namkeen boondi'],
  sev_mamra_chakna: ['sev mamra', 'mamra', 'kurmura chakna', 'murmura namkeen'],
  cornflakes_mixture_namkeen: ['cornflakes mixture', 'makai chivda'],
  poha_chivda_namkeen: ['poha chivda', 'chivda namkeen', 'patla poha chivda'],
  masala_kaju_chakna: ['masala kaju', 'roasted kaju', 'salted cashews', 'chakna'],
  salted_roasted_almonds_chakna: ['roasted almonds', 'salted badam', 'namkeen badam', 'chakna'],
  masala_papad_chakna: ['masala papad', 'roasted masala papad', 'chakna'],
  black_chana_masala_chakna: ['kala chana chaat', 'chana chakna', 'boiled chana masala'],
  crispy_corn_chakna: ['crispy corn', 'corn chakna', 'bar crispy corn'],
  hara_matar_namkeen: ['hara matar', 'matar namkeen', 'fried green peas'],
  soya_sticks_namkeen: ['soya sticks', 'soya sticks namkeen'],
  chakli_murukku_namkeen: ['chakli', 'murukku', 'chakri namkeen'],
  bhavnagari_gathiya: ['gathiya', 'bhavnagari gathiya', 'ganthiya', 'besan sev'],
  banana_chips_salted: ['banana chips', 'kela chips', 'salted banana chips'],
  masala_boiled_egg_chakna: ['egg chakna', 'boiled egg masala', 'anda masala chakna'],
  chicken_tikka_chakna: ['chicken chakna', 'chicken tikka bites'],

  fresh_orange_juice: ['orange juice', 'santra juice', 'fresh orange juce', 'orange juce'],
  fresh_watermelon_juice: ['watermelon juice', 'tarbooz juice', 'watermelon juce'],
  fresh_pineapple_juice: ['pineapple juice', 'ananas juice', 'pineapple juce'],
  fresh_apple_juice: ['apple juice', 'seb juice', 'apple juce'],
  fresh_mango_juice: ['mango juice', 'aam juice', 'fresh mango juce'],
  fresh_guava_juice: ['guava juice', 'amrood juice', 'pink guava juice'],
  fresh_grape_juice: ['grape juice', 'angoor juice', 'black grape juice'],
  fresh_kiwi_juice: ['kiwi juice', 'kiwi mint juice'],
  fresh_papaya_juice: ['papaya juice', 'papita juice'],
  fresh_muskmelon_juice: ['muskmelon juice', 'kharbooja juice', 'melon juice'],
  fresh_lychee_juice: ['lychee juice', 'litchi juice'],
  fresh_jamun_juice: ['jamun juice', 'kala jamun juice'],
  fresh_kokum_juice: ['kokum juice', 'kokam juice'],
  fresh_bael_juice: ['bael juice', 'bel sharbat', 'wood apple juice'],
  fresh_lemon_mint_juice: ['lemon mint juice', 'nimbu pudina juice'],
  fresh_mixed_fruit_juice: ['mixed fruit juice', 'mix fruit juice', 'fruit juice'],
  fresh_cranberry_juice: ['cranberry juice', 'unsweetened cranberry juice'],
  fresh_peach_juice: ['peach juice', 'aadu juice'],
  fresh_strawberry_juice: ['strawberry juice'],
  fresh_carrot_juice: ['carrot juice', 'gajar juice', 'gajar ka ras'],
  fresh_beetroot_juice: ['beetroot juice', 'chukandar juice', 'beet juice'],
  abc_detox_juice: ['abc juice', 'apple beetroot carrot juice', 'detox juice'],
  carrot_beet_amla_juice: ['carrot beet amla juice', 'gajar chukandar amla juice'],
  fresh_tomato_juice: ['tomato juice', 'tamatar juice'],
  cucumber_mint_detox_juice: ['cucumber juice', 'kheera juice', 'detox juice'],
  lauki_bottle_gourd_juice: ['lauki juice', 'ghiya juice', 'doodhi juice', 'bottle gourd juice'],
  karela_bitter_gourd_juice: ['karela juice', 'bitter gourd juice'],
  karela_jamun_ayurvedic_juice: ['karela jamun juice'],
  amla_juice_unsweetened: ['amla juice', 'gooseberry juice'],
  aloe_vera_juice: ['aloe vera juice', 'aloe juice'],
  wheatgrass_juice: ['wheatgrass juice', 'wheat grass juice'],
  ash_gourd_petha_juice: ['ash gourd juice', 'petha juice', 'safed petha juice'],
  green_detox_veg_juice: ['green juice', 'green detox juice', 'palak cucumber juice'],
  giloy_tulsi_juice: ['giloy juice', 'giloy tulsi juice'],
  packaged_mixed_fruit_juice: ['real mixed fruit juice', 'tropicana mixed fruit', 'tetra pak juice'],
  packaged_orange_juice: ['real orange juice', 'tropicana orange juice'],
  packaged_mango_drink: ['maaza', 'slice', 'frooti', 'mango drink', 'packaged mango juice'],
  packaged_guava_nectar: ['real guava juice', 'tropicana guava'],
  packaged_apple_juice: ['real apple juice', 'tropicana apple juice', 'appy'],
  packaged_litchi_juice: ['real litchi juice', 'b natural litchi'],
  packaged_cranberry_juice_sweet: ['real cranberry juice', 'ocean spray cranberry'],

  boiled_bhutta_cob: ['boiled bhutta', 'boiled bhuta', 'boiled maka', 'boiled makka', 'ubla bhutta', 'ubla makka', 'boiled corn cob', 'chhalli boiled'],
  boiled_masala_sweet_corn_cup: ['boiled sweet corn', 'masala corn cup', 'steamed sweet corn', 'boiled corn cup'],
  boiled_butter_sweet_corn_cup: ['butter sweet corn', 'boiled butter corn', 'mall sweet corn'],
  roasted_bhutta_cob: ['roasted bhutta', 'roasted bhuta', 'roasted maka', 'roasted makka', 'bhuna bhutta', 'bhuna makka', 'coal roasted corn', 'seka bhutta'],
  roasted_butter_masala_bhutta: ['butter bhutta', 'masala roasted bhutta', 'roasted butter corn cob'],
  roasted_makka_dana_kernels: ['roasted makka dana', 'bhuna makka dana', 'roasted corn kernels'],

  air_popped_plain_popcorn: ['plain popcorn', 'air popped popcorn', 'pop corn', 'oil free popcorn', 'diet popcorn'],
  classic_salted_popcorn: ['salted popcorn', 'classic popcorn', 'popcorn', 'pop corn', 'act 2 popcorn'],
  butter_popcorn_cinema: ['butter popcorn', 'theatre popcorn', 'cinema popcorn', 'golden sizzle popcorn', 'act 2 butter popcorn'],
  caramel_popcorn: ['caramel popcorn', 'sweet popcorn', 'caramel pop corn'],
  cheese_popcorn: ['cheese popcorn', 'cheddar popcorn', 'white cheese popcorn'],
  peri_peri_masala_popcorn: ['peri peri popcorn', 'spicy popcorn', 'masala popcorn'],
  kettle_corn_sweet_salty: ['kettle corn', 'sweet and salty popcorn'],
  tandoori_desi_masala_popcorn: ['desi masala popcorn', 'tandoori popcorn', 'chaat popcorn'],
  chocolate_drizzle_popcorn: ['chocolate popcorn', 'choco popcorn'],
  garlic_herb_popcorn: ['garlic popcorn', 'herb popcorn'],

  boiled_sweet_potato: ['boiled sweet potato', 'ubli shakarkandi', 'boiled shakarkand', 'sweet potato boiled', 'ubli shakarkand'],
  boiled_shakarkandi_chaat: ['boiled shakarkandi chaat', 'sweet potato chaat', 'shakarkandi chaat'],
  roasted_sweet_potato: ['roasted sweet potato', 'bhuni shakarkandi', 'roasted shakarkand', 'sweet potato roasted', 'coal roasted sweet potato'],
  roasted_shakarkandi_masala_chaat: ['roasted shakarkandi chaat', 'bhuni shakarkandi chaat', 'street shakarkandi'],
  oven_roasted_sweet_potato_wedges: ['sweet potato wedges', 'roasted sweet potato wedges', 'baked sweet potato'],
  boiled_purple_sweet_potato: ['purple sweet potato', 'boiled purple sweet potato'],
};

/**
 * Direct query-level local name translations/mappings (e.g. searching "dahi" or "shikanji" or "kaapi").
 */
export const LOCAL_QUERY_SYNONYMS: Record<string, string> = {
  dahi: 'curd',
  chawal: 'rice',
  chappati: 'roti',
  chapati: 'roti',
  phulka: 'roti',
  shikanji: 'nimbu shikanji',
  golgappa: 'pani puri',
  puchka: 'pani puri',
  kaapi: 'coffee',
  pyaz: 'onion',
  kanda: 'onion',
  arhar: 'toor dal',
  tuvar: 'toor dal',
  mashore: 'masoor dal',
  masur: 'masoor dal',
  microni: 'macaroni',
  macroni: 'macaroni',
  panjeeri: 'panjiri',
  sheera: 'halwa',
  sirka: 'vinegar',
  chach: 'chaas',
  mattha: 'chaas',
  nariyal: 'coconut',
  doodh: 'milk',
  badam: 'almond',
  pista: 'pistachio',
  kesar: 'saffron',
  adrak: 'ginger',
  elaichi: 'cardamom',
  nimbu: 'lemon',
  kheera: 'cucumber',
  sakkarai: 'sweet pongal',
  payasam: 'kheer',
  margerita: 'margherita',
  pizaa: 'pizza',
  tecobell: 'taco bell',
  tacobell: 'taco bell',
  mcd: 'mcdonald',
  mcdonalds: 'mcdonald',
  whopper: 'burger king whopper',
  mcaloo: 'mcaloo tikki',
  frankie: 'roll',
  kathi: 'roll',
  panner: 'paneer',
  dalia: 'daliya',
  nkeen: 'namkeen',
  namkin: 'namkeen',
  lapsi: 'meetha gur daliya',
  missal: 'misal pav',
  'missal paw': 'misal pav',
  'vada paw': 'vada pav',
  'wada pav': 'vada pav',
  peru: 'guava',
  amrood: 'guava',
  papita: 'papaya',
  tarbooz: 'watermelon',
  kharbooja: 'muskmelon',
  anar: 'pomegranate',
  angoor: 'grapes',
  chikoo: 'sapota',
  sitaphal: 'custard apple',
  santra: 'orange',
  ananas: 'pineapple',
  mooli: 'radish',
  chukandar: 'beetroot',
  gajar: 'carrot',
  kakdi: 'cucumber',
  bhakri: 'jowar bhakri',
  zhunka: 'zunka',
  amrakhand: 'shrikhand',
  browni: 'brownie cake',
  'browni cake': 'brownie cake',
  fruite: 'fruit cake',
  'fruite cake': 'fruit cake',
  'rawa cake': 'rava cake',
  'chiken dim sum': 'chicken dim sum',
  dimsum: 'dim sum',
  'allu bhujiya': 'aloo bhujia',
  bhujiya: 'bhujia',
  'sahi mixcer': 'shahi mixture',
  'sahi mixcer namken': 'shahi mixture namkeen',
  namken: 'namkeen',
  'panner namkeen': 'paneer namkeen',
  moongfali: 'peanuts',
  singdana: 'peanuts',
  patties: 'puff',
  chakna: 'chakna',
  juce: 'juice',
  bhuta: 'bhutta',
  maka: 'bhutta',
  makka: 'bhutta',
  'boiled bhuta': 'boiled bhutta',
  'boiled maka': 'boiled bhutta',
  'roasted bhuta': 'roasted bhutta',
  'roasted maka': 'roasted bhutta',
  'pop corn': 'popcorn',
  shakarkandi: 'sweet potato',
  shakarkand: 'sweet potato',
  'sweet potato boiled': 'boiled sweet potato',
  'sweet potato roasted': 'roasted sweet potato',
};

/**
 * Maps common Open Food Facts or external food names to clean local Hindi/Indian names
 * when `nameHi` is missing or identical to the English brand label.
 */
const LOCAL_HI_MAPPINGS: Array<[RegExp, string]> = [
  [/basmati rice|white rice/i, 'बासमती चावल'],
  [/curd|yogurt|dahi/i, 'दही'],
  [/buttermilk|chaas/i, 'छाछ'],
  [/lassi/i, 'लस्सी'],
  [/roti|chapati/i, 'रोटी / चपाती'],
  [/naan/i, 'नान'],
  [/paratha/i, 'पराठा'],
  [/pulao/i, 'पुलाव'],
  [/biryani/i, 'बिरयानी'],
  [/khichdi/i, 'खिचड़ी'],
  [/raita/i, 'रायता'],
  [/salad/i, 'सलाद'],
  [/macaroni|microni/i, 'मैकरोनी'],
  [/pasta/i, 'पास्ता'],
  [/pizza/i, 'पिज़्ज़ा'],
  [/burger|whopper/i, 'बर्गर'],
  [/taco/i, 'टैको'],
  [/burrito/i, 'बरीटो'],
  [/quesadilla/i, 'केसाडिला'],
  [/kathi roll|frankie|egg roll|paneer roll|chicken roll|veg roll/i, 'रोल'],
  [/noodles|chowmein/i, 'नूडल्स'],
  [/manchurian/i, 'मंचूरियन'],
  [/ketchup/i, 'टोमैटो केचप'],
  [/mayo|mayonnaise/i, 'मेयोनेज़'],
  [/sauce|chutney/i, 'सॉस / चटनी'],
  [/iced tea/i, 'आइस्ड टी'],
  [/green tea|matcha/i, 'ग्रीन टी'],
  [/tea|chai/i, 'चाय'],
  [/coffee|kaapi/i, 'कॉफ़ी'],
  [/mineral water|drinking water|sparkling water/i, 'पीने का पानी'],
  [/soda water/i, 'सोडा वाटर'],
  [/paneer/i, 'पनीर'],
  [/milk/i, 'दूध'],
  [/halwa/i, 'हलवा'],
  [/kheer/i, 'खीर'],
  [/ladoo|laddu/i, 'लड्डू'],
  [/gulab jamun/i, 'गुलाब जामुन'],
  [/dal|lentil/i, 'दाल'],
  [/daliya|dalia/i, 'दलिया'],
  [/brownie/i, 'ब्राउनी'],
  [/cake|cheesecake/i, 'केक'],
  [/puff|patties/i, 'पफ / पैटीज़'],
  [/dim sum|dimsum|gyoza|bao/i, 'डिम सम'],
  [/bhujia|bhujiya/i, 'भुजिया'],
  [/namkeen|mixture|chakna/i, 'नमकीन / चकना'],
  [/peanut/i, 'मूंगफली'],
  [/juice/i, 'जूस'],
  [/bhutta|makka|sweet corn/i, 'भुट्टा / मक्का'],
  [/popcorn|kettle corn/i, 'पॉपकॉर्न'],
  [/sweet potato|shakarkandi/i, 'शकरकंद'],
];

export function mapFoodLocalNames(food: FoodItem): FoodItem {
  const existingHi = (food.nameHi || '').trim();
  const hasDevanagari = /[\u0900-\u097F]/.test(existingHi);
  if (hasDevanagari) {
    return food;
  }

  for (const [pattern, hiLabel] of LOCAL_HI_MAPPINGS) {
    if (pattern.test(food.name) || pattern.test(food.id)) {
      return {
        ...food,
        nameHi: existingHi && existingHi.toLowerCase() !== food.name.toLowerCase()
          ? existingHi
          : `${food.name} (${hiLabel})`,
      };
    }
  }

  return {
    ...food,
    nameHi: existingHi || food.name,
  };
}

/**
 * Deduplicate food arrays keeping priority order:
 * 1) Custom user foods
 * 2) Comprehensive Indian & Global database (`INDIAN_AND_GLOBAL_FOODS`)
 * 3) Remote Open Food Facts items (suppressed if they collide with a local catalog item)
 */
export function deduplicateFoods(items: FoodItem[]): FoodItem[] {
  const seenIds = new Set<string>();
  const seenCanonicalKeys = new Set<string>();
  const seenExactNames = new Set<string>();
  const result: FoodItem[] = [];

  for (const raw of items) {
    const food = mapFoodLocalNames(raw);
    const cleanId = food.id.trim();
    if (!cleanId || seenIds.has(cleanId)) continue;

    const exactNorm = normalizeFoodText(food.name);
    const fullCanonKey = canonicalizeFoodTerms(food.name);
    const coreKey = canonicalFoodNameKey(food.name);
    const isRemote = cleanId.startsWith('off_');

    if (exactNorm && seenExactNames.has(exactNorm)) {
      continue;
    }

    // For remote Open Food Facts items, filter out duplicates matching already-prioritized local dishes
    if (isRemote && coreKey && seenCanonicalKeys.has(coreKey)) {
      continue;
    }

    // Prevent two local/custom items with identical canonical names + category (preserving qualifiers like No Sugar / Sweet / Dry)
    if (!isRemote && fullCanonKey) {
      const catKey = `${food.category}::${fullCanonKey}`;
      if (seenCanonicalKeys.has(catKey)) {
        continue;
      }
      seenCanonicalKeys.add(catKey);
    }

    seenIds.add(cleanId);
    if (exactNorm) seenExactNames.add(exactNorm);
    if (!isRemote && coreKey) {
      seenCanonicalKeys.add(coreKey);
    }

    result.push(food);
  }

  return result;
}

export interface FoodCategoryFilterOption {
  id: string;
  labelEn: string;
  labelHi: string;
  keywords: string;
}

export const FOOD_CATEGORY_FILTERS: FoodCategoryFilterOption[] = [
  { id: 'all', labelEn: 'All Foods', labelHi: 'सभी', keywords: 'all foods' },
  {
    id: 'beverage',
    labelEn: 'Beverages',
    labelHi: 'ड्रिंक्स व चाय',
    keywords: 'beverages beverage drinks drink tea chai iced tea coffee kaapi lassi chaas buttermilk water milk sharbat juice cooler',
  },
  {
    id: 'sweets',
    labelEn: 'Indian Sweets',
    labelHi: 'भारतीय मिठाई',
    keywords: 'indian sweets sweet dessert desserts mithai halwa kheer phirni ladoo barfi jalebi ghewar panjiri pongal modak kulfi cake cakes brownie brownies pastry pastries cheesecake rava cake fruit cake red velvet',
  },
  {
    id: 'indo_chinese',
    labelEn: 'Chinese',
    labelHi: 'इंडो-चाइनीज',
    keywords: 'chinese indo chinese noodles fried rice manchurian momos sizzler platter soup chilli paneer dim sum dimsum dumplings bao gyoza har gow siu mai',
  },
  {
    id: 'bread_rice',
    labelEn: 'Naan, Roti & Rice',
    labelHi: 'नान, रोटी व चावल',
    keywords: 'naan roti chapati paratha kulcha rice pulao biryani khichdi bread flatbread',
  },
  {
    id: 'dal_recipes',
    labelEn: 'Dal Recipes',
    labelHi: 'सभी दाल रेसिपी',
    keywords: 'dal recipes lentils sambhar rasam rajma chole khichdi kadhi',
  },
  {
    id: 'dal_curry',
    labelEn: 'Curries & Sabzi',
    labelHi: 'दाल व सब्ज़ी',
    keywords: 'curry curries sabzi gravy paneer masala kadhi saag dal',
  },
  {
    id: 'raita_salad',
    labelEn: 'Raita & Salad',
    labelHi: 'रायता व सलाद',
    keywords: 'raita salad salads kachumber curd dahi',
  },
  {
    id: 'pasta',
    labelEn: 'Pasta & Macaroni',
    labelHi: 'पास्ता व मैकरोनी',
    keywords: 'pasta macaroni microni penne spaghetti alfredo arrabbiata',
  },
  {
    id: 'sauces_dips',
    labelEn: 'Sauces & Dips',
    labelHi: 'सॉस व डिप्स',
    keywords: 'sauces sauce dips dip chutney mayo mayonnaise ketchup salsa vinegar',
  },
  {
    id: 'breakfast',
    labelEn: 'Breakfast',
    labelHi: 'नाश्ता',
    keywords: 'breakfast nashta dosa idli poha upma uttapam chilla oats daliya',
  },
  {
    id: 'snack_street',
    labelEn: 'Street Snacks',
    labelHi: 'चाट व स्नैक्स',
    keywords: 'street snacks snack chaat pakora samosa vada pav bhaji kachori puff puffs patties khari chakna namkeen bhujia mixture peanut peanuts makhana chivda bhutta bhuta makka maka corn popcorn sweet potato shakarkandi',
  },
  {
    id: 'protein_dairy',
    labelEn: 'Protein & Dairy',
    labelHi: 'प्रोटीन व डेयरी',
    keywords: 'protein dairy paneer egg eggs chicken fish meat tofu whey curd milk',
  },
  {
    id: 'fruit_nut',
    labelEn: 'Fruits & Nuts',
    labelHi: 'फल व मेवे',
    keywords: 'fruits fruit nuts nut dry fruits apple banana mango almond walnut',
  },
  {
    id: 'pizza_fastfood',
    labelEn: 'Pizza, Burgers & Tacos',
    labelHi: 'पिज़्ज़ा, बर्गर व टैको',
    keywords: 'pizza burgers burger tacos taco fastfood',
  },
  {
    id: 'rolls_wraps',
    labelEn: 'Rolls & Wraps',
    labelHi: 'रोल्स व रैप्स',
    keywords: 'rolls roll kathi frankie wraps wrap',
  },
  {
    id: 'packaged',
    labelEn: 'Packaged & Custom',
    labelHi: 'पैकेज्ड व कस्टम',
    keywords: 'packaged custom biscuit bread bar',
  },
];

const CATEGORY_KEYWORDS_BY_ID: Record<string, string> = Object.fromEntries(
  FOOD_CATEGORY_FILTERS.map((c) => [c.id, `${c.labelEn} ${c.keywords}`])
);

const CATEGORY_ALIAS_MAP: Record<string, string> = {
  all: 'all',
  'all foods': 'all',
  indian_sweets: 'sweets',
  'indian sweets': 'sweets',
  sweets: 'sweets',
  desserts: 'sweets',
  dessert: 'sweets',
  mithai: 'sweets',
  chinese: 'indo_chinese',
  'indo chinese': 'indo_chinese',
  indo_chinese: 'indo_chinese',
  beverages: 'beverage',
  beverage: 'beverage',
  drinks: 'beverage',
  drink: 'beverage',
  'drinks & tea': 'beverage',
  tea: 'beverage',
  'dal recipes': 'dal_recipes',
  dal_recipes: 'dal_recipes',
  dal: 'dal_recipes',
  'naan roti rice': 'bread_rice',
  'bread & rice': 'bread_rice',
  bread_rice: 'bread_rice',
  indian_mains: 'indian_mains',
  'curries & sabzi': 'dal_curry',
  dal_curry: 'dal_curry',
  'raita & salad': 'raita_salad',
  raita_salad: 'raita_salad',
  raita: 'raita_salad',
  salad: 'raita_salad',
  'pasta & macaroni': 'pasta',
  pasta: 'pasta',
  'sauces & dips': 'sauces_dips',
  sauces_dips: 'sauces_dips',
  sauces: 'sauces_dips',
  dips: 'sauces_dips',
  breakfast: 'breakfast',
  'street snacks': 'snack_street',
  snack_street: 'snack_street',
  snacks: 'snack_street',
  'protein & dairy': 'protein_dairy',
  protein_dairy: 'protein_dairy',
  'fruits & nuts': 'fruit_nut',
  fruit_nut: 'fruit_nut',
  pizza_fastfood: 'pizza_fastfood',
  'pizza burgers tacos': 'pizza_fastfood',
  pizza: 'pizza_fastfood',
  burgers: 'pizza_fastfood',
  burger: 'pizza_fastfood',
  mcdonald: 'pizza_fastfood',
  'burger king': 'pizza_fastfood',
  'taco bell': 'pizza_fastfood',
  tacos: 'pizza_fastfood',
  rolls_wraps: 'rolls_wraps',
  'rolls wraps': 'rolls_wraps',
  rolls: 'rolls_wraps',
  roll: 'rolls_wraps',
  wraps: 'rolls_wraps',
  packaged: 'packaged',
  custom: 'packaged',
  'packaged & custom': 'packaged',
};

export function normalizeCategoryFilter(raw?: string | null): string {
  const cleaned = normalizeFoodText(raw || '');
  if (!cleaned) return 'all';
  if (CATEGORY_ALIAS_MAP[cleaned]) return CATEGORY_ALIAS_MAP[cleaned];
  const rawLower = String(raw || '').trim().toLowerCase();
  return CATEGORY_ALIAS_MAP[rawLower] || rawLower || 'all';
}

function getSearchableCorpus(food: FoodItem): {
  nameNorm: string;
  nameCanonical: string;
  hiNorm: string;
  aliases: string[];
  extra: string;
} {
  const aliases = (FOOD_LOCAL_ALIASES[food.id] || []).map((a) => canonicalizeFoodTerms(a));
  const categoryHints = CATEGORY_KEYWORDS_BY_ID[food.category] || '';
  return {
    nameNorm: normalizeFoodText(food.name),
    nameCanonical: canonicalizeFoodTerms(food.name),
    hiNorm: normalizeFoodText(food.nameHi || ''),
    aliases,
    extra: canonicalizeFoodTerms(
      `${food.category.replace(/_/g, ' ')} ${categoryHints} ${food.ingredientsSummary || ''} ${food.id.replace(/_/g, ' ')}`
    ),
  };
}

export function scoreFoodMatch(food: FoodItem, rawQuery: string, isRemote = false): number {
  const qNorm = normalizeFoodText(rawQuery);
  if (!qNorm) return isRemote ? 0 : 100;

  const qCanon = canonicalizeFoodTerms(rawQuery);
  const mappedSynonym = LOCAL_QUERY_SYNONYMS[qNorm] || LOCAL_QUERY_SYNONYMS[qCanon] || '';
  const queryVariants = Array.from(new Set([qNorm, qCanon, mappedSynonym].filter(Boolean)));
  const tokens = qCanon.split(' ').filter(Boolean);

  const corpus = getSearchableCorpus(food);
  const localPriorityBoost = isRemote ? 0 : 250;

  // 1. Exact match on name, Hindi name, or mapped local alias
  for (const qv of queryVariants) {
    if (
      corpus.nameNorm === qv ||
      corpus.nameCanonical === qv ||
      corpus.hiNorm === qv ||
      corpus.aliases.includes(qv)
    ) {
      return 1000 + localPriorityBoost;
    }
  }

  // 2. Prefix match on name, Hindi name, or mapped alias
  for (const qv of queryVariants) {
    if (
      corpus.nameNorm.startsWith(qv) ||
      corpus.nameCanonical.startsWith(qv) ||
      corpus.hiNorm.startsWith(qv) ||
      corpus.aliases.some((a) => a.startsWith(qv))
    ) {
      return 780 + localPriorityBoost;
    }
  }

  // 3. Phrase containment in name, Hindi name, or mapped alias
  for (const qv of queryVariants) {
    if (
      corpus.nameNorm.includes(qv) ||
      corpus.nameCanonical.includes(qv) ||
      corpus.hiNorm.includes(qv) ||
      corpus.aliases.some((a) => a.includes(qv))
    ) {
      // Bonus if a word in name starts with query
      const wordStartBonus = corpus.nameCanonical.split(' ').some((w) => w.startsWith(qv)) ? 80 : 0;
      return 560 + wordStartBonus + localPriorityBoost;
    }
  }

  // 4. All tokens match across name, Hindi name, aliases, category & ingredients
  const combined = `${corpus.nameNorm} ${corpus.nameCanonical} ${corpus.hiNorm} ${corpus.aliases.join(' ')} ${corpus.extra}`;
  if (tokens.length > 0 && tokens.every((tk) => combined.includes(tk))) {
    const nameTokenHits = tokens.filter((tk) => corpus.nameCanonical.includes(tk)).length;
    return 360 + nameTokenHits * 40 + localPriorityBoost;
  }

  return 0;
}

export interface PrioritizedSearchOptions {
  query?: string;
  customFoods?: FoodItem[];
  localFoods: FoodItem[];
  remoteFoods?: FoodItem[];
  categoryFilter?: string;
  activeLetter?: string | null;
  language?: Language;
  limit?: number;
}

export function matchesCategoryFilter(food: FoodItem, rawCategoryFilter: string): boolean {
  const categoryFilter = normalizeCategoryFilter(rawCategoryFilter);
  if (!categoryFilter || categoryFilter === 'all') return true;
  if (categoryFilter === 'dal_recipes') {
    return (
      food.category === 'dal_curry' &&
      /\b(dal|sambhar|rasam|lobia|rajma|chole|khichdi|kadhi)\b/i.test(food.name)
    );
  }
  if (categoryFilter === 'raita_salad') {
    return food.category === 'raita_salad' || food.id === 'boondi_raita' || food.id === 'cucumber_raita';
  }
  if (categoryFilter === 'indian_mains') {
    return food.category === 'bread_rice' || food.category === 'dal_curry';
  }
  if (categoryFilter === 'packaged') {
    return food.category === 'packaged' || food.category === 'custom';
  }
  return food.category === categoryFilter;
}

export function getCategoryCounts(foods: FoodItem[]): Record<string, number> {
  const counts: Record<string, number> = { all: foods.length };
  for (const cat of FOOD_CATEGORY_FILTERS) {
    if (cat.id === 'all') continue;
    counts[cat.id] = foods.filter((f) => matchesCategoryFilter(f, cat.id)).length;
  }
  return counts;
}

/**
 * Prioritizes custom + comprehensive Indian & Global DB over external results,
 * resolves local aliases/names, deduplicates overlapping dishes, and sorts cleanly.
 */
export function searchFoodsWithPriority({
  query = '',
  customFoods = [],
  localFoods,
  remoteFoods = [],
  categoryFilter = 'all',
  activeLetter = null,
  language = 'en',
  limit,
}: PrioritizedSearchOptions): FoodItem[] {
  const isHi = language === 'hi';
  const trimmed = query.trim();

  // Priority order: 1. Custom user foods -> 2. Comprehensive local Indian & global DB -> 3. Remote Open Food Facts
  const combinedUnique = deduplicateFoods([
    ...customFoods,
    ...localFoods,
    ...remoteFoods,
  ]);

  const byCategory = combinedUnique.filter((f) => matchesCategoryFilter(f, categoryFilter));

  const byLetter = activeLetter
    ? byCategory.filter((f) => {
        const ch = activeLetter.toLowerCase();
        const label = (isHi ? f.nameHi : f.name).trim().toLowerCase();
        return label.startsWith(ch) || f.name.trim().toLowerCase().startsWith(ch);
      })
    : byCategory;

  if (!trimmed) {
    const sortedAlpha = [...byLetter].sort((a, b) => {
      const aName = (isHi ? a.nameHi : a.name).trim();
      const bName = (isHi ? b.nameHi : b.name).trim();
      return aName.localeCompare(bName);
    });
    return typeof limit === 'number' ? sortedAlpha.slice(0, limit) : sortedAlpha;
  }

  const scored = byLetter
    .map((food) => ({
      food,
      score: scoreFoodMatch(food, trimmed, food.id.startsWith('off_')),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aName = (isHi ? a.food.nameHi : a.food.name).trim();
      const bName = (isHi ? b.food.nameHi : b.food.name).trim();
      return aName.localeCompare(bName);
    })
    .map((entry) => entry.food);

  return typeof limit === 'number' ? scored.slice(0, limit) : scored;
}

/**
 * Resolves a FoodItem (e.g. from barcode/Open Food Facts) against the local comprehensive DB
 * to prioritize local nutrition data and local Hindi/English names when an unambiguous match exists.
 */
export function resolveLookupFoodItem(candidate: FoodItem, localFoods: FoodItem[]): FoodItem {
  const mappedCandidate = mapFoodLocalNames(candidate);
  if (!mappedCandidate.id.startsWith('off_')) {
    return mappedCandidate;
  }

  // Prefer barcode match if present in local DB
  if (mappedCandidate.barcode) {
    const byBarcode = localFoods.find((f) => f.barcode === mappedCandidate.barcode);
    if (byBarcode) return mapFoodLocalNames(byBarcode);
  }

  // If Open Food Facts product name exactly matches a local DB item canonical name, enrich/map local Hindi name
  const candKey = canonicalFoodNameKey(mappedCandidate.name);
  if (candKey) {
    const exactLocal = localFoods.find((f) => canonicalFoodNameKey(f.name) === candKey);
    if (exactLocal && !/[\u0900-\u097F]/.test(mappedCandidate.nameHi)) {
      return {
        ...mappedCandidate,
        nameHi: exactLocal.nameHi,
      };
    }
  }

  return mappedCandidate;
}
