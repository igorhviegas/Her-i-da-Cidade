import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface RouterContextType {
  path: string;
  search: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType>({
  path: '/',
  search: '',
  navigate: () => {},
});

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [path, setPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  const [search, setSearch] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.search || '';
    }
    return '';
  });

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname || '/');
      setSearch(window.location.search || '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (typeof window !== 'undefined') {
      const [targetPathPart, targetQueryPart] = to.split('?');
      const targetPath = targetPathPart || '/';
      const targetSearch = targetQueryPart !== undefined ? `?${targetQueryPart}` : '';
      const targetFull = targetPath + targetSearch;
      const currentFull = window.location.pathname + window.location.search;

      if (currentFull !== targetFull) {
        window.history.pushState({}, '', targetFull);
      }
      setPath(targetPath);
      setSearch(targetSearch);
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <RouterContext.Provider value={{ path, search, navigate }}>
      {children}
    </RouterContext.Provider>
  );
};

export function useRouter(): RouterContextType {
  const context = useContext(RouterContext);
  if (!context) {
    throw new Error('useRouter must be used within a RouterProvider');
  }
  return context;
}

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

export const Link: React.FC<LinkProps> = ({ href, children, className, onClick, ...rest }) => {
  const { navigate } = useRouter();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) onClick(e);
    if (!e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      if (href.startsWith('/') && !href.startsWith('//')) {
        e.preventDefault();
        navigate(href);
      }
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  );
};
