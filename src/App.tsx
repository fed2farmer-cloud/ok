import Nav from './components/Nav'
import Hero from './components/Hero'
import Calculator from './components/Calculator'
import Marketplace from './components/Marketplace'
import Security from './components/Security'
import Footer from './components/Footer'
import Login from './pages/Login'
import Signup from './pages/Signup'

function App() {
  const path = window.location.pathname

  if (path === '/login') return <Login />
  if (path === '/signup') return <Signup />

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
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