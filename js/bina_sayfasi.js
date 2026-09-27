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
 * data.js'teki effects / qualityEffects alanları oyunda kullanılmadığı için burada okunmaz.
 */

import { BUILDINGS } from './data.js?v=0.7.0';

// ─────────────────────────────────────────────────────────────────────────────
// OYUNUN SABİTLERİ (kaynaktaki değerlerin aynısı)
// ─────────────────────────────────────────────────────────────────────────────

export const SINIF_SAYISI = 4;       // game.js SINIF_SAYISI: bir koltuk bir yıllık alım, dört sınıf
const YEDEK_KOLTUK       = 40;       // game.js YEDEK_KOLTUK: dersliği olmayan bölüm tek derslik sayılır
const BAKIM_DURUM_OLCEGI = 0.5;      // economy.js MAINTENANCE_QUALITY_SCALE
const BAKIM_DUZEY_ARTISI = 0.25;     // economy.js BINA_DUZEY_BAKIM_ARTISI
const MERKEZ_ARTISI      = 0.15;     // game.js _getResearchCenterBonus: merkez başına
const MERKEZ_TAVANI      = 1.30;     // game.js _getResearchCenterBonus: üst sınır
const LAB_PUANI_DUZEY    = 25;       // game.js _recalcDeptLabScores: düzey başına laboratuvar puanı

/** Öğrenci memnuniyeti bileşenlerinin ağırlığı (students.js calculateStudentSatisfaction). */
const MEMNUNIYET_AGIRLIGI = { sosyal: 0.10, yurt: 0.10, yemek: 0.07, spor: 0.05, ulasim: 0.05, idari: 0.12 };

/** Türün bir satırlık işlevi (ne işe yarar). data.js açıklamaları oyunda olmayan etkiler yazdığı için kullanılmaz. */
const ISLEV = {
  fakulte_binasi:    'Derslik ve ofis binası. Derslikleri bölümlerin öğrenci kapasitesini belirler.',
  amfi:              'Büyük derslikler. Koltukları bölümlerin öğrenci kapasitesine eklenir.',
  arastirma_merkezi: 'Bağlı bölümlerin araştırmasını güçlendirir. Dersliği yok.',
  lab:               'Bağlı bölümlerin laboratuvar puanını yükseltir.',
  kutuphane:         'Yerleşkenin çalışma alanı. Sosyal Yaşam puanını artırır.',
  yurt:              'Öğrenci yatakları. Yurt İmkânı puanını artırır.',
  yemekhane:         'Öğrenci ve hocalara günlük öğün. Yemekhane puanını artırır.',
  spor_tesisi:       'Spor alanı. Spor Tesisleri puanını artırır, takım kurmayı açar.',
  konferans:         'Etkinlik ve konferans merkezi. Uluslararasılaşma puanını artırır.',
  saglik_merkezi:    'Öğrenci ve personele sağlık hizmeti. İdari Hizmetler puanını artırır.',
  idari_bina:        'Rektörlük ve idari birimler. İdari Hizmetler puanını artırır.',
  teknokent:         'Girişimcilik ve sanayi binası. Şu an oyun hesabında bir etkisi yok.',
  ulasim_merkezi:    'Ring ve servis durağı. Ulaşım puanını artırır.',
};

/**
 * Türün oyundaki etkisinin kısa dökümü: inşaat seçeneği kartı ve inşaat onayı (ui.js
 * _formatBuildingEffects) bunu gösterir. Bina Sayfası'ndaki ayrıntılı etkiyle aynı içerik.
 * @param {string} tur
 * @returns {string[]}
 */
