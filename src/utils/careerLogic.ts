import { ALL_CLUBS, CLUB_TO_LEAGUE, DATA, PLAYERS_POOL } from '../data/database';
import type {
  CareerEvent,
  CareerNewsItem,
  LeagueFixture,
  LeagueState,
  MatchGoalEntry,
  MatchPlayerStat,
  Player,
  Position,
  SideEvaluation,
  StandingsRow,
  Team,
  TeamCareerState,
} from '../types/game';
import {
  enforceHealthyStartersForTeam,
  ensureTeamLineup,
} from './lineupLogic';
import { pickAssister, pickGoalscorer, rollMatchScoreline, side } from './matchEngine';

export interface RivalNewsTemplate {
  id: string;
  club: string;
  player: string;
  delta: number;
  source: string;
  title: string;
  body: string;
}

export interface WorldNewsTemplate {
  id: string;
  club: string;
  source: string;
  title: string;
  body: string;
}

export const PREMIER_STAR_NEWS_TEMPLATES: RivalNewsTemplate[] = [
  {
    id: 'mci_haaland_fire',
    club: 'Manchester City',
    player: 'Erling Haaland',
    delta: 2,
    source: 'Sky Sports · Yıldız Raporu',
    title: 'Erling Haaland Özel Bitiricilik İdmanlarıyla Durdurulamıyor!',
    body: "Manchester City'nin Norveçli gol makinesi Erling Haaland, tesislerde yaptığı ekstra şut ve fiziksel güçlendirme çalışmalarının ardından formunun zirvesine çıktı.",
  },
  {
    id: 'mci_psr_foden',
    club: 'Manchester City',
    player: 'Phil Foden',
    delta: -2,
    source: 'The Athletic · Etihad Kulisleri',
    title: "Manchester City'de Finansal Denetim Gerginliği ve Form Düşüşü!",
    body: 'Premier Lig mali kurulunun incelemesi kulüpte soğuk rüzgarlar estirirken, Phil Foden son haftalardaki yoğun maç temposu nedeniyle fiziksel düşüş yaşıyor.',
  },
  {
    id: 'ars_saka_boost',
    club: 'Arsenal',
    player: 'Bukayo Saka',
    delta: 2,
    source: 'BBC Sport · Kuzey Londra',
    title: 'Bukayo Saka Kanatta Fırtına Gibi Esiyor!',
    body: "Arsenal'in yıldız kanat oyuncusu Bukayo Saka, son haftalardaki hücum istatistikleriyle ligin en tehlikeli hücumcuları arasında ilk sıraya yerleşti.",
  },
  {
    id: 'ars_odegaard_dip',
    club: 'Arsenal',
    player: 'Martin Odegaard',
    delta: -2,
    source: 'Evening Standard · Sağlık Raporu',
    title: "Arsenal'de Martin Odegaard Hafif Sakatlıkla Boğuşuyor!",
    body: 'Kuzey Londra ekibinin kaptanı Martin Odegaardın bileğindeki ağrılar nedeniyle hafta içi antrenmanların bir bölümünü kaçırdığı ve maç ritminde düşüş yaşadığı bildirildi.',
  },
  {
    id: 'liv_isak_surge',
    club: 'Liverpool',
    player: 'Alexander Isak',
    delta: 2,
    source: 'Liverpool Echo · Anfield Gündemi',
    title: "Alexander Isak Anfield'ı Coşturmaya Devam Ediyor!",
    body: 'Liverpool hücum hattının en keskin silahı Alexander Isak, ceza sahası içindeki soğukkanlı bitiriciliğiyle teknik heyetten tam not aldı.',
  },
  {
    id: 'liv_wirtz_pressure',
    club: 'Liverpool',
    player: 'Florian Wirtz',
    delta: -1,
    source: 'Sky Sports · Analiz',
    title: 'Florian Wirtz Üzerinde Sert Savunma Markajı!',
    body: 'Premier Lig savunmalarının sert ikili mücadeleleri karşısında yıpranan Florian Wirtz, son haftalarda oyun kurmakta beklenenden fazla zorlanıyor.',
  },
  {
    id: 'che_palmer_cold',
    club: 'Chelsea',
    player: 'Cole Palmer',
    delta: -2,
    source: 'The Telegraph · Londra Gündemi',
    title: "Stamford Bridge'de Cole Palmer ve Rotasyon Tartışması!",
    body: "Chelsea'nin kalabalık kadrosunda sistem değişiklikleri nedeniyle istediği topları alamayan Cole Palmer'ın antrenmanlarda moralsiz olduğu gözlemlendi.",
  },
  {
    id: 'che_joaopedro_hot',
    club: 'Chelsea',
    player: 'Joao Pedro',
    delta: 2,
    source: 'Sky Sports · Maç Analizi',
    title: 'Chelsea Hücumunda Joao Pedro Rüzgarı!',
    body: 'Mavilerin Brezilyalı yıldızı Joao Pedro, bağlantı oyunu ve ceza sahası koşularıyla takımın en formda gol ayağı haline geldi.',
  },
  {
    id: 'mun_bruno_crisis',
    club: 'Manchester United',
    player: 'Bruno Fernandes',
    delta: -2,
    source: 'Manchester Evening News',
    title: "Old Trafford'da Kaptan Bruno Fernandes'e Medya Eleştirisi!",
    body: "Manchester United'ın dalgalı performansı sonrası İngiliz basını kaptan Bruno Fernandes'in saha içi beden dilini ağır sözlerle eleştirdi; oyuncunun morali bozuk.",
  },
  {
    id: 'mun_cunha_form',
    club: 'Manchester United',
    player: 'Matheus Cunha',
    delta: 2,
    source: 'The Guardian · Carrington Raporu',
    title: 'Matheus Cunha Carrington Tesislerinde Vites Yükseltti!',
    body: "Manchester United'ın hücum yıldızı Matheus Cunha, hızı ve uzaktan şutlarıyla kırmızı-şeytanların hücumdaki en büyük kozu oldu.",
  },
  {
    id: 'tot_vandeven_wall',
    club: 'Tottenham',
    player: 'Micky van de Ven',
    delta: 2,
    source: 'Football London',
    title: 'Micky van de Ven Hız Rekorları Kırıyor!',
    body: "Tottenham'ın Hollandalı stoperi Micky van de Ven, savunma arkasına atılan toplardaki sprint hızıyla Premier Lig forvetlerine geçit vermiyor.",
  },
  {
    id: 'tot_kudus_slump',
    club: 'Tottenham',
    player: 'Mohamed Kudus',
    delta: -2,
    source: 'Evening Standard',
    title: "Tottenham'da Mohamed Kudus Taktik Disiplin Uyarısı Aldı!",
    body: 'Son maçlarda top kaybı oranı yükselen Mohamed Kudus, teknik heyet tarafından bireysel oyun yerine pas oyununa dönmesi konusunda uyarıldı.',
  },
  {
    id: 'new_tonali_boost',
    club: 'Newcastle United',
    player: 'Sandro Tonali',
    delta: 2,
    source: 'Chronicle Live',
    title: "St. James' Park'ta Sandro Tonali Orta Sahayı Domine Ediyor!",
    body: "Newcastle United'ın İtalyan yıldızı Sandro Tonali, yüksek koşu mesafesi ve kilit paslarıyla takımını sırtlamaya devam ediyor.",
  },
  {
    id: 'avl_jackson_boost',
    club: 'Aston Villa',
    player: 'Nicolas Jackson',
    delta: 2,
    source: 'Birmingham Mail',
    title: "Villa Park'ta Nicolas Jackson Savunma Arkasını Yıpratıyor!",
    body: "Aston Villa'nın hızlı forveti Nicolas Jackson, yakaladığı form grafiğiyle teknik heyetin yüzünü güldürdü.",
  },
  {
    id: 'cry_wharton_star',
    club: 'Crystal Palace',
    player: 'Adam Wharton',
    delta: 2,
    source: 'South London Press',
    title: "Avrupa Devleri Adam Wharton'ın Peşinde!",
    body: "Crystal Palace'ın genç orta saha beyni Adam Wharton, kusursuz pas vizyonuyla haftanın en çok konuşulan yeteneklerinden biri oldu.",
  },
  {
    id: 'nfo_gibbswhite_dip',
    club: 'Nottingham Forest',
    player: 'Morgan Gibbs-White',
    delta: -1,
    source: 'Nottingham Post',
    title: "Nottingham Forest'ta Morgan Gibbs-White Yorgunluk Sinyalleri Veriyor!",
    body: "Sezon başından beri neredeyse her maçta 90 dakika sahada kalan Morgan Gibbs-White'ın kondisyon değerlerinde düşüş tespit edildi.",
  },
  {
    id: 'bay_kane_fire',
    club: 'Bayern Munchen',
    player: 'Harry Kane',
    delta: 2,
    source: 'Kicker · Allianz Arena',
    title: 'Harry Kane Säbener Straße İdmanlarında Durdurulamıyor!',
    body: "Bayern Münih'in gol makinesi Harry Kane, ekstra bitiricilik idmanlarıyla Bundesliga savunmalarının korkulu rüyası olmaya devam ediyor.",
  },
  {
    id: 'bay_musiala_magic',
    club: 'Bayern Munchen',
    player: 'Jamal Musiala',
    delta: 2,
    source: 'Bild · Bundesliga Yıldızı',
    title: 'Jamal Musiala Dar Alanda Rakiplerini Çaresiz Bırakıyor!',
    body: 'Alman futbolunun süper yeteneği Jamal Musiala, çalımları ve kilit paslarıyla Bayern hücumunun merkezinde parlıyor.',
  },
  {
    id: 'bvb_guirassy_surge',
    club: 'Borussia Dortmund',
    player: 'Serhou Guirassy',
    delta: 2,
    source: 'Ruhr Nachrichten · Dortmund',
    title: "Signal Iduna Park'ta Serhou Guirassy Fırtınası!",
    body: "Borussia Dortmund'un golcüsü Serhou Guirassy, ceza sahası içindeki fiziksel üstünlüğüyle formunun zirvesine çıktı.",
  },
  {
    id: 'b04_grimaldo_boost',
    club: 'Bayer Leverkusen',
    player: 'Alejandro Grimaldo',
    delta: 2,
    source: 'Kicker · Taktik Raporu',
    title: 'Alejandro Grimaldo Duran Toplarla Maç Çözmeye Devam Ediyor!',
    body: "Bayer Leverkusen'in İspanyol sol kanat beki Grimaldo, frikik golleri ve asistleriyle takımını sırtlıyor.",
  },
  {
    id: 'vfb_undav_stiller',
    club: 'Stuttgart',
    player: 'Deniz Undav',
    delta: 2,
    source: 'Stuttgarter Zeitung',
    title: "Stuttgart'ta Deniz Undav ve Angelo Stiller Uyumu Göz Kamaştırıyor!",
    body: "Stuttgart hücum hattında Deniz Undav'ın bitiriciliği ve orta sahada Stiller'in pas vizyonu rakiplere zor anlar yaşatıyor.",
  },
  {
    id: 'sge_canuzun_star',
    club: 'Eintracht Frankfurt',
    player: 'Can Uzun',
    delta: 2,
    source: 'Frankfurter Allgemeine',
    title: "Frankfurt'ta Genç Yıldız Can Uzun Ayakta Alkışlanıyor!",
    body: "Eintracht Frankfurt formasıyla müthiş bir çıkış yakalayan milli yıldız Can Uzun, uzaktan şutları ve oyun zekasıyla haftanın gündemine oturdu.",
  },
];

