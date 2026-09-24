import { Nav } from './components/Nav'
import { Hero } from './sections/Hero'
import { Urgency } from './sections/Urgency'
import { How } from './sections/How'
import { Workstation } from './sections/demo/Workstation'
import { Effect } from './sections/Effect'
import { Market } from './sections/Market'
import { Pricing } from './sections/Pricing'
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
        <How />
        <Workstation />
        <Effect />
        <Market />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