export function binaEtkiOzeti(tur) {
  switch (tur) {
    case 'fakulte_binasi':
    case 'amfi':
      return ['Derslikleri bölümlerin öğrenci kapasitesini ve yeni alımını belirler (koltuk × 4 sınıf)'];
    case 'arastirma_merkezi':
      return ['Bağlı bölümde yayın beklentisi ×1,15', 'Bağlı bölümde dış proje kabul olasılığı ×1,15'];
    case 'lab':
      return ['Bağlı bölümün laboratuvar puanına düzey × 25'];
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
    case 'teknokent':
      return ['Şu an oyun hesabında bir etkisi yok'];
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

/**
 * Bölüme bağlı binanın kullanımı: derslik, ofis, laboratuvar odası (game.js calculateBuildingUsage).
 * Laboratuvar binası bağlı bölümlerini (linkedDepartments), öteki binalar atanmış bölümlerini sayar.
 */
function bolumKullanimi(b, state) {
  let derslik = 0, lab = 0, prof = 0, dr = 0, argo = 0;
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
    if (dept.category === 'muhendislik' || dept.category === 'fen') lab += Math.ceil(ogrenci / 60);
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
  return { classrooms: derslik, offices: ofis, labs: lab };
}

/**
 * Binanın oyunun hesapladığı kullanımı (game.js _updateAllBuildingUsage; her dönem sonunda ve
 * bölüm atanınca yazılır). Tamamlanmamış binada null.
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
    default:            return bolumKullanimi(b, state);
  }
}

/**
 * Dönemlik bakım gideri ve dökümü (economy.js calculateExpenses, 4. altyapı bakımı).
 * Yapım sürerken ödenmez (odenen 0); tutar bina bitince ödenecek olandır.
 */
export function binaBakimi(b) {
  const tanim = BUILDINGS[b?.type];
  const sayi = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const yapimda = !b?.isCompleted;
  let taban = 0, yontem = 'yok';
  if (tanim) {
    if (tanim.maintenanceCostPerM2 != null && b.area) {
      taban = sayi(b.area) * sayi(tanim.maintenanceCostPerM2); yontem = 'alan';
    } else if (b.maintenanceCost) {
      taban = sayi(b.maintenanceCost); yontem = 'kayit';
    } else {
      taban = sayi(tanim.constructionCost || tanim.baseCost) * sayi(tanim.maintenanceCostRatio || 0.05) / 2; yontem = 'oran';
    }
  }
  const durum = sayi(b?.condition || 80);
  const durumCarpani = 1 + (1 - durum / 100) * BAKIM_DURUM_OLCEGI;
  const duzey = sayi(b?.level || 1);
  const duzeyCarpani = 1 + BAKIM_DUZEY_ARTISI * Math.max(0, duzey - 1);
  const tutar = tanim ? taban * durumCarpani * duzeyCarpani : 0;
  return { yapimda, odenen: yapimda ? 0 : tutar, tutar, taban, yontem, alan: sayi(b?.area), m2: sayi(tanim?.maintenanceCostPerM2), durum, durumCarpani, duzey, duzeyCarpani };
}

/** Sonraki düzey: maliyet ve süre (game.js upgrade_building), alan, kapasite ve bakım (yükseltme bitince). */
export function sonrakiDuzey(b) {
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
    bakim:    binaBakimi({ ...b, isCompleted: true, area: alan, level: sonraki }).tutar,
  };
}

/** Bölümün araştırma merkezi çarpanı (game.js _getResearchCenterBonus). */
function merkezCarpani(state, deptId) {
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

/** Laboratuvar odası payı alanları (laboratuvar kapasitesi işi ekler) binada ya da bölümlerinde var mı. */
function labAlanlariVar(b, depts) {
  return (b?.labPaylari != null && typeof b.labPaylari === 'object')
    || depts.some(d => d?.labIhtiyaci != null || d?.labAyrilan != null || d?.labKarsilama != null);
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
          ? `Bu binaya bölüm atanmadı. Derslikleri, kendine derslik binası atanmamış bölümlerin ortak alanı${dagilim.ortakBinaSayisi > 1 ? ` (${dagilim.ortakBinaSayisi} bina, toplam ${sayi(dagilim.ortakKoltuk)} koltuk; bu bina koltuğu oranında pay taşır)` : ''}.`
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
        satirlar.push(not('Bu binaya bağlı bölümlerin hocaları sayılır. Prof. ve Doç. tek ofis alır; boş ofis yetmezse Dr. Öğr. Üyeleri ikişer, araştırma görevlileri üçer kişi paylaşır. Ofis doluluğu şu an bir ceza ya da ödül doğurmuyor.'));
      } else if (bitti) {
        satirlar.push(not('Ofis kullanımı yalnız bu binaya atanmış bölümlerin hocaları için hesaplanır; ofis doluluğu şu an bir ceza ya da ödül doğurmuyor.'));
      }
    } else {
      satirlar.push(not('Oyun bu ofislere kimseyi yerleştirmiyor; ofis sayısının bir sonucu yok.'));
    }
  }

  if ((kap.labs || 0) > 0 && (b.type === 'lab' || b.type === 'arastirma_merkezi')) {
    satirlar.push(h.satir('Laboratuvar odası', sayi(kap.labs)));
    const liste = b.type === 'lab' ? (b.linkedDepartments || []) : (b.assignedDepartments || []);
    const depts = liste.map(id => (state.departments || []).find(d => d.id === id)).filter(Boolean);
    if (labAlanlariVar(b, depts)) {
      const ayrilan = Object.values(b.labPaylari || {}).reduce((s, v) => s + (Number(v) || 0), 0);
      satirlar.push(h.satir('Bölümlere ayrılan oda', `${sayi(ayrilan)} <span class="ob-soluk">/ ${sayi(kap.labs)}</span>`, ayrilan > kap.labs ? 'ob-kritik' : ''));
      satirlar.push(not('Odaların bölümlere dağılımı aşağıdaki Bölümler kartında.'));
    } else if (bitti) {
      satirlar.push(h.satir('Kullanılan oda', `${sayi(kul.labs)} <span class="ob-soluk">/ ${sayi(kap.labs)}</span>`, (kul.labs || 0) > kap.labs ? 'ob-kritik' : ''));
      satirlar.push(not(`Bağlı mühendislik bölümlerinin her 60 öğrencisine bir oda sayılır. Oda sayısı şu an bir sonucu etkilemiyor${b.type === 'lab' ? '; katkıyı yalnız düzey belirler' : ''}.`));
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
        satirlar.push(not('Oyun her öğrenciyi günde bir kez, öğrencilerin dörtte birini aynı anda sayar; kullanım kapasiteyle sınırlı.'));
      }
      break;
    }
    case 'yurt': {
      satirlar.push(h.satir('Yatak', sayi(kap.beds || 0)));
      if (kul) {
        const oran = kap.beds ? kul.beds / kap.beds : 0;
        satirlar.push(h.satir('Dolu yatak', `${sayi(kul.beds)} <span class="ob-soluk">/ ${sayi(kap.beds || 0)}</span>`));
        satirlar.push(cubuk(oran, 'iyi'));
        satirlar.push(not('Oyun öğrencilerin %40\'ını yurtta sayar; dolu yatak kapasiteyle sınırlı. Memnuniyet hesabı ise toplam yatağı bütün öğrencilerle karşılaştırır.'));
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
        satirlar.push(not(`İhtiyaç ${sayi(ogrenci)} öğrenci ile ${sayi(hoca)} hocanın toplamı; her kişi günde bir öğün sayılır.`));
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
        satirlar.push(not('Oyun öğrencilerin %60\'ını günlük kullanıcı sayar; kullanım kapasiteyle sınırlı.'));
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
 * v0.7.2 laboratuvar payı kancası: laboratuvar kapasitesi işi binaya labPaylari ({bölüm: oda}),
 * bölüme labIhtiyaci, labAyrilan ve labKarsilama (0-1) ekleyince bağlı bölümlerin ihtiyaç,
 * ayrılan oda ve karşılama tablosu. Alanlar yoksa boş döner (bölüm listesi yeter).
 */
export function labPayTablosu(state, b, h) {
  if (b?.type !== 'lab' && b?.type !== 'arastirma_merkezi') return '';
  const liste = b.type === 'lab' ? (b.linkedDepartments || []) : (b.assignedDepartments || []);
  const depts = liste.map(id => (state.departments || []).find(d => d.id === id)).filter(d => d && d.isOpen !== false);
  if (depts.length === 0 || !labAlanlariVar(b, depts)) return '';
  const sayi = (v) => (v == null || !Number.isFinite(Number(v)) ? '<span class="ob-soluk">yok</span>' : h.sayi(v));
  const satirlar = depts.map(d => {
    const karsilama = Number(d.labKarsilama);
    const var_ = d.labKarsilama != null && Number.isFinite(karsilama);
    const tur = !var_ ? '' : karsilama >= 1 ? 'ob-iyi' : karsilama >= 0.7 ? 'ob-uyari' : 'ob-kritik';
    return `
      <tr>
        <td class="ob-ad">${h.esc(d.shortName || d.name)}</td>
        <td class="n">${sayi(d.labIhtiyaci)}</td>
        <td class="n ob-tek">${sayi(b.labPaylari?.[d.id])}<span class="ob-soluk"> / ${sayi(d.labAyrilan)}</span></td>
        <td class="n ${tur}">${var_ ? `%${Math.round(karsilama * 100)}` : '<span class="ob-soluk">yok</span>'}</td>
      </tr>`;
  }).join('');
  return `
    <div class="bina-lab-tablo">
      <div class="bina-alt-baslik">Laboratuvar odası payları</div>
      <div class="ob-tablo-kap"><table class="ob-tablo ob-tablo--dar">
        <thead><tr><th>Bölüm</th><th class="n">İhtiyaç</th><th class="n">Ayrılan</th><th class="n">Karşılama</th></tr></thead>
        <tbody>${satirlar}</tbody>
      </table></div>
      <div class="ob-tablo-dip">Ayrılan sütununda önce bu binadan, sonra bölümün bütün laboratuvarlarından ayrılan oda yazılı. İhtiyaç ve karşılama bölümün bütününe göre.</div>
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
    return kart('Bölümler', not('Bu binaya bölüm atanmaz; bütün yerleşkeye hizmet eder.'));
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
      : not('Bu binaya atanmış bölümler ve bu binadan aldıkları yer. Yer dört sınıflıktır (koltuk × 4); bölüm %90\'ı aşınca başarısızlık artar.');
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

  if (b.type === 'lab') {
    const duzey = b.level || 1;
    const depts = (b.linkedDepartments || []).map(acikBolum).filter(Boolean);
    const satirlar = depts.map(d => {
      const gerek = Number(d.labRequirement) || 0;
      const alt = [
        `laboratuvar puanı ${sayi(Number(d.labScore) || 0)}/100`,
        gerek > 0 ? `gereksinim ${gerek}/5` : 'laboratuvar gerektirmiyor',
        derslikYeri(state, d, dagilim, h),
      ].join(' · ');
      return bolumSatiri(d, alt, `<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk">+${LAB_PUANI_DUZEY * duzey} puan</span>`, h);
    }).join('');
    const giris = not(`Bağlı bölüm fakülte binasında kalır, derslikleri ve öğrenci alımı değişmez. Bu bina bölümün laboratuvar puanına düzey × 25 ekler (şimdi +${LAB_PUANI_DUZEY * duzey}).`);
    return kart(`Bağlı bölümler${depts.length ? ` <span class="ob-sayi">${depts.length}</span>` : ''}`,
      `${giris}${satirlar ? `<div class="bina-bolum-liste">${satirlar}</div>` : not('Henüz bağlı bölüm yok. "Bölüm bağla" düğmesiyle bağlayabilirsiniz.')}${labPayTablosu(state, b, h)}`);
  }

  // Dersliği olmayan atanabilir bina (araştırma merkezi): bağlı bölüm burada ders vermez
  const depts = (b.assignedDepartments || []).map(acikBolum).filter(Boolean);
  const satirlar = depts.map(d => {
    const carpan = merkezCarpani(state, d.id);
    const hoca = (state.faculty || []).filter(f => (f.department || f.departmentId) === d.id).length;
    const alt = [`${sayi(hoca)} hoca`, derslikYeri(state, d, dagilim, h)].join(' · ');
    return bolumSatiri(d, alt, `<span class="ob-rozet ob-rozet--iyi ob-rozet--kucuk" title="Yayın beklentisi ve dış proje kabul olasılığı çarpanı">×${h.ondalik(carpan, 2)}</span>`, h);
  }).join('');
  const giris = b.type === 'arastirma_merkezi'
    ? not('Bağlı bölüm burada ders vermez ve öğrenci almaz; derslikleri ve öğrenci alımı kendi binasında sürer. Merkez, bu bölümün hocalarının yayın beklentisini ve dış proje kabul olasılığını 1,15 katına çıkarır; bölüm iki merkeze bağlıysa 1,30 katına.')
    : not('Bağlı bölüm burada ders vermez; derslikleri ve öğrenci alımı kendi binasında sürer.');
  return kart(`Bağlı bölümler${depts.length ? ` <span class="ob-sayi">${depts.length}</span>` : ''}`,
    `${giris}${satirlar ? `<div class="bina-bolum-liste">${satirlar}</div>` : not('Henüz bağlı bölüm yok. "Bölüm ata" düğmesiyle bağlayabilirsiniz.')}${labPayTablosu(state, b, h)}`);
}

