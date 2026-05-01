import React from 'react'
import {Link, useLocation} from 'react-router-dom'

export default function Header() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  const navLinkClass = (path: string) => `
    flex items-center px-4 py-2 rounded-pill text-[12px] font-normal transition-all font-text
    ${isActive(path) 
      ? 'text-white' 
      : 'text-white hover:underline'}
  `;

  return (
    <nav className="h-[48px] bg-[rgba(0,0,0,0.8)] backdrop-blur-[20px] backdrop-saturate-[180%] sticky top-0 z-50 flex items-center justify-center">
      <div className="max-w-[980px] w-full mx-auto flex items-center justify-between px-4">
        <Link to="/" className="flex items-center flex-shrink-0 text-white">
          <svg className="w-[17px] h-[48px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
          </svg>
        </Link>
        
        <div className="flex space-x-4">
          <Link to="/" className={navLinkClass('/')}>
            Users
          </Link>
          
          <Link to="/permissions" className={navLinkClass('/permissions')}>
            Permissions
          </Link>

          <Link to="/namespaces" className={navLinkClass('/namespaces')}>
            Namespaces
          </Link>
          
          <Link to="/roles" className={navLinkClass('/roles')}>
            Roles
          </Link>
          
          <Link to="/settings" className={navLinkClass('/settings')}>
            Settings
          </Link>
        </div>
      </div>
    </nav>
  )
}
