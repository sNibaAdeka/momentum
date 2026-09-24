import { Nav } from './components/Nav'
import { Hero } from './sections/Hero'
import { Urgency } from './sections/Urgency'
import { PatientRoute } from './sections/PatientRoute'
import { Pipeline } from './sections/Pipeline'
import { Demo } from './sections/demo/Demo'
import { Impact } from './sections/Impact'
import { Market } from './sections/Market'
import { Pricing } from './sections/Pricing'
import { Principles } from './sections/Principles'
import { FinalCta } from './sections/FinalCta'
import { Footer } from './sections/Footer'

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Перейти к содержанию
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <Urgency />
        <PatientRoute />
        <Pipeline />
        <Demo />
        <Impact />
        <Market />
        <Pricing />
        <Principles />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
