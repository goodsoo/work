import { AuthGate } from "./components/auth/AuthGate";
import { HomePage } from "./pages/HomePage";

export default function App() {
  return (
    <AuthGate>
      <HomePage />
    </AuthGate>
  );
}
