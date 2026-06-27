import Nav from './components/Nav'
import Hero from './components/Hero'
import Calculator from './components/Calculator'
import Marketplace from './components/Marketplace'
import Security from './components/Security'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero />
      <Calculator />
      <Marketplace />
      <Security />
      <Footer />
    </div>
  )
}

export default App