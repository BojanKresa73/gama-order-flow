/**
 * Minimax Mapping Tables
 * 
 * Mapiranje između naših internih podataka i Minimax šifara.
 * Ove tabele omogućavaju da XML export koristi postojeće šifre u Minimax-u
 * umesto kreiranja novih, čime se izbegava greška "Šifra već postoji".
 */

// Mapiranje formata ploča na Minimax šifre artikala
// Ključ: format_name iz plate_formats tabele (normalizovan)
// Vrednost: Minimax šifra artikla
export const PLATE_FORMAT_TO_MINIMAX_ARTIKAL: Record<string, string> = {
  // Veliki formati (1xxx)
  "1060x795": "21B101",
  "1030x790": "21B102",
  "1030×790": "21B102", // sa × karakterom
  "1030x785": "21B103",
  "1040x800": "21B104",
  "1050x795": "21B105",
  
  // Srednji formati (7xx)
  "745x605": "21B201",
  "745×605": "21B201", // sa × karakterom
  "740x605": "21B202",
  "730x605": "21B203",
  "724x615": "21B204",
  "745x620": "21B205",
  
  // Mali formati (5xx/4xx)
  "510x400": "21B301",
  "521x415": "21B302",
  "490x370": "21B303",
  "450x370": "21B304",
};

// Mapiranje PIB-a stranke na Minimax šifru stranke
// Generisano iz Minimax export-a stranaka
export const PIB_TO_MINIMAX_STRANKA: Record<string, string> = {
  "100139465": "156",
  "109894059": "163",
  "100059369": "65",
  "102918042": "200",
  "104123482": "27",
  "107971947": "34",
  "105208556": "164",
  "110409658": "171",
  "100536197": "40",
  "102763535": "149",
  "103372376": "60",
  "108125894": "8",
  "106494132": "189",
  "112984246": "256",
  "103146725": "102",
  "107902275": "202",
  "101671074": "62",
  "100291945": "187",
  "104650566": "61",
  "105007638": "4",
  "109997358": "175",
  "108954816": "250",
  "105401115": "70",
  "100390389": "179",
  "113033181": "183",
  "113891465": "191",
  "100000081": "6",
  "106924899": "108",
  "112069571": "157",
  "107695879": "241",
  "100009254": "128",
  "109215159": "155",
  "106063025": "89",
  "106137012": "133",
  "100034556": "48",
  "104174720": "31",
  "104117540": "30",
  "103609765": "79",
  "109619867": "162",
  "107178665": "141",
  "106979096": "143",
  "112135420": "221",
  "113461818": "245",
  "101509052": "67",
  "104631161": "83",
  "112424099": "236",
  "112929318": "254",
  "103146312": "73",
  "105392016": "88",
  "100028974": "47",
  "110330612": "166",
  "111318691": "210",
  "100010952": "46",
  "103159001": "29",
  "101396082": "21",
  "100054393": "63",
  "106002389": "131",
  "108098048": "150",
  "111046989": "195",
  "103606313": "78",
  "108099652": "151",
  "101406890": "1",
  "105961085": "130",
  "102068001": "68",
  "104147498": "82",
  "108112626": "152",
  "112880178": "252",
  "100015133": "22",
  "102556800": "71",
  "110665691": "173",
  "103116477": "28",
  "107847339": "148",
  "111091422": "197",
  "112888920": "253",
  "113145949": "242",
  "101396085": "217",
  "112306458": "226",
  "102312990": "69",
  "106411891": "138",
  "103632422": "80",
  "103769779": "81",
  "113164247": "243",
  "106392979": "137",
  "111153437": "201",
  "111098177": "199",
  "110604108": "169",
  "109295139": "160",
  "106411894": "139",
  "100084330": "2",
  "111027606": "194",
  "107067346": "140",
  "100020447": "24",
  "100017757": "23",
  "108012287": "74",
  "102040609": "64",
  "110591088": "168",
  "112189247": "223",
  "110534118": "167",
  "106216654": "134",
  "103159014": "76",
  "111098180": "198",
  "101432911": "66",
  "113462088": "246",
  "108209118": "154",
  "106428403": "93",
  "106469387": "95",
  "101020929": "5",
  "112236671": "225",
  "113581949": "248",
  "104232447": "32",
  "106411900": "92",
  "113032888": "240",
  "111041730": "196",
  "102917606": "72",
  "104233697": "33",
  "112179168": "222",
  "102094339": "9",
  "107328548": "145",
  "109200866": "53",
  "106437376": "94",
  "112319891": "227",
  "101395728": "20",
  "112369131": "230",
  "106479422": "96",
  "106555291": "99",
  "106510291": "98",
  "112337018": "228",
  "106490988": "97",
  "107294376": "144",
  "112560050": "237",
  "100048477": "50",
  "113599684": "249",
  "108039610": "75",
  "107410541": "146",
  "101404888": "127",
  "109266498": "159",
  "105805679": "129",
  "113449044": "244",
  "100004665": "44",
  "100007098": "45",
  "112700024": "238",
  "100037009": "49",
  "111179012": "203",
  "100051015": "51",
  "110648018": "172",
  "109248096": "158",
  "106555294": "100",
  "112804816": "251",
  "106586561": "101",
  "108143936": "153",
  "112356247": "229",
  "112373621": "231",
  "107507820": "147",
  "101019898": "3",
  "112375648": "232",
  "103159007": "77",
  "112383651": "233",
  "109220412": "54",
  "109236018": "56",
  "109229212": "55",
  "106298588": "136",
  "105117082": "87",
  "100053418": "52",
  "112193420": "224",
  "100059837": "7",
  "106248088": "135",
  "111189315": "204",
  "111279300": "209",
  "106556894": "142",
  "111263006": "208",
  "111241629": "206",
  "111245936": "207",
  "111212615": "205",
  "110716706": "174",
  "112393454": "234",
  "112396442": "235",
  "104949259": "86",
  "106002398": "132",
  "100059372": "57",
  "112862463": "255",
  "105045579": "85",
  "111350612": "212",
  "111379897": "214",
  "111369812": "213",
  "110639712": "170",
  "111399791": "215",
  "111336200": "211",
  "111429706": "216",
  "101393976": "19",
  "109240003": "161",
  "100058991": "59",
  "100058969": "58",
  "112726397": "239",
  "112718891": "247",
  "111917585": "218",
  "112051488": "219",
  "112054185": "220",
  "101393608": "18",
  "104730685": "84",
  "101393246": "16",
  "103998719": "3", // Publik DOO Valjevo
  "100069085": "11",
  "100068679": "10",
  "100069454": "12",
  "100088179": "14",
  "101389233": "15",
  "101392877": "17",
  "100076085": "13",
};

