export interface Question {
  id: string;
  text: string;
  answer: number;
  options?: number[];
  optionLabels?: string[]; // display strings when options need custom formatting
}

export interface Topic {
  id: string;
  name: string;
  description: string;
  grade: string;
  generate: () => Question;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function shuffleOptions(correct: number, range: number): number[] {
  const opts = new Set<number>([correct]);
  let safety = 0;
  while (opts.size < 4 && safety < 200) {
    safety++;
    const delta = randomInt(1, range);
    const sign = Math.random() > 0.5 ? 1 : -1;
    const v = correct + sign * delta;
    if (v !== correct && v >= 0) opts.add(v);
  }
  // If still short, just add nearby values
  let extra = 1;
  while (opts.size < 4) {
    if (!opts.has(correct + extra)) opts.add(correct + extra);
    extra++;
  }
  return Array.from(opts).sort(() => Math.random() - 0.5);
}

// Shuffle options and also produce string labels for display (e.g. decimals)
function shuffleDecimalOptions(correctRaw: number, range: number, scale: number): { options: number[]; labels: string[] } {
  const rawOpts = shuffleOptions(correctRaw, range);
  return {
    options: rawOpts,
    labels: rawOpts.map((v) => (v / scale).toFixed(scale === 10 ? 1 : 2)),
  };
}

function pick<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

// ─────────────────────────────────────────────────────────────────────────────
// TOPICS
// ─────────────────────────────────────────────────────────────────────────────
export const TOPICS: Topic[] = [

  // ── 1.–2. TRINN ────────────────────────────────────────────────────────────

  {
    id: "add_sub_easy",
    name: "Addisjon og subtraksjon (0–20)",
    description: "Enkle addisjon- og subtraksjonsoppgaver med tall 0–20",
    grade: "1.–2. trinn",
    generate() {
      const a = randomInt(0, 20);
      const b = randomInt(0, 20 - a);
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        const answer = a + b;
        return { id: makeId(), text: `${a} + ${b} = ?`, answer, options: shuffleOptions(answer, 4) };
      } else {
        const answer = a;
        return { id: makeId(), text: `${a + b} − ${b} = ?`, answer, options: shuffleOptions(answer, 4) };
      }
    },
  },

  {
    id: "doubling_halving",
    name: "Dobling og halvering",
    description: "Doble eller halver et tall",
    grade: "1.–3. trinn",
    generate() {
      const isDouble = Math.random() > 0.5;
      if (isDouble) {
        const n = randomInt(1, 30);
        const answer = n * 2;
        return { id: makeId(), text: `Det dobbelte av ${n} er?`, answer, options: shuffleOptions(answer, 6) };
      } else {
        const n = randomInt(1, 25) * 2; // guarantee even
        const answer = n / 2;
        return { id: makeId(), text: `Halvparten av ${n} er?`, answer, options: shuffleOptions(answer, 4) };
      }
    },
  },

  {
    id: "money_easy",
    name: "Penger – addisjon og veksling",
    description: "Enkle pengeoppgaver med mynter og sedler",
    grade: "2.–4. trinn",
    generate() {
      const templates = [
        () => {
          const a = pick([1, 2, 5, 10, 20, 50, 100, 200]);
          const b = pick([1, 2, 5, 10, 20, 50, 100, 200]);
          return { text: `Du har en ${a}-krone og en ${b}-krone. Hvor mye er det til sammen?`, answer: a + b };
        },
        () => {
          const price = randomInt(2, 49);
          const paid = Math.ceil(price / 10) * 10;
          const change = paid - price;
          return { text: `Du kjøper noe som koster ${price} kr og betaler med ${paid} kr. Hvor mye får du tilbake?`, answer: change };
        },
        () => {
          const items = randomInt(2, 6);
          const price = pick([5, 8, 10, 12, 15, 20]);
          return { text: `Du kjøper ${items} stk som koster ${price} kr hver. Hva er totalen?`, answer: items * price };
        },
        () => {
          const total = randomInt(3, 20) * 5;
          const n = pick([2, 4, 5]);
          if (total % n !== 0) { const answer = (total + (n - total % n)) / n; return { text: `Del ${total + (n - total % n)} kr likt på ${n} personer. Hva får hver?`, answer }; }
          return { text: `Del ${total} kr likt på ${n} personer. Hva får hver?`, answer: total / n };
        },
      ];
      const { text, answer } = pick(templates)();
      return { id: makeId(), text, answer, options: shuffleOptions(answer, Math.max(3, Math.floor(answer * 0.3))) };
    },
  },

