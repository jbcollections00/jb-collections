"use client"

import { useEffect, useRef } from "react"

export default function AdBanner() {
  const bannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (bannerRef.current && !bannerRef.current.firstChild) {
      const confScript = document.createElement("script")
      confScript.type = "text/javascript"
      confScript.text = `
        atOptions = {
          'key' : '99f05c43be188cef9d877a7519d8166a',
          'format' : 'iframe',
          'height' : 250,
          'width' : 300,
          'params' : {}
        };
      `

      const adScript = document.createElement("script")
      adScript.type = "text/javascript"
      adScript.src = "//www.topcreativeformat.com/99f05c43be188cef9d877a7519d8166a/invoke.js"

      bannerRef.current.appendChild(confScript)
      bannerRef.current.appendChild(adScript)
    }
  }, [])

  return (
    <div className="flex items-center justify-center min-h-[250px] min-w-[300px]">
      <div ref={bannerRef} />
    </div>
  )
}