export const WORLD_FOOTBALL_NEWS_TEMPLATES: WorldNewsTemplate[] = [
  {
    id: 'world_trabzon_salah',
    club: 'Trabzonspor',
    source: 'Sky Sports · Trendyol Süper Lig',
    title: "Trabzonspor'da Mohamed Salah Fırtınası: Karadeniz'de Futbol Şöleni!",
    body: "Trabzonspor formasıyla Trendyol Süper Lig'i kasıp kavuran Mısırlı süper yıldız Mohamed Salah, attığı goller ve yaptığı asistlerle Papara Park tribünlerini ayağa kaldırdı; bordo-mavili ekibi zirve yarışının en güçlü adayı haline getirdi.",
  },
  {
    id: 'world_ronaldo_1000',
    club: 'Al-Nassr',
    source: 'Sky Sports · Suudi Pro Ligi',
    title: 'Tarihi An: Cristiano Ronaldo 1000. Golüne Ulaştı ve Futbolu Bırakıyor!',
    body: "Suudi Pro Ligi'nde Al-Nassr formasıyla kariyerinin 1000. resmi golünü kaydederek futbol tarihinde kırılması imkânsız bir rekora imza atan Cristiano Ronaldo, maç sonunda yaptığı duygusal açıklamayla sezon sonunda futbolu bırakacağını resmen duyurdu!",
  },
  {
    id: 'world_messi_miami',
    club: 'Inter Miami',
    source: 'The Guardian · MLS (ABD)',
    title: "Miami'de Lionel Messi ve Eski Barcelona Tayfasından Resital!",
    body: "MLS'te Inter Miami forması giyen Lionel Messi, Luis Suarez, Jordi Alba ve Sergio Busquets'in ceza sahası çevresinde tek dokunuşlarla ördüğü muazzam pas trafiği sonrası gelen jeneriklik gol dünya basınında haftanın olayı oldu.",
  },
  {
    id: 'world_osimhen_saudi',
    club: 'Al-Hilal',
    source: 'Sky Sports · Transfer Bombası',
    title: "Victor Osimhen 80 Milyon Euro'ya Suudi Arabistan'a Satıldı!",
    body: "Avrupa ve Türk futbolunda yılın transfer bombası patladı! Nijeryalı süper golcü Victor Osimhen, Suudi Arabistan temsilcisi Al-Hilal'in sunduğu 80 M€ peşin bonservis ve yıllık 45 M€ net maaş teklifinin ardından Suudi Pro Ligi'ne transfer oldu.",
  },
  {
    id: 'world_transfer_hijack',
    club: 'Real Madrid',
    source: 'Marca · Transfer Çalımı',
    title: 'Yılın Transfer Çalımı: Sağlık Kontrolüne Giderken Uçağın Rotası Değişti!',
    body: 'Avrupa transfer piyasasında inanılmaz bir son dakika operasyonu yaşandı! Ezeli rakibiyle her konuda anlaşan ve sağlık kontrolü için havalimanına inen yıldız oyuncunun özel uçağı, gelen son dakika teklifiyle rotasını değiştirip rakip kulübe imza attı.',
  },
  {
    id: 'world_davies_contract',
    club: 'Bayern Munchen',
    source: 'The Guardian · Sözleşme Krizi',
    title: 'Alphonso Davies ve Yönetim Arasında Maaş Krizi Büyüyor!',
    body: "Bayern Münih'te sözleşme yenileme görüşmelerinde astronomik maaş talebinde bulunan Alphonso Davies ile yönetim arasındaki ipler gerildi. Yeni kontrata imza atmaması halinde yıldız oyuncunun kadro dışı bırakılma ihtimali konuşuluyor.",
  },
  {
    id: 'world_loan_revenge',
    club: 'Monaco',
    source: 'Sky Sports · Avrupa Kupaları',
    title: 'Kiralık Yıldızın İntikamı: Bonservisini Elinde Bulunduran Takıma Gol Attı, Sevinmedi!',
    body: 'Sezon başında kadroda düşünülmediği için kiralık gönderilen genç yetenek, kupa eşleşmesinde bonservisini elinde bulunduran kendi kulübüne 89. dakikada attığı golle takımını tur atlattı ve gol sonrası ellerini kaldırarak sevinmedi.',
  },
  {
    id: 'world_superclasico_libertadores',
    club: 'River Plate',
    source: 'Marca · Copa Libertadores',
    title: "Arjantin'de Nefes Kesen Süper Klasiko: 4 Kırmızı Kart, 90+8'de Gelen Galibiyet!",
    body: "Güney Amerika'da River Plate ile Boca Juniors arasında oynanan tarihi Süper Klasiko'da saha karıştı! 4 kırmızı kartın çıktığı ve 90+8. dakikada gelen golle çözülen dev derbideki unutulmaz atmosfer dünya gündemine oturdu.",
  },
  {
    id: 'world_ucl_12players_error',
    club: 'Bayer Leverkusen',
    source: 'Sky Sports · Taktik & Teknoloji',
    title: "Şampiyonlar Ligi'nde İnanılmaz Hata: Oyuncu Değişikliği Kağıdı Yanlış Verildi!",
    body: 'Devler Ligi gecesinde dördüncü hakeme teslim edilen oyuncu değişikliği kağıdındaki numara hatası nedeniyle sahada 20 saniye boyunca 12 kişi kalan ekip, rakibin itirazı üzerine UEFA disiplin talimatı gereği hükmen mağlubiyet tehlikesiyle karşı karşıya kaldı.',
  },
  {
    id: 'world_dortmund_yellow_wall',
    club: 'Borussia Dortmund',
    source: 'The Guardian · Taraftar & Atmosfer',
    title: "Sarı Duvar'dan Görsel Şölen: Dortmund Tribünlerinden Tarihi Koreografi!",
    body: "Signal Iduna Park'ta Devler Ligi gecesinde ünlü 'Sarı Duvar' tribününün hazırladığı dev 3 boyutlu koreografi izleyenleri büyüledi ve sosyal medyada milyonlarca kez paylaşıldı.",
  },
  {
    id: 'world_fifa_offside_wenger',
    club: 'Inter',
    source: 'Marca · FIFA & Kural Devrimi',
    title: "FIFA'dan Yeni Kural Değişikliği Sinyali: Ofsayt Sisteminde Devrim!",
    body: "Arsene Wenger'in önerdiği ve hücum oyuncusunun ofsayt sayılması için 'tüm vücudunun son savunmacının önünde olması' şartını getiren yeni ofsayt sisteminin FIFA tarafından pilot turnuvalarda resmen test edilmeye başlandığı açıklandı.",
  },
  {
    id: 'world_superlig_samsun',
    club: 'Samsunspor',
    source: 'Sky Sports · Süper Lig Özel',
    title: "Anadolu Kulübünden Devlere Gözdağı: Samsunspor'un 10 Maçtır Bileği Bükülmüyor!",
    body: "Trendyol Süper Lig'de müthiş bir çıkış yakalayan Samsunspor, üst üste 10 maçlık yenilmezlik serisiyle devleri geride bırakarak zirve yarışına resmen ortak oldu!",
  },
  {
    id: 'world_superlig_goztepe',
    club: 'Göztepe',
    source: 'The Guardian · Süper Lig Raporu',
    title: "Anadolu Kulübünden Devlere Gözdağı: Göztepe 10 Maçtır Yenilmiyor!",
    body: "İzmir temsilcisi Göztepe, Gürsel Aksel Stadyumu'ndaki müthiş taraftar desteği ve dinamik kadrosuyla 10 maçlık yenilmezlik serisi yakalayarak Süper Lig'de zirve yarışına ortak oldu!",
  },
  {
    id: 'world_superlig_eyup',
    club: 'Eyüpspor',
    source: 'Marca · Avrupa Ligleri',
    title: "Süper Lig'de Sürpriz Çıkış: Eyüpspor 10 Maçtır Bileği Bükülmüyor!",
    body: 'Oynadığı pas odaklı modern futbolla dikkat çeken Eyüpspor, güçlü rakiplerine karşı yakaladığı 10 maçlık yenilmezlik serisiyle ligin üst sıralarına demir attı.',
  },
  {
    id: 'world_enrique_press',
    club: 'PSG',
    source: 'Marca · Fransa Ligue 1',
    title: 'PSG Hocası Luis Enrique Basın Toplantısında Gazetecilerle Kavga Etti!',
    body: "Paris Saint-Germain'in maç sonu basın toplantısında taktik tercihlerini sorgulayan Fransız muhabirle sert bir tartışmaya giren teknik direktör Luis Enrique, 'Futboldan anlamıyorsunuz!' diyerek mikrofonu bırakıp salonu terk etti.",
  },
  {
    id: 'world_real_mbappe_vini',
    club: 'Real Madrid',
    source: 'Marca · İspanya La Liga',
    title: "Real Madrid'de Mbappé ve Vinicius Jr. Arasında Penaltı Kulisleri!",
    body: "Santiago Bernabéu'da son maçta kazanılan penaltı atışı sonrası Kylian Mbappé ve Vinicius Junior arasındaki görev paylaşımı İspanyol basınının bir numaralı gündem maddesi oldu.",
  },
  {
    id: 'world_barca_yamal',
    club: 'Barcelona',
    source: 'The Guardian · La Liga',
    title: "Barcelona'dan Lamine Yamal'a 1 Milyar Euro'luk Yeni Sözleşme Zırhı!",
    body: 'Katalan devi Barcelona, Körfez ve İngiliz kulüplerinin radarına giren genç süper yıldızı Lamine Yamal ile yeni kontrat imzalayarak serbest kalma bedelini 1 Milyar € olarak sabitledi.',
  },
  {
    id: 'world_bayern_kane',
    club: 'Bayern Munchen',
    source: 'Sky Sports · Bundesliga',
    title: "Bayern Münih'te Harry Kane Gol Rekorlarını Altüst Ediyor!",
    body: "Bundesliga'da hafta sonunu hat-trick ile kapatan İngiliz yıldız Harry Kane, Almanya'da maç başına gol ortalamasıyla tarihin en verimli sezonlarından birini yaşıyor.",
  },
  {
    id: 'world_superlig_derby',
    club: 'Fenerbahce',
    source: 'Sky Sports · Trendyol Süper Lig',
    title: "Süper Lig'de Dev Derbi Öncesi Yabancı VAR ve Hakem Fırtınası!",
    body: 'Türkiye’de şampiyonluk düğümünü çözecek Fenerbahçe - Galatasaray derbisi öncesinde iki kulüp yönetimleri karşılıklı açıklamalar yayınladı; derbi heyecanı tüm ülkeyi sardı.',
  },
  {
    id: 'world_seriea_inter_milan',
    club: 'Inter',
    source: 'The Guardian · Serie A',
    title: 'Milano Derbisinde Nefes Kesen Mücadele ve Taktik Savaşı!',
    body: "Serie A'nın zirvesini yakından ilgilendiren Della Madonnina derbisinde Inter ve Milan arasındaki sert mücadele İtalyan spor manşetlerini süsledi.",
  },
  {
    id: 'world_bjk_ts',
    club: 'Besiktas',
    source: 'Sky Sports · Süper Lig Gündemi',
    title: "Dolmabahçe'de Beşiktaş ve Trabzonspor Arasında Kritik Randevu!",
    body: "Trendyol Süper Lig'de haftanın dev maçında Beşiktaş ile Trabzonspor karşı karşıya gelirken tribünlerdeki koreografi ve coşku Avrupa basınında da geniş yer buldu.",
  },
  {
    id: 'world_juve_kenan',
    club: 'Juventus',
    source: 'The Guardian · İtalya Serie A',
    title: "Torino'da 10 Numaralı Kenan Yıldız Rüzgarı!",
    body: "Juventus'un genç yıldızı Kenan Yıldız, Şampiyonlar Ligi ve Serie A'da attığı klas gollerle İtalyan taraftarların sevgilisi haline geldi.",
  },
  {
    id: 'world_real_arda',
    club: 'Real Madrid',
    source: 'Marca · İspanya Gündemi',
    title: "Santiago Bernabéu'da Arda Güler Ayakta Alkışlandı!",
    body: "Real Madrid orta sahasında ilk 11'de sahaya çıkan Arda Güler, yaptığı asist ve uzaktan golüyle maçın oyuncusu seçildi.",
  },
];

