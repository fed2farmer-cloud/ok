import { Routes, Route } from "react-router-dom";

import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Calculator from "./components/Calculator";
import Marketplace from "./components/Marketplace";
import Security from "./components/Security";
import Footer from "./components/Footer";

import Login from "./pages/Login";

function Home() {
  return (
    <>
      <Nav />
      <Hero />
      <Calculator />
      <Marketplace />
      <Security />
      <Footer />
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}

export default App;