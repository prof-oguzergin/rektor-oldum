/**
 * Rektör Oldum: Bölüm Başkanına Devretme (baskan.js), v0.7
 *
 * Oyuncu yalnız ilgilendiği bölümleri kendisi yönetir, ötekileri bölüm başkanına
 * devreder. Her bölümde dept.policy tutulur:
 *   { kip: 'dogrudan' | 'devret', odak: 'egitim' | 'arastirma' | 'dengeli' | 'tasarruf',
 *     hocaOrani, donemlikAlimTavani, kontenjanKurali: 'kapasite' | 'sabit',
 *     baskanId, baskanAdi, devirTuru }
 * Devredilen bölümde başkan her dönem sonunda (nextTurn, yaşam döngüsünden sonra):
 *   - Hocasız ders, kurucu kadro eksiği ya da hedefi aşan öğrenci/hoca oranı varsa
 *     eşiği geçen başvuruları kabul eder (dönemlik alım tavanını aşmaz); yetmezse
 *     eksik uzmanlık için ilan verir.
 *   - Bahar dönemi başında gelecek yılın kontenjanını kurala göre koyar.
 *   - Odağa göre bir dersin zorluğunu bir kademe değiştirir.
 *   - Odak araştırmaysa açık BAP çağrısında bölümün başvurularını onaylar.
 * Başkan bunları oyunun var olan karar işlevleriyle yapar (applyDecision, applyQuotas,
 * setCourseDifficulty). game.js bu işlevleri parametre olarak geçirir (döngüsel içe
 * aktarma olmasın); böylece kararlara eklenecek ekonomi kuralları başkana da uygulanır.
 * Başkan işten çıkarmaz, bina kurmaz, program açmaz.
 * Başkanın yönetim puanı kararın niteliğini belirler: düşük puanlı başkan adayları
 * bulanık görür, eşiği gevşek tutar, kontenjanı yanlış hesaplayabilir, ilanı hedefsiz verir.
 * Başkan ayrılırsa (ya da başka bölüme taşınırsa) bölüm doğrudan yönetime döner.
 */

import { DEPARTMENT_CURRICULA, BUILDINGS } from './data.js?v=0.6.1';
import { DEPARTMENT_FIELDS, calculateOverallRating, getSalaryScale } from './faculty.js?v=0.6.1';

// ─────────────────────────────────────────────────────────────────────────────
// POLİTİKA
// ─────────────────────────────────────────────────────────────────────────────

export const ODAKLAR = {
  egitim: {
    ad: 'Eğitim',
    aciklama: 'Eğitimi güçlü hoca arar; geçme oranı %78 altındaki dersi bir kademe kolaylaştırır.',
  },
  arastirma: {
    ad: 'Araştırma',
    aciklama: 'Araştırmacı hoca arar, ilanda daha yüksek maaş ve araştırma fonu verir; açık BAP çağrısında bölümün başvurularını onaylar; müfredatı sıkı tutar.',
  },
  dengeli: {
    ad: 'Dengeli',
    aciklama: 'Genel puana bakar; ders zorluğunu müfredatın olağan düzeyine çeker.',
  },
  tasarruf: {
    ad: 'Tasarruf',
    aciklama: 'Yalnız hocasız ders ve kurucu kadro için hoca alır, barem ortasından ilan verir, maaş beklentisi düşük adayı seçer.',
  },
};

export const KONTENJAN_KURALLARI = {
  kapasite: {
    ad: 'Kapasiteye göre',
    aciklama: 'Bölümü derslik payının %95 doluluğuna doğru büyütür ya da küçültür; kontenjan yılda en çok %25 (en az 15 kişi) artar, en çok %25 azalır; kadro öğrenci/hoca hedefine yetişmiyorsa artmaz.',
  },
  sabit: {
    ad: 'Sabit',
    aciklama: 'Kontenjanı değiştirmez; şu anki değer her yıl yinelenir, değiştirmek isterseniz Kontenjan penceresinden siz değiştirirsiniz.',
  },
};

/** Politikadaki sayıların sınırları (Bölüm Sayfası'ndaki kaydırıcılar da bunları kullanır). */
export const POLITIKA_SINIRLARI = {
  hocaOrani:          { enAz: 10, enCok: 40 },
  donemlikAlimTavani: { enAz: 0,  enCok: 5 },
};

/** Dönem özetinde ve Bölüm Sayfası'nda karar türlerinin adı ve rozet rengi (ob-rozet--<sinif>). */
export const KARAR_TURLERI = {
  kabul:     { ad: 'Kabul',     sinif: 'iyi' },
  ilan:      { ad: 'İlan',      sinif: 'bilgi' },
  kontenjan: { ad: 'Kontenjan', sinif: 'vurgu' },
  zorluk:    { ad: 'Zorluk',    sinif: 'uyari' },
  bap:       { ad: 'BAP',       sinif: 'iyi' },
  proje:     { ad: 'Proje',     sinif: 'iyi' },
  uyari:     { ad: 'Uyarı',     sinif: 'kritik' },
  bilgi:     { ad: 'Bilgi',     sinif: '' },
};

/** Yeni ya da eski kayıttaki bölümün politikası: doğrudan yönetim. */
export function varsayilanPolitika() {
  return {
    kip:                'dogrudan',
    odak:               'dengeli',
    hocaOrani:          20,
    donemlikAlimTavani: 2,
    kontenjanKurali:    'kapasite',
    baskanId:           null,
    baskanAdi:          null,
    devirTuru:          null,
  };
}

/**
 * Eksik ya da bozuk politikayı varsayılanlarla tamamlar, değerleri sınırlar içine alır.
 * Girdiyi değiştirmez, yeni nesne döner.
 * @param {object|null|undefined} p
 */
export function politikaTamamla(p) {
  const v = varsayilanPolitika();
  const k = (p && typeof p === 'object') ? p : {};
  const sayi = (x, { enAz, enCok }, yedek) => {
    const n = Math.round(Number(x));
    return Number.isFinite(n) ? Math.min(enCok, Math.max(enAz, n)) : yedek;
  };
  const devret = k.kip === 'devret';
  return {
    kip:                devret ? 'devret' : 'dogrudan',
    odak:               ODAKLAR[k.odak] ? k.odak : v.odak,
    hocaOrani:          sayi(k.hocaOrani, POLITIKA_SINIRLARI.hocaOrani, v.hocaOrani),
    donemlikAlimTavani: sayi(k.donemlikAlimTavani, POLITIKA_SINIRLARI.donemlikAlimTavani, v.donemlikAlimTavani),
    kontenjanKurali:    KONTENJAN_KURALLARI[k.kontenjanKurali] ? k.kontenjanKurali : v.kontenjanKurali,
    baskanId:           devret && k.baskanId != null ? k.baskanId : null,
    baskanAdi:          devret && typeof k.baskanAdi === 'string' ? k.baskanAdi : null,
    devirTuru:          devret && Number.isFinite(k.devirTuru) ? k.devirTuru : null,
  };
}

/** Bölümün politikası (yoksa varsayılan); durumu değiştirmez. */
export function politikaOku(dept) {
  return politikaTamamla(dept?.policy);
}

