import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { BackIcon } from './Icons';

interface TopBarProps {
  title: string;
  sub?: string;
  back: string;
  backLabel: string;
  action?: ReactNode;
}

export function TopBar({ title, sub, back, backLabel, action }: TopBarProps) {
  return (
    <header className="top-bar">
      <Link to={back} className="icon-btn" aria-label={backLabel}>
        <BackIcon />
      </Link>
      <div className="top-bar__text">
        <h1 className="top-bar__title">{title}</h1>
        {sub && <span className="top-bar__sub">{sub}</span>}
      </div>
      {action}
    </header>
  );
}
