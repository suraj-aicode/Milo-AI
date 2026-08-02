import { useState, useEffect } from "react";
import Login from "./components/Login";
import Chat from "./components/Chat";

function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("aether_user");
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
      if (parsed.loginTime && Date.now() - parsed.loginTime > TWO_HOURS_MS) {
        localStorage.removeItem("aether_user");
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("aether_theme");
    if (saved === null) return true; // Default to Dark Mode
    return saved === "dark";
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("aether_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("aether_theme", "light");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleLogin = (userData) => {
    const userWithTimestamp = {
      ...userData,
      loginTime: Date.now(),
    };
    setUser(userWithTimestamp);
    try {
      localStorage.setItem("aether_user", JSON.stringify(userWithTimestamp));
    } catch (e) {
      console.error("Failed to save session:", e);
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem("aether_user");
    } catch (e) {
      console.error("Failed to clear session:", e);
    }
  };

  if (!user) {
    return (
      <Login
        onLogin={handleLogin}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />
    );
  }

  return (
    <Chat
      user={user}
      onLogout={handleLogout}
      isDarkMode={isDarkMode}
      toggleDarkMode={toggleDarkMode}
    />
  );
}

export default App;
