import React from 'react'
import { useLocation } from 'react-router-dom'

export default function PageTransition({ children }) {
  const location = useLocation()

  return (
    <div key={location.pathname} className="page-enter flex-1 flex flex-col min-w-0 overflow-hidden">
      {children}
    </div>
  )
}