// ─────────────────────────────────────────────────────────────────────────────
// KÜÇÜK YARDIMCILAR
// ─────────────────────────────────────────────────────────────────────────────

const UNVAN_KISA = { profesor: 'Prof. Dr.', docent: 'Doç. Dr.', dr_ogr_uyesi: 'Dr. Öğr. Üyesi', 'argö': 'Arş. Gör.' };
const SINIF_SAYISI      = 4;      // bölüm kapasitesi dört sınıfın toplamı (game.js ile aynı)
const DERS_BASI_HOCA    = 3;      // bir hoca en çok 3 ders verir (game.js ders ataması)
const DOLULUK_HEDEFI    = 0.95;   // kapasite kuralında dört sınıfın hedef doluluğu
const HOCA_BASI_OGRENCI = 30;     // kontenjan penceresinin "hoca kapasitesi" ölçüsü (hoca × 30)
const GUNLUK_UZUNLUGU   = 4;      // bölümde saklanan son dönem kararı sayısı
const ESIK_PAYI         = 3;      // kabul eşiği: bölüm hocalarının ortalama puanının bu kadar altı
const ESIK_TAVANI       = 60;     // güçlü bölümde de eşik bundan yüksek olmaz (başvuruların çoğu 55-70 arası)
const ACIL_GEVSEME      = 8;      // hocasız ders ya da kurucu kadro eksiğinde eşik bu kadar gevşer
const BEKLEME_GEVSEME   = 3;      // ihtiyaç karşılanamadan geçen her dönem eşik bu kadar gevşer (en çok 3 dönem)
const ORAN_PAYI         = 1.2;    // kapasite kuralı: öğrenci/hoca hedefin bu katını aşacaksa kontenjan artırılmaz
const UYUM_PUANI        = 6;      // eksik uzmanlığı karşılayan adaya eklenen puan
const BAP_EN_COK        = 2;      // başkanın bir dönemde onayladığı en çok BAP başvurusu
const BAP_PAYI          = 0.5;    // bölüm bir BAP çağrısının bütçesinin en çok yarısını kullanır
const ARASTIRMA_FONU    = 250_000; // araştırma odağında ilana eklenen dönemlik fon
const ILAN_MAAS_CARPANI = { egitim: 1.1, arastirma: 1.2, dengeli: 1.1, tasarruf: 1.0 };
const VARSAYILAN_KONTENJAN = { devlet: 50, vakif: 45, us_private: 60 };   // kontenjan penceresinin başlangıç değerleri
const YILLIK_DEGISIM    = 0.25;   // kapasite kuralında kontenjan yılda en çok %25 değişir
const EN_AZ_ARTIS       = 15;     // küçük kontenjanda yıllık artış en az 15 kişi olabilir

/** Ders zorluğu kuralları: geçme oranı `indirAlti` altındaki dersi (zorluk `enAz` üstündeyse) bir kademe kolaylaştırır. */
const ZORLUK_KURALI = {
  egitim:    { indirAlti: 0.78, enAz: 2, artirUstu: 0.93 },   // olağan düzeyin altındaki çok kolay dersi geri çeker
  arastirma: { indirAlti: 0.62, enAz: 1, artirUstu: 0.82 },   // olağan düzeyin bir üstüne kadar zorlaştırır
  dengeli:   { indirAlti: 0.65, enAz: 1 },                    // olağan düzeye çeker
  tasarruf:  { indirAlti: 0.72, enAz: 2 },                    // kalan öğrenci harç ve katkı payı demek
};

const hocaBolumu = f => f?.department || f?.departmentId || null;
const stat = (f, ad) => Number(f?.stats?.[ad]) || 0;

/** "Prof. Dr. Ad Soyad" */
export function kisiAdi(f) {
  return `${UNVAN_KISA[f?.title] || ''} ${f?.name || 'İsimsiz'}`.trim();
}