const UCL_SAMPLE_PAIRS: [string, string][] = [
  ['Real Madrid', 'Bayern Munchen'],
  ['Barcelona', 'PSG'],
  ['Inter', 'Atletico Madrid'],
  ['Napoli', 'Juventus'],
  ['Borussia Dortmund', 'Milan'],
  ['Villarreal', 'Atalanta'],
  ['Fenerbahce', 'Benfica'],
  ['Sporting', 'Ajax'],
  ['Real Madrid', 'Inter'],
  ['Bayern Munchen', 'Barcelona'],
];

export function buildClubTeamObject(clubName: string): Team {
  const clubPlayers = [...PLAYERS_POOL.filter((p) => p.c === clubName)].sort((a, b) => b.r - a.r);
  const usedIds = new Set<number>();
  const picks: Player[] = [];

  const quotaOrder: [Position, number][] = [
    ['GK', 1],
    ['DEF', 4],
    ['MID', 3],
    ['FWD', 3],
  ];
  for (const [posKey, cnt] of quotaOrder) {
    const matching = clubPlayers.filter((p) => p.pos === posKey && !usedIds.has(p.id)).slice(0, cnt);
    matching.forEach((p) => {
      usedIds.add(p.id);
      picks.push({ ...p });
    });
  }

  for (const p of clubPlayers) {
    if (picks.length >= 14) break;
    if (!usedIds.has(p.id)) {
      usedIds.add(p.id);
      picks.push({ ...p });
    }
  }
  while (picks.length < 14 && clubPlayers.length) {
    picks.push({ ...clubPlayers[picks.length % clubPlayers.length] });
  }

  const tm: Team = {
    name: clubName,
    me: 0,
    isHuman: false,
    identityDone: true,
    customIdentity: {
      type: 'club',
      club: clubName,
      shape: 'shield',
      c1: '#166534',
      c2: '#eab308',
    },
    picks,
    starters: null,
    bench: null,
    formation: '4-3-3',
    spent: 0,
  };
  ensureTeamLineup(tm, null, false);
  return tm;
}

/**
 * Generates a full 38-week double round-robin schedule for `numTeams` (default 20 teams):
 * - Rounds 1..19: every pair plays once.
 * - Rounds 20..38: reversed home/away venues, shuffled round order within the 2nd half.
 */
export function generateDoubleRoundRobinSchedule(numTeams = 20): LeagueFixture[][] {
  const teams = Array.from({ length: numTeams }, (_, i) => i);
  for (let i = teams.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [teams[i], teams[j]] = [teams[j], teams[i]];
  }

  const firstHalf: LeagueFixture[][] = [];
  const n = numTeams;
  for (let r = 0; r < n - 1; r++) {
    const matches: LeagueFixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = teams[i];
      const y = teams[n - 1 - i];
      if (Math.random() < 0.5) matches.push({ a: x, b: y, done: false, sc: null });
      else matches.push({ a: y, b: x, done: false, sc: null });
    }
    firstHalf.push(matches);
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }

  for (let i = firstHalf.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [firstHalf[i], firstHalf[j]] = [firstHalf[j], firstHalf[i]];
  }

  const secondHalf: LeagueFixture[][] = firstHalf.map((round) =>
    round.map((m) => ({
      a: m.b,
      b: m.a,
      done: false,
      sc: null,
    }))
  );

  for (let i = secondHalf.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [secondHalf[i], secondHalf[j]] = [secondHalf[j], secondHalf[i]];
  }

  return [...firstHalf, ...secondHalf];
}

export function calcClubStrength(clubName: string): number {
  const clubPlayers = PLAYERS_POOL.filter((p) => p.c === clubName);
  if (!clubPlayers.length) return 0;
  return clubPlayers.reduce((sum, p) => sum + p.r, 0) / clubPlayers.length;
}

/**
 * Selects Career League AI rival clubs so that:
 * - Premier Lig: `humanCount + AI clubs = 20` (38 weeks)
 * - Bundesliga: `humanCount + AI clubs = 18` (34 weeks)
 * Drops the lowest-rated clubs in that league first (e.g. Hull City / Ipswich Town in PL, Paderborn / Elversberg in Bundesliga).
 */
export function selectCareerAiClubs(
  leagueName: string,
  humanCount: number,
  excludeTeamNames: string[] = []
): string[] {
  const excluded = new Set(excludeTeamNames.map((n) => n.trim().toLowerCase()));
  const leagueClubs = ALL_CLUBS.filter(
    (c) => CLUB_TO_LEAGUE[c] === leagueName && !excluded.has(c.toLowerCase())
  );
  const totalTeamsTarget = leagueName === 'Bundesliga' ? 18 : 20;
  const targetAiCount = Math.max(0, totalTeamsTarget - humanCount);
  if (leagueClubs.length <= targetAiCount) return leagueClubs;
  const sortedAsc = [...leagueClubs].sort((a, b) => calcClubStrength(a) - calcClubStrength(b));
  const dropCount = leagueClubs.length - targetAiCount;
  return sortedAsc.slice(dropCount);
}

export function selectPremierLeagueAiClubs(
  humanCount: number,
  excludeTeamNames: string[] = []
): string[] {
  return selectCareerAiClubs('Premier Lig', humanCount, excludeTeamNames);
}

export function selectPremierLeagueRivalClubs(excludeTeamName: string): string[] {
  return selectPremierLeagueAiClubs(1, excludeTeamName ? [excludeTeamName] : []);
}

export function initCareerLeague(
  existingTeams: Team[],
  budgetTotal: number | null,
  leagueName = 'Premier Lig'
): { teams: Team[]; league: LeagueState } {
  const rawHumans = existingTeams.filter((t) => t.isHuman);
  const humanTeams: Team[] = (rawHumans.length > 0 ? rawHumans : [existingTeams[0]]).map(
    (t) => {
      const copy: Team = { ...t, isHuman: true };
      ensureTeamLineup(copy, null, false);
      return copy;
    }
  );

  const aiClubs = selectCareerAiClubs(
    leagueName,
    humanTeams.length,
    humanTeams.map((t) => t.name)
  );
  const aiTeams = aiClubs.map(buildClubTeamObject);
  const allTeams = [...humanTeams, ...aiTeams];

  const standings: StandingsRow[] = allTeams.map((_tm, idx) => ({
    teamIdx: idx,
    played: 0,
    w: 0,
    d: 0,
    l: 0,
    gf: 0,
    ga: 0,
    pts: 0,
  }));

  const maxWeeks = (allTeams.length - 1) * 2; // 38 weeks for 20 teams (PL), 34 weeks for 18 teams (Bundesliga)
  const humanNamesLabel = humanTeams.map((t) => t.name).join(' ve ');

  const teamCareer: Record<number, TeamCareerState> = {};
  humanTeams.forEach((tm, idx) => {
    teamCareer[idx] = {
      clubFunds: Math.max(15, (budgetTotal || 360) - tm.spent),
      sponsorName: 'Yok',
      moraleMod: 0,
      lastResult: null,
      usedEventIds: [],
      activeEvent: null,
      eventHistory: [],
    };
  });

  const league: LeagueState = {
    leagueName,
    week: 1,
    maxWeeks,
    viewWeek: 1,
    schedule: generateDoubleRoundRobinSchedule(allTeams.length),
    standings,
    playerStats: {},
    injuries: {},
    suspensions: {},
    moraleMod: 0,
    clubFunds: Math.max(15, (budgetTotal || 360) - humanTeams[0].spent),
    sponsorName: 'Yok',
    lastResult: null,
    usedEventIds: new Set<string>(),
    usedNewsIds: new Set<string>(),
    activeEvent: null,
    activeNews: null,
    pendingNewsAfterEvent: null,
    eventHistory: [],
    teamCareer,
    newsFeed: [
      {
        week: 1,
        source: `${leagueName} Medya Merkezi`,
        teamIdx: 0,
        title: `2026-27 ${leagueName} ${maxWeeks} Haftalık Tam Sezon Başlıyor!`,
        body: `${allTeams.length} takımlı ${maxWeeks} haftalık çift devreli maratonda ${humanNamesLabel} yeni kurulan kadrosuyla şampiyonluk yarışına katılıyor. İç saha ve deplasman rövanşlarıyla dolu uzun sezonda kart cezaları ve form grafiği belirleyici olacak.`,
      },
    ],
    tab: 'standings',
  };

  return { teams: allTeams, league };
}

export function getSortedStandings(lg: LeagueState | null): StandingsRow[] {
  if (!lg) return [];
  return [...lg.standings].sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga;
    const gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });
}

export function updateLeagueTableForMatch(
  lg: LeagueState,
  aIdx: number,
  bIdx: number,
  goalsA: number,
  goalsB: number
): void {
  const stA = lg.standings.find((x) => x.teamIdx === aIdx);
  const stB = lg.standings.find((x) => x.teamIdx === bIdx);
  if (!stA || !stB) return;

  stA.played++;
  stB.played++;
  stA.gf += goalsA;
  stA.ga += goalsB;
  stB.gf += goalsB;
  stB.ga += goalsA;

  if (goalsA > goalsB) {
    stA.w++;
    stA.pts += 3;
    stB.l++;
  } else if (goalsB > goalsA) {
    stB.w++;
    stB.pts += 3;
    stA.l++;
  } else {
    stA.d++;
    stB.d++;
    stA.pts += 1;
    stB.pts += 1;
  }
}

