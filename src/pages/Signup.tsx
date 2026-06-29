import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('borrower')
  const [message, setMessage] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()

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
        <h1 className="text-2xl font-bold text-green-700 mb-4">Create Account</h1>

        <input className="w-full border p-3 rounded mb-3" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full border p-3 rounded mb-3" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />

        <select className="w-full border p-3 rounded mb-3" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="borrower">Borrower</option>
          <option value="investor">Investor</option>
        </select>

        <button className="w-full bg-green-600 text-white p-3 rounded font-bold">Sign Up</button>

        {message && <p className="mt-4 text-sm">{message}</p>}
      </form>
    </div>
  )
}