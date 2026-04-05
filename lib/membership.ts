export type MembershipValue = "standard" | "premium" | "platinum"

export type ProfileMembershipRow = {
  role?: string | null
  membership?: string | null
  is_premium?: boolean | null
  membership_expires_at?: string | null
}

export function normalizeMembership(value?: string | null): MembershipValue {
  const membership = String(value || "").trim().toLowerCase()

  if (membership === "platinum") return "platinum"
  if (membership === "premium") return "premium"
  return "standard"
}

export function isMembershipExpired(expiresAt?: string | null) {
  if (!expiresAt) return false

  const expiresTime = new Date(expiresAt).getTime()

  if (!Number.isFinite(expiresTime)) return false

  return expiresTime <= Date.now()
}

export function getEffectiveMembership(profile?: ProfileMembershipRow | null): MembershipValue {
  if (!profile) return "standard"
  if (String(profile.role || "").toLowerCase() === "admin") return "platinum"

  const membership = normalizeMembership(profile.membership)

  if (membership === "standard") return "standard"
  if (isMembershipExpired(profile.membership_expires_at)) return "standard"

  return membership
}

export function getEffectivePremiumFlags(profile?: ProfileMembershipRow | null) {
  const effectiveMembership = getEffectiveMembership(profile)

  return {
    membership: effectiveMembership,
    isPremium: effectiveMembership === "premium" || effectiveMembership === "platinum",
    isPlatinum: effectiveMembership === "platinum",
    expired:
      normalizeMembership(profile?.membership) !== "standard" &&
      isMembershipExpired(profile?.membership_expires_at),
  }
}