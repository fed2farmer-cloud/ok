import Nav from './components/Nav'
import Hero from './components/Hero'
import Calculator from './components/Calculator'
import Marketplace from './components/Marketplace'
import Security from './components/Security'

function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      {/* login form goes here */}
    </div>
  )
}

function Signup() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      {/* signup form goes here */}
    </div>
  )
}

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
    </div>
  )
}

export default App