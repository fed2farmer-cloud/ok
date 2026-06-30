import { useState } from 'react'
import { supabase } from './lib/supabase'
import Nav from './components/Nav'
import Hero from './components/Hero'
import Calculator from './components/Calculator'
import Marketplace from './components/Marketplace'
import Security from './components/Security'
function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

    if (!supabase) {
      setMessage('Supabase is not configured')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) setMessage(error.message)
    else setMessage('Login successful!')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
      <form onSubmit={handleLogin} className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-green-700 mb-6">Login</h1>

        <input className="w-full border p-3 rounded mb-4" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <input className="w-full border p-3 rounded mb-4" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button type="submit" className="w-full bg-green-600 text-white p-3 rounded-lg font-bold">
          Login
        </button>

        {message && <p className="mt-4 text-center text-sm">{message}</p>}
      </form>
    </div>
  )
}

function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('borrower')
  const [message, setMessage] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()

    if (!supabase) {
      setMessage('Supabase is not configured')
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    })

    if (error) setMessage(error.message)
    else setMessage('Account created. Check your email to confirm your account.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
      <form onSubmit={handleSignup} className="bg-white p-6 rounded-xl shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-green-700 mb-6">Create Account</h1>

        <input className="w-full border p-3 rounded mb-4" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <input className="w-full border p-3 rounded mb-4" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <select className="w-full border p-3 rounded mb-4" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="borrower">Borrower</option>
          <option value="investor">Investor</option>
        </select>

        <button type="submit" className="w-full bg-green-600 text-white p-3 rounded-lg font-bold">
          Sign Up
        </button>

        {message && <p className="mt-4 text-center text-sm">{message}</p>}
      </form>
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