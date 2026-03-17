"use client"

import { useEffect, useRef } from "react"

type AdSlotProps = {
  code: string
  className?: string
}

export default function AdSlot({ code, className }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!containerRef.current || !code) return

    containerRef.current.innerHTML = ""

    const wrapper = document.createElement("div")
    wrapper.innerHTML = code

    const scripts = wrapper.querySelectorAll("script")
    const nonScripts = Array.from(wrapper.childNodes).filter(
      (node) => node.nodeName.toLowerCase() !== "script"
    )

    nonScripts.forEach((node) => {
      containerRef.current?.appendChild(node.cloneNode(true))
    })

    scripts.forEach((script) => {
      const newScript = document.createElement("script")

      Array.from(script.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value)
      })

      if (script.textContent) {
        newScript.textContent = script.textContent
      }

      containerRef.current?.appendChild(newScript)
    })
  }, [code])

  if (!code) return null

  return <div ref={containerRef} className={className} />
}