function _para(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('tr-TR')} ₺`;
}

function _yuzde(x) {
  return `%${Math.round((Number(x) || 0) * 100)}`;
}

function _ondalik(x) {
  return (Math.round((Number(x) || 0) * 10) / 10).toLocaleString('tr-TR');
}

/** İlk harfi büyütür, sonuna nokta koyar. */
function _cumle(s) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.charAt(0).toLocaleUpperCase('tr') + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.');
}

/** En çok üç ad, fazlası "ve N ders daha". */
function _liste(adlar) {
  const a = adlar.filter(Boolean);
  return a.slice(0, 3).join(', ') + (a.length > 3 ? ` ve ${a.length - 3} ders daha` : '');
}

function _ortalama(dizi) {
  return dizi.length ? dizi.reduce((s, x) => s + x, 0) / dizi.length : 0;
}

/** Standart normal dağılımdan örnek (Box-Muller). */
function _gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function _toplam(q) {
  return (Number(q?.tamBurslu) || 0) + (Number(q?.yariBurslu) || 0) + (Number(q?.ucretli) || 0);
}

function _bolumHocalari(state, deptId) {
  return (state?.faculty || []).filter(f => hocaBolumu(f) === deptId);
}

function _ogrenciSayisi(state, deptId) {
  const b = state?.students?.byDepartment?.[deptId] || {};
  return ['year1', 'year2', 'year3', 'year4'].reduce((s, k) => s + (Number(b[k]?.count) || 0), 0);
}

/** Bölümün başkanı: başkan kaydı olan ve hâlâ bu bölümde çalışan hoca; yoksa null. */
function _bolumBaskani(state, dept) {
  if (!dept?.headId) return null;
  return (state?.faculty || []).find(f => f.id === dept.headId && hocaBolumu(f) === dept.id) || null;
}

function _yonetimPuani(f) {
  const n = Number(f?.stats?.management);
  return Number.isFinite(n) ? n : 50;
}

/** Dönem özetindeki gibi biten dönem: nextTurn tur ve dönemi ilerlettikten sonra çağrılır. */
function _tamamlananDonem(state) {
  const tur   = Number(state?.meta?.turn) || 1;
  const yil   = Number(state?.meta?.year) || 1;
  const donem = state?.meta?.semester === 'güz' ? 'bahar' : 'güz';
  return { tur: Math.max(1, tur - 1), yil: donem === 'bahar' && yil > 1 ? yil - 1 : yil, donem };
}

/** Günlük kaydının dönem adı: "2. Yıl Bahar". */
export function donemAdi(kayit) {
  if (!kayit) return '';
  return `${kayit.yil || 1}. Yıl ${kayit.donem === 'bahar' ? 'Bahar' : 'Güz'}`;
}

/**
 * Yönetim puanının kararlara etkisi (bölüm başkanı etkisiyle aynı eşikler: 75 ve 50).
 * @param {number} puan
 * @returns {{ kademe: 'guclu'|'orta'|'zayif', ad: string, sinif: string, aciklama: string }}
 */
export function yonetimKademesi(puan) {
  const n = Number(puan);
  if (Number.isFinite(n) && n >= 75) {
    return { kademe: 'guclu', ad: 'güçlü', sinif: 'iyi', aciklama: 'adayları doğru tartar, kontenjanı doğru hesaplar, ilanı eksik uzmanlığa yöneltir.' };
  }
  if (!Number.isFinite(n) || n >= 50) {
    return { kademe: 'orta', ad: 'orta', sinif: 'uyari', aciklama: 'adayları çoğunlukla doğru tartar; kontenjanda küçük sapmalar olabilir.' };
  }
  return { kademe: 'zayif', ad: 'zayıf', sinif: 'kritik', aciklama: 'adayları bulanık görür, zayıf adayı kabul edebilir, kontenjanı şaşırabilir, ilanı hedefsiz verir.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// DEVİR DURUMU VE POLİTİKA KARARI (applyDecision 'set_dept_policy')
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bölümün devir durumu (arayüz ve dönem sonu için).
 * gecerli: doğrudan bölümde başkanın olup olmadığı (devredilebilir mi); devredilmiş bölümde devrin sürüp
 * sürmediği. Devrin başkanı ayrıldıysa ya da başka bölüme taşındıysa devir geçersizdir (dönem sonunda
 * doğrudan yönetime döner). Rektör başkanı değiştirdiyse (eski başkan bölümde) devir yeni başkanla sürer.
 * @returns {{ politika: object, devredildi: boolean, gecerli: boolean, bas: object|null, baskanDegisti: boolean, neden: string|null }}
 */
export function devirDurumu(state, dept) {
  const politika = politikaOku(dept);
  const bas = _bolumBaskani(state, dept);
  const sonuc = { politika, devredildi: politika.kip === 'devret', gecerli: true, bas, baskanDegisti: false, neden: null };
  if (!sonuc.devredildi) {
    if (!bas) { sonuc.gecerli = false; sonuc.neden = 'Başkansız bölüm devredilemez; önce başkan atayın'; }
    return sonuc;
  }
  if (politika.baskanId != null && politika.baskanId !== bas?.id) {
    const eski = (state?.faculty || []).find(f => f.id === politika.baskanId) || null;
    const eskiAd = politika.baskanAdi || (eski ? kisiAdi(eski) : 'Başkan');
    if (!eski) {
      // Yaşam döngüsü ayrılanları adıyla kaydeder (kimliksiz): emeklilik ve vefat adla bulunur
      const kayit = [...(state?.facultyDepartures || [])].reverse().find(k => kisiAdi(k) === eskiAd);
      const fiil = kayit?.neden === 'vefat' ? 'hayatını kaybetti'
        : kayit?.neden === 'emeklilik' ? 'emekli oldu' : 'üniversiteden ayrıldı';
      sonuc.gecerli = false;
      sonuc.neden = `${eskiAd} ${fiil}`;
    } else if (hocaBolumu(eski) !== dept?.id) {
      sonuc.gecerli = false;
      sonuc.neden = `${eskiAd} başka bölüme taşındı`;
    } else if (!bas) {
      sonuc.gecerli = false;
      sonuc.neden = 'bölüm başkanlığı boş';
    } else {
      sonuc.baskanDegisti = true;
    }
    return sonuc;
  }
  if (!bas) { sonuc.gecerli = false; sonuc.neden = 'bölüm başkanlığı boş'; }
  return sonuc;
}

/**
 * Bölümün yönetim politikasını değiştirir (applyDecision 'set_dept_policy').
 * Başkansız bölüm devredilemez. Devirde başkanın kimliği ve adı politikaya yazılır;
 * rektör istediği an kip: 'dogrudan' ile geri alır.
 * @param {object} state
 * @param {string} deptId
 * @param {object} yeni  kısmi politika ({ kip, odak, hocaOrani, donemlikAlimTavani, kontenjanKurali })
 * @returns {{ success: boolean, message: string, policy?: object }}
 */
export function politikaAyarla(state, deptId, yeni = {}) {
  const dept = (state?.departments || []).find(d => d?.id === deptId);
  if (!dept || dept.isOpen === false) return { success: false, message: 'Bölüm bulunamadı.' };
  const ad = dept.shortName || dept.name;
  const eski = politikaOku(dept);
  const istenen = (yeni && typeof yeni === 'object') ? yeni : {};
  // Başkan bilgisi formdan alınmaz; devirde bölümün şimdiki başkanı yazılır
  const { baskanId: _b, baskanAdi: _a, devirTuru: _t, ...ayarlar } = istenen;
  const birlesik = politikaTamamla({ ...eski, ...ayarlar });

  if (birlesik.kip === 'devret') {
    const bas = _bolumBaskani(state, dept);
    if (!bas) {
      return { success: false, message: `${ad}: başkansız bölüm devredilemez. Önce bölüme Prof. ya da Doç. bir başkan atayın.`, policy: eski };
    }
    const yeniDevir    = eski.kip !== 'devret';
    const yeniBaskanla = !yeniDevir && eski.baskanId != null && eski.baskanId !== bas.id;
    const tur = Number(state?.meta?.turn) || 1;
    birlesik.baskanId  = bas.id;
    birlesik.baskanAdi = kisiAdi(bas);
    birlesik.devirTuru = yeniDevir ? tur : (eski.devirTuru ?? tur);
    dept.policy = birlesik;
    return {
      success: true,
      policy:  { ...birlesik },
      message: yeniDevir
        ? `${ad} bölümü ${birlesik.baskanAdi} yönetimine devredildi. Başkan kararlarını dönem sonunda verecek.`
        : yeniBaskanla ? `${ad}: devir yeni başkan ${birlesik.baskanAdi} ile sürüyor.`
        : `${ad}: başkanın yetkileri güncellendi.`,
    };
  }

  dept.policy = politikaTamamla({ ...birlesik, kip: 'dogrudan' });
  return {
    success: true,
    policy:  { ...dept.policy },
    message: eski.kip === 'devret' ? `${ad} doğrudan yönetiminize döndü.` : `${ad} doğrudan yönetiminizde.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DÖNEM SONU: BAŞKANLARIN KARARLARI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dönem sonu: devredilen her bölümde başkan kararlarını verir. nextTurn içinde yaşam döngüsünden
 * (ayrılışlar, boşalan başkanlık, yeniden ders ataması) sonra çağrılır; tur ve dönem o anda yeni
 * dönemi gösterir. Kararlar dönem özetine simResults.events içinde tek bir 'baskan_kararlari'
 * kaydıyla, bölümün baskanGunlugu alanına da son dönemlerin kaydı olarak yazılır. Devrin başkanı
 * ayrıldıysa bölüm doğrudan yönetime döner ve özete uyarı düşer. Hata fırlatmaz: bir bölümde hata
 * olursa o bölüm atlanır, dönem ilerler.
 * @param {object} state       oyun durumu (game.js _state)
 * @param {object} simResults  runSimulation sonucu; events dizisine eklenir
 * @param {{ applyDecision: Function, applyQuotas: Function, setCourseDifficulty: Function }} araclar
 * @returns {object[]} bölüm bölüm rapor
 */
