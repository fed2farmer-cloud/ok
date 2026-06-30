import { useState } from 'react'

import Nav from './components/Nav'
import Hero from './components/Hero'
import Calculator from './components/Calculator'
import Marketplace from './components/Marketplace'
import Security from './components/Security'

function Login() {
  return <h1>LOGIN WORKING</h1>
}

function Signup() {
  return <h1>SIGNUP WORKING</h1>
}

function App() {
  const path = window.location.pathname

  if (path === '/login') return <Login />
  if (path === '/signup') return <Signup />

  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero />
      <Calculator />
      <Marketplace />
      <Security />
    </div>
  )
}

export default App