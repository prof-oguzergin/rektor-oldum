/**
 * Rektör Oldum — Rastgele Olay Motoru (events.js)
 * ES6 module. Olay tetikleme, karar uygulama, trend olayları ve açıklama üretimi.
 */

import {
  EVENTS_POOL,
  DIFFICULTY_SETTINGS,
  TREND_CYCLES,
} from './data.js?v=0.4.22';

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: 0-100 aralığına sıkıştır
// ─────────────────────────────────────────────────────────────────────────────

function clamp(val, min = 0, max = 100) {
  return Math.max(min, Math.min(max, val));
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Tüm bölüm sınıflarına memnuniyet delta uygula
// ─────────────────────────────────────────────────────────────────────────────

function _applyStudentSatisfactionDelta(state, delta) {
  const byDept = state.students?.byDepartment || {};
  for (const d of Object.values(byDept)) {
    for (const yr of [d?.year1, d?.year2, d?.year3, d?.year4]) {
      if (yr) yr.satisfaction = clamp((yr.satisfaction || 60) + delta);
    }
  }
  state.students.overallSatisfaction = clamp(
    (state.students.overallSatisfaction || 60) + delta
  );
  // Eski kohort fallback
  if (state.students?.cohorts) {
    state.students.cohorts.forEach(c => { c.satisfaction = clamp((c.satisfaction || 60) + delta); });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Öğrenci bırakma (tüm sınıflardan oran kadar)
// ─────────────────────────────────────────────────────────────────────────────

function _applyStudentDropout(state, ratio) {
  const byDept = state.students?.byDepartment || {};
  let totalLoss = 0;
  for (const d of Object.values(byDept)) {
    for (const yr of [d?.year1, d?.year2, d?.year3, d?.year4]) {
      if (!yr || !yr.count) continue;
      const loss = Math.floor(yr.count * ratio);
      yr.count = Math.max(0, yr.count - loss);
      totalLoss += loss;
    }
  }
  // Eski kohort fallback
  if (state.students?.cohorts) {
    state.students.cohorts.forEach(c => {
      const loss = Math.floor(c.count * ratio);
      c.count = Math.max(0, c.count - loss);
    });
  }
  state.students.totalEnrolled = Math.max(0, (state.students.totalEnrolled || 0) - totalLoss);
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Rastgele tam sayı (dahil, dahil)
// ─────────────────────────────────────────────────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─────────────────────────────────────────────────────────────────────────────
// YARDIMCI: Tarih damgalı olay ID'si
// ─────────────────────────────────────────────────────────────────────────────

let _eventCounter = 1;
function nextEventId(baseId) {
  return `${baseId}_${Date.now()}_${_eventCounter++}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// TREND OLAYLARI — Kalıcı havuz
// checkTrendEvents() tarafından kullanılır.
// ─────────────────────────────────────────────────────────────────────────────

const TREND_EVENTS = [
  {
    id:          'yapay_zeka_patlamasi',
    name:        'Yapay Zeka Patlaması',
    description: 'Yapay zeka sektörü küresel ölçekte patlama yaşadı. YZ ve Bilgisayar Mühendisliği bölümlerine talep zirveye çıktı.',
    probability: 0.06,
    deptEffects: { yapay_zeka: +20, bilgisayar_muh: +15, matematik: +8 },
  },
  {
    id:          'saglik_krizi',
    name:        'Küresel Sağlık Krizi',
    description: 'Dünyayı etkileyen yeni bir sağlık krizi patlak verdi. Tıp, Eczacılık ve Biyomedikal bölümlerine olan ilgi tavan yaptı.',
    probability: 0.04,
    deptEffects: { tip: +18, eczacilik: +12, biyomedikal: +15, hemsirelik: +10 },
  },
  {
    id:          'yesil_devrim',
    name:        'Yeşil Devrim',
    description: 'Sürdürülebilirlik ve iklim krizi gündemin zirvesinde. Çevre mühendisliği ve kimya bölümleri değer kazandı.',
    probability: 0.05,
    deptEffects: { kimya: +12, biyoloji: +10, fizik: +8 },
  },
  {
    id:          'ekonomik_canlanma',
    name:        'Ekonomik Canlanma',
    description: 'Ülke ekonomisi güçlü büyüme kaydetti. İşletme, İktisat ve Hukuk bölümlerine talep arttı.',
    probability: 0.07,
    deptEffects: { isletme: +15, iktisat: +12, hukuk: +10 },
  },
  {
    id:          'insaat_patlamasi',
    name:        'Kentsel Dönüşüm Patlaması',
    description: 'Büyük kentsel dönüşüm projeleri başladı. İnşaat ve Makine mühendisliği bölümlerine yoğun talep var.',
    probability: 0.05,
    deptEffects: { insaat: +18, makine: +10, endustri: +8 },
  },
  {
    id:          'psikoloji_farkindaliği',
    name:        'Ruh Sağlığı Farkındalık Dalgası',
    description: 'Toplumda ruh sağlığına verilen önem arttı. Psikoloji bölümüne başvurular rekor kırdı.',
    probability: 0.06,
    deptEffects: { psikoloji: +20, hemsirelik: +8 },
  },
  {
    id:          'teknoloji_soguması',
    name:        'Teknoloji Sektörü Soğuması',
    description: 'Global teknoloji şirketleri toplu işten çıkarma dalgası yaşadı. YZ ve yazılım bölümlerine ilgi geçici olarak geriledi.',
    probability: 0.04,
    deptEffects: { yapay_zeka: -15, bilgisayar_muh: -10 },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// applyEventEffects — Olay efektlerini state'e uygula
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bir olayın effects nesnesindeki değişimleri state'e doğrudan uygular.
 * Desteklenen efekt türleri:
 *   budget, prestige, satisfaction, faculty_happiness, research,
 *   studentMorale, buildingDamage, tuitionRevenue, studentDropout,
 *   deptDemandBonus, internationalization, facultyMorale, researchDelay
 *
 * @param {object} state   — Oyun durumu (doğrudan güncellenir)
 * @param {object} effects — Uygulanacak efektler nesnesi
 * @returns {string[]} Uygulanan değişikliklerin özet listesi
 */
export function applyEventEffects(state, effects) {
  const log = [];

  if (!effects) return log;

  // Bütçe değişimi
  if (effects.budget) {
    state.university.budget += effects.budget;
    log.push(`Kasa: ${effects.budget > 0 ? '+' : ''}${effects.budget.toLocaleString('tr-TR')} ₺`);
  }

  // Saygınlık değişimi
  if (effects.prestige) {
    state.university.prestige = clamp(state.university.prestige + effects.prestige);
    log.push(`Saygınlık: ${effects.prestige > 0 ? '+' : ''}${effects.prestige}`);
  }

  // Genel memnuniyet
  if (effects.satisfaction || effects.studentMorale) {
    const delta = effects.satisfaction || effects.studentMorale;
    _applyStudentSatisfactionDelta(state, delta);
    log.push(`Öğrenci memnuniyeti: ${delta > 0 ? '+' : ''}${delta}`);
  }

  // Hoca mutluluğu
  if (effects.faculty_happiness || effects.facultyHappiness || effects.facultyMorale) {
    const delta = effects.faculty_happiness || effects.facultyHappiness || effects.facultyMorale;
    state.faculty.forEach(f => {
      f.happinessScore = clamp(f.happinessScore + delta);
    });
    log.push(`Hoca mutluluğu: ${delta > 0 ? '+' : ''}${delta}`);
  }

  // Araştırma etkisi (bonus/malus veya researchBonus nesnesi)
  if (effects.research) {
    state.research.publications = Math.max(0, state.research.publications + effects.research);
    log.push(`Araştırma/yayın: ${effects.research > 0 ? '+' : ''}${effects.research}`);
  }
  if (effects.researchBonus) {
    const bonus = effects.researchBonus;
    // null dept → rastgele bölüm; değer oransal
    const targetDepts = bonus.dept
      ? state.departments.filter(d => d.id === bonus.dept)
      : state.departments;
    targetDepts.forEach(() => {
      const currentPubs = state.research.publications;
      const add = Math.round(currentPubs * Math.abs(bonus.value));
      state.research.publications = Math.max(0, currentPubs + (bonus.value > 0 ? add : -add));
    });
    log.push(`Araştırma bonusu: ${bonus.value > 0 ? '+' : ''}${bonus.value * 100}%`);
  }

  // Bina hasarı
  if (effects.buildingDamage) {
    const ratio   = effects.buildingDamage;
    const damaged = Math.floor(state.buildings.length * ratio);
    for (let i = 0; i < damaged; i++) {
      if (state.buildings[i]) state.buildings[i].damaged = true;
    }
    log.push(`Bina hasarı: ${Math.round(ratio * 100)}% bina etkilendi`);
  }

  // Harç gelir kaybı
  if (effects.tuitionRevenue) {
    const satImpact = Math.round(effects.tuitionRevenue * 30);
    _applyStudentSatisfactionDelta(state, satImpact);
    log.push(`Harç geliri etkisi: ${Math.round(effects.tuitionRevenue * 100)}%`);
  }

  // Bölüm talep bonusu
  if (effects.deptDemandBonus) {
    const { depts, value } = effects.deptDemandBonus;
    (depts || []).forEach(deptId => {
      const dept = state.departments.find(d => d.id === deptId);
      if (dept) {
        dept.baseStudentDemand = Math.max(0.1, (dept.baseStudentDemand || 1.0) + value);
        log.push(`${deptId} talep bonusu: +${Math.round(value * 100)}%`);
      }
    });
  }

  // Öğrenci kaybı (kriz kaynaklı)
  if (effects.studentDropout) {
    _applyStudentDropout(state, effects.studentDropout);
    log.push(`Öğrenci kaybı: %${Math.round(effects.studentDropout * 100)} bıraktı`);
  }

  // Uluslararasılaşma
  if (effects.internationalization) {
    state.university.internationalRatio = clamp(
      (state.university.internationalRatio || 0.02) + effects.internationalization / 100,
      0, 1
    );
    log.push(`Uluslararasılaşma: +${effects.internationalization}`);
  }

  // Araştırma gecikmesi (dönemlik proje durdurma)
  if (effects.researchDelay) {
    const count = Math.min(effects.researchDelay, state.research.activeProjects.length);
    for (let i = 0; i < count; i++) {
      if (state.research.activeProjects[i]) {
        state.research.activeProjects[i].turnsRemaining =
          (state.research.activeProjects[i].turnsRemaining || 1) + 1;
      }
    }
    log.push(`Araştırma gecikmesi: ${count} proje ertelendi`);
  }

  return log;
}

// ─────────────────────────────────────────────────────────────────────────────
// triggerEvent — Belirli bir olayı tetikle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EVENTS_POOL'dan veya TREND_EVENTS'ten olayı bulur, state'e uygular.
 * Karar gerektiren olaylar events.pendingDecision'a konur (tur kilitleme).
 *
 * @param {object} state   — Oyun durumu (doğrudan güncellenir)
 * @param {string} eventId — Tetiklenecek olay ID'si
 * @returns {object} Tetiklenen olay nesnesi (uygulandıysa)
 */
export function triggerEvent(state, eventId) {
  // Havuzda ara
  const pool    = [...EVENTS_POOL, ...TREND_EVENTS];
  const template = pool.find(e => e.id === eventId);
  if (!template) {
    return { success: false, reason: `Bilinmeyen olay: ${eventId}` };
  }

  // Anlık olay kaydı oluştur
  const instance = {
    instanceId:  nextEventId(eventId),
    id:          template.id,
    name:        template.name,
    description: generateEventDescription(template, state),
    type:        template.type || 'neutral',
    turn:        state.meta.turn,
    year:        state.meta.year,
    semester:    state.meta.semester,
    resolved:    false,
    chosenOption: null,
    effectLog:   [],
  };

  // Karar gerektiriyor mu?
  if (template.decision) {
    // Oyuncu kararı bekliyor — state kilitlenir, UI bunu gösterir
    state.events.pendingDecision = {
      instanceId: instance.instanceId,
      eventId:    template.id,
      options:    Object.entries(template.decision).map(([key, opt]) => ({
        key,
        label: opt.label,
      })),
    };
    state.events.current = instance;
    state.events.history.push(instance);
    return { success: true, instance, requiresDecision: true };
  }

  // Karar gerektirmiyor: hemen uygula
  instance.effectLog = applyEventEffects(state, template.effects);
  instance.resolved  = true;
  state.events.current = instance;
  state.events.history.push(instance);

  return { success: true, instance, requiresDecision: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveDecision — Oyuncunun olay kararını uygula
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bekleyen kararı oyuncunun seçimine göre çözer.
 *
 * @param {object} state        — Oyun durumu (doğrudan güncellenir)
 * @param {string} eventId      — Olay ID'si
 * @param {number} choiceIndex  — Seçenek dizini (0, 1, 2, …)
 * @returns {object} Karar sonuç özeti
 */
export function resolveDecision(state, eventId, choiceIndex) {
  if (!state.events.pendingDecision) {
    return { success: false, reason: 'Bekleyen karar yok.' };
  }
  if (state.events.pendingDecision.eventId !== eventId) {
    return { success: false, reason: `Beklenen karar ${state.events.pendingDecision.eventId}, alınan ${eventId}.` };
  }

  const template = EVENTS_POOL.find(e => e.id === eventId);
  if (!template || !template.decision) {
    return { success: false, reason: 'Olay bulunamadı veya karar içermiyor.' };
  }

  const decisionKeys  = Object.keys(template.decision);
  const chosenKey     = decisionKeys[choiceIndex];
  if (!chosenKey) {
    return { success: false, reason: `Geçersiz seçenek dizini: ${choiceIndex}` };
  }

  const chosenOption  = template.decision[chosenKey];
  const effectLog     = [];

  // --- Seçenek efektlerini state'e uygula ---

  // Bütçe maliyeti
  if (chosenOption.cost || chosenOption.extraCost) {
    const cost = chosenOption.cost || chosenOption.extraCost || 0;
    if (typeof cost === 'number') {
      state.university.budget -= cost;
      effectLog.push(`Maliyet: -${cost.toLocaleString('tr-TR')} ₺`);
    }
  }

  // Memnuniyet bonusu
  if (chosenOption.satisfactionBonus || chosenOption.moraleBonus) {
    const delta = chosenOption.satisfactionBonus || chosenOption.moraleBonus;
    _applyStudentSatisfactionDelta(state, delta);
    effectLog.push(`Memnuniyet: ${delta > 0 ? '+' : ''}${delta}`);
  }

  // Saygınlık kaybı/bonusu
  if (chosenOption.prestigeLoss) {
    state.university.prestige = clamp(state.university.prestige + chosenOption.prestigeLoss);
    effectLog.push(`Saygınlık: ${chosenOption.prestigeLoss}`);
  }
  if (chosenOption.prestigeBonus) {
    state.university.prestige = clamp(state.university.prestige + chosenOption.prestigeBonus);
    effectLog.push(`Saygınlık: +${chosenOption.prestigeBonus}`);
  }

  // Akreditasyon bonusu
  if (chosenOption.accreditationBonus) {
    state.departments.forEach(dept => {
      dept.accreditationScore = clamp(
        (dept.accreditationScore || 0) + chosenOption.accreditationBonus
      );
    });
    effectLog.push(`Akreditasyon: +${chosenOption.accreditationBonus}`);
  }

  // Yıllık gelir ekle (AR-GE merkezi vb.)
  if (chosenOption.annualRevenue) {
    state.university.budget += chosenOption.annualRevenue;
    effectLog.push(`Yıllık gelir: +${chosenOption.annualRevenue.toLocaleString('tr-TR')} ₺`);
  }

  // Araştırma bonusu
  if (chosenOption.researchBonus) {
    const add = Math.round(state.research.publications * chosenOption.researchBonus);
    state.research.publications += add;
    effectLog.push(`Araştırma bonusu: +${add} yayın`);
  }

  // Sektör bağ bonusu
  if (chosenOption.industryTieBonus) {
    state.university.hasTechnoPark = state.university.hasTechnoPark || (chosenOption.industryTieBonus >= 10);
    effectLog.push(`Sektör bağlantısı: +${chosenOption.industryTieBonus}`);
  }

  // Hoca elde tutma (hoca_istifasi olayı)
  if (typeof chosenOption.retainChance === 'number') {
    const retained = Math.random() < chosenOption.retainChance;
    effectLog.push(retained
      ? 'Yıldız hoca elde tutuldu!'
      : 'Yıldız hoca üniversiteden ayrıldı.');
    if (!retained && chosenOption.prestigeLoss) {
      state.university.prestige = clamp(state.university.prestige + (chosenOption.prestigeLoss || -3));
    }
  }

  // Araştırma kaybı (hoca_istifasi optionB)
  if (chosenOption.researchLoss) {
    state.research.publications = Math.max(0, state.research.publications + chosenOption.researchLoss);
    effectLog.push(`Araştırma kaybı: ${chosenOption.researchLoss}`);
  }

  // Temel olayın kalan efektlerini de uygula
  const baseEffectLog = applyEventEffects(state, template.effects);
  effectLog.push(...baseEffectLog);

  // Kaydı güncelle
  const instance = state.events.history.find(
    e => e.instanceId === state.events.pendingDecision.instanceId
  );
  if (instance) {
    instance.resolved     = true;
    instance.chosenOption = chosenKey;
    instance.choiceLabel  = chosenOption.label;
    instance.effectLog    = effectLog;
  }

  // Kilidi kaldır
  state.events.pendingDecision = null;
  state.events.current         = null;

  return { success: true, chosenKey, choiceLabel: chosenOption.label, effectLog };
}

// ─────────────────────────────────────────────────────────────────────────────
// checkForEvents — Bu dönem olay olup olmayacağını kontrol et
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Her olayın probability × zorluk çarpanına göre tetiklenip tetiklenmeyeceğine karar verir.
 * Dönem başına en fazla 2 olay tetiklenir.
 *
 * @param {object} state — Oyun durumu
 * @returns {object[]} Tetiklenen olay instanceId listesi (triggerEvent sonuçları)
 */
export function checkForEvents(state) {
  // Bekleyen karar varken yeni olay ekleme
  if (state.events.pendingDecision) {
    return [];
  }

  const diffSettings = DIFFICULTY_SETTINGS[state.meta.difficulty] || DIFFICULTY_SETTINGS.normal;
  const eventRate    = diffSettings.eventFrequency || 1.0;

  const triggered = [];

  // Karıştırılmış havuz — her tur farklı sıra
  const shuffled  = [...EVENTS_POOL].sort(() => Math.random() - 0.5);

  for (const eventTemplate of shuffled) {
    if (triggered.length >= 2) break;

    const adjustedProb = eventTemplate.probability * eventRate;
    if (Math.random() < adjustedProb) {
      const result = triggerEvent(state, eventTemplate.id);
      if (result.success) {
        triggered.push(result);
        // Karar gerektiren olay tetiklendiyse daha fazla olay ekleme
        if (result.requiresDecision) break;
      }
    }
  }

  return triggered;
}

// ─────────────────────────────────────────────────────────────────────────────
// checkTrendEvents — Trend değiştiren olaylar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bölüm talep trendlerini kalıcı olarak etkileyen olayları kontrol eder.
 * trendHeat değerlerini doğrudan değiştirir.
 *
 * @param {object} state — Oyun durumu (doğrudan güncellenir)
 * @returns {object[]} Tetiklenen trend olayları
 */
export function checkTrendEvents(state) {
  const triggered = [];

  for (const trendEvent of TREND_EVENTS) {
    if (Math.random() >= trendEvent.probability) continue;

    const heats    = state.university.trendHeats;
    const eventLog = { id: trendEvent.id, name: trendEvent.name, changes: [] };

    // Spike miktarları: data.js kurallarıyla sınırlandır
    const maxSpike = TREND_CYCLES.rules.eventSpikeMax  || 20;
    const maxDrop  = TREND_CYCLES.rules.eventDropMax   || -15;

    Object.entries(trendEvent.deptEffects || {}).forEach(([deptId, delta]) => {
      if (heats[deptId] !== undefined) {
        const cappedDelta = delta > 0 ? Math.min(delta, maxSpike) : Math.max(delta, maxDrop);
        heats[deptId]     = clamp(heats[deptId] + cappedDelta);
        eventLog.changes.push({ deptId, delta: cappedDelta });
      }
    });

    // Olay geçmişine ekle (ayrı bir trend kaydı olarak)
    const instance = {
      instanceId:  nextEventId(trendEvent.id),
      id:          trendEvent.id,
      name:        trendEvent.name,
      description: trendEvent.description,
      type:        'trend',
      turn:        state.meta.turn,
      year:        state.meta.year,
      semester:    state.meta.semester,
      resolved:    true,
      effectLog:   eventLog.changes.map(c =>
        `${c.deptId} trend ısısı: ${c.delta > 0 ? '+' : ''}${c.delta}`
      ),
    };

    state.events.history.push(instance);
    triggered.push(eventLog);
  }

  return triggered;
}

// ─────────────────────────────────────────────────────────────────────────────
// getEventHistory — Geçmiş olaylar listesi
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tüm olay geçmişini döndürür.
 * Son N olayla sınırlı filtreleme seçeneği sunar.
 *
 * @param {object} state  — Oyun durumu
 * @param {number} [last] — Son kaç olay getirilecek (varsayılan: tümü)
 * @returns {object[]} Olay geçmişi listesi (en yeniden eskiye)
 */
export function getEventHistory(state, last) {
  const history = [...state.events.history].reverse();
  return last ? history.slice(0, last) : history;
}

// ─────────────────────────────────────────────────────────────────────────────
// generateEventDescription — Olay Türkçe açıklama metni üret
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Olay template'ini ve mevcut oyun durumunu kullanarak dinamik Türkçe açıklama üretir.
 *
 * @param {object} event — Olay şablonu (EVENTS_POOL veya TREND_EVENTS öğesi)
 * @param {object} state — Oyun durumu
 * @returns {string} Türkçe açıklama metni
 */
export function generateEventDescription(event, state) {
  // Temel açıklamayı al
  let desc = event.description || event.name;

  // Dinamik bağlam eklemeleri
  const uniName   = state.university.name;
  const prestige  = state.university.prestige;
  const semester  = state.meta.semester === 'güz' ? 'güz' : 'bahar';
  const year      = state.meta.year;

  // Üniversite adını ve dönemi metne ekle
  desc = `[${uniName} — ${year}. yıl, ${semester} dönemi] ${desc}`;

  // Olay tipine göre ek bağlam
  switch (event.type) {
    case 'positive':
      desc += prestige >= 60
        ? ' Güçlü saygınlığınız bu fırsatı daha değerli kılıyor.'
        : ' Bu fırsat saygınlığınızı artırmak için iyi bir adım olabilir.';
      break;
    case 'negative':
      desc += prestige >= 50
        ? ' Kurumsal güvenilirliğiniz sayesinde hasarı sınırlayabilirsiniz.'
        : ' Mevcut baskıları göz önünde bulundurarak dikkatli hareket edin.';
      break;
    case 'decision':
      desc += ' Kararınız üniversitenizin seyrini etkileyecek.';
      break;
    case 'trend':
      desc += ' Bu dalgadan faydalanmak için bölüm yatırımlarınızı gözden geçirin.';
      break;
    default:
      break;
  }

  // Bütçe efekti varsa uyarı
  if (event.effects && event.effects.budget) {
    const budgetEffect = event.effects.budget;
    if (budgetEffect < 0) {
      const remaining = state.university.budget + budgetEffect;
      if (remaining < 0) {
        desc += ' DİKKAT: Bu olay bütçenizi negatife düşürebilir!';
      }
    }
  }

  return desc;
}