export function recordLeagueGoalsAndAssists(
  lg: LeagueState,
  teams: Team[],
  teamIdx: number,
  sObj: SideEvaluation,
  goalsCount: number
): void {
  const tm = teams[teamIdx];
  if (!tm) return;
  for (let g = 0; g < goalsCount; g++) {
    const scorer = pickGoalscorer(sObj.L);
    const assister = Math.random() < 0.78 ? pickAssister(sObj.L, scorer) : null;
    if (scorer) {
      const k = `${teamIdx}_${scorer.n}`;
      if (!lg.playerStats[k]) {
        lg.playerStats[k] = {
          name: scorer.n,
          teamIdx,
          teamName: tm.name,
          club: scorer.c,
          goals: 0,
          assists: 0,
        };
      }
      lg.playerStats[k].goals++;
    }
    if (assister) {
      const kA = `${teamIdx}_${assister.n}`;
      if (!lg.playerStats[kA]) {
        lg.playerStats[kA] = {
          name: assister.n,
          teamIdx,
          teamName: tm.name,
          club: assister.c,
          goals: 0,
          assists: 0,
        };
      }
      lg.playerStats[kA].assists++;
    }
  }
}

/**
 * Decrements active injury & suspension durations by 1 week at the end of a completed matchweek.
 * Must run BEFORE new red cards from the just-completed matchweek are recorded!
 */
export function advanceCareerStatusOneWeek(lg: LeagueState): void {
  lg.suspensions = lg.suspensions || {};
  for (const pidStr of Object.keys(lg.injuries)) {
    const pid = Number(pidStr);
    lg.injuries[pid]--;
    if (lg.injuries[pid] <= 0) {
      delete lg.injuries[pid];
      delete lg.suspensions[pid];
    }
  }
}

/**
 * Suspends a player for `banMatches` next match(es) due to a red card
 * and immediately replaces them in their team's starting XI with an eligible bench player.
 */
export function suspendPlayerForRedCard(
  lg: LeagueState,
  teams: Team[],
  teamIdx: number,
  player: Player,
  banMatches = 1
): void {
  lg.suspensions = lg.suspensions || {};
  lg.injuries = lg.injuries || {};
  lg.suspensions[player.id] = Math.max(lg.suspensions[player.id] || 0, banMatches);
  lg.injuries[player.id] = Math.max(lg.injuries[player.id] || 0, banMatches);
  if (teams[teamIdx]) {
    ensureTeamLineup(teams[teamIdx], lg, true);
    enforceHealthyStartersForTeam(teams[teamIdx], lg, true);
  }
}

export function simulateBackgroundLeagueMatch(
  lg: LeagueState,
  teams: Team[],
  mObj: LeagueFixture,
  completedWeek: number,
  redCardRollFn: () => number = Math.random
): void {
  if (mObj.done) return;
  const tA = teams[mObj.a];
  const tB = teams[mObj.b];
  // Enforce healthy & unsuspended starters for both AI teams BEFORE simulating the match
  ensureTeamLineup(tA, lg, true);
  ensureTeamLineup(tB, lg, true);
  enforceHealthyStartersForTeam(tA, lg, true);
  enforceHealthyStartersForTeam(tB, lg, true);

  const sA = side(tA, lg, true);
  const sB = side(tB, lg, true);

  const {
    goals: [gA, gB],
  } = rollMatchScoreline(sA, sB);

  mObj.done = true;
  mObj.sc = [gA, gB];
  mObj.redCards = [];

  // Roll red cards for AI background matches (~9% per side) so disciplinary bans & news stay real
  ([
    [mObj.a, tA, sA],
    [mObj.b, tB, sB],
  ] as [number, Team, SideEvaluation][]).forEach(([idx, tm, sObj]) => {
    if (redCardRollFn() < 0.085) {
      const candidates = [...sObj.L.DEF, ...sObj.L.MID];
      const offender = candidates.length
        ? candidates[(Math.random() * candidates.length) | 0]
        : (tm.starters && tm.starters[1]) || null;
      if (offender) {
        mObj.redCards!.push({ teamIdx: idx, playerId: offender.id, playerName: offender.n });
        // Note: will be applied into lg.suspensions AFTER previous week's bans are decremented
        if (completedWeek > 0) {
          // Recorded on mObj.redCards for caller to apply after week rollover
        }
      }
    }
  });

  updateLeagueTableForMatch(lg, mObj.a, mObj.b, gA, gB);
  recordLeagueGoalsAndAssists(lg, teams, mObj.a, sA, gA);
  recordLeagueGoalsAndAssists(lg, teams, mObj.b, sB, gB);
}

export function modifyRivalPlayerRating(
  teamObj: Team | undefined,
  playerName: string,
  delta: number
): { name: string; oldR: number; newR: number; badge: string; isPositive: boolean } | null {
  if (!teamObj) return null;
  let target =
    (teamObj.starters || []).find((p) => p.n === playerName) ||
    (teamObj.picks || []).find((p) => p.n === playerName);
  if (!target && teamObj.starters && teamObj.starters.length) {
    target = [...teamObj.starters].sort((a, b) => b.r - a.r)[0];
  }
  if (!target) return null;
  const oldR = target.r;
  target.r = Math.max(68, Math.min(97, target.r + delta));
  return {
    name: target.n,
    oldR,
    newR: target.r,
    badge: `${target.n}: ${delta > 0 ? 'Form Yükselişte' : 'Form Düşüşte'}`,
    isPositive: delta > 0,
  };
}

export function generateChampionsLeagueHeadline(completedWeek: number): CareerNewsItem {
  const pair = UCL_SAMPLE_PAIRS[(completedWeek + ((Math.random() * UCL_SAMPLE_PAIRS.length) | 0)) % UCL_SAMPLE_PAIRS.length];
  const [clubA, clubB] = pair;
  const scores: [number, number][] = [
    [3, 1],
    [2, 1],
    [2, 2],
    [3, 2],
    [2, 0],
    [1, 0],
    [4, 2],
  ];
  const [gA, gB] = scores[(Math.random() * scores.length) | 0];

  const playersA = (DATA[clubA] || []).slice(-5);
  const playersB = (DATA[clubB] || []).slice(-5);
  const starA = playersA.length ? playersA[(Math.random() * playersA.length) | 0][0] : 'Yıldız Oyuncu';
  const starB = playersB.length ? playersB[(Math.random() * playersB.length) | 0][0] : 'Yıldız Oyuncu';

  if (gA === gB) {
    return {
      week: completedWeek,
      source: 'Sky Sports · Şampiyonlar Ligi Gecesi',
      clubLogoName: clubA,
      teamIdx: null,
      title: `Devler Ligi'nde Nefes Kesen Maç: ${clubA} ${gA} - ${gB} ${clubB}!`,
      body: `UEFA Şampiyonlar Ligi haftanın maçında ${clubA} ile ${clubB} yenişemedi (${gA}-${gB}). Ev sahibi ekipte ${starA}, konuk takımda ise ${starB} sergiledikleri performansla gecenin yıldızları oldu.`,
      effectBadge: `UCL · ${clubA} ${gA}-${gB} ${clubB}`,
      effectPositive: null,
    };
  }

  return {
    week: completedWeek,
    source: 'Sky Sports · Şampiyonlar Ligi Gecesi',
    clubLogoName: clubA,
    teamIdx: null,
    title: `Şampiyonlar Ligi'nde Dev Zafer: ${clubA} ${gA} - ${gB} ${clubB}!`,
    body: `UEFA Şampiyonlar Ligi gecesinin en kritik randevusunda ${clubA}, sahasında ağırladığı ${clubB} karşısında ${starA}'in yıldızlaştığı maçı ${gA}-${gB} kazanarak büyük avantaj yakaladı.`,
    effectBadge: `UCL · ${clubA} ${gA}-${gB} ${clubB}`,
    effectPositive: true,
  };
}

export function generateDynamicMatchHeadline(
  teams: Team[],
  roundMatches: LeagueFixture[],
  completedWeek: number,
  leagueName = 'Premier Lig'
): CareerNewsItem | null {
  if (!roundMatches || !roundMatches.length) return null;
  const aiMatches = roundMatches.filter(
    (m) => m.done && m.sc && !teams[m.a]?.isHuman && !teams[m.b]?.isHuman
  );
  if (!aiMatches.length) return null;

  const sorted = [...aiMatches].sort((x, y) => {
    const diffX = Math.abs(x.sc![0] - x.sc![1]);
    const diffY = Math.abs(y.sc![0] - y.sc![1]);
    const totX = x.sc![0] + x.sc![1];
    const totY = y.sc![0] + y.sc![1];
    return diffY * 2 + totY - (diffX * 2 + totX);
  });

  const pick = sorted[0];
  const tA = teams[pick.a];
  const tB = teams[pick.b];
  if (!tA || !tB || !pick.sc) return null;

  const [gA, gB] = pick.sc;
  if (gA === gB) {
    return {
      week: completedWeek,
      source: `Sky Sports · ${leagueName} Özeti`,
      clubLogoName: tA.name,
      teamIdx: pick.a,
      title: `${tA.name} ile ${tB.name} Yenişemedi: ${gA}-${gB}!`,
      body: `${completedWeek}. haftanın dikkat çeken mücadelesinde ${tA.name} ve ${tB.name} sahadan ${gA}-${gB}'lik beraberlikle ayrılarak puanları paylaştı.`,
    };
  }

  const winIdx = gA > gB ? pick.a : pick.b;
  const loseIdx = gA > gB ? pick.b : pick.a;
  const winTeam = teams[winIdx];
  const loseTeam = teams[loseIdx];
  const winGoals = Math.max(gA, gB);
  const loseGoals = Math.min(gA, gB);

  return {
    week: completedWeek,
    source: 'Sky Sports · Haftanın Raporu',
    clubLogoName: winTeam.name,
    teamIdx: winIdx,
    title: `${winTeam.name}, ${loseTeam.name} Karşısında ${winGoals}-${loseGoals} Galip!`,
    body: `${leagueName} ${completedWeek}. haftasında ${winTeam.name}, etkili bir oyun sergileyerek ${loseTeam.name} engelini ${winGoals}-${loseGoals} ile geçti ve hanesine kritik 3 puan yazdırdı.`,
  };
}

export function createRedCardDisciplineNews(
  teams: Team[],
  teamIdx: number,
  playerName: string,
  completedWeek: number
): CareerNewsItem | null {
  const tm = teams[teamIdx];
  if (!tm) return null;
  return {
    week: completedWeek,
    source: 'Sky Sports · PFDK Disiplin Raporu',
    clubLogoName: tm.isHuman ? undefined : tm.name,
    teamIdx,
    title: `${tm.name} Yıldızı ${playerName} Kırmızı Kartla Cezalı Duruma Düştü!`,
    body: `${completedWeek}. haftadaki sert mücadelede doğrudan kırmızı kart gören ${playerName}, ${completedWeek + 1}. haftada ${tm.name} kadrosunda yer alamayacak (1 maç men).`,
    effectBadge: `${playerName}: 1 Maç Cezalı`,
    effectPositive: false,
  };
}

