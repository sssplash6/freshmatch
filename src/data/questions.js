export const section1 = [
  {
    id: 's1q9',
    type: 'majors',
    text: 'Pick up to three desired majors.',
  },
  {
    id: 's1q5',
    type: 'test-scores',
    text: 'What standardized test scores do you have?',
  },
  {
    id: 's1q3',
    type: 'extracurriculars',
    text: 'What are your extracurricular activities?',
  },
  {
    id: 's1q4',
    type: 'honors',
    text: 'What are your top honors and awards?',
  },
  {
    id: 's1q6',
    type: 'essay',
    text: 'You may include an essay that details a personal story relevant to finding which college fits you.',
  },
  {
    id: 's1q8',
    type: 'dream-schools',
    text: 'What are your 3 dream schools?',
  },
  {
    id: 's1q7',
    type: 'efc',
    text: 'What is your family\'s Expected Family Contribution (EFC)?',
  },
]

// Shown only when the student skips the personal essay. Every option maps to the
// same four archetypes by letter — A: STEM/technical, B: leadership/policy,
// C: intellectual/life-of-the-mind, D: entrepreneurial/builder — so the backend
// can tally the letters into a personality profile. Six questions chosen to each
// tap a different facet (cognition, intellectual taste, learning structure,
// revealed behavior, environment, motivation) for maximal signal with minimal
// redundancy.
export const personality = [
  {
    id: 'pq1',
    type: 'personality',
    text: 'You are handed a highly complex, unsolved global problem. What is your logical first step?',
    options: [
      { letter: 'A', text: 'Formulate a mathematical model or algorithm to quantify the variables and isolate the root cause.' },
      { letter: 'B', text: 'Analyze the historical context, legal precedents, and societal impact to understand its broader implications.' },
      { letter: 'C', text: 'Deconstruct the underlying philosophical assumptions of the problem itself — "why do we even consider this a problem?"' },
      { letter: 'D', text: 'Prototype a quick, scalable product, tool, or organization to begin addressing it immediately.' },
    ],
  },
  {
    id: 'pq2',
    type: 'personality',
    text: 'Which type of logical argument do you find most compelling and satisfying?',
    options: [
      { letter: 'A', text: 'A rigorous, step-by-step mathematical or scientific proof.' },
      { letter: 'B', text: 'A persuasive, well-researched policy debate or historical analysis.' },
      { letter: 'C', text: 'A dialectical discussion exploring the gray areas and paradoxes of morality.' },
      { letter: 'D', text: 'A pitch deck demonstrating a clear path to innovation, growth, and disruption.' },
    ],
  },
  {
    id: 'pq3',
    type: 'personality',
    text: 'If you had to structure your own curriculum, which approach makes the most sense to you?',
    options: [
      { letter: 'A', text: 'A heavily structured, intense progression of prerequisites leading to deep, specialized technical mastery.' },
      { letter: 'B', text: 'A balanced "core" curriculum ensuring everyone has a foundation in the great books and classic philosophies.' },
      { letter: 'C', text: 'A completely open curriculum where you can mix vastly different disciplines (e.g. Neuroscience and Medieval Poetry).' },
      { letter: 'D', text: 'A flexible, interdisciplinary track emphasizing hands-on projects, internships, and building out portfolios.' },
    ],
  },
  {
    id: 'pq4',
    type: 'personality',
    text: 'You have a free weekend on campus. What is the most logical use of your time?',
    options: [
      { letter: 'A', text: 'Hacking hardware, coding a passion project, or competing in a rigorous robotics/math competition.' },
      { letter: 'B', text: 'Leading a student government initiative, debating in Model UN, or writing for the campus newspaper.' },
      { letter: 'C', text: 'Intense, late-night debates about existentialism, art, or economics in a coffee shop.' },
      { letter: 'D', text: 'Networking with founders, attending a hackathon, or working on a startup idea with friends.' },
    ],
  },
  {
    id: 'pq5',
    type: 'personality',
    text: 'What does your logical ideal campus environment look like?',
    options: [
      { letter: 'A', text: 'High-tech labs, intense collaborative study spaces, and people staying up late solving p-sets.' },
      { letter: 'B', text: 'Ivy-covered brick buildings, historic libraries, and a bustling urban center with a strong sense of tradition.' },
      { letter: 'C', text: 'Gothic architecture where people casually read obscure texts on the quad and intellectualize everything.' },
      { letter: 'D', text: 'A sunny, sprawling campus with start-up incubators, makerspaces, and lots of open space.' },
    ],
  },
  {
    id: 'pq6',
    type: 'personality',
    text: 'What is your primary, overriding goal for your undergraduate education?',
    options: [
      { letter: 'A', text: 'To become the foremost technical expert and researcher in my specific STEM field.' },
      { letter: 'B', text: 'To build a powerful, global network and prepare for a prominent leadership or policy role.' },
      { letter: 'C', text: 'To learn how to think critically, challenge norms, and explore the "life of the mind."' },
      { letter: 'D', text: 'To disrupt an industry, build something entirely new, and make a tangible impact quickly.' },
    ],
  },
]

// The questions a student actually walks through. When no essay is written, the
// six personality questions are spliced in right after the essay step so they
// read as the alternative way to establish fit. Recomputed from state on every
// reducer action, so typing an essay removes them and clearing it brings them back.
export function buildSection1(essay) {
  if (essay && essay.trim()) return section1
  const essayIdx = section1.findIndex(q => q.type === 'essay')
  const out = [...section1]
  out.splice(essayIdx + 1, 0, ...personality)
  return out
}
