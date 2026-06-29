import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()

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
        <h1 className="text-2xl font-bold text-green-700 mb-4">Log In</h1>

        <input className="w-full border p-3 rounded mb-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border p-3 rounded mb-3" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="w-full bg-green-600 text-white p-3 rounded font-bold">Log In</button>

        {message && <p className="mt-4 text-sm">{message}</p>}
      </form>
    </div>
  )
}