export function triggerWeeklyTeamNews(
  lg: LeagueState,
  teams: Team[],
  roundMatches: LeagueFixture[],
  completedWeek: number
): void {
  const matchNews = generateDynamicMatchHeadline(
    teams,
    roundMatches,
    completedWeek,
    lg.leagueName || 'Premier Lig'
  );
  if (matchNews) {
    lg.newsFeed.unshift(matchNews);
  }

  // Publish disciplinary news for any AI or user red card this week (max 1 extra headline per week)
  const redCardEntries = roundMatches.flatMap((m) => m.redCards || []);
  if (redCardEntries.length > 0) {
    const rc = redCardEntries[0];
    const rcNews = createRedCardDisciplineNews(teams, rc.teamIdx, rc.playerName, completedWeek);
    if (rcNews) lg.newsFeed.unshift(rcNews);
  }

  let uclNewsItem: CareerNewsItem | null = null;
  if (completedWeek % 2 === 0) {
    uclNewsItem = generateChampionsLeagueHeadline(completedWeek);
    if (uclNewsItem) {
      lg.newsFeed.unshift(uclNewsItem);
    }
  }

  const activeRivalNames = new Set(teams.filter((tm) => !tm.isHuman).map((tm) => tm.name));
  let availStar = PREMIER_STAR_NEWS_TEMPLATES.filter(
    (t) => activeRivalNames.has(t.club) && !lg.usedNewsIds.has(t.id)
  );
  if (!availStar.length) {
    PREMIER_STAR_NEWS_TEMPLATES.forEach((t) => lg.usedNewsIds.delete(t.id));
    availStar = PREMIER_STAR_NEWS_TEMPLATES.filter((t) => activeRivalNames.has(t.club));
  }

  let availWorld = WORLD_FOOTBALL_NEWS_TEMPLATES.filter((t) => !lg.usedNewsIds.has(t.id));
  if (!availWorld.length) {
    WORLD_FOOTBALL_NEWS_TEMPLATES.forEach((t) => lg.usedNewsIds.delete(t.id));
    availWorld = [...WORLD_FOOTBALL_NEWS_TEMPLATES];
  }

  const pickWorldFirst = completedWeek % 2 === 1;
  let primaryItem: CareerNewsItem | null = null;

  if (availStar.length) {
    const sTpl = availStar[(Math.random() * availStar.length) | 0];
    lg.usedNewsIds.add(sTpl.id);
    const targetTeamIdx = teams.findIndex((tm) => !tm.isHuman && tm.name === sTpl.club);
    const targetTeam = targetTeamIdx >= 0 ? teams[targetTeamIdx] : undefined;
    const modInfo = modifyRivalPlayerRating(targetTeam, sTpl.player, sTpl.delta);
    const stRow =
      targetTeamIdx >= 0
        ? getSortedStandings(lg).findIndex((s) => s.teamIdx === targetTeamIdx) + 1
        : null;
    const rankStr = stRow ? ` (${sTpl.club} şu an ligde ${stRow}. sırada)` : '';

    const starNewsObj: CareerNewsItem = {
      week: completedWeek,
      source: sTpl.source,
      clubLogoName: sTpl.club,
      teamIdx: targetTeamIdx >= 0 ? targetTeamIdx : null,
      title: sTpl.title,
      body: `${sTpl.body}${rankStr}`,
      effectBadge: modInfo ? modInfo.badge : null,
      effectPositive: modInfo ? modInfo.isPositive : true,
    };
    lg.newsFeed.unshift(starNewsObj);
    if (!pickWorldFirst) primaryItem = starNewsObj;
  }

  if (availWorld.length) {
    const wTpl = availWorld[(Math.random() * availWorld.length) | 0];
    lg.usedNewsIds.add(wTpl.id);
    const worldNewsObj: CareerNewsItem = {
      week: completedWeek,
      source: wTpl.source,
      clubLogoName: wTpl.club,
      teamIdx: null,
      title: wTpl.title,
      body: wTpl.body,
      effectBadge: 'Dünya Futbolu · Özel Gündem',
      effectPositive: null,
    };
    lg.newsFeed.unshift(worldNewsObj);
    if (pickWorldFirst || !primaryItem) primaryItem = worldNewsObj;
  }

  if (uclNewsItem && completedWeek % 4 === 0) {
    primaryItem = uclNewsItem;
  }

  if (primaryItem) {
    if (!lg.activeEvent && Math.random() < 0.85) {
      lg.activeNews = primaryItem;
    } else if (lg.activeEvent && Math.random() < 0.6) {
      lg.pendingNewsAfterEvent = primaryItem;
    }
  }

  if (lg.newsFeed.length > 50) {
    lg.newsFeed = lg.newsFeed.slice(0, 50);
  }
}

export function ensureTeamCareerState(lg: LeagueState, teamIdx: number): TeamCareerState {
  if (!lg.teamCareer) {
    lg.teamCareer = {};
  }
  if (!lg.teamCareer[teamIdx]) {
    lg.teamCareer[teamIdx] = {
      clubFunds: teamIdx === 0 ? lg.clubFunds : 20,
      sponsorName: teamIdx === 0 ? lg.sponsorName : 'Yok',
      moraleMod: teamIdx === 0 ? lg.moraleMod : 0,
      lastResult: teamIdx === 0 ? lg.lastResult : null,
      usedEventIds: teamIdx === 0 ? [...lg.usedEventIds] : [],
      activeEvent: teamIdx === 0 ? lg.activeEvent : null,
      eventHistory: teamIdx === 0 ? [...lg.eventHistory] : [],
    };
  }
  return lg.teamCareer[teamIdx];
}

export function syncTopLevelCareerMirrorForTeam0(lg: LeagueState): void {
  const tc0 = lg.teamCareer?.[0];
  if (!tc0) return;
  lg.clubFunds = tc0.clubFunds;
  lg.sponsorName = tc0.sponsorName;
  lg.moraleMod = tc0.moraleMod;
  lg.lastResult = tc0.lastResult;
  lg.activeEvent = tc0.activeEvent;
  lg.eventHistory = [...tc0.eventHistory];
  lg.usedEventIds = new Set(tc0.usedEventIds);
}