  // ── 2.–3. TRINN ────────────────────────────────────────────────────────────

  {
    id: "add_sub_to100",
    name: "Addisjon og subtraksjon (0–100)",
    description: "Addisjon og subtraksjon med tall opp til 100",
    grade: "2.–3. trinn",
    generate() {
      const a = randomInt(1, 99);
      const b = randomInt(1, Math.min(a, 99));
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        const sum = a + b;
        if (sum > 100) {
          const answer = a - b;
          return { id: makeId(), text: `${a} − ${b} = ?`, answer, options: shuffleOptions(answer, 8) };
        }
        return { id: makeId(), text: `${a} + ${b} = ?`, answer: sum, options: shuffleOptions(sum, 8) };
      } else {
        const answer = a - b;
        return { id: makeId(), text: `${a} − ${b} = ?`, answer, options: shuffleOptions(answer, 8) };
      }
    },
  },

  // ── 3.–4. TRINN ────────────────────────────────────────────────────────────

  {
    id: "add_sub_medium",
    name: "Addisjon og subtraksjon (0–1000)",
    description: "Addisjon og subtraksjon med tall opp til 1000",
    grade: "3.–4. trinn",
    generate() {
      const a = randomInt(10, 999);
      const b = randomInt(1, a);
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        const answer = a + b;
        return { id: makeId(), text: `${a} + ${b} = ?`, answer, options: shuffleOptions(answer, 30) };
      } else {
        const answer = a - b;
        return { id: makeId(), text: `${a} − ${b} = ?`, answer, options: shuffleOptions(answer, 30) };
      }
    },
  },

  {
    id: "mult_div_easy",
    name: "Multiplikasjon (1–10)",
    description: "Gangetabellen 1–10",
    grade: "3.–4. trinn",
    generate() {
      const a = randomInt(1, 10);
      const b = randomInt(1, 10);
      const answer = a * b;
      return { id: makeId(), text: `${a} × ${b} = ?`, answer, options: shuffleOptions(answer, 12) };
    },
  },

  {
    id: "division_basic",
    name: "Enkel divisjon",
    description: "Divisjon uten rest, knyttet til gangetabellen 1–10",
    grade: "3.–5. trinn",
    generate() {
      const b = randomInt(2, 10);
      const answer = randomInt(2, 10);
      const a = answer * b;
      return { id: makeId(), text: `${a} ÷ ${b} = ?`, answer, options: shuffleOptions(answer, 5) };
    },
  },

  {
    id: "number_sequence",
    name: "Tallrekker – stigende",
    description: "Finn neste tall i en stigende rekke",
    grade: "3.–5. trinn",
    generate() {
      const start = randomInt(1, 30);
      const step = randomInt(2, 20);
      const length = randomInt(3, 5);
      const sequence = Array.from({ length }, (_, i) => start + i * step);
      const answer = start + length * step;
      return {
        id: makeId(),
        text: `Hva kommer neste: ${sequence.join(", ")}, ?`,
        answer,
        options: shuffleOptions(answer, step * 2),
      };
    },
  },

  {
    id: "number_sequence_desc",
    name: "Tallrekker – synkende",
    description: "Finn neste tall i en synkende rekke",
    grade: "3.–5. trinn",
    generate() {
      const step = randomInt(2, 15);
      const length = randomInt(3, 5);
      const start = step * (length + randomInt(1, 5));
      const sequence = Array.from({ length }, (_, i) => start - i * step);
      const answer = start - length * step;
      return {
        id: makeId(),
        text: `Hva kommer neste: ${sequence.join(", ")}, ?`,
        answer,
        options: shuffleOptions(answer, step * 2),
      };
    },
  },

  {
    id: "time_clock",
    name: "Tid og klokke",
    description: "Beregn tid og minutter mellom klokkeslett",
    grade: "3.–5. trinn",
    generate() {
      const templates = [
        () => {
          const h = randomInt(8, 21);
          const m1 = pick([0, 15, 30, 45]);
          const add = pick([15, 20, 25, 30, 45, 60, 90]);
          const totalMin = h * 60 + m1 + add;
          const h2 = Math.floor(totalMin / 60) % 24;
          const m2 = totalMin % 60;
          const fmt = (hh: number, mm: number) => `${hh}:${mm.toString().padStart(2, "0")}`;
          return { text: `Klokka er ${fmt(h, m1)}. Hva er klokka om ${add} minutter?`, answer: h2 * 100 + m2 };
        },
        () => {
          const h1 = randomInt(8, 14);
          const m1 = pick([0, 15, 30, 45]);
          const diffMin = pick([15, 20, 25, 30, 45, 60, 90, 120]);
          const totalMin = h1 * 60 + m1 + diffMin;
          const h2 = Math.floor(totalMin / 60);
          const m2 = totalMin % 60;
          const fmt = (hh: number, mm: number) => `${hh}:${mm.toString().padStart(2, "0")}`;
          return { text: `Hvor mange minutter er det fra ${fmt(h1, m1)} til ${fmt(h2, m2)}?`, answer: diffMin };
        },
        () => {
          const minutesInDay = [30, 45, 60, 90, 120];
          const dur = pick(minutesInDay);
          const h = Math.floor(dur / 60);
          const m = dur % 60;
          if (h === 0) return { text: `En film varer ${dur} minutter. Hvor mange hele timer og minutter er det?`, answer: dur };
          return { text: `${h} time${h > 1 ? "r" : ""} og ${m} minutter – hvor mange minutter er det totalt?`, answer: dur };
        },
      ];
      const { text, answer } = pick(templates)();
      const range = Math.max(10, Math.floor(answer * 0.3));
      return { id: makeId(), text, answer, options: shuffleOptions(answer, range) };
    },
  },

  // ── 4.–5. TRINN ────────────────────────────────────────────────────────────

  {
    id: "rounding",
    name: "Avrunding",
    description: "Rund av til nærmeste tier eller hundrer",
    grade: "4.–5. trinn",
    generate() {
      const toHundred = Math.random() > 0.5;
      if (toHundred) {
        const n = randomInt(1, 99) * 10 + randomInt(1, 9); // e.g. 347
        const answer = Math.round(n / 100) * 100;
        return { id: makeId(), text: `Rund av ${n} til nærmeste hundrer.`, answer, options: shuffleOptions(answer, 100) };
      } else {
        const n = randomInt(11, 999);
        const answer = Math.round(n / 10) * 10;
        return { id: makeId(), text: `Rund av ${n} til nærmeste tier.`, answer, options: shuffleOptions(answer, 15) };
      }
    },
  },

  {
    id: "place_value",
    name: "Sifferverdi og posisjonssystem",
    description: "Hva er verdien av et bestemt siffer i et tall?",
    grade: "4.–5. trinn",
    generate() {
      const n = randomInt(100, 9999);
      const digits = n.toString().split("").map(Number);
      const places = ["enere", "tiere", "hundrer", "tusener"];
      const pos = randomInt(0, digits.length - 1); // 0 = ones, 1 = tens, ...
      const placeValue = Math.pow(10, pos);
      const digit = digits[digits.length - 1 - pos];
      const answer = digit * placeValue;
      const place = places[pos];
      return {
        id: makeId(),
        text: `Hva er verdien av ${place}-sifferet i tallet ${n}?`,
        answer,
        options: shuffleOptions(answer, Math.max(10, answer)),
      };
    },
  },

  {
    id: "geometry_perimeter",
    name: "Geometri – omkrets",
    description: "Beregn omkrets av rektangler og kvadrater",
    grade: "4.–6. trinn",
    generate() {
      const isSquare = Math.random() > 0.6;
      if (isSquare) {
        const s = randomInt(2, 20);
        const answer = 4 * s;
        return {
          id: makeId(),
          text: `Et kvadrat har sidelengde ${s} cm. Hva er omkretsen (cm)?`,
          answer,
          options: shuffleOptions(answer, 10),
        };
      }
      const w = randomInt(2, 20);
      const h = randomInt(2, 20);
      const answer = 2 * (w + h);
      return {
        id: makeId(),
        text: `Et rektangel er ${w} cm bredt og ${h} cm høyt. Hva er omkretsen (cm)?`,
        answer,
        options: shuffleOptions(answer, Math.max(4, Math.floor(answer * 0.2))),
      };
    },
  },

  {
    id: "measurement",
    name: "Måling og enheter",
    description: "Omgjøring mellom lengde-, vekt- og volumenheter",
    grade: "4.–6. trinn",
    generate() {
      const conversions = [
        () => { const v = randomInt(1, 20); return { text: `${v} km = ? m`, answer: v * 1000 }; },
        () => { const v = randomInt(1, 50) * 100; return { text: `${v} m = ? km`, answer: v / 1000 }; },
        () => { const v = randomInt(1, 20) * 10; return { text: `${v} m = ? cm`, answer: v * 100 }; },
        () => { const v = randomInt(1, 20); return { text: `${v} kg = ? g`, answer: v * 1000 }; },
        () => { const v = randomInt(1, 10) * 1000; return { text: `${v} g = ? kg`, answer: v / 1000 }; },
        () => { const v = randomInt(1, 10); return { text: `${v} l = ? dl`, answer: v * 10 }; },
        () => { const v = randomInt(1, 20); return { text: `${v} dl = ? cl`, answer: v * 10 }; },
        () => { const v = randomInt(1, 10); return { text: `${v} l = ? cl`, answer: v * 100 }; },
        () => { const v = randomInt(1, 20); return { text: `${v} cm = ? mm`, answer: v * 10 }; },
        () => { const v = randomInt(1, 20) * 10; return { text: `${v} mm = ? cm`, answer: v / 10 }; },
      ];
      const { text, answer } = pick(conversions)();
      return { id: makeId(), text, answer, options: shuffleOptions(answer, Math.max(5, Math.floor(answer * 0.25))) };
    },
  },

  {
    id: "division_remainder",
    name: "Divisjon med rest",
    description: "Divisjon der det blir en rest",
    grade: "4.–6. trinn",
    generate() {
      const b = randomInt(2, 10);
      const quotient = randomInt(2, 12);
      const remainder = randomInt(1, b - 1);
      const a = quotient * b + remainder;
      const isWholeRemainder = Math.random() > 0.5;
      if (isWholeRemainder) {
        return {
          id: makeId(),
          text: `${a} ÷ ${b} = ${quotient} rest ?`,
          answer: remainder,
          options: shuffleOptions(remainder, Math.min(remainder, 3)),
        };
      } else {
        return {
          id: makeId(),
          text: `${a} ÷ ${b} = ? (heltall, ignorer resten)`,
          answer: quotient,
          options: shuffleOptions(quotient, 4),
        };
      }
    },
  },

  // ── 5.–6. TRINN ────────────────────────────────────────────────────────────

  {
    id: "mult_div_medium",
    name: "Multiplikasjon og divisjon (1–12)",
    description: "Gangetabellen 1–12, inkludert divisjon",
    grade: "5.–6. trinn",
    generate() {
      const a = randomInt(1, 12);
      const b = randomInt(1, 12);
      const isDivision = Math.random() > 0.5;
      if (isDivision) {
        const answer = a;
        return { id: makeId(), text: `${a * b} ÷ ${b} = ?`, answer, options: shuffleOptions(answer, 5) };
      } else {
        const answer = a * b;
        return { id: makeId(), text: `${a} × ${b} = ?`, answer, options: shuffleOptions(answer, 12) };
      }
    },
  },

  {
    id: "multiplication_tens",
    name: "Multiplikasjon med 10, 100 og 1000",
    description: "Gang og del med tiere, hundrer og tusener",
    grade: "5.–6. trinn",
    generate() {
      const n = randomInt(1, 99);
      const factor = pick([10, 100, 1000]);
      const isDiv = Math.random() > 0.5 && n * factor <= 10000;
      if (isDiv) {
        const big = n * factor;
        return { id: makeId(), text: `${big} ÷ ${factor} = ?`, answer: n, options: shuffleOptions(n, Math.max(5, Math.floor(n * 0.3))) };
      }
      const answer = n * factor;
      return { id: makeId(), text: `${n} × ${factor} = ?`, answer, options: shuffleOptions(answer, Math.max(50, Math.floor(answer * 0.15))) };
    },
  },

  {
    id: "multiply_large",
    name: "Multiplikasjon – tosifret × ensifret",
    description: "Gang et tosifret tall med et ensifret tall",
    grade: "5.–6. trinn",
    generate() {
      const a = randomInt(11, 99);
      const b = randomInt(2, 9);
      const answer = a * b;
      return { id: makeId(), text: `${a} × ${b} = ?`, answer, options: shuffleOptions(answer, Math.max(10, Math.floor(answer * 0.15))) };
    },
  },

  {
    id: "fraction_simple",
    name: "Brøk – brøk av et tall",
    description: "Finn en brøkdel av et tall, f.eks. 3/4 av 20",
    grade: "5.–6. trinn",
    generate() {
      const denominators = [2, 3, 4, 5, 10];
      const denom = pick(denominators);
      const numer = randomInt(1, denom - 1);
      const whole = denom * randomInt(1, 12);
      const answer = (whole / denom) * numer;
      return {
        id: makeId(),
        text: `Hva er ${numer}/${denom} av ${whole}?`,
        answer,
        options: shuffleOptions(answer, Math.max(3, Math.floor(answer * 0.35))),
      };
    },
  },

  {
    id: "unknown_equation",
    name: "Ukjent i likning",
    description: "Finn det ukjente tallet i en likning",
    grade: "5.–7. trinn",
    generate() {
      const unknown = randomInt(1, 30);
      const templates = [
        () => { const b = randomInt(1, 20); return { text: `? + ${b} = ${unknown + b}`, answer: unknown }; },
        () => { const b = randomInt(1, unknown); return { text: `${unknown + b} − ? = ${b}`, answer: unknown }; },
        () => { const b = randomInt(2, 10); return { text: `? × ${b} = ${unknown * b}`, answer: unknown }; },
        () => { const b = randomInt(2, 10); return { text: `${unknown * b} ÷ ? = ${unknown}`, answer: b }; },
        () => { const b = randomInt(1, 20); return { text: `${b} + ? = ${b + unknown}`, answer: unknown }; },
      ];
      const { text, answer } = pick(templates)();
      return { id: makeId(), text, answer, options: shuffleOptions(answer, Math.max(3, Math.floor(answer * 0.4))) };
    },
  },

  {
    id: "geometry_area",
    name: "Geometri – areal av rektangel",
    description: "Beregn areal av rektangler og kvadrater",
    grade: "5.–7. trinn",
    generate() {
      const isSquare = Math.random() > 0.6;
      if (isSquare) {
        const s = randomInt(2, 20);
        const answer = s * s;
        return {
          id: makeId(),
          text: `Et kvadrat har sidelengde ${s} cm. Hva er arealet (cm²)?`,
          answer,
          options: shuffleOptions(answer, Math.max(8, Math.floor(answer * 0.3))),
        };
      }
      const w = randomInt(2, 20);
      const h = randomInt(2, 20);
      const answer = w * h;
      return {
        id: makeId(),
        text: `Et rektangel er ${w} cm bredt og ${h} cm høyt. Hva er arealet (cm²)?`,
        answer,
        options: shuffleOptions(answer, Math.max(8, Math.floor(answer * 0.3))),
      };
    },
  },

  {
    id: "area_triangle",
    name: "Geometri – areal av trekant",
    description: "Beregn areal av trekanter (g × h ÷ 2)",
    grade: "5.–7. trinn",
    generate() {
      const g = randomInt(2, 20) * 2; // ensure even for clean answer
      const h = randomInt(2, 20);
      const answer = (g * h) / 2;
      return {
        id: makeId(),
        text: `En trekant har grunnlinje ${g} cm og høyde ${h} cm. Hva er arealet (cm²)?`,
        answer,
        options: shuffleOptions(answer, Math.max(8, Math.floor(answer * 0.3))),
      };
    },
  },

  // ── 5.–7. TRINN ────────────────────────────────────────────────────────────

  {
    id: "decimal_add_sub",
    name: "Desimaltall – addisjon og subtraksjon",
    description: "Addisjon og subtraksjon med desimaltall (én desimal)",
    grade: "5.–7. trinn",
    generate() {
      const a10 = randomInt(1, 99);
      const b10 = randomInt(1, 99);
      const isAdd = Math.random() > 0.5;
      const a = a10 / 10;
      const b = b10 / 10;
      if (isAdd) {
        const answer10 = a10 + b10;
        const { options, labels } = shuffleDecimalOptions(answer10, 8, 10);
        return {
          id: makeId(),
          text: `${a.toFixed(1)} + ${b.toFixed(1)} = ?`,
          answer: answer10,
          options,
          optionLabels: labels,
        };
      } else {
        const [big10, small10] = a10 >= b10 ? [a10, b10] : [b10, a10];
        const answer10 = big10 - small10;
        const { options, labels } = shuffleDecimalOptions(answer10, 8, 10);
        return {
          id: makeId(),
          text: `${(big10 / 10).toFixed(1)} − ${(small10 / 10).toFixed(1)} = ?`,
          answer: answer10,
          options,
          optionLabels: labels,
        };
      }
    },
  },

  {
    id: "decimal_multiply",
    name: "Desimaltall – multiplikasjon",
    description: "Gang et desimaltall med et ensifret tall",
    grade: "6.–7. trinn",
    generate() {
      const a10 = randomInt(1, 49); // e.g. 25 → 2.5
      const b = randomInt(2, 9);
      const answer10 = a10 * b;
      const { options, labels } = shuffleDecimalOptions(answer10, Math.max(5, Math.floor(answer10 * 0.2)), 10);
      return {
        id: makeId(),
        text: `${(a10 / 10).toFixed(1)} × ${b} = ?`,
        answer: answer10,
        options,
        optionLabels: labels,
      };
    },
  },

  {
    id: "fraction_add_sub",
    name: "Brøk – addisjon og subtraksjon (lik nevner)",
    description: "Legg sammen eller trekk fra brøker med samme nevner",
    grade: "6.–7. trinn",
    generate() {
      const denom = pick([3, 4, 5, 6, 8, 10]);
      const a = randomInt(1, denom - 1);
      const b = randomInt(1, denom - 1);
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        const sumNum = a + b;
        // answer: numerator (denominator is fixed, shown in text)
        const simplified = sumNum >= denom ? sumNum - denom : sumNum;
        const text = sumNum >= denom
          ? `${a}/${denom} + ${b}/${denom} = ? /${denom} (trekk fra ${denom} om > 1)`
          : `${a}/${denom} + ${b}/${denom} = ? /${denom}`;
        return { id: makeId(), text, answer: simplified, options: shuffleOptions(simplified, Math.min(simplified, 3)) };
      } else {
        const [big, small] = a >= b ? [a, b] : [b, a];
        const answer = big - small;
        return {
          id: makeId(),
          text: `${big}/${denom} − ${small}/${denom} = ? /${denom}`,
          answer,
          options: shuffleOptions(answer, Math.min(answer + 1, 3)),
        };
      }
    },
  },

  {
    id: "percentage",
    name: "Prosent av tall",
    description: "Beregn en prosentandel av et tall",
    grade: "6.–7. trinn",
    generate() {
      const percents = [10, 20, 25, 50, 75];
      const pct = pick(percents);
      const whole = randomInt(2, 20) * (100 / pct); // ensure integer answer
      const answer = Math.round((pct / 100) * whole);
      return {
        id: makeId(),
        text: `Hva er ${pct}% av ${whole}?`,
        answer,
        options: shuffleOptions(answer, Math.max(3, Math.floor(answer * 0.4))),
      };
    },
  },

  {
    id: "average",
    name: "Gjennomsnitt (middelvedi)",
    description: "Beregn gjennomsnittet av en tallrekke",
    grade: "6.–7. trinn",
    generate() {
      const count = randomInt(3, 5);
      const avg = randomInt(5, 30);
      // Build numbers that sum to avg * count
      const numbers: number[] = [];
      let remaining = avg * count;
      for (let i = 0; i < count - 1; i++) {
        const maxVal = Math.min(remaining - (count - i - 1), avg * 2);
        const minVal = Math.max(1, remaining - (count - i - 1) * avg * 2);
        const v = randomInt(Math.max(1, minVal), Math.max(1, maxVal));
        numbers.push(v);
        remaining -= v;
      }
      numbers.push(remaining);
      const shuffled = numbers.sort(() => Math.random() - 0.5);
      return {
        id: makeId(),
        text: `Hva er gjennomsnittet av: ${shuffled.join(", ")}?`,
        answer: avg,
        options: shuffleOptions(avg, Math.max(3, Math.floor(avg * 0.4))),
      };
    },
  },

  {
    id: "negative_numbers",
    name: "Negative tall",
    description: "Addisjon og subtraksjon med negative tall",
    grade: "6.–7. trinn",
    generate() {
      const templates = [
        () => { const a = randomInt(1, 15); const b = randomInt(1, 20); const ans = a - b; return { text: `${a} − ${b} = ?`, answer: ans }; },
        () => { const a = -randomInt(1, 10); const b = randomInt(1, 10); const ans = a + b; return { text: `${a} + ${b} = ?`, answer: ans }; },
        () => { const a = -randomInt(1, 10); const b = -randomInt(1, 10); const ans = a + b; return { text: `${a} + (${b}) = ?`, answer: ans }; },
        () => { const a = randomInt(1, 10); const b = randomInt(a + 1, a + 15); const ans = a - b; return { text: `${a} − ${b} = ?`, answer: ans }; },
        () => { const a = -randomInt(1, 10); const b = randomInt(1, 10); const ans = a - b; return { text: `${a} − ${b} = ?`, answer: ans }; },
      ];
      const { text, answer } = pick(templates)();
      // For negative answers, generate options that include negatives
      const opts = new Set<number>([answer]);
      let safety = 0;
      while (opts.size < 4 && safety < 100) {
        safety++;
        const v = answer + (Math.random() > 0.5 ? 1 : -1) * randomInt(1, 6);
        if (v !== answer) opts.add(v);
      }
      const options = Array.from(opts).sort(() => Math.random() - 0.5);
      return { id: makeId(), text, answer, options };
    },
  },

  {
    id: "volume",
    name: "Geometri – volum av rettblokk",
    description: "Beregn volum av en rettblokk (l × b × h)",
    grade: "6.–7. trinn",
    generate() {
      const l = randomInt(2, 12);
      const b = randomInt(2, 12);
      const h = randomInt(2, 12);
      const answer = l * b * h;
      return {
        id: makeId(),
        text: `En eske er ${l} cm lang, ${b} cm bred og ${h} cm høy. Hva er volumet (cm³)?`,
        answer,
        options: shuffleOptions(answer, Math.max(20, Math.floor(answer * 0.3))),
      };
    },
  },

  {
    id: "squares_roots",
    name: "Kvadrattall og kvadratrøtter",
    description: "Beregn kvadrattall og enkle kvadratrøtter",
    grade: "6.–7. trinn",
    generate() {
      const isRoot = Math.random() > 0.5;
      if (isRoot) {
        const answer = randomInt(2, 12);
        return {
          id: makeId(),
          text: `√${answer * answer} = ?`,
          answer,
          options: shuffleOptions(answer, 4),
        };
      } else {
        const n = randomInt(2, 15);
        const answer = n * n;
        return {
          id: makeId(),
          text: `${n}² = ?`,
          answer,
          options: shuffleOptions(answer, Math.max(8, Math.floor(answer * 0.3))),
        };
      }
    },
  },

  {
    id: "mixed_operations",
    name: "Blandede regnearter",
    description: "Oppgaver med flere regnearter og rekkefølge",
    grade: "5.–7. trinn",
    generate() {
      const templates = [
        () => { const a = randomInt(2, 10); const b = randomInt(2, 10); const c = randomInt(1, 20); return { text: `${a} × ${b} + ${c} = ?`, answer: a * b + c }; },
        () => { const a = randomInt(2, 10); const b = randomInt(2, 10); const c = randomInt(1, a * b - 1); return { text: `${a} × ${b} − ${c} = ?`, answer: a * b - c }; },
        () => { const b = randomInt(2, 10); const c = randomInt(1, 10); const a = b * randomInt(2, 8); return { text: `${a} ÷ ${b} + ${c} = ?`, answer: a / b + c }; },
        () => { const a = randomInt(2, 9); const b = randomInt(2, 9); const c = randomInt(2, 9); return { text: `${a} × (${b} + ${c}) = ?`, answer: a * (b + c) }; },
        () => { const a = randomInt(2, 9); const b = randomInt(2, 9); const c = randomInt(1, b); return { text: `${a} × (${b} − ${c}) = ?`, answer: a * (b - c) }; },
      ];
      const { text, answer } = pick(templates)();
      return { id: makeId(), text, answer, options: shuffleOptions(answer, Math.max(5, Math.floor(answer * 0.25))) };
    },
  },
];
