import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Calculator from "./components/Calculator";
import Marketplace from "./components/Marketplace";
import Security from "./components/Security";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function App() {
  const path = window.location.pathname;

  // Login page
  if (path === "/login") {
    return <Login />;
  }

  // Signup page
  if (path === "/signup") {
    return <Signup />;
  }

  // Home page
  return (
    <div className="min-h-screen bg-white">
      <Nav />

      <Hero />

      <section id="calculator">
        <Calculator />
      </section>

      <section id="invest">
        <Marketplace />
      </section>

      <section id="security">
        <Security />
      </section>
    </div>
  );
}

export default App;