export function applyCareerEventChoice(
  lg: LeagueState,
  userTeam: Team,
  teamIdx: number,
  eventId: string,
  choiceIdx: number,
  targetPlayerId?: number,
  benchPlayerId?: number
): string {
  const tc = ensureTeamCareerState(lg, teamIdx);
  ensureTeamLineup(userTeam, lg, true);
  const healthyStarters = (userTeam.starters || []).filter((p) => !lg.injuries[p.id]);
  const fallbackPlayer = {
    id: 0,
    n: 'Takım Kaptanı',
    pos: 'MID' as const,
    r: 85,
    c: userTeam.name || 'Kulüp',
  };
  const starPlayer =
    (targetPlayerId != null
      ? userTeam.picks.find((p) => p.id === targetPlayerId)
      : undefined) ||
    [...healthyStarters].sort((a, b) => b.r - a.r)[0] ||
    (userTeam.starters && userTeam.starters[0]) ||
    userTeam.picks[0] ||
    fallbackPlayer;
  const randomStarter =
    (targetPlayerId != null
      ? userTeam.picks.find((p) => p.id === targetPlayerId)
      : undefined) ||
    healthyStarters[0] ||
    starPlayer;
  const benchSub =
    (benchPlayerId != null
      ? userTeam.picks.find((p) => p.id === benchPlayerId)
      : undefined) ||
    (userTeam.bench || []).find((b) => b.pos === randomStarter.pos && !lg.injuries[b.id]) ||
    (userTeam.bench && userTeam.bench[0]);

  let outcome = '';

  if (eventId === 'sponsor') {
    if (choiceIdx === 0) {
      tc.clubFunds += 32;
      tc.sponsorName = 'Qatar Airways';
      tc.moraleMod = Math.max(-15, tc.moraleMod - 2);
      outcome =
        'Qatar Airways ana sponsor oldu! Kasaya +32 M€ girdi, ticari çekimler nedeniyle kondisyonda -%2 yorgunluk oluştu.';
    } else if (choiceIdx === 1) {
      tc.clubFunds += 24;
      tc.sponsorName = 'Etihad Airways';
      tc.moraleMod += 2;
      outcome =
        'Etihad Airways ile anlaşma imzalandı! Kasaya +24 M€ eklendi ve yenilenen antrenman tesisleriyle performans +%2 arttı.';
    } else {
      tc.clubFunds += 18;
      tc.sponsorName = 'Fly Emirates';
      tc.moraleMod += 4;
      outcome =
        'Fly Emirates sponsorluğu açıklandı (+18 M€)! Kulüp prestiji ve oyuncu morali +%4 yükseldi.';
    }
  } else if (eventId === 'bad_pitch') {
    if (choiceIdx === 0) {
      tc.clubFunds = Math.max(0, tc.clubFunds - 12);
      tc.moraleMod += 3;
      outcome =
        '12 M€ harcanarak stadyuma birinci sınıf hibrit çim serildi! Takımın pas temposu +%3 yükseldi.';
    } else {
      tc.moraleMod = Math.max(-15, tc.moraleMod - 2);
      outcome = 'Bozuk zeminde teknik oyundan vazgeçildi; takım performansı -%2 etkilendi.';
    }
  } else if (eventId === 'media_backlash') {
    if (choiceIdx === 0) {
      tc.moraleMod += 4;
      outcome = 'Takım dış eleştirilere kulaklarını tıkayıp kenetlendi (+%4 performans).';
    } else if (choiceIdx === 1) {
      tc.moraleMod += 3;
      outcome = 'Oyuncuları koruyan tavrın soyunma odasında güven yarattı (+%3 performans).';
    } else {
      tc.clubFunds += 6;
      tc.moraleMod = Math.max(-15, tc.moraleMod - 4);
      outcome =
        'Oyunculara 6 M€ para cezası kesildi ancak soyunma odasında huzursuzluk oluştu (-%4 performans).';
    }
  } else if (eventId === 'injury') {
    if (choiceIdx === 0) {
      tc.clubFunds = Math.max(0, tc.clubFunds - 8);
      lg.injuries[randomStarter.id] = 1;
      if (benchSub && userTeam.starters && userTeam.bench) {
        const sIdx = userTeam.starters.findIndex((x) => x.id === randomStarter.id);
        const bIdx = userTeam.bench.findIndex((x) => x.id === benchSub.id);
        if (sIdx >= 0 && bIdx >= 0) {
          userTeam.starters[sIdx] = benchSub;
          userTeam.bench[bIdx] = randomStarter;
        }
      }
      outcome = `${randomStarter.n} özel kliniğe gönderildi (1 hafta dinlenecek, yerine ${benchSub ? benchSub.n : 'yedek oyuncu'} İlk 11'e alındı).`;
    } else {
      lg.injuries[randomStarter.id] = 3;
      if (benchSub && userTeam.starters && userTeam.bench) {
        const sIdx = userTeam.starters.findIndex((x) => x.id === randomStarter.id);
        const bIdx = userTeam.bench.findIndex((x) => x.id === benchSub.id);
        if (sIdx >= 0 && bIdx >= 0) {
          userTeam.starters[sIdx] = benchSub;
          userTeam.bench[bIdx] = randomStarter;
        }
      }
      outcome = `${randomStarter.n} 3 hafta kadro dışı kaldı; ${benchSub ? benchSub.n : 'yedek oyuncu'} İlk 11'e geçti.`;
    }
  } else if (eventId === 'takeover') {
    if (choiceIdx === 0) {
      tc.clubFunds += 35;
      tc.moraleMod += 3;
      outcome =
        'Yatırım fonu ortaklığı onaylandı! Kulüp kasasına +35 M€ eklendi ve primlerle takım morali +%3 arttı.';
    } else {
      tc.moraleMod += 5;
      outcome =
        'Taraftarlar bağımsızlık kararını coşkuyla karşıladı! Saha içi performans +%5 yükseldi.';
    }
  } else if (eventId === 'transfer_bid') {
    if (choiceIdx === 0) {
      tc.clubFunds = Math.max(0, tc.clubFunds - 10);
      starPlayer.r = Math.min(99, starPlayer.r + 1);
      outcome = `${starPlayer.n} takımda kaldı! Yeni sözleşme sonrası oyuncunun genel performansı yükselişe geçti.`;
    } else {
      tc.moraleMod += 2;
      outcome = `${starPlayer.n} sezon sonuna kadar şampiyonluk yarışına odaklanmaya ikna edildi (+%2 uyum).`;
    }
  } else if (eventId === 'var_referee') {
    if (choiceIdx === 0) {
      tc.moraleMod += 4;
      outcome = 'Resmi bildiri sonrası tribünler kenetlendi (+%4 saha içi baskı avantajı).';
    } else {
      tc.moraleMod += 2;
      outcome = 'Oyuncular kart görmemek ve oyuna odaklanmak konusunda uyarıldı (+%2 disiplin).';
    }
  } else if (eventId === 'dressing_room_crisis') {
    if (choiceIdx === 0) {
      tc.clubFunds += 5;
      tc.moraleMod += 3;
      outcome = 'Tavizsiz disiplinin takımda saygı uyandırdı (+5 M€ ceza geliri, +%3 takım disiplini).';
    } else {
      tc.moraleMod = Math.max(-15, tc.moraleMod - 3);
      outcome = 'Yıldıza ayrıcalık tanıman diğer oyuncuların tepkisini çekti (-%3 takım uyumu).';
    }
  } else if (eventId === 'fan_protest') {
    if (choiceIdx === 0) {
      tc.clubFunds = Math.max(0, tc.clubFunds - 6);
      tc.moraleMod += 5;
      outcome =
        'Bilet indirimi sonrası stadyum tamamen doldu! Tribün desteğiyle takım performansı +%5 arttı.';
    } else {
      tc.moraleMod = Math.max(-15, tc.moraleMod - 3);
      outcome = 'Tribünlerdeki protesto nedeniyle iç saha atmosferi soğudu (-%3 performans).';
    }
  } else if (eventId === 'youth_boost') {
    if (choiceIdx === 0) {
      randomStarter.r = Math.min(99, randomStarter.r + 1);
      outcome = `${randomStarter.n} ödüllendirildi ve kalıcı form gelişimi sağladı!`;
    } else {
      tc.moraleMod += 3;
      outcome = 'Takım içi kolej havası güçlendi, genel saha performansı +%3 arttı!';
    }
  } else if (eventId === 'friendly_cup') {
    if (choiceIdx === 0) {
      tc.clubFunds += 16;
      tc.moraleMod = Math.max(-15, tc.moraleMod - 2);
      outcome =
        'Özel dostluk maçından kasaya +16 M€ girdi; seyahat temposu nedeniyle formda -%2 düşüş yaşandı.';
    } else {
      tc.moraleMod += 3;
      outcome =
        'Seyahat teklifi reddedildi; tesislerde yapılan özel taktik çalışmayla takım formu +%3 yükseldi.';
    }
  } else if (eventId === 'analytics_lab') {
    if (choiceIdx === 0) {
      tc.clubFunds = Math.max(0, tc.clubFunds - 10);
      tc.moraleMod += 4;
      outcome =
        '10 M€ yatırımla veri analiz laboratuvarı kuruldu! Takımın taktik hazırlığı +%4 güçlendi.';
    } else {
      tc.moraleMod += 1;
      outcome = 'Bütçe korundu, mevcut teknik analiz ekibiyle çalışmalara devam edildi (+%1 odak).';
    }
  } else if (eventId === 'bonus_revision') {
    if (choiceIdx === 0) {
      tc.clubFunds = Math.max(0, tc.clubFunds - 8);
      tc.moraleMod += 5;
      outcome =
        "8 M€'luk yeni prim paketi açıklandı! Soyunma odasında şampiyonluk hırsı +%5 arttı.";
    } else {
      tc.moraleMod = Math.max(-15, tc.moraleMod - 2);
      outcome = 'Prim talebi sezon sonuna ertelendi; bazı oyuncularda -%2 motivasyon kaybı oluştu.';
    }
  } else if (eventId === 'stadium_vip') {
    if (choiceIdx === 0) {
      tc.clubFunds += 15;
      outcome = 'Yeni VIP locaların satışından kulüp kasasına +15 M€ sıcak para girdi!';
    } else {
      tc.moraleMod += 4;
      outcome =
        'Tribünler ateşli taraftar gruplarına tahsis edildi! İç saha atmosferi +%4 güçlendi.';
    }
  } else if (eventId === 'recovery_protocol') {
    if (choiceIdx === 0) {
      tc.clubFunds = Math.max(0, tc.clubFunds - 6);
      tc.moraleMod += 3;
      const myPlayerIds = new Set(userTeam.picks.map((p) => p.id));
      for (const pidStr of Object.keys(lg.injuries)) {
        const pid = Number(pidStr);
        if (!myPlayerIds.has(pid)) continue;
        if (lg.suspensions && lg.suspensions[pid]) continue;
        lg.injuries[pid] = Math.max(0, lg.injuries[pid] - 1);
        if (lg.injuries[pid] <= 0) delete lg.injuries[pid];
      }
      outcome =
        'Rejenerasyon merkezi devreye girdi! Oyuncu kondisyonu +%3 arttı ve mevcut sakatlık süreleri kısaldı.';
    } else {
      outcome = 'Sağlık ekibi standart dinlenme protokolüyle haftayı tamamladı.';
    }
  } else if (eventId === 'saudi_mega_offer') {
    if (choiceIdx === 0) {
      tc.clubFunds = Math.max(0, tc.clubFunds - 9);
      starPlayer.r = Math.min(99, starPlayer.r + 1);
      outcome = `${starPlayer.n} astronomik teklifi reddedip takımda kaldı! Özel sadakat primiyle seviyesi yükseldi.`;
    } else {
      tc.moraleMod = Math.max(-15, tc.moraleMod - 2);
      outcome = `Transfer teklifi reddedildi ancak ${starPlayer.n} cephesinde kısa süreli kırgınlık yaşandı (-%2 moral).`;
    }
  } else if (eventId === 'docuseries_deal') {
    if (choiceIdx === 0) {
      tc.clubFunds += 20;
      tc.moraleMod = Math.max(-15, tc.moraleMod - 2);
      outcome =
        'Belgesel anlaşmasıyla kasaya +20 M€ girdi; soyunma odasındaki kameralar konsantrasyonu -%2 etkiledi.';
    } else {
      tc.moraleMod += 3;
      outcome =
        'Kameraları soyunma odasına sokmadın; oyuncuların sana olan güveni ve saha içi uyumu +%3 arttı.';
    }
  }

  if (teamIdx === 0) {
    syncTopLevelCareerMirrorForTeam0(lg);
  }
  return outcome;
}

export function resolveTeamCareerEventChoice(
  lg: LeagueState,
  teams: Team[],
  teamIdx: number,
  choiceIdx: number
): string {
  const tc = ensureTeamCareerState(lg, teamIdx);
  const activeEv = tc.activeEvent || (teamIdx === 0 ? lg.activeEvent : null);
  const userTeam = teams[teamIdx] || teams[0];
  if (!activeEv || !userTeam) return '';

  const outcome = applyCareerEventChoice(
    lg,
    userTeam,
    teamIdx,
    activeEv.id,
    choiceIdx,
    activeEv.targetPlayerId,
    activeEv.benchPlayerId
  );

  tc.eventHistory.unshift({
    week: lg.week,
    title: activeEv.title,
    outcome,
  });
  if (teamIdx === 0) {
    syncTopLevelCareerMirrorForTeam0(lg);
  }
  return outcome;
}