export function baskanDonemi(state, simResults, araclar = {}) {
  const rapor = [];
  if (!state || !Array.isArray(state.departments)) return rapor;
  if (simResults && !Array.isArray(simResults.events)) simResults.events = [];
  const donem = _tamamlananDonem(state);

  for (const dept of state.departments) {
    if (!dept || dept.isOpen === false) continue;
    const p = politikaOku(dept);
    if (p.kip !== 'devret') continue;
    try {
      rapor.push(_bolumDonemi(state, dept, p, araclar, simResults, donem));
    } catch (e) {
      console.warn(`[baskan] ${dept.id}: başkanın dönem kararları alınamadı:`, e);
    }
  }

  if (rapor.length > 0 && simResults) {
    simResults.events.push({ type: 'baskan_kararlari', turn: donem.tur, bolumler: rapor });
  }
  return rapor;
}

function _bolumDonemi(state, dept, p, araclar, simResults, donem) {
  const kisaAd = dept.shortName || dept.name;
  const durum = devirDurumu(state, dept);

  if (!durum.gecerli) {
    dept.policy = politikaTamamla({ ...p, kip: 'dogrudan' });
    const yeniBas = durum.bas
      ? ` Bölümün yeni başkanı ${kisiAdi(durum.bas)}; ona devretmek için Bölüm Sayfası'ndan yeniden seçin.`
      : '';
    simResults?.events?.unshift({
      type:        'warning',
      icon:        '🏛️',
      title:       'Başkana Devir Sona Erdi',
      deptId:      dept.id,
      description: `${kisaAd}: ${durum.neden}; bölüm doğrudan yönetiminize döndü.`,
    });
    const kayit = {
      deptId: dept.id, ad: dept.name, kisaAd, baskan: p.baskanAdi || null, yonetim: null, odak: p.odak, devirde: false,
      kararlar: [{ tur: 'uyari', metin: `Devir sona erdi: ${durum.neden}. Bölüm doğrudan yönetiminize döndü.${yeniBas}` }],
    };
    _gunlugeYaz(dept, donem, kayit);
    return kayit;
  }

  const bas = durum.bas;
  const kararlar = [];
  if (durum.baskanDegisti) {
    kararlar.push({ tur: 'bilgi', metin: `Başkan değişti; devir ${kisiAdi(bas)} ile sürüyor.` });
  }
  const pol = { ...p, baskanId: bas.id, baskanAdi: kisiAdi(bas) };
  dept.policy = pol;
  const yonetim = _yonetimPuani(bas);

  const kadro = _kadroKararlari(state, dept, pol, yonetim, kararlar, araclar);
  if (state.meta?.semester === 'bahar') _kontenjanKarari(state, dept, pol, yonetim, kararlar, araclar);
  _zorlukKarari(state, dept, pol, kararlar, araclar);
  if (pol.odak === 'arastirma') _arastirmaKararlari(state, dept, kararlar, araclar);

  const kayit = { deptId: dept.id, ad: dept.name, kisaAd, baskan: kisiAdi(bas), yonetim, odak: pol.odak, devirde: true, kararlar };
  _gunlugeYaz(dept, donem, kayit, kadro);
  return kayit;
}

/** Bölümün başkan günlüğü (en yeni başta): kararlar ve hoca ihtiyacının karşılanıp karşılanmadığı. */
function _gunlugeYaz(dept, donem, kayit, kadro = null) {
  const gunluk = Array.isArray(dept.baskanGunlugu) ? dept.baskanGunlugu : [];
  gunluk.unshift({
    tur: donem.tur, yil: donem.yil, donem: donem.donem,
    baskan: kayit.baskan, yonetim: kayit.yonetim, odak: kayit.odak,
    ihtiyac: kadro?.ihtiyac ?? 0, alinan: kadro?.alinan ?? 0, elenen: kadro?.elenen ?? 0,
    kararlar: kayit.kararlar,
  });
  dept.baskanGunlugu = gunluk.slice(0, GUNLUK_UZUNLUGU);
}

/**
 * Şimdiki devirde hoca ihtiyacı sürerken başvuruların eşiğe takıldığı (hiç alım yapılamayan) art arda son
 * dönem sayısı, en çok 3. Başvuru gelmeyen dönem zinciri bozmaz, ama sayılmaz da.
 */
function _beklemeSuresi(dept, p) {
  let n = 0;
  for (const k of Array.isArray(dept.baskanGunlugu) ? dept.baskanGunlugu : []) {
    if ((Number(k?.tur) || 0) < (Number(p.devirTuru) || 0)) break;
    if ((Number(k?.ihtiyac) || 0) === 0 || (Number(k?.alinan) || 0) > 0) break;
    if ((Number(k?.elenen) || 0) > 0) n++;
  }
  return Math.min(3, n);
}

// ── Kadro: başvuru kabulü ve ilan ─────────────────────────────────────────────

/** Odağa göre aday ve hoca puanı (bölüm ortalamasıyla aynı ölçekte). */
const SKORLAR = {
  egitim:    f => 0.5 * stat(f, 'teaching') + 0.2 * stat(f, 'research') + 0.3 * calculateOverallRating(f),
  arastirma: f => 0.5 * stat(f, 'research') + 0.2 * stat(f, 'teaching') + 0.3 * calculateOverallRating(f),
  dengeli:   f => calculateOverallRating(f),
  tasarruf:  f => calculateOverallRating(f),
};

/** Eksik uzmanlıklar: hocasız derslerin ve uzmanlık dışı (kısmi) verilen derslerin gerektirdiği alanlar. */
function _eksikUzmanliklar(dept) {
  const hocasiz = (dept.uncoveredCourses || []).map(c => c?.requiredExpertise).filter(Boolean);
  const kismi   = (dept.courseAssignments || []).filter(a => a && a.matchQuality !== 2)
    .map(a => a.course?.requiredExpertise).filter(Boolean);
  return { hocasiz: [...new Set(hocasiz)], kismi: [...new Set(kismi)] };
}

function _baremOrtasi(state, unvan) {
  const olcek  = getSalaryScale(state?.meta?.universityType || 'vakif');
  const aralik = olcek?.[unvan];
  return aralik ? (aralik.min + aralik.max) / 2 : 0;
}

function _uzmanlikYazisi(a) {
  const u = (a?.specializations || []).filter(Boolean);
  return u.length ? `uzmanlık ${u.slice(0, 2).join(', ')}` : 'uzmanlığı belirsiz';
}

/**
 * Kadro kararları: ihtiyaç varsa eşiği geçen başvuruları kabul (tavana dek), yetmezse ilan.
 * @returns {{ ihtiyac: number, alinan: number, elenen?: number }} günlüğe yazılır (karşılanmayan ihtiyaçta eşik gevşer)
 */
