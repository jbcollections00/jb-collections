"use client"

import { useEffect, useRef } from "react"

type AdSlotProps = {
  code: string
  className?: string
  userRole?: string | null
  isAdmin?: boolean
}

export default function AdSlot({ code, className, userRole, isAdmin }: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  // System check kung admin ang nakatingin
  const hideForAdmin = isAdmin || userRole?.toLowerCase() === "admin"

  useEffect(() => {
    // Kapag admin o walang code, wag iproseso ang scripts
    if (!containerRef.current || !code || hideForAdmin) return

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

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ""
      }
    }
  }, [code, hideForAdmin])

  // Wag mag-render ng kahit anong HTML kapag Admin
  if (!code || hideForAdmin) return null

  return <div ref={containerRef} className={className} />
}