export function buildCareerEventsCatalog(
  lg: LeagueState,
  userTeam: Team,
  teamIdx = 0
): CareerEvent[] {
  ensureTeamLineup(userTeam, lg, true);
  const tc = ensureTeamCareerState(lg, teamIdx);
  const healthyStarters = (userTeam.starters || []).filter((p) => !lg.injuries[p.id]);
  const fallbackPlayer = {
    id: 0,
    n: 'Takım Kaptanı',
    pos: 'MID' as const,
    r: 85,
    c: userTeam.name || 'Kulüp',
  };
  const starPlayer =
    [...healthyStarters].sort((a, b) => b.r - a.r)[0] ||
    (userTeam.starters && userTeam.starters[0]) ||
    userTeam.picks[0] ||
    fallbackPlayer;
  const randomStarter =
    healthyStarters[(Math.random() * healthyStarters.length) | 0] || starPlayer;
  const benchSub =
    (userTeam.bench || []).find((b) => b.pos === randomStarter.pos && !lg.injuries[b.id]) ||
    (userTeam.bench && userTeam.bench[0]);
  const lastRes =
    tc.lastResult ||
    (teamIdx === 0 ? lg.lastResult : null) || {
      userGoals: 0,
      oppGoals: 2,
      oppName: 'Rakip',
    };

  const makeChoice = (
    eventId: string,
    choiceIdx: number,
    label: string,
    targetPid?: number,
    benchPid?: number
  ) => ({
    choiceIdx,
    label,
    effect: ({ lg: state, userTeam: tm, teamIdx: tIdx }: { lg: LeagueState; userTeam: Team; teamIdx?: number }) =>
      applyCareerEventChoice(
        state,
        tm,
        tIdx ?? teamIdx,
        eventId,
        choiceIdx,
        targetPid,
        benchPid
      ),
  });

  return [
    {
      id: 'sponsor',
      teamIdx,
      tag: 'Sponsorluk Masası · Ticari Anlaşma',
      title: "Etihad Airways, Qatar Airways ve Emirates'ten Forma Sponsorluğu Teklifi!",
      desc: `Kulübünün ${lg.leagueName}'deki yükselişi sonrası 3 dev havayolu şirketi göğüs sponsorluğu için teklif sundu: Qatar Airways en yüksek nakit paketi verirken yoğun tanıtım turu istiyor; Etihad Airways dengeli bütçe ve tesis desteği sunuyor; Emirates ise şampiyonluk primli prestij paketi öneriyor.`,
      choices: [
        makeChoice('sponsor', 0, 'Qatar Airways ile İmzala (+32 M€ Nakit · Tanıtım Turu: -%2 Kondisyon)'),
        makeChoice('sponsor', 1, 'Etihad Airways ile İmzala (+24 M€ Nakit · Tesis Desteği: +%2 Performans)'),
        makeChoice('sponsor', 2, 'Fly Emirates Prestij Paketi (+18 M€ Nakit · +%4 Takım Morali)'),
      ],
    },
    {
      id: 'bad_pitch',
      teamIdx,
      tag: 'Stadyum & Saha Krizi',
      title: 'Stadyum Zemini Çok Kötü Durumda!',
      desc: 'Yoğun yağış ve maç trafiği sonrasında stadyum zemini balçık ve çukurlarla doldu. Pas oyununuz aksıyor ve sakatlık riski arttı. Zemin için nasıl bir adım atacaksın?',
      choices: [
        makeChoice('bad_pitch', 0, 'Hibrit Çim Zemini Acilen Yenilet (-12 M€ · +%3 Saha Performansı)'),
        makeChoice('bad_pitch', 1, 'Kısmi Bakım Yaptır ve Uzun Top Taktiğine Geç (Ücretsiz · -%2 Performans)'),
      ],
    },
    {
      id: 'media_backlash',
      teamIdx,
      tag: 'Spor Gündemi · Mağlubiyet Yankıları',
      title: 'Mağlubiyet Sonrası Gazetelerde Sert Eleştiri!',
      desc: `${lastRes.oppName} karşısında alınan ${lastRes.userGoals}-${lastRes.oppGoals}'lik yenilgi sonrası spor basını takımın taktik disiplinini ağır şekilde eleştirdi. Soyunma odasında moraller bozuk.`,
      choices: [
        makeChoice('media_backlash', 0, 'Tesisleri Dış Dünyaya Kapat & Takımı Kenetle (+%4 Odaklanma)'),
        makeChoice('media_backlash', 1, 'Oyunculara Tam Destek Ver (+%3 Oyuncu Sadakati)'),
        makeChoice('media_backlash', 2, 'Disiplin Cezası Kes (+6 M€ Kasa · -%4 Moral)'),
      ],
    },
    {
      id: 'injury',
      teamIdx,
      targetPlayerId: randomStarter.id,
      benchPlayerId: benchSub?.id,
      tag: 'Sağlık Raporu · Sakatlık Krizi',
      title: `${randomStarter.n} Antrenmanda Sakatlandı!`,
      desc: `İlk 11 oyuncun ${randomStarter.n} arka adalesinden sakatlık geçirdi. Sağlık ekibi normal şartlarda 3 hafta sahalardan uzak kalacağını bildirdi.`,
      choices: [
        makeChoice('injury', 0, 'Özel Klinik Tedavisi Uygula (-8 M€ · 1 Hafta Sonra Döner)', randomStarter.id, benchSub?.id),
        makeChoice('injury', 1, 'Standart Dinlendirme (3 Hafta Yok · Yedek Oyuncu Oynar)', randomStarter.id, benchSub?.id),
      ],
    },
    {
      id: 'takeover',
      teamIdx,
      tag: 'Yönetim Kurulu · Yatırım Teklifi',
      title: 'Kulübe Uluslararası Yatırım Fonu Ortaklık Teklifi!',
      desc: `Küresel bir yatırım fonu ${userTeam.name} hisselerinin %35'ini satın alarak kulübe sermaye girişi sağlamak istiyor.`,
      choices: [
        makeChoice('takeover', 0, 'Ortaklığı Onayla (+35 M€ Kulüp Kasası · +%3 Şampiyonluk Primi)'),
        makeChoice('takeover', 1, 'Teklifi Reddet & Kulüp Yapısını Koru (+%5 Taraftar Desteği)'),
      ],
    },
    {
      id: 'transfer_bid',
      teamIdx,
      targetPlayerId: starPlayer.id,
      tag: 'Transfer Masası · Astronomik Teklif',
      title: `Avrupa Devinden ${starPlayer.n} İçin Astronomik Teklif!`,
      desc: `Avrupa'nın dev kulüplerinden biri yıldız oyuncun ${starPlayer.n} için kulüp yönetimine reddedilmesi güç bir teklif sundu. Oyuncunun kafası karışık.`,
      choices: [
        makeChoice('transfer_bid', 0, 'Teklifi Reddet & Maaş İyileştirmesi Yap (-10 M€ · Yıldız Form Artışı)', starPlayer.id),
        makeChoice('transfer_bid', 1, 'Oyuncuyla Görüşüp Sezon Sonuna Söz Al (Maliyetsiz · +%2 Uyum)', starPlayer.id),
      ],
    },
    {
      id: 'var_referee',
      teamIdx,
      tag: 'Hakem & VAR Gündemi · PGMOL',
      title: 'Tartışmalı VAR Kararları ve Kritik Hakem Ataması!',
      desc: 'Son haftalardaki tartışmalı VAR kararları gündemdeyken bu haftaki kritik maça da en çok tartışılan hakem triosu atandı.',
      choices: [
        makeChoice('var_referee', 0, 'Resmi Kulüp Bildirisi Yayınla ve VAR Kayıtlarını İste (+%4 Tribün Baskısı)'),
        makeChoice('var_referee', 1, "Takıma 'Sadece Oyuna Odaklanın' Talimatı Ver (+%2 Taktik Disiplin)"),
      ],
    },
    {
      id: 'dressing_room_crisis',
      teamIdx,
      targetPlayerId: starPlayer.id,
      tag: 'Soyunma Odası · Disiplin Krizi',
      title: `${starPlayer.n} Sabah Antrenmanına Geç Kaldı!`,
      desc: `Yıldız oyuncun ${starPlayer.n} kritik hafta öncesinde sabah idmanına izinsiz şekilde geç katıldı. Takım arkadaşları vereceğin kararı bekliyor.`,
      choices: [
        makeChoice('dressing_room_crisis', 0, 'Para Cezası Kes ve Disiplini Koru (+5 M€ Kasa · +%3 Disiplin)', starPlayer.id),
        makeChoice('dressing_room_crisis', 1, 'Olayı Kapat ve Yıldız Oyuncuyu Uyarmakla Yetin (-%3 Takım İçi Adalet)', starPlayer.id),
      ],
    },
    {
      id: 'fan_protest',
      teamIdx,
      tag: 'Tribün Gündemi · Bilet Fiyatları',
      title: 'Taraftarlardan Bilet Fiyatları Tepkisi!',
      desc: 'Kale arkası taraftar grupları, artan bilet fiyatları nedeniyle bu haftaki maçın ilk 15 dakikasında protesto hazırlığında.',
      choices: [
        makeChoice('fan_protest', 0, 'Bilet Fiyatlarında %25 İndirim Yap (-6 M€ · +%5 Tribün Desteği)'),
        makeChoice('fan_protest', 1, 'Fiyatları Sabit Tut (Gelir Kaybı Yok · -%3 Tribün Desteği)'),
      ],
    },
    {
      id: 'youth_boost',
      teamIdx,
      targetPlayerId: randomStarter.id,
      tag: 'Antrenman Raporu · Bireysel Gelişim',
      title: `${randomStarter.n} Antrenmanlarda Parlıyor!`,
      desc: `Teknik heyet, ${randomStarter.n} isimli oyuncunun son haftalarda ekstra şut ve kondisyon çalışarak formunun zirvesine çıktığını raporladı.`,
      choices: [
        makeChoice('youth_boost', 0, 'Özel Prim Ver & Sorumluluğunu Artır (Kalıcı Gelişim)', randomStarter.id),
        makeChoice('youth_boost', 1, 'Tüm Takıma Moral Yemeği Düzenle (+%3 Takım Performansı)', randomStarter.id),
      ],
    },
    {
      id: 'friendly_cup',
      teamIdx,
      tag: 'Uluslararası Davet · Özel Gösteri Maçı',
      title: 'Riyad Sezon İçi Dostluk Kupası Daveti!',
      desc: 'Uluslararası organizatörler, fikstür arasındaki boşlukta kulübünü özel bir gösteri maçına davet etti. Katılırsan ciddi bir yayın geliri elde edeceksin ancak yolculuk takımı yorabilir.',
      choices: [
        makeChoice('friendly_cup', 0, 'Daveti Kabul Et (+16 M€ Gelir · Yolculuk Yorgunluğu: -%2 Form)'),
        makeChoice('friendly_cup', 1, 'Teklifi Reddet & Tesislerde Taktik Kamp Yap (+%3 Saha İçi Uyum)'),
      ],
    },
    {
      id: 'analytics_lab',
      teamIdx,
      tag: 'Tesis Yatırımı · Futbol Teknolojisi',
      title: 'Yapay Zeka Destekli Performans & Analiz Laboratuvarı!',
      desc: 'Sportif direktörün, kulüp tesislerine oyuncu yük takibi ve rakip duran top analizi yapan yeni nesil bir veri laboratuvarı kurulmasını önerdi.',
      choices: [
        makeChoice('analytics_lab', 0, 'Laboratuvarı Kur (-10 M€ · +%4 Kalıcı Taktik & Kondisyon Katkısı)'),
        makeChoice('analytics_lab', 1, 'Bütçeyi Koru & Mevcut Analiz Ekibiyle Devam Et (+%1 Odak)'),
      ],
    },
    {
      id: 'bonus_revision',
      teamIdx,
      tag: 'Soyunma Odası · Prim Görüşmesi',
      title: 'Takım Kaptanlarından Şampiyonluk Primi Talebi!',
      desc: `Takım kaptanları, zorlu ${lg.leagueName} fikstürü öncesinde yönetimden maç başı ve şampiyonluk primlerinin güncellenmesini talep etti.`,
      choices: [
        makeChoice('bonus_revision', 0, 'Prim Paketi Güncellemesini Onayla (-8 M€ · +%5 Şampiyonluk Hırsı)'),
        makeChoice('bonus_revision', 1, 'Sezon Sonuna Kadar Mevcut Sözleşmeleri Koru (-%2 Moral)'),
      ],
    },
    {
      id: 'stadium_vip',
      teamIdx,
      tag: 'Kulüp Ekonomisi · Stadyum Projesi',
      title: 'VIP Loca ve Maç Günü Ticari Alan Yenilemesi!',
      desc: 'Pazarlama departmanı, stadyumun batı tribününe yeni kurumsal VIP localar ekleyerek maç günü gelirlerini artırma projesini sundu.',
      choices: [
        makeChoice('stadium_vip', 0, 'Kurumsal VIP Locaları Aç (+15 M€ Net Gelir)'),
        makeChoice('stadium_vip', 1, 'Alanı Gençlik & Taraftar Tribününe Ayır (+%4 İç Saha Atmosferi)'),
      ],
    },
    {
      id: 'recovery_protocol',
      teamIdx,
      tag: 'Sağlık Kurulu · Yoğun Fikstür',
      title: 'Kriyoterapi ve Rejenerasyon Merkezi Yatırımı!',
      desc: `Sağlık ekibi, üst üste oynanan sert ${lg.leagueName} maçları sonrası kas yorgunluğunu azaltacak yeni rejenerasyon üniteleri talep ediyor.`,
      choices: [
        makeChoice('recovery_protocol', 0, 'Rejenerasyon Ünitelerini Al (-6 M€ · Sakatlık Süreleri -1 Hafta & +%3 Form)'),
        makeChoice('recovery_protocol', 1, 'Mevcut Fizyoterapi Programıyla Devam Et (Maliyetsiz)'),
      ],
    },
    {
      id: 'saudi_mega_offer',
      teamIdx,
      targetPlayerId: starPlayer.id,
      tag: 'Transfer Masası · Suudi Pro Ligi Teklifi',
      title: `Suudi Arabistan Kulübünden ${starPlayer.n} İçin 85 M€'luk Teklif!`,
      desc: `Suudi Pro Ligi devlerinden biri, takımının en önemli yıldızı ${starPlayer.n}'a yıllık 40 M€ maaş ve kulübüne dev bir bonservis paketi sundu. Oyuncunun menajeri yönetimle acil görüşme talep etti.`,
      choices: [
        makeChoice('saudi_mega_offer', 0, 'Kapıyı Kapat & Yıldız Oyuncuya Sadakat Primi Ver (-9 M€ · Kalıcı Gelişim)', starPlayer.id),
        makeChoice('saudi_mega_offer', 1, 'Menajeriyle Sert Konuş ve Sözleşmesini Hatırlat (Maliyetsiz · -%2 Moral)', starPlayer.id),
      ],
    },
    {
      id: 'docuseries_deal',
      teamIdx,
      tag: 'Medya & Yayın · Kulüp Belgeseli',
      title: "Dijital Platformdan 'Soyunma Odası' Belgeseli Teklifi!",
      desc: 'Küresel bir dijital yayın platformu, sezon boyunca soyunma odası ve antrenman tesislerinde kamera bulundurarak kulübün şampiyonluk yürüyüşünü belgesel yapmak için yüksek bütçeli teklif sundu.',
      choices: [
        makeChoice('docuseries_deal', 0, 'Anlaşmayı İmzala (+20 M€ Yayın Geliri · Kameralar Nedeniyle -%2 Odak)'),
        makeChoice('docuseries_deal', 1, 'Soyunma Odası Mahremiyetini Koru & Reddet (+%3 Takım İçi Güven)'),
      ],
    },
  ];
}

