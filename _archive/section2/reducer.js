// Archived reducer state and cases for interstitial + section2.
// Drop these back into QuizContext when section2 is restored.

// --- initialState additions ---
// section2Answers: [],

// --- ANSWER case (replace the simplified version) ---
// case 'ANSWER': {
//   const key = state.phase === 'section2' ? 'section2Answers' : 'section1Answers'
//   const answers = [...state[key]]
//   answers[state.currentIndex] = action.letter
//   return { ...state, [key]: answers }
// }

// --- NEXT cases (insert after section1 block, before default) ---
// if (state.phase === 'section1') {
//   ...
//   return { ...state, phase: 'interstitial', currentIndex: 0, direction: 'forward' }  // ← section1 end goes to interstitial, not results
// }
// if (state.phase === 'interstitial') {
//   return { ...state, phase: 'section2', currentIndex: 0, direction: 'forward' }
// }
// if (state.phase === 'section2') {
//   if (state.currentIndex < section2.length - 1) {
//     return { ...state, currentIndex: state.currentIndex + 1, direction: 'forward' }
//   }
//   return { ...state, phase: 'results', direction: 'forward' }
// }

// --- BACK cases (insert after section1 block) ---
// if (state.phase === 'interstitial') {
//   return { ...state, phase: 'section1', currentIndex: section1.length - 1, direction: 'back' }
// }
// if (state.phase === 'section2') {
//   if (state.currentIndex > 0) {
//     return { ...state, currentIndex: state.currentIndex - 1, direction: 'back' }
//   }
//   return { ...state, phase: 'interstitial', currentIndex: 0, direction: 'back' }
// }

// --- App.jsx additions ---
// import Interstitial from './phases/Interstitial'
// import Section2 from './phases/Section2'
// case 'interstitial': return <Interstitial />
// case 'section2':     return <Section2 />
