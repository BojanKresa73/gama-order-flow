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
// Generisano iz Minimax export-a stranaka (2025-02-03)
export const PIB_TO_MINIMAX_STRANKA: Record<string, string> = {
  // A
  "100139465": "156", // KESTEN BEOGRAD
  "109894059": "163", // Filmski festival SLOBODNA ZONA
  "100059369": "65",  // GS1 Srbija
  "102918042": "200", // Izdavačka fondacija SPC
  "104123482": "27",  // 3D PRINT
  "107971947": "34",  // ADM GRAFIKA KRALJEVO
  "105208556": "164", // ADORE CHOCOLAT
  "110409658": "171", // ADVOKATSKO ORTACKO DRUSTVO VASILJEVIC
  "100536197": "40",  // AMBALAŽERKA VUČKOVIĆ
  "102763535": "149", // Ambasada Republike Italije
  "103372376": "60",  // AMD-SISTEM
  "108125894": "8",   // ART KONTO
  "106494132": "189", // AUTOTECHNICA SERBIA
  
  // B
  "112984246": "256", // B COOL Beograd
  "103146725": "102", // BAREL GRUPA
  "107902275": "202", // BC GROUP COMPUTERS
  "101671074": "62",  // BELPAK
  "100291945": "187", // BG SANITARIJA
  "104650566": "61",  // BIGRAF PLUS
  "105007638": "4",   // BIROGRAF COMP
  "109997358": "175", // BLANKPRINT 2017
  "108954816": "250", // Boomago
  "105401115": "70",  // BRAND BOX
  "100390389": "179", // BRIOKON
  "113033181": "183", // Brookhills
  
  // C
  "113891465": "191", // CASSA DEPOSITI E PRESTITI
  "100000081": "6",   // COMES
  "106924899": "108", // COPY PLANET
  "112069571": "157", // CRAFTER
  "114104628": "153", // CRAZY PIZZA
  "101745553": "39",  // ČUGURA PRINT
  
  // D
  "103482850": "104", // DELHAIZE SERBIA
  "100295161": "50",  // DELTA TERM
  "108005889": "99",  // DERETA
  "100145317": "",    // DIPO (nema šifru)
  "100049486": "160", // dm drogerie markt
  "106493814": "205", // DON JUAN
  "100145946": "115", // DOUBLECLICK ADVERTISING
  "103641855": "110", // HIGIA
  "109859061": "86",  // Mala kolubara
  "100238485": "133", // PROMONT GROUP
  "100223166": "119", // YU INFO VODIČ
  "103998719": "3",   // PUBLIK DOO VALJEVO
  "100048772": "37",  // Deloitte
  
  // E
  "104961304": "152", // EMMEZETA SRBIJA
  "100159156": "165", // ERROR DESIGN
  "112159215": "162", // Espressobox
  "103880097": "13",  // EURO-DREAM
  "106065280": "130", // Euroguma Plus
  "107114114": "71",  // EVGENIOU GRAINS
  
  // F
  "115094073": "184", // F packaging
  "109014631": "134", // FIVE STARS FILM
  "100829594": "142", // FLYING CARGO YU
  "111935762": "126", // FUN TIME
  
  // G
  "108134346": "53",  // GAMA DIGITAL CENTAR
  "102778428": "33",  // GIGATRON
  "112600237": "125", // GPHARM
  "103944097": "42",  // GRADINA NOVA PAZOVA
  "103965261": "5",   // GRAFIKUM
  "106689809": "20",  // GRAFO SERVIS
  "100373161": "35",  // GRAFOLIK
  "112723841": "140", // GRAND CROSS WEST 65
  
  // H
  "105529090": "127", // HIDROPONIKA
  
  // I
  "101670560": "196", // Idea Marketi
  "100000129": "118", // IGEPA DEUS
  "104990791": "117", // IKEA SRBIJA
  "110920508": "49",  // INFINITY MOBILE
  "109087639": "75",  // INFO POINT
  "104505119": "81",  // INFOSTUD 3
  "100001693": "201", // INSA INDUSTRIJA SATOVA
  "100155520": "66",  // INSTITUT ZA RAČUNOVODSTVO
  "101722292": "24",  // INTRA
  "103851149": "145", // INTRA.NET COMMUNICATION
  "102825661": "155", // ISTYLE STORES
  "102763635": "174", // Italijanski institut za kulturu
  "103882837": "198", // ITX RS
  "108295841": "141", // IVANA MAKSIMOVIĆ PR MAKS PRINTING
  
  // J
  "104260456": "38",  // JP PUTEVI SRBIJE
  "112252528": "15",  // JOVAN IVKOVIĆ PR IVKODEV
  "104359545": "68",  // JOVŠIĆ PRINTING CENTAR
  "106679160": "197", // JYSK
  
  // K
  "107542990": "203", // KAFANA ĆIRI BU ĆIRI BA
  "101958959": "32",  // KLIK COMMERCE
  "105633483": "159", // KLUB KNJIŽEVNIKA
  "106679241": "17",  // Knjižara KNJIGOLOVKA PLUS
  "100833757": "59",  // KOTUR I OSTALI
  
  // L
  "106717222": "101", // LA MANTINI
  "114486446": "206", // Largo Advisory
  "103132663": "21",  // LESNINA S
  "106884584": "116", // LIDL SRBIJA
  "110728351": "103", // LUCRATIVE 8
  "100000830": "138", // LUKOIL SRBIJA
  
  // M
  "100537028": "56",  // MAJORPROMET
  "113172058": "97",  // MB NOVA MLADENOVAC
  "100278030": "204", // MENATI EVICA ĆIRIĆ PR
  "114804709": "139", // MESARA MILOŠ NBG
  "102864104": "199", // METRO CASH & CARRY
  "107398877": "57",  // MG GRAFIK
  "105856226": "46",  // MG MASTER GRAF
  "100157974": "23",  // MIKRO PRINC
  "107477372": "98",  // MILAN DJAKOVIĆ PR BANIJA LUX
  "101685102": "74",  // MINISTARSTVO FINANSIJA - UPRAVA CARINA
  "115363462": "135", // MIRA MAGLOV PR SOCIALNOVA
  "103166884": "161", // MOL Serbia
  "104359432": "1",   // MSF PHARM
  
  // N
  "104052135": "154", // NIS
  "107366745": "31",  // NATAŠA MARKOVIĆ PR ŠTAMPARIJA MARKOVIĆ-3M
  "108621734": "146", // NBN GROUP
  "107261232": "120", // NEBOJŠA RISTIĆ PR ĐERDAN
  "100376566": "109", // NIMAX
  "100170703": "28",  // NO-KAČI
  "106083558": "107", // NVM Graphic Solutions
  
  // O
  "110734511": "166", // OKOV INTERNATIONAL
  "100061839": "178", // OPTOFORM
  
  // P
  "106928505": "253", // PEČENJARA LEDINE
  "100102480": "30",  // PEKOGRAF
  "105518256": "136", // PERSPEKTA
  "101733751": "144", // PKVM SISTEMI
  "101667170": "",    // PLURIPAP (nema šifru)
  "103724427": "169", // POCO LOCO
  "102670546": "26",  // POZITIV PRINT
  "104119148": "106", // AIDA-TRADE
  "114876455": "150", // GAMA UNITED
  "108788219": "72",  // VEZA SYSTEM
  "101385092": "275", // OPTIMUM DOO
  "100442796": "173", // VIGOR
  "105847973": "55",  // PROOF VJEKOSLAV BAŽANT PR
  "103635212": "112", // PUBLIK PRAKTIKUM
  
  // R
  "100000299": "9",   // RAIFFEISEN BANKA
  "107955264": "36",  // RETRO PRINT
  
  // S
  "108516572": "7",   // SAS VILJUŠKARI
  "107564020": "105", // SAVSKI SVETIONIK
  "104025860": "14",  // SCP
  "109782137": "122", // SDS PROPERTY SOLUTIONS
  "106713309": "51",  // Seyfor
  "110803242": "182", // SF1 COFFEE
  "100037696": "131", // SHADOWS
  "109505353": "25",  // SIMBOL PRINT
  "111945660": "12",  // SIMprint
  "100002782": "85",  // SLUŽBENI GLASNIK
  "114077439": "96",  // SMK FABRIKA
  "112297610": "111", // SPLAV RESTORAN PINGVIN
  "114611687": "132", // Stefan Zlatić pr SAVSKI ŠKORPION
  "106907114": "167", // STOLARIJA RODIĆ
  "115172457": "192", // STUDENTI AKADEMIJE POLITEHNIKA
  "106842957": "2",   // ŠTAMPARIJA DUNAV
  "100196737": "177", // ŠTAMPARSKO IZDAVAČKO MAČINKOVIĆ
  
  // T
  "112611034": "10",  // Taurus Press
  "100416234": "19",  // TEHNOMANIJA
  "104457054": "22",  // TEHNOMEDIA CENTAR
  "113122885": "121", // Terassa by Dolly
  "101012572": "58",  // TODEY
  "103727144": "87",  // TON PLUS
  "102624972": "",    // TRANSFERA (nema šifru)
  "101187419": "80",  // TRIEM
  "101924870": "100", // TYPOPRINT
  
  // U
  "109692738": "158", // UDRUŽENjE ŠANSA ZA RODITELjSTVO
  "100000170": "95",  // UNICREDIT BANK SRBIJA
  "109154021": "11",  // UNITED INTERNET
  
  // V
  "106156093": "83",  // VIŠNJICA RESTORANI
  "108498306": "79",  // VOULEZ VOUS ETAGE
  
  // W
  "113414969": "168", // Waterdrop WB
  
  // Y
  "104318304": "52",  // Yettel
  
  // Z
  "108297710": "16",  // ZEMUNPLAST PRESS
  "100829096": "41",  // ZLAMEN
  "100280412": "18",  // ŽDRAL
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

/**
 * Override mapa za skraćene nazive klijenata u Minimax XML opisu.
 * Ključ: početak naziva klijenta (case-insensitive match).
 * Vrednost: željeni skraćeni naziv za Opis polje.
 */
const CLIENT_SHORT_NAME_OVERRIDES: Record<string, string> = {
  "ŠTAMPARIJA DUNAV": "dunav",
  "STAMPARIJA DUNAV": "dunav",
};

/**
 * Dobija skraćeni naziv klijenta za Minimax XML opis.
 * Prvo proverava override mapu, pa koristi prvu reč naziva.
 */
export function getClientShortName(clientName: string): string {
  const upper = clientName.toUpperCase().trim();
  for (const [prefix, shortName] of Object.entries(CLIENT_SHORT_NAME_OVERRIDES)) {
    if (upper.startsWith(prefix.toUpperCase())) {
      return shortName;
    }
  }
  return clientName.split(" ")[0].toLowerCase().substring(0, 10);
}
