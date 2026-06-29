import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
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

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Login successful!')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50 p-6">
      <form
        onSubmit={handleLogin}
        className="bg-white p-6 rounded-xl shadow-md w-full max-w-md"
      >
        <h1 className="text-2xl font-bold text-green-700 mb-4">
          Login
        </h1>

        <input
          className="w-full border p-3 rounded mb-3"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          className="w-full border p-3 rounded mb-3"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-green-600 text-white p-3 rounded font-bold"
        >
          Login
        </button>

        {message && (
          <p className="mt-4 text-sm text-center">
            {message}
          </p>
        )}
      </form>
    </div>
  )
}