// Naziv artikla za CTP ploče po formatu
export const PLATE_FORMAT_TO_NAZIV: Record<string, string> = {
  "1060x795": "CTcP QUANTUM PREMIUM PLATE 1060 x 795",
  "1030x790": "CTcP QUANTUM PREMIUM PLATE 1030 x 790",
  "1030×790": "CTcP QUANTUM PREMIUM PLATE 1030 x 790",
  "1030x785": "CTcP QUANTUM PREMIUM PLATE 1030 x 785",
  "1040x800": "CTcP QUANTUM PREMIUM PLATE 1040 x 800",
  "1050x795": "CTcP QUANTUM PREMIUM PLATE 1050 x 795",
  "745x605": "CTcP QUANTUM PREMIUM PLATE 745 x 605",
  "745×605": "CTcP QUANTUM PREMIUM PLATE 745 x 605",
  "740x605": "CTcP QUANTUM PREMIUM PLATE 740 x 605",
  "730x605": "CTcP QUANTUM PREMIUM PLATE 730 x 605",
  "724x615": "CTcP QUANTUM PREMIUM PLATE 724 x 615",
  "745x620": "CTcP QUANTUM PREMIUM PLATE 745 x 620",
  "510x400": "CTcP QUANTUM PREMIUM PLATE 510 x 400",
  "521x415": "CTcP QUANTUM PREMIUM PLATE 521 x 415",
  "490x370": "CTcP QUANTUM PREMIUM PLATE 490 x 370",
  "450x370": "CTcP QUANTUM PREMIUM PLATE 450 x 370",
};

/**
 * Normalizuje format string za lookup (zamenjuje × sa x, uklanja razmake)
 */
export function normalizeFormat(format: string): string {
  return format
    .replace(/×/g, "x")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * Dobija Minimax šifru artikla za dati format ploče
 */
export function getMinimaxArtikalSifra(formatName: string): string | null {
  const normalized = normalizeFormat(formatName);
  
  // Pokušaj direktan match
  if (PLATE_FORMAT_TO_MINIMAX_ARTIKAL[formatName]) {
    return PLATE_FORMAT_TO_MINIMAX_ARTIKAL[formatName];
  }
  
  // Pokušaj sa normalizovanim formatom
  for (const [key, value] of Object.entries(PLATE_FORMAT_TO_MINIMAX_ARTIKAL)) {
    if (normalizeFormat(key) === normalized) {
      return value;
    }
  }
  
  return null;
}

/**
 * Dobija Minimax šifru stranke za dati PIB
 */
export function getMinimaxStrankaSifra(pib: string | null | undefined): string | null {
  if (!pib) return null;
  
  // Očisti PIB od ne-numeričkih karaktera
  const cleanPib = pib.replace(/\D/g, "");
  
  return PIB_TO_MINIMAX_STRANKA[cleanPib] || null;
}

/**
 * Dobija naziv artikla za dati format ploče
 */
export function getMinimaxArtikalNaziv(formatName: string): string | null {
  const normalized = normalizeFormat(formatName);
  
  if (PLATE_FORMAT_TO_NAZIV[formatName]) {
    return PLATE_FORMAT_TO_NAZIV[formatName];
  }
  
  for (const [key, value] of Object.entries(PLATE_FORMAT_TO_NAZIV)) {
    if (normalizeFormat(key) === normalized) {
      return value;
    }
  }
  
  return null;
}
