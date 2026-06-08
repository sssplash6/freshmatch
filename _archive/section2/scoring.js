// Archived fit-type scoring — driven by section2 answers.
// Reintegrate alongside section2 when section2 is restored.

export function calculateFitType(answers) {
  const counts = { A: 0, B: 0, C: 0, D: 0 }
  for (const letter of answers) {
    if (letter in counts) counts[letter]++
  }
  const max = Math.max(...Object.values(counts))
  for (const letter of ['A', 'B', 'C', 'D']) {
    if (counts[letter] === max) return letter
  }
}

export const FIT_LABELS = {
  A: 'Tech & Engineering',
  B: 'Well-Rounded Leader',
  C: 'Free-Spirit Intellectual',
  D: 'Entrepreneurial Innovator',
}

export const FIT_DESCRIPTIONS = {
  A: 'You are highly analytical, data-driven, and logic-focused. You view the world as a complex system that can be understood, quantified, and optimized. You fit best at universities that pride themselves on intense rigor, STEM dominance, and a culture of building and discovering at the absolute bleeding edge of science.',
  B: 'You are a big-picture thinker who values context, history, and leadership. Your logic is applied toward societal structures, law, humanities, and human behavior. You fit best at institutions with deep traditions, powerful alumni networks, and a focus on producing the next generation of global leaders, policymakers, and academics.',
  C: "You love learning for the sake of learning. Your logic is deeply theoretical and philosophical. You aren't satisfied with how something works; you want to know why it works and what it means. You belong at a school with a fiercely intellectual, somewhat quirky culture where late-night debates about Nietzsche or abstract math are the norm.",
  D: "Your logic is highly pragmatic, entrepreneurial, and forward-thinking. You see problems as opportunities for innovation. You aren't as interested in spending four years locked in an ivory tower; you want to build, scale, and disrupt right now. You fit best at West Coast powerhouses or top business programs where venture capital and design thinking are baked into the campus DNA.",
}

export const BASE_SCHOOLS = {
  A: ['MIT', 'Caltech', 'Carnegie Mellon University', 'Georgia Tech', 'Cornell Engineering'],
  B: ['Harvard University', 'Yale University', 'Princeton University', 'Columbia University', 'UPenn'],
  C: ['University of Chicago', 'Brown University', 'Columbia University (Core)'],
  D: ['Stanford University', 'UC Berkeley', 'UPenn Wharton', 'Babson College'],
}

export const ADJUSTED_SCHOOLS = {
  A: { mid: ['CMU-Q', 'NYUAD', 'Harvey Mudd College', 'Cooper Union'], lower: ['DKU', 'NYUSH'] },
  B: { mid: ['GU-Q', 'NYUAD', 'Colby College', 'Lafayette College'], lower: ['NYUSH', 'Yonsei University'] },
  C: { mid: ['NYUAD', 'Hamilton College', 'Colby College'], lower: ['NYUSH', 'Yonsei University'] },
  D: { mid: ['NYUAD', 'CMU-Q', 'GU-Q', 'Babson College'], lower: ['NYUSH', 'DKU', 'Yonsei University'] },
}

// Full getResult that requires both section1 and section2 answers.
export function getResult(section1Answers, section2Answers) {
  const { calculateSection1Score, getAcademicTier } = require('./scoring_s1')
  const score = calculateSection1Score(section1Answers)
  const tier = getAcademicTier(score)
  const fitLetter = calculateFitType(section2Answers)

  const baseSchools = BASE_SCHOOLS[fitLetter].map(name => ({ name, adjusted: false }))
  const adjustedSchools =
    tier === 'none' || tier === 't20'
      ? []
      : (ADJUSTED_SCHOOLS[fitLetter][tier] ?? []).map(name => ({ name, adjusted: true }))

  return {
    fitLetter,
    label: FIT_LABELS[fitLetter],
    description: FIT_DESCRIPTIONS[fitLetter],
    tier,
    schools: tier === 'none' ? [] : [...baseSchools, ...adjustedSchools],
    noSchools: tier === 'none',
  }
}
