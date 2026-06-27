import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RouterContextValue {
  path: string;
  navigate: (to: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const RouterContext = createContext<RouterContextValue>({
  path: '/',
  navigate: () => {},
});

// ─── Provider ────────────────────────────────────────────────────────────────

export function HashRouter({ children }: { children: ReactNode }) {
  const getPath = () => {
    const hash = window.location.hash.replace(/^#/, '') || '/';
    return hash.split('?')[0] || '/';
  };

  const [path, setPath] = useState<string>(getPath);

  useEffect(() => {
    const handler = () => setPath(getPath());
    window.addEventListener('hashchange', handler);
    // Initialize hash if missing
    if (!window.location.hash) {
      window.location.hash = '/';
    }
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
    setPath(to);
  }, []);

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useRouter(): RouterContextValue {
  return useContext(RouterContext);
}

// ─── Routes / Route ──────────────────────────────────────────────────────────

interface RouteProps {
  path: string;
  element: ReactNode;
  exact?: boolean;
}

interface RoutesProps {
  children: ReactNode;
}

export function Routes({ children }: RoutesProps) {
  const { path } = useRouter();

  // Collect all Route children and find the first match
  const routeArray = Array.isArray(children) ? children : [children];

  for (const child of routeArray) {
    if (!child || typeof child !== 'object' || !('props' in child)) continue;
    const props = (child as { props: RouteProps }).props;
    if (matchPath(props.path, path, props.exact !== false)) {
      return <>{props.element}</>;
    }
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Route(_props: RouteProps) {
  // consumed by Routes
  return null;
}

function matchPath(routePath: string, currentPath: string, exact: boolean): boolean {
  if (routePath === currentPath) return true;
  if (exact && routePath !== currentPath) return false;
  if (!exact && currentPath.startsWith(routePath)) return true;
  return false;
}

// ─── NavLink ─────────────────────────────────────────────────────────────────

interface NavLinkProps {
  to: string;
  children: ReactNode;
  className?: string | ((args: { isActive: boolean }) => string);
  end?: boolean;
  onClick?: () => void;
}

export function NavLink({ to, children, className, end, onClick }: NavLinkProps) {
  const { path, navigate } = useRouter();

  const isActive = end
    ? path === to
    : path === to || path.startsWith(to + '/');

  const resolvedClass =
    typeof className === 'function' ? className({ isActive }) : className ?? '';

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(to);
    onClick?.();
  };

  return (
    <a href={`#${to}`} className={resolvedClass} onClick={handleClick}>
      {children}
    </a>
  );
}