/** Oyundaki etkisi: türün gerçekten yaptığı, oyunun hesabındaki büyüklükleriyle; hizmet binalarında şimdiki katkı. */
function etkiKarti(state, b, tanim, h) {
  const ond = (v, n = 1) => h.ondalik(v, n);
  const sayi = h.sayi;
  const bitti = !!b.isCompleted;
  const duzey = bitti ? (b.level || 1) : 1;
  const zaman = bitti ? 'Şimdi' : 'Bina bitince';
  const degisen = bitti ? null : { id: b.id, kapasite: duzeyKapasitesi(tanim, 1), duzey: 1 };
  const maddeler = [];
  const memnuniyetNotu = 'Öğrenci memnuniyeti kalite puanına ve saygınlığa da yansır.';
  const idariNotu = (birim, deger) => `İdari sekmesinde ${birim} birimine "+%${deger} verimlilik" yazılır; bu yalnız gösterimdir, bir sonucu yok.`;
  const hizmet = (tur) => {
    const k = hizmetKatkisi(state, tur, degisen);
    return k ? { ...k, genel: k.puan * k.agirlik } : null;
  };

  switch (b.type) {
    case 'fakulte_binasi':
    case 'amfi':
      maddeler.push(
        'Derslik koltukları bölümlerin öğrenci kapasitesini belirler. Bir koltuk bir yıllık alım sayılır; dört sınıf için koltuk × 4.',
        'Yeni alım, kapasiteden üst sınıflara geçecek öğrenciler çıkınca kalan yerle sınırlı.',
        'Bölümün öğrenci sayısı yerinin %90\'ını aşınca başarısızlık oranı 5 puan, %100\'ünü aşınca 10 puan artar.',
        'Doluluk %70\'i aşınca not ortalaması biraz düşer.',
      );
      break;
    case 'arastirma_merkezi':
      maddeler.push(
        'Bağlı bölümün hocalarının dönemlik yayın beklentisi 1,15 katına çıkar. Bölüm iki merkeze bağlıysa 1,30 katına; daha fazlası artırmaz.',
        'Bağlı bölümün hocalarının dış proje başvurularında kabul olasılığı 1,15 katına çıkar (iki merkezle 1,30). Olasılık en çok %92.',
        'Çarpan merkezin düzeyine bağlı değil.',
      );
      if (!labAlanlariVar(b, (b.assignedDepartments || []).map(id => (state.departments || []).find(d => d.id === id)).filter(Boolean))) {
        maddeler.push('Merkezin ofis ve laboratuvar odaları şu an bir sonucu etkilemiyor; yalnız Yerleşke özetindeki toplamlara eklenir.');
      }
      break;
    case 'lab':
      maddeler.push(
        `Bağlı her bölümün laboratuvar puanına düzey × 25 ekler, şimdi +${LAB_PUANI_DUZEY * duzey}. Puan en çok 100; laboratuvar gerektiren bölümde taban 30.`,
        'Akreditasyonda her 25 laboratuvar puanı bir laboratuvar sayılır.',
        'Laboratuvar gereksinimi 2 ve üstü olan bölümde yayın beklentisi puana göre ×0,94 (30 puan) ile ×1,15 (100 puan) arasında değişir.',
        'Laboratuvar gerektirmeyen bölümün puanı zaten 100; bağlamak bir şey değiştirmez.',
      );
      break;
    case 'kutuphane': {
      const k = hizmet('kutuphane');
      maddeler.push(
        'Yerleşkedeki kütüphanelerin günlük kapasitesi öğrenci sayısını karşıladığı oranda Sosyal Yaşam puanına en çok +20 ekler.',
        `${zaman} günde ${sayi(k.toplam)} kişi, ${sayi(k.ihtiyac)} öğrenci; karşılama %${Math.round(k.oran * 100)}, katkı <b>+${ond(k.puan)}</b>.`,
        `Sosyal Yaşam öğrenci memnuniyetinin %10'u; bu katkı genel memnuniyete yaklaşık +${ond(k.genel)} puan.`,
        'Aynı anda oturma kapasitesi yalnız gösterilir; memnuniyet hesabı günlük kapasiteye bakar.',
        idariNotu('Kütüphane Hizmetleri', 10),
        memnuniyetNotu,
      );
      break;
    }
    case 'yurt': {
      const k = hizmet('yurt');
      maddeler.push(
        'Yerleşkedeki toplam yatak öğrenci sayısını karşıladığı oranda Yurt İmkânı puanı 30\'dan 85\'e çıkar.',
        `${zaman} ${sayi(k.toplam)} yatak, ${sayi(k.ihtiyac)} öğrenci; karşılama %${Math.round(k.oran * 100)}, puana katkı <b>+${ond(k.puan)}</b>.`,
        `Yurt İmkânı öğrenci memnuniyetinin %10'u; genel memnuniyete yaklaşık +${ond(k.genel)} puan.`,
        'Oyun yurttan gelir hesaplamıyor.',
        memnuniyetNotu,
      );
      break;
    }
    case 'yemekhane': {
      const k = hizmet('yemekhane');
      maddeler.push(
        'Yemekhane puanı 30 + 33 × oran. Oran, yerleşkedeki günlük öğünün öğrenci ve hoca sayısına bölümü; en çok 1,2 sayılır.',
        `${zaman} günde ${sayi(k.toplam)} öğün, ${sayi(k.ihtiyac)} kişi; oran ${ond(k.oran, 2)}, katkı <b>+${ond(k.puan)}</b>.`,
        `Yemekhane öğrenci memnuniyetinin %7'si; genel memnuniyete yaklaşık +${ond(k.genel)} puan.`,
        'Hoca mutluluğunu etkilemiyor.',
        idariNotu('Yemekhane Yönetimi', 10),
        memnuniyetNotu,
      );
      break;
    }
    case 'spor_tesisi': {
      const k = hizmet('spor_tesisi');
      maddeler.push(
        'Spor Tesisleri puanı 38 + 28 × oran. Oran, yerleşkedeki günlük kullanıcı kapasitesinin öğrenci sayısına bölümü; en çok 1,2 sayılır.',
        `${zaman} günde ${sayi(k.toplam)} kullanıcı, ${sayi(k.ihtiyac)} öğrenci; oran ${ond(k.oran, 2)}, katkı <b>+${ond(k.puan)}</b>.`,
        `Spor Tesisleri öğrenci memnuniyetinin %5'i; genel memnuniyete yaklaşık +${ond(k.genel)} puan.`,
        'Basketbol, futbol, voleybol ve yüzme takımı kurmak için gerekli.',
        'Takımların maç gücüne +15 ekler; ikinci tesis bunu artırmaz.',
        memnuniyetNotu,
      );
      break;
    }
    case 'konferans':
      maddeler.push(
        'Kalite puanında Uluslararasılaşma bileşenine +15 ekler. Bileşenin ağırlığı %10, kalite puanına yaklaşık +1,5.',
        'Saygınlık her dönem kalite puanına yavaşça yaklaşır; sıralama hesabı da aynı +15\'i kullanır.',
        'Uluslararası sıralamada Uluslararası görünüm puanına +12.',
        'Sosyal Yaşam puanına +8 (öğrenci memnuniyetinin %10\'u).',
        'Etkisi düzeye bağlı değil.',
      );
      break;
    case 'saglik_merkezi':
      maddeler.push(
        'Sağlık hizmeti puanına +12. Bu puan İdari Hizmetler puanının beşte biri, İdari Hizmetler de öğrenci memnuniyetinin %12\'si; genel memnuniyete yaklaşık +0,3 puan.',
        'Etkisi düzeye ve günlük hasta kapasitesine bağlı değil.',
        idariNotu('Sağlık Merkezi', 15),
        memnuniyetNotu,
      );
      break;
    case 'idari_bina': {
      const katki = idariKatki(duzeyToplami(state, 'idari_bina', degisen));
      maddeler.push(
        `İdari Hizmetler puanına düzey 1'de +6, düzey 2'de +10, düzey 3'te +14 ekler. ${zaman} <b>+${katki}</b>.`,
        `İdari Hizmetler öğrenci memnuniyetinin %12'si; genel memnuniyete yaklaşık +${ond(katki * MEMNUNIYET_AGIRLIGI.idari)} puan.`,
        'İdari sekmesinde bütün birimlere düzeye göre "+%10, +%15, +%20 verimlilik" yazılır; bu yalnız gösterimdir, bir sonucu yok.',
        memnuniyetNotu,
      );
      break;
    }
    case 'ulasim_merkezi': {
      const katki = ulasimKatki(duzeyToplami(state, 'ulasim_merkezi', degisen));
      maddeler.push(
        `Ulaşım puanına düzey 1'de +12, düzey 2'de +18, düzey 3'te +24 ekler. ${zaman} <b>+${katki}</b>.`,
        `Ulaşım öğrenci memnuniyetinin %5'i; genel memnuniyete yaklaşık +${ond(katki * MEMNUNIYET_AGIRLIGI.ulasim)} puan.`,
        idariNotu('Ulaşım Hizmetleri', 10),
        memnuniyetNotu,
      );
      break;
    }
    case 'teknokent':
      maddeler.push(
        'Şu an oyun hesabında bu binaya bağlı bir etki yok; yalnız bakım gideri var.',
        'Bütçedeki sponsorluk (teknokent) geliri bu binayla açılmıyor. "Özel Sektör AR-GE Merkezi Teklifi" olayında teklif kabul edilince açılıyor.',
      );
      break;
    default:
      maddeler.push('Bu bina türünün oyundaki etkisi tanımlı değil.');
  }
  const ust = bitti ? '' : '<div class="ob-aciklama">Etkiler yapım bitince başlar.</div>';
  return kart('Oyundaki etkisi', `${ust}<ul class="ob-madde bina-etki">${maddeler.map(m => `<li>${m}</li>`).join('')}</ul>`);
}

