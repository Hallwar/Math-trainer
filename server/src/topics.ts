export interface Question {
  id: string;
  text: string;
  answer: number;
  options?: number[];
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
  while (opts.size < 4) {
    const delta = randomInt(-range, range);
    const v = correct + delta;
    if (v !== correct && v >= 0) opts.add(v);
  }
  return Array.from(opts).sort(() => Math.random() - 0.5);
}

export const TOPICS: Topic[] = [
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
        return { id: makeId(), text: `${a} + ${b} = ?`, answer, options: shuffleOptions(answer, 3) };
      } else {
        const answer = a;
        return { id: makeId(), text: `${a + b} − ${b} = ?`, answer, options: shuffleOptions(answer, 3) };
      }
    },
  },
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
        return { id: makeId(), text: `${a} + ${b} = ?`, answer, options: shuffleOptions(answer, 20) };
      } else {
        const answer = a - b;
        return { id: makeId(), text: `${a} − ${b} = ?`, answer, options: shuffleOptions(answer, 20) };
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
      return { id: makeId(), text: `${a} × ${b} = ?`, answer, options: shuffleOptions(answer, 10) };
    },
  },
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
        const product = a * b;
        const answer = a;
        return { id: makeId(), text: `${product} ÷ ${b} = ?`, answer, options: shuffleOptions(answer, 5) };
      } else {
        const answer = a * b;
        return { id: makeId(), text: `${a} × ${b} = ?`, answer, options: shuffleOptions(answer, 10) };
      }
    },
  },
  {
    id: "fraction_simple",
    name: "Brøk – enkle brøker",
    description: "Brøk av et tall, f.eks. 1/2 av 8",
    grade: "5.–6. trinn",
    generate() {
      const denominators = [2, 3, 4, 5, 10];
      const denom = denominators[randomInt(0, denominators.length - 1)];
      const numer = randomInt(1, denom - 1);
      const whole = denom * randomInt(1, 10);
      const answer = (whole / denom) * numer;
      return {
        id: makeId(),
        text: `Hva er ${numer}/${denom} av ${whole}?`,
        answer,
        options: shuffleOptions(answer, Math.max(3, Math.floor(answer * 0.3))),
      };
    },
  },
  {
    id: "decimal_add_sub",
    name: "Desimaltall – addisjon og subtraksjon",
    description: "Addisjon og subtraksjon med desimaltall (én desimal)",
    grade: "5.–7. trinn",
    generate() {
      const a = parseFloat((randomInt(1, 99) / 10).toFixed(1));
      const b = parseFloat((randomInt(1, 99) / 10).toFixed(1));
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        const answer = parseFloat((a + b).toFixed(1));
        return {
          id: makeId(),
          text: `${a.toFixed(1)} + ${b.toFixed(1)} = ?`,
          answer: answer * 10,
          options: shuffleOptions(answer * 10, 5),
        };
      } else {
        const [big, small] = a >= b ? [a, b] : [b, a];
        const answer = parseFloat((big - small).toFixed(1));
        return {
          id: makeId(),
          text: `${big.toFixed(1)} − ${small.toFixed(1)} = ?`,
          answer: answer * 10,
          options: shuffleOptions(answer * 10, 5),
        };
      }
    },
  },
  {
    id: "geometry_area",
    name: "Geometri – areal av rektangel",
    description: "Beregn areal av rektangler og kvadrater",
    grade: "5.–7. trinn",
    generate() {
      const w = randomInt(1, 20);
      const h = randomInt(1, 20);
      const answer = w * h;
      return {
        id: makeId(),
        text: `Et rektangel er ${w} cm bredt og ${h} cm høyt. Hva er arealet (cm²)?`,
        answer,
        options: shuffleOptions(answer, Math.max(5, Math.floor(answer * 0.3))),
      };
    },
  },
  {
    id: "geometry_perimeter",
    name: "Geometri – omkrets",
    description: "Beregn omkrets av rektangler og kvadrater",
    grade: "4.–6. trinn",
    generate() {
      const w = randomInt(1, 20);
      const h = randomInt(1, 20);
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
    description: "Omgjøring mellom lengde- og vektenheter",
    grade: "4.–6. trinn",
    generate() {
      const conversions = [
        { q: () => { const v = randomInt(1, 20); return { text: `${v} km = ? m`, answer: v * 1000 }; } },
        { q: () => { const v = randomInt(1, 100) * 10; return { text: `${v} m = ? cm`, answer: v * 100 }; } },
        { q: () => { const v = randomInt(1, 20); return { text: `${v} kg = ? g`, answer: v * 1000 }; } },
        { q: () => { const v = randomInt(1, 10); return { text: `${v} l = ? dl`, answer: v * 10 }; } },
        { q: () => { const v = randomInt(1, 10) * 1000; return { text: `${v} m = ? km`, answer: v / 1000 }; } },
      ];
      const { text, answer } = conversions[randomInt(0, conversions.length - 1)].q();
      return { id: makeId(), text, answer, options: shuffleOptions(answer, Math.max(5, Math.floor(answer * 0.2))) };
    },
  },
  {
    id: "number_sequence",
    name: "Tallrekker og mønster",
    description: "Finn neste tall i en rekke",
    grade: "3.–5. trinn",
    generate() {
      const start = randomInt(1, 20);
      const step = randomInt(2, 15);
      const length = randomInt(3, 5);
      const sequence = Array.from({ length }, (_, i) => start + i * step);
      const answer = start + length * step;
      return {
        id: makeId(),
        text: `Hva kommer neste i rekken: ${sequence.join(", ")}, ?`,
        answer,
        options: shuffleOptions(answer, step * 2),
      };
    },
  },
];
