import React from 'react'
import {PacmanLoader} from 'react-spinners'

export function FullScreenLoader({ text }: { text?: string }) {
  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-10">
      <div className="bg-gray-700 h-screen w-screen opacity-75"></div>
      <div className="fixed top-0 left-0 right-0 bottom-0 z-10 flex flex-col items-center justify-center">
        <PacmanLoader size={40} color="#333"></PacmanLoader>
        {text && <p className="mt-8 text-white text-xl font-bold tracking-widest uppercase">{text}</p>}
      </div>
    </div>
  )
}
