/**
 * Rektör Oldum: Toplu işlemler ve idari birimlerde otomatik personel (idari_otomatik.js), v0.7.1
 *
 * Oyuncu istekleri (X, 25 Eyl 2026): terfi ve işe alma akışı hızlansın (@alikaandev); idari birimler
 * (güvenlik, öğrenci işleri ...) kendiliğinden personel alabilsin, kademe sınırı olsun (@TarukM60676).
 *
 * T1 Toplu işlemler (Kadro ve İdari sekmeleri). Ölçüte uyan başvuruları tek tıklamayla kabul, kalanları
 * ret; unvan yükseltmeye hazır hocaları ve terfiye hazır idari personeli hep birlikte yükseltme. Toplu
 * işlem yeni kural getirmez, var olan tekil kararları döngüyle çağırır: applyDecision 'accept_applicant',
 * 'accept_spontaneous', 'reject_applicant', 'reject_spontaneous', 'promote_faculty' ve game.js
 * promoteAdminStaff. Devlette boş kadro, maaş sınırı (%60) ve kasa açığındaki alım dondurması böylece her
 * kabulde kendiliğinden denetlenir; takılan karar sonuçta nedeniyle yazar. Ölçüt state.topluOlcut'ta
 * (genel puan eşiği, bölüm başına bu dönem en çok alım, barem üstü maaş beklentisi). Başkana devredilen
 * bölümlerin başvurularına toplu işlem dokunmaz (onları başkan dönem sonunda değerlendirir).
 *
 * T2 Otomatik personel (İdari sekmesi). state.idariOtomatik.birimler[unitId] = { acik, kademe }, kademe
 * alınacak adayların en üst deneyim düzeyi ('junior' | 'mid' | 'senior'). Açık birimde her dönem sonunda
 * (nextTurn, başkanların kararlarından hemen sonra) eksik personel oyunun aday üretme ve işe alma
 * işlevleriyle (generateAdminCandidates, hireAdminStaff) kademe sınırını aşmadan, adaylar arasında
 * niteliği en yüksek olanla doldurulur; birim yöneticisi boşsa yönetici rütbesindeki personelden
 * liderliği en yüksek olan atanır (assignUnitManager). Kasa eksiyse ya da devlette maaş sınırı doluysa
 * (hoca maaşları dönem gelirinin %60'ına ulaştıysa) alım yapılmaz; alımlar bir dönemlik maaşlarıyla kasayı
 * eksiye düşürmez. Kararlar dönem özetine tek bir 'idari_otomatik' kaydıyla yazılır. İşlevler game.js'ten
 * parametreyle gelir (döngüsel içe aktarma yok). Kayıtlı oyunlarda ve yeni oyunda bütün birimler kapalıdır.
 */

import { ADMIN_UNITS, ADMIN_TITLES, SEMESTER_MONTHS } from './data.js?v=0.7.0';
import { calculateOverallRating, getSalaryRange } from './faculty.js?v=0.7.0';
import { kadroDurumu, maasGelirDurumu } from './economy.js?v=0.7.0';
import { politikaOku } from './baskan.js?v=0.7.0';

// ─────────────────────────────────────────────────────────────────────────────
// KÜÇÜK YARDIMCILAR
// ─────────────────────────────────────────────────────────────────────────────

/** Hoca unvanlarının adı ve yükseltme sırası (game.js promote_faculty ile aynı). */
export const UNVAN_ADLARI = { 'argö': 'Arş. Gör.', dr_ogr_uyesi: 'Dr. Öğr. Üyesi', docent: 'Doçent', profesor: 'Profesör' };
const UNVAN_SIRASI = ['argö', 'dr_ogr_uyesi', 'docent', 'profesor'];

/** Eski ortak idari unvanlar (game.js ADMIN_TITLE_ORDER; birim unvanı tanımsızsa). */
const ESKI_IDARI_UNVANLAR = ['Memur', 'Uzman', 'Şef', 'Müdür Yrd.', 'Müdür'];

function _sayi(x, yedek = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : yedek;
}

function _para(n) {
  return `${Math.round(_sayi(n)).toLocaleString('tr-TR')} ₺`;
}

function _yuzde(x) {
  return `%${Math.round(_sayi(x) * 100)}`;
}

/** Birimin unvanları alttan üste (game.js getUnitTitles ile aynı; döngüsel içe aktarma olmasın diye burada). */
export function birimUnvanlari(unitId) {
  return ADMIN_UNITS[unitId]?.titles?.map(t => t.name) || ESKI_IDARI_UNVANLAR;
}