function _kadroKararlari(state, dept, p, yonetim, kararlar, { applyDecision } = {}) {
  if (typeof applyDecision !== 'function') return { ihtiyac: 0, alinan: 0 };
  const hocalar  = _bolumHocalari(state, dept.id);
  const ogrenci  = _ogrenciSayisi(state, dept.id);
  const hocasiz  = Array.isArray(dept.uncoveredCourses) ? dept.uncoveredCourses : [];
  const enAz     = Number.isFinite(dept.minFaculty) ? dept.minFaculty : 3;
  const oran     = hocalar.length > 0 ? ogrenci / hocalar.length : null;
  const oranYazi = oran == null ? 'hesaplanamıyor (hoca yok)' : _ondalik(oran);

  const ihtiyacDers   = Math.ceil(hocasiz.length / DERS_BASI_HOCA);
  const ihtiyacKurucu = Math.max(0, enAz - hocalar.length);
  const ihtiyacOran   = p.odak === 'tasarruf' ? 0 : Math.max(0, Math.ceil(ogrenci / p.hocaOrani) - hocalar.length);
  const ihtiyac       = Math.max(ihtiyacDers, ihtiyacKurucu, ihtiyacOran);
  const acil          = ihtiyacDers > 0 || ihtiyacKurucu > 0;

  if (ihtiyac === 0) {
    const bekleyen = (state.pendingApplicants || []).filter(a => a && a.department === dept.id).length
      + (state.spontaneousApplicants || []).filter(a => a && (a.preferredDept || a.department) === dept.id).length;
    kararlar.push({
      tur: 'bilgi',
      metin: `Kadro yeterli: ${hocalar.length} hoca, öğrenci/hoca ${oranYazi}${p.odak === 'tasarruf'
        ? ' (tasarruf odağında oran için hoca alınmaz)' : ` (hedef ${p.hocaOrani})`}, hocasız ders yok.${bekleyen > 0
        ? ` ${bekleyen} başvuru beklemede; ihtiyaç olmadığından değerlendirilmedi.` : ''}`,
    });
    return { ihtiyac: 0, alinan: 0 };
  }

  const nedenler = [];
  if (hocasiz.length > 0) nedenler.push(`${hocasiz.length} ders hocasız (${_liste(hocasiz.map(c => c?.name))})`);
  if (ihtiyacKurucu > 0) nedenler.push(`kadro en az sayının altında (${hocalar.length}/${enAz})`);
  if (ihtiyacOran > 0)   nedenler.push(`öğrenci/hoca ${oranYazi}, hedef ${p.hocaOrani}`);
  const nedenMetni = _cumle(nedenler.join('; '));

  if (p.donemlikAlimTavani <= 0) {
    kararlar.push({ tur: 'bilgi', metin: `${ihtiyac} hocaya ihtiyaç var ama dönemlik alım tavanı 0; başkan hoca almıyor.`, neden: nedenMetni });
    return { ihtiyac: 0, alinan: 0 };
  }
  if ((Number(state.university?.budget) || 0) < 0) {
    kararlar.push({ tur: 'uyari', metin: 'Kasa eksi olduğu için başkan bu dönem hoca almadı ve ilan vermedi.', neden: nedenMetni });
    return { ihtiyac: 0, alinan: 0 };
  }

  // Eşik: bölüm hocalarının ortalamasının biraz aşağısı (en çok ESIK_TAVANI); acil ihtiyaçta, ihtiyaç
  // dönemlerdir karşılanamadıysa ve zayıf başkanda gevşer
  const skor    = SKORLAR[p.odak] || SKORLAR.dengeli;
  const sapma   = (100 - yonetim) / 8;             // yönetim 80: ±2,5 · 40: ±7,5 puan görüş hatası
  const eksik   = _eksikUzmanliklar(dept);
  const aranan  = new Set(eksik.hocasiz.length ? eksik.hocasiz : eksik.kismi);
  const bekleme = _beklemeSuresi(dept, p);
  let esikTaban = hocalar.length > 0 ? _ortalama(hocalar.map(skor)) - ESIK_PAYI : 50;
  esikTaban = Math.max(35, Math.min(ESIK_TAVANI, esikTaban));
  if (acil) esikTaban -= ACIL_GEVSEME;
  esikTaban -= bekleme * BEKLEME_GEVSEME;
  if (yonetim < 50) esikTaban -= (50 - yonetim) / 3;

  const drOrta  = _baremOrtasi(state, 'dr_ogr_uyesi');
  const adaylar = [
    ...(state.pendingApplicants || []).filter(a => a && a.department === dept.id).map(a => ({ a, spontane: false })),
    ...(state.spontaneousApplicants || []).filter(a => a && (a.preferredDept || a.department) === dept.id).map(a => ({ a, spontane: true })),
  ].map(x => {
    const uyum = (x.a.specializations || []).filter(s => aranan.has(s));
    let gercek = skor(x.a) + (uyum.length ? UYUM_PUANI : 0);
    if (p.odak === 'tasarruf' && drOrta > 0) {
      gercek -= Math.max(0, (Number(x.a.salaryExpectation) || drOrta) / drOrta - 1) * 25;
    }
    return { ...x, uyum, gercek, algi: gercek + _gauss() * sapma, genel: calculateOverallRating(x.a) };
  }).sort((x, y) => y.algi - x.algi);

  const tavan = Math.min(ihtiyac, p.donemlikAlimTavani);
  const karsilanan = new Set();
  let alinan = 0, elenen = 0, reddedilen = 0;
  for (const c of adaylar) {
    if (alinan >= tavan || reddedilen >= 2) break;
    const esik = esikTaban + _gauss() * sapma / 2;   // eşik de bulanık
    if (c.algi < esik) { elenen++; continue; }
    const sonuc = c.spontane
      ? applyDecision({ type: 'accept_spontaneous', applicantId: c.a.id, targetDeptId: dept.id })
      : applyDecision({ type: 'accept_applicant', applicantId: c.a.id });
    if (!sonuc?.success) {
      // Karar bir kurala takıldı (ör. maaş ya da kadro sınırı): başkan sonraki adaya bakar, iki retten sonra bırakır
      kararlar.push({ tur: 'uyari', metin: `${kisiAdi(c.a)} kadroya alınamadı: ${sonuc?.message || 'karar uygulanamadı'}` });
      reddedilen++;
      continue;
    }
    alinan++;
    c.uyum.forEach(u => karsilanan.add(u));
    const maas = Number(c.a.salaryExpectation || c.a.salary) || 0;
    kararlar.push({
      tur:   'kabul',
      metin: `${kisiAdi(c.a)} kadroya alındı: genel puan ${c.genel}, ${_uzmanlikYazisi(c.a)}, maaş ${_para(maas)}/ay${c.spontane ? ', ilan dışı başvuru' : ''}.`,
      neden: `${nedenMetni} Başkanın değerlendirmesi ${Math.round(c.algi)}, eşik ${Math.round(esik)}${c.uyum.length ? `; eksik uzmanlığı karşılıyor (${c.uyum.join(', ')})` : ''}${bekleme ? `; ihtiyaç ${bekleme} dönemdir karşılanamadığı için eşik gevşetildi` : ''}.`,
    });
  }
  if (elenen > 0) {
    kararlar.push({ tur: 'bilgi', metin: `${elenen} başvuru başkanın eşiğinin (yaklaşık ${Math.round(esikTaban)}) altında kaldı; ihtiyaç karşılanamadıkça eşik dönem dönem gevşer, yanıtsız başvurular 2 dönem sonra geri çekilir.` });
  }

  const sonuc = { ihtiyac, alinan, elenen };
  const kalan = ihtiyac - alinan;
  if (kalan <= 0) return sonuc;
  const acikIlan = (state.openPositions || []).some(x => x && x.department === dept.id);
  if (alinan >= p.donemlikAlimTavani) {
    kararlar.push({ tur: 'bilgi', metin: `Dönemlik alım tavanı (${p.donemlikAlimTavani}) doldu; ${kalan} hoca ihtiyacı sonraki döneme kaldı${acikIlan ? ', bölümün açık ilanı sürüyor' : ''}.` });
  } else if (acikIlan) {
    kararlar.push({ tur: 'bilgi', metin: `${kalan} hoca daha gerekiyor; bölümün açık ilanı sürüyor, başvurular dönem sonunda gelir.` });
  }
  if (acikIlan) return sonuc;
  _ilanVer(state, dept, p, yonetim, kararlar, applyDecision, { eksik, kalan, nedenMetni, karsilanan });
  return sonuc;
}

