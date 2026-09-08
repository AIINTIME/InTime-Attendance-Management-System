import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./Context/ThemeContext";
import { ToastProvider } from "./Context/ToastContext";
import { AuthProvider } from "./Context/AuthContext";
import AppRoutes from "./Routes/AppRoutes";
import "./Styles/Style.css";

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
