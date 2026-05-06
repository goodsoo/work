import { AuthGate } from "./components/auth/AuthGate";
import { MeetingsPage } from "./pages/MeetingsPage";

export default function App() {
  return (
    <AuthGate>
      <MeetingsPage />
    </AuthGate>
  );
}
