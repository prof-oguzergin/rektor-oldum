/**
 * Rektör Oldum: Bina Sayfası (v0.7.2)
 *
 * Bir binanın ne işe yaradığı, kapasitesi ve kullanımı, bölümleri, oyundaki gerçek etkisi,
 * bakım gideri, sonraki düzeyi ve işlemleri. Geniş pencerede açılır: bina kartına ya da
 * kartın "Ayrıntılar" düğmesine tıklayınca, data-bina-git="<bina kimliği>" taşıyan her öğeden
 * ve haritadan (window._binaSayfasiniAc) gelinir.
 *
 * Bu modül game.js'i içe aktarmaz. Durum (getState kopyası), biçim ve pencere yardımcıları
 * (ui.js) ve kararlar (main.js) parametre olarak gelir. Sayıların hepsi oyunun kendi hesabının
 * aynısıyla bulunur; her hesabın yanında kaynağı yazılı. Kaynak değişirse burası da değişmeli.
 * Bakım gideri ve teknokent geliri economy.js'in kendi işlevleriyle (binaDonemBakimi, teknokentGeliri)
 * hesaplanır. data.js'teki effects / qualityEffects alanları oyunda kullanılmadığı için burada okunmaz.
 *
 * v0.7.2 doğruluk: binaların etki metninin tek kaynağı burası (binaEtkiOzeti, binaKartEtkileri,
 * yukseltmeEtkisi); bina kartı, inşaat seçenekleri, inşaat ve yükseltme onayları bunları kullanır.
 */

import { BUILDINGS, DIFFICULTY_SETTINGS, ACCREDITATION_BODIES } from './data.js?v=0.7.2';
import { binaDonemBakimi, teknokentGeliri } from './economy.js?v=0.7.2';

// ─────────────────────────────────────────────────────────────────────────────
// OYUNUN SABİTLERİ (kaynaktaki değerlerin aynısı)
// ─────────────────────────────────────────────────────────────────────────────

export const SINIF_SAYISI = 4;       // game.js SINIF_SAYISI: bir koltuk bir yıllık alım, dört sınıf
const YEDEK_KOLTUK       = 40;       // game.js YEDEK_KOLTUK: dersliği olmayan bölüm tek derslik sayılır
const MERKEZ_ARTISI      = 0.15;     // game.js _getResearchCenterBonus: merkez başına
const MERKEZ_TAVANI      = 1.30;     // game.js _getResearchCenterBonus: üst sınır
const LAB_ODA_BASINA_OGRENCI = 60;   // game.js LAB_ODA_BASINA_OGRENCI: bir oda 60 öğrenciye yeter
const LAB_PUAN_TABANI    = 30;       // game.js LAB_PUAN_TABANI: oda ayrılmamış bölümün puanı
const LAB_PUAN_ARALIGI   = 70;       // game.js LAB_PUAN_ARALIGI: tam karşılamada eklenen
/** game.js LAB_GEREKSINIM_ESIGI: labRequirement bu ve üstündeyse bölüm laboratuvar gerektirir. */
export const LAB_GEREKSINIM_ESIGI = 2;
const KARIYER_TEKNOKENT  = 15;       // students.js calculateStudentSatisfaction: teknokent Kariyer Desteği puanına

/** Öğrenci memnuniyeti bileşenlerinin ağırlığı (students.js calculateStudentSatisfaction). */
const MEMNUNIYET_AGIRLIGI = { sosyal: 0.10, yurt: 0.10, yemek: 0.07, spor: 0.05, ulasim: 0.05, kariyer: 0.09, idari: 0.12 };

/** Türün bir satırlık işlevi (ne işe yarar). data.js açıklamaları oyunda olmayan etkiler yazdığı için kullanılmaz. */
const ISLEV = {
  fakulte_binasi:    'Derslik ve ofis binası. Derslikleri bölümlerin öğrenci kapasitesini belirler.',
  amfi:              'Büyük derslikler. Koltukları bölümlerin öğrenci kapasitesine eklenir.',
  arastirma_merkezi: 'Bağlı bölümlerin yayın ve proje başarısını artırır, laboratuvar odası sağlar. Dersliği yok.',
  lab:               'Laboratuvar odaları. Laboratuvar gerektiren bağlı bölümler odaları ihtiyaca göre paylaşır, laboratuvar puanları buna göre yükselir.',
  kutuphane:         'Yerleşkenin çalışma alanı. Sosyal Yaşam puanını artırır.',
  yurt:              'Öğrenci yatakları. Yurt İmkânı puanını artırır.',
  yemekhane:         'Öğrenci ve hocalara günlük öğün. Yemekhane puanını artırır.',
  spor_tesisi:       'Spor alanı. Spor Tesisleri puanını artırır, takım kurmayı açar.',
  konferans:         'Etkinlik ve konferans merkezi. Uluslararasılaşma puanını artırır.',
  saglik_merkezi:    'Öğrenci ve personele sağlık hizmeti. İdari Hizmetler puanını artırır.',
  idari_bina:        'Rektörlük ve idari birimler. İdari Hizmetler puanını artırır.',
  teknokent:         'Girişimcilik ve sanayi binası. Bitince bütçeye dönemlik sponsorluk geliri girer, Kariyer Desteği puanı artar.',
  ulasim_merkezi:    'Ring ve servis durağı. Ulaşım puanını artırır.',
};

/** Bölüm laboratuvar gerektiriyor mu: labRequirement 2 ve üstü (game.js _labGerekir ile aynı). */
export function labGerekir(d) {
  return (Number(d?.labRequirement) || 0) >= LAB_GEREKSINIM_ESIGI;
}

/** Metin içinde sayı: Türkçe binlik ayırıcıyla ("2.000.000"). */
const tr = (v) => Math.round(Number(v) || 0).toLocaleString('tr-TR');

/** Türün düzey 1'deki laboratuvar odası ve düzey başına artışı (data.js). */
function labOdaTanimi(tur) {
  const t = BUILDINGS[tur];
  return { ilk: t?.capacity?.labs || 0, artis: t?.capacityPerLevel?.labs || 0 };
}

/** Laboratuvar şartı olan akreditasyonlar: "MÜDEK 2, ABET 3" (data.js ACCREDITATION_BODIES). */
function labSartlari() {
  return Object.values(ACCREDITATION_BODIES)
    .filter(k => k.requirements?.minLabCount != null)
    .map(k => `${k.name} ${k.requirements.minLabCount}`).join(', ');
}

/** Teknokentin gelir kuralı (economy.js teknokentGeliri): temel tutar ve öğrenci başına tutar. */
function teknokentKurali() {
  const temel = teknokentGeliri({ university: { prestige: 0 }, students: { totalEnrolled: 0 } });
  const tek   = teknokentGeliri({ university: { prestige: 0 }, students: { totalEnrolled: 1 } });
  const puan  = teknokentGeliri({ university: { prestige: 100 }, students: { totalEnrolled: 0 } });
  return { temel: temel.toplam, ogrenciBasina: tek.ogrenci, puanBasina: puan.baglantiPuani > 0 ? puan.baglanti / puan.baglantiPuani : 0 };
}

/**
 * Türün oyundaki etkisinin kısa dökümü: inşaat seçeneği kartı, inşaat onayı ve bina kartı (ui.js)
 * bunu gösterir. Bina Sayfası'ndaki ayrıntılı etkiyle aynı içerik; her madde oyunun hesabından.
 * @param {string} tur
 * @returns {string[]}
 */
