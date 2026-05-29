import React, { useState } from 'react'
import {Link, useLocation} from 'react-router-dom'
import { useSettings } from '../hooks/useSettings'

export default function Header() {
  const { settings } = useSettings();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const isActive = (path: string) => location.pathname === path;
  
  const navLinkClass = (path: string) => `
    flex items-center px-4 py-3 md:py-2 rounded-xl md:rounded-pill text-sm md:text-[12px] font-normal transition-all font-text
    ${isActive(path) 
      ? 'bg-[rgba(255,255,255,0.1)] text-white' 
      : 'text-gray-300 hover:text-white hover:bg-[rgba(255,255,255,0.05)]'}
  `;

  return (
    <nav className="min-h-[48px] bg-[rgba(0,0,0,0.8)] backdrop-blur-[20px] backdrop-saturate-[180%] sticky top-0 z-50 w-full">
      <div className="max-w-[980px] w-full mx-auto px-4">
        <div className="flex items-center justify-between h-[48px]">
          <Link to="/" className="flex items-center flex-shrink-0 text-white group" onClick={() => setIsMenuOpen(false)}>
            <svg className="w-[17px] h-[48px] group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
            <span className="ml-3 font-display font-semibold text-[17px] tracking-tight group-hover:text-gray-300 transition-colors hidden sm:block">Permission Manager</span>
          </Link>
          
          {/* Desktop Menu */}
          <div className="hidden md:flex space-x-2">
            <Link to="/" className={navLinkClass('/')}>
              Users
            </Link>
            <Link to="/permissions" className={navLinkClass('/permissions')}>
              Permissions
            </Link>
            <Link to="/namespaces" className={navLinkClass('/namespaces')}>
              Namespaces
            </Link>
            <Link to="/audit" className={navLinkClass('/audit')}>
              Access Audit
            </Link>
            <Link to="/visualizer" className={navLinkClass('/visualizer')}>
              Visualizer
            </Link>
            {settings.GROUPS_ENABLED === 'true' && (
              <Link to="/roles" className={navLinkClass('/roles')}>
                Roles
              </Link>
            )}
            <Link to="/settings" className={navLinkClass('/settings')}>
              Settings
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-300 hover:text-white focus:outline-none p-2 rounded-md hover:bg-[rgba(255,255,255,0.1)]"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu Panel */}
        <div className={`md:hidden ${isMenuOpen ? 'block' : 'hidden'} pb-4 pt-2 border-t border-[rgba(255,255,255,0.1)]`}>
          <div className="flex flex-col space-y-1">
            <Link to="/" onClick={() => setIsMenuOpen(false)} className={navLinkClass('/')}>
              Users
            </Link>
            <Link to="/permissions" onClick={() => setIsMenuOpen(false)} className={navLinkClass('/permissions')}>
              Permissions
            </Link>
            <Link to="/namespaces" onClick={() => setIsMenuOpen(false)} className={navLinkClass('/namespaces')}>
              Namespaces
            </Link>
            <Link to="/audit" onClick={() => setIsMenuOpen(false)} className={navLinkClass('/audit')}>
              Access Audit
            </Link>
            <Link to="/visualizer" onClick={() => setIsMenuOpen(false)} className={navLinkClass('/visualizer')}>
              Visualizer
            </Link>
            {settings.GROUPS_ENABLED === 'true' && (
              <Link to="/roles" onClick={() => setIsMenuOpen(false)} className={navLinkClass('/roles')}>
                Roles
              </Link>
            )}
            <Link to="/settings" onClick={() => setIsMenuOpen(false)} className={navLinkClass('/settings')}>
              Settings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