/** Unvanın birimdeki maaş baremi (game.js getUnitTitleSalary ile aynı). */
function _unvanBaremi(unitId, unvan) {
  const t = ADMIN_UNITS[unitId]?.titles?.find(x => x.name === unvan);
  if (t) return t.salary;
  return ADMIN_TITLES[unvan] || { min: 14_000, max: 18_000 };
}

/** Unvan birimin en üst iki unvanından biri mi (game.js isUnitManagerTitle ile aynı). */
function _yoneticiUnvaniMi(unitId, unvan) {
  const unvanlar = ADMIN_UNITS[unitId]?.titles;
  if (!unvanlar) return unvan === 'Müdür' || unvan === 'Müdür Yrd.';
  return unvanlar.findIndex(t => t.name === unvan) >= unvanlar.length - 2;
}

/** Kabulde yazılacak aylık maaş (game.js accept_applicant ve accept_spontaneous ile aynı). */
function _basvuruMaasi(a) {
  const ham = a?.salaryExpectation || a?.salary || 80_000;
  return Number.isNaN(Number(ham)) ? 80_000 : Number(ham);
}

function _yeniKimlik(kullanilan) {
  let id;
  do {
    id = `admin_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  } while (kullanilan.has(id));
  return id;
}

/**
 * Aday idari personelin kimliği kadroda varsa yenisini verir. game.js'teki kimlik sayacı her sayfa
 * açılışında 1'den başladığı için kayıttan açılan oyunda yeni aday eski personelle aynı kimliği alabiliyordu
 * (terfi ve fesih yanlış kişiye gidiyordu). İşe almadan hemen önce çağrılır.
 * @returns {string} adayın (gerekirse yeni) kimliği
 */
export function benzersizPersonelKimligi(state, aday) {
  if (!aday) return null;
  const kullanilan = new Set((state?.adminStaff || []).map(s => s?.id).filter(Boolean));
  if (!aday.id || kullanilan.has(aday.id)) aday.id = _yeniKimlik(kullanilan);
  return aday.id;
}

// ─────────────────────────────────────────────────────────────────────────────
// T1: TOPLU KABUL ÖLÇÜTÜ (applyDecision 'set_toplu_olcut')
// ─────────────────────────────────────────────────────────────────────────────

/** Ölçütün sınırları; Kadro sekmesindeki kaydırıcı ve seçim bunları kullanır. bolumBasina 0: sınır yok. */
export const TOPLU_OLCUT = {
  puanEsigi:   { enAz: 30, enCok: 90, adim: 5 },
  bolumBasina: { secenekler: [1, 2, 3, 5, 0] },
};

export function varsayilanTopluOlcut() {
  return { puanEsigi: 60, bolumBasina: 2, baremIci: true };
}

/** Eksik ya da bozuk ölçütü varsayılanlarla tamamlar, sınırlar içine alır (yeni nesne döner). */
export function topluOlcutTamamla(o) {
  const v = varsayilanTopluOlcut();
  const k = (o && typeof o === 'object') ? o : {};
  const puan  = Math.round(Number(k.puanEsigi));
  const bolum = Math.round(Number(k.bolumBasina));
  return {
    puanEsigi:   Number.isFinite(puan) ? Math.min(TOPLU_OLCUT.puanEsigi.enCok, Math.max(TOPLU_OLCUT.puanEsigi.enAz, puan)) : v.puanEsigi,
    bolumBasina: TOPLU_OLCUT.bolumBasina.secenekler.includes(bolum) ? bolum : v.bolumBasina,
    baremIci:    typeof k.baremIci === 'boolean' ? k.baremIci : v.baremIci,
  };
}

export function topluOlcutOku(state) {
  return topluOlcutTamamla(state?.topluOlcut);
}

/** applyDecision 'set_toplu_olcut': ölçütün verilen alanlarını değiştirir. */
export function topluOlcutAyarla(state, degisiklik = {}) {
  if (!state) return { success: false, message: 'Oyun başlatılmamış.' };
  const istenen = (degisiklik && typeof degisiklik === 'object') ? degisiklik : {};
  state.topluOlcut = topluOlcutTamamla({ ...topluOlcutOku(state), ...istenen });
  return { success: true, message: 'Toplu kabul ölçütü güncellendi.', olcut: { ...state.topluOlcut } };
}

// ─────────────────────────────────────────────────────────────────────────────
// T1: BAŞVURULAR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bekleyen başvuruları (ilana gelen ve ilan dışı) toplu kabul ölçütüne göre ayırır.
 *   uygun     kabul edilecekler, genel puana göre sıralı (en iyisi önce; devlette boş kadroyu önce o alır)
 *   kalan     ölçüte uymayanlar ("Kalanları reddet" bunları reddeder), her birinde kod ve neden
 *   baskanda  başkana devredilen bölümlere gelenler; iki listeye de girmez, toplu işlem dokunmaz
 * Bölüm sınırı bu dönem başvurudan alınanları da sayar (başkanın dönem sonu kabulleri dahil).
 * @param {object} state
 * @param {Object<string,string>} [secimler]  ilan dışı başvuruda Kadro sekmesinde seçilen bölüm (başvuru → bölüm)
 */
export function basvuruUygunlugu(state, secimler = {}) {
  const olcut   = topluOlcutOku(state);
  const tip     = state?.meta?.universityType || 'vakif';
  const tur     = _sayi(state?.meta?.turn, 1);
  const bolumler = new Map((state?.departments || []).filter(Boolean).map(d => [d.id, d]));
  const acik    = id => !!bolumler.get(id)?.isOpen;
  const devret  = id => politikaOku(bolumler.get(id)).kip === 'devret';

  // Bu dönem başvurudan alınanlar (kabul kararı hocayı o dönemden etkin yazar)
  const alinan = {};
  for (const f of state?.faculty || []) {
    if (!f || _sayi(f.activeFromTurn, -1) !== tur) continue;
    if (f.applicationSource !== 'open_position' && f.applicationSource !== 'spontaneous') continue;
    const b = f.department || f.departmentId;
    alinan[b] = (alinan[b] || 0) + 1;
  }

  const hepsi = [
    ...(state?.pendingApplicants || []).filter(Boolean).map(a => ({ a, kaynak: 'ilan', bolumId: a.department })),
    ...(state?.spontaneousApplicants || []).filter(Boolean)
      .map(a => ({ a, kaynak: 'spontane', bolumId: secimler?.[a.id] || a.preferredDept || a.department })),
  ].map(({ a, kaynak, bolumId }) => {
    const d = bolumler.get(bolumId);
    return {
      id:       a.id,
      ad:       a.name || 'İsimsiz',
      unvan:    a.title || 'dr_ogr_uyesi',
      kaynak,
      bolumId,
      bolumAdi: d ? (d.shortName || d.name) : (bolumId || '—'),
      puan:     calculateOverallRating(a),
      maas:     _basvuruMaasi(a),
      baremUst: _sayi(a.salaryRange?.max) || getSalaryRange(a.title || 'dr_ogr_uyesi', tip).max,
    };
  });

  // kalan'da kod kısa etiket içindir (Kadro sekmesindeki başvuru kartı rozeti), neden tam açıklama
  const uygun = [], kalan = [], aday = [], baskanda = [];
  for (const x of hepsi) {
    if (!acik(x.bolumId)) { kalan.push({ ...x, kod: 'kapali', neden: 'bölümü açık değil' }); continue; }
    if (devret(x.bolumId)) { baskanda.push(x); continue; }
    if (x.puan < olcut.puanEsigi) {
      kalan.push({ ...x, kod: 'esik', neden: `genel puan ${x.puan}, eşik ${olcut.puanEsigi}` });
      continue;
    }
    if (olcut.baremIci && x.maas > x.baremUst) {
      kalan.push({ ...x, kod: 'barem', neden: `maaş beklentisi ${_para(x.maas)}, barem üstü ${_para(x.baremUst)}` });
      continue;
    }
    aday.push(x);
  }
  aday.sort((a, b) => b.puan - a.puan || a.maas - b.maas);
  const sayac = { ...alinan };
  for (const x of aday) {
    if (olcut.bolumBasina > 0 && (sayac[x.bolumId] || 0) >= olcut.bolumBasina) {
      kalan.push({ ...x, kod: 'sinir', neden: `${x.bolumAdi} bu dönem ${olcut.bolumBasina} kişilik sınıra ulaştı` });
      continue;
    }
    sayac[x.bolumId] = (sayac[x.bolumId] || 0) + 1;
    uygun.push(x);
  }
  return {
    olcut, uygun, kalan, baskanda, alinan,
    toplam:   hepsi.length,
    kasa:     _sayi(state?.university?.budget),
    kasaEksi: _sayi(state?.university?.budget) < 0,
  };
}

/** Kadro sekmesindeki başvuru kartının toplu kabul rozeti (kısa ad, ob-rozet sınıfı). */
export const TOPLU_DURUM = {
  uygun:   { ad: 'Ölçüte uyuyor',     sinif: 'iyi' },
  baskan:  { ad: 'Başkanda',          sinif: 'bilgi' },
  kapali:  { ad: 'Bölüm kapalı',      sinif: 'kritik' },
  esik:    { ad: 'Eşiğin altında',    sinif: '' },
  barem:   { ad: 'Barem üstü maaş',   sinif: 'uyari' },
  sinir:   { ad: 'Bölüm sınırı dolu', sinif: '' },
};

/**
 * Onay penceresi için tahmin: uygun başvurular sırayla kabul edilince hangileri devletin kadro ve maaş
 * kuralına ya da kasa açığındaki alım dondurmasına takılır (game.js _iseAlimEngeli ile aynı sıra ve ölçü).
 * Asıl denetimi kabul kararı yapar; bu yalnız önceden gösterir.
 */
export function kabulTahmini(state, uygun = []) {
  const kd = kadroDurumu(state);
  const once = maasGelirDurumu(state, 0, 0);
  const donduruldu = !!state?._internal?.spendingRestricted;
  let bos = kd ? kd.bos : Infinity, ekMaas = 0, ekHoca = 0;
  const alinacak = [], takilacak = [];
  for (const x of uygun) {
    if (donduruldu) { takilacak.push({ ...x, neden: 'kasa açığı nedeniyle YÖK denetimi sürüyor, işe alım donduruldu' }); continue; }
    if (kd && bos <= 0) { takilacak.push({ ...x, neden: 'boş kadro kalmıyor' }); continue; }
    const mg = maasGelirDurumu(state, ekMaas + x.maas, ekHoca + 1);
    if (mg && mg.oran > mg.sinir) {
      takilacak.push({ ...x, neden: `maaş sınırı (maaşlar dönem gelirinin ${_yuzde(mg.oran)} kadarı olurdu, sınır ${_yuzde(mg.sinir)})` });
      continue;
    }
    alinacak.push(x);
    bos--; ekMaas += x.maas; ekHoca++;
  }
  const sonra = maasGelirDurumu(state, ekMaas, ekHoca);
  return {
    alinacak, takilacak, aylikMaas: ekMaas, kadro: kd, donduruldu,
    oranOnce: once ? once.oran : null, oranSonra: sonra ? sonra.oran : null, sinir: once ? once.sinir : null,
  };
}

/**
 * Devlette hoca maaşlarının dönem gelirine oranı şimdi ve verilen aylık ek maaşla (onay pencereleri için).
 * Devlet değilse null (maaş sınırı yalnız devlette).
 */
export function maasOraniTahmini(state, ekAylik = 0, ekHoca = 0) {
  const once = maasGelirDurumu(state, 0, 0);
  if (!once) return null;
  const sonra = maasGelirDurumu(state, ekAylik, ekHoca);
  return { once: once.oran, sonra: sonra ? sonra.oran : once.oran, sinir: once.sinir };
}

/** Uygun başvuruları tekil kabul kararlarıyla sırayla kabul eder. */
export function topluKabulUygula(uygun = [], applyDecision) {
  const kabul = [], takilan = [];
  if (typeof applyDecision !== 'function') return { kabul, takilan, aylikMaas: 0 };
  for (const x of uygun) {
    const r = x.kaynak === 'spontane'
      ? applyDecision({ type: 'accept_spontaneous', applicantId: x.id, targetDeptId: x.bolumId })
      : applyDecision({ type: 'accept_applicant', applicantId: x.id });
    if (r?.success) kabul.push({ ...x, mesaj: r.message });
    else takilan.push({ ...x, neden: r?.message || 'karar uygulanamadı' });
  }
  return { kabul, takilan, aylikMaas: kabul.reduce((s, x) => s + x.maas, 0) };
}

/** Ölçüte uymayan başvuruları tekil ret kararlarıyla reddeder. */
export function topluRetUygula(kalan = [], applyDecision) {
  const ret = [], takilan = [];
  if (typeof applyDecision !== 'function') return { ret, takilan };
  for (const x of kalan) {
    const r = applyDecision({ type: x.kaynak === 'spontane' ? 'reject_spontaneous' : 'reject_applicant', applicantId: x.id });
    if (r?.success) ret.push(x);
    else takilan.push({ ...x, neden: r?.message || 'karar uygulanamadı' });
  }
  return { ret, takilan };
}

// ─────────────────────────────────────────────────────────────────────────────
// T1: TERFİ (hoca unvan yükseltmesi ve idari personel terfisi)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Unvan yükseltmeye hazır hocalar ve yükseltmenin maaşa etkisi (promote_faculty maaşı yeni unvanın barem
 * alt sınırına çıkarır; daha yüksekse değiştirmez).
 */
export function hocaTerfiListesi(state) {
  const tip = state?.meta?.universityType || 'vakif';
  const bolumler = new Map((state?.departments || []).filter(Boolean).map(d => [d.id, d]));
  const gorulen = new Set();
  const liste = [];
  for (const f of state?.faculty || []) {
    if (!f || !f.promotionEligible || gorulen.has(f.id)) continue;
    const i = UNVAN_SIRASI.indexOf(f.title);
    if (i < 0 || i >= UNVAN_SIRASI.length - 1) continue;
    gorulen.add(f.id);
    const yeni = UNVAN_SIRASI[i + 1];
    const once = _sayi(f.salary);
    const d = bolumler.get(f.department || f.departmentId);
    liste.push({
      id: f.id, ad: f.name || 'İsimsiz', bolumAdi: d ? (d.shortName || d.name) : '—',
      eskiUnvan: f.title, yeniUnvan: yeni, maasOnce: once, maasSonra: Math.max(once, getSalaryRange(yeni, tip).min),
    });
  }
  return liste;
}

/** Hazır hocaları tekil yükseltme kararıyla (applyDecision 'promote_faculty') sırayla yükseltir. */
export function topluHocaTerfiUygula(liste = [], applyDecision) {
  const terfi = [], takilan = [];
  if (typeof applyDecision !== 'function') return { terfi, takilan };
  for (const x of liste) {
    const r = applyDecision({ type: 'promote_faculty', facultyId: x.id });
    if (r?.success) terfi.push({ ...x, maasSonra: _sayi(r.newSalary, x.maasSonra) });
    else takilan.push({ ...x, neden: r?.message || 'karar uygulanamadı' });
  }
  return { terfi, takilan };
}

/**
 * Terfiye hazır idari personel ve terfinin maaşa etkisi (promoteAdminStaff maaşı yeni unvanın barem
 * ortasına çıkarır; şimdiki maaş daha yüksekse değiştirmez).
 */
export function idariTerfiListesi(state) {
  const gorulen = new Set();
  const liste = [];
  for (const s of state?.adminStaff || []) {
    if (!s || !s.promotionEligible || gorulen.has(s.id)) continue;
    const unvanlar = birimUnvanlari(s.unit);
    const i = unvanlar.indexOf(s.title);
    if (i < 0 || i >= unvanlar.length - 1) continue;
    gorulen.add(s.id);
    const yeni  = unvanlar[i + 1];
    const b     = _unvanBaremi(s.unit, yeni);
    const once  = _sayi(s.salary);
    liste.push({
      id: s.id, ad: s.name || 'İsimsiz', birimId: s.unit, birimAdi: ADMIN_UNITS[s.unit]?.name || s.unit || '—',
      eskiUnvan: s.title, yeniUnvan: yeni, maasOnce: once, maasSonra: Math.max(once, Math.round((b.min + b.max) / 2)),
    });
  }
  return liste;
}

/** Hazır personeli tekil terfi işleviyle (game.js promoteAdminStaff) sırayla terfi ettirir. */
export function topluIdariTerfiUygula(liste = [], promoteAdminStaff) {
  const terfi = [], takilan = [];
  if (typeof promoteAdminStaff !== 'function') return { terfi, takilan };
  for (const x of liste) {
    const r = promoteAdminStaff(x.id);
    if (r?.success) terfi.push(x);
    else takilan.push({ ...x, neden: r?.message || 'terfi yapılamadı' });
  }
  return { terfi, takilan };
}

// ─────────────────────────────────────────────────────────────────────────────
// T2: OTOMATİK PERSONEL AYARI (applyDecision 'set_idari_otomatik')
// ─────────────────────────────────────────────────────────────────────────────

/** Kademe sınırı: alınacak adayların en üst deneyim düzeyi (İdari sekmesindeki alım penceresiyle aynı adlar). */
export const KADEMELER = {
  junior: { ad: 'Giriş seviye', sira: 0 },
  mid:    { ad: 'Orta düzey',   sira: 1 },
  senior: { ad: 'Kıdemli',      sira: 2 },
};
const KADEME_SIRASI = ['junior', 'mid', 'senior'];
export const VARSAYILAN_KADEME = 'mid';

/** Kademe başına üretilen aday (İdari sekmesindeki alım penceresi de üç aday gösterir). */
const ADAY_SAYISI = 3;

/** Dönem özetinde karar türlerinin adı ve rozet rengi (ob-rozet--<sinif>). */
export const IDARI_KARAR_TURLERI = {
  alim:     { ad: 'Alım',     sinif: 'iyi' },
  yonetici: { ad: 'Yönetici', sinif: 'vurgu' },
  uyari:    { ad: 'Uyarı',    sinif: 'kritik' },
  bilgi:    { ad: 'Bilgi',    sinif: '' },
};

export function kademeAdi(kademe) {
  return (KADEMELER[kademe] || KADEMELER[VARSAYILAN_KADEME]).ad;
}

/** Birimin ayarı: kapalı ve orta düzey varsayılan. */
export function birimOtomatikTamamla(b) {
  const k = (b && typeof b === 'object') ? b : {};
  return { acik: k.acik === true, kademe: KADEMELER[k.kademe] ? k.kademe : VARSAYILAN_KADEME };
}

/** Bütün birimlerin ayarı (eksik birim kapalı), açık birim sayısı ve son dönem sonunun kısa özeti. */
export function idariOtomatikOku(state) {
  const kayit = state?.idariOtomatik?.birimler || {};
  const birimler = {};
  for (const id of Object.keys(ADMIN_UNITS)) birimler[id] = birimOtomatikTamamla(kayit[id]);
  const son = state?.idariOtomatik?.son;
  return {
    birimler,
    acikSayisi: Object.values(birimler).filter(b => b.acik).length,
    son: son && typeof son === 'object' ? son : null,
  };
}

/**
 * applyDecision 'set_idari_otomatik'.
 *   { unitId, acik?, kademe? }  bir birimin anahtarı ya da kademe sınırı
 *   { hepsi: true, acik }       bütün birimleri açar ya da kapatır (kademe sınırları korunur)
 */
export function idariOtomatikAyarla(state, karar = {}) {
  if (!state) return { success: false, message: 'Oyun başlatılmamış.' };
  const k = (karar && typeof karar === 'object') ? karar : {};
  const { birimler, son } = idariOtomatikOku(state);

  if (k.hepsi) {
    const acik = k.acik === true;
    for (const id of Object.keys(birimler)) birimler[id] = { ...birimler[id], acik };
    state.idariOtomatik = { birimler, son };
    return {
      success: true,
      message: acik
        ? 'Bütün birimlerde otomatik personel açıldı; eksikler dönem sonunda her birimin kademe sınırıyla doldurulur.'
        : 'Bütün birimlerde otomatik personel kapatıldı.',
      ayar: birimler,
    };
  }

  const id = k.unitId;
  if (!ADMIN_UNITS[id]) return { success: false, message: 'Birim bulunamadı.' };
  if (k.kademe !== undefined && !KADEMELER[k.kademe]) return { success: false, message: 'Geçersiz kademe sınırı.' };
  const once = birimler[id];
  const yeni = birimOtomatikTamamla({
    ...once,
    ...(typeof k.acik === 'boolean' ? { acik: k.acik } : {}),
    ...(k.kademe !== undefined ? { kademe: k.kademe } : {}),
  });
  birimler[id] = yeni;
  state.idariOtomatik = { birimler, son };
  const ad = ADMIN_UNITS[id].name;
  const kademeYazi = kademeAdi(yeni.kademe).toLocaleLowerCase('tr');
  let message;
  if (once.acik !== yeni.acik) {
    message = yeni.acik
      ? `${ad} biriminde otomatik personel açıldı; eksikler dönem sonunda ${kademeYazi} sınırıyla doldurulur.`
      : `${ad} biriminde otomatik personel kapatıldı.`;
  } else {
    message = `${ad} biriminin kademe sınırı ${kademeYazi} oldu.`;
  }
  return { success: true, message, ayar: { ...yeni } };
}

/**
 * migrateState'ten: kayıtlı oyunda ayar yoksa bütün birimler kapalı, toplu kabul ölçütü varsayılan.
 * Yinelenen idari personel kimlikleri de onarılır (ilk kişi kimliğini korur, yönetici kaydı ona bakar).
 */
export function idariOtomatikGoc(state) {
  if (!state || typeof state !== 'object') return;
  try {
    const { birimler, son } = idariOtomatikOku(state);
    state.idariOtomatik = { birimler, son };
    state.topluOlcut = topluOlcutTamamla(state.topluOlcut);
    const gorulen = new Set();
    for (const s of Array.isArray(state.adminStaff) ? state.adminStaff : []) {
      if (!s || typeof s !== 'object') continue;
      if (!s.id || gorulen.has(s.id)) s.id = _yeniKimlik(gorulen);
      gorulen.add(s.id);
    }
  } catch (e) {
    console.warn('[idari] otomatik personel göçü tamamlanamadı:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T2: DÖNEM SONU (nextTurn)
// ─────────────────────────────────────────────────────────────────────────────

/** İşe alımda yazılacak maaş (game.js hireAdminStaff, önerilen rütbeyle alınınca). */
function _adayMaasi(unitId, aday, unvan = aday?.suggestedTitle) {
  const b = _unvanBaremi(unitId, unvan || birimUnvanlari(unitId)[1]);
  const orta = Math.round((b.min + b.max) / 2);
  return Math.max(_sayi(aday?.salaryExpectation) || orta, b.min);
}

/**
 * Dönem sonu: otomatik personeli açık her birimde eksikleri doldurur ve boş yöneticiliği atar. nextTurn
 * içinde başkanların kararlarından sonra çağrılır (tur ve dönem o anda yeni dönemi gösterir; ayrılan
 * idari personel simülasyonda düşülmüştür). Hata fırlatmaz: bir birimde hata olursa o birim atlanır.
 * @param {object} state       oyun durumu (game.js _state)
 * @param {object} simResults  runSimulation sonucu; events dizisine eklenir
 * @param {{ generateAdminCandidates: Function, hireAdminStaff: Function, assignUnitManager: Function }} araclar
 * @returns {object[]} birim birim rapor
 */
export function idariOtomatikDonemi(state, simResults, araclar = {}) {
  const rapor = [];
  try {
    if (!state || !state.adminUnits || typeof state.adminUnits !== 'object' || Array.isArray(state.adminUnits)) return rapor;
    if (typeof araclar.generateAdminCandidates !== 'function' || typeof araclar.hireAdminStaff !== 'function') return rapor;
    const { birimler } = idariOtomatikOku(state);
    const acik = Object.keys(ADMIN_UNITS).filter(id => birimler[id].acik && state.adminUnits[id]);
    if (acik.length === 0) return rapor;
    if (!Array.isArray(state.adminStaff)) state.adminStaff = [];
    if (simResults && !Array.isArray(simResults.events)) simResults.events = [];

    const kasa = _sayi(state.university?.budget);
    const mg   = maasGelirDurumu(state, 0, 0);
    const butce = { kasa, kasaPayi: kasa, kasaEksi: kasa < 0, maasDolu: mg && mg.oran >= mg.sinir ? mg : null };
    for (const id of acik) {
      try {
        rapor.push(_birimDonemi(state, id, birimler[id].kademe, araclar, butce));
      } catch (e) {
        console.warn(`[idari] ${id}: otomatik personel kararları alınamadı:`, e);
      }
    }

    const tur = Math.max(1, _sayi(state.meta?.turn, 1) - 1);   // biten dönem (özet başlığındaki dönem)
    const say = t => rapor.reduce((s, b) => s + b.kararlar.filter(k => k.tur === t).length, 0);
    if (rapor.length > 0 && simResults) simResults.events.push({ type: 'idari_otomatik', turn: tur, birimler: rapor });
    state.idariOtomatik = { birimler, son: { tur, birim: rapor.length, alim: say('alim'), yonetici: say('yonetici'), uyari: say('uyari') } };
  } catch (e) {
    console.warn('[idari] dönem sonu otomatik personel işlenemedi:', e);
  }
  return rapor;
}

function _birimDonemi(state, unitId, kademe, { generateAdminCandidates, hireAdminStaff, assignUnitManager }, butce) {
  const sablon   = ADMIN_UNITS[unitId];
  const unit     = state.adminUnits[unitId];
  const kararlar = [];
  const personel = () => state.adminStaff.filter(s => s && s.unit === unitId);
  const gereken  = Math.max(0, Math.round(_sayi(unit.staffNeeded)));
  const eksik    = Math.max(0, gereken - personel().length);
  const kademeYazi = kademeAdi(kademe).toLocaleLowerCase('tr');
  let alinan = 0;

  if (eksik > 0 && butce.kasaEksi) {
    kararlar.push({
      tur: 'uyari',
      metin: `Kasa eksi olduğu için ${eksik} eksik personel alınmadı.`,
      neden: `Kasa ${_para(butce.kasa)}; otomatik personel kasa eksideyken alım yapmaz.`,
    });
  } else if (eksik > 0 && butce.maasDolu) {
    kararlar.push({
      tur: 'uyari',
      metin: `Maaş sınırı dolu olduğu için ${eksik} eksik personel alınmadı.`,
      neden: `Hoca maaşları dönem gelirinin ${_yuzde(butce.maasDolu.oran)} kadarı; devlette sınır ${_yuzde(butce.maasDolu.sinir)}. Sınır doluyken otomatik personel alım yapmaz.`,
    });
  } else if (eksik > 0) {
    const izinli = KADEME_SIRASI.slice(0, (KADEMELER[kademe] || KADEMELER[VARSAYILAN_KADEME]).sira + 1);
    for (let i = 0; i < eksik; i++) {
      const adaylar = izinli.flatMap(k => generateAdminCandidates(unitId, k, ADAY_SAYISI) || []).filter(Boolean);
      if (adaylar.length === 0) break;
      adaylar.sort((a, b) => _sayi(b.quality) - _sayi(a.quality) || _adayMaasi(unitId, a) - _adayMaasi(unitId, b));
      const aday  = adaylar[0];
      const unvan = aday.suggestedTitle || birimUnvanlari(unitId)[1];
      const maas  = _adayMaasi(unitId, aday, unvan);
      if (butce.kasaPayi - maas * SEMESTER_MONTHS < 0) {
        kararlar.push({
          tur: 'uyari',
          metin: `Kasa yetmediği için ${eksik - i} eksik personel alınmadı.`,
          neden: `Bu dönemin alımlarından sonra kasada ${_para(butce.kasaPayi)} kalıyor; bir kişinin bir dönemlik maaşı ${_para(maas * SEMESTER_MONTHS)}.`,
        });
        break;
      }
      const duzey = aday.experienceLevel;
      benzersizPersonelKimligi(state, aday);
      const oncekiYonetici = unit.managerId || null;
      hireAdminStaff(aday, unvan);
      const yeni = state.adminStaff.find(s => s && s.id === aday.id);
      if (!yeni) {
        kararlar.push({ tur: 'uyari', metin: 'Aday işe alınamadı; kalan eksik sonraki döneme kaldı.' });
        break;
      }
      butce.kasaPayi -= (_sayi(yeni.salary) || maas) * SEMESTER_MONTHS;
      alinan++;
      // Neden yalnız ilk alımda yazılır (sonrakiler aynı gerekçeyle alınır)
      kararlar.push({
        tur:   'alim',
        metin: `${yeni.name}, ${yeni.title} olarak alındı; kalite ${yeni.quality}, maaş ${_para(yeni.salary)}/ay${duzey && KADEMELER[duzey] ? ` (${kademeAdi(duzey).toLocaleLowerCase('tr')} aday)` : ''}.`,
        ...(alinan === 1 ? { neden: `${eksik} eksik personel vardı. Kademe sınırı ${kademeYazi}; her alımda ${adaylar.length} aday arasından niteliği en yüksek olan seçildi.` } : {}),
      });
      if (unit.managerId && unit.managerId === yeni.id && oncekiYonetici !== yeni.id) {
        kararlar.push({
          tur:   'yonetici',
          metin: `${yeni.name} birim yöneticisi oldu; liderlik ${yeni.leadership}.`,
          neden: 'Birimin yöneticisi yoktu; yönetici rütbesinde alınan personel kendiliğinden atanır.',
        });
      }
    }
  }

  if (!unit.managerId) {
    const uygunlar = personel().filter(s => _yoneticiUnvaniMi(unitId, s.title))
      .sort((a, b) => _sayi(b.leadership) - _sayi(a.leadership));
    const rutbeler = birimUnvanlari(unitId).slice(-2).join(' ya da ');
    if (uygunlar.length > 0 && typeof assignUnitManager === 'function') {
      const y = uygunlar[0];
      const r = assignUnitManager(unitId, y.id);
      if (r?.success) {
        kararlar.push({
          tur:   'yonetici',
          metin: `${y.name} (${y.title}) birim yöneticisi atandı; liderlik ${Math.round(_sayi(y.leadership))}.`,
          neden: 'Birimin yöneticisi yoktu; yönetici rütbesindeki personelden liderliği en yüksek olan seçildi.',
        });
      } else {
        kararlar.push({ tur: 'uyari', metin: `Birim yöneticisi atanamadı. ${r?.message || ''}`.trim() });
      }
    } else {
      // Ne yapılabileceği dönem özetinde bölümün başında bir kez yazılır (kod: 'yonetici_yok')
      kararlar.push({
        tur:   'bilgi',
        kod:   'yonetici_yok',
        metin: `Birim yöneticisi yok; yönetici rütbesinde (${rutbeler}) personel yok.`,
      });
    }
  }

  const n = personel().length;
  if (kararlar.length === 0) {
    kararlar.push({ tur: 'bilgi', metin: `Kadro tam (${n}/${gereken}), birim yöneticisi ${unit.managerName || 'atanmış'}.` });
  }
  return { unitId, ad: sablon?.name || unitId, ikon: sablon?.icon || '', kademe, personel: n, gereken, alinan, kararlar };
}