export function binaEtkiOzeti(tur) {
  switch (tur) {
    case 'fakulte_binasi':
    case 'amfi':
      return ['Derslikleri bölümlerin öğrenci kapasitesini ve yeni alımını belirler (koltuk × 4 sınıf)'];
    case 'arastirma_merkezi': {
      const o = labOdaTanimi(tur);
      return [
        'Bağlı bölümde yayın beklentisi ×1,15',
        'Bağlı bölümde dış proje kabul olasılığı ×1,15',
        `Laboratuvar odalarını, laboratuvar gerektiren bağlı bölümler ihtiyaçları oranında paylaşır. Her düzey +${o.artis} oda ekler`,
      ];
    }
    case 'lab': {
      const o = labOdaTanimi(tur);
      return [
        `Odalarını, laboratuvar gerektiren bağlı bölümler ihtiyaçları oranında paylaşır. Her ${LAB_ODA_BASINA_OGRENCI} öğrenciye bir oda gerekir, her düzey +${o.artis} oda ekler`,
        `Bölümün laboratuvar puanı ${LAB_PUAN_TABANI} + ${LAB_PUAN_ARALIGI} × karşılama (yayın beklentisi ve akreditasyon)`,
      ];
    }
    case 'kutuphane':
      return ['Sosyal Yaşam puanına en çok +20 (öğrenci memnuniyeti)'];
    case 'yurt':
      return ['Yurt İmkânı puanına en çok +55 (öğrenci memnuniyeti)'];
    case 'yemekhane':
      return ['Yemekhane puanına en çok +39,6 (öğrenci memnuniyeti)'];
    case 'spor_tesisi':
      return ['Spor Tesisleri puanına en çok +33,6 (öğrenci memnuniyeti)', 'Basketbol, futbol, voleybol ve yüzme takımı kurmayı açar', 'Takımların maç gücüne +15'];
    case 'konferans':
      return ['Uluslararasılaşma puanına +15 (kalite ve saygınlık)', 'Sosyal Yaşam puanına +8 (öğrenci memnuniyeti)', 'Uluslararası sıralamada görünüm puanına +12'];
    case 'saglik_merkezi':
      return ['Sağlık hizmeti puanına +12 (öğrenci memnuniyeti)'];
    case 'idari_bina':
      return ['İdari Hizmetler puanına düzeye göre +6, +10, +14 (öğrenci memnuniyeti)'];
    case 'ulasim_merkezi':
      return ['Ulaşım puanına düzeye göre +12, +18, +24 (öğrenci memnuniyeti)'];
    case 'teknokent': {
      const k = teknokentKurali();
      return [
        `Her dönem sponsorluk geliri (${tr(k.temel)} ₺, öğrenci başına ${tr(k.ogrenciBasina)} ₺ ve saygınlığa bağlı sanayi bağlantısı)`,
        `Kariyer Desteği puanına +${KARIYER_TEKNOKENT} (öğrenci memnuniyeti)`,
      ];
    }
    default:
      return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HESAPLAR (oyundaki karşılıklarının aynısı)
// ─────────────────────────────────────────────────────────────────────────────

/** Bölümün dört sınıftaki öğrenci sayısı (game.js _updateDeptCapacities talebi). */
function bolumOgrencisi(state, id) {
  const bd = state?.students?.byDepartment?.[id] || {};
  return (bd.year1?.count || 0) + (bd.year2?.count || 0) + (bd.year3?.count || 0) + (bd.year4?.count || 0);
}

/** Toplam öğrenci (students.js getTotalEnrolled: byDepartment'taki bütün bölümler). */
export function toplamOgrenci(state) {
  let toplam = 0;
  for (const bd of Object.values(state?.students?.byDepartment || {})) {
    toplam += (bd?.year1?.count ?? 0) + (bd?.year2?.count ?? 0) + (bd?.year3?.count ?? 0) + (bd?.year4?.count ?? 0);
  }
  return toplam;
}

/** Düzeye göre derslik büyüklüğü (game.js _binaKoltugu). */
export function derslikBoyu(tanim, duzey) {
  const tablo = tanim?.classroomSizeByLevel;
  return tablo ? (tablo[duzey] ?? tablo[1] ?? tanim?.classroomSize ?? 40) : (tanim?.classroomSize ?? 40);
}

/** Düzeydeki kapasite: temel + düzey başına artış × (düzey - 1) (game.js _buildingCapacityAtLevel). */
export function duzeyKapasitesi(tanim, duzey) {
  if (!tanim?.capacity) return {};
  const artis = tanim.capacityPerLevel || {};
  const sonuc = {};
  for (const k of Object.keys(tanim.capacity)) sonuc[k] = (tanim.capacity[k] || 0) + (artis[k] || 0) * (duzey - 1);
  return sonuc;
}

/** Binanın derslik koltuğu: derslik × derslik büyüklüğü (game.js _binaKoltugu). */
export function binaKoltugu(b) {
  const derslik = b?.currentCapacity?.classrooms || 0;
  if (derslik <= 0) return 0;
  return derslik * derslikBoyu(BUILDINGS[b.type], b.level || 1);
}

/** Kaynağı taleplere böler (game.js _adilPaylastir ile aynı). */
function adilPaylastir(kaynak, talepler) {
  const sonuc = new Map();
  const idler = [...talepler.keys()];
  if (idler.length === 0) return sonuc;
  const toplam = idler.reduce((s, id) => s + Math.max(0, talepler.get(id) || 0), 0);
  if (toplam <= 0) {
    idler.forEach(id => sonuc.set(id, kaynak / idler.length));
  } else if (toplam <= kaynak) {
    idler.forEach(id => sonuc.set(id, kaynak * Math.max(0, talepler.get(id) || 0) / toplam));
  } else {
    const sirali = idler.slice().sort((a, b) => (talepler.get(a) || 0) - (talepler.get(b) || 0));
    let kalan = kaynak;
    sirali.forEach((id, i) => {
      const ver = Math.min(Math.max(0, talepler.get(id) || 0), kalan / (sirali.length - i));
      sonuc.set(id, ver);
      kalan -= ver;
    });
  }
  return sonuc;
}

/**
 * Derslik koltuklarının bölümlere dağılımı, bina bina (game.js _updateDeptCapacities'in aynısı).
 * Atanmış binanın koltukları o binanın bölümlerinindir; hiçbir bölüme atanmamış binalar
 * kendine derslik binası olmayan bölümlerin ortak alanıdır. Pay dört sınıflık yerdir (koltuk × 4).
 * @returns {{ talep: Map, binaPaylari: Map<string, {koltuk, ortak, satirlar: {id, talep, pay}[]}>,
 *            bolumKapasitesi: Map<string, {kapasite, kaynak}>, bolumBinalari: Map<string, string[]>,
 *            ortakKoltuk: number, ortakBinaSayisi: number }}
 */
export function kapasiteDagilimi(state) {
  const acik = (state?.departments || []).filter(d => d && d.id && d.isOpen !== false);
  const talep = new Map(acik.map(d => [d.id, bolumOgrencisi(state, d.id)]));
  const atanmis = [];
  const ortakBinalar = [];
  let ortakKoltuk = 0;
  for (const b of state?.buildings || []) {
    if (!b?.isCompleted) continue;
    const koltuk = binaKoltugu(b);
    if (koltuk <= 0) continue;
    const kullanan = [...new Set((b.assignedDepartments || []).filter(id => talep.has(id)))];
    if (kullanan.length === 0) { ortakKoltuk += koltuk; ortakBinalar.push({ bina: b, koltuk }); }
    else atanmis.push({ bina: b, koltuk, kullanan });
  }

  // Birden çok binaya atanmış bölümün talebi binalar arasında koltuk oranında bölünür
  const bolumKoltugu = new Map();
  const bolumBinalari = new Map();
  for (const { bina, koltuk, kullanan } of atanmis) {
    for (const id of kullanan) {
      bolumKoltugu.set(id, (bolumKoltugu.get(id) || 0) + koltuk);
      bolumBinalari.set(id, [...(bolumBinalari.get(id) || []), bina.id]);
    }
  }
  const pay = new Map(acik.map(d => [d.id, 0]));
  const binaPaylari = new Map();
  for (const { bina, koltuk, kullanan } of atanmis) {
    const binaTalebi = new Map(kullanan.map(id => [id, talep.get(id) * koltuk / bolumKoltugu.get(id)]));
    const paylar = adilPaylastir(koltuk * SINIF_SAYISI, binaTalebi);
    const satirlar = kullanan.map(id => ({ id, talep: binaTalebi.get(id), pay: paylar.get(id) || 0 }));
    for (const s of satirlar) pay.set(s.id, pay.get(s.id) + s.pay);
    binaPaylari.set(bina.id, { koltuk, ortak: false, satirlar });
  }
  // Ortak derslikler kendine bina atanmamış bölümlerindir; her ortak bina koltuğu oranında pay taşır
  const binasiz = acik.filter(d => !bolumKoltugu.has(d.id)).map(d => d.id);
  const ortakPay = (ortakKoltuk > 0 && binasiz.length > 0)
    ? adilPaylastir(ortakKoltuk * SINIF_SAYISI, new Map(binasiz.map(id => [id, talep.get(id)])))
    : new Map();
  for (const [id, v] of ortakPay) pay.set(id, pay.get(id) + v);
  for (const { bina, koltuk } of ortakBinalar) {
    const oran = koltuk / ortakKoltuk;
    binaPaylari.set(bina.id, {
      koltuk, ortak: true,
      satirlar: ortakPay.size ? binasiz.map(id => ({ id, talep: talep.get(id) * oran, pay: (ortakPay.get(id) || 0) * oran })) : [],
    });
  }

  const bolumKapasitesi = new Map();
  for (const d of acik) {
    let kapasite = pay.get(d.id) || 0;
    let kaynak = bolumKoltugu.has(d.id) ? 'bina' : 'ortak';
    if (kapasite < 1) {
      kapasite = YEDEK_KOLTUK * SINIF_SAYISI;
      if (!bolumKoltugu.has(d.id) && !(ortakKoltuk > 0)) kaynak = 'yedek';
    }
    bolumKapasitesi.set(d.id, { kapasite: Math.max(1, Math.round(kapasite)), kaynak });
  }
  return { talep, binaPaylari, bolumKapasitesi, bolumBinalari, ortakKoltuk, ortakBinaSayisi: ortakBinalar.length };
}

const yuvarla2 = x => Math.round((Number(x) || 0) * 100) / 100;   // game.js _yuvarla2

/** Binanın laboratuvar odası: düzeyine göre; currentCapacity.labs yoksa tanımdan (game.js _labOdasi). */
function labOdasi(b) {
  const oda = Number(b?.currentCapacity?.labs);
  if (b?.currentCapacity && Number.isFinite(oda)) return Math.max(0, oda);
  const tanim = BUILDINGS[b?.type];
  return tanim?.capacity ? Math.max(0, duzeyKapasitesi(tanim, b.level || 1).labs || 0) : 0;
}

/** Binanın odalarını kullanabilen bölümler: Laboratuvarda bağlananlar, öteki binalarda atananlar (game.js _labKullananlari). */
function labKullananlari(b) {
  return (b?.type === 'lab' ? b.linkedDepartments : b?.assignedDepartments) || [];
}

/**
 * Laboratuvar odalarının bölümlere dağılımı (game.js _labDagilimi'nin aynısı): laboratuvar gerektiren
 * bölümün ihtiyacı her 60 öğrenciye bir oda; her bina odalarını bağlı bölümlerin kalan ihtiyacı oranında
 * böler, ihtiyaçtan fazla vermez; az tüketicili bina önce dağıtılır. Durumu değiştirmez.
 * degisen = { id, oda } verilirse o binanın oda sayısı yerine verilen sayılır (yükseltme sonrası).
 * @returns {{ bolumler: Map<string, { ihtiyac, ayrilan, bagli, karsilama }>,
 *            binalar: Map<string, { oda, paylar: Object<string, number>, kullanilan }> }}
 */
export function labDagilimi(state, degisen = null) {
  const bolumler = new Map();
  for (const d of state?.departments || []) {
    if (!d || !d.id || d.isOpen === false) continue;
    const ihtiyac = labGerekir(d) ? Math.ceil(bolumOgrencisi(state, d.id) / LAB_ODA_BASINA_OGRENCI) : 0;
    bolumler.set(d.id, { ihtiyac, kalan: ihtiyac, ayrilan: 0, bagli: false });
  }
  const binalar = [];
  (state?.buildings || []).forEach((b, sira) => {
    if (!b?.isCompleted) return;
    const oda = degisen && b.id === degisen.id ? degisen.oda : labOdasi(b);
    if (!(oda > 0)) return;
    const uyeler = [...new Set(labKullananlari(b))].filter(id => bolumler.has(id));
    uyeler.forEach(id => { bolumler.get(id).bagli = true; });
    const tuketici = uyeler.filter(id => bolumler.get(id).ihtiyac > 0);
    binalar.push({ bina: b, sira, oda, tuketici, paylar: {}, kullanilan: 0 });
  });
  const sirali = binalar.slice().sort((x, y) => (x.tuketici.length - y.tuketici.length) || (x.sira - y.sira));
  for (const x of sirali) {
    const kalanToplam = x.tuketici.reduce((s, id) => s + bolumler.get(id).kalan, 0);
    for (const id of x.tuketici) {
      const v = bolumler.get(id);
      const pay = kalanToplam <= 1e-9 ? 0
        : kalanToplam <= x.oda ? v.kalan
        : x.oda * v.kalan / kalanToplam;
      v.kalan    = Math.max(0, v.kalan - pay);
      if (v.kalan < 1e-9) v.kalan = 0;
      v.ayrilan += pay;
      x.paylar[id] = pay;
      x.kullanilan += pay;
    }
  }
  for (const v of bolumler.values()) {
    v.karsilama = v.ihtiyac > 0 ? Math.min(1, v.ayrilan / v.ihtiyac) : (v.bagli ? 1 : 0);
  }
  return { bolumler, binalar: new Map(binalar.map(x => [x.bina.id, x])) };
}

/**
 * Bölümün laboratuvar durumu: oyunun yazdığı alanlar (labIhtiyaci, labAyrilan, labKarsilama; dönem sonunda,
 * bağlamada ve yüklemede) varsa onlar, yoksa aynı kuralla hesap (dagilim: labDagilimi sonucu).
 */
function bolumLab(d, dagilim) {
  const gerek = labGerekir(d);
  const h = dagilim?.bolumler.get(d.id);
  const al = (alan, yedek) => (d?.[alan] != null && Number.isFinite(Number(d[alan])) ? Number(d[alan]) : yedek);
  return {
    gerek,
    ihtiyac:   gerek ? al('labIhtiyaci', h?.ihtiyac ?? 0) : 0,
    ayrilan:   gerek ? al('labAyrilan', h?.ayrilan ?? 0) : 0,
    karsilama: al('labKarsilama', h?.karsilama ?? 0),
  };
}

/** Binanın bir bölüme ayırdığı oda: oyunun yazdığı labPaylari, yoksa hesap. */
function binaLabPayi(b, id, dagilim) {
  if (b?.labPaylari && typeof b.labPaylari === 'object') return Number(b.labPaylari[id]) || 0;
  return dagilim?.binalar.get(b?.id)?.paylar[id] || 0;
}

/** Karşılamaya göre sınıf: %75 ve üstü iyi, %50 ve üstü uyarı, altı kritik (ui.js laboratuvar gösterimiyle aynı). */
function karsilamaTuru(k) {
  return k >= 0.75 ? 'iyi' : k >= 0.5 ? 'uyari' : 'kritik';
}

/**
 * Bölüme bağlı binanın kullanımı: derslik, ofis (game.js calculateBuildingUsage). Laboratuvar binası
 * bağlı bölümlerini (linkedDepartments), öteki binalar atanmış bölümlerini sayar. Laboratuvar odası
 * kullanımı binaKullanimi'nde, oda dağılımından.
 */
function bolumKullanimi(b, state) {
  let derslik = 0, prof = 0, dr = 0, argo = 0;
  const tanim = BUILDINGS[b.type];
  const duzey = b.level || 1;
  const liste = b.type === 'lab' ? (b.linkedDepartments || []) : (b.assignedDepartments || []);
  for (const id of liste) {
    const dept = (state.departments || []).find(d => d.id === id);
    if (!dept) continue;
    const ogrenci = bolumOgrencisi(state, id);
    const hocalar = (state.faculty || []).filter(f => (f.department || f.departmentId) === id);
    const tablo = tanim?.classroomSizeByLevel;
    const boy = tablo ? (tablo[duzey] ?? tablo[1] ?? 40) : (tanim?.classroomSize ?? 40);
    derslik += boy > 0 ? Math.ceil(ogrenci / (boy * SINIF_SAYISI)) : 0;
    prof += hocalar.filter(f => ['profesor', 'docent'].includes(f.title)).length;
    dr   += hocalar.filter(f => f.title === 'dr_ogr_uyesi').length;
    argo += hocalar.filter(f => f.title === 'argö').length;
  }
  // Ofis: Prof. ve Doç. tek ofis; boş ofis varken Dr. Öğr. Üyesi ve Arş. Gör. de tek, yetmezse ikişer ve üçer
  const ofisVar = (tanim?.capacity?.offices ?? 0) + (duzey - 1) * (tanim?.capacityPerLevel?.offices ?? 0);
  let ofis = prof;
  let bos = Math.max(0, ofisVar - ofis);
  if (dr > 0) {
    if (bos >= dr) { ofis += dr; bos -= dr; }
    else { ofis += bos + Math.ceil((dr - bos) / 2); bos = 0; }
  }
  if (argo > 0) {
    if (bos >= argo) { ofis += argo; bos -= argo; }
    else { ofis += bos + Math.ceil((argo - bos) / 3); bos = 0; }
  }
  return { classrooms: derslik, offices: ofis };
}

/**
 * Binanın oyunun hesapladığı kullanımı (game.js _updateAllBuildingUsage; oyun başında, her dönem
 * sonunda ve bölüm atanınca yazılır). Laboratuvar odası kullanımı bölümlere ayrılan oda payları
 * (game.js calculateBuildingUsage, _labDagilimi); odası olmayan binada 0. Tamamlanmamış binada null.
 */
export function binaKullanimi(state, b) {
  if (!b?.isCompleted) return null;
  const ogrenci = toplamOgrenci(state);
  const hoca = (state.faculty || []).length;
  const kap = b.currentCapacity || {};
  switch (b.type) {
    case 'yurt':        return { beds: Math.min(kap.beds || 0, Math.round(ogrenci * 0.40)) };
    case 'yemekhane':   return { dailyMeals: Math.min(kap.dailyMeals || 0, ogrenci + hoca) };
    case 'kutuphane':   return { simultaneous: Math.min(kap.simultaneous || 0, Math.round(ogrenci * 0.25)), daily: Math.min(kap.daily || 0, ogrenci) };
    case 'spor_tesisi': return { dailyUsers: Math.min(kap.dailyUsers || 0, Math.round(ogrenci * 0.60)) };
    default: {
      const lab = labDagilimi(state).binalar.get(b.id);
      return { ...bolumKullanimi(b, state), labs: lab ? yuvarla2(lab.kullanilan) : 0 };
    }
  }
}

/**
 * Zorluğun gider ve gelir çarpanı (economy.js calculateEconomy; Bütçe sekmesi aynı çarpanla gösterir).
 * @returns {{ gider: number, gelir: number, ad: string }}
 */
export function zorlukCarpani(state) {
  const d = DIFFICULTY_SETTINGS[state?.meta?.difficulty || 'normal'] || DIFFICULTY_SETTINGS.normal;
  const sayi = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 1; };
  return { gider: sayi(d.expenseMultiplier ?? 1), gelir: sayi(d.incomeMultiplier ?? 1), ad: d.label || '' };
}

/**
 * Dönemlik bakım gideri ve dökümü: economy.js binaDonemBakimi (calculateExpenses bina başına bunu
 * toplar), state verilirse zorluğun gider çarpanıyla (dönem sonunda kasadan düşen tutar).
 * Yapım sürerken ödenmez (odenen 0); tutar bina bitince ödenecek olandır.
 * @param {object} b
 * @param {object} [state]  verilmezse zorluk çarpanı 1 (calculateExpenses'in tutarı)
 */
export function binaBakimi(b, state = null) {
  const k = binaDonemBakimi(b);
  const yapimda = !b?.isCompleted;
  const zorluk = state ? zorlukCarpani(state) : { gider: 1, ad: '' };
  const tutar = k.tutar * zorluk.gider;
  return { ...k, ham: k.tutar, tutar, yapimda, odenen: yapimda ? 0 : tutar, zorluk: zorluk.gider, zorlukAdi: zorluk.ad };
}

/**
 * Sonraki düzey: maliyet ve süre (game.js upgrade_building), alan, kapasite ve bakım (yükseltme bitince;
 * state verilirse zorluk çarpanıyla).
 */
export function sonrakiDuzey(b, state = null) {
  const tanim = BUILDINGS[b?.type];
  if (!tanim) return null;
  const duzey = b.level || 1;
  const enCok = tanim.maxLevel ?? 3;
  const sonraki = duzey + 1;
  const alan = (tanim.baseArea ?? 1000) + (tanim.areaPerLevel ?? 0) * (sonraki - 1);
  return {
    duzey, sonraki, enCok,
    ustte:    sonraki > enCok,
    maliyet:  Math.round((tanim.baseCost ?? tanim.constructionCost ?? 0) * Math.pow(tanim.upgradeCostMultiplier ?? 1.5, duzey)),
    sure:     tanim.constructionTurns ?? tanim.constructionTime ?? 2,
    alan,
    kapasite: duzeyKapasitesi(tanim, sonraki),
    bakim:    binaBakimi({ ...b, isCompleted: true, area: alan, level: sonraki }, state).tutar,
  };
}

/** Bölümün araştırma merkezi çarpanı (game.js _getResearchCenterBonus): yayın beklentisi ve dış proje kabul olasılığı. */
export function merkezCarpani(state, deptId) {
  const n = (state.buildings || []).filter(b => b.type === 'arastirma_merkezi' && b.isCompleted
    && Array.isArray(b.assignedDepartments) && b.assignedDepartments.includes(deptId)).length;
  return n === 0 ? 1 : Math.min(MERKEZ_TAVANI, 1 + MERKEZ_ARTISI * n);
}

const kirp = (v, alt, ust) => Math.max(alt, Math.min(ust, v));

/**
 * Hizmet binalarının memnuniyet puanına katkısı (students.js calculateStudentSatisfaction).
 * Aynı türün bütün tamamlanmış binaları birlikte sayılır. degisen verilirse o binanın kapasitesi
 * yerine verilen kullanılır (sonraki düzey ya da yapım bitince hesabı; tamamlanmamışsa eklenir).
 * @returns {null|{ toplam, ihtiyac, oran, puan, agirlik, bilesen }}
 */
export function hizmetKatkisi(state, tur, degisen = null) {
  const binalar = (state.buildings || []).filter(b => b.type === tur && (b.isCompleted || (degisen && b.id === degisen.id)));
  const kap = (b, alan) => (degisen && b.id === degisen.id ? degisen.kapasite?.[alan] : b.currentCapacity?.[alan]) || 0;
  const topla = (alan) => binalar.reduce((s, b) => s + kap(b, alan), 0);
  const ogrenci = toplamOgrenci(state);
  switch (tur) {
    case 'kutuphane': {
      const toplam = topla('daily');
      const oran = binalar.length > 0 && ogrenci > 0 ? toplam / ogrenci : 0;
      return { toplam, ihtiyac: ogrenci, oran, puan: binalar.length > 0 ? Math.min(oran, 1.0) * 20 : 0, agirlik: MEMNUNIYET_AGIRLIGI.sosyal, bilesen: 'Sosyal Yaşam' };
    }
    case 'yurt': {
      const toplam = topla('beds');
      const oran = ogrenci > 0 && toplam > 0 ? Math.min(toplam, ogrenci) / ogrenci : 0;
      return { toplam, ihtiyac: ogrenci, oran, puan: toplam > 0 ? kirp(30 + oran * 55, 30, 85) - 30 : 0, agirlik: MEMNUNIYET_AGIRLIGI.yurt, bilesen: 'Yurt İmkânı' };
    }
    case 'yemekhane': {
      const toplam = topla('dailyMeals');
      const ihtiyac = ogrenci + (state.faculty || []).length;
      const oran = toplam > 0 && ihtiyac > 0 ? toplam / ihtiyac : 0;
      return { toplam, ihtiyac, oran, puan: toplam > 0 ? Math.min(oran, 1.2) * 33 : 0, agirlik: MEMNUNIYET_AGIRLIGI.yemek, bilesen: 'Yemekhane' };
    }
    case 'spor_tesisi': {
      const toplam = topla('dailyUsers');
      const oran = toplam > 0 && ogrenci > 0 ? toplam / ogrenci : 0;
      return { toplam, ihtiyac: ogrenci, oran, puan: toplam > 0 ? Math.min(oran, 1.2) * 28 : 0, agirlik: MEMNUNIYET_AGIRLIGI.spor, bilesen: 'Spor Tesisleri' };
    }
    default:
      return null;
  }
}

/** İdari binanın İdari Hizmetler katkısı: en çok 15 (students.js idariBinaBonus). */
const idariKatki = (toplam) => toplam > 0 ? Math.min(15, 6 + (toplam - 1) * 4) : 0;
/** Ulaşım merkezinin Ulaşım puanı katkısı: en çok 25 (students.js ulasimMerkeziBonus). */
const ulasimKatki = (toplam) => toplam > 0 ? Math.min(25, 12 + (toplam - 1) * 6) : 0;

/** Aynı türün tamamlanmış binalarının düzey toplamı; degisen verilirse o binanın düzeyi yerine verilen sayılır. */
function duzeyToplami(state, tur, degisen = null) {
  return (state.buildings || [])
    .filter(b => b.type === tur && (b.isCompleted || (degisen && b.id === degisen.id)))
    .reduce((s, b) => s + (degisen && b.id === degisen.id ? degisen.duzey : (b.level || 1)), 0);
}

/**
 * Binanın laboratuvar odası durumu: oda, bölümlere ayrılan (oyunun yazdığı labPaylari, yoksa hesap),
 * bağlı ve laboratuvar gerektiren açık bölümlerin toplam ihtiyacı, bağlı bölümler.
 */
function binaLabDurumu(state, b, labDag) {
  const oda = labOdasi(b);
  const depts = [...new Set(labKullananlari(b))]
    .map(id => (state.departments || []).find(d => d.id === id)).filter(d => d && d.isOpen !== false);
  const ayrilan = depts.reduce((s, d) => s + binaLabPayi(b, d.id, labDag), 0);
  const ihtiyac = depts.reduce((s, d) => s + bolumLab(d, labDag).ihtiyac, 0);
  return { oda, ayrilan, ihtiyac, bos: Math.max(0, oda - ayrilan), depts };
}

// ─────────────────────────────────────────────────────────────────────────────
// ÇİZİM
// ─────────────────────────────────────────────────────────────────────────────

/** Kart: başlık ve içerik; içerik boşsa hiç yazılmaz. */
function kart(baslik, icerik, sinif = '') {
  return icerik ? `<section class="ob-kart bina-sayfa-kart${sinif ? ` ${sinif}` : ''}"><div class="ob-kart-baslik"><span>${baslik}</span></div>${icerik}</section>` : '';
}

/** Doluluk oranına göre çubuk ve satır sınıfı: %100'ü aşan kritik, %90'ı aşan uyarı (başarısızlık eşikleri). */
function dolulukTuru(oran) {
  return oran > 1 ? 'kritik' : oran > 0.9 ? 'uyari' : 'iyi';
}

function cubuk(oran, tur = dolulukTuru(oran)) {
  return `<div class="ob-cubuk ob-cubuk--${tur}"><span style="width:${Math.max(0, Math.min(100, Math.round(oran * 100)))}%"></span></div>`;
}

/** Bina durumu rozeti: etkin, yapım ya da yükseltme (kalan dönemle). */
function durumRozeti(b, h) {
  const yuzde = Math.round(b.constructionProgress ?? 0);
  const kalan = b.turnsRemaining != null ? ` · ${b.turnsRemaining} dönem kaldı` : '';
  if (!b.isCompleted) return `<span class="ob-rozet ob-rozet--uyari">Yapım aşamasında · %${yuzde}${kalan}</span>`;
  if (b.status === 'upgrading') {
    const hedef = b._pendingLevel ?? (b.level || 1) + 1;
    return `<span class="ob-rozet ob-rozet--uyari">Düzey ${h.ek(hedef)} yükseltiliyor · %${yuzde}${kalan}</span>`;
  }
  return '<span class="ob-rozet ob-rozet--iyi">Etkin</span>';
}

/** Bölüm satırı: ikon, Bölüm Sayfası'na giden ad, alt satır, sağda rozet. */
function bolumSatiri(d, alt, rozet, h) {
  return `
    <div class="bina-bolum-satir">
      <span class="bina-bolum-ikon">${h.bolumIkonu(d.id, 30, d.icon || '🏫')}</span>
      <div class="bina-bolum-govde">
        <button type="button" class="bs-link bina-bolum-ad" data-bina-eylem="bolum" data-bolum="${h.esc(d.id)}" title="${h.esc(d.name)}: Bölüm Sayfası">${h.esc(d.name)}</button>
        ${alt ? `<div class="bina-bolum-alt">${alt}</div>` : ''}
      </div>
      ${rozet || ''}
    </div>`;
}

/** Kapasite ve kullanım kartı: türün gerçekten sağladığı ve oyunun hesapladığı kullanım. */
function kapasiteKarti(state, b, tanim, h, dagilim) {
  const bitti = !!b.isCompleted;
  const kap = bitti ? (b.currentCapacity || {}) : duzeyKapasitesi(tanim, 1);
  const kul = binaKullanimi(state, b);
  const sayi = h.sayi;
  const satirlar = [];
  const not = (metin) => `<div class="ob-aciklama">${metin}</div>`;
  // Türün kapasite değerlerinden en az biri sıfırdan büyükse kart kapasite satırlarıyla dolar
  const kapasiteVar = ['classrooms', 'offices', 'labs', 'beds', 'simultaneous', 'daily', 'dailyMeals', 'dailyUsers', 'dailyPatients']
    .some(k => (kap[k] || 0) > 0);
  if (!kapasiteVar) return kart('Kapasite ve kullanım', not('Bu binanın kapasite değeri yok.'));
  if (!bitti) satirlar.push(not('Yapım bitince sağlayacağı kapasite.'));

  const derslik = kap.classrooms || 0;
  if (derslik > 0) {
    const boy = derslikBoyu(tanim, bitti ? (b.level || 1) : 1);
    const koltuk = derslik * boy;
    satirlar.push(h.satir('Derslik', `${sayi(derslik)} × ${sayi(boy)} kişi = ${sayi(koltuk)} koltuk`));
    satirlar.push(h.satir('Dört sınıflık yer', `${sayi(koltuk * SINIF_SAYISI)} öğrenci`));
    const pay = bitti ? dagilim.binaPaylari.get(b.id) : null;
    if (pay) {
      const kullanan = pay.satirlar.reduce((s, x) => s + x.talep, 0);
      const oran = koltuk > 0 ? kullanan / (koltuk * SINIF_SAYISI) : 0;
      satirlar.push(h.satir('Kullanan öğrenci', `${sayi(kullanan)} <span class="ob-soluk">/ ${sayi(koltuk * SINIF_SAYISI)} · %${Math.round(oran * 100)}</span>`, `ob-${dolulukTuru(oran)}`));
      satirlar.push(cubuk(oran));
      satirlar.push(not(pay.ortak
        ? (pay.satirlar.length
          ? `Bu binaya bölüm atanmadı. Derslikleri, kendine derslik binası atanmamış bölümlerin ortak alanı${dagilim.ortakBinaSayisi > 1 ? ` (${dagilim.ortakBinaSayisi} bina, toplam ${sayi(dagilim.ortakKoltuk)} koltuk). Bu bina koltuğu oranında pay taşır` : ''}.`
          : 'Bu binaya bölüm atanmadı ve dersliklerini kullanan bölüm yok.')
        : 'Koltuklar bu binaya atanmış bölümler arasında öğrenci sayısı oranında paylaşılır. Yetmezse önce küçük bölümlerin ihtiyacı karşılanır.'));
    }
  }

  if ((kap.offices || 0) > 0) {
    satirlar.push(h.satir('Ofis', sayi(kap.offices)));
    const atanan = (b.assignedDepartments || []).length > 0;
    if (b.type === 'fakulte_binasi' || b.type === 'arastirma_merkezi') {
      if (bitti && atanan) {
        satirlar.push(h.satir('Kullanılan ofis', `${sayi(kul.offices)} <span class="ob-soluk">/ ${sayi(kap.offices)}</span>`, (kul.offices || 0) > kap.offices ? 'ob-kritik' : ''));
        satirlar.push(not('Bu binaya bağlı bölümlerin hocaları sayılır. Prof. ve Doç. tek ofis alır. Boş ofis yetmezse Dr. Öğr. Üyeleri ikişer, araştırma görevlileri üçer kişi paylaşır. Ofis doluluğu şu an bir ceza ya da ödül doğurmuyor.'));
      } else if (bitti) {
        satirlar.push(not('Ofis kullanımı yalnız bu binaya atanmış bölümlerin hocaları için hesaplanır. Ofis doluluğu şu an bir ceza ya da ödül doğurmuyor.'));
      }
    } else {
      satirlar.push(not('Oyun bu ofislere kimseyi yerleştirmiyor. Ofis sayısının bir sonucu yok.'));
    }
  }

  if ((kap.labs || 0) > 0 && (b.type === 'lab' || b.type === 'arastirma_merkezi')) {
    satirlar.push(h.satir('Laboratuvar odası', sayi(kap.labs)));
    if (bitti) {
      const bl = binaLabDurumu(state, b, dagilim.lab);
      satirlar.push(h.satir('Bölümlere ayrılan oda', `${h.ondalik(bl.ayrilan, 1)} <span class="ob-soluk">/ ${sayi(kap.labs)}</span>`));
      satirlar.push(h.satir('Bağlı bölümlerin ihtiyacı', `${sayi(bl.ihtiyac)} oda`, bl.ihtiyac > kap.labs ? 'ob-uyari' : ''));
      satirlar.push(cubuk(Math.min(1, bl.ayrilan / kap.labs), 'iyi'));
      satirlar.push(not(`Odaları, laboratuvar gerektiren bağlı bölümler kalan ihtiyaçları oranında paylaşır. Her ${LAB_ODA_BASINA_OGRENCI} öğrenciye bir oda gerekir, hiçbir bölüm ihtiyacından fazlasını almaz. Dağılım aşağıdaki kartta.`));
    } else {
      satirlar.push(not('Yapım bitince odalarını, laboratuvar gerektiren bağlı bölümler ihtiyaçları oranında paylaşır.'));
    }
  }

  const ogrenci = toplamOgrenci(state);
  const hoca = (state.faculty || []).length;
  switch (b.type) {
    case 'kutuphane': {
      satirlar.push(h.satir('Aynı anda oturma', `${sayi(kap.simultaneous || 0)} kişi`));
      satirlar.push(h.satir('Günlük kapasite', `${sayi(kap.daily || 0)} kişi`));
      if (kul) {
        const oran = kap.daily ? ogrenci / kap.daily : 0;
        satirlar.push(h.satir('Günlük kullanım', `${sayi(kul.daily)} <span class="ob-soluk">/ ${sayi(kap.daily || 0)} · öğrenci ${sayi(ogrenci)}</span>`, `ob-${dolulukTuru(oran)}`));
        satirlar.push(cubuk(oran));
        satirlar.push(h.satir('Aynı anda kullanım', `${sayi(kul.simultaneous)} <span class="ob-soluk">/ ${sayi(kap.simultaneous || 0)}</span>`));
        satirlar.push(not('Oyun her öğrenciyi günde bir kez, öğrencilerin dörtte birini aynı anda sayar. Kullanım kapasiteyle sınırlı.'));
      }
      break;
    }
    case 'yurt': {
      satirlar.push(h.satir('Yatak', sayi(kap.beds || 0)));
      if (kul) {
        const oran = kap.beds ? kul.beds / kap.beds : 0;
        satirlar.push(h.satir('Dolu yatak', `${sayi(kul.beds)} <span class="ob-soluk">/ ${sayi(kap.beds || 0)}</span>`));
        satirlar.push(cubuk(oran, 'iyi'));
        satirlar.push(not('Oyun öğrencilerin %40\'ını yurtta sayar. Dolu yatak kapasiteyle sınırlı. Memnuniyet hesabı ise toplam yatağı bütün öğrencilerle karşılaştırır.'));
      }
      break;
    }
    case 'yemekhane': {
      satirlar.push(h.satir('Günlük öğün', sayi(kap.dailyMeals || 0)));
      if (kul) {
        const ihtiyac = ogrenci + hoca;
        const oran = kap.dailyMeals ? ihtiyac / kap.dailyMeals : 0;
        satirlar.push(h.satir('Günlük kullanım', `${sayi(kul.dailyMeals)} <span class="ob-soluk">/ ${sayi(kap.dailyMeals || 0)} · ihtiyaç ${sayi(ihtiyac)}</span>`, `ob-${dolulukTuru(oran)}`));
        satirlar.push(cubuk(oran));
        satirlar.push(not(`İhtiyaç ${sayi(ogrenci)} öğrenci ile ${sayi(hoca)} hocanın toplamı. Her kişi günde bir öğün sayılır.`));
      }
      break;
    }
    case 'spor_tesisi': {
      satirlar.push(h.satir('Günlük kullanıcı', sayi(kap.dailyUsers || 0)));
      if (kul) {
        const istek = Math.round(ogrenci * 0.60);
        const oran = kap.dailyUsers ? istek / kap.dailyUsers : 0;
        satirlar.push(h.satir('Günlük kullanım', `${sayi(kul.dailyUsers)} <span class="ob-soluk">/ ${sayi(kap.dailyUsers || 0)} · isteyen ${sayi(istek)}</span>`, `ob-${dolulukTuru(oran)}`));
        satirlar.push(cubuk(oran));
        satirlar.push(not('Oyun öğrencilerin %60\'ını günlük kullanıcı sayar. Kullanım kapasiteyle sınırlı.'));
      }
      break;
    }
    case 'saglik_merkezi':
      satirlar.push(h.satir('Günlük hasta', sayi(kap.dailyPatients || 0)));
      satirlar.push(not('Oyun bu kapasiteyi bir hesapta kullanmıyor.'));
      break;
    default:
      break;
  }
  return kart('Kapasite ve kullanım', satirlar.join(''));
}

/** Bölümün derslik yeri: atandığı derslik binaları, ortak derslikler ya da yedek. */
function derslikYeri(state, d, dagilim, h) {
  const binalar = (dagilim.bolumBinalari.get(d.id) || [])
    .map(id => (state.buildings || []).find(b => b.id === id)).filter(Boolean)
    .map(b => h.esc(b.name || BUILDINGS[b.type]?.name || b.type));
  if (binalar.length) return `dersliği ${binalar.join(', ')}`;
  return dagilim.bolumKapasitesi.get(d.id)?.kaynak === 'yedek' ? 'kullanabileceği derslik yok' : 'ortak dersliklerde';
}

/**
 * Laboratuvar odası payları tablosu (Laboratuvar ve araştırma merkezi): bağlı her açık bölümün oda
 * ihtiyacı, bu binadan aldığı oda, bütün binalardan aldığı oda ve karşılama. Sayılar oyunun yazdığı
 * alanlardan (labPaylari, labIhtiyaci, labAyrilan, labKarsilama); yoksa aynı kuralla hesaplanır.
 */
export function labPayTablosu(state, b, h, labDag = labDagilimi(state)) {
  if (b?.type !== 'lab' && b?.type !== 'arastirma_merkezi') return '';
  const liste = b.type === 'lab' ? (b.linkedDepartments || []) : (b.assignedDepartments || []);
  const depts = [...new Set(liste)].map(id => (state.departments || []).find(d => d.id === id)).filter(d => d && d.isOpen !== false);
  if (depts.length === 0) return '';
  const oda = (v) => h.ondalik(Number(v) || 0, 1);
  const satirlar = depts.map(d => {
    const lb = bolumLab(d, labDag);
    if (!lb.gerek) {
      return `
      <tr>
        <td class="ob-ad">${h.esc(d.shortName || d.name)}</td>
        <td class="n ob-soluk" colspan="4">laboratuvar gerektirmiyor</td>
      </tr>`;
    }
    return `
      <tr>
        <td class="ob-ad">${h.esc(d.shortName || d.name)}</td>
        <td class="n">${h.sayi(lb.ihtiyac)}</td>
        <td class="n ob-tek">${oda(binaLabPayi(b, d.id, labDag))}</td>
        <td class="n ob-tek">${oda(lb.ayrilan)}</td>
        <td class="n ob-${karsilamaTuru(lb.karsilama)}">%${Math.round(lb.karsilama * 100)}</td>
      </tr>`;
  }).join('');
  return `
    <div class="bina-lab-tablo">
      <div class="bina-alt-baslik">Laboratuvar odası payları</div>
      <div class="ob-tablo-kap"><table class="ob-tablo ob-tablo--dar">
        <thead><tr><th>Bölüm</th><th class="n">İhti&shy;yaç</th><th class="n">Bu bina&shy;dan</th><th class="n">Top&shy;lam</th><th class="n">Karşı&shy;lama</th></tr></thead>
        <tbody>${satirlar}</tbody>
      </table></div>
      <div class="ob-tablo-dip">İhtiyaç her ${LAB_ODA_BASINA_OGRENCI} öğrenciye bir oda. "Bu binadan" bu binanın bölüme ayırdığı oda, "Toplam" bölümün bütün laboratuvarlardan ve araştırma merkezlerinden aldığı oda. Karşılama toplamın ihtiyaca oranı. Laboratuvar puanı ${LAB_PUAN_TABANI} + ${LAB_PUAN_ARALIGI} × karşılama.</div>
    </div>`;
}

/** Bölümler kartı: derslikli binada koltuk payları, araştırma merkezinde ve laboratuvarda bağlı bölümler. */
function bolumlerKarti(state, b, tanim, h, dagilim) {
  const acikBolum = (id) => (state.departments || []).find(d => d.id === id && d.isOpen !== false);
  const sayi = h.sayi;
  const not = (metin) => `<p class="ob-aciklama bina-bolum-not">${metin}</p>`;
  const bitti = !!b.isCompleted;
  const derslikli = (bitti ? (b.currentCapacity?.classrooms || 0) : (duzeyKapasitesi(tanim, 1).classrooms || 0)) > 0;

  if (!tanim.assignable) {
    return kart('Bölümler', not('Bu binaya bölüm atanmaz. Bütün yerleşkeye hizmet eder.'));
  }
  if (!bitti) {
    return kart('Bölümler', not('Yapım bitince bölüm atanabilir.'));
  }

  if (derslikli) {
    const pay = dagilim.binaPaylari.get(b.id);
    const satirlar = (pay?.satirlar || []).map(s => {
      const d = acikBolum(s.id);
      if (!d) return '';
      const ogrenci = dagilim.talep.get(d.id) || 0;
      const kapasite = Number(d.studentCapacity) > 0 ? Number(d.studentCapacity) : (dagilim.bolumKapasitesi.get(d.id)?.kapasite || 0);
      const oran = kapasite > 0 ? ogrenci / kapasite : 0;
      const baskaBina = !pay.ortak && (dagilim.bolumBinalari.get(d.id) || []).length > 1;
      const alt = [
        `${sayi(ogrenci)} öğrenci`,
        `bu binadan ${sayi(s.pay)} yer (${sayi(s.pay / SINIF_SAYISI)} koltuk)`,
        `bölümün toplam yeri ${sayi(kapasite)}`,
        baskaBina ? `bölüm birden çok binada, öğrencilerinin ${h.ek(Math.round(s.talep), 'si', sayi(s.talep))} bu binaya düşer` : '',
      ].filter(Boolean).join(' · ');
      const rozet = `<span class="ob-rozet ob-rozet--${dolulukTuru(oran)} ob-rozet--kucuk" title="Bölümün öğrenci sayısı / toplam yeri">%${Math.round(oran * 100)} dolu</span>`;
      return bolumSatiri(d, alt, rozet, h);
    }).filter(Boolean).join('');
    const giris = pay?.ortak
      ? (satirlar ? not('Bu binaya bölüm atanmadı. Kendine derslik binası atanmamış şu bölümler dersliklerini paylaşıyor.') : not('Dersliklerini kullanan bölüm yok. "Bölüm ata" düğmesiyle bölüm atayabilirsiniz.'))
      : not('Bu binaya atanmış bölümler ve bu binadan aldıkları yer. Yer dört sınıflıktır (koltuk × 4). Bölüm %90\'ı aşınca başarısızlık artar.');
    // Hiçbir dersliğe erişemeyen bölümler (game.js _updateDeptCapacities 'yedek'): son atanmamış derslik
    // binasına da bölüm atanınca ortak alan kalmaz, kendine binası olmayan bölümler tek derslik sayılır
    const yedekte = (state.departments || [])
      .filter(d => d.isOpen !== false && dagilim.bolumKapasitesi.get(d.id)?.kaynak === 'yedek')
      .map(d => h.esc(d.shortName || d.name));
    const yedekListe = yedekte.length > 1 ? `${yedekte.slice(0, -1).join(', ')} ve ${yedekte[yedekte.length - 1]}` : yedekte[0];
    const yedekNotu = yedekte.length
      ? `<div class="ob-not ob-not--uyari bina-bolum-not"><p>${yedekListe} ${yedekte.length > 1 ? 'bölümlerinin' : 'bölümünün'} kullanabileceği derslik yok. ${yedekte.length > 1 ? 'Kapasiteleri' : 'Kapasitesi'} tek derslik (${sayi(YEDEK_KOLTUK * SINIF_SAYISI)} öğrenci) sayılıyor. ${yedekte.length > 1 ? 'Onları' : 'Onu'} bir derslik binasına atayın ya da bir derslik binasını atamasız bırakın.</p></div>`
      : '';
    const sayac = pay?.satirlar?.length || 0;
    return kart(`Bölümler${sayac ? ` <span class="ob-sayi">${sayac}</span>` : ''}`, `${giris}${satirlar ? `<div class="bina-bolum-liste">${satirlar}</div>` : ''}${yedekNotu}`);
  }

  // Bölümün bu binadan aldığı laboratuvar odası ve bütün binalardan karşılaması (laboratuvar gerektirmeyende yazı)
  const labAlt = (d) => {
    const lb = bolumLab(d, dagilim.lab);
    if (!lb.gerek) return { alt: 'laboratuvar gerektirmiyor, oda kullanmaz', rozet: '<span class="ob-rozet ob-rozet--kucuk">laboratuvar gerekmiyor</span>' };
    return {
      alt: `laboratuvar ihtiyacı ${sayi(lb.ihtiyac)} oda, bu binadan ${h.ondalik(binaLabPayi(b, d.id, dagilim.lab), 1)} oda · laboratuvar puanı ${sayi(Number(d.labScore) || 0)}/100`,
      rozet: `<span class="ob-rozet ob-rozet--${karsilamaTuru(lb.karsilama)} ob-rozet--kucuk" title="Bölümün bütün laboratuvar odası / ihtiyacı">%${Math.round(lb.karsilama * 100)} karşılama</span>`,
    };
  };

  if (b.type === 'lab') {
    const depts = (b.linkedDepartments || []).map(acikBolum).filter(Boolean);
    const satirlar = depts.map(d => {
      const l = labAlt(d);
      return bolumSatiri(d, [l.alt, derslikYeri(state, d, dagilim, h)].join(' · '), l.rozet, h);
    }).join('');
    const giris = not(`Bağlı bölüm fakülte binasında kalır, derslikleri ve öğrenci alımı değişmez. Binanın ${sayi(labOdasi(b))} laboratuvar odasını, laboratuvar gerektiren bağlı bölümler kalan ihtiyaçları oranında paylaşır. Her ${LAB_ODA_BASINA_OGRENCI} öğrenciye bir oda gerekir. Karşılama, bölümün bütün binalardan aldığı odanın ihtiyacına oranı. Laboratuvar puanı ${LAB_PUAN_TABANI} + ${LAB_PUAN_ARALIGI} × karşılama.`);
    return kart(`Bağlı bölümler${depts.length ? ` <span class="ob-sayi">${depts.length}</span>` : ''}`,
      `${giris}${satirlar ? `<div class="bina-bolum-liste">${satirlar}</div>` : not('Henüz bağlı bölüm yok. "Bölüm bağla" düğmesiyle bağlayabilirsiniz.')}${labPayTablosu(state, b, h, dagilim.lab)}`);
  }

  // Dersliği olmayan atanabilir bina (araştırma merkezi): bağlı bölüm burada ders vermez
  const odali = labOdasi(b) > 0;
  const depts = (b.assignedDepartments || []).map(acikBolum).filter(Boolean);
  const satirlar = depts.map(d => {
    const carpan = merkezCarpani(state, d.id);
    const hoca = (state.faculty || []).filter(f => (f.department || f.departmentId) === d.id).length;
    const alt = [`${sayi(hoca)} hoca`, odali ? labAlt(d).alt : '', derslikYeri(state, d, dagilim, h)].filter(Boolean).join(' · ');
    return bolumSatiri(d, alt, `<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk" title="Yayın beklentisi ve dış proje kabul olasılığı çarpanı">×${h.ondalik(carpan, 2)}</span>`, h);
  }).join('');
  const giris = b.type === 'arastirma_merkezi'
    ? not(`Bağlı bölüm burada ders vermez ve öğrenci almaz. Derslikleri ve öğrenci alımı kendi binasında sürer. Merkez, bu bölümün hocalarının yayın beklentisini ve dış proje kabul olasılığını 1,15 katına, bölüm iki merkeze bağlıysa 1,30 katına çıkarır.${odali ? ` Merkezin ${sayi(labOdasi(b))} laboratuvar odasını, laboratuvar gerektiren bağlı bölümler kalan ihtiyaçları oranında paylaşır.` : ''}`)
    : not('Bağlı bölüm burada ders vermez. Derslikleri ve öğrenci alımı kendi binasında sürer.');
  return kart(`Bağlı bölümler${depts.length ? ` <span class="ob-sayi">${depts.length}</span>` : ''}`,
    `${giris}${satirlar ? `<div class="bina-bolum-liste">${satirlar}</div>` : not('Henüz bağlı bölüm yok. "Bölüm ata" düğmesiyle bağlayabilirsiniz.')}${odali ? labPayTablosu(state, b, h, dagilim.lab) : ''}`);
}

/**
 * Teknokentin bu dönemki sponsorluk geliri: economy.js teknokentGeliri × zorluğun gelir çarpanı
 * (calculateEconomy). Teknokent açık değilse "açılsaydı" tutarıdır.
 */
export function teknokentDonemGeliri(state) {
  return teknokentGeliri(state).toplam * zorlukCarpani(state).gelir;
}

/**
 * Teknokent binasının durumu hakkında tek cümle, yalnız etkisi olmayacaksa: teknokent etkisi olayla
 * zaten açıksa yeni bina ayrıca gelir ya da puan eklemez (ui.js inşaat seçeneği ve onayı).
 */
export function teknokentZatenAcikNotu(state) {
  return state?.university?.hasTechnoPark && !(state.buildings || []).some(b => b?.type === 'teknokent')
    ? 'Teknokent etkisi "Özel Sektör AR-GE Merkezi Teklifi" olayıyla zaten açık. Bu bina ayrıca gelir ya da puan eklemez.'
    : '';
}

/**
 * Bina kartının "Etkileri" bölümü (ui.js bina kartı): türün doğrulanmış etki özeti (binaEtkiOzeti) ve
 * hesaplanabiliyorsa bugünkü katkı; Bina Sayfası'ndaki "Oyundaki etkisi" kartıyla aynı hesap.
 * @param {object} h  ui.js yardımcıları: ondalik, para
 * @returns {string[]} madde metinleri (HTML)
 */
export function binaKartEtkileri(state, b, h) {
  const maddeler = [...binaEtkiOzeti(b?.type)];
  if (!b?.isCompleted) return maddeler;
  const ond = (v) => h.ondalik(v, 1);
  switch (b.type) {
    case 'kutuphane': case 'yurt': case 'yemekhane': case 'spor_tesisi': {
      const k = hizmetKatkisi(state, b.type);
      const coklu = (state.buildings || []).filter(x => x.type === b.type && x.isCompleted).length > 1;
      maddeler.push(`Şimdi ${k.bilesen} puanına katkı +${ond(k.puan)}${coklu ? ' (aynı türün bütün binalarıyla)' : ''}, genel memnuniyete en çok +${ond(k.puan * k.agirlik)} puan`);
      break;
    }
    case 'idari_bina':
      maddeler.push(`Şimdi İdari Hizmetler +${idariKatki(duzeyToplami(state, 'idari_bina'))}`);
      break;
    case 'ulasim_merkezi':
      maddeler.push(`Şimdi Ulaşım +${ulasimKatki(duzeyToplami(state, 'ulasim_merkezi'))}`);
      break;
    case 'teknokent':
      if (state.university?.hasTechnoPark) {
        maddeler.push(`Şimdi dönemde ${h.para(teknokentDonemGeliri(state))} sponsorluk geliri`);
      }
      break;
    default:
      break;
  }
  return maddeler;
}

/** Oyundaki etkisi: türün gerçekten yaptığı, oyunun hesabındaki büyüklükleriyle; hizmet binalarında şimdiki katkı. */
function etkiKarti(state, b, tanim, h) {
  const ond = (v, n = 1) => h.ondalik(v, n);
  const sayi = h.sayi;
  const bitti = !!b.isCompleted;
  const zaman = bitti ? 'Şimdi' : 'Bina bitince';
  const degisen = bitti ? null : { id: b.id, kapasite: duzeyKapasitesi(tanim, 1), duzey: 1 };
  const maddeler = [];
  const memnuniyetNotu = 'Öğrenci memnuniyeti kalite puanına ve saygınlığa da yansır.';
  const idariNotu = (birim, deger) => `İdari sekmesinde ${birim} birimine "+%${deger} verimlilik" yazılır. Bu yalnız gösterimdir, bir sonucu yok.`;
  const hizmet = (tur) => {
    const k = hizmetKatkisi(state, tur, degisen);
    return k ? { ...k, genel: k.puan * k.agirlik } : null;
  };
  // Laboratuvar odalarının bugünkü durumu (bitmiş binada)
  const labSimdi = () => {
    if (!bitti) return [];
    const bl = binaLabDurumu(state, b, labDagilimi(state));
    return [`Şimdi ${sayi(bl.oda)} oda, bağlı bölümlerin ihtiyacı ${sayi(bl.ihtiyac)} oda, bölümlere ayrılan ${ond(bl.ayrilan)} oda.`];
  };

  switch (b.type) {
    case 'fakulte_binasi':
    case 'amfi':
      maddeler.push(
        'Derslik koltukları bölümlerin öğrenci kapasitesini belirler. Bir koltuk bir yıllık alım sayılır. Dört sınıf için koltuk × 4.',
        'Yeni alım, kapasiteden üst sınıflara geçecek öğrenciler çıkınca kalan yerle sınırlı.',
        'Bölümün öğrenci sayısı yerinin %90\'ını aşınca başarısızlık oranı 5 puan, %100\'ünü aşınca 10 puan artar.',
        'Doluluk %70\'i aşınca not ortalaması biraz düşer.',
      );
      break;
    case 'arastirma_merkezi': {
      const o = labOdaTanimi(b.type);
      maddeler.push(
        'Bağlı bölümün hocalarının dönemlik yayın beklentisi 1,15 katına çıkar. Bölüm iki merkeze bağlıysa 1,30 katına çıkar. Daha fazla merkez bunu artırmaz.',
        'Bağlı bölümün hocalarının dış proje başvurularında kabul olasılığı 1,15 katına çıkar (iki merkezle 1,30). Olasılık en çok %92.',
        'Bu çarpanlar merkezin düzeyine bağlı değil.',
        `Merkezin laboratuvar odalarını (düzey 1'de ${o.ilk}, her düzey +${o.artis}) laboratuvar gerektiren bağlı bölümler kalan ihtiyaçları oranında paylaşır. Kural Laboratuvar binasıyla aynı. Bölümün laboratuvar puanı ${LAB_PUAN_TABANI} + ${LAB_PUAN_ARALIGI} × karşılama.`,
        ...labSimdi(),
        'Merkezin ofislerinin bir sonucu yok. Ofis doluluğu bir ceza ya da ödül doğurmuyor.',
      );
      break;
    }
    case 'lab': {
      const o = labOdaTanimi(b.type);
      maddeler.push(
        `Binanın laboratuvar odalarını (düzey 1'de ${o.ilk}, her düzey +${o.artis}) laboratuvar gerektiren bağlı bölümler kalan ihtiyaçları oranında paylaşır. Her ${LAB_ODA_BASINA_OGRENCI} öğrenciye bir oda gerekir. Hiçbir bölüm ihtiyacından fazlasını almaz, artan oda boş kalır.`,
        'Az bölüme hizmet eden laboratuvar önce dağıtılır. Bir bölüm birden çok laboratuvardan ve araştırma merkezinden oda alabilir.',
        `Bölümün laboratuvar puanı ${LAB_PUAN_TABANI} + ${LAB_PUAN_ARALIGI} × karşılama. Karşılama, bölümün bütün binalardan aldığı odanın ihtiyacına oranı.`,
        ...labSimdi(),
        `Akreditasyonda her 25 laboratuvar puanı bir laboratuvar sayılır${labSartlari() ? ` (${labSartlari()} laboratuvar ister)` : ''}.`,
        'Laboratuvar gerektiren bölümde yayın beklentisi puana göre ×0,94 (30 puan) ile ×1,15 (100 puan) arasında değişir.',
        `Laboratuvar gereksinimi ${LAB_GEREKSINIM_ESIGI}'nin altındaki bölüm laboratuvar gerektirmez, oda kullanmaz ve puanı 100. Bağlamak bir şey değiştirmez.`,
      );
      break;
    }
    case 'kutuphane': {
      const k = hizmet('kutuphane');
      maddeler.push(
        'Yerleşkedeki kütüphanelerin günlük kapasitesi öğrenci sayısını karşıladığı oranda Sosyal Yaşam puanına en çok +20 ekler.',
        `${zaman} günde ${sayi(k.toplam)} kişi, ${sayi(k.ihtiyac)} öğrenci. Karşılama %${Math.round(k.oran * 100)}, katkı <b>+${ond(k.puan)}</b>.`,
        `Sosyal Yaşam öğrenci memnuniyetinin %10'u. Bu katkı genel memnuniyete en çok +${ond(k.genel)} puan ekler.`,
        'Aynı anda oturma kapasitesi yalnız gösterilir. Memnuniyet hesabı günlük kapasiteye bakar.',
        idariNotu('Kütüphane Hizmetleri', 10),
        memnuniyetNotu,
      );
      break;
    }
    case 'yurt': {
      const k = hizmet('yurt');
      maddeler.push(
        'Yerleşkedeki toplam yatak öğrenci sayısını karşıladığı oranda Yurt İmkânı puanı 30\'dan 85\'e çıkar.',
        `${zaman} ${sayi(k.toplam)} yatak, ${sayi(k.ihtiyac)} öğrenci. Karşılama %${Math.round(k.oran * 100)}, puana katkı <b>+${ond(k.puan)}</b>.`,
        `Yurt İmkânı öğrenci memnuniyetinin %10'u. Genel memnuniyete en çok +${ond(k.genel)} puan ekler.`,
        'Oyun yurttan gelir hesaplamıyor.',
        memnuniyetNotu,
      );
      break;
    }
    case 'yemekhane': {
      const k = hizmet('yemekhane');
      maddeler.push(
        'Yemekhane puanı 30 + 33 × oran. Oran, yerleşkedeki günlük öğünün öğrenci ve hoca sayısına bölümü. En çok 1,2 sayılır.',
        `${zaman} günde ${sayi(k.toplam)} öğün, ${sayi(k.ihtiyac)} kişi. Oran ${ond(k.oran, 2)}, katkı <b>+${ond(k.puan)}</b>.`,
        `Yemekhane öğrenci memnuniyetinin %7'si. Genel memnuniyete en çok +${ond(k.genel)} puan ekler.`,
        'Hoca mutluluğunu etkilemiyor.',
        idariNotu('Yemekhane Yönetimi', 10),
        memnuniyetNotu,
      );
      break;
    }
    case 'spor_tesisi': {
      const k = hizmet('spor_tesisi');
      maddeler.push(
        'Spor Tesisleri puanı 38 + 28 × oran. Oran, yerleşkedeki günlük kullanıcı kapasitesinin öğrenci sayısına bölümü. En çok 1,2 sayılır.',
        `${zaman} günde ${sayi(k.toplam)} kullanıcı, ${sayi(k.ihtiyac)} öğrenci. Oran ${ond(k.oran, 2)}, katkı <b>+${ond(k.puan)}</b>.`,
        `Spor Tesisleri öğrenci memnuniyetinin %5'i. Genel memnuniyete en çok +${ond(k.genel)} puan ekler.`,
        'Basketbol, futbol, voleybol ve yüzme takımı kurmak için gerekli.',
        'Takımların maç gücüne +15 ekler ama ikinci tesis bunu artırmaz.',
        memnuniyetNotu,
      );
      break;
    }
    case 'konferans':
      maddeler.push(
        'Kalite puanında Uluslararasılaşma bileşenine +15 ekler. Bileşenin ağırlığı %10, kalite puanına en çok +1,5.',
        'Saygınlık her dönem kalite puanına yavaşça yaklaşır. Sıralama hesabı da aynı +15\'i kullanır.',
        'Uluslararası sıralamada Uluslararası görünüm puanına +12.',
        'Sosyal Yaşam puanına +8 (öğrenci memnuniyetinin %10\'u).',
        'Etkisi düzeye bağlı değil.',
      );
      break;
    case 'saglik_merkezi':
      maddeler.push(
        'Sağlık hizmeti puanına +12. Bu puan İdari Hizmetler puanının beşte biri, İdari Hizmetler de öğrenci memnuniyetinin %12\'si. Genel memnuniyete en çok +0,3 puan ekler.',
        'Etkisi düzeye ve günlük hasta kapasitesine bağlı değil.',
        idariNotu('Sağlık Merkezi', 15),
        memnuniyetNotu,
      );
      break;
    case 'idari_bina': {
      const katki = idariKatki(duzeyToplami(state, 'idari_bina', degisen));
      maddeler.push(
        `İdari Hizmetler puanına düzey 1'de +6, düzey 2'de +10, düzey 3'te +14 ekler. ${zaman} <b>+${katki}</b>.`,
        `İdari Hizmetler öğrenci memnuniyetinin %12'si. Genel memnuniyete en çok +${ond(katki * MEMNUNIYET_AGIRLIGI.idari)} puan ekler.`,
        'İdari sekmesinde bütün birimlere düzeye göre "+%10, +%15, +%20 verimlilik" yazılır. Bu yalnız gösterimdir, bir sonucu yok.',
        memnuniyetNotu,
      );
      break;
    }
    case 'ulasim_merkezi': {
      const katki = ulasimKatki(duzeyToplami(state, 'ulasim_merkezi', degisen));
      maddeler.push(
        `Ulaşım puanına düzey 1'de +12, düzey 2'de +18, düzey 3'te +24 ekler. ${zaman} <b>+${katki}</b>.`,
        `Ulaşım öğrenci memnuniyetinin %5'i. Genel memnuniyete en çok +${ond(katki * MEMNUNIYET_AGIRLIGI.ulasim)} puan ekler.`,
        idariNotu('Ulaşım Hizmetleri', 10),
        memnuniyetNotu,
      );
      break;
    }
    case 'teknokent': {
      const kural = teknokentKurali();
      const z = zorlukCarpani(state);
      const acik = !!state.university?.hasTechnoPark;
      maddeler.push(
        bitti
          ? (acik ? 'Teknokent açık. Bütçeye her dönem sponsorluk geliri girer.' : 'Teknokent etkisi kapalı.')
          : `Bina bitince teknokent açılır ve bütçeye her dönem sponsorluk geliri girer${acik ? '. Olayla zaten açık olduğu için bina ayrıca gelir eklemez' : ''}.`,
        `Gelir ${tr(kural.temel)} ₺, öğrenci başına ${tr(kural.ogrenciBasina)} ₺ ve sanayi bağlantısı. Sanayi bağlantısı saygınlığın 0,3 katı puan (aşağı yuvarlanır), puan başına ${tr(kural.puanBasina)} ₺.`,
        `${bitti && acik ? 'Şimdi' : 'Bugünkü durumla'} ${sayi(state.students?.totalEnrolled || 0)} öğrenci ve saygınlık ${ond(Number(state.university?.prestige) || 0)} ile dönemde <b>${h.para(teknokentDonemGeliri(state))}</b>${z.gelir !== 1 ? ` (zorluk ×${ond(z.gelir)} dahil)` : ''}.`,
        `Kariyer Desteği puanına +${KARIYER_TEKNOKENT} (puan en çok 100). Kariyer Desteği öğrenci memnuniyetinin %9'u. Genel memnuniyete en çok +${ond(Math.round(KARIYER_TEKNOKENT * MEMNUNIYET_AGIRLIGI.kariyer * 100) / 100)} puan ekler.`,
        'Teknokent "Özel Sektör AR-GE Merkezi Teklifi" olayında teklif kabul edilince de açılır. İki yoldan açılsa da etki bir kez sayılır.',
        'Etkisi düzeye bağlı değil. Yükseltme yalnız alanı ve bakımı büyütür.',
        memnuniyetNotu,
      );
      break;
    }
    default:
      maddeler.push('Bu bina türünün oyundaki etkisi tanımlı değil.');
  }
  const ust = bitti ? '' : '<div class="ob-aciklama">Etkiler yapım bitince başlar.</div>';
  return kart('Oyundaki etkisi', `${ust}<ul class="ob-madde bina-etki">${maddeler.map(m => `<li>${m}</li>`).join('')}</ul>`);
}

/** Bakım gideri kartı: dönemlik tutar ve dökümü (economy.js binaDonemBakimi, zorluk çarpanı), kayıtlıysa inşaat bedeli. */
function bakimKarti(state, b, h) {
  const k = binaBakimi(b, state);
  const ond = (v, n) => h.ondalik(v, n);
  const satirlar = [];
  if (k.yontem === 'alan') {
    satirlar.push(h.satir('Taban (alan × m² bedeli)', `${h.sayi(k.alan)} m² × ${h.para(k.m2)} = ${h.para(k.taban)}`));
  } else if (k.yontem === 'kayit') {
    satirlar.push(h.satir('Taban (kayıtlı tutar)', h.para(k.taban)));
  } else if (k.yontem === 'oran') {
    satirlar.push(h.satir('Taban (yapım bedelinin payı)', h.para(k.taban)));
  }
  satirlar.push(h.satir('Bina durumu', `%${ond(k.durum, 0)} <span class="ob-soluk">× ${ond(k.durumCarpani, 3)}</span>`));
  satirlar.push(h.satir('Düzey', `${k.duzey} <span class="ob-soluk">× ${ond(k.duzeyCarpani, 2)}</span>`));
  if (k.zorluk !== 1) {
    satirlar.push(h.satir('Zorluk', `${h.esc(k.zorlukAdi)} <span class="ob-soluk">× ${ond(k.zorluk, 2)}</span>`));
  }
  satirlar.push(`<div class="ob-satir ob-satir--toplam"><span>${k.yapimda ? 'Bina bitince dönemlik' : 'Dönemlik bakım'}</span><b>${h.para(k.tutar)}</b></div>`);
  satirlar.push(`<div class="ob-aciklama">${k.yapimda
    ? 'Yapım sürerken bakım ödenmez.'
    : `Durum %100'ün altındaysa bakım artar. Her düzey m² başına bakımı %25 artırır.${k.zorluk !== 1 ? ' Zorluk bütün giderleri aynı oranda değiştirir.' : ''} Bu tutar dönem sonunda kasadan düşer.`}</div>`);
  if (Number.isFinite(Number(b.constructionCost)) && Number(b.constructionCost) > 0) {
    satirlar.push(h.satir('İnşaat bedeli', `${h.para(Number(b.constructionCost))} <span class="ob-soluk">ilk yapım</span>`));
  }
  return kart('Bakım gideri', satirlar.join(''));
}

/**
 * Yükseltmenin etkideki değişimi, oyunun hesabıyla (HTML). Bina Sayfası'nın sonraki düzey kartı ve
 * yükseltme onayı (ui.js _yukseltmeOnayIcerigi) gösterir. Bina yükseltilemiyorsa boş.
 * @param {object} h  ui.js yardımcıları: sayi, ondalik, esc
 */
export function yukseltmeEtkisi(state, b, h) {
  const tanim = BUILDINGS[b?.type];
  const s = sonrakiDuzey(b, state);
  if (!tanim || !s || s.ustte) return '';
  const degisen = { id: b.id, kapasite: s.kapasite, duzey: s.sonraki };
  switch (b.type) {
    case 'fakulte_binasi':
    case 'amfi': {
      const koltuk = (s.kapasite.classrooms || 0) * derslikBoyu(tanim, s.sonraki);
      return `${h.sayi(binaKoltugu(b))} → <b>${h.sayi(koltuk)}</b> koltuk (dört sınıf ${h.sayi(koltuk * SINIF_SAYISI)} öğrenci)`;
    }
    case 'lab':
    case 'arastirma_merkezi': {
      const odaSonra = s.kapasite.labs || 0;
      const oda = `laboratuvar odası ${h.sayi(labOdasi(b))} → <b>${h.sayi(odaSonra)}</b>`;
      const merkez = b.type === 'arastirma_merkezi' ? '. Yayın ve proje çarpanı düzeye bağlı değil' : '';
      if (!b.isCompleted) return `${oda}${merkez}`;
      const once = labDagilimi(state);
      const sonra = labDagilimi(state, { id: b.id, oda: odaSonra });
      const degisim = [...new Set(labKullananlari(b))]
        .map(id => (state.departments || []).find(d => d.id === id && d.isOpen !== false))
        .filter(d => d && labGerekir(d))
        .map(d => `${h.esc(d.shortName || d.name)} %${Math.round((once.bolumler.get(d.id)?.karsilama ?? 0) * 100)} → <b>%${Math.round((sonra.bolumler.get(d.id)?.karsilama ?? 0) * 100)}</b>`);
      return degisim.length
        ? `${oda}${merkez}. Bugünkü öğrenci sayısıyla karşılama ${degisim.slice(0, 4).join(', ')}${degisim.length > 4 ? ` ve ${degisim.length - 4} bölüm daha` : ''}`
        : `${oda}${merkez}. Bağlı ve laboratuvar gerektiren bölüm yok`;
    }
    case 'kutuphane': case 'yurt': case 'yemekhane': case 'spor_tesisi': {
      const once = hizmetKatkisi(state, b.type);
      const sonr = hizmetKatkisi(state, b.type, degisen);
      return `${once.bilesen} +${h.ondalik(once.puan, 1)} → <b>+${h.ondalik(sonr.puan, 1)}</b>`;
    }
    case 'idari_bina':
      return `İdari Hizmetler +${idariKatki(duzeyToplami(state, 'idari_bina'))} → <b>+${idariKatki(duzeyToplami(state, 'idari_bina', degisen))}</b>`;
    case 'ulasim_merkezi':
      return `Ulaşım +${ulasimKatki(duzeyToplami(state, 'ulasim_merkezi'))} → <b>+${ulasimKatki(duzeyToplami(state, 'ulasim_merkezi', degisen))}</b>`;
    default:
      return 'değişmez. Bu türün etkisi düzeye bağlı değil, yalnız alan ve bakım büyür';
  }
}

/** Sonraki düzey kartı: maliyet, süre, kapasite ve bakım değişimi, etkideki değişim; ya da neden yükseltilemediği. */
function sonrakiDuzeyKarti(state, b, tanim, h) {
  const s = sonrakiDuzey(b, state);
  if (!s) return '';
  const kasa = Number(state.university?.budget) || 0;
  if (!b.isCompleted) return kart('Sonraki düzey', '<div class="ob-aciklama">Yapım bitince yükseltilebilir.</div>');
  if (b.status === 'upgrading') {
    const hedef = b._pendingLevel ?? s.sonraki;
    const sonra = h.kapasiteParcalari(duzeyKapasitesi(tanim, hedef), derslikBoyu(tanim, hedef));
    return kart('Sonraki düzey', `
      <div class="ob-aciklama">Düzey ${h.ek(hedef)} yükseltme sürüyor${b.turnsRemaining != null ? `, ${b.turnsRemaining} dönem kaldı` : ''}. Bu sürede bina mevcut kapasitesiyle çalışır.</div>
      ${sonra.length ? h.satir('Bitince', sonra.join(' · ')) : ''}
      ${hedef === s.sonraki ? h.satir('Bitince dönemlik bakım', h.para(s.bakim)) : ''}`);
  }
  if (s.ustte) {
    return kart('Sonraki düzey', `<div class="ob-dizi"><span class="ob-rozet ob-rozet--iyi">En üst düzeyde</span><span class="ob-soluk">Düzey ${s.duzey}/${s.enCok}</span></div>`);
  }
  const simdiBoy = derslikBoyu(tanim, s.duzey);
  const sonraBoy = derslikBoyu(tanim, s.sonraki);
  const simdi = h.kapasiteParcalari(b.currentCapacity || duzeyKapasitesi(tanim, s.duzey), simdiBoy);
  const sonra = h.kapasiteParcalari(s.kapasite, sonraBoy);
  const bakimSimdi = binaBakimi(b, state).tutar;
  const etki = yukseltmeEtkisi(state, b, h);

  const kisit = state._internal?.spendingRestricted
    ? '<div class="ob-aciklama ob-aciklama--kritik">Kasa açığı nedeniyle YÖK denetimi sürüyor. Yükseltme donduruldu.</div>'
    : kasa < s.maliyet
      ? `<div class="ob-aciklama ob-aciklama--kritik">Kasada yeterli para yok (gerekli ${h.para(s.maliyet)}, kasada ${h.para(kasa)}).</div>`
      : '';
  return kart(`Düzey ${h.ek(s.sonraki)} yükseltme`, `
    ${h.satir('Maliyet', `${h.para(s.maliyet)} <span class="ob-soluk">kasada ${h.para(kasa)}</span>`, kasa < s.maliyet ? 'ob-kritik' : '')}
    ${h.satir('Süre', `${s.sure} dönem`)}
    ${sonra.length ? h.satir('Kapasite', `${simdi.join(' · ') || 'yok'} → <b>${sonra.join(' · ')}</b>`) : ''}
    ${h.satir('Alan', `${h.sayi(b.area || 0)} → ${h.sayi(s.alan)} m²`)}
    ${h.satir('Dönemlik bakım', `${h.para(bakimSimdi)} → ${h.para(s.bakim)} <span class="ob-soluk">(+${h.para(s.bakim - bakimSimdi)})</span>`)}
    ${h.satir('Etkisi', etki)}
    <div class="ob-aciklama">Yükseltme sürerken bina mevcut kapasitesiyle çalışır.</div>
    ${kisit}`);
}

/** Üst kısım: görsel, ad (yeniden adlandırma yeri), tür ve düzey, durum, işlev. */
function ustKisim(b, tanim, h) {
  const enCok = tanim?.maxLevel ?? 3;
  const duzey = b.level || 1;
  const turAdi = tanim?.name || b.type;
  const ad = b.name || turAdi;
  const gorsel = b.isCompleted
    ? h.gorsel(b.type, Math.min(duzey, enCok), 96)
    : h.gorsel(b.type, 1, 96, Math.round(b.constructionProgress ?? 0));
  return `
    <header class="bina-sayfa-ust">
      <span class="bina-sayfa-gorsel">${gorsel}</span>
      <div class="bina-sayfa-kimlik">
        <div class="ob-kimlik-ad bina-sayfa-ad" data-bina-ad-kap><span data-bina-ad>${h.esc(ad)}</span></div>
        <div class="ob-kimlik-alt">${ad !== turAdi ? `${h.esc(turAdi)} · ` : ''}${h.puan(duzey, enCok, { etiket: 'Düzey' })} Düzey ${duzey}/${enCok} · ${h.sayi(b.area || 0)} m²</div>
        <div class="bina-sayfa-durum">${durumRozeti(b, h)}</div>
        ${ISLEV[b.type] ? `<p class="bina-sayfa-islev">${ISLEV[b.type]}</p>` : ''}
      </div>
    </header>
    ${b.isCompleted ? '' : `<div class="ob-cubuk ob-cubuk--uyari bina-sayfa-ilerleme"><span style="width:${Math.max(0, Math.min(100, Math.round(b.constructionProgress ?? 0)))}%"></span></div>`}`;
}

/** İşlemler: yükselt, bölüm ata ya da bağla, adını değiştir, yerini değiştir (tanımlıysa). */
function islemler(state, b, tanim, h) {
  const s = sonrakiDuzey(b, state);
  const kasa = Number(state.university?.budget) || 0;
  const dugmeler = [];
  if (s && b.isCompleted && b.status !== 'upgrading' && !s.ustte) {
    const engel = state._internal?.spendingRestricted ? 'YÖK denetimi sürüyor' : kasa < s.maliyet ? 'Yetersiz bütçe' : '';
    dugmeler.push(`<button type="button" class="btn btn-primary btn-sm" data-bina-eylem="yukselt"${engel ? ` disabled title="${engel}"` : ''}>Düzey ${h.ek(s.sonraki)} yükselt · ${h.para(s.maliyet)} · ${s.sure} dönem</button>`);
  }
  if (tanim?.assignable && b.isCompleted) {
    dugmeler.push(`<button type="button" class="btn btn-secondary btn-sm" data-bina-eylem="ata">${b.type === 'lab' ? 'Bölüm bağla' : 'Bölüm ata'}</button>`);
  }
  dugmeler.push('<button type="button" class="btn btn-ghost btn-sm" data-bina-eylem="adlandir">Adını değiştir</button>');
  if (typeof window !== 'undefined' && typeof window._yerleskeDuzenle === 'function') {
    dugmeler.push('<button type="button" class="btn btn-ghost btn-sm" data-bina-eylem="yerini">Yerini değiştir</button>');
  }
  return `<div class="ob-dugmeler bina-sayfa-eylemler">${dugmeler.join('')}</div>`;
}

/** Üstteki gösterge kutuları: düzey, alan, dönemlik bakım, türün ana kapasitesi. */
function gostergeler(state, b, tanim, h) {
  const bitti = !!b.isCompleted;
  const kap = bitti ? (b.currentCapacity || {}) : duzeyKapasitesi(tanim, 1);
  const bakim = binaBakimi(b, state);
  const kutular = [
    h.kutu('Düzey', `${b.level || 1}<small>/${tanim?.maxLevel ?? 3}</small>`, bitti ? (b.status === 'upgrading' ? 'yükseltiliyor' : 'etkin') : 'yapım aşamasında'),
    h.kutu('Alan', `${h.sayi(b.area || 0)}<small>m²</small>`, tanim?.areaPerLevel ? `düzey başına +${h.sayi(tanim.areaPerLevel)} m²` : ''),
    h.kutu('Dönemlik bakım', bakim.yapimda ? h.para(0) : h.para(bakim.odenen),
      bakim.yapimda ? `bitince ${h.para(bakim.tutar)}` : (bakim.zorluk !== 1 ? 'durum, düzey ve zorluk dahil' : 'durum ve düzey dahil')),
  ];
  const duzey = bitti ? (b.level || 1) : 1;
  if ((kap.classrooms || 0) > 0) {
    const boy = derslikBoyu(tanim, duzey);
    kutular.push(h.kutu('Koltuk', h.sayi(kap.classrooms * boy), `${h.sayi(kap.classrooms)} derslik × ${h.sayi(boy)} kişi`));
  } else if (b.type === 'lab') {
    kutular.push(h.kutu('Bağlı bölüm', h.sayi((b.linkedDepartments || []).length), `${h.sayi(kap.labs || 0)} laboratuvar odasını paylaşır`));
  } else if (b.type === 'arastirma_merkezi') {
    kutular.push(h.kutu('Bağlı bölüm', h.sayi((b.assignedDepartments || []).length), 'yayın ve proje ×1,15'));
  } else if (kap.daily) {
    kutular.push(h.kutu('Günlük kapasite', h.sayi(kap.daily), `aynı anda ${h.sayi(kap.simultaneous || 0)}`));
  } else if (kap.beds) {
    kutular.push(h.kutu('Yatak', h.sayi(kap.beds)));
  } else if (kap.dailyMeals) {
    kutular.push(h.kutu('Günlük öğün', h.sayi(kap.dailyMeals)));
  } else if (kap.dailyUsers) {
    kutular.push(h.kutu('Günlük kullanıcı', h.sayi(kap.dailyUsers)));
  } else if (kap.dailyPatients) {
    kutular.push(h.kutu('Günlük hasta', h.sayi(kap.dailyPatients)));
  } else if (kap.offices) {
    kutular.push(h.kutu('Ofis', h.sayi(kap.offices)));
  }
  return `<div class="ob-kutular bina-sayfa-kutular">${kutular.join('')}</div>`;
}

/**
 * Bina Sayfası'nın başlığı ve içeriği (HTML). Bina yoksa null.
 * @param {object} state  getState() kopyası
 * @param {string} binaId
 * @param {object} h      ui.js yardımcıları (binaSayfasiniGoster verir)
 */
export function binaSayfasiHtml(state, binaId, h) {
  const b = (state?.buildings || []).find(x => x.id === binaId);
  if (!b) return null;
  const tanim = BUILDINGS[b.type];
  if (!tanim) {
    return {
      baslik: 'Bina Sayfası',
      html: `<div class="bina-sayfa" data-bina="${h.esc(b.id)}">${ustKisim(b, null, h)}<div class="ob-bos ob-bos--kucuk">Bu bina türü tanınmıyor.</div></div>`,
    };
  }
  const dagilim = kapasiteDagilimi(state);
  dagilim.lab = labDagilimi(state);   // laboratuvar odası dağılımı (oyunun yazdığı alanlar yoksa)
  return {
    baslik: 'Bina Sayfası',
    html: `
      <div class="bina-sayfa" data-bina="${h.esc(b.id)}">
        ${ustKisim(b, tanim, h)}
        ${islemler(state, b, tanim, h)}
        ${gostergeler(state, b, tanim, h)}
        <div class="bina-sayfa-govde">
          <div class="bina-sayfa-ana">
            ${kapasiteKarti(state, b, tanim, h, dagilim)}
            ${bolumlerKarti(state, b, tanim, h, dagilim)}
            ${etkiKarti(state, b, tanim, h)}
          </div>
          <div class="bina-sayfa-yan">
            ${sonrakiDuzeyKarti(state, b, tanim, h)}
            ${bakimKarti(state, b, h)}
          </div>
        </div>
      </div>`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PENCERE VE İŞLEMLER
// ─────────────────────────────────────────────────────────────────────────────

/** Adı pencerede düzenler: girdi, Kaydet ve Vazgeç. Enter kaydeder, Esc vazgeçer (pencere kapanmaz). */
function adDuzenlemeyiAc(kok, b, h, islem) {
  const kap = kok.querySelector('[data-bina-ad-kap]');
  if (!kap || kap.querySelector('input')) return;
  const eski = b.name || BUILDINGS[b.type]?.name || b.type;
  const ilk = kap.innerHTML;
  kap.innerHTML = `
    <span class="bina-sayfa-ad-form">
      <input type="text" class="ob-arama bina-sayfa-ad-girdi" maxlength="60" value="${h.esc(eski)}" aria-label="Binanın yeni adı">
      <button type="button" class="btn btn-primary btn-sm" data-bina-eylem="ad-kaydet">Kaydet</button>
      <button type="button" class="btn btn-ghost btn-sm" data-bina-eylem="ad-vazgec">Vazgeç</button>
    </span>`;
  const girdi = kap.querySelector('input');
  const vazgec = () => { kap.innerHTML = ilk; };
  const kaydet = () => {
    const yeni = girdi.value.trim();
    if (!yeni || yeni === eski) { vazgec(); return; }
    islem.onDecision?.({ type: 'rename_building', buildingId: b.id, newName: yeni }, { yenidenAc: true });
  };
  kap._kaydet = kaydet;
  kap._vazgec = vazgec;
  girdi.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); kaydet(); }
    // Esc yalnız düzenlemeyi bıraksın; belge düzeyindeki Esc pencereyi kapatıyor
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); vazgec(); }
  });
  girdi.focus();
  girdi.select();
}

