import { useTheme } from "../../Context/ThemeContext";
import logoLight from "../../Assets/logo/intime-logo.png";
import logoDark from "../../Assets/logo/intime-logo-white.png";
import icon from "../../Assets/logo/intime-icon.png";

export default function Logo({ variant = "full", height = 24, className = "" }) {
  const { theme } = useTheme();

  if (variant === "icon") {
    return <img src={icon} alt="InTime" height={height} className={className} />;
  }

  const src = theme === "dark" ? logoDark : logoLight;
  return <img src={src} alt="InTime" height={height} className={className} />;
}
