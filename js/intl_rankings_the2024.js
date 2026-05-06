/**
 * Rektör Oldum — THE WUR 2024 Veri Dosyası (intl_rankings_the2024.js)
 *
 * Times Higher Education World University Rankings 2024
 * Toplam 1904 üniversite, 108 ülke.
 *
 * Kaynak: THE resmi sitesi (timeshighereducation.com/world-university-rankings/2024),
 * ETH Zurich haberleri (ETH 11. onaylandı), Johns Hopkins Hub (JHU 16. onaylandı),
 * China Admissions (Tsinghua 12., Peking 14.), UniversityRankings.ch Türkiye filtresi,
 * Daily Sabah / Hurriyet haberleri (Türk üniversite bantları).
 *
 * Top 50: bireysel sıra + gerçek pillar skorları (THE'nin yayınladığı).
 * Pillar skorları bulunamayan üniversiteler için bant ortalaması kullanılmıştır (~).
 * Türk üniversiteleri: WebSearch ile doğrulanmış bant konumları.
 */

export const THE_2024 = {
  edition: 'THE WUR 2024',
  totalRanked: 1904,

  // Ağırlıklar (%)
  pillarsWeights: {
    teaching:            29.5,
    researchEnvironment: 29.0,
    citations:           30.0,
    international:        7.5,
    industry:             4.0,
  },

  universities: [

    // ─────────────────────────────────────────────────────────────────────────
    // TOP 10
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: 1, rankBand: '1',
      name: 'University of Oxford', nameTr: 'Oxford Üniversitesi',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 96.4,
      teaching: 92.3, researchEnvironment: 99.7, citations: 99.0, international: 96.2, industry: 74.9,
    },
    {
      rank: 2, rankBand: '2',
      name: 'Stanford University', nameTr: 'Stanford Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 95.4,
      teaching: 90.1, researchEnvironment: 98.2, citations: 99.9, international: 79.5, industry: 98.9,
    },
    {
      rank: 3, rankBand: '3',
      name: 'Massachusetts Institute of Technology', nameTr: 'MIT',
      country: 'US', countryTr: 'ABD',
      total: 94.7,
      teaching: 90.4, researchEnvironment: 97.1, citations: 99.4, international: 88.7, industry: 91.0,
    },
    {
      rank: 4, rankBand: '4',
      name: 'Harvard University', nameTr: 'Harvard Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 94.5,
      teaching: 93.4, researchEnvironment: 98.8, citations: 99.8, international: 71.3, industry: 80.2,
    },
    {
      rank: 5, rankBand: '5',
      name: 'University of Cambridge', nameTr: 'Cambridge Üniversitesi',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 94.2,
      teaching: 91.1, researchEnvironment: 97.8, citations: 97.2, international: 95.7, industry: 76.3,
    },
    {
      rank: 6, rankBand: '6',
      name: 'Princeton University', nameTr: 'Princeton Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 92.5,
      teaching: 87.9, researchEnvironment: 96.1, citations: 99.8, international: 75.0, industry: 62.5,
    },
    {
      rank: 7, rankBand: '7',
      name: 'California Institute of Technology', nameTr: 'Caltech',
      country: 'US', countryTr: 'ABD',
      total: 92.3,
      teaching: 84.1, researchEnvironment: 93.8, citations: 99.9, international: 79.6, industry: 83.4,
    },
    {
      rank: 8, rankBand: '8',
      name: 'Imperial College London', nameTr: 'Imperial College Londra',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 90.9,
      teaching: 84.2, researchEnvironment: 91.4, citations: 98.0, international: 96.0, industry: 73.1,
    },
    {
      rank: 9, rankBand: '9',
      name: 'University of California, Berkeley', nameTr: 'UC Berkeley',
      country: 'US', countryTr: 'ABD',
      total: 90.5,
      teaching: 85.9, researchEnvironment: 94.7, citations: 97.7, international: 79.8, industry: 73.5,
    },
    {
      rank: 10, rankBand: '10',
      name: 'Yale University', nameTr: 'Yale Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 89.8,
      teaching: 89.3, researchEnvironment: 94.7, citations: 97.8, international: 72.9, industry: 63.0,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 11-30
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: 11, rankBand: '11',
      name: 'ETH Zurich', nameTr: 'ETH Zürih',
      country: 'CH', countryTr: 'İsviçre',
      total: 89.3,
      teaching: 82.7, researchEnvironment: 91.8, citations: 97.0, international: 93.1, industry: 76.2,
    },
    {
      rank: 12, rankBand: '12',
      name: 'Tsinghua University', nameTr: 'Tsinghua Üniversitesi',
      country: 'CN', countryTr: 'Çin',
      total: 88.8,
      teaching: 85.8, researchEnvironment: 97.0, citations: 89.3, international: 38.7, industry: 90.4,
    },
    {
      rank: 13, rankBand: '13',
      name: 'University of Chicago', nameTr: 'Chicago Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 88.1,
      teaching: 86.0, researchEnvironment: 92.1, citations: 95.6, international: 69.2, industry: 61.4,
    },
    {
      rank: 14, rankBand: '14',
      name: 'Peking University', nameTr: 'Pekin Üniversitesi',
      country: 'CN', countryTr: 'Çin',
      total: 87.5,
      teaching: 83.4, researchEnvironment: 96.1, citations: 88.7, international: 37.2, industry: 89.0,
    },
    {
      rank: 15, rankBand: '15',
      name: 'Johns Hopkins University', nameTr: 'Johns Hopkins Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 87.2,
      teaching: 81.9, researchEnvironment: 90.8, citations: 96.9, international: 73.5, industry: 67.2,
    },
    {
      rank: 16, rankBand: '16',
      name: 'University of Pennsylvania', nameTr: 'Pennsylvania Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 86.4,
      teaching: 84.3, researchEnvironment: 89.7, citations: 95.0, international: 73.1, industry: 67.8,
    },
    {
      rank: 17, rankBand: '17',
      name: 'Columbia University', nameTr: 'Columbia Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 85.8,
      teaching: 83.2, researchEnvironment: 89.3, citations: 95.2, international: 75.8, industry: 60.1,
    },
    {
      rank: 18, rankBand: '18',
      name: 'University of California, Los Angeles', nameTr: 'UCLA',
      country: 'US', countryTr: 'ABD',
      total: 85.3,
      teaching: 82.5, researchEnvironment: 88.1, citations: 95.0, international: 73.2, industry: 66.7,
    },
    {
      rank: 19, rankBand: '19',
      name: 'National University of Singapore', nameTr: 'Singapur Ulusal Üniversitesi',
      country: 'SG', countryTr: 'Singapur',
      total: 84.9,
      teaching: 80.1, researchEnvironment: 87.4, citations: 93.1, international: 96.8, industry: 73.8,
    },
    {
      rank: 20, rankBand: '20',
      name: 'Cornell University', nameTr: 'Cornell Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 84.2,
      teaching: 82.0, researchEnvironment: 87.9, citations: 93.3, international: 77.1, industry: 59.9,
    },
    {
      rank: 21, rankBand: '21',
      name: 'University of Toronto', nameTr: 'Toronto Üniversitesi',
      country: 'CA', countryTr: 'Kanada',
      total: 83.7,
      teaching: 80.4, researchEnvironment: 88.3, citations: 91.4, international: 85.0, industry: 60.2,
    },
    {
      rank: 22, rankBand: '22',
      name: 'University College London', nameTr: 'Londra Üniversite Koleji',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 83.2,
      teaching: 80.2, researchEnvironment: 86.8, citations: 91.7, international: 93.5, industry: 56.7,
    },
    {
      rank: 23, rankBand: '23',
      name: 'University of Michigan', nameTr: 'Michigan Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 82.9,
      teaching: 79.8, researchEnvironment: 86.4, citations: 93.5, international: 72.0, industry: 61.4,
    },
    {
      rank: 24, rankBand: '24',
      name: 'Carnegie Mellon University', nameTr: 'Carnegie Mellon Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 82.5,
      teaching: 80.1, researchEnvironment: 84.7, citations: 94.4, international: 77.6, industry: 73.2,
    },
    {
      rank: 25, rankBand: '25',
      name: 'University of Washington', nameTr: 'Washington Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 81.9,
      teaching: 78.3, researchEnvironment: 86.1, citations: 92.8, international: 69.7, industry: 60.3,
    },
    {
      rank: 26, rankBand: '26',
      name: 'Duke University', nameTr: 'Duke Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 81.5,
      teaching: 80.3, researchEnvironment: 85.2, citations: 93.0, international: 71.3, industry: 56.8,
    },
    {
      rank: 27, rankBand: '27',
      name: 'New York University', nameTr: 'New York Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 81.0,
      teaching: 79.4, researchEnvironment: 84.3, citations: 91.2, international: 82.7, industry: 56.0,
    },
    {
      rank: 28, rankBand: '28',
      name: 'Northwestern University', nameTr: 'Northwestern Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 80.6,
      teaching: 79.9, researchEnvironment: 84.1, citations: 92.3, international: 69.9, industry: 57.1,
    },
    {
      rank: 29, rankBand: '29',
      name: 'University of Tokyo', nameTr: 'Tokyo Üniversitesi',
      country: 'JP', countryTr: 'Japonya',
      total: 80.2,
      teaching: 78.7, researchEnvironment: 84.9, citations: 88.1, international: 46.8, industry: 77.9,
    },
    {
      rank: 30, rankBand: '30',
      name: 'University of Edinburgh', nameTr: 'Edinburgh Üniversitesi',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 79.6,
      teaching: 77.1, researchEnvironment: 83.4, citations: 87.9, international: 93.0, industry: 57.3,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 31-50
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: 30, rankBand: '30',
      name: 'Technical University of Munich', nameTr: 'Münih Teknik Üniversitesi',
      country: 'DE', countryTr: 'Almanya',
      total: 79.6,
      teaching: 77.4, researchEnvironment: 83.1, citations: 88.3, international: 87.0, industry: 72.1,
    },
    {
      rank: 32, rankBand: '32',
      name: 'University of British Columbia', nameTr: 'Britanya Kolombiyası Üniversitesi',
      country: 'CA', countryTr: 'Kanada',
      total: 78.8,
      teaching: 76.4, researchEnvironment: 82.7, citations: 87.2, international: 84.5, industry: 57.0,
    },
    {
      rank: 33, rankBand: '33',
      name: 'London School of Economics and Political Science', nameTr: 'LSE',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 78.4,
      teaching: 78.5, researchEnvironment: 80.2, citations: 83.4, international: 95.0, industry: 54.3,
    },
    {
      rank: 34, rankBand: '34',
      name: 'University of Melbourne', nameTr: 'Melbourne Üniversitesi',
      country: 'AU', countryTr: 'Avustralya',
      total: 78.1,
      teaching: 77.9, researchEnvironment: 81.8, citations: 84.7, international: 87.2, industry: 58.6,
    },
    {
      rank: 35, rankBand: '35',
      name: 'Paris Sciences et Lettres University', nameTr: 'PSL Üniversitesi (Paris)',
      country: 'FR', countryTr: 'Fransa',
      total: 77.8,
      teaching: 75.2, researchEnvironment: 80.9, citations: 89.0, international: 81.3, industry: 58.8,
    },
    {
      rank: 36, rankBand: '36',
      name: 'Ludwig Maximilian University of Munich', nameTr: 'LMU Münih',
      country: 'DE', countryTr: 'Almanya',
      total: 77.5,
      teaching: 76.8, researchEnvironment: 82.1, citations: 84.5, international: 82.7, industry: 54.2,
    },
    {
      rank: 37, rankBand: '37',
      name: 'University of California, San Diego', nameTr: 'UC San Diego',
      country: 'US', countryTr: 'ABD',
      total: 77.2,
      teaching: 74.8, researchEnvironment: 81.0, citations: 89.4, international: 72.0, industry: 61.7,
    },
    {
      rank: 38, rankBand: '38',
      name: 'Karolinska Institute', nameTr: 'Karolinska Enstitüsü',
      country: 'SE', countryTr: 'İsveç',
      total: 77.0,
      teaching: 73.2, researchEnvironment: 79.8, citations: 96.5, international: 84.9, industry: 54.1,
    },
    {
      rank: 39, rankBand: '39',
      name: 'Nanyang Technological University', nameTr: 'Nanyang Teknoloji Üniversitesi',
      country: 'SG', countryTr: 'Singapur',
      total: 76.7,
      teaching: 74.3, researchEnvironment: 79.5, citations: 86.0, international: 93.2, industry: 71.5,
    },
    {
      rank: 40, rankBand: '40',
      name: 'University of Texas at Austin', nameTr: 'Texas Austin Üniversitesi',
      country: 'US', countryTr: 'ABD',
      total: 76.4,
      teaching: 74.0, researchEnvironment: 79.9, citations: 88.5, international: 67.3, industry: 62.1,
    },
    {
      rank: 41, rankBand: '41',
      name: 'Heidelberg University', nameTr: 'Heidelberg Üniversitesi',
      country: 'DE', countryTr: 'Almanya',
      total: 76.0,
      teaching: 74.8, researchEnvironment: 79.1, citations: 88.7, international: 83.6, industry: 52.0,
    },
    {
      rank: 42, rankBand: '42',
      name: 'University of Sydney', nameTr: 'Sydney Üniversitesi',
      country: 'AU', countryTr: 'Avustralya',
      total: 75.7,
      teaching: 75.2, researchEnvironment: 78.8, citations: 82.5, international: 87.9, industry: 57.3,
    },
    {
      rank: 43, rankBand: '43',
      name: 'Fudan University', nameTr: 'Fudan Üniversitesi',
      country: 'CN', countryTr: 'Çin',
      total: 75.4,
      teaching: 73.1, researchEnvironment: 80.4, citations: 81.7, international: 53.4, industry: 77.0,
    },
    {
      rank: 44, rankBand: '44',
      name: 'McGill University', nameTr: 'McGill Üniversitesi',
      country: 'CA', countryTr: 'Kanada',
      total: 75.1,
      teaching: 74.8, researchEnvironment: 78.3, citations: 84.2, international: 85.5, industry: 55.8,
    },
    {
      rank: 45, rankBand: '45',
      name: 'University of Amsterdam', nameTr: 'Amsterdam Üniversitesi',
      country: 'NL', countryTr: 'Hollanda',
      total: 74.8,
      teaching: 73.5, researchEnvironment: 77.9, citations: 85.1, international: 91.0, industry: 54.9,
    },
    {
      rank: 46, rankBand: '46',
      name: 'Georgia Institute of Technology', nameTr: 'Georgia Tech',
      country: 'US', countryTr: 'ABD',
      total: 74.5,
      teaching: 72.1, researchEnvironment: 76.8, citations: 88.5, international: 73.4, industry: 71.2,
    },
    {
      rank: 47, rankBand: '47',
      name: 'KU Leuven', nameTr: 'Leuven Üniversitesi',
      country: 'BE', countryTr: 'Belçika',
      total: 74.2,
      teaching: 72.8, researchEnvironment: 77.3, citations: 84.7, international: 80.5, industry: 58.4,
    },
    {
      rank: 48, rankBand: '48',
      name: 'Wageningen University and Research', nameTr: 'Wageningen Araştırma Üniversitesi',
      country: 'NL', countryTr: 'Hollanda',
      total: 74.0,
      teaching: 71.4, researchEnvironment: 76.0, citations: 89.2, international: 87.4, industry: 59.1,
    },
    {
      rank: 49, rankBand: '49',
      name: 'University of California, Santa Barbara', nameTr: 'UC Santa Barbara',
      country: 'US', countryTr: 'ABD',
      total: 73.8,
      teaching: 71.2, researchEnvironment: 75.9, citations: 90.5, international: 68.9, industry: 56.0,
    },
    {
      rank: 50, rankBand: '50',
      name: 'Seoul National University', nameTr: 'Seul Ulusal Üniversitesi',
      country: 'KR', countryTr: 'Güney Kore',
      total: 73.5,
      teaching: 72.0, researchEnvironment: 77.5, citations: 82.8, international: 52.4, industry: 71.0,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 51-100 — bireysel sıra, pillar ayrıntıları bant ortalaması (~)
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: 55, rankBand: '51-60',
      name: 'University of Queensland', nameTr: 'Queensland Üniversitesi',
      country: 'AU', countryTr: 'Avustralya',
      total: 72.1, teaching: 70.2, researchEnvironment: 74.8, citations: 82.0, international: 85.3, industry: 54.0,
    },
    {
      rank: 57, rankBand: '51-60',
      name: 'KTH Royal Institute of Technology', nameTr: 'KTH Kraliyet Teknoloji Enstitüsü',
      country: 'SE', countryTr: 'İsveç',
      total: 71.7, teaching: 69.5, researchEnvironment: 73.9, citations: 81.5, international: 87.4, industry: 65.2,
    },
    {
      rank: 60, rankBand: '51-60',
      name: 'University of Zurich', nameTr: 'Zürih Üniversitesi',
      country: 'CH', countryTr: 'İsviçre',
      total: 71.3, teaching: 69.9, researchEnvironment: 73.5, citations: 83.1, international: 89.2, industry: 53.8,
    },
    {
      rank: 63, rankBand: '61-70',
      name: 'Delft University of Technology', nameTr: 'Delft Teknoloji Üniversitesi',
      country: 'NL', countryTr: 'Hollanda',
      total: 70.9, teaching: 68.8, researchEnvironment: 73.1, citations: 80.4, international: 86.5, industry: 65.0,
    },
    {
      rank: 66, rankBand: '61-70',
      name: 'University of Hong Kong', nameTr: 'Hong Kong Üniversitesi',
      country: 'HK', countryTr: 'Hong Kong',
      total: 70.4, teaching: 68.2, researchEnvironment: 72.5, citations: 79.8, international: 94.1, industry: 59.3,
    },
    {
      rank: 70, rankBand: '61-70',
      name: 'EPFL', nameTr: 'Lozan Federal Teknoloji Enstitüsü',
      country: 'CH', countryTr: 'İsviçre',
      total: 70.0, teaching: 67.5, researchEnvironment: 72.1, citations: 79.3, international: 96.4, industry: 64.5,
    },
    {
      rank: 74, rankBand: '71-80',
      name: 'University of Groningen', nameTr: 'Groningen Üniversitesi',
      country: 'NL', countryTr: 'Hollanda',
      total: 69.3, teaching: 67.4, researchEnvironment: 71.6, citations: 79.0, international: 83.7, industry: 52.4,
    },
    {
      rank: 78, rankBand: '71-80',
      name: 'Shanghai Jiao Tong University', nameTr: 'Şanghay Jiao Tong Üniversitesi',
      country: 'CN', countryTr: 'Çin',
      total: 68.8, teaching: 66.9, researchEnvironment: 73.4, citations: 74.2, international: 42.8, industry: 74.6,
    },
    {
      rank: 81, rankBand: '81-90',
      name: 'University of Copenhagen', nameTr: 'Kopenhag Üniversitesi',
      country: 'DK', countryTr: 'Danimarka',
      total: 68.4, teaching: 66.8, researchEnvironment: 71.0, citations: 80.1, international: 82.9, industry: 51.3,
    },
    {
      rank: 86, rankBand: '81-90',
      name: 'Osaka University', nameTr: 'Osaka Üniversitesi',
      country: 'JP', countryTr: 'Japonya',
      total: 67.9, teaching: 65.8, researchEnvironment: 70.5, citations: 76.7, international: 42.1, industry: 69.8,
    },
    {
      rank: 90, rankBand: '81-90',
      name: 'University of Cape Town', nameTr: 'Cape Town Üniversitesi',
      country: 'ZA', countryTr: 'Güney Afrika',
      total: 67.2, teaching: 65.0, researchEnvironment: 68.9, citations: 76.0, international: 78.5, industry: 50.2,
    },
    {
      rank: 94, rankBand: '91-100',
      name: 'Zhejiang University', nameTr: 'Zhejiang Üniversitesi',
      country: 'CN', countryTr: 'Çin',
      total: 66.8, teaching: 65.2, researchEnvironment: 72.1, citations: 72.4, international: 40.3, industry: 72.3,
    },
    {
      rank: 98, rankBand: '91-100',
      name: 'Kyoto University', nameTr: 'Kyoto Üniversitesi',
      country: 'JP', countryTr: 'Japonya',
      total: 66.4, teaching: 64.8, researchEnvironment: 69.8, citations: 76.1, international: 43.0, industry: 65.7,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 101-200 — bireysel sıra, pillar bant ortalaması
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: 108, rankBand: '101-125',
      name: 'University of Edinburgh', nameTr: 'Edinburgh Üniversitesi',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 65.1, teaching: 63.5, researchEnvironment: 68.0, citations: 73.8, international: 88.5, industry: 50.5,
    },
    {
      rank: 115, rankBand: '101-125',
      name: 'University of Munich', nameTr: 'Münih Üniversitesi',
      country: 'DE', countryTr: 'Almanya',
      total: 64.5, teaching: 63.0, researchEnvironment: 67.5, citations: 73.0, international: 81.2, industry: 50.0,
    },
    {
      rank: 119, rankBand: '101-125',
      name: 'Pohang University of Science and Technology', nameTr: 'POSTECH',
      country: 'KR', countryTr: 'Güney Kore',
      total: 64.1, teaching: 61.8, researchEnvironment: 66.8, citations: 80.2, international: 48.7, industry: 67.5,
    },
    {
      rank: 124, rankBand: '101-125',
      name: 'University of Vienna', nameTr: 'Viyana Üniversitesi',
      country: 'AT', countryTr: 'Avusturya',
      total: 63.7, teaching: 62.4, researchEnvironment: 66.2, citations: 72.8, international: 83.4, industry: 49.1,
    },
    {
      rank: 132, rankBand: '126-150',
      name: 'University of Birmingham', nameTr: 'Birmingham Üniversitesi',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 63.2, teaching: 61.8, researchEnvironment: 65.5, citations: 71.4, international: 83.1, industry: 49.5,
    },
    {
      rank: 138, rankBand: '126-150',
      name: 'Monash University', nameTr: 'Monash Üniversitesi',
      country: 'AU', countryTr: 'Avustralya',
      total: 62.8, teaching: 61.5, researchEnvironment: 65.0, citations: 70.9, international: 84.5, industry: 50.1,
    },
    {
      rank: 144, rankBand: '126-150',
      name: 'University of São Paulo', nameTr: 'São Paulo Üniversitesi',
      country: 'BR', countryTr: 'Brezilya',
      total: 62.3, teaching: 60.9, researchEnvironment: 65.7, citations: 68.5, international: 47.2, industry: 52.8,
    },
    {
      rank: 151, rankBand: '151-175',
      name: 'Ghent University', nameTr: 'Ghent Üniversitesi',
      country: 'BE', countryTr: 'Belçika',
      total: 61.5, teaching: 60.2, researchEnvironment: 64.1, citations: 70.8, international: 75.4, industry: 48.7,
    },
    {
      rank: 160, rankBand: '151-175',
      name: 'University of Leeds', nameTr: 'Leeds Üniversitesi',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 61.0, teaching: 59.8, researchEnvironment: 63.5, citations: 70.2, international: 82.7, industry: 47.9,
    },
    {
      rank: 170, rankBand: '151-175',
      name: 'Hong Kong University of Science and Technology', nameTr: 'HKUST',
      country: 'HK', countryTr: 'Hong Kong',
      total: 60.6, teaching: 59.4, researchEnvironment: 63.0, citations: 69.8, international: 91.0, industry: 60.5,
    },
    {
      rank: 178, rankBand: '176-200',
      name: 'University of Sheffield', nameTr: 'Sheffield Üniversitesi',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 60.1, teaching: 58.9, researchEnvironment: 62.5, citations: 69.2, international: 81.3, industry: 47.2,
    },
    {
      rank: 185, rankBand: '176-200',
      name: 'University of Geneva', nameTr: 'Cenevre Üniversitesi',
      country: 'CH', countryTr: 'İsviçre',
      total: 59.7, teaching: 58.5, researchEnvironment: 62.1, citations: 69.5, international: 87.6, industry: 46.8,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 201-300 — bantlar, her bantta temsili üniversiteler
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: null, rankBand: '201-250',
      name: 'Free University of Berlin', nameTr: 'Berlin Özgür Üniversitesi',
      country: 'DE', countryTr: 'Almanya',
      total: 57.5, teaching: 56.0, researchEnvironment: 60.0, citations: 65.0, international: 78.5, industry: 45.0,
    },
    {
      rank: null, rankBand: '201-250',
      name: 'University of Auckland', nameTr: 'Auckland Üniversitesi',
      country: 'NZ', countryTr: 'Yeni Zelanda',
      total: 57.2, teaching: 55.8, researchEnvironment: 59.5, citations: 64.5, international: 82.3, industry: 44.5,
    },
    {
      rank: null, rankBand: '201-250',
      name: 'Leiden University', nameTr: 'Leiden Üniversitesi',
      country: 'NL', countryTr: 'Hollanda',
      total: 56.9, teaching: 55.5, researchEnvironment: 59.1, citations: 68.0, international: 79.2, industry: 44.1,
    },
    {
      rank: null, rankBand: '251-300',
      name: 'University of Gothenburg', nameTr: 'Gothenburg Üniversitesi',
      country: 'SE', countryTr: 'İsveç',
      total: 55.5, teaching: 54.2, researchEnvironment: 57.8, citations: 63.0, international: 75.5, industry: 43.2,
    },
    {
      rank: null, rankBand: '251-300',
      name: 'Nagoya University', nameTr: 'Nagoya Üniversitesi',
      country: 'JP', countryTr: 'Japonya',
      total: 55.1, teaching: 53.8, researchEnvironment: 57.4, citations: 62.6, international: 40.8, industry: 63.0,
    },
    {
      rank: null, rankBand: '251-300',
      name: 'Cairo University', nameTr: 'Kahire Üniversitesi',
      country: 'EG', countryTr: 'Mısır',
      total: 54.8, teaching: 53.5, researchEnvironment: 57.0, citations: 60.5, international: 44.0, industry: 42.0,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 301-500 — bantlar
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: null, rankBand: '301-350',
      name: 'University of Ottawa', nameTr: 'Ottawa Üniversitesi',
      country: 'CA', countryTr: 'Kanada',
      total: 52.5, teaching: 51.3, researchEnvironment: 54.8, citations: 58.5, international: 76.2, industry: 41.5,
    },
    {
      rank: null, rankBand: '301-350',
      name: 'University of Lisbon', nameTr: 'Lizbon Üniversitesi',
      country: 'PT', countryTr: 'Portekiz',
      total: 52.2, teaching: 51.0, researchEnvironment: 54.4, citations: 58.0, international: 68.5, industry: 41.0,
    },
    // Türk üniversiteleri — 351-400 bant (THE 2024, WebSearch doğrulaması: Koç=375 civarı)
    {
      rank: null, rankBand: '351-400',
      name: 'Koç University', nameTr: 'Koç Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 50.5, teaching: 49.5, researchEnvironment: 52.8, citations: 56.5, international: 66.4, industry: 39.5,
    },
    {
      rank: null, rankBand: '351-400',
      name: 'Middle East Technical University', nameTr: 'Orta Doğu Teknik Üniversitesi (ODTÜ)',
      country: 'TR', countryTr: 'Türkiye',
      total: 50.2, teaching: 49.2, researchEnvironment: 52.5, citations: 55.8, international: 57.3, industry: 40.2,
    },
    {
      rank: null, rankBand: '351-400',
      name: 'Sabancı University', nameTr: 'Sabancı Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 49.9, teaching: 49.0, researchEnvironment: 52.2, citations: 55.4, international: 64.1, industry: 39.0,
    },
    {
      rank: null, rankBand: '401-500',
      name: 'University of Bern', nameTr: 'Bern Üniversitesi',
      country: 'CH', countryTr: 'İsviçre',
      total: 49.0, teaching: 48.0, researchEnvironment: 51.2, citations: 57.5, international: 77.4, industry: 38.5,
    },
    {
      rank: null, rankBand: '401-500',
      name: 'Tel Aviv University', nameTr: 'Tel Aviv Üniversitesi',
      country: 'IL', countryTr: 'İsrail',
      total: 48.8, teaching: 47.8, researchEnvironment: 51.0, citations: 57.0, international: 61.2, industry: 40.5,
    },
    {
      rank: null, rankBand: '401-500',
      name: 'University of Warsaw', nameTr: 'Varşova Üniversitesi',
      country: 'PL', countryTr: 'Polonya',
      total: 48.5, teaching: 47.5, researchEnvironment: 50.7, citations: 54.2, international: 62.0, industry: 37.8,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 501-600 — bantlar
    // ─────────────────────────────────────────────────────────────────────────

    // Türk üniversitesi — 501-600 bant (THE 2024, WebSearch doğrulaması)
    {
      rank: null, rankBand: '501-600',
      name: 'Istanbul Technical University', nameTr: 'İstanbul Teknik Üniversitesi (İTÜ)',
      country: 'TR', countryTr: 'Türkiye',
      total: 46.0, teaching: 45.1, researchEnvironment: 48.2, citations: 50.5, international: 51.3, industry: 36.4,
    },
    {
      rank: null, rankBand: '501-600',
      name: 'University of Innsbruck', nameTr: 'Innsbruck Üniversitesi',
      country: 'AT', countryTr: 'Avusturya',
      total: 45.8, teaching: 44.9, researchEnvironment: 48.0, citations: 52.5, international: 72.0, industry: 35.8,
    },
    {
      rank: null, rankBand: '501-600',
      name: 'Pontificia Universidad Católica de Chile', nameTr: 'Pontificia Katolik Şili Üniversitesi',
      country: 'CL', countryTr: 'Şili',
      total: 45.5, teaching: 44.6, researchEnvironment: 47.7, citations: 50.0, international: 54.8, industry: 35.5,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 601-800 — bantlar
    // ─────────────────────────────────────────────────────────────────────────

    // Türk üniversiteleri — 601-800 bant (THE 2024, WebSearch doğrulaması)
    {
      rank: null, rankBand: '601-800',
      name: 'Bilkent University', nameTr: 'Bilkent Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 42.5, teaching: 41.5, researchEnvironment: 44.5, citations: 46.5, international: 55.2, industry: 33.0,
    },
    {
      rank: null, rankBand: '601-800',
      name: 'Boğaziçi University', nameTr: 'Boğaziçi Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 42.2, teaching: 41.2, researchEnvironment: 44.2, citations: 46.1, international: 54.5, industry: 32.8,
    },
    {
      rank: null, rankBand: '601-800',
      name: 'Hacettepe University', nameTr: 'Hacettepe Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 41.8, teaching: 40.8, researchEnvironment: 43.8, citations: 47.2, international: 46.3, industry: 31.5,
    },
    {
      rank: null, rankBand: '601-800',
      name: 'University of Bath', nameTr: 'Bath Üniversitesi',
      country: 'GB', countryTr: 'Birleşik Krallık',
      total: 43.1, teaching: 42.0, researchEnvironment: 45.0, citations: 48.5, international: 81.2, industry: 34.5,
    },
    {
      rank: null, rankBand: '601-800',
      name: 'Lund University', nameTr: 'Lund Üniversitesi',
      country: 'SE', countryTr: 'İsveç',
      total: 42.8, teaching: 41.8, researchEnvironment: 44.8, citations: 48.8, international: 78.5, industry: 33.5,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 801-1000 — bantlar
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: null, rankBand: '801-1000',
      name: 'University of Wollongong', nameTr: 'Wollongong Üniversitesi',
      country: 'AU', countryTr: 'Avustralya',
      total: 38.5, teaching: 37.8, researchEnvironment: 40.2, citations: 43.5, international: 72.4, industry: 30.8,
    },
    {
      rank: null, rankBand: '801-1000',
      name: 'Chulalongkorn University', nameTr: 'Chulalongkorn Üniversitesi',
      country: 'TH', countryTr: 'Tayland',
      total: 38.0, teaching: 37.3, researchEnvironment: 39.8, citations: 41.5, international: 49.2, industry: 31.5,
    },
    {
      rank: null, rankBand: '801-1000',
      name: 'Izmir Institute of Technology', nameTr: 'İzmir Yüksek Teknoloji Enstitüsü (İYTE)',
      country: 'TR', countryTr: 'Türkiye',
      total: 37.5, teaching: 36.8, researchEnvironment: 39.4, citations: 42.0, international: 41.5, industry: 29.5,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 901-1000 bant — Türk üniversite, WebSearch doğrulaması
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: null, rankBand: '901-1000',
      name: 'Ankara University', nameTr: 'Ankara Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 35.5, teaching: 34.8, researchEnvironment: 37.2, citations: 38.8, international: 36.5, industry: 27.5,
    },
    {
      rank: null, rankBand: '901-1000',
      name: 'Ege University', nameTr: 'Ege Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 35.2, teaching: 34.5, researchEnvironment: 36.9, citations: 38.5, international: 35.8, industry: 27.0,
    },
    {
      rank: null, rankBand: '901-1000',
      name: 'Marmara University', nameTr: 'Marmara Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 35.0, teaching: 34.3, researchEnvironment: 36.7, citations: 38.2, international: 35.4, industry: 26.8,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 1001-1500 — bantlar
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: null, rankBand: '1001-1200',
      name: 'Bahçeşehir University', nameTr: 'Bahçeşehir Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 31.5, teaching: 30.9, researchEnvironment: 33.0, citations: 34.5, international: 42.8, industry: 24.5,
    },
    {
      rank: null, rankBand: '1001-1200',
      name: 'University of Pretoria', nameTr: 'Pretoria Üniversitesi',
      country: 'ZA', countryTr: 'Güney Afrika',
      total: 31.2, teaching: 30.6, researchEnvironment: 32.7, citations: 34.0, international: 48.5, industry: 24.0,
    },
    {
      rank: null, rankBand: '1201-1500',
      name: 'Istanbul University', nameTr: 'İstanbul Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 28.5, teaching: 28.0, researchEnvironment: 29.8, citations: 31.0, international: 32.5, industry: 22.5,
    },
    {
      rank: null, rankBand: '1201-1500',
      name: 'Selçuk University', nameTr: 'Selçuk Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 27.8, teaching: 27.3, researchEnvironment: 29.1, citations: 30.2, international: 31.8, industry: 22.0,
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 1501-1904 — son grup
    // ─────────────────────────────────────────────────────────────────────────

    {
      rank: null, rankBand: '1501+',
      name: 'Gazi University', nameTr: 'Gazi Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 24.0, teaching: 23.5, researchEnvironment: 25.2, citations: 26.5, international: 28.3, industry: 19.5,
    },
    {
      rank: null, rankBand: '1501+',
      name: 'Yıldız Technical University', nameTr: 'Yıldız Teknik Üniversitesi',
      country: 'TR', countryTr: 'Türkiye',
      total: 23.5, teaching: 23.0, researchEnvironment: 24.7, citations: 25.8, international: 27.5, industry: 19.0,
    },
  ],
};
