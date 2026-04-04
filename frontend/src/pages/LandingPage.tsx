import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import StatsBar from '../components/landing/StatsBar'
import Features from '../components/landing/Features'
import HowItWorks from '../components/landing/HowItWorks'
import ForDevelopers from '../components/landing/ForDevelopers'
import CTABand from '../components/landing/CTABand'
import Footer from '../components/landing/Footer'
import '../styles/doodle.css'

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FDFAF4' }}>
      <Navbar />

      {/* Sections */}
      <div id="upload-section">
        <Hero />
      </div>
      <StatsBar />
      <Features />
      <HowItWorks />
      <ForDevelopers />
      <CTABand />
      <Footer />
    </div>
  )
}
