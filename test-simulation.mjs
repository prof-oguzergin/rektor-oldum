/**
 * University Tycoon — Simulation Test
 * ES Module (node test-simulation.mjs)
 *
 * initGame() çağırır, 10 tur simüle eder ve kritik değerlerin geçerli
 * sayılar olduğunu doğrular (NaN, Infinity, negatif kontrolleri).
 */

import { initGame, nextTurn, getState } from './js/game.js';

// ─── Yardımcı: Bir değerin geçerli sonlu sayı olup olmadığını kontrol et
function isValidNum(v) {
  return typeof v === 'number' && isFinite(v) && !isNaN(v);
}

function isNonNeg(v) {
  return isValidNum(v) && v >= 0;
}

// ─── Bir state'i doğrula, hataları döndür
function validateState(state, turn) {
  const errors = [];

  // Bütçe
  if (!isValidNum(state.university?.budget)) {
    errors.push(`Tur ${turn}: university.budget geçersiz → ${state.university?.budget}`);
  }

  // Prestij
  if (!isNonNeg(state.university?.prestige)) {
    errors.push(`Tur ${turn}: university.prestige geçersiz → ${state.university?.prestige}`);
  }

  // Toplam öğrenci
  const totalEnrolled = state.students?.totalEnrolled;
  if (!isNonNeg(totalEnrolled)) {
    errors.push(`Tur ${turn}: students.totalEnrolled geçersiz → ${totalEnrolled}`);
  }

  // Hoca sayısı
  if (!Array.isArray(state.faculty)) {
    errors.push(`Tur ${turn}: faculty dizi değil`);
  } else {
    if (state.faculty.length === 0) {
      errors.push(`Tur ${turn}: faculty boş`);
    }
    // Her hocanın publications ve stats alanları kontrol
    for (const f of state.faculty) {
      if (f.publications !== undefined && isNaN(f.publications)) {
        errors.push(`Tur ${turn}: hoca ${f.name || f.id} publications=NaN`);
      }
      if (f.stats) {
        if (isNaN(f.stats.research))  errors.push(`Tur ${turn}: hoca ${f.name || f.id} stats.research=NaN`);
        if (isNaN(f.stats.teaching))  errors.push(`Tur ${turn}: hoca ${f.name || f.id} stats.teaching=NaN`);
      }
    }
  }

  // Bölümler
  if (!Array.isArray(state.departments) || state.departments.length === 0) {
    errors.push(`Tur ${turn}: departments boş veya dizi değil`);
  } else {
    for (const d of state.departments) {
      if (!d.id) {
        errors.push(`Tur ${turn}: bölüm id yok`);
        continue;
      }
      if (d.prestige !== undefined && isNaN(d.prestige)) {
        errors.push(`Tur ${turn}: bölüm ${d.id} prestige=NaN`);
      }
      if (d.avgGPA !== undefined && isNaN(d.avgGPA)) {
        errors.push(`Tur ${turn}: bölüm ${d.id} avgGPA=NaN`);
      }
      // byDepartment öğrenci kohortları
      const byDept = state.students?.byDepartment?.[d.id];
      if (byDept) {
        for (const yr of ['year1', 'year2', 'year3', 'year4']) {
          const cohort = byDept[yr];
          if (!cohort) continue;
          if (isNaN(cohort.count))        errors.push(`Tur ${turn}: ${d.id}.${yr}.count=NaN`);
          if (isNaN(cohort.avgGPA))       errors.push(`Tur ${turn}: ${d.id}.${yr}.avgGPA=NaN`);
          if (isNaN(cohort.satisfaction)) errors.push(`Tur ${turn}: ${d.id}.${yr}.satisfaction=NaN`);
        }
      }
    }
  }

  // Meta bilgiler
  if (!isValidNum(state.meta?.turn)) {
    errors.push(`Tur ${turn}: meta.turn geçersiz → ${state.meta?.turn}`);
  }
  if (!['güz', 'bahar'].includes(state.meta?.semester)) {
    errors.push(`Tur ${turn}: meta.semester geçersiz → "${state.meta?.semester}"`);
  }

  // Araştırma
  if (!isNonNeg(state.research?.publications)) {
    errors.push(`Tur ${turn}: research.publications geçersiz → ${state.research?.publications}`);
  }

  return errors;
}

// ─── Ana test
async function runTest() {
  console.log('=== University Tycoon Simülasyon Testi ===\n');

  // Oyunu başlat
  try {
    initGame(
      'Test Rektörü',
      'Test Üniversitesi',
      'vakif',
      'normal',
      ['bilgisayar_muhendisligi', 'elektrik_elektronik_muhendisligi', 'isletme']
    );
    console.log('✓ initGame() başarılı');
  } catch (err) {
    console.error('✗ initGame() HATA:', err.message);
    process.exit(1);
  }

  let allErrors = [];

  // İlk state'i doğrula
  let state = getState();
  let initErrors = validateState(state, 0);
  if (initErrors.length > 0) {
    console.error('✗ Başlangıç state hataları:');
    initErrors.forEach(e => console.error('  ', e));
    allErrors.push(...initErrors);
  } else {
    console.log('✓ Başlangıç state geçerli');
    console.log(`  Bütçe: ₺${state.university.budget.toLocaleString()}`);
    console.log(`  Prestij: ${state.university.prestige}`);
    console.log(`  Öğrenci: ${state.students.totalEnrolled}`);
    console.log(`  Hoca: ${state.faculty.length}`);
    console.log(`  Bölüm: ${state.departments.length}`);
  }

  // 10 tur simüle et
  console.log('\n--- 10 tur simülasyonu başlıyor ---');
  for (let t = 1; t <= 10; t++) {
    try {
      const result = nextTurn();
      state = getState();
      const errors = validateState(state, t);

      if (errors.length > 0) {
        console.error(`✗ Tur ${t} HATALAR (${errors.length}):`);
        errors.forEach(e => console.error('  ', e));
        allErrors.push(...errors);
      } else {
        const sem = state.meta.semester === 'güz' ? 'G' : 'B';
        const yr  = state.meta.year;
        console.log(`✓ Tur ${t} (Y${yr}/${sem}) OK — ` +
          `Bütçe:₺${(state.university.budget/1e6).toFixed(1)}M  ` +
          `Prestij:${state.university.prestige?.toFixed(1)}  ` +
          `Öğrenci:${state.students.totalEnrolled}  ` +
          `Hoca:${state.faculty.length}  ` +
          `Yayın:${state.research?.publications || 0}`);
      }

      // Oyun bitti mi?
      if (result?.gameOver || result?.gameWon) {
        console.log(`\n! Oyun ${t}. turda bitti: ${result.reason || ''}`);
        break;
      }
    } catch (err) {
      console.error(`✗ Tur ${t} EXCEPTION:`, err.message);
      console.error(err.stack);
      allErrors.push(`Tur ${t} exception: ${err.message}`);
    }
  }

  // Sonuç
  console.log('\n=== TEST SONUCU ===');
  if (allErrors.length === 0) {
    console.log('✓ TÜM KONTROLLER GEÇTİ — 10 tur başarıyla simüle edildi');
  } else {
    console.error(`✗ TOPLAM ${allErrors.length} HATA BULUNDU`);
    process.exit(1);
  }
}

runTest().catch(err => {
  console.error('Beklenmeyen hata:', err);
  process.exit(1);
});