/**
 * Bina Sayfası'nı geniş pencerede açar ve işlemlerini bağlar.
 * @param {object} state      getState() kopyası (pencere bu anın durumunu gösterir)
 * @param {string} binaId
 * @param {object} h          ui.js yardımcıları: para, sayi, ondalik, ek, esc, puan, kutu, satir, gorsel,
 *                            bolumIkonu, kapasiteParcalari, showModal, hideModal, showConfirmModal,
 *                            showNotification, yukseltmeOnayi, bolumAtamaPenceresi
 * @param {{ onDecision?: Function, yenidenAc?: Function }} islem
 *   onDecision(karar, { yenidenAc }): kararı uygular (main.js); yenidenAc true ise sayfa güncel durumla yeniden açılır.
 *   yenidenAc(): sayfayı güncel durumla yeniden açar (yükseltme onayından vazgeçince).
 * @returns {boolean} pencere açıldıysa true
 */
export function binaSayfasiniCiz(state, binaId, h, islem = {}) {
  const sayfa = binaSayfasiHtml(state, binaId, h);
  if (!sayfa) {
    h.showNotification?.('Bina bulunamadı.', 'warning');
    return false;
  }
  h.showModal(sayfa.baslik, sayfa.html, { wide: true });
  const kok = document.getElementById('general-modal-body')?.querySelector('.bina-sayfa');
  // Kilitli bir olay penceresi açıksa showModal yazmaz; sayfa yoksa dinleyici de kurulmaz
  if (!kok || kok.dataset.bina !== String(binaId)) return false;
  const b = (state.buildings || []).find(x => x.id === binaId);

  kok.addEventListener('click', (e) => {
    const dugme = e.target.closest('[data-bina-eylem]');
    if (!dugme || !kok.contains(dugme) || dugme.disabled) return;
    switch (dugme.dataset.binaEylem) {
      case 'yukselt': {
        const onay = h.yukseltmeOnayi(b, Number(state.university?.budget) || 0, state);
        if (!onay) { islem.onDecision?.({ type: 'upgrade_building', buildingId: b.id }, { yenidenAc: true }); break; }
        h.showConfirmModal(onay.baslik, onay.html,
          () => islem.onDecision?.({ type: 'upgrade_building', buildingId: b.id }, { yenidenAc: true }),
          { onayMetni: `Onayla (${h.para(onay.maliyet)})`, onVazgec: () => islem.yenidenAc?.() });
        break;
      }
      case 'ata':
        // Atama penceresi aynı pencere kabını kullanır (her tık bir karar). Pencere kapanınca
        // (✕, Esc, arka plan) Bina Sayfası güncel durumla yeniden açılır.
        h.bolumAtamaPenceresi(state, b, (karar) => islem.onDecision?.(karar), { onKapat: () => islem.yenidenAc?.() });
        break;
      case 'adlandir':
        adDuzenlemeyiAc(kok, b, h, islem);
        break;
      case 'ad-kaydet':
        dugme.closest('[data-bina-ad-kap]')?._kaydet?.();
        break;
      case 'ad-vazgec':
        dugme.closest('[data-bina-ad-kap]')?._vazgec?.();
        break;
      case 'yerini':
        h.hideModal();
        if (typeof window._yerleskeDuzenle === 'function') window._yerleskeDuzenle(b.id);
        break;
      case 'bolum':
        h.hideModal();
        if (typeof window._openDeptPage === 'function') window._openDeptPage(dugme.dataset.bolum, 'yerleske');
        break;
      default:
        break;
    }
  });
  return true;
}
