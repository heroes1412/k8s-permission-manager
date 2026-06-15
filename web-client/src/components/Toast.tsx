import React, { useEffect } from 'react'

interface Props {
  message: string
  type?: 'success' | 'error' | 'info'
  onDismiss: () => void
}

export default function Toast({ message, type = 'info', onDismiss }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className={`fixed bottom-6 right-6 z-[300] max-w-sm px-5 py-3.5 rounded-xl shadow-2xl flex items-start gap-3 ${
      type === 'success' ? 'bg-teal-600 text-white' :
      type === 'error' ? 'bg-red-500 text-white' :
      'bg-gray-800 text-white'
    }`}>
      <div className="flex-1 text-sm font-bold leading-snug">{message}</div>
      <button onClick={onDismiss} className="text-white/70 hover:text-white font-black text-lg leading-none -mt-0.5 ml-1">×</button>
    </div>
  )
}