function _ilanVer(state, dept, p, yonetim, kararlar, applyDecision, { eksik, kalan, nedenMetni, karsilanan }) {
  const gecerli = new Set(DEPARTMENT_FIELDS[dept.id] || []);
  const suz     = liste => liste.filter(a => gecerli.has(a) && !karsilanan.has(a));
  const hedefli = yonetim >= 50;   // zayıf başkan ilanı belirli bir uzmanlığa yöneltmez
  let alanlar = [];
  if (hedefli) {
    alanlar = suz(eksik.hocasiz);
    if (alanlar.length === 0) alanlar = suz(eksik.kismi);
  }
  alanlar = alanlar.slice(0, 4);
  const tumAlanlar = alanlar.length === 0;

  const unvan  = 'dr_ogr_uyesi';
  const olcek  = getSalaryScale(state.meta?.universityType || 'vakif');
  const aralik = olcek?.[unvan] || { min: 28_000, max: 55_000 };
  const orta   = (aralik.min + aralik.max) / 2;
  const enCok  = Math.round(aralik.max * (olcek?.maxOverscale || 1));
  const maas   = Math.min(enCok, Math.round(orta * (ILAN_MAAS_CARPANI[p.odak] || 1.1) / 1000) * 1000);
  const fon    = p.odak === 'arastirma' ? ARASTIRMA_FONU : 0;
  const tur    = Number(state.meta?.turn) || 1;

  const position = {
    id:            `pos_baskan_${dept.id}_${tur}`,
    department:    dept.id,
    title:         unvan,
    fields:        alanlar,
    allFields:     tumAlanlar,
    field:         tumAlanlar ? 'Tüm Alanlar' : alanlar.join(', '),
    offeredSalary: maas,
    researchFund:  fon,
    hasLab:        false,
    // Karar biten dönemin sonunda verildi: oyuncunun dönem içinde verdiği ilan gibi iki dönem başvuru alır
    postedTurn:    Math.max(1, tur - 1),
    baskan:        true,
  };
  const sonuc = applyDecision({ type: 'post_open_position', position });
  if (!sonuc?.success) {
    kararlar.push({ tur: 'uyari', metin: `İlan verilemedi: ${sonuc?.message || 'karar uygulanamadı'}` });
    return;
  }
  const maasNedeni = { egitim: 'barem ortasının %10 üstü', arastirma: 'barem ortasının %20 üstü (daha çok ve daha iyi aday)', dengeli: 'barem ortasının %10 üstü', tasarruf: 'barem ortası' }[p.odak];
  kararlar.push({
    tur:   'ilan',
    metin: `Kadro ilanı: Dr. Öğr. Üyesi, ${tumAlanlar ? 'tüm alanlar' : alanlar.join(', ')}, ${_para(maas)}/ay${fon ? `, dönemlik ${_para(fon)} araştırma fonu` : ''}.`,
    neden: `${nedenMetni} ${kalan} hoca daha gerekiyor; maaş ${maasNedeni}${tumAlanlar && !hedefli ? '; başkanın yönetim puanı düşük, ilan belirli bir uzmanlığa yöneltilmedi' : ''}.`,
  });
}

// ── Kontenjan (Bahar başı) ────────────────────────────────────────────────────

/** Binanın derslik koltuğu (derslik × düzeye göre derslik büyüklüğü; game.js _binaKoltugu ile aynı). */
function _binaKoltugu(b) {
  const derslik = Number(b?.currentCapacity?.classrooms) || 0;
  if (derslik <= 0) return 0;
  const def   = BUILDINGS[b.type];
  const byLvl = def?.classroomSizeByLevel;
  const boy   = byLvl ? (byLvl[b.level || 1] ?? byLvl[1] ?? def?.classroomSize ?? 40) : (def?.classroomSize ?? 40);
  return derslik * boy;
}

/**
 * Bölümün adil derslik payı (dört sınıf): atandığı binaların koltukları o binayı kullanan bölümlere eşit
 * bölünür; binası olmayan bölüm, hiçbir bölüme atanmamış binaları binasız bölümlerle eşit paylaşır.
 * Oyunun bölüm kapasitesi yer yetince öğrenci sayısı oranında paylaştırıldığından büyüyen bölümle
 * birlikte büyür; kontenjan kuralı bu yüzden eşit payı kullanır (bir bölüm ortak binayı yutmasın).
 */
function _adilKapasite(state, dept) {
  const acik    = new Set((state.departments || []).filter(d => d && d.isOpen !== false).map(d => d.id));
  const binalar = (state.buildings || []).filter(b => b?.isCompleted && _binaKoltugu(b) > 0);
  const binasiz = new Set(acik);
  let yer = 0, ortak = 0, atanmis = false;
  for (const b of binalar) {
    const kullanan = [...new Set((b.assignedDepartments || []).filter(id => acik.has(id)))];
    kullanan.forEach(id => binasiz.delete(id));
    if (kullanan.length === 0) { ortak += _binaKoltugu(b); continue; }
    if (kullanan.includes(dept.id)) { yer += _binaKoltugu(b) * SINIF_SAYISI / kullanan.length; atanmis = true; }
  }
  if (!atanmis && binasiz.size > 0) yer += ortak * SINIF_SAYISI / binasiz.size;
  if (yer < 1) yer = Number(dept.studentCapacity) || 0;
  return Math.round(yer);
}

/** Toplamı burs türlerine böler: devlette hepsi tek kalemde, vakıfta önceki dağılımın oranında. */
function _dagit(toplam, onceki, tip) {
  if (tip === 'devlet') return { tamBurslu: 0, yariBurslu: 0, ucretli: toplam };
  const olagan = tip === 'us_private' ? { tamBurslu: 10, yariBurslu: 20, ucretli: 30 } : { tamBurslu: 5, yariBurslu: 10, ucretli: 30 };
  const k = _toplam(onceki) > 0 ? onceki : olagan;
  const s = _toplam(k);
  const tam  = Math.min(toplam, Math.round(toplam * (Number(k.tamBurslu) || 0) / s));
  const yari = Math.min(toplam - tam, Math.round(toplam * (Number(k.yariBurslu) || 0) / s));
  return { tamBurslu: tam, yariBurslu: yari, ucretli: Math.max(0, toplam - tam - yari) };
}

