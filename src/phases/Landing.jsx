import '../styles/Landing.css'
import { useQuiz } from '../context/QuizContext'
import FloatingSchools from '../components/FloatingSchools'

// Schools drawn from the calculator's own set. `pos` lays them out in a fixed,
// symmetric frame around the headline (clear of the center text). `accent` tints
// the seal-fallback orange; `hideSm` drops the card on narrow screens.
const SCHOOLS = [
  // four corners (always visible)
  { id: 1,  name: 'MIT',             slug: 'mit',       monogram: 'MIT', pos: { top: '11%', left: '7%' } },
  { id: 2,  name: 'Harvard',         slug: 'harvard',   monogram: 'H',   pos: { top: '11%', right: '7%' }, accent: true },
  { id: 3,  name: 'Stanford',        slug: 'stanford',  monogram: 'S',   pos: { bottom: '12%', left: '7%' } },
  { id: 4,  name: 'Yale',            slug: 'yale',      monogram: 'Y',   pos: { bottom: '12%', right: '7%' } },
  // top edge
  { id: 5,  name: 'Princeton',       slug: 'princeton', monogram: 'Pr',  pos: { top: '6%', left: '31%' }, hideSm: true },
  { id: 6,  name: 'Columbia',        slug: 'columbia',  monogram: 'Co',  pos: { top: '6%', right: '31%' }, hideSm: true },
  // bottom edge
  { id: 7,  name: 'UChicago',        slug: 'uchicago',  monogram: 'UC',  pos: { bottom: '7%', left: '31%' }, hideSm: true },
  { id: 8,  name: 'Cornell',         slug: 'cornell',   monogram: 'Cor', pos: { bottom: '7%', right: '31%' }, hideSm: true },
  // left column
  { id: 9,  name: 'Caltech',         slug: 'caltech',   monogram: 'Ct',  pos: { top: '40%', left: '4%' }, accent: true, hideSm: true },
  { id: 10, name: 'UPenn',           slug: 'upenn',     monogram: 'P',   pos: { top: '62%', left: '6%' }, hideSm: true },
  // right column
  { id: 11, name: 'Brown',           slug: 'brown',     monogram: 'Br',  pos: { top: '40%', right: '4%' }, hideSm: true },
  { id: 12, name: 'UC Berkeley',     slug: 'berkeley',  monogram: 'Cal', pos: { top: '62%', right: '6%' }, accent: true, hideSm: true },
  // upper inner sides
  { id: 13, name: 'Carnegie Mellon', slug: 'cmu',       monogram: 'CMU', pos: { top: '25%', left: '17%' }, hideSm: true },
  { id: 14, name: 'NYU Abu Dhabi',   slug: 'nyuad',     monogram: 'NYU', pos: { top: '25%', right: '17%' }, hideSm: true },
]

export default function Landing() {
  const { dispatch } = useQuiz()

  return (
    <FloatingSchools
      brand="Freshman Academy"
      eyebrow="Admissions Fit Calculator"
      title="Find out where you"
      titleAccent="actually fit."
      ctaText="Start →"
      meta="14 questions · ~5 minutes · no sign-up"
      onCta={() => dispatch({ type: 'START' })}
      schools={SCHOOLS}
    />
  )
}
