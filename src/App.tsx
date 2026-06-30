import Nav from './components/Nav'
import Hero from './components/Hero'
import Calculator from './components/Calculator'
import Marketplace from './components/Marketplace'
import Security from './components/Security'

function App() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Nav />
      <Hero />
      <Calculator />
      <Marketplace />
      <Security />
    </div>
  )
}

export default App