export function triggerCareerEventForTeam(
  lg: LeagueState,
  teams: Team[],
  teamIdx: number,
  force = false
): void {
  if (!lg || lg.week > lg.maxWeeks) return;
  const userTeam = teams[teamIdx];
  if (!userTeam) return;
  ensureTeamLineup(userTeam, lg, true);
  const tc = ensureTeamCareerState(lg, teamIdx);
  const usedSet = new Set(tc.usedEventIds);

  const catalog = buildCareerEventsCatalog(lg, userTeam, teamIdx);
  const lastRes = tc.lastResult || (teamIdx === 0 ? lg.lastResult : null);

  if (lastRes && lastRes.userGoals < lastRes.oppGoals) {
    const mediaEv = catalog.find((e) => e.id === 'media_backlash');
    if (
      mediaEv &&
      (!usedSet.has('media_backlash') || lastRes.oppGoals - lastRes.userGoals >= 2)
    ) {
      usedSet.add('media_backlash');
      tc.usedEventIds = [...usedSet];
      tc.activeEvent = mediaEv;
      if (teamIdx === 0) syncTopLevelCareerMirrorForTeam0(lg);
      return;
    }
  }

  if (!force && Math.random() > 0.65) return;

  let available = catalog.filter((e) => e.id !== 'media_backlash' && !usedSet.has(e.id));
  if (!available.length) {
    usedSet.clear();
    available = catalog.filter((e) => e.id !== 'media_backlash');
  }
  const pickedEvent = available[(Math.random() * available.length) | 0];
  if (pickedEvent) {
    usedSet.add(pickedEvent.id);
    tc.usedEventIds = [...usedSet];
    tc.activeEvent = pickedEvent;
    if (teamIdx === 0) syncTopLevelCareerMirrorForTeam0(lg);
  }
}

export function triggerWeeklyCareerEvent(lg: LeagueState, teams: Team[], force = false): void {
  if (!lg || lg.week > lg.maxWeeks) return;
  const humanIndices = teams
    .map((tm, idx) => (tm.isHuman ? idx : -1))
    .filter((idx) => idx >= 0);
  if (humanIndices.length === 0) {
    triggerCareerEventForTeam(lg, teams, 0, force);
    return;
  }
  humanIndices.forEach((tIdx) => {
    triggerCareerEventForTeam(lg, teams, tIdx, force);
  });
}

export function finalizeCareerWeekAfterUserMatch(
  lg: LeagueState,
  teams: Team[],
  userMatchSides: { a: number; b: number },
  scA: number,
  scB: number,
  goalsListA: MatchGoalEntry[],
  goalsListB: MatchGoalEntry[],
  matchPlayerStats: Record<number, MatchPlayerStat>
): void {
  if (!lg || lg.week > lg.maxWeeks) return;
  const completedWeek = lg.week;
  const roundMatches = lg.schedule[completedWeek - 1];
  if (!roundMatches) return;

  const userMatch = roundMatches.find(
    (m) =>
      (m.a === userMatchSides.a && m.b === userMatchSides.b) ||
      (m.a === userMatchSides.b && m.b === userMatchSides.a)
  );
  if (userMatch && !userMatch.done) {
    userMatch.done = true;
    const isDirectOrder = userMatch.a === userMatchSides.a;
    const sA = isDirectOrder ? scA : scB;
    const sB = isDirectOrder ? scB : scA;
    userMatch.sc = [sA, sB];
    userMatch.redCards = [];
    updateLeagueTableForMatch(lg, userMatch.a, userMatch.b, sA, sB);

    // Record lastResult independently for any human team involved in this fixture
    if (teams[userMatch.a]?.isHuman) {
      const tcA = ensureTeamCareerState(lg, userMatch.a);
      tcA.lastResult = {
        userGoals: sA,
        oppGoals: sB,
        oppName: teams[userMatch.b] ? teams[userMatch.b].name : 'Rakip',
      };
      if (userMatch.a === 0) lg.lastResult = tcA.lastResult;
    }
    if (teams[userMatch.b]?.isHuman) {
      const tcB = ensureTeamCareerState(lg, userMatch.b);
      tcB.lastResult = {
        userGoals: sB,
        oppGoals: sA,
        oppName: teams[userMatch.a] ? teams[userMatch.a].name : 'Rakip',
      };
      if (userMatch.b === 0) lg.lastResult = tcB.lastResult;
    }
    if (!teams[userMatch.a]?.isHuman && !teams[userMatch.b]?.isHuman) {
      lg.lastResult = {
        userGoals: sA,
        oppGoals: sB,
        oppName: teams[userMatch.b] ? teams[userMatch.b].name : 'Rakip',
      };
    }

    (
      [
        [userMatchSides.a, goalsListA],
        [userMatchSides.b, goalsListB],
      ] as [number, MatchGoalEntry[]][]
    ).forEach(([tIdx, gArr]) => {
      const tm = teams[tIdx];
      if (!tm) return;
      (gArr || []).forEach((g) => {
        if (g && g.scorer) {
          const k = `${tIdx}_${g.scorer}`;
          if (!lg.playerStats[k]) {
            lg.playerStats[k] = {
              name: g.scorer,
              teamIdx: tIdx,
              teamName: tm.name,
              goals: 0,
              assists: 0,
            };
          }
          lg.playerStats[k].goals++;
        }
        if (g && g.assister) {
          const kA = `${tIdx}_${g.assister}`;
          if (!lg.playerStats[kA]) {
            lg.playerStats[kA] = {
              name: g.assister,
              teamIdx: tIdx,
              teamName: tm.name,
              goals: 0,
              assists: 0,
            };
          }
          lg.playerStats[kA].assists++;
        }
      });
    });

    // Collect red cards from BOTH teams in the user's match!
    [userMatchSides.a, userMatchSides.b].forEach((sideTeamIdx) => {
      const tm = teams[sideTeamIdx];
      if (!tm) return;
      tm.picks.forEach((pl) => {
        const st = matchPlayerStats[pl.id];
        if (st && st.red) {
          userMatch.redCards!.push({
            teamIdx: sideTeamIdx,
            playerId: pl.id,
            playerName: pl.n,
          });
        }
      });
    });
  }

  // If another human team still has an unplayed match this week, wait before rolling over the week
  const hasPendingHumanMatch = roundMatches.some(
    (m) => !m.done && (teams[m.a]?.isHuman || teams[m.b]?.isHuman)
  );
  if (hasPendingHumanMatch) {
    return;
  }

  // Simulate remaining AI matches in this round
  roundMatches.forEach((m) => {
    if (!m.done) simulateBackgroundLeagueMatch(lg, teams, m, completedWeek);
  });

  // 1) Decrement prior bans/injuries served during completedWeek BEFORE applying new bans
  advanceCareerStatusOneWeek(lg);

  // 2) Record ALL new red-card suspensions from completedWeek (user match + AI matches) for NEXT week
  roundMatches.forEach((m) => {
    (m.redCards || []).forEach((rc) => {
      const tm = teams[rc.teamIdx];
      const pl = tm?.picks.find((p) => p.id === rc.playerId);
      if (pl) {
        suspendPlayerForRedCard(lg, teams, rc.teamIdx, pl, 1);
      }
    });
  });

  // 3) Advance week counter & enforce healthy starters across ALL 20 teams for next week
  lg.viewWeek = completedWeek;
  lg.week++;
  teams.forEach((tm) => {
    ensureTeamLineup(tm, lg, true);
    enforceHealthyStartersForTeam(tm, lg, true);
  });

  // 4) Trigger weekly career event & weekly news
  triggerWeeklyCareerEvent(lg, teams);
  triggerWeeklyTeamNews(lg, teams, roundMatches, completedWeek);
}

export function simulateRestOfLeagueSeason(lg: LeagueState, teams: Team[]): void {
  while (lg.week <= lg.maxWeeks) {
    const cw = lg.week;
    const roundMatches = lg.schedule[cw - 1];
    roundMatches.forEach((m) => {
      if (!m.done) simulateBackgroundLeagueMatch(lg, teams, m, cw);
    });
    advanceCareerStatusOneWeek(lg);
    roundMatches.forEach((m) => {
      (m.redCards || []).forEach((rc) => {
        const tm = teams[rc.teamIdx];
        const pl = tm?.picks.find((p) => p.id === rc.playerId);
        if (pl) suspendPlayerForRedCard(lg, teams, rc.teamIdx, pl, 1);
      });
    });
    teams.forEach((tm) => {
      ensureTeamLineup(tm, lg, true);
      enforceHealthyStartersForTeam(tm, lg, true);
    });
    const matchNews = generateDynamicMatchHeadline(teams, roundMatches, cw);
    if (matchNews) lg.newsFeed.unshift(matchNews);
    lg.viewWeek = cw;
    lg.week++;
  }
  lg.activeEvent = null;
  lg.activeNews = null;
  lg.pendingNewsAfterEvent = null;
}

export function getSuspendedPlayersForTeam(lg: LeagueState | null, team: Team | undefined): Player[] {
  if (!lg || !team) return [];
  return team.picks.filter(
    (p) => (lg.injuries[p.id] || 0) > 0 && (lg.suspensions[p.id] || 0) > 0
  );
}