function _kontenjanKarari(state, dept, p, yonetim, kararlar, { applyQuotas } = {}) {
  if (typeof applyQuotas !== 'function') return;
  const tip     = state.meta?.universityType || 'vakif';
  const q       = state.students?.quotas?.[dept.id] || null;
  const onceki  = q ? _toplam(q) : null;
  const bd      = state.students?.byDepartment?.[dept.id] || {};
  const sayi    = k => Number(bd[k]?.count) || 0;
  const hocalar = _bolumHocalari(state, dept.id);
  const taban   = onceki ?? VARSAYILAN_KONTENJAN[tip] ?? 45;

  let hedef, neden;
  if (p.kontenjanKurali === 'sabit') {
    // Sabit kural kontenjana dokunmaz (dağılım da korunur); kontenjanı olmayan bölüme olağan değer konur
    if (onceki != null) {
      kararlar.push({ tur: 'kontenjan', metin: `Gelecek yılın kontenjanı ${onceki} (değişmedi).`, neden: 'Kural sabit: şu anki kontenjan korunuyor.' });
      return;
    }
    hedef = taban;
    neden = 'Kural sabit: bölümün kontenjanı yoktu, olağan değer konuldu.';
  } else {
    // Dengeli yıllık alım (hedef doluluğun dörtte biri) ve farkın dörtte biri: bölüm hedefe dalgalanmadan
    // yaklaşır (farkın hepsi bir yılda kapatılınca kontenjan bir yıl büyük, ertesi yıl küçük çıkıyordu)
    const yer    = _adilKapasite(state, dept);
    const hedefT = Math.round(yer * DOLULUK_HEDEFI);
    const kohort = hedefT / SINIF_SAYISI;
    const ust    = sayi('year1') + sayi('year2') + sayi('year3');
    let ham = kohort + (hedefT - ust - kohort) / SINIF_SAYISI;
    const sapma = Math.max(0, 75 - yonetim) / 250;   // yönetim 50: %10, 25: %20 hesap sapması
    if (sapma > 0 && ham > 0) ham *= (1 + _gauss() * sapma);
    ham = Math.max(0, Math.round(ham));
    const enCok = Math.round(Math.max(taban * (1 + YILLIK_DEGISIM), taban + EN_AZ_ARTIS));
    const enAz  = Math.floor(taban * (1 - YILLIK_DEGISIM));
    hedef = Math.min(enCok, Math.max(enAz, ham));
    const parcalar = [
      `derslik payı ${yer} yer (4 sınıf, %95 doluluk ${hedefT})`,
      `dengeli yıllık alım ${Math.round(kohort)}`,
      `gelecek yıl 2-4. sınıfta ${ust} öğrenci olacak; fark dört yıla yayılınca ${ham} yeni öğrenci`,
    ];
    if (hedef !== ham) parcalar.push(`yıllık değişim ${enAz}-${enCok} arasında tutuldu`);
    // Kadro öğrenci/hoca hedefine yetişmiyorsa kontenjan artırılmaz (öğrenci sayısı hoca alımından hızlı büyümesin);
    // oran yüzünden kontenjan düşürülmez, yalnız artış sınırlanır
    const oranSiniri = Math.floor(p.hocaOrani * ORAN_PAYI * hocalar.length - ust);
    if (hocalar.length > 0 && hedef > taban && hedef > oranSiniri) {
      hedef = Math.max(taban, oranSiniri);
      parcalar.push(hedef === taban
        ? `${hocalar.length} hocayla öğrenci/hoca hedefi (${p.hocaOrani}) çok aşılacağından kontenjan artırılmadı`
        : `${hocalar.length} hocayla öğrenci/hoca hedefi (${p.hocaOrani}) çok aşılmasın diye artış ${hedef} ile sınırlandı`);
    }
    const hocaSiniri = hocalar.length * HOCA_BASI_OGRENCI;
    if (hocaSiniri > 0 && hedef > hocaSiniri) {   // kontenjan penceresinin "hoca kapasitesi" uyarısı çıkmasın
      hedef = hocaSiniri;
      parcalar.push(`hoca kapasitesi ${hocaSiniri} (hoca × 30)`);
    }
    neden = _cumle(`Kural kapasiteye göre: ${parcalar.join(', ')}`);
    if (yonetim < 50) neden += ' Başkanın yönetim puanı düşük; hesap sapabilir.';
    if (onceki != null && hedef === onceki) {   // toplam değişmiyorsa kontenjana (ve burs dağılımına) dokunulmaz
      kararlar.push({ tur: 'kontenjan', metin: `Gelecek yılın kontenjanı ${onceki} (değişmedi).`, neden });
      return;
    }
  }

  const sonuc = applyQuotas({ [dept.id]: _dagit(hedef, q, tip) });
  if (!sonuc?.success) {
    kararlar.push({ tur: 'uyari', metin: `Kontenjan konamadı: ${sonuc?.message || 'karar uygulanamadı'}` });
    return;
  }
  const yazilan = state.students?.quotas?.[dept.id] || null;
  const toplam  = yazilan ? _toplam(yazilan) : hedef;
  if (toplam !== hedef) neden += ` Derslik sınırı nedeniyle ${toplam} oldu.`;
  if (hocalar.length < (Number.isFinite(dept.minFaculty) ? dept.minFaculty : 3)) {
    neden += ' Kurucu kadro tamamlanmazsa bölüm öğrenci alamaz.';
  }
  const degisim  = onceki == null ? '' : onceki === toplam ? ' (değişmedi)' : ` (önceki ${onceki})`;
  const dagilim  = tip !== 'devlet' && yazilan
    ? `: ${yazilan.tamBurslu} tam burslu, ${yazilan.yariBurslu} yarı burslu, ${yazilan.ucretli} ücretli` : '';
  kararlar.push({ tur: 'kontenjan', metin: `Gelecek yılın kontenjanı ${toplam}${degisim}${dagilim}.`, neden });
}

// ── Ders zorluğu ─────────────────────────────────────────────────────────────

/** Dersin geçerli zorluğu (game.js getCourseEffectiveDifficulty ile aynı). */
function _etkinZorluk(dept, c) {
  const o = dept.curriculumOverrides?.[c.id];
  return (o && typeof o.difficulty === 'number') ? Math.max(1, Math.min(5, o.difficulty)) : c.difficulty;
}

