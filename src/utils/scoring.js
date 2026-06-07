const S1_SCORES = {
  0: { A: 4, B: 3, C: 2, D: 1 },
}

export function calculateSection1Score(answers) {
  return answers.reduce((sum, letter, i) => sum + (S1_SCORES[i]?.[letter] ?? 0), 0)
}

export function getAcademicTier(score) {
  if (score >= 4) return 't20'
  if (score >= 3) return 'mid'
  if (score >= 2) return 'lower'
  return 'none'
}

export function getResult(section1Answers) {
  const score = calculateSection1Score(section1Answers)
  const tier = getAcademicTier(score)
  return { tier }
}
