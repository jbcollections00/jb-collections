export function trackAdStart() {
  localStorage.setItem("ad_start_time", Date.now().toString())
}

export function validateAdReturn(minSeconds = 8) {
  const start = localStorage.getItem("ad_start_time")
  if (!start) return false

  const elapsed = (Date.now() - Number(start)) / 1000
  return elapsed >= minSeconds
}