/** Bakım gideri kartı: dönemlik tutar ve dökümü (economy.js), kayıtlıysa inşaat bedeli. */
function bakimKarti(b, h) {
  const k = binaBakimi(b);
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
  satirlar.push(`<div class="ob-satir ob-satir--toplam"><span>${k.yapimda ? 'Bina bitince dönemlik' : 'Dönemlik bakım'}</span><b>${h.para(k.tutar)}</b></div>`);
  satirlar.push(`<div class="ob-aciklama">${k.yapimda
    ? 'Yapım sürerken bakım ödenmez.'
    : 'Durum %100\'ün altındaysa bakım artar; her düzey m² başına bakımı %25 artırır.'}</div>`);
  if (Number.isFinite(Number(b.constructionCost)) && Number(b.constructionCost) > 0) {
    satirlar.push(h.satir('İnşaat bedeli', `${h.para(Number(b.constructionCost))} <span class="ob-soluk">ilk yapım</span>`));
  }
  return kart('Bakım gideri', satirlar.join(''));
}

/** Sonraki düzey kartı: maliyet, süre, kapasite ve bakım değişimi, etkideki değişim; ya da neden yükseltilemediği. */
function sonrakiDuzeyKarti(state, b, tanim, h) {
  const s = sonrakiDuzey(b);
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
  const bakimSimdi = binaBakimi(b).tutar;

  // Etkideki değişim (oyunun hesabıyla)
  let etki = '';
  const degisen = { id: b.id, kapasite: s.kapasite, duzey: s.sonraki };
  switch (b.type) {
    case 'fakulte_binasi':
    case 'amfi':
      etki = `${h.sayi(binaKoltugu(b))} → <b>${h.sayi((s.kapasite.classrooms || 0) * sonraBoy)}</b> koltuk`;
      break;
    case 'lab':
      etki = `bağlı bölüme +${LAB_PUANI_DUZEY * s.duzey} → <b>+${LAB_PUANI_DUZEY * s.sonraki}</b> laboratuvar puanı`;
      break;
    case 'kutuphane': case 'yurt': case 'yemekhane': case 'spor_tesisi': {
      const once = hizmetKatkisi(state, b.type);
      const sonr = hizmetKatkisi(state, b.type, degisen);
      etki = `${once.bilesen} +${h.ondalik(once.puan, 1)} → <b>+${h.ondalik(sonr.puan, 1)}</b>`;
      break;
    }
    case 'idari_bina':
      etki = `İdari Hizmetler +${idariKatki(duzeyToplami(state, 'idari_bina'))} → <b>+${idariKatki(duzeyToplami(state, 'idari_bina', degisen))}</b>`;
      break;
    case 'ulasim_merkezi':
      etki = `Ulaşım +${ulasimKatki(duzeyToplami(state, 'ulasim_merkezi'))} → <b>+${ulasimKatki(duzeyToplami(state, 'ulasim_merkezi', degisen))}</b>`;
      break;
    case 'arastirma_merkezi':
      etki = 'çarpan düzeye bağlı değil';
      break;
    default:
      etki = 'değişmez; yalnız alan ve bakım büyür';
  }

  const kisit = state._internal?.spendingRestricted
    ? '<div class="ob-aciklama ob-aciklama--kritik">Kasa açığı nedeniyle YÖK denetimi sürüyor; yükseltme donduruldu.</div>'
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
  const s = sonrakiDuzey(b);
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
  const bakim = binaBakimi(b);
  const kutular = [
    h.kutu('Düzey', `${b.level || 1}<small>/${tanim?.maxLevel ?? 3}</small>`, bitti ? (b.status === 'upgrading' ? 'yükseltiliyor' : 'etkin') : 'yapım aşamasında'),
    h.kutu('Alan', `${h.sayi(b.area || 0)}<small>m²</small>`, tanim?.areaPerLevel ? `düzey başına +${h.sayi(tanim.areaPerLevel)} m²` : ''),
    h.kutu('Dönemlik bakım', bakim.yapimda ? h.para(0) : h.para(bakim.odenen), bakim.yapimda ? `bitince ${h.para(bakim.tutar)}` : 'durum ve düzey dahil'),
  ];
  const duzey = bitti ? (b.level || 1) : 1;
  if ((kap.classrooms || 0) > 0) {
    const boy = derslikBoyu(tanim, duzey);
    kutular.push(h.kutu('Koltuk', h.sayi(kap.classrooms * boy), `${h.sayi(kap.classrooms)} derslik × ${h.sayi(boy)} kişi`));
  } else if (b.type === 'lab') {
    kutular.push(h.kutu('Bağlı bölüm', h.sayi((b.linkedDepartments || []).length), `+${LAB_PUANI_DUZEY * duzey} laboratuvar puanı`));
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
            ${bakimKarti(b, h)}
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
        const onay = h.yukseltmeOnayi(b, Number(state.university?.budget) || 0);
        if (!onay) { islem.onDecision?.({ type: 'upgrade_building', buildingId: b.id }, { yenidenAc: true }); break; }
        h.showConfirmModal(onay.baslik, onay.html,
          () => islem.onDecision?.({ type: 'upgrade_building', buildingId: b.id }, { yenidenAc: true }),
          { onayMetni: `Onayla (${h.para(onay.maliyet)})`, onVazgec: () => islem.yenidenAc?.() });
        break;
      }
      case 'ata':
        // Atama penceresi aynı pencere kabını kullanır; Bina Sayfası kapanır (her tık bir karar)
        h.bolumAtamaPenceresi(state, b, (karar) => islem.onDecision?.(karar));
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
