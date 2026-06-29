import Nav from './components/Nav'
import Hero from './components/Hero'
import Calculator from './components/Calculator'
import Marketplace from './components/Marketplace'
function App() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Nav />
      <Hero />
      <Calculator />
    </div>
  )
}

export default App