import { Link, useLocation } from "react-router-dom";
import styles from "./Navbar.module.css";
// import Logo from "../assets/for-all-ages-logo.svg"

interface NavItem {
  label: string;
  path: string;
}

interface NavbarProps {
  navItems?: NavItem[];
}

export default function Navbar({ navItems = [
    { label: "Meetings", path: "/meetings" },
    { label: "Tasks", path: "/" },
    { label: "Communication", path: "/communication" },
  ] }: NavbarProps) {
  const location = useLocation();

  return (
    <div className={styles.bar}>
      {/* <div className={styles.logoContainer}>
        <Link to="/" className={styles.logoLink}>
          <img src={Logo} alt="For All Ages Logo" className={styles.logo} />
        </Link>
      </div> */}
      <div className={styles.container}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`${styles.link} ${isActive ? styles.active : ""}`}

            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className={styles.right}></div>
    </div>
  );
}
