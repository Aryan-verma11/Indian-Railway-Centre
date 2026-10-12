
import { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Header({ studentMinimal = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const links = [
    ...(user.role === 'admin'
      ? [
          ['/admin', 'Dashboard', true],
          ['/admin/users', 'Users'],
          ['/admin/audit', 'Audit Log'],
          ['/admin/settings', 'Settings'],
        ]
      : []),
    ['/details', 'My Details'],
    ['/change-password', 'Change Password'],
  ];

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className={`site-header${studentMinimal ? ' student-site-header' : ''}`}>
      <div className={`header-inner${studentMinimal ? ' student-header-inner' : ''}`}>
        <img
          src="/railway.jpg"
          alt="Indian Railways logo"
          className="site-railway-logo"
        />

        <div className={studentMinimal ? 'student-brand' : 'site-brand'}>
          <Link
            to={user.role === 'admin' ? '/admin' : '/details'}
            className="site-name"
          >
            INDIAN RAILWAY CENTRE
          </Link>

          <p className="site-tagline">
            Safety <span>|</span> Security <span>|</span> Punctuality
          </p>
        </div>

        <div className="site-emblem-wrap">
          <img
            src="/emblem.png"
            alt="Emblem of India"
            className="site-india-emblem"
          />
          <span>सत्यमेव जयते</span>
        </div>


{!studentMinimal && (
  <>
    <button
      type="button"
      className="menu-toggle"
      aria-expanded={open}
      aria-controls="site-nav"
      onClick={() => setOpen(!open)}
    >
      Menu
    </button>

    <nav
      id="site-nav"
      className={`site-nav${open ? ' open' : ''}`}
      aria-label="Main"
    >
      {links.map(([to, label, end]) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  </>
)}

<button
  type="button"
  className="student-logout"
  onClick={handleLogout}
>
  Logout
</button>
      </div>
    </header>
  );
}