function _zorlukKarari(state, dept, p, kararlar, { setCourseDifficulty } = {}) {
  if (typeof setCourseDifficulty !== 'function') return;
  const istat   = new Map((dept.stats?.courseStats || []).map(c => [c.id, c]));
  const dersler = (DEPARTMENT_CURRICULA[dept.id] || [])
    .map(c => ({ c, z: _etkinZorluk(dept, c), olagan: Number(c.difficulty) || 3, gecme: Number(istat.get(c.id)?.passRate) }))
    .filter(d => Number.isFinite(d.gecme) && Number.isFinite(d.z));
  if (dersler.length === 0) return;

  const kural  = ZORLUK_KURALI[p.odak] || ZORLUK_KURALI.dengeli;
  const odakAd = ODAKLAR[p.odak].ad.toLocaleLowerCase('tr');
  const enDusuk  = liste => liste.slice().sort((a, b) => a.gecme - b.gecme)[0];
  const enYuksek = liste => liste.slice().sort((a, b) => b.gecme - a.gecme)[0];
  let secim = null, yeni = null, neden = '';

  const zor = dersler.filter(d => d.gecme < kural.indirAlti && d.z > kural.enAz);
  if (zor.length > 0) {
    secim = enDusuk(zor);
    yeni  = secim.z - 1;
    neden = `Geçme oranı ${_yuzde(secim.gecme)}; ${odakAd} odağında geçme oranı ${_yuzde(kural.indirAlti)} altındaki ders kolaylaştırılır.`;
  } else if (p.odak === 'egitim') {
    const kolay = dersler.filter(d => d.gecme > kural.artirUstu && d.z < d.olagan);
    if (kolay.length > 0) {
      secim = enYuksek(kolay);
      yeni  = secim.z + 1;
      neden = `Geçme oranı ${_yuzde(secim.gecme)}; ders olağan zorluğunun (${secim.olagan}) altındaydı, eğitimin niteliği için bir kademe geri çekildi.`;
    }
  } else if (p.odak === 'arastirma') {
    const kolay = dersler.filter(d => d.gecme >= kural.artirUstu && d.z < Math.min(5, d.olagan + 1));
    if (kolay.length > 0) {
      secim = enYuksek(kolay);
      yeni  = secim.z + 1;
      neden = `Araştırma odağında müfredat sıkı tutulur; geçme oranı ${_yuzde(secim.gecme)} yeterli.`;
    }
  } else if (p.odak === 'dengeli') {
    // Olağan zorluktan en çok sapan ders bir kademe geri çekilir; geçme oranı düşük ders zorlaştırılmaz
    const aday = dersler.filter(d => d.z !== d.olagan && (d.z > d.olagan || d.gecme >= kural.indirAlti + 0.1))
      .sort((a, b) => Math.abs(b.z - b.olagan) - Math.abs(a.z - a.olagan))[0];
    if (aday) {
      secim = aday;
      yeni  = aday.z + Math.sign(aday.olagan - aday.z);
      neden = `Dengeli odakta ders olağan zorluğuna (${aday.olagan}) çekilir; geçme oranı ${_yuzde(aday.gecme)}.`;
    }
  }
  if (!secim) return;
  yeni = Math.max(1, Math.min(5, yeni));
  if (yeni === secim.z) return;
  const sonuc = setCourseDifficulty(dept.id, secim.c.id, yeni);
  if (!sonuc?.success) return;
  kararlar.push({ tur: 'zorluk', metin: `${secim.c.name}: zorluk ${secim.z} → ${sonuc.difficulty ?? yeni}.`, neden });
}

// ── Araştırma odağı: BAP ve bekleyen proje başvuruları ────────────────────────

function _bapVerimi(a) {
  return (Number(a?.estimatedPublications) || 1) / Math.max(1, Number(a?.requestedFunding) || 1);
}

function _arastirmaKararlari(state, dept, kararlar, { applyDecision } = {}) {
  if (typeof applyDecision !== 'function') return;
  const r          = state.research || {};
  const hocaIdleri = new Set(_bolumHocalari(state, dept.id).map(f => f.id));
  const bolumun    = a => a && (hocaIdleri.has(a.facultyId)
    || (a.facultyDept === dept.id && !(state.faculty || []).some(f => f.id === a.facultyId)));

  const bap = r.activeBapCall;
  if (!bap) {
    kararlar.push({ tur: 'bilgi', metin: 'Açık BAP çağrısı yok; çağrıyı rektör Araştırma sekmesinden açar.' });
  } else {
    const basvurular = (r.bapApplications || []).filter(bolumun).sort((a, b) => _bapVerimi(b) - _bapVerimi(a));
    let kullanilan = (r.activeResearchProjects || [])
      .filter(pr => pr?.callType === 'BAP' && hocaIdleri.has(pr.piId) && (Number(pr.startedTurn) || 0) >= (Number(bap.openedTurn) || 0))
      .reduce((s, pr) => s + (Number(pr.requestedFunding || pr.funding) || 0), 0);
    const pay = (Number(bap.totalBudget) || 0) * BAP_PAYI;
    let onay = 0, payDoldu = false;
    for (const a of basvurular) {
      if (onay >= BAP_EN_COK) break;
      const cagri = state.research?.activeBapCall;
      if (!cagri) break;
      const tutar = Number(a.requestedFunding) || 0;
      if (kullanilan + tutar > pay) { payDoldu = true; continue; }
      const oncekiKalan = Number(cagri.remainingBudget) || 0;
      if (oncekiKalan < tutar) continue;
      const sonuc = applyDecision({ type: 'approve_bap_application', applicationId: a.id });
      if (!sonuc?.success) {
        kararlar.push({ tur: 'uyari', metin: `BAP başvurusu onaylanamadı: ${sonuc?.message || 'karar uygulanamadı'}` });
        break;
      }
      kullanilan += tutar;
      onay++;
      kararlar.push({
        tur:   'bap',
        metin: `BAP projesi onaylandı: "${a.projectName || 'Adsız proje'}", yürütücü ${a.facultyName || 'bölüm hocası'}, ${_para(tutar)}, yaklaşık ${a.estimatedPublications || 1} yayın.`,
        neden: `Araştırma odağı; açık BAP çağrısında ${_para(oncekiKalan)} vardı, bölüm çağrı bütçesinin en çok yarısını kullanır.`,
      });
    }
    if (onay === 0) {
      kararlar.push({
        tur: 'bilgi',
        metin: basvurular.length === 0 ? 'Açık BAP çağrısında bölümden bekleyen başvuru yok.'
          : payDoldu ? 'Bölüm BAP çağrısındaki payını doldurdu; kalan başvurular rektörün onayını bekliyor.'
          : 'Bölümün BAP başvuruları çağrının kalan bütçesine sığmıyor.',
      });
    }
  }

  // Eski kayıtlarda kalmış, onay bekleyen dış proje başvuruları (yeni oyunda dış projeler kendiliğinden işlenir)
  for (const a of (r.pendingProjectApplications || []).filter(bolumun).slice(0, 1)) {
    const sonuc = applyDecision({ type: 'approve_project_application', applicationId: a.id });
    if (!sonuc?.success) continue;
    kararlar.push({
      tur:   'proje',
      metin: `Bekleyen dış proje başvurusu gönderildi: "${a.projectName || 'Adsız proje'}"; fon kurumu ${sonuc.accepted ? 'kabul etti' : 'reddetti'}.`,
      neden: 'Araştırma odağı; başvuru rektörün onayını bekliyordu.',
    